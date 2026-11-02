# DocuFlow — DOCX &rarr; Strapi CMS Automation Tool

**DocuFlow** is an enterprise-grade internal web application built with SvelteKit (Svelte 5 runes) and Tailwind CSS that eliminates manual copying of content from Word documents (`.docx`) into Strapi CMS. It parses unstructured Word documents, uses AI (Gemini or deterministic offline fallback) to extract and map content onto the normalized schema of any Strapi content type (including components, repeatable components, dynamic zones, media, and relations), presents a field-by-field review screen with source document block highlighting, and creates **draft** entries in Strapi via the REST API upon explicit human approval.

---

## 1. Key Capabilities

- **Zero Hardcoded Schemas:** Strapi schemas are the single source of truth. The AI prompt, the JSON Schema given to Gemini, the Zod validators, the review form, and the Strapi payload are **all generated dynamically from one normalized schema model**. Adding or altering content types in Strapi requires **zero code changes**.
- **Strapi 4 & 5 Compatible:** Auto-detects the Strapi major version or allows manual configuration. All version differences (flat attributes vs. `{id, attributes}`, `documentId` vs. numeric ID, `status=draft` vs. `publishedAt: null`, relation connect syntax) are isolated inside unified version adapters.
- **Human Approval Enforced Server-Side:** Nothing is ever written to Strapi without human approval. The server strictly validates that the draft is reviewed, approved, and schema-compliant.
- **Drafts by Default:** Never publishes entries automatically. Draft and Publish is respected; entries are created in Draft state.
- **Prompt Injection Defense:** Document content is strictly isolated as untrusted data between demarcation tags and never interpreted as instructions.
- **Robust DOCX Security Guard:** Rejects zip-bombs (max uncompressed size & entry count guards), macro-enabled documents (`.docm` / `vbaProject.bin`), legacy OLE2 `.doc` files, and corrupt archives before extraction begins.
- **Fully Testable Offline:** Includes a built-in Mock Strapi REST server supporting both Strapi 4 and Strapi 5 modes, and a deterministic mock AI engine, allowing complete end-to-end testing without external network access or paid API keys.

---

## 2. Architecture Diagram

```
                 ┌────────────────────────────────┐
                 │       Word Document (.docx)    │
                 └───────────────┬────────────────┘
                                 │
                                 ▼
                     [ Security: docx-guard ]
            (ZIP bomb guard, macro rejection, SHA-256)
                                 │
                                 ▼
               [ Extraction Engine: Mammoth + Cheerio ]
        (Extracts images to disk, promotes fake headings,
         detects Q&A / tables, generates stable [bID] tags)
                                 │
                                 ▼
                   Normalized DocumentModel
                                 │
           ┌─────────────────────┴─────────────────────┐
           │                                           │
           ▼                                           ▼
[ Strapi Schema Engine ]                      [ AI Extraction Engine ]
• Local project files                         • Gemini 2.5 Flash
• Live Admin API discovery                    • Offline Heuristic Fallback
• Manual paste/upload                         • Validation & Retry Loop
• Recursive components (depth 6)              • Source block ID attribution
           │                                           │
           └─────────────────────┬─────────────────────┘
                                 │
                                 ▼
                     [ Zod Content Validator ]
                                 │
                                 ▼
                [ Interactive Split Review Screen ]
     (Left: Source Viewer with [bID] highlights & inline images
      Right: Recursive Schema Form with confidence badges & issues)
                                 │
                     [ Human Approval Gate ]
                                 │
                                 ▼
                   [ Strapi Payload Builder ]
       (HTML to Strapi Blocks JSON / Markdown, image upload,
        relation connector, slug uniqueness & collision check)
                                 │
                                 ▼
                [ Strapi Version Adapters (v4 / v5) ]
                                 │
                                 ▼
                      Strapi CMS (Draft Entry)
```

---

## 3. Quick Start

### Prerequisites

- Node.js 18+ (tested on Node.js 24)
- npm 9+

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and customize environment variables
cp .env.example .env

# 3. Generate sample DOCX fixture files (all 5 document layouts)
npm run fixtures

# 4. Start development server
npm run dev
```

Visit `http://localhost:5173` and log in with your configured `APP_PASSWORD` (default in `.env.example`: `docuflow-secret-password-123`).

---

## 4. Environment Configuration (`.env`)

| Variable                | Default                        | Description                                                                     |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `STRAPI_URL`            | `http://localhost:1337`        | Strapi instance REST URL                                                        |
| `STRAPI_API_TOKEN`      | -                              | Server-side API token (needs `find`, `create`, `update` permissions + `upload`) |
| `STRAPI_VERSION`        | `auto`                         | `auto`, `4`, or `5` (auto probes Strapi and detects automatically)              |
| `STRAPI_ADMIN_EMAIL`    | -                              | _(Optional)_ Enables live admin schema discovery via `/admin/login`             |
| `STRAPI_ADMIN_PASSWORD` | -                              | _(Optional)_ Admin password for live schema discovery                           |
| `STRAPI_PROJECT_PATH`   | -                              | _(Optional)_ Absolute path to local Strapi project (e.g. `../my-strapi-app`)    |
| `STRAPI_ADMIN_URL`      | `STRAPI_URL/admin`             | _(Optional)_ Custom base URL for direct "Open in CMS" links                     |
| `AI_PROVIDER`           | `mock`                         | `mock` for deterministic offline testing; `gemini` for live Gemini API          |
| `GEMINI_API_KEY`        | -                              | Required when `AI_PROVIDER=gemini`                                              |
| `GEMINI_MODEL`          | `gemini-2.5-flash`             | Gemini model name                                                               |
| `AI_MAX_RETRIES`        | `2`                            | Max validation retry attempts fed back to the LLM                               |
| `APP_PASSWORD`          | `docuflow-secret-password-123` | Master password to access the DocuFlow UI                                       |
| `SESSION_SECRET`        | 32+ characters                 | Random secret used for HMAC-SHA256 session cookie signing                       |
| `MAX_UPLOAD_MB`         | `10`                           | Maximum uploaded DOCX file size in megabytes                                    |
| `DATA_DIR`              | `.data`                        | Directory for file-based job storage and extracted images                       |
| `JOB_TTL_DAYS`          | `30`                           | Number of days before completed jobs are auto-pruned                            |

