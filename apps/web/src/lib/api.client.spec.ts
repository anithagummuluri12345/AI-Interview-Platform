import { fetchClient, setAccessToken, setSessionExpiredCallback, getAccessToken } from './api.client';

describe('api.client (API Client Foundation)', () => {
  let mockFetch: jest.Mock;
  let sessionExpiredCalled = false;

  beforeEach(() => {
    sessionExpiredCalled = false;
    setAccessToken('');
    setSessionExpiredCallback(() => {
      sessionExpiredCalled = true;
    });

    // Mock global storage
    const storage: Record<string, string> = { rt: 'mock-refresh-token' };
    Object.defineProperty(global, 'window', {
      value: {
        localStorage: {
          getItem: (key: string) => storage[key] || null,
          setItem: (key: string, val: string) => {
            storage[key] = val;
          },
          removeItem: (key: string) => {
            delete storage[key];
          },
        },
      },
      writable: true,
      configurable: true,
    });

    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should append Authorization header if access token exists', async () => {
    setAccessToken('test-access-token');
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ data: 'success' }),
    });

    const res = await fetchClient('/api/v1/test');
    expect(res.status).toBe(200);

    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain('/api/v1/test');
    const headers = calledOptions.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-access-token');
  });

  it('should automatically try to refresh token on 401 response and retry original request once', async () => {
    setAccessToken('expired-access-token');

    // 1st request -> returns 401
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
    });

    // Refresh request -> returns 200 with rotated tokens
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({
        accessToken: 'fresh-access-token',
        refreshToken: 'new-rotated-refresh-token',
      }),
    });

    // Retried original request -> returns 200
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ data: 'retry-success' }),
    });

    const res = await fetchClient('/api/v1/test');
    const resData = await res.json();

    expect(resData.data).toBe('retry-success');
    expect(getAccessToken()).toBe('fresh-access-token');
    expect(window.localStorage.getItem('rt')).toBe('new-rotated-refresh-token');
    expect(sessionExpiredCalled).toBe(false);

    // Verify calls:
    // Call 0: original request with expired token
    // Call 1: refresh request with old refresh token
    // Call 2: retried original request with fresh access token
    expect(mockFetch).toHaveBeenCalledTimes(3);
    const refreshCall = mockFetch.mock.calls[1];
    expect(refreshCall[0]).toContain('/api/v1/auth/refresh');
    expect(JSON.parse(refreshCall[1].body).refreshToken).toBe('mock-refresh-token');

    const retryCall = mockFetch.mock.calls[2];
    expect(retryCall[1].headers.get('Authorization')).toBe('Bearer fresh-access-token');
  });

  it('should queue multiple simultaneous requests and refresh exactly once', async () => {
    setAccessToken('expired-access-token');

    let refreshCallsCount = 0;
    mockFetch.mockImplementation((url, opts) => {
      if (url.includes('/auth/refresh')) {
        refreshCallsCount++;
        return Promise.resolve({
          status: 200,
          ok: true,
          json: async () => ({
            accessToken: 'shared-fresh-token',
            refreshToken: 'rotated-shared-token',
          }),
        });
      }
      if (url.includes('/resource1')) {
        const auth = opts?.headers?.get?.('Authorization') || '';
        if (auth.includes('expired-access-token')) {
          return Promise.resolve({ status: 401, ok: false });
        }
        return Promise.resolve({ status: 200, ok: true, json: async () => ({ result: 'req1-ok' }) });
      }
      if (url.includes('/resource2')) {
        const auth = opts?.headers?.get?.('Authorization') || '';
        if (auth.includes('expired-access-token')) {
          return Promise.resolve({ status: 401, ok: false });
        }
        return Promise.resolve({ status: 200, ok: true, json: async () => ({ result: 'req2-ok' }) });
      }
      return Promise.resolve({ status: 404 });
    });

    const [res1, res2] = await Promise.all([
      fetchClient('/api/v1/resource1'),
      fetchClient('/api/v1/resource2'),
    ]);

    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(data1.result).toBe('req1-ok');
    expect(data2.result).toBe('req2-ok');
    expect(refreshCallsCount).toBe(1);

    // Calls:
    // - req1 (401)
    // - req2 (401)
    // - POST /auth/refresh (exactly once)
    // - req1 retry
    // - req2 retry
    expect(mockFetch).toHaveBeenCalledTimes(5);
    const refreshCalls = mockFetch.mock.calls.filter(call => call[0].includes('/auth/refresh'));
    expect(refreshCalls.length).toBe(1);
  });

  it('should call session expired callback and clear storage if refresh fails', async () => {
    setAccessToken('expired-access-token');

    // 1st request -> returns 401
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
    });

    // Refresh request -> returns 401 (e.g. invalid/revoked/expired refresh token)
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: async () => ({ message: 'Refresh token invalid' }),
    });

    const res = await fetchClient('/api/v1/test');
    expect(res.status).toBe(401);
    expect(getAccessToken()).toBe('');
    expect(window.localStorage.getItem('rt')).toBeNull();
    expect(sessionExpiredCalled).toBe(true);
  });

  it('should bypass interceptor on login, register, and refresh routes', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: async () => ({ message: 'Invalid credentials' }),
    });

    const res = await fetchClient('/api/v1/auth/login', { method: 'POST' });
    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1); // No refresh attempt triggered
    expect(sessionExpiredCalled).toBe(false);
  });
});
