# TestFlow Project Study and Viva Guide

A practical guide to the standalone TestFlow application, its code, its limits, and a clear demonstration.

## Start with the explanation you can demonstrate

TestFlow is a website QA findings and reporting application. A tester checks a website manually, records reproducible issues, tracks their status, and exports the selected review as Word or PDF. The optional API demo sends technical requests and checks configured responses. The application does not automatically browse a website or discover every bug.

A short introduction you can adapt accurately: “My QA work involved reproducing website issues and preparing testing reports. TestFlow organises that workflow. Each review has its own findings, testing date and scope. I can record steps, expected and observed results, update issue status, choose what to include, and generate an editable report.” Describe development dates and the assistance used accurately; a matching report does not establish earlier application usage.

Your main demonstration should be manual findings, report separation and Word export. Show the API runner only when you can explain the exact request and assertion being tested.

## What each screen is for

| Screen | What the visitor does | What it does not prove |
| --- | --- | --- |
| Overview | Sees finding counts and closure progress for the selected review | A closed finding is not independently verified by the app |
| Website findings | Records, edits and updates reproducible issues | The app did not discover the issue itself |
| Reports | Edits report details, chooses findings, downloads Word/PDF, manages trash | An old testing date is not an old app-entry date |
| API test cases | Stores endpoint, method and expected response checks | These are technical API checks, not recorded browser interactions |
| API runner | Sends a permitted request and inspects the response | Passing a status-code assertion does not prove the whole website works |

A report is one review session. A finding is one recorded issue inside that review. A test case in the optional API area is a saved request configuration. An execution is the result of running that request once.

## The architecture in plain language

The browser displays React forms and tables. The Cloudflare Worker establishes a visitor workspace from a cookie and supplies trusted context to the server routes. The routes validate requests, read or update SQLite data, execute permitted API requests, or generate a report. D1 is Cloudflare's managed SQLite database.

```text
Browser and React interface
          |
          | HTTP request and browser session cookie
          v
Cloudflare Worker
          |
          | trusted workspace context
          v
Server routes
       /          \
D1 SQLite      Word and PDF generators
```

React handles the interface. TypeScript checks types while developing. Vinext supplies the Next.js-compatible application and route conventions on Vite. Vite builds the project. Cloudflare Workers runs the server code. Drizzle defines and queries the database schema. Wrangler runs local previews, applies migrations and deploys the Worker.

The hosted implementation is JavaScript/TypeScript. It does not run a Python FastAPI server. Python tools used to inspect or validate a document during development are not part of the application's server stack.

## The files to understand first

| File or folder | Purpose | Reading priority |
| --- | --- | --- |
| app/page.tsx | Screen state, forms, finding queue, report selection and download actions | First |
| worker/index.ts | Request boundary, visitor cookie, workspace header, body size and origin checks | First |
| lib/visitor-workspace.ts | Reads the trusted workspace identifier inside a server route | First |
| app/api/findings/route.ts | Validates and atomically saves one finding | First |
| app/api/workspace/route.ts | Loads/saves review metadata and the broader workspace | First |
| app/api/report/route.ts | Selects one visitor's report and returns a DOCX or PDF | First |
| lib/report-sessions.ts | Groups findings and filters export selection and trash | First |
| lib/word-report.ts | Fills the reference-derived Word template | Next |
| lib/qa-report.ts | Draws the separate PDF summary and handles pagination | Next |
| components/finding-text.tsx | Text editing and selected bold ranges | Next |
| db/schema.ts and db/index.ts | SQLite table definition and D1/Drizzle access | Next |
| app/globals.css | Layout, colours, tables, dialogs and responsive rules | Next |
| app/layout.tsx | Shared document shell and browser-tab metadata | Later |
| lib/zuka-template.ts | Encoded empty document template and paragraph/run patterns | Understand its purpose; do not memorise its encoded content |
| drizzle | SQL migration and schema metadata | Understand why migrations exist |
| vite.config.ts | Connects Vinext and Cloudflare's build plugin | Configuration |
| wrangler.jsonc | Worker name, compatibility settings and database binding | Configuration |
| package.json and package-lock.json | Commands, direct dependencies and reproducible dependency resolution | Configuration |
| tsconfig.json | TypeScript compiler settings | Configuration |
| public/favicon.svg | Browser-tab icon | Asset |

Many files are configuration, migrations or assets rather than separate features. Read by responsibility. Do not try to memorise every line of the generated lockfile or encoded template.

