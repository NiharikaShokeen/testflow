# TestFlow

A QA findings and reporting application built with React, TypeScript, Vinext and Cloudflare D1. Test a website manually, record reproducible issues, organise separate reviews, and export selected findings to editable Word reports or PDF summaries.

## Features

- Separate review reports, finding status, severity and evidence references.
- Responsive finding saves with background synchronisation and recoverable local drafts.
- Selected exports, reference-derived Word formatting and optional bold emphasis.
- Report trash and restore.
- Separate anonymous browser workspaces for public visitors.
- Optional API demo with status-code and response-field assertions.

The app does not automatically browse websites or discover UI bugs. The API demo is restricted to approved public demo services and is not connected to an authenticated internship backend.

## Local setup

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run typecheck
npm run build
npm run db:migrate:local
npm start
```

Open the local URL printed by the server. Use `npm run dev` for development. Local state is stored under ignored `.wrangler/`; it is separate from the deployed database.

## Public deployment

The standalone project targets Cloudflare Workers and can use a workers.dev address or a configured custom domain. It has no provider-specific sign-in requirement.

1. Authenticate your hosting account with `npx wrangler login`.
2. Create a database: `npx wrangler d1 create testflow-data`.
3. Replace the placeholder database ID in `wrangler.jsonc` with the returned ID.
4. Apply the schema: `npm run db:migrate:remote`.
5. Deploy: `npm run deploy`.
6. Verify the returned URL and a new visitor's report workflow.

The repository alone is not a live deployment. It contains no hosting credentials, saved reports or remote database contents. The earlier private hosted copy is a separate deployment and is not modified by deploying this standalone edition.

## Public visitor model

The Worker creates an unpredictable browser session cookie and overwrites the trusted workspace header supplied to server routes. Each visitor's data is stored in its own D1 workspace row. API responses are not cached. Mutating requests are bounded and checked for cross-site origins.

This is anonymous guest separation, not verified account authentication. A different browser/device gets another workspace; a shared browser profile shares its cookie. Export before clearing cookies. Password login, cross-device account recovery, attachment uploads and full team access controls are not implemented.

## Important files

| File | Role |
| --- | --- |
| app/page.tsx | Screens, form state, pending-save queue and downloads |
| worker/index.ts | Guest cookie, trusted context and request boundaries |
| lib/visitor-workspace.ts | Current visitor's database key |
| app/api/findings/route.ts | Atomic single-finding save |
| app/api/workspace/route.ts | Broader workspace load/save |
| app/api/report/route.ts | Visitor- and report-scoped export |
| lib/report-sessions.ts | Report selection, exclusions and trash |
| lib/word-report.ts | Reference-template Word generation |
| lib/zuka-template.ts | Sanitised formatting assets without original prose/images |
| lib/qa-report.ts | Separate PDF summary generation |
| db and drizzle | SQLite schema and migrations |
| wrangler.jsonc | Worker and D1 configuration |

[Read the complete project and viva guide](docs/PROJECT_GUIDE.md).

## Report output and limits

Word preserves entered text and selected emphasis. It uses the reference report's typography and contains no photo placeholders; screenshots can be added in Word or Pages. PDF is a separate summary layout. Evidence references do not upload files.

The workspace table stores each visitor's reports, findings, cases and runs as a JSON payload. Focused finding saves are atomic; broader workspace replacements do not have complete revision conflict handling across tabs. The optional API runner permits HTTPS requests to jsonplaceholder.typicode.com, httpbin.org and dummyjson.com, with a 10-second timeout and capped response preview. Backup export is available; import is not implemented.

Testing dates, app entry dates and trash dates describe different events. Record historical testing from genuine source documents; the app does not create a historical usage trail.

## Technologies

React, TypeScript, Vinext/Vite, Cloudflare Workers, Cloudflare D1/SQLite, Drizzle ORM, fflate, pdf-lib and Lucide icons. Third-party packages retain their respective licences. No language-model API is used to write exported findings.
