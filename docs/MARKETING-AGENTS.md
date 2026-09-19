# Neighborly AI Growth Organization

## Architecture

The growth organization sits alongside—not inside or above—the existing engineering organization. Google Antigravity is the primary native runtime: one parent orchestrator delegates bounded work to specialist subagents, specialists invoke repository skills, and all durable evidence and learnings return to Git-backed marketing memory. The design is framework-independent; CrewAI, LangGraph, AutoGen, and similar systems are optional future adapters only.

```text
Founder objective
  └─ GTM Orchestrator
      ├─ Market Intelligence       evidence and market candidates
      ├─ Positioning & Brand       audience, promise, proof, offers
      ├─ Marketplace Growth        liquidity, loops, economics
      ├─ Launch                    readiness and sequencing
      ├─ Content & SEO             supply-backed local discovery
      ├─ Sales & Supply            qualified compliant supply pipeline
      ├─ CRM & Lifecycle           activation, repeat, referral journeys
      └─ Analytics & Experiments   measurement and causal learning
          └─ shared skills + MCP tools + repository memory
```

## Role ownership

| Role | Exclusive primary ownership | Does not own |
|---|---|---|
| [GTM Orchestrator](../.agents/growth/gtm-orchestrator/AGENT.md) | Decomposition, delegation, synthesis, conflicts, gates | Specialist execution |
| [Market Intelligence](../.agents/growth/market-intelligence/AGENT.md) | External evidence and candidate comparison | Final launch selection |
| [Positioning & Brand](../.agents/growth/positioning-brand/AGENT.md) | Position, claims, messages, offer hypotheses | Publishing |
| [Marketplace Growth](../.agents/growth/marketplace-growth/AGENT.md) | Liquidity constraints, growth loops, economics | Campaign operations |
| [Launch](../.agents/growth/launch/AGENT.md) | Readiness and cross-channel launch sequencing | Market research ownership |
| [Content & SEO](../.agents/growth/content-seo/AGENT.md) | Content system and legitimate local discovery | Lead qualification |
| [Sales & Supply](../.agents/growth/sales-supply/AGENT.md) | Provider qualification and compliant supply pipeline | KYC approval |
| [CRM & Lifecycle](../.agents/growth/crm-lifecycle/AGENT.md) | State-based onboarding, retention, referral | Acquisition market selection |
| [Analytics & Experiments](../.agents/growth/analytics-experiments/AGENT.md) | Definitions, scorecards, experiment integrity | Business decision authority |

Trust & Safety and Red Team remain cross-functional skills, not permanent agents. The shared skill catalog is under [`.agents/skills/`](../.agents/skills/).

## Antigravity invocation protocol

1. Founder supplies an objective, constraints, decision deadline, and known evidence.
2. Orchestrator opens a task brief and chooses only necessary roles.
3. Independent research may run in parallel; dependent tasks wait for their inputs.
4. Each handoff names one owner, evidence standard, output path, and stop condition.
5. Orchestrator resolves disagreement by comparing evidence quality or requesting a disconfirming test.
6. Important decisions receive red-team review and all applicable gates.
7. Final output and learning are written to marketing memory.

Agents should communicate through artifacts rather than long conversational chains. No agent starts from zero when relevant current memory exists.

---

Native Antigravity uses the [GTM orchestrator](../.agents/growth/gtm-orchestrator/AGENT.md) as parent coordinator, starts only the specialists needed for an objective, and exchanges repository artifacts through `marketing/`. Shared skills contain repeatable procedures; MCP tools provide bounded capabilities. The architecture has no third-party orchestration dependency.

| Agent | Exclusive primary ownership | Typical handoff |
|---|---|---|
| gtm-orchestrator | Delegation, synthesis, disagreement resolution, gates, final brief | Founder decision |
| market-intelligence | Market/customer/provider/competitor evidence | Selection or positioning inputs |
| positioning-brand | Message, proof, claims, voice | Launch/content/sales briefs |
| marketplace-growth | Liquidity constraints, loops, unit economics | Intervention proposal |
| launch | Readiness, sequencing, go/no-go coordination | Approved execution owners |
| content-seo | Local/content/search planning and quality | Approved publishing owner |
| sales-supply | Provider qualification and compliant acquisition pipeline | Verification/onboarding |
| crm-lifecycle | State-triggered onboarding, retention, referral journeys | Approved CRM execution |
| analytics-experiments | Metric contracts, scorecards, experiments, readouts | Decision owner |

Trust & Safety and Red Team are deliberately cross-functional skills, not permanent agents. CASL is a mandatory compliance skill for relevant Canadian electronic outreach.

## Orchestrator dispatch

1. Convert the objective into decisions and evidence questions.
2. Select the minimum roles; parallelize only independent research or analysis.
3. Give each role an output contract and shared definitions.
4. Merge artifacts without redoing specialist analysis.
5. Surface disagreement by claim, evidence, and decision impact; request additional independent evidence where confidence is weak.
6. Run Red Team before important recommendations.
7. Report recommendation, alternatives, confidence, gate status, approvals, and memory updates.

## Skill directory

- Intelligence: `market-research`, `competitor-analysis`, `micro-market-selection`, `customer-research`, `provider-research`.
- Strategy/economics: `marketplace-liquidity`, `marketplace-unit-economics`, `positioning`, `offer-design`, `launch-strategy`.
- Content/community: `local-seo`, `programmatic-seo`, `content-strategy`, `social-content`, `community-growth`.
- Supply: `provider-acquisition`, `sales-qualification`, `outreach-personalization`.
- Lifecycle: `crm-lifecycle`, `onboarding-optimization`, `referral-program`, `retention-analysis`.
- Measurement/control: `experiment-design`, `analytics-scorecard`, `trust-safety-verification`, `casl-compliance`, `red-team-review`.

Definitions and invocation rules live under `../.agents/skills/<name>/SKILL.md`. Agent boundaries and the required context protocol live in [agent governance](../.agents/AGENTS.md).

## Example minimal crews

- **Select a micro-market:** orchestrator → market intelligence + analytics; marketplace growth checks economics/liquidity; Red Team challenges; founder decides.
- **Prepare launch:** orchestrator → launch + sales-supply + analytics; positioning/content only if needed; Trust/Safety and approvals gate go-live.
- **Improve repeat rate:** orchestrator → analytics + CRM lifecycle + marketplace growth; experiment skill defines evaluation.

Agents should not converse merely to acknowledge work. Handoffs are deterministic artifacts with an explicit next decision.
