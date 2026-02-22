# Product Intelligence Agent — Framework Runner

A browser-based PM aid that runs a full structured product framework from a single problem statement. No installs. No sign-ups. Just open and think.

---

## What it does

Drop in any product problem statement. The tool works through 10 structured steps:

1. **Customer Segments** — behavioural segmentation, not just demographics
2. **Pain Points** — ranked by severity per segment
3. **Problem Statement** — crisp, structured, interview-ready
4. **Hypotheses** — testable, with validation criteria
5. **Solution Options** — from quick wins to category-creating bets
6. **ML Opportunity Mapping** — where AI adds real value vs. rule-based logic
7. **Data & Feature Strategy** — concrete features, cold start approach
8. **RICE Prioritisation** — scored and ranked in a table
9. **Tradeoffs & Risks** — technical, adoption, regulatory, competitive
10. **Success Metrics** — industry-standard metrics applied to your specific context

Then generates:
- **Interactive Prototype** — a clickable HTML mockup of the top solution
- **PRD** — a full Product Requirements Document, downloadable as Markdown

---

## What makes it different

The tool detects the product type before running the framework.

**As a PM:** if your problem is a marketplace, it knows supply and demand are different sides with different pain points, acquisition strategies, and metrics. It splits segments into supply vs. demand, flags the chicken-and-egg problem, and frames solutions around liquidity — not just features.

**Under the hood:** a lightweight classifier reads your problem statement and routes every prompt through the right mental model — marketplace, B2B SaaS, consumer app, or general. Marketplace problems trigger two-sided segmentation, liquidity-aware hypotheses, matching-layer ML opportunities, and GMV/take-rate metrics.

---

## Feedback mode

After each step completes, you can steer the direction before continuing:
- Click **✎ Add note before continuing**
- Type your direction — e.g. *"focus on enterprise customers only"* or *"this solution is too complex for v1"*
- Your note carries forward into every remaining step
- Steps with notes are tagged with 📝 so you can track what was steered

---

## How to use it

**Use in browser**
Visit: **[srishty-pm.github.io/product-framework-improvedagent](https://srishty-pm.github.io/product-framework-improvedagent)**

You'll need a free Anthropic API key:
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up free — you get $5 credit (enough for 50+ full runs)
3. Create an API key, paste it into the tool, click Unlock
4. Enter your problem statement and hit Run

**Run locally**
1. Download `index.html`
2. Double-click to open in Chrome or Safari
3. Enter your API key and go

---

## Built with

- Vanilla HTML, CSS, JavaScript — zero dependencies
- [Claude API](https://anthropic.com) (claude-sonnet-4) for all AI generation
- Hosted on GitHub Pages

---

## About

Built by [Srish](https://www.linkedin.com/in/srishty-jha/) — Lead PM at Tesco Technologies, building at the intersection of product and AI.

If you find it useful, connect on LinkedIn or share with a PM who'd benefit.

---

*The quality of what comes out depends entirely on the quality of the problem statement going in.*