The old chatgpt-auth.ts file was an unused provider sign-in helper from the earlier starter. It was not an author credit. The standalone version removes it and the unused connector/build scaffolding because this edition uses its own guest workspace context and ordinary Cloudflare deployment. Framework and dependency names identify technologies, not the project's author.

## The actual database design

There is currently one application table named workspace:

| Column | SQLite type | Meaning |
| --- | --- | --- |
| id | TEXT primary key | One visitor-workspace key, namespaced with guest |
| payload | TEXT not null | JSON containing that visitor's reports, findings, API cases and executions |

This is a SQLite database with a JSON document stored in each visitor's row. It is not a fully normalised relational schema with separate tables and foreign keys for every finding and report. Say this accurately if asked.

The payload contains tests, runs, defects and reports. The code uses the word defects for the stored findings array. Each report has an id and metadata. Each finding has an id and reportId. Filtering by reportId connects a finding to its review at application level. excludedIds controls which findings are omitted from an export. deletedAt marks a report as being in trash.

Examples of report metadata are project name, document title, website URL, tester, platform, environment, testing date, scope and a source-document reference. A finding can contain its title, module, affected URL, steps, expected result, observed result, severity, status and evidence reference.

IDs come from crypto.randomUUID for records. An ID identifies a record; a date is a separate field. Testing dates describe the actual review. Entry and trash dates are set or preserved by the server according to actual application actions.

Why use this storage design? It keeps a prototype simple and makes report snapshots easy to read. What is the trade-off? Querying large datasets and editing several parts concurrently is harder than with separate tables. A later version could normalise reports, findings and executions and add indexes, foreign keys and revision checks.

## How visitors get separate workspaces

The standalone version uses anonymous browser sessions. On the first request, the Worker creates a random 256-bit token and puts it in a host-only session cookie. On later requests, the browser sends that cookie back. The Worker supplies a trusted workspace header to the route; any visitor-supplied value for that header is overwritten.

The server uses the resulting guest workspace key when reading and writing the database. A report ID alone is not sufficient to read another visitor's report because the route first loads the current visitor's workspace.

The cookie is HttpOnly, uses SameSite=Lax, and uses Secure on HTTPS. HttpOnly prevents normal browser JavaScript from reading the cookie value. Secure limits transmission to HTTPS in deployment. SameSite and origin checks reduce cross-site request risks. Mutating request bodies are bounded before processing.

This is guest separation, not a full login/account system. A different browser or device gets a different workspace. People sharing the same browser profile share its cookie. Clearing cookies can lose access to the old guest workspace. Export a backup before clearing browser data. Password login, verified identities and cross-device account recovery are not implemented.

Do not describe a guest cookie as proof of a verified user's identity, or claim that the app has role-based access control. The public version does not require a ChatGPT account.

## What happens when Save finding is clicked

1. The form requires the core text fields and creates an ID if the finding is new.
2. React updates the visible finding list immediately and closes the form.
3. A pending draft is stored locally so a temporary failure does not simply discard the entry.
4. The client queues a PATCH request to /api/findings containing one finding.
5. The Worker establishes visitor context and checks the request boundary.
6. The route validates the title, severity, status and size.
7. A parameterised SQLite statement adds or replaces that finding atomically inside the correct visitor's JSON payload.
8. The response confirms success. The UI removes the pending draft and shows that changes are saved.
9. If the request fails, the UI keeps the local draft and provides retry. Pending drafts resume after a successful workspace load on refresh.

This is optimistic UI: the screen updates before remote persistence finishes. It improves perceived responsiveness but does not make the network instantaneous. Saving is not the same as Saved. Other workspace saves and exports wait for pending findings so the visitor does not knowingly export an unsynchronised draft.

The same finding ID makes retries idempotent at record level: retrying an accepted save updates the existing record rather than intentionally creating a second copy. The atomic statement preserves other findings. It also preserves the original entry time when editing an existing finding.

Some broader operations still use PUT /api/workspace. Those operations replace the visitor's workspace document. Concurrent edits from several tabs are a remaining limitation; the whole workspace does not have comprehensive optimistic version locking.

## The endpoints and HTTP methods

| Endpoint | Method | Purpose |
| --- | --- | --- |
| /api/workspace | GET | Load the current visitor's saved workspace |
| /api/workspace | PUT | Save report metadata, selections and broader workspace changes |
| /api/findings | PATCH | Add or update one finding atomically |
| /api/report | GET | Generate a selected active report as Word or PDF |
| /api/run | POST | Execute a permitted API request and its assertions |

GET retrieves data. POST submits an action or creates an execution result. PUT represents a broader replacement. PATCH represents a focused change. These method names express intent; validation and server logic still determine what actually happens.

