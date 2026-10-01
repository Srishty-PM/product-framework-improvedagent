# Product Intelligence Agent — example walkthrough

**A worked illustration of the workflow. The examples below are manually written sample reasoning, not a recorded model run or validated research.**

## Input

Customers can find local repair specialists, but struggle to judge reliability and book a suitable appointment. Specialists struggle to fill unused capacity. Design a first version of a two-sided repair marketplace.

## What a useful analysis should cover

| Stage | Example reasoning to inspect |
| --- | --- |
| Customer segments | Separate demand-side households from supply-side specialists; distinguish urgent repairs from planned maintenance. |
| Pain points | Customers lack trust and appointment certainty; specialists lose time qualifying weak leads and filling gaps. These remain hypotheses until researched. |
| Problem statement | Help customers find a credible specialist with a usable slot, while giving specialists qualified demand. |
| Hypotheses | Verified service information and clear availability may increase booking intent; better lead qualification may increase specialist acceptance. |
| Solutions | Start with availability, transparent profiles and request qualification; compare this with instant booking and algorithmic matching. |
| ML opportunity | Matching could eventually use job type, travel radius and availability. Rules may be sufficient before transaction data exists. |
| Data strategy | Specify useful fields and missing data; avoid assuming a mature training dataset for a new marketplace. |
| Prioritisation | Compare reach, impact, confidence and effort. Replace illustrative scores with research and delivery estimates before commitment. |
| Trade-offs | Balance friction, trust, supply coverage and response speed. Consider cold start and liquidity at the local level. |
| Metrics | Track qualified requests fulfilled, time to match, provider acceptance, repeat use and failed bookings. |

## A human feedback moment

After reviewing solutions, add:

> Limit the first release to one city and one repair category. Keep booking confirmation manual; do not assume instant availability from every provider.

The guided implementation appends accumulated notes to later framework prompts. This lets a product manager make the constraint explicit rather than accept a polished but oversized proposal. The PRD/prototype generators use selected analysis outputs; they do not independently guarantee every note appears in the final deliverable.

## Product judgement demonstrated

The interesting choice is the workflow: context is reused, marketplace structure is made explicit, and a person can intervene. The ML stage asks where prediction creates value and what data would support it. Prioritisation and metrics create a bridge toward a delivery conversation.

## What I would validate next

Compare outputs across a fixed set of marketplace, B2B and consumer problems. Review domain classification, evidence quality, consistency between stages, incorporation of notes, missing assumptions and delivery usefulness. Record time, cost and evaluator agreement rather than relying on how convincing the prose sounds.

[Back to the project](../README.md) · [Full portfolio](https://github.com/Srishty-PM/cv)
