# DocuFlow: Developer Setup & Installation Guide

This guide walks a developer through installing, configuring, running, testing, and deploying the DocuFlow Document-to-Strapi automation application.

---

## 1. System Prerequisites

Before starting, ensure your local development environment meets the following minimum requirements:

* **Node.js:** `v20.0.0` or higher (compatible with Node 20.x through Node 26.x).
  Verify with:
  ```bash
  node -v
  ```
* **npm:** `v9.0.0` or higher (bundled with Node.js).
* **Git:** Installed and configured.
* **Operating System:** macOS, Linux, or Windows (tested on Windows 10/11 with PowerShell).
* **Optional:** An active Google Gemini API key from [Google AI Studio](https://aistudio.google.com/) for live AI extraction (DocuFlow includes a local mock provider for offline development).

---

## 2. Repository Setup and Installation

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd Docuflow
```

### Step 2: Install Project Dependencies
Install the root application dependencies:
```bash
npm install
```

> [!NOTE]
> If you plan to run the included local Strapi instance in `./cms`, you will also need to install its dependencies:
> ```bash
> cd cms
> npm install
> cd ..
> ```

---

## 3. Environment Variable Configuration

DocuFlow validates all environment variables on startup using Zod (`src/lib/server/env.js`). If any required variable is missing or invalid, the server fails fast with actionable error messages.

### Step 1: Create Your `.env` File
Copy the provided `.env.example` file to create your local `.env`:
```bash
cp .env.example .env
```

### Step 2: Configure Environment Variables

| Variable Name | Required | Default Value | Description |
| :--- | :---: | :---: | :--- |
| `STRAPI_URL` | Yes | `http://localhost:1337` | Base URL of your target Strapi instance. |
| `STRAPI_API_TOKEN` | Yes* | *(Empty)* | Strapi API Token with Full Access permissions. *(Can be auto-generated for local CMS using `npm run strapi:token`)*. |
| `STRAPI_VERSION` | No | `auto` | Strapi major version: `'auto'` (auto-detects), `'4'`, or `'5'`. |
| `STRAPI_PROJECT_PATH` | No | *(Empty)* | Relative path to local Strapi directory (e.g. `./cms`) for file-based schema discovery. |
| `STRAPI_ADMIN_EMAIL` | No | *(Empty)* | Strapi Admin email for live schema discovery via the Strapi Admin API. |
| `STRAPI_ADMIN_PASSWORD` | No | *(Empty)* | Strapi Admin password. |
| `STRAPI_ADMIN_URL` | No | *(Empty)* | Custom admin URL if different from `STRAPI_URL/admin`. |
| `AI_PROVIDER` | Yes | `mock` | AI extraction provider: `'gemini'` for live Google Gemini, or `'mock'` for offline heuristic testing. |
| `GEMINI_API_KEY` | Conditional | *(Empty)* | Required when `AI_PROVIDER=gemini`. Your Google GenAI API key. |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | The Gemini model identifier to use for extraction. |
| `AI_MAX_RETRIES` | No | `2` | Number of validation retry attempts on malformed AI output (0–5). |
| `APP_PASSWORD` | **Yes** | *(Empty)* | Master password for application login. Must not be empty. |
| `SESSION_SECRET` | **Yes** | *(Empty)* | Cryptographic salt for signing HMAC session cookies. **Must be $\ge 32$ characters long**. |
| `MAX_UPLOAD_MB` | No | `10` | Maximum allowable file size for uploaded `.docx` files (in MB). |
| `DATA_DIR` | No | `.data` | Directory for persistent job files, uploaded schemas, and metadata. |
| `JOB_TTL_DAYS` | No | `30` | Retention duration for historical job files in days. |

### Example Local `.env` Configuration
```ini
# Strapi CMS
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=your_token_or_use_sync_script
STRAPI_VERSION=auto
STRAPI_PROJECT_PATH=./cms

# AI Extraction
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...your_gemini_key_here
GEMINI_MODEL=gemini-2.5-flash
AI_MAX_RETRIES=2

# Security & App Settings
APP_PASSWORD=DocuflowDevPassword2026!
SESSION_SECRET=a_very_secure_and_random_string_that_is_at_least_32_chars_long
MAX_UPLOAD_MB=10
DATA_DIR=.data
JOB_TTL_DAYS=30
```

---

## 4. Working with Strapi

DocuFlow supports three different ways to connect to Strapi during development:

### Option A: Local Strapi Instance (`./cms`)
The repository includes a complete Strapi v5.60.0 project with pre-configured collection types (`Blog`, `Article`, `Poll`) and components (`contentNew`, `AuthorData`, `seo`).

1. **Start Strapi Development Server:**
   ```bash
   npm run strapi:dev
   ```
   Strapi will build and run at `http://localhost:1337/admin`.
2. **Synchronize API Token:**
   DocuFlow includes an automated token synchronization script that checks the SQLite database (`cms/.tmp/data.db`) and injects a matching Full Access token into your root `.env`:
   ```bash
   npm run strapi:token
   ```

### Option B: Standalone Mock Strapi Server
For rapid testing or environments where you don't want to run the full Strapi process:
```bash
npm run mock:strapi
```
This boots a lightweight, zero-dependency in-memory mock Strapi server on port `1337` that implements:
- Strapi v4 and v5 collection endpoints (`/api/articles`, `/api/service-pages`, `/api/blogs`)
- Media upload endpoint (`/api/upload`)
- Content-Type Builder discovery endpoints
- Draft/publish queries and filtering

### Option C: External / Remote Strapi Server
To connect to a remote Strapi instance (e.g., in staging or production):
1. In Strapi Admin, go to **Settings** $\rightarrow$ **API Tokens** $\rightarrow$ **Create new API Token**.
2. Select **Token type: Full Access** and set **Duration: Unlimited**.
3. Copy the token and set `STRAPI_URL` and `STRAPI_API_TOKEN` in your `.env`.

---

## 5. Running the Application

### Start Development Server
```bash
npm run dev
```
The application will start with Vite hot-reloading at:
`http://localhost:5173`

### Logging In
Navigate to `http://localhost:5173/login` in your browser. Enter the password configured in `APP_PASSWORD`.

---

## 6. Testing and Code Quality

DocuFlow includes a comprehensive automated test suite and strict linting rules.

### Running Unit & Integration Tests
Run the entire Vitest test suite (40 tests across 7 test suites):
```bash
npm test
```

Run tests in watch mode during development:
```bash
npm run test:watch
```

### Running Type and Svelte Component Checks
```bash
npm run check
```

### Running Linters and Code Formatting
Check code style and ESLint rules:
```bash
npm run lint
```

Format code automatically with Prettier:
```bash
npm run format
```

### Running End-to-End Smoke Test
Run the programmatic end-to-end smoke test against the mock or live Strapi server:
```bash
npm run smoke
```

---

## 7. Build and Production Deployment

DocuFlow uses `@sveltejs/adapter-node` to compile a standalone Node.js production server.

### Step 1: Build the Production Bundle
```bash
npm run build
```
This compiles the Svelte components, server routes, and assets into the `build/` directory.

### Step 2: Preview the Production Build Locally
```bash
npm run preview
```

### Step 3: Running in Production (Node.js)
In your production environment (Docker container, Linux VPS, or Cloud Run):
```bash
node build
```
By default, the Node server listens on port `3000`. You can customize the port and host using environment variables:
```bash
PORT=8080 HOST=0.0.0.0 node build
```

---

## 8. Troubleshooting & Common Issues

### 1. `Invalid environment configuration: SESSION_SECRET must be at least 32 characters long`
* **Cause:** The `SESSION_SECRET` in `.env` is shorter than 32 characters.
* **Fix:** Generate a secure random string (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and paste it into `SESSION_SECRET`.

### 2. `Strapi authentication failed (401 Unauthorized)`
* **Cause:** The `STRAPI_API_TOKEN` in `.env` is missing, expired, or invalid.
* **Fix:** If using the local `./cms`, run `npm run strapi:token`. If using a remote Strapi, generate a new Full Access token in Strapi Admin Settings $\rightarrow$ API Tokens.

### 3. `Cannot connect to Strapi at http://localhost:1337 (ECONNREFUSED)`
* **Cause:** The Strapi CMS server is not currently running.
* **Fix:** Start the local Strapi CMS using `npm run strapi:dev`, or start the mock server using `npm run mock:strapi`.

### 4. `Gemini API quota exceeded or rate limit reached (HTTP 429)`
* **Cause:** Your Google AI Studio API key has exceeded the free tier rate limit (15 requests/minute).
* **Fix:** DocuFlow automatically falls back to heuristic extraction. To continue testing without hitting limits, set `AI_PROVIDER=mock` in `.env`.

### 5. `Security violation: Only .docx files are permitted`
* **Cause:** Uploaded file is a legacy `.doc` binary or has an invalid file extension.
* **Fix:** Open the document in Microsoft Word or Google Docs and save it as a modern `.docx` (Office Open XML format).