The export URL includes a report ID and format, such as /api/report?report=REPORT_ID&format=docx. The server checks the report inside the current workspace. It filters excluded findings and rejects unavailable or trashed reports. Word is returned as a DOCX attachment; PDF is returned as a PDF attachment. Download headers tell the browser the file type and suggested filename.

Important response statuses include 200 for successful handling, 400 for invalid input, 403 for a rejected cross-site mutation, 404 for an unavailable report, 413 for excessive size, and 500 for an unexpected server failure. The meaning of an HTTP response must be interpreted alongside the application's result.

## How report selection and trash work

Creating a new report creates a separate review with no prior findings copied into it. Choosing Current report changes the visible findings and export scope. Old reports remain saved. You do not need to delete earlier bugs to produce today's report.

Unchecking a finding in the export list omits it from that report download without deleting the record. Moving a report to trash hides it from active selection and export. Restore makes it active again. Findings stay associated with the report. If the last active review is removed, the UI creates a fresh empty review so the workspace remains usable.

This is soft deletion. It is different from permanently deleting database rows. Trash actions reflect actual actions; the application does not generate historical deletion evidence. A source-document reference identifies an earlier manual report but is not a file upload or independent verification of its date.

## How Word and PDF generation work

A DOCX file is a ZIP package containing XML, styles and relationships. Word export starts from a sanitised template derived from the supplied report. The template retains the page geometry, fonts and paragraph/run style patterns; original report prose and image files were removed from the reusable template.

The export uses a 24-point title, 14-point bold issue headings and a 12-point body with the reference's Times fonts. Metadata labels are bold. Selected body emphasis is stored separately as character ranges. Response lines beginning with success, message, error or upstream use the reference's bold error-block pattern. Reproduction steps can be numbered, with numbering restarted per issue.

The generator inserts the saved title, tester, testing date, platform, scope, issue count, steps, observed result and expected result. XML-sensitive characters are escaped so entered text is treated as text rather than document markup. The package is compressed using fflate and returned for download.

There are no image placeholders or reserved photo areas. Evidence is a reference string. Screenshots may be inserted manually into Word or Pages after export. If asked, distinguish a file genuinely exported and later edited from an older manually prepared original.

The PDF generator is a separate implementation using pdf-lib. It draws a review summary, findings register and detailed finding pages, with an optional API appendix. Its layout differs from the editable Word report. It is not a server conversion of the Word file. The PDF's built-in fonts have more limited character support than Word.

No language model writes the exported findings. The report generator uses entered records and deterministic formatting rules.

## Understand the API demo before showing it

An API is a technical interface for sending a request and receiving a response. An endpoint is its particular URL. The HTTP method describes the operation. Request bodies may contain JSON. Response bodies may contain JSON, text or another format.

Example: a saved request expects HTTP 200 and the response field id to equal 1. The runner sends the request, reads the response, compares the actual status and field, measures elapsed time and returns a result. A public demo post with userId, id, title and body is sample data; it is not a website bug report.

PASS means all configured assertions matched. FAIL means a response was received but an assertion did not match. ERROR means the request could not be completed as configured, for example because of a timeout or request failure. An HTTP 200 with success=false can still fail an assertion expecting success=true.

The current runner allows HTTPS endpoints only on jsonplaceholder.typicode.com, httpbin.org and dummyjson.com. Requests have a 10-second timeout, redirects are rejected and the response preview is capped at 100 KB. It does not support arbitrary authentication headers or authenticated Zuka workflows. These restrictions limit the server's use as an unrestricted proxy.

Can it check a particular bug? Sometimes, if the bug can be expressed as a specific expected API response and the correct request is available. Can it inspect a modal backdrop or click a login button? No. Those require manual browser testing or a separate browser automation framework that this application does not implement.

A precise viva explanation is: “The core workflow is manual findings and reporting. The optional API module demonstrates status and response assertions against approved public APIs. Authenticated integration with the target website is not implemented.”

## Local setup and deployment

The repository requires Node.js 22.13 or newer. For local use, run npm ci, npm run typecheck, npm run build, npm run db:migrate:local, and npm start. Open the printed local URL. The local database is stored under the ignored .wrangler directory and is separate from any remote database.

The root wrangler.jsonc file declares the Worker name and DB binding. Its placeholder database ID is suitable for preparing local configuration; a public deployment needs a real D1 database ID from the hosting account. Log into Cloudflare with Wrangler, create the database, replace the placeholder, apply remote migrations, and deploy the build. Do not commit API tokens or local database files.

