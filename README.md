# Lesson Slides Studio

Lesson Slides Studio is a full-stack slide generator for Bible lessons with:

- Node.js + Express backend
- Firebase Admin SDK for Firestore and token verification
- Firebase email/password user accounts
- OpenAI-backed generation with parser fallback
- custom C++ export planning for PPT generation
- Zod request validation
- Vitest route tests

## Final Architecture

Frontend:

- static HTML/CSS/JS
- authenticates with email/password through backend auth routes
- sends Firebase ID tokens to protected API routes

Backend:

- verifies Firebase ID tokens with Firebase Admin SDK
- stores projects and live state in Firestore through Admin SDK
- validates request payloads with Zod
- generates PPT files with `pptxgenjs`
- runs a custom C++ export-planning binary before PPT export

## Requirements

- Node.js 20+
- npm
- `g++`
- `make`
- Firebase project with:
  - Firestore enabled
  - Email/Password sign-in enabled in Firebase Authentication
- OpenAI API key if you want model-backed generation

## Install

```bash
npm install
make cpp
```

Run tests:

```bash
npm test
```

## Environment Variables

Copy the example:

```bash
cp .env.example .env
```

Required backend/auth variables:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID`

Project config variables:

- `FIREBASE_PROJECTS_COLLECTION`
- `FIREBASE_LIVE_COLLECTION`
- `ALLOW_PUBLIC_REGISTRATION`

General app variables:

- `PORT`
- `API_BASE_URL`
- `ALLOWED_ORIGIN`
- `CSP_CONNECT_SRC`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## Local Run

Terminal 1, backend:

```bash
npm run dev
```

Terminal 2, frontend:

```bash
python3 -m http.server 4173
```

Open:

```text
http://localhost:4173
```

## Auth Flow

The app no longer uses a shared admin password.

It now uses real Firebase user accounts:

1. Register with display name, email, and password
2. Log in with email and password
3. Backend returns a Firebase ID token
4. Frontend sends `Authorization: Bearer <token>` to protected routes
5. Backend verifies the token with Firebase Admin SDK

## Main API Routes

Health:

```http
GET /api/health
```

Register:

```http
POST /api/auth/register
Content-Type: application/json

{
  "displayName": "Owner One",
  "email": "owner@example.com",
  "password": "strong-pass-123"
}
```

Login:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "owner@example.com",
  "password": "strong-pass-123"
}
```

Generate:

```http
POST /api/generate
Authorization: Bearer <token>
Content-Type: application/json
```

Projects:

```http
GET /api/projects
Authorization: Bearer <token>
```

```http
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json
```

```http
PUT /api/projects/:id
Authorization: Bearer <token>
Content-Type: application/json
```

```http
DELETE /api/projects/:id
Authorization: Bearer <token>
```

Live sync:

```http
GET /api/live/:projectId
Authorization: Bearer <token>
```

```http
POST /api/live/:projectId
Authorization: Bearer <token>
Content-Type: application/json
```

Export:

```http
POST /api/projects/:id/pptx
Authorization: Bearer <token>
```

## C++ Export Service

Files:

- [cpp/deck_guard.cpp](/home/us3r/Desktop/BibleLessonAI-Creator/cpp/deck_guard.cpp)
- [src/server/services/cpp-deck-service.js](/home/us3r/Desktop/BibleLessonAI-Creator/src/server/services/cpp-deck-service.js)
- [Makefile](/home/us3r/Desktop/BibleLessonAI-Creator/Makefile)

Purpose:

- sanitize export-bound text
- normalize slide labels and numbering
- create deterministic export fingerprints
- keep export-sensitive processing in a compiled backend component

Rebuild the binary after C++ changes:

```bash
make cpp
```

## Validation

Server-side request validation is implemented with Zod in:

- [src/server/lib/request-schemas.js](/home/us3r/Desktop/BibleLessonAI-Creator/src/server/lib/request-schemas.js)
- [src/server/lib/schema-utils.js](/home/us3r/Desktop/BibleLessonAI-Creator/src/server/lib/schema-utils.js)

## Automated Tests

Route tests live in:

- [tests/app.test.js](/home/us3r/Desktop/BibleLessonAI-Creator/tests/app.test.js)

They cover:

- registration
- login
- protected-route enforcement
- project create/list flow
- generation flow
- export flow

Run:

```bash
npm test
```

Note:

- in restricted sandboxes, `supertest` may need permission to bind a temporary local port

## Final Scope Delivered

- Firebase Admin SDK for server-side Firestore access
- real user accounts instead of shared-password auth
- env-driven Firebase and collection config
- server-side request validation with Zod
- automated tests for API routes and generation/export flows
