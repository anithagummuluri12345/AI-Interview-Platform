# Authentication & Authorization API Documentation

This document describes the API endpoints, request/response models, token lifecycles, and security protocols designed for the authentication and authorization foundation of the AI Interview Platform.

---

## 1. Environment Variables

Define the following environment variables in `apps/api/.env` (do not store raw secrets in version control):

| Variable Name | Description | Example / Default Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@127.0.0.1:5432/ai_interview` |
| `JWT_ACCESS_SECRET` | Secret key used to sign Access Tokens | `super-secret-access-key` |
| `JWT_REFRESH_SECRET` | Secret key used to validate Refresh Sessions | `super-secret-refresh-key` |
| `JWT_ACCESS_EXPIRES_IN` | Duration of short-lived Access Token validity | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Duration of long-lived Refresh Token validity | `7d` |

---

## 2. API Endpoints Reference

### 2.1 Candidate Registration
* **Endpoint:** `POST /api/v1/auth/register`
* **Access Control:** Public
* **Purpose:** Register a new user with default role `CANDIDATE` and initialize their profile.
* **Request Payload (JSON):**
  ```json
  {
    "email": "candidate@example.com",
    "password": "securePassword123",
    "fullName": "John Doe"
  }
  ```
* **Successful Response (`201 Created`):**
  ```json
  {
    "id": "e3b0c442-98fc-11ec-b909-0242ac120002",
    "email": "candidate@example.com",
    "role": "CANDIDATE",
    "emailVerified": false,
    "createdAt": "2026-07-08T18:00:00.000Z",
    "updatedAt": "2026-07-08T18:00:00.000Z",
    "profile": {
      "id": "f5d0e442-98fc-11ec-b909-0242ac120002",
      "userId": "e3b0c442-98fc-11ec-b909-0242ac120002",
      "fullName": "John Doe"
    }
  }
  ```
* **Error Scopes:**
  * `400 Bad Request` — Weak password (< 8 chars) or malformed email.
  * `409 Conflict` — Email already registered in the system.

---

### 2.2 User Login
* **Endpoint:** `POST /api/v1/auth/login`
* **Access Control:** Public
* **Purpose:** Validate login credentials, return access token and starting refresh token.
* **Request Payload (JSON):**
  ```json
  {
    "email": "candidate@example.com",
    "password": "securePassword123"
  }
  ```
* **Successful Response (`200 OK`):**
  ```json
  {
    "user": {
      "id": "e3b0c442-98fc-11ec-b909-0242ac120002",
      "email": "candidate@example.com",
      "role": "CANDIDATE"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "7c12563cfd298f24ea1c7d..."
  }
  ```
* **Error Scopes:**
  * `401 Unauthorized` — Generic message "Invalid credentials" (email presence is not disclosed).

---

### 2.3 Token Refresh (Rotation)
* **Endpoint:** `POST /api/v1/auth/refresh`
* **Access Control:** Public
* **Purpose:** Exchange a valid refresh token for a brand-new token pair. The old refresh token is revoked.
* **Request Payload (JSON):**
  ```json
  {
    "refreshToken": "7c12563cfd298f24ea1c7d..."
  }
  ```
* **Successful Response (`200 OK`):**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "9d34563cfd298f24ea1c8e..."
  }
  ```
* **Error Scopes:**
  * `401 Unauthorized` — Token is invalid, expired, or was already reused.

---

### 2.4 User Logout
* **Endpoint:** `POST /api/v1/auth/logout`
* **Access Control:** Public
* **Purpose:** Revoke the active refresh session. Repeating the request is safe.
* **Request Payload (JSON):**
  ```json
  {
    "refreshToken": "7c12563cfd298f24ea1c7d..."
  }
  ```
* **Successful Response (`200 OK`):**
  ```json
  {
    "success": true
  }
  ```

---

### 2.5 Current Profile Details
* **Endpoint:** `GET /api/v1/auth/me`
* **Access Control:** Protected (`Bearer <AccessToken>`)
* **Purpose:** Fetch detailed candidate user and profile details.
* **Successful Response (`200 OK`):**
  ```json
  {
    "id": "e3b0c442-98fc-11ec-b909-0242ac120002",
    "email": "candidate@example.com",
    "role": "CANDIDATE",
    "emailVerified": false,
    "createdAt": "2026-07-08T18:00:00.000Z",
    "updatedAt": "2026-07-08T18:00:00.000Z",
    "profile": {
      "id": "f5d0e442-98fc-11ec-b909-0242ac120002",
      "userId": "e3b0c442-98fc-11ec-b909-0242ac120002",
      "fullName": "John Doe",
      "headline": null,
      "biography": null
    }
  }
  ```

---

## 3. Token Lifecycle & Flow

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate/Client
    participant API as API Server (NestJS)
    database DB as Database (Prisma/PG)

    Candidate->>API: POST /auth/register (Credentials)
    API->>DB: Create User & Profile
    DB-->>API: User Created
    API-->>Candidate: 201 Created (Safe serialization)

    Candidate->>API: POST /auth/login (Credentials)
    API->>DB: Query User Profile
    DB-->>API: User details
    API->>DB: Create RefreshSession (Store hashed token)
    API-->>Candidate: 200 OK (AccessToken + RefreshToken)

    Note over Candidate, API: Client calls protected route using AccessToken header
    Candidate->>API: GET /auth/me (Authorization Bearer AccessToken)
    API->>API: Validate AccessToken signature & expiration
    API-->>Candidate: 200 OK (Profile details)

    Note over Candidate, API: AccessToken expires; client requests refresh rotation
    Candidate->>API: POST /auth/refresh (RefreshToken)
    API->>DB: Query Session by hash
    DB-->>API: Session found (Active)
    API->>DB: Revoke old Session (isRevoked = true)
    API->>DB: Create new RefreshSession (Store new hashed token)
    API-->>Candidate: 200 OK (New AccessToken + New RefreshToken)
```

---

## 4. Security Decisions

* **Refresh-Token Rotation (RTR):** After each refresh request, the previous refresh token is immediately invalidated (revoked), and a new token is generated.
* **Reuse Detection:** If an already-revoked refresh token is submitted to `/auth/refresh`, the server flags this as token reuse (possible theft). The system immediately revokes **all active refresh sessions** for that user to terminate access, requiring re-login.
* **Secure Storage:** Raw refresh tokens are never saved to the database. Only their SHA-256 digests are stored inside `RefreshSession.tokenHash` to protect against database leaks.
* **Safe Serialization:** Password hashes (`passwordHash`) are excluded from return payloads inside both `register` and `getCurrentUser` services using the `delete` operator, preventing accidentally leakage to the frontend.
* **Password Strength:** Compulsory minimum length constraint of 8 characters and maximum of 32 characters on signup. Passwords are securely hashed via `bcryptjs` with salt round index `10`.
* **Generic Login Errors:** To prevent account enumeration attacks, login errors return a generic `Invalid credentials` error rather than specifying if the email exists.
