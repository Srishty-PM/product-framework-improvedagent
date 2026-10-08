# Product Intelligence Agent

**Paste or upload A/B test documentation, review what was read, and run a connected product framework using referenced learnings.**

[Browser tool](https://srishty-pm.github.io/product-framework-improvedagent/) · [Example walkthrough](docs/example-walkthrough.md) · [Portfolio](https://github.com/Srishty-PM/cv) · [Srishty Pahujani](https://srishtypahujani.com/)

## Your workflow

1. Start with **Paste content** or **Upload files**. Add A/B test write-ups, research, results or product notes.
2. Mark each document as **Past experiment / product evidence** or **Framework guidance to review and follow**. Guidance can specify the content and format you require at each of the existing ten stages.
3. Expand the documents to inspect and correct their full extracted text. Review the experiment-field excerpts and accept the evidence.
4. Enter the product problem or decision you want to explore.
5. Choose **Claude AI**, enter your own Anthropic API key, and authorise sending the brief, documents, guidance and generated drafts to Anthropic. API usage incurs charges. The default model is `claude-sonnet-4-6`; you can enter another supported model ID available to your account.
6. Run all ten stages automatically, or uncheck that option to review each stage and add notes before continuing.
7. Review the **What the agent learned from your documents** register and the stage drafts. Edit drafts, then generate a Markdown PRD or interactive HTML prototype.
8. **Save workspace to file** exports documents and the brief as plain JSON. **Open saved workspace** restores them for a fresh review and analysis. Download generated deliverables separately.

The agent reads every evidence document in bounded chunks, extracts referenced experiment learnings, and carries those learnings, relevant excerpts, framework guidance, previous stage drafts and PM feedback into subsequent steps. Documents provide context for the current run; this does not train a model or permanently change its knowledge. Saved workspaces let you reuse documents in later sessions.

Without an API key, choose **Evidence workbook**. It groups fields and retrieves excerpts using keyword rules, then creates an editable ten-stage workbook and draft PRD without API calls. It does not perform AI reasoning or automatically interpret custom guidance; its prototype is a decision-review template.

## Defined framework

| Step | Output |
| --- | --- |
| 1 | Customer segments |
| 2 | Pain points by segment |
| 3 | Structured problem statement |
| 4 | Testable hypotheses |
| 5 | Solution options |
| 6 | ML opportunities |
| 7 | Data and feature strategy |
| 8 | RICE prioritisation |
| 9 | Trade-offs and risks |
| 10 | Success metrics |
| Deliverables | Editable Markdown PRD and sandboxed HTML prototype |

The original marketplace/B2B stage prompts and guided PM feedback flow are retained. Evidence instructions take precedence over illustrative numbers in those prompts. Unknown facts and RICE inputs stay TBD. Historical results remain separate by experiment and are not automatically pooled or declared winners.

## Document support

| Format | Reader behaviour |
| --- | --- |
| PDF | Extracts text and page markers; up to 100 pages. Scans need an existing OCR/text version. Encrypted files are unsupported. |
| DOCX | Extracts main-body paragraphs and table text. Images, headers, comments and tracked-change semantics are not interpreted. |
| XLSX | Extracts worksheet text and cached cell values with coordinates; up to 50 sheets. Formulas are not recalculated. Cached results may be stale; date/display formatting, charts and images are not reconstructed. |
| TXT, Markdown, CSV, JSON | Reads content as text. |
| HTML | Strips tags and active content; remaining text is evidence. |

Limits: **10 MB per file, 20 documents and 200,000 text characters per workspace**. Office archives are limited to 2,000 entries and 40 MB of declared expanded data; XML entity declarations are rejected. Framework guidance is limited to 14,000 characters for Claude analysis. Large summary registers may require splitting the workspace; they are not silently discarded. Review extracted text, especially tables and complex PDF layouts.

## Privacy and output boundaries

- Files are read in the browser. Reading a file does not send document bytes or text to Claude or GitHub. PDF/Office readers load pinned libraries from jsDelivr; internet access is needed to load these readers.
- Clicking **Run Framework** in Claude mode sends the authorised document text and context directly to Anthropic. PRD/prototype generation uses that authorised context too. Provider retention and account policies apply.
- The API key remains in page memory, is sent only to Anthropic, and is excluded from workspace exports. There is no automatic local storage, backend credential store or document commit to GitHub. Refreshing/closing the page clears its workspace; explicitly saved files persist.
- Documents are treated as untrusted evidence. The agent does not execute uploaded instructions or follow document URLs. `[D1:L3]` references point to reviewed source lines; nonexistent source IDs/line numbers are rejected. This check does not prove that a claim correctly interprets its source.
- AI outputs are drafts requiring review. Missing design, denominators, guardrails or uncertainty remain gaps; an isolated p-value is insufficient for a winner. Model-generated interpretations and prioritisation can still be wrong.
- Prototype previews and downloads use a sandbox wrapper with a restrictive content-security policy. The prototype cannot access the workspace origin or make external network requests. It is an illustrative UI, not a production application.
- Saved workspaces and PRDs contain document information in plain text. Use a suitable save location. Browser extensions and device-level access are outside the app's protections.

## Run locally

```sh
git clone https://github.com/Srishty-PM/product-framework-improvedagent.git
cd product-framework-improvedagent
python3 -m http.server 8000
```

Open `http://localhost:8000`. No build step is needed. Claude and parser-library loading require an internet connection.

The app uses vanilla HTML/CSS/JavaScript. `index.html` holds the original prompt definitions and workflow; `document-workspace.js` manages reviewed sources, learning, references and exports; `browser-readers.js` handles browser-side PDF/Office extraction. No paid API credential is included.

## Validation

```sh
npm install --prefix tests
npx --prefix tests playwright install chromium
node tests/online-smoke.cjs
```

The browser test serves the actual pinned PDF.js/JSZip distributions locally and simulates Claude responses. It checks real PDF/DOCX/XLSX/CSV extraction, consent gating, reading the end of long documents, all ten stages, guidance propagation, source-reference rejection, incomplete responses, cancellation/restart, guided workbook mode, PRD/prototype isolation, key-free workspace save/reopen and mobile overflow. No paid inference was performed; actual model quality and account access require your own API key.

The earlier dark interface is retained in [`experiments/framework-runner-dark.html`](experiments/framework-runner-dark.html). The related [framework-agent repository](https://github.com/Srishty-PM/product-framework-agent) is an earlier iteration.

Built by **Srishty Pahujani**, using AI-assisted development · [Website](https://srishtypahujani.com/) · [LinkedIn](https://www.linkedin.com/in/srishtypahujani/)
