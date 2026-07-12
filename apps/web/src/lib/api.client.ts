const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let activeAccessToken = '';
let onSessionExpiredCallback: (() => void) | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

export function setAccessToken(token: string) {
  activeAccessToken = token;
}

export function getAccessToken() {
  return activeAccessToken;
}

export function setSessionExpiredCallback(callback: () => void) {
  onSessionExpiredCallback = callback;
}

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function fetchClient(path: string, options: RequestInit = {}): Promise<Response> {
  const cleanBase = BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  const url = `${cleanBase}/${cleanPath}`;
  const headers = new Headers(options.headers || {});

  if (activeAccessToken) {
    headers.set('Authorization', `Bearer ${activeAccessToken}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(url, mergedOptions);

  if (response.status === 401) {
    // If the path itself is login, register or refresh, do not intercept and try to refresh
    if (path.includes('/auth/login') || path.includes('/auth/register') || path.includes('/auth/refresh')) {
      return response;
    }

    const refreshToken = typeof window !== 'undefined' ? window.localStorage.getItem('rt') : null;
    if (!refreshToken) {
      if (onSessionExpiredCallback) {
        onSessionExpiredCallback();
      }
      return response;
    }

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          activeAccessToken = data.accessToken;
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('rt', data.refreshToken);
          }
          isRefreshing = false;
          onRefreshed(data.accessToken);

          // Retry the original request immediately
          headers.set('Authorization', `Bearer ${data.accessToken}`);
          return fetch(url, { ...options, headers });
        } else {
          isRefreshing = false;
          activeAccessToken = '';
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('rt');
          }
          if (onSessionExpiredCallback) {
            onSessionExpiredCallback();
          }
          return response;
        }
      } catch {
        isRefreshing = false;
        return response;
      }
    }

    // Queue requests while refreshing is active
    return new Promise((resolve, reject) => {
      subscribeTokenRefresh((newToken) => {
        headers.set('Authorization', `Bearer ${newToken}`);
        fetch(url, { ...options, headers })
          .then(resolve)
          .catch(reject);
      });
    });
  }

  return response;
}
