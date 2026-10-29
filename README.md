# TestFlow

TestFlow is a single-user workspace for recording website QA findings and preparing testing reports. It was developed from a manual QA workflow: reproduce an issue in the website, record the steps and observed result, track the finding, and export the selected review.

## Features

- Separate review reports with testing dates, platform, scope and tester details.
- Findings with reproduction steps, expected and observed results, severity, status and evidence references.
- Responsive finding saves, background synchronisation, and local draft recovery after a temporary save failure.
- Selective exports: omit a finding without deleting its record.
- Editable Word reports, using a template derived from the supplied reference report; PDF summary export is also available.
- Inline bold selection and optional numbering of reproduction steps in Word.
- Report trash and restore.
- An optional API demo runner with HTTP status and response-field assertions.

## Technology

| Layer       | Implementation                                            |
| ----------- | --------------------------------------------------------- |
| Interface   | React, TypeScript, CSS and Tailwind CSS                   |
| Server      | Vinext server routes on Cloudflare Workers                |
| Persistence | Cloudflare D1 / SQLite, via Drizzle and parameterised SQL |
| Word export | Reference-based OOXML template, packaged using fflate     |
| PDF summary | pdf-lib                                                   |

The application stores its workspace in a SQLite row as structured JSON. Findings have an atomic update endpoint so editing a finding does not require uploading the full workspace. This prototype has not been normalised into separate relational tables for every entity.

## Run locally

Requires Node.js 22.13 or newer and npm.

```bash
npm ci
npm run typecheck
npm run build
npm run db:migrate:local
npm start
```

Open the Local URL printed by the server, normally `http://127.0.0.1:8787`.

`npm run db:migrate:local` applies local SQLite migrations and remembers which have been applied. The local database lives in the ignored `.wrangler/` directory. It is separate from the deployed database, and the source archive contains no saved findings or reports.

For development with hot reload, use `npm run dev` after the database setup. To change the schema, edit `db/schema.ts`, run `npm run db:generate`, rebuild and apply the new migration.

## Main workflow

1. Create a new report and enter its testing date and review details.
2. Test the website manually in your browser.
3. Log each finding with clear reproduction steps and observed/expected results.
4. Update finding status as it is investigated and retested.
5. Open Reports, choose which findings to include and download Word.
6. Insert screenshots into the exported Word file if needed.

Word export preserves entered text and selected emphasis. It does not rewrite findings, upload evidence images or reserve space for photos. The PDF summary uses a separate layout. A filename or URL in Evidence is a reference, not an uploaded attachment.

## Project structure

```text
app/page.tsx                 Main workspace interface
app/globals.css              Application styles
app/api/findings/route.ts    Atomic finding saves
app/api/workspace/route.ts   Workspace load/save
app/api/report/route.ts      Word/PDF export
app/api/run/route.ts         Optional API execution
components/finding-text.tsx  Finding editor and bold selection
lib/report-sessions.ts      Report scoping and export selection
lib/word-report.ts           Word generation
lib/zuka-template.ts         Sanitised template and style patterns
lib/qa-report.ts             PDF summary generation
db/                         SQLite schema and Drizzle setup
drizzle/                    Schema migrations
scripts/                    Local runtime and hosting helpers
```

The template module contains formatting from the reference document, with original report text and image files removed. Supporting runtime files originate from the Sites/Vinext starter. The unused starter UI examples have been removed from this source handoff.

## API routes

| Route                                   | Purpose                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| `GET /api/workspace`                    | Load the saved workspace                                     |
| `PUT /api/workspace`                    | Save report metadata, selections and other workspace changes |
| `PATCH /api/findings`                   | Create/update a finding atomically; retries use the same ID  |
| `GET /api/report?report=ID&format=docx` | Export selected findings from one active report              |
| `GET /api/report?report=ID&format=pdf`  | Export a PDF summary; `api=1` adds its API results           |
| `POST /api/run`                         | Execute an approved demo API request                         |

## Scope and limitations

- Manual website testing is the main workflow. TestFlow does not browse a website, click buttons or discover UI bugs automatically.
- The API runner permits HTTPS endpoints on `jsonplaceholder.typicode.com`, `httpbin.org` and `dummyjson.com`. It is not connected to an authenticated Zuka backend.
- API requests have a 10-second timeout, disabled redirects and a 100 KB response-preview limit. Assertions check the expected status and an optional JSON field.
- The app is a single-user prototype. Its current deployed version relies on the hosting platform's owner-only access gate; there is no separate application login or authorisation layer. Do not expose the same shared workspace publicly as a multi-user app.
- Workspace backups can be exported; backup import is not implemented.
- Local unsynchronised drafts depend on browser storage. Check for All changes saved before exporting or changing devices.
- Testing dates describe the review. Application entry and trash dates reflect actual app actions. Historical testing records must come from their original source documents.

## Hosting

The existing hosted app runs on Sites / Cloudflare Workers. This GitHub handoff removes its live Site project ID; publishing this copy does not update that existing app automatically. Local development does not require a Sites project ID. A new deployment needs its own hosting identity, D1 binding, migrations and access configuration.

## Validation

The delivered application was checked with TypeScript, a production build, local endpoint tests, report isolation and trash/restore checks, simulated slow/failing saves, responsive layout checks, and visual inspection of the Word export. These are completed checks, not a claim that this source contains a comprehensive automated test suite.
