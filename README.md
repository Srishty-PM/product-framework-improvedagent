# Product Intelligence Agent

**Start with a problem statement. Run ten connected product framework steps, generate an interactive prototype, then create its PRD.**

[Browser tool](https://srishty-pm.github.io/product-framework-improvedagent/) · [Example walkthrough](docs/example-walkthrough.md) · [Portfolio](https://github.com/Srishty-PM/cv) · [Srishty Pahujani](https://srishtypahujani.com/)

## Run the agent

1. Describe your product problem: who is affected, what is going wrong, and the outcome you want to improve.
2. Enter your Anthropic API key and authorise Claude generation. The key stays in page memory and is sent only to Anthropic; API charges apply.
3. Choose **Run problem → prototype → PRD**. By default, the agent streams the ten-stage analysis, creates the interactive prototype, then writes a PRD using the analysis and a text summary of the prototype flow.
4. Review the generated proposals and download **prototype.html** and **PRD.md**.

There is no document upload, A/B result ingestion, document-learning stage or evidence-review prerequisite. The problem statement is the starting point. Include relevant constraints directly in that statement, or add notes during a guided run.

## Framework

| Step | Output |
| --- | --- |
| 1 | Customer segments |
| 2 | Pain points |
| 3 | Structured problem statement |
| 4 | Hypotheses |
| 5 | Solution options |
| 6 | ML opportunities |
| 7 | Data and feature strategy |
| 8 | RICE prioritisation |
| 9 | Trade-offs and risks |
| 10 | Success metrics |
| 11 | Interactive HTML prototype |
| 12 | Product requirements document |

Marketplace prompts account for supply, demand and matching. B2B prompts distinguish buyers from users. Product-type detection uses keyword rules.

## Run controls

- **Fast** is the default: one streamed response for the ten analysis stages, followed by separate prototype and PRD requests.
- **Detailed** makes one analysis request per stage, followed by the two deliverables.
- Uncheck **Run all ten analysis steps automatically** to review each stage, edit its draft and add feedback before continuing. Notes carry into later analysis and deliverables.
- Uncheck **Continue automatically to prototype, then PRD** to review the completed analysis before creating deliverables manually.
- **Stop** preserves finished stages and deliverables. Resume analysis or choose **Resume deliverables** to generate only the missing outputs.
- Changing the problem statement clears old outputs. Editing an earlier stage invalidates downstream analysis and deliverables; resume to regenerate them from the edited decision. Regenerating the prototype invalidates the old PRD.
- Prototype generation streams progress with a 12,000-token output ceiling and a compact design target. A clipped or incomplete HTML response triggers one automatic retry with a smaller two-screen design; partial HTML is never executed. The prototype request has a five-minute timeout and can be stopped. No automatic retry is made for authentication/rate-limit errors.
- Provider errors and truncated/interrupted responses are surfaced. Completed stages are retained; incomplete outputs do not count as finished. A failed prototype stops the sequence before PRD generation. A failed PRD preserves the prototype for retry.

## Boundaries

Proposals and prioritisation are drafts, not customer research or measured results. The agent labels assumptions and keeps missing factual data and success targets as TBD. RICE uses provisional numeric planning estimates with a rationale for Reach, Impact, Confidence and Effort. The table is labelled **Indicative prioritisation — requires validation**. Reach, Impact and Effort use consistent relative 1–10 scales for the same next-quarter audience and team; Confidence uses 0–1. These are heuristic scores, not measured reach or outcome forecasts. The app recalculates `(Reach × Impact × Confidence) / Effort`, sorts the options, and carries that provisional ranking into prototype and PRD generation. Edited RICE tables are recalculated too. Review its reasoning and validate requirements before using them.

The app is vanilla HTML/CSS/JavaScript using Anthropic's Messages API. `index.html` contains the interface, original stage prompts, provider connection and deliverable generators. `framework-runner.js` manages the connected run, streamed-stage parsing, editing, continuation and prototype isolation. No build step or backend is required. The default model is `claude-sonnet-4-6`; Advanced run options let you select another supported model available to your account.

There is no automatic persistence, browser storage, analytics or credential store. Refreshing or closing the page clears the brief, key and generated outputs. Downloads contain your generated content in plain text. The prototype runs inside a sandbox with network access and workspace-origin access blocked; its downloaded HTML retains that wrapper. It is an illustrative UI, not a production application.

## Run locally

```sh
git clone https://github.com/Srishty-PM/product-framework-improvedagent.git
cd product-framework-improvedagent
python3 -m http.server 8000
```

Open `http://localhost:8000`. Claude requests require internet access and your own API key.

## Validation

```sh
npm install --prefix tests
npm --prefix tests test
npx --prefix tests playwright install chromium
npm --prefix tests run test:browser
```

Flow tests cover the complete problem → ten stages → prototype → PRD sequence, streamed UTF-8 responses, detailed/guided runs, notes, edited-decision invalidation, cancellation/resume, authentication/rate-limit failures and retries that preserve completed outputs. Browser tests cover actual clipboard paste into the key field, both deliverable downloads, interactive prototype behaviour, sandbox isolation, consent gating, error recovery and mobile overflow. Claude responses are simulated; these checks do not verify paid model inference or account access.

The earlier dark interface remains in [`experiments/framework-runner-dark.html`](experiments/framework-runner-dark.html). The related [framework-agent repository](https://github.com/Srishty-PM/product-framework-agent) is an earlier iteration.

Built by **Srishty Pahujani**, using AI-assisted development · [Website](https://srishtypahujani.com/) · [LinkedIn](https://www.linkedin.com/in/srishtypahujani/)