A normal Cloudflare deployment can use a workers.dev URL or a configured custom domain. The exact address comes from the deployment result; a GitHub repository URL is not a running application URL. The earlier private hosted copy and this standalone edition are separate deployments.

A migration is a recorded schema change. Applying migrations is different from adding findings. The schema migration creates the workspace table; ordinary API requests add or update data after that table exists.

## What was checked and what remains limited

Development checks cover TypeScript, production builds, finding saves and retries, report isolation and selection, trash/restore, Word formatting, and responsive layouts. The standalone edition also needs its visitor-boundary checks: separate cookies, separate data, scoped exports, ignored forged workspace headers, rejected cross-site mutations and non-cacheable API responses.

This is a prototype. It does not implement verified accounts, password reset, attachment uploads, backup import, scheduled testing, a full audit trail, team collaboration, browser automation or large-scale normalised database design. The API host allowlist is deliberate. Some broader workspace edits can race across tabs. Cookie-based guest recovery and service quotas require care in real public use.

Future improvements should address actual needs: normalised tables and indexes, account login and recovery, revision checks, uploaded evidence, pagination for large histories, more meaningful assertions, rate limits, and integration tests. Do not present those as implemented features.

## Viva questions and model answers

### Project purpose and testing concepts

**What problem does TestFlow solve?** It organises findings that would otherwise be scattered across manually prepared reports. It gives each review a consistent structure and lets the tester track issues and export selected records.

**Does it test a website automatically?** The main workflow is manual. The optional API demo automates specific request/response checks, not full browser testing.

**What is the difference between a test case and a defect?** A test case describes a check and its expected result. A defect records an observed mismatch or issue. An execution is one attempt to perform a check.

**Can a passed test prove the whole system is correct?** No. It only supports the specific conditions and assertions tested. Untested paths and weak assertions may miss problems.

**Severity and priority are the same, right?** No. Severity describes impact. Priority describes scheduling or urgency. This version stores severity but does not implement a separate priority workflow.

**Resolved and Closed are the same, right?** Not necessarily. Resolved can mean a proposed fix is available. Closed should follow verification according to the team's process. The app stores status; it does not independently verify the fix.

**What is regression testing?** Rechecking existing behaviour after a change to detect unintended breakage. This app can record that review, but it does not automatically run a browser regression suite.

**What makes a useful finding?** A specific summary, reproducible steps, relevant environment, clear expected and observed results, impact and evidence. “It does not work” is insufficient.

### Interface and request flow

**Why React?** It helps build reusable interfaces that update when state changes, such as a new finding appearing in a table or a report selection changing.

**Why TypeScript?** It catches many type mistakes during development and makes data shapes clearer. It does not replace validation of incoming HTTP data.

**What is state?** Data that affects what the interface displays, such as the selected report, open dialog, findings, pending saves or search text.

**Why does the form close before the save finishes?** The app uses optimistic UI and keeps a pending draft. It still shows a saving state until server confirmation and offers retry on failure.

**What if the internet fails?** A pending finding remains on the current device and can retry. The whole application is not a fully offline app, and remote exports require a working server connection.

**Could retries create duplicates?** The same finding ID is reused, and the server replaces the matching finding. A deliberately new ID would be treated as a new record.

**Is the browser's local storage the database?** No. D1 is the primary saved workspace. Local storage holds pending finding drafts for recovery.

**Why is there a Worker as well as server routes?** The Worker establishes request-level visitor context and boundary checks. The routes implement application operations such as saving or exporting.

### Database and security

**Is this MySQL, MongoDB or SQLite?** SQLite through Cloudflare D1. Each visitor has a workspace row whose payload is JSON text.

**Is the schema normalised?** Not fully. Reports and findings are nested arrays inside the payload. Application-level IDs connect them. Separate tables and foreign keys would be a future improvement.

**What is a primary key?** A value that uniquely identifies a row. Here workspace.id distinguishes visitor workspace rows.

**How do other visitors avoid seeing my reports?** The Worker derives a workspace key from their browser cookie. Database reads and writes use that key, and exports first load that visitor's workspace.

**Can I send someone else's workspace header?** The Worker replaces the incoming header. This is why routes should trust only the context established at the request boundary, not a client-supplied ID.

**Does a cookie mean the visitor has logged in?** No. The app has an anonymous guest session, not verified account authentication. A shared browser profile shares its guest cookie.

**What does HttpOnly do?** It prevents ordinary JavaScript from reading the cookie directly. It is one protection, not a complete defence against every browser attack.

