# DocuFlow: End-to-End Workflow & Architecture Guide

---

## 1. System Architecture Overview

DocuFlow connects unstructured Microsoft Word `.docx` documents to structured Strapi collections through a multi-stage, human-in-the-loop pipeline.

### High-Level System Architecture Diagram

```mermaid
flowchart TB
    subgraph ClientLayer["Frontend Client (SvelteKit 2 / Svelte 5)"]
        UploadUI["Upload & Collection Selector"]
        SplitEditor["Side-by-Side Review Interface"]
        SourceView["SourceViewer (Block Highlighting)"]
        FormView["SchemaForm (Dynamic Form Controls)"]
        PreviewUI["PayloadPreview & Dry Run"]
    end

    subgraph Ingestion["Ingestion & Document Processing"]
        DocxGuard["DocxGuard (ZIP Bomb & Malware Security)"]
        MammothEngine["Mammoth (HTML Conversion & Image Stream)"]
        CheerioEngine["Cheerio (DOM & Table Parser)"]
        HeuristicsEngine["Heuristics (Section Paths & Heading Promotion)"]
    end

    subgraph AISubsystem["AI Extraction Subsystem"]
        PromptBuilder["Prompt Builder (Golden Rules & Injection Shield)"]
        GeminiAPI["Google GenAI SDK (gemini-2.5-flash)"]
        ZodValidator["Zod Schema Validator & Auto-Retry Loop"]
        HeuristicFallback["Heuristic Extraction Fallback"]
    end

    subgraph StateAndStorage["State & Persistence"]
        JobStore[".data/jobs/ Storage"]
        StateMachine["Job State Machine Engine"]
    end

    subgraph CMSIntegration["Strapi CMS Integration Layer"]
        SchemaDiscovery["Schema Discovery Cascade"]
        PayloadBuilder["Strapi Payload Serializer"]
        BlocksTransformer["HTML-to-Strapi Blocks AST"]
        MediaUploader["JobMediaManager (SHA-256 Deduplication)"]
        AdapterV4["Strapi v4 Adapter"]
        AdapterV5["Strapi v5 Adapter"]
        TargetStrapi[("Strapi Headless CMS")]
    end

    UploadUI -->|POST /api/jobs| DocxGuard
    DocxGuard --> MammothEngine --> CheerioEngine --> HeuristicsEngine
    HeuristicsEngine -->|DocumentModel AST| JobStore
    JobStore <--> StateMachine

    SplitEditor -->|POST /api/jobs/:id/extract| PromptBuilder
    PromptBuilder --> GeminiAPI
    GeminiAPI -->|Structured JSON| ZodValidator
    GeminiAPI -.->|Offline / Rate-limited| HeuristicFallback
    ZodValidator -->|Validated Extraction| JobStore

    SplitEditor <--> SourceView
    SplitEditor <--> FormView
    FormView --> PreviewUI

    PreviewUI -->|POST /api/jobs/:id/import| PayloadBuilder
    PayloadBuilder --> BlocksTransformer
    PayloadBuilder --> MediaUploader
    MediaUploader --> TargetStrapi
    PayloadBuilder --> AdapterV5 & AdapterV4
    AdapterV5 & AdapterV4 -->|Draft REST Creation| TargetStrapi
    SchemaDiscovery <--> TargetStrapi
```

---

## 2. Document Processing & Ingestion Workflow

Before any AI processing occurs, the uploaded file undergoes strict security verification, parsing, and normalization.

### Document Processing Workflow Diagram

