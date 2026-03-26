# Lesson Slides Studio

Lesson Slides Studio is a local full-stack app for turning Bible lesson content into presentation slides, saving projects to Firebase, syncing live slide position, and exporting `.pptx` files.

## Stack

- Frontend: HTML, CSS, browser JavaScript modules
- Backend: Node.js + Express
- Storage: Firebase Firestore
- Generation: OpenAI API or local parser fallback
- Export: `pptxgenjs`

## Important Note About C++

This codebase does **not** currently use the C++ language. It is a JavaScript/Node.js application.

If you want a real C++ component later, that would be a separate implementation task, for example:

- a C++ slide-processing library
- a C++ OCR/image-processing module
- a C++ backend service exposed to Node over HTTP or a native binding

## Prerequisites

Install these first:

- Node.js 20+ recommended
- npm
- A Firebase project with Firestore enabled
- An OpenAI API key if you want model-based generation
- Python 3 if you want to use `python3 -m http.server` for the frontend

## Project Structure

- [index.html](/home/us3r/Desktop/BibleLessonAI-Creator/index.html): frontend entry page
- [app.js](/home/us3r/Desktop/BibleLessonAI-Creator/app.js): frontend module entry
- [server.js](/home/us3r/Desktop/BibleLessonAI-Creator/server.js): backend entry
- [src/frontend/main.js](/home/us3r/Desktop/BibleLessonAI-Creator/src/frontend/main.js): main frontend flow
- [src/server/app.js](/home/us3r/Desktop/BibleLessonAI-Creator/src/server/app.js): Express app
- [firebaseConfig.js](/home/us3r/Desktop/BibleLessonAI-Creator/firebaseConfig.js): Firebase client config and app settings
- [src/server/services/openai-slide-service.js](/home/us3r/Desktop/BibleLessonAI-Creator/src/server/services/openai-slide-service.js): generation service
- [src/server/services/pptx-service.js](/home/us3r/Desktop/BibleLessonAI-Creator/src/server/services/pptx-service.js): PowerPoint export service

## Step 1: Install Dependencies

From the project root:

```bash
npm install
```

Build the custom C++ deck-processing service:

```bash
make cpp
```

This installs:

- `express`
- `cors`
- `dotenv`
- `firebase`
- `openai`
- `pptxgenjs`

It also expects these local build tools for the C++ service:

- `g++`
- `make`

## Step 2: Configure Environment Variables

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Then update the values.

Example:

```env
PORT=8787
API_BASE_URL=http://localhost:8787
ALLOWED_ORIGIN=http://localhost:4173
CSP_CONNECT_SRC=http://localhost:8787
ADMIN_PASSWORD=your-local-admin-password
SESSION_SECRET=replace-with-a-long-random-secret
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
```

What each variable does:

- `PORT`: backend port
- `API_BASE_URL`: public backend base URL used for generated PPT links
- `ALLOWED_ORIGIN`: frontend origin allowed by CORS
- `CSP_CONNECT_SRC`: backend/API origin allowed by CSP
- `ADMIN_PASSWORD`: password used by the local login form
- `SESSION_SECRET`: secret used to sign bearer tokens
- `OPENAI_API_KEY`: required for OpenAI-powered generation
- `OPENAI_MODEL`: model used for generation

## Step 3: Configure Firebase

This app currently reads Firebase config from [firebaseConfig.js](/home/us3r/Desktop/BibleLessonAI-Creator/firebaseConfig.js).

Update the `firebaseConfig` object if you want to point to your own Firebase project:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
};
```

### Firebase services you need enabled

Enable these in Firebase:

- Firestore Database

The app currently stores project and live presentation data in:

- `BibleLessonSlides`

### Firestore rules

At minimum, your Firestore rules must allow the backend to read and write the collection being used. Since this project currently uses Firebase client SDK configuration and Firestore access patterns without Admin SDK credentials, make sure your Firestore rules are compatible with your environment.

If you want production-grade backend-only control, the next step would be moving to the Firebase Admin SDK on the server.

## Step 4: OpenAI API Setup

If you want real model generation, set:

```env
OPENAI_API_KEY=your_key_here
```

If `OPENAI_API_KEY` is empty, the app still runs, but generation falls back to the built-in parser instead of calling OpenAI.

The backend route using OpenAI is implemented in:

- [src/server/services/openai-slide-service.js](/home/us3r/Desktop/BibleLessonAI-Creator/src/server/services/openai-slide-service.js)

## Step 5: Start the Backend

Run the backend in one terminal:

```bash
npm run dev
```

That starts the Express server from:

- [server.js](/home/us3r/Desktop/BibleLessonAI-Creator/server.js)

Expected backend URL:

```text
http://localhost:8787
```

Useful backend health check:

```text
GET http://localhost:8787/api/health
```

Important:

- PPT export now depends on the compiled C++ binary at `build/deck_guard`
- if you update [cpp/deck_guard.cpp](/home/us3r/Desktop/BibleLessonAI-Creator/cpp/deck_guard.cpp), rebuild with `make cpp`

## Step 6: Start the Frontend Locally

Because the frontend is plain HTML/JS, serve it with a local static server in a second terminal.

Example using Python:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

Important:

- `ALLOWED_ORIGIN` in `.env` should match the frontend origin, for example `http://localhost:4173`
- `appSettings.backendApiBaseUrl` in [firebaseConfig.js](/home/us3r/Desktop/BibleLessonAI-Creator/firebaseConfig.js) should stay aligned with your backend URL