---

## 5. Offline Testing (Mock Strapi + Mock AI)

DocuFlow is 100% testable without a real Strapi CMS or Gemini API key:

```bash
# Generate the 5 sample DOCX layouts
npm run fixtures

# Run the full Vitest suite (34 comprehensive unit tests)
npm test

# Run the end-to-end smoke test against Mock Strapi in both v4 and v5 modes
npm run smoke
```

To run the full app locally against the mock Strapi server:

```bash
# Terminal 1: Run the mock Strapi server (port 1337)
npm run mock:strapi

# Terminal 2: Run the DocuFlow app
npm run dev
```

---

## 6. Testing Against a Real Strapi CMS

### Getting an API Token in Strapi

1. In Strapi Admin, navigate to **Settings &rarr; API Tokens &rarr; Create new API Token**.
2. Give the token a name (e.g. `DocuFlow`).
3. Set Token duration to _Unlimited_ (or desired period) and Token type to **Custom**.
4. Grant the following minimum permissions:
   - For your target content types (e.g. `Service Page`, `Article`): **`find`**, **`create`**, **`update`**.
   - Under **Upload**: **`upload`** (`POST /api/upload`) and **`find`** (`GET /api/upload/files`).
5. Copy the generated token into `.env` as `STRAPI_API_TOKEN`.

### Checking Your Strapi Version

Run the following inside your Strapi project folder:

```bash
npm list @strapi/strapi
```

- If `@strapi/strapi@4.x.x` &rarr; Strapi 4
- If `@strapi/strapi@5.x.x` &rarr; Strapi 5
  DocuFlow auto-detects this if `STRAPI_VERSION=auto`. You can also verify or override the detected version on the **Settings** page in DocuFlow.

### Discovering Schemas From a Local Strapi Project

Set `STRAPI_PROJECT_PATH` in `.env` to your local Strapi directory (e.g. `C:/Projects/my-strapi-app`). DocuFlow will automatically read:

- `src/api/*/content-types/*/schema.json`
- `src/components/**/*.json`
  And resolve all nested components and dynamic zones with zero network calls.

---

## 7. Adding a New Content Type (Zero Code Changes)

Adding a new content type requires **no changes to DocuFlow**:

1. Create the content type in Strapi (or upload its `schema.json` in DocuFlow Settings &rarr; **Manual Content Type Schema Registration**).
2. Open DocuFlow &rarr; **New Import**.
3. Select your content type from the dropdown.
4. Upload any Word document. DocuFlow dynamically derives the JSON Schema, prompts, Zod validators, and field-by-field review widgets.

---

## 8. Assumptions & Design Decisions

1. **DOCX Image Extraction:** Embedded images are assigned deterministic IDs (`img-1`, `img-2`, etc.) and injected in-flow using custom URI placeholders (`docimg://img-1`). Media uploads are deduplicated per job using SHA-256 byte hashing.
2. **Strapi Blocks Editor:** HTML formatting is converted to Strapi's native Blocks JSON structure (paragraphs, headings 1–6, ordered/unordered lists with nesting, blockquotes, code, links, and inline text formatting).
3. **Draft & Publish:**
   - In Strapi 5: created using `?status=draft` and returned with flat attributes and `documentId`.
   - In Strapi 4: created with `publishedAt: null` and returned as `{ id, attributes }`.
4. **Duplicate Detection:** Checks both `slug` and `title` against Strapi prior to write. Prompts user with options to update existing draft, auto-suffix slug (`slug-2`), or cancel.
5. **Session Security:** Constant-time password verification (`crypto.timingSafeEqual`) and signed HMAC-SHA256 HTTP-only cookies prevent timing and session tampering attacks.
6. **Subpath Imports:** Configured using standard Node.js package.json `#lib` subpath imports and `$lib` alias compatibility.

---

## 9. Known Limitations & Recommended Next Steps

1. **PDF / OCR Ingestion:** Currently restricted to `.docx`. Adding `pdf-parse` / OCR behind the existing document model interface will enable scanning legacy PDF contracts.
2. **GraphQL Preview:** Strapi GraphQL support could be added for read-only preview of published relations and deeply nested structures.
3. **Multi-Locale (i18n):** Support selecting a target Strapi locale (`locale=es`, etc.) and mapping localized DOCX variations.
4. **Batch Import / Bulk Processing:** Enabling multiple `.docx` uploads in a queue with batch approval workflows.
5. **Strapi Media Library Search:** Allow searching existing Strapi media assets in addition to document-embedded images.