**Why use parameterised SQL?** Values are supplied separately from the SQL statement rather than concatenated into executable SQL. Input validation is still required.

**What does atomic mean here?** The focused finding update is one database statement. It avoids a read-modify-write gap that could overwrite a different finding saved concurrently.

**Can two tabs overwrite changes?** Focused finding updates preserve other records, but broader workspace replacements do not have complete revision conflict handling. This remains a limitation.

**Why are testing and entry dates separate?** They describe different events. The date of a real review should not be confused with the date its record was added to this app.

### Export and API questions

**Why Word rather than only PDF?** Word is editable, so the tester can add screenshots or adjust the final document. PDF provides a separate ready-to-read summary.

**How is the Word file created?** The server fills a sanitised OOXML template using the saved records, escapes entered text and packages the files as DOCX.

**What is the large encoded template file?** Formatting assets encoded as text. It is not an API key or database. The source report's original prose and images were removed.

**Does AI generate the report wording?** No. This app exports entered findings using deterministic formatting; there is no language-model API in the report generation path.

**How do you stop old bugs appearing in a new report?** Findings are scoped by reportId. A new report begins separately. Export selection can exclude individual findings without deleting them.

**Is trash a permanent delete?** No. It sets a deletion marker so the report is hidden and unavailable for export until restored.

**What is JSON?** A structured text format with values such as objects, arrays, strings, numbers, booleans and null. It is used for HTTP payloads and the stored workspace document.

**Why can HTTP 200 still produce FAIL?** The request may have been handled but returned the wrong application data. A field assertion can detect that mismatch.

**Why does an arbitrary website URL not run in the API demo?** The server restricts requests to approved demo hosts. A page URL is also not necessarily the correct endpoint for an operation.

**Why keep the API demo at all?** It demonstrates HTTP requests and assertions as an optional extension. It should not be presented as an authenticated integration with the internship website.

**Can the API module find the modal overlay bug?** No. That is a visual/browser interaction problem. The tester records it manually in this app.

### Deployment and ownership questions

**Is pushing code to GitHub the same as deployment?** No. GitHub stores the source. Deployment builds and runs the application on a host, connects its database and provides an application URL.

**Why were there provider names in the earlier source?** They came from unused hosting/authentication scaffolding, not an author field. The standalone version removes those unused modules while retaining the actual framework and dependency identities.

**Can the project run without that earlier hosting provider?** The standalone build targets ordinary Cloudflare Workers and D1, with configuration in wrangler.jsonc. A real hosting account and database are still required for public deployment.

**What did you personally contribute and what assistance did you use?** Give an accurate account of the work and tools used. Be ready to explain decisions, trace code and demonstrate behaviour; do not claim to have manually written every dependency or generated file.

**What would you improve first?** Choose a concrete limitation: account recovery for public use, version checks for concurrent edits, or separate relational tables for larger datasets. Explain the benefit and the added complexity.

## A three minute demonstration

1. Explain the manual QA problem in two sentences and identify the current review.
2. Create a fresh report and show that it starts without earlier findings.
3. Record a reproducible sample issue with expected and observed results. Point out Saving versus Saved.
4. Update its status and show the selected review's counts changing.
5. Open Reports, complete metadata and deselect a finding to demonstrate export scope.
6. Download Word and identify the title, metadata, reproduction steps, observed result and expected result. Explain that screenshots are added manually if needed.
7. Move a review to trash and restore it, using a disposable demonstration record.
8. If time permits, run one approved API check, deliberately change the expected status, and explain why the outcome changes.

For public guest mode, a separate browser session should have a separate workspace. Explain the cookie limitation rather than promising cross-device login.

## Troubleshooting and study order

If the database table is missing, check the DB binding and run the appropriate migration. Local and remote migrations affect different databases. If the public database ID is still the placeholder, configure the actual D1 ID before deployment. If a port is already in use, stop the earlier local server or select another port.

If a finding stays pending, check the network and use retry. Do not treat a pending local draft as confirmed remote persistence. If a review appears to be missing, check the selected report and trash before assuming it was deleted. If a guest workspace changes after clearing cookies or changing browsers, remember that this edition does not have an account recovery system.

Study in this order: the project explanation; screens and record types; the save request; report scoping; the data model; Word generation; guest boundaries; then the optional API module. Practise explaining one successful operation and one failure path with the actual code open.

A strong preparation exercise is to follow a single finding from the form to PATCH /api/findings, into workspace.payload, back into the selected report, and finally into the downloaded Word file. If you can explain that path without memorising a script, you understand the core project.