## Step 7: Log In Locally

When the frontend opens:

1. Enter a Creator ID
2. Enter the `ADMIN_PASSWORD` you set in `.env`
3. Click `Log In`

This creates a signed session token and allows:

- generation
- save/update/delete
- live sync
- PPT export

## Required APIs and Services

To run the app fully, you need:

1. Firebase Firestore
2. OpenAI API

Optional:

1. A local static file server for frontend hosting
2. The custom compiled C++ microservice binary for export planning

## Local Run Checklist

1. Install Node.js and npm
2. Confirm `g++` and `make` are installed
3. Run `npm install`
4. Run `make cpp`
5. Copy `.env.example` to `.env`
6. Set `ADMIN_PASSWORD` and `SESSION_SECRET`
7. Set `OPENAI_API_KEY` if you want model generation
8. Confirm Firebase config in [firebaseConfig.js](/home/us3r/Desktop/BibleLessonAI-Creator/firebaseConfig.js)
9. Run `npm run dev`
10. Run `python3 -m http.server 4173`
11. Open `http://localhost:4173`
12. Log in and test generation

## Main API Routes

### Health

```http
GET /api/health
```

### Create session

```http
POST /api/auth/session
Content-Type: application/json

{
  "creatorId": "user123",
  "password": "your-admin-password"
}
```

### Generate slides

```http
POST /api/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "lessonText": "Lesson text here",
  "tweakPrompt": "Optional editorial instruction",
  "themeId": 1,
  "meta": {
    "mainTopic": "Optional",
    "subtopic": "Optional",
    "scriptureReading": "Optional",
    "memoryVerse": "Optional",
    "lessonDate": "Optional"
  }
}
```

### List creator projects

```http
GET /api/projects?creatorId=user123
Authorization: Bearer <token>
```

### Get one project

```http
GET /api/projects/:id
Authorization: Bearer <token>
```

### Create project

```http
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json
```

### Update project

```http
PUT /api/projects/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Delete project

```http
DELETE /api/projects/:id
Authorization: Bearer <token>
```

### Sync live slide position

```http
POST /api/live/:projectId
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentSlideIndex": 3
}
```

### Export PPTX

```http
POST /api/projects/:id/pptx
Authorization: Bearer <token>
```

## Generated Files

Generated PowerPoint files are written to:

- `generated/`

They are exposed by the backend at:

- `/generated/<filename>.pptx`

The filename now includes a fingerprint generated by the C++ export service.

## C++ Microservice

This project now includes a custom C++ service used specifically for export planning.

Files:

- [cpp/deck_guard.cpp](/home/us3r/Desktop/BibleLessonAI-Creator/cpp/deck_guard.cpp): C++ processor source
- [src/server/services/cpp-deck-service.js](/home/us3r/Desktop/BibleLessonAI-Creator/src/server/services/cpp-deck-service.js): Node bridge
- [Makefile](/home/us3r/Desktop/BibleLessonAI-Creator/Makefile): build entry

What it does:

- sanitizes export-bound slide text
- renumbers question slides deterministically
- prepares export labels and bodies
- generates a deterministic deck fingerprint

Why this part was moved to C++:

- it is backend-only
- it handles export-sensitive processing
- it keeps structural export logic out of the browser
- it adds a distinct compiled component without forcing the entire app away from JavaScript

## Troubleshooting

### Frontend says service offline

Check:

- backend is running
- `backendApiBaseUrl` in [firebaseConfig.js](/home/us3r/Desktop/BibleLessonAI-Creator/firebaseConfig.js) matches the backend
- browser origin matches `ALLOWED_ORIGIN`

### Login fails

Check:

- `ADMIN_PASSWORD` in `.env`
- backend restarted after editing `.env`

### Generation works but does not use the model

Check:

- `OPENAI_API_KEY` is set
- the key is valid
- outbound network access is available in your environment

If no key is set, the app uses parser mode.

### Save/load problems

Check:

- Firestore is enabled
- Firebase config is correct
- Firestore rules allow the collection access pattern you are using

### PPT export fails

Check:

- backend is running
- `generated/` can be written by the process
- the project exists before export

## Current Security Model

Current protections include:

- bearer-token session auth
- rate limiting for login and generation
- CSP headers
- CORS restriction
- `no-store` API responses
- standard browser hardening headers
