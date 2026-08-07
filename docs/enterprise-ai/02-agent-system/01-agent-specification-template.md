# Agent Specification Template

**Document ID:** AGENT-01
**Owner:** AI Orchestrator / Organization Designer
**Depends on:** ORG-01 (roles), FOUND-01 (loop stages)
**Status:** Complete — this is the mandatory schema for every agent document in this set

---

## 1. Purpose

Every agent in the company — permanent or SubAgent — must be specified using the exact schema below. Uniform specs are what make the system operable: the Orchestrator can assign work, the Evaluation Agent can judge output, and the Goal Recovery Engine can diagnose failures only if every agent's contract is machine-readable and structurally identical.

## 2. The Schema

Every agent spec is a Markdown file with these fourteen sections, in this order, none omitted. If a section genuinely doesn't apply, it must say `N/A — <one-line reason>` rather than being deleted, so absence is always deliberate.

### 2.1 Mission
One sentence. What this agent exists to achieve, phrased as an outcome, not an activity. ("Ensure every ADR is backed by current research" — not "review documents.")

### 2.2 Responsibilities
Bounded list, 3–7 items. If a draft spec needs more than 7, the role is too broad — split it or push work to SubAgents.

### 2.3 Inputs
Typed artifacts only, each with its source. Example: `Research Dossier (from: Research Department, schema: FOUND-01 §6.2)`. Free-text inputs are forbidden except at the Goal Author boundary.

### 2.4 Outputs
Typed artifacts only, each with its consumer and schema reference. An output with no consumer is dead work — remove it or find its consumer.

### 2.5 KPIs
2–5 measurable indicators. Each must state: metric, target, measurement source, and review cadence. KPIs no one can measure are banned.

### 2.6 Dependencies
Which agents/registries/MCP servers this agent needs at runtime. Used by the Orchestrator for scheduling and by the Incident Manager for blast-radius analysis.

### 2.7 Workflow
Numbered steps or a Mermaid diagram of the agent's happy path, from input receipt to output delivery.

### 2.8 Escalation
When and to whom, per the ORG-01 §6 matrix. Must name the trigger condition explicitly ("confidence below threshold," "policy conflict detected"), never "when unsure."

### 2.9 Failure Recovery
What the agent does when its own step fails: retry policy (with backoff and cap), fallback behavior, and what state it persists so the Goal Recovery Engine can resume rather than restart.

### 2.10 Definition of Done
Objective completion criteria checkable by the Evaluation Agent without asking the producing agent. "Code written" is not done; "code merged, tests green, artifact ID logged to Decision History" is done.

### 2.11 Decision Criteria
For agents that choose between options: the ranked criteria and their weights. This is what makes decisions auditable — the Decision History (05-02) stores the criteria snapshot alongside every decision.

### 2.12 Prompt Templates
The actual templates this agent uses, with `{placeholders}`. Templates are versioned; the Prompt Optimizer may only modify them through a logged change with before/after and rationale.

### 2.13 Example Tasks
2–3 worked examples: realistic input → the agent's expected output. These double as regression tests for the agent's behavior.

### 2.14 SubAgent Policy
Whether this agent may spawn SubAgents, for what task types, with what resource cap, and what the SubAgent inherits (tools, memory scope, escalation line). Default: inheritance is *restrictive* — a SubAgent never gets more access than its parent.

## 3. Worked Example: Intent Translator (abbreviated)

**Mission:** Convert every human-authored Goal into a Structured Intent Spec with zero implementation detail promoted to requirement.

**Responsibilities:** (1) Parse raw Goals; (2) demote implementation details to non-binding preferences; (3) ask at most one clarifying question per Goal; (4) log assumptions explicitly; (5) hand off only schema-valid Intent Specs.

**Inputs:** Raw Goal record (from: Goal Engine, free-text — the one sanctioned free-text boundary).

**Outputs:** Structured Intent Spec (to: Research Department, schema: FOUND-01 §6.1).

**KPIs:** Clarifying-question rate <15% (source: Goal Engine logs, monthly); downstream bad-intent failure rate <5% of Recovery Loop invocations (source: Goal Recovery Engine, monthly).

**Escalation:** Contradictory constraints within one Goal → Product Director. Suspected policy-violating Goal → Policy Engine immediately, before any processing.

**Failure Recovery:** If spec generation fails validation twice, persist the partial spec with failure annotations and route to Product Director rather than retrying a third time.

**Definition of Done:** Intent Spec passes schema validation, assumption log is non-empty or explicitly `no assumptions`, artifact ID written to Decision History.

**Decision Criteria:** When multiple readings of a Goal are plausible: (1) most common interpretation in this product's domain, weight 0.5; (2) lowest-irreversibility interpretation, weight 0.3; (3) cheapest-to-correct-later interpretation, weight 0.2.

**SubAgent Policy:** May spawn research-lookup SubAgents for terminology disambiguation only; cap 2 concurrent; no code-execution tools inherited.

## 4. Validation Pipeline

Every new or modified agent spec passes through:

```mermaid
flowchart LR
    A[Draft Spec] --> B[Schema Lint - all 14 sections present]
    B --> C[Standards & Governance review]
    C --> D[Orchestrator dry-run - can it be scheduled?]
    D --> E[Registry entry created/updated]
    E --> F[Spec live]
```

A spec failing any stage returns to draft with annotations. The Agent Registry only ever contains specs that passed all stages — the registry is the single source of truth for "which agents exist and what are their contracts."

## 5. Best Practices

- Write the Definition of Done *first*, then work backwards — it's the section that most often exposes a vague mission.
- Keep Decision Criteria weights explicit even when they feel obvious; six months later, "obvious" is the thing nobody can reconstruct.
- Review KPIs quarterly; a KPI that has never once influenced a decision should be replaced.

## 6. Anti-Patterns

- **Prose-only specs.** If the Orchestrator can't parse it, it doesn't exist operationally.
- **Aspirational KPIs** with no measurement source. Delete or instrument.
- **Permissive SubAgent inheritance.** Privilege escalation via SubAgents is the top security risk in agent systems; the restrictive-by-default rule in §2.14 exists for this reason (see also 10-01).

## 7. KPIs (for this template itself)

- 100% of registry agents conform to current schema version (audited by Standards & Governance)
- Median spec-validation cycle time
- Schema change frequency (high churn signals the template is under-specified)

## 8. Future Improvements

- Machine-executable spec format (YAML front-matter mirroring the 14 sections) so linting and dry-runs are fully automated.
- Spec diffing in Decision History so behavioral changes in agents are traceable to spec changes.