```mermaid
flowchart TD
    A["Uploaded .docx File"] --> B{"DocxGuard Security Screening"}
    
    B -->|Check 1| B1["Validate ZIP Magic Bytes (PK0304)"]
    B -->|Check 2| B2["Reject Legacy OLE2 CFBF (.doc)"]
    B -->|Check 3| B3["Enforce Size Ceilings (10MB upload / 50MB unzip)"]
    B -->|Check 4| B4["Reject VBA Macros (vbaProject.bin)"]
    B -->|Check 5| B5["Sanitize Filename & Compute SHA-256"]
    
    B1 & B2 & B3 & B4 & B5 --> C{"Passes All Checks?"}
    C -- No --> Err["Return HTTP 400 Validation Error"]
    C -- Yes --> D["Create Job in .data/jobs/<id> (State: uploaded)"]

    D --> E["Mammoth Ingestion"]
    E -->|Image Callback| E1["Extract Image Buffers (img-1, img-2, ...)"]
    E -->|Style Map| E2["Map Headings, Paragraphs, Quotes to HTML"]
    
    E --> F["JSZip Inspection"]
    F --> F1["Scan word/document.xml for Textboxes & Tracked Changes"]
    
    E & F --> G["Cheerio DOM Analysis"]
    G --> G1["Convert Tables to HTML table-thead-tbody"]
    G --> G2["Extract Nested Lists (ol, ul, li)"]
    G --> G3["Assign Sequential Block IDs (b1, b2, b3, ...)"]

    G --> H["Apply Heuristics"]
    H --> H1["Promote Standalone Bold / ALL-CAPS to Headings"]
    H --> H2["Build Hierarchical Section Paths"]
    H --> H3["Associate Nearest Headings with Images"]

    H --> I["Serialize DocumentModel AST & Tagged Markdown"]
    I --> J["Save to Disk & Transition State: parsed"]
```

---

## 3. AI-Based Extraction & Mapping Workflow

The extraction engine transforms the parsed document AST into structured content matching the target Strapi schema.

### AI Extraction & Mapping Flow Diagram

```mermaid
flowchart TD
    Start["Trigger Extraction: POST /api/jobs/:id/extract"] --> S1["Load DocumentModel & Target Strapi Schema"]
    
    S1 --> S2["Compile Strapi Schema to JSON Schema via contentTypeToJsonSchema()"]
    S1 --> S3["Compute Current Schema Fingerprint (SHA-256)"]
    
    S2 & S3 --> S4["Build Extraction Prompt"]
    S4 --> P1["Inject Target Schema Fields & Attribute Types"]
    S4 --> P2["Inject Markdown with [bID] Block Tags"]
    S4 --> P3["Apply Golden Rules & Prompt Injection Guard"]
    
    S4 --> S5{"Check AI_PROVIDER Setting"}
    S5 -- "gemini" --> S6["Call @google/genai SDK (gemini-2.5-flash)"]
    S5 -- "mock" --> S7["Execute Local Heuristic Mapper (Offline)"]

    S6 --> S8["Parse Structured JSON Output"]
    S8 --> S9{"Validate against Zod Schema"}
    
    S9 -- Valid --> S10["Whitelist Fields against Schema Attributes"]
    S9 -- Invalid --> S11{"Attempts <= AI_MAX_RETRIES?"}
    
    S11 -- Yes --> S12["Append Validation Errors to Prompt under [RETRY NOTICE]"]
    S12 --> S6
    S11 -- Retries Exhausted --> S7

    S7 --> S10
    S10 --> S13["Extract fieldNotes (Block IDs & Confidence 0.0-1.0)"]
    S10 --> S14["Extract unmapped Array & Structural Warnings"]
    
    S13 & S14 --> S15["Save Extraction Result to Disk (.data/jobs/<id>/extraction.json)"]
    S15 --> S16["Transition Job State: extracted"]
```

---

## 4. Strapi Schema Synchronization & Drift Workflow

Strapi collections evolve over time. DocuFlow implements dynamic schema discovery and drift detection to prevent data corruption.

### Schema Synchronization Flow Diagram

