# Product Intelligence Agent — private offline edition

**Paste or upload A/B test documentation, review the evidence, and run the existing ten-stage product framework.**

Documents stay in page/process memory on your computer. There is no cloud API, API key, analytics, remote font, automatic storage or model training. A saved workspace is an explicit, unencrypted JSON export. Historical experiments become referenced context for the current decision; they do not automatically establish a winner or guaranteed future impact.

## Start on a Mac

1. Unzip the offline kit into a folder on your computer.
2. Have Python 3.10 or later installed before going offline.
3. Open Terminal in that folder and run `python3 offline_server.py --open` (or `sh start.command`).
4. Keep Terminal open while you use the app. Stop it with Ctrl+C when finished.

On Windows with Python installed, run `start-windows.bat`, or `py -3 offline_server.py --open`. On Linux, run `python3 offline_server.py --open`.

The kit includes the pure-Python PDF parser: no installation or network access is needed at runtime. A source checkout needs `python3 -m pip install -r requirements.txt` **before** going offline for PDF support. Word, Excel and text extraction uses Python's standard library.

Opening `index.html` directly supports pasted content and text-file uploads plus the evidence workbook. Use the local launcher for PDF/Word/Excel and Local AI. The publicly hosted page cannot access the local extraction service, so use the downloaded app for private documents.

## Your workflow

1. Choose **Paste content** or **Upload files** at the start. Add several documents if useful.
2. Mark each as **Past experiment / product evidence** or **Framework guidance to review and follow**. Guidance can describe your preferred step requirements; the existing ten-stage order stays intact.
3. Expand each document to inspect/correct the full extracted text. Review the evidence excerpts and missing fields, then accept the evidence.
4. Enter the product problem or decision to explore.
5. Choose **Offline evidence workbook** or **Local AI**. Run all steps automatically, or review and add notes after each stage.
6. Edit stage drafts, then generate/download a PRD or sandboxed prototype. Missing RICE inputs stay TBD.
7. Use **Save workspace to file** to keep documents and the decision brief for next time; **Open saved workspace** restores them for a fresh review/run. Save generated deliverables separately. **Clear workspace** clears page content; it does not delete saved files.

The source register and `[D1:L3]` references map claims/excerpts back to lines in the reviewed text, with page markers preserved for PDFs. Edits to documents invalidate old results. No workspace is kept automatically after a page refresh or closure.

## Two honest execution modes

| Mode | What it does | Prerequisite |
| --- | --- | --- |
| Offline evidence workbook | Reads text, groups experiment fields, retrieves stage-relevant excerpts and creates an editable ten-stage decision workbook and draft PRD. Uses deterministic keyword rules. Does not infer missing facts or automatically interpret custom guidance. Prototype is a decision-review template. | Browser; local Python launcher for PDF/DOCX/XLSX. |
| Local AI | Reads each complete evidence document in chunks, consolidates referenced learnings, and uses reviewed experiment evidence, approved framework guidance, previous stage drafts and PM feedback to reason through every stage. Generates a draft PRD and solution-specific prototype. Answers require PM review. | Ollama and a downloaded **local** model with enough memory/context, installed before offline use. |

There is no model included in the kit and no real-model inference was run during build verification. Local AI integration is verified with a stubbed local service; reasoning quality and speed depend on your installed model and hardware. Documents provide runtime context, not fine-tuning or permanent weight updates. Excerpts are selected by stage/problem relevance; review the full source for omitted context.

## Enable Local AI without cloud access

Install Ollama and obtain a local model while online, before adding confidential documents. Choose a model appropriate for your computer; this app does not download models. Use `ollama list` to see installed model names.

Start a dedicated, cloud-disabled Ollama process in another Terminal window:

```sh
OLLAMA_NO_CLOUD=1 OLLAMA_HOST=127.0.0.1:11435 ollama serve
```

On a Mac/Linux, `sh start-local-ai.command` does the same. On Windows PowerShell:

```powershell
$env:OLLAMA_NO_CLOUD = "1"
$env:OLLAMA_HOST = "127.0.0.1:11435"
ollama serve
```

The app connects only to this dedicated loopback port, verifies the selected model is locally installed, and rejects cloud/remote models, redirects and automatic downloads. Keep this process open, choose **Local AI**, and enter the exact installed model name, including its tag. No cloud fallback is used if inference fails. Unplugging/disabling internet also prevents external service traffic from other software on the computer.

## Defined framework

| Step | Output |
| --- | --- |
| 1 | Customer segments |
| 2 | Pain points by segment |
| 3 | Problem statement |
| 4 | Hypotheses |
| 5 | Solution options |
| 6 | ML opportunity mapping |
| 7 | Data and feature strategy |
| 8 | RICE prioritisation |
| 9 | Trade-offs and risks |
| 10 | Success metrics |
| Deliverables | Editable Markdown draft PRD; sandboxed HTML prototype |

The original stage prompt definitions and guided PM feedback flow are retained. Evidence grounding takes precedence over illustrative numbers in those prompts. RICE requires comparable reach/impact, confidence from 0–1 and consistent effort units; absent inputs are not invented.

## Formats and boundaries

- PDF: text PDFs, up to 100 pages; page references preserved. Scans need an existing text/OCR version. Encrypted PDFs are rejected. Complex tables/layout can extract imperfectly: review the text.
- DOCX: paragraph and table text in the main document body. Embedded files/images, comments, headers, footers and tracked-change semantics are not analysed. Macros are not executed.
- XLSX: worksheet text/cached values with cell coordinates. Formulas are not evaluated and cached values may be stale. Charts/images, date-format semantics and hidden sheet interpretation are not reconstructed.
- TXT, MD, CSV, JSON: read as text. HTML: tags/active content stripped and text treated as evidence. Files are never executed.
- Limits: 10 MB/file, 20 sources, 200,000 text characters/workspace. Oversized/unsupported input is rejected with an explanation rather than silently truncated.
- Multiple experiments retain separate source identities; metrics/results are not automatically pooled. Missing statistical/design information remains unresolved. A model can still misread documents or hallucinate; verify source references and decisions.

## Privacy protections

The local server binds only to `127.0.0.1`. Host/origin checks, JSON-only API requests and a custom request header reject cross-site form submissions and DNS-rebinding origins. Documents are not written to disk by the app and request/prompt logs are disabled. Python extraction runs in a subprocess with a time limit and POSIX resource limits; Office archives and XML entities are bounded/rejected. Browser CSP blocks remote resources and cloud calls. Generated prototypes are downloaded inside a sandbox wrapper with network requests and external frame navigation blocked. Prototype previews have no access to the workspace origin.

These protections apply to this app, not browser extensions, operating-system swap, backups or independently running services. Saved workspace/PRD files contain your supplied information in plain text. Use a suitable device and save location for your organisation's documents.

## Validation

```sh
python3 -m unittest discover -s tests -v
# With Playwright + Chromium already available:
node tests/browser_smoke.cjs
```

Tests cover PDF/DOCX/XLSX extraction, blank/corrupt documents, XML-entity rejection, cross-origin/host guards, request limits, all ten stages, source references, save/reopen, stop/restart, draft deliverables, prototype isolation and absence of external browser requests. Local-model tests stub the service; they do not benchmark an installed model.

Built by **Srishty Pahujani**, using AI-assisted development. [Original example](docs/example-walkthrough.md) · [Portfolio](https://github.com/Srishty-PM/cv) · [Website](https://srishtypahujani.com/)