```mermaid
flowchart TD
    subgraph Discovery["1. Discovery Cascade (resolveAvailableSchemas)"]
        Step1{"1. Live Endpoint Available?<br>/api/content-type-builder"}
        Step1 -- Yes --> UseLive["Load Schemas from Live Strapi API"]
        Step1 -- No --> Step2{"2. Local Project Path Set?<br>STRAPI_PROJECT_PATH"}
        Step2 -- Yes --> UseLocal["Load schema.json from src/api/*/"]
        Step2 -- No --> Step3{"3. Admin Credentials Set?<br>STRAPI_ADMIN_EMAIL"}
        Step3 -- Yes --> UseAdmin["Authenticate & Load via Admin API"]
        Step3 -- No --> Step4{"4. Uploaded Schemas Exist?<br>.data/uploaded-schemas"}
        Step4 -- Yes --> UseUploaded["Load User-Uploaded Schemas"]
        Step4 -- No --> UseBundled["Load Bundled Fallback Fixtures"]
    end

    subgraph ExtractionPhase["2. Extraction Phase"]
        SelectCollection["User Selects Collection (e.g. api::blog.blog)"]
        GenFP1["Generate Initial Fingerprint = SHA256(schema.attributes)"]
        StoreFP1["Store fingerprint in extraction.json"]
    end

    subgraph ImportPhase["3. Import Phase & Drift Detection"]
        StartImport["User Submits Import Request"]
        FetchLive["Fetch Latest Live Schema (forceRefresh: true)"]
        GenFP2["Generate Current Fingerprint = SHA256(liveSchema.attributes)"]
        CompareFP{"Stored FP === Current FP?"}
        
        CompareFP -- No --> SchemaModified["Return HTTP 409 Conflict: SCHEMA_MODIFIED<br>Halt Import & Alert User to Revalidate"]
        CompareFP -- Yes --> Whitelist["Execute Schema Whitelisting<br>(Strip attributes no longer in schema)"]
        Whitelist --> Proceed["Proceed to Import"]
    end

    UseLive & UseLocal & UseAdmin & UseUploaded & UseBundled --> SelectCollection
    SelectCollection --> GenFP1 --> StoreFP1
    StoreFP1 -.-> StartImport
    StartImport --> FetchLive --> GenFP2 --> CompareFP
```

---

## 5. Final Data Import Sequence

The final stage executes the import into Strapi with media deduplication, duplicate checking, and draft enforcement.

### Final Data Import Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Content Editor
    participant UI as SvelteKit UI
    participant Route as /api/jobs/[id]/import
    participant Store as JobStore (.data)
    participant Media as JobMediaManager
    participant Adapter as Strapi Adapter (v5 / v4)
    participant Strapi as Strapi CMS Instance

    User->>UI: Reviews Form, Checks "I approve this content"
    User->>UI: Clicks "Import to Strapi"
    UI->>Route: POST /api/jobs/[id]/import { approved: true, onDuplicate: "create_new" }

    Route->>Store: getJob(id), getReview(id), getExtraction(id)
    Store-->>Route: Job Metadata, Reviewed Data & Schema Fingerprint

    Route->>Route: Verify approved === true (Server-Side Enforced)
    Route->>Route: Verify Schema Fingerprint (Drift Detection)
    Route->>Route: Enforce Required Fields (Missing Required Guard)
    Route->>Route: Run Zod Schema Validation

    Route->>Adapter: Check Existing Entry (findByField by Slug and Title)
    Adapter->>Strapi: GET /api/[collection]?filters[slug][$eq]=...
    Strapi-->>Adapter: Matching Records (if any)

    alt Duplicate Detected & onDuplicate === "cancel"
        Route-->>UI: Return HTTP 200 { duplicate: true, existingEntry: ... }
        UI-->>User: Prompt: Update existing draft, create new with suffixed slug, or cancel?
    else Duplicate Detected & onDuplicate === "create_new"
        Route->>Route: ensureUniqueSlug() -> Appends suffix (e.g. "my-title-1")
    end

    Note over Route,Media: Media Upload & Deduplication Phase
    loop For each image in payload (e.g. coverImage: { $docImage: "img-1" })
        Route->>Media: uploadOrGet(buffer, filename, mime)
        Media->>Media: Compute Buffer SHA-256 Hash
        alt Image hash already uploaded in this job
            Media-->>Route: Return cached media ID
        else Image not yet uploaded
            Media->>Strapi: POST /api/upload (FormData: files, fileInfo)
            Strapi-->>Media: { id: 14, documentId: "med-14", url: "/uploads/..." }
            Media-->>Route: Return new media ID (14)
        end
        Route->>Route: Replace { $docImage: "img-1" } with ID (14)
    end

    Note over Route,Adapter: Payload Serialization Phase
    Route->>Route: buildStrapiPayload(data, schema, adapter)
    Route->>Route: Convert HTML to Strapi Blocks AST or Markdown

    Route->>Store: updateJobState(id, "importing")

    alt Strapi v5
        Route->>Adapter: create(endpoint, payload, { draft: true })
        Adapter->>Strapi: POST /api/[collection]?status=draft
    else Strapi v4
        Route->>Adapter: create(endpoint, payload, { draft: true })
        Adapter->>Strapi: POST /api/[collection] { data: { ...payload, publishedAt: null } }
    end

    Strapi-->>Adapter: { data: { id: 42, documentId: "doc-42", ...attributes } }
    Adapter-->>Route: Normalized Entry Object

    Route->>Adapter: adminLink(entry, singularName)
    Adapter-->>Route: http://localhost:1337/admin/content-manager/...

    Route->>Store: saveResult(id, result)
    Route->>Store: updateJobState(id, "imported", { strapiEntryId, strapiAdminUrl })

    Route-->>UI: HTTP 200 { success: true, entryId: 42, adminUrl: "..." }
    UI-->>User: Render ImportResult with direct Strapi Admin link
```

---

## 6. End-to-End Practical Example: Test Lab Booking Document

The following real-world walkthrough demonstrates how a complex Word document containing headings, paragraphs, and a multi-column table is ingested, transformed, and imported into Strapi.

### 6.1 Source Word Document Structure
The source document (`Booking_Third_Party_Test_Lab.docx`) contains:
* **Title:** Booking a Third-Party Test Lab
* **Intro:** Overview of battery testing compliance.
* **Section 1:** Choosing the lab (scope, accreditation).
* **Section 2:** The first request, followed by an 8-row table:
  - Columns: `Field` | `Example` | `Why the lab needs it`
  - Rows: Who approves, Device under test, Samples available, Shipping state, Witnessing, Deliverables, Dates, End of life.

### 6.2 Target Strapi Schema (`api::blog.blog`)
* `title`: string
* `description`: string
* `content`: blocks (Strapi Blocks AST)
* `seo`: component (`component.seo` - single)
* `contentNew`: component (`component.content-new` - repeatable):
  - `title`: string
  - `content`: text

### 6.3 Stage 1: Document Parsing Output
The table in Section 2 is parsed into valid HTML table markup:
```html
<table>
  <thead>
    <tr>
      <th>Field</th>
      <th>Example</th>
      <th>Why the lab needs it</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Who approves</td>
      <td>Validation lead approves</td>
      <td>Ensures budget and authority</td>
    </tr>
    <tr>
      <td>Device under test</td>
      <td>NMC module, about 5.5 kWh, 32 kg</td>
      <td>Defines safety equipment requirements</td>
    </tr>
  </tbody>
</table>
```

### 6.4 Stage 2: AI Semantic Extraction Output
Gemini maps the two sections into two entries in the repeatable `contentNew` component:
```json
{
  "title": "Booking a Third-Party Test Lab",
  "description": "Essential checklist for booking automotive battery test labs.",
  "contentNew": [
    {
      "title": "Choosing the lab",
      "content": "<p>Start with the accreditation scope and test chamber availability.</p>"
    },
    {
      "title": "The first request",
      "content": "<table><thead><tr><th>Field</th><th>Example</th><th>Why the lab needs it</th></tr></thead><tbody><tr><td>Who approves</td><td>Validation lead approves</td><td>Ensures budget and authority</td></tr><tr><td>Device under test</td><td>NMC module, about 5.5 kWh, 32 kg</td><td>Defines safety equipment requirements</td></tr></tbody></table>"
    }
  ]
}
```

### 6.5 Stage 3: Interactive Review & Dry Run
1. In the UI, the editor sees:
   - `contentNew[0]`: Title "Choosing the lab", content with introductory paragraph.
   - `contentNew[1]`: Title "The first request", content displaying the rendered HTML table.
2. The editor validates all 8 table rows and verifies column headers.
3. The editor checks the approval box and triggers a Dry Run to verify that Strapi will accept the payload.

### 6.6 Stage 4: Strapi Ingestion
1. Strapi receives the payload at `POST /api/blogs?status=draft`.
2. Strapi stores the entry in the `blogs` collection and the two component entries in `components_component_content_news`.
3. The table markup inside `contentNew[1].content` is preserved completely.
4. The user clicks the link to open the entry in the Strapi Admin Panel and verifies the content.

