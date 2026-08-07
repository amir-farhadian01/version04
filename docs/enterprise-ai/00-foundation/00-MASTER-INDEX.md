# Enterprise AI Company — Master Documentation Index

**System:** Goal-Driven Autonomous AI Software Company
**Product:** Flutter-based social media application (backend-first, client-agnostic)
**Version:** 1.0
**Status:** Living document — updated as each module is authored

---

## 1. Purpose of This Index

This index is the single entry point into the full Enterprise Architecture Bible. Every document below is cross-referenced: none of them stand alone, because in a goal-driven company the org chart, the memory system, the MCP registry, and the QA pipeline all have to agree with each other or the autonomy loop breaks. Read this file first, then follow the links in whichever order matches what you're building right now.

Because the full set runs to several hundred pages, it is being authored in batches rather than in one pass. This index tracks what exists, what's next, and why the batching is ordered the way it is.

---

## 2. Authoring Order and Rationale

The 40 documents are grouped into 13 folders. The order isn't arbitrary — each folder depends on decisions made in the ones before it:

1. **00-foundation** — philosophy, goal-driven architecture, the core loop. Everything else is downstream of this.
2. **01-company-structure** — the org chart of AI agents. Can't be designed until the goal loop (above) defines what roles are actually needed.
3. **02-agent-system** — the internal spec every agent in (1) must conform to (mission, KPIs, escalation, etc.).
4. **03-goal-architecture** — the detailed state machine version of the loop sketched in (00).
5. **04-research-rd** — how "always research before building" actually gets implemented as a department, not a slogan.
6. **05-memory-knowledge** — long/short/working/project memory; needed before agents can be given realistic workflows.
7. **06-mcp-platform** — tool integration layer (GitHub, Docker, DB, Playwright, etc.).
8. **07-backend**, **08-flutter** — the actual product architecture, informed by everything above.
9. **09-devops-infra**, **10-security**, **11-qa-testing**, **12-observability** — the operational spine.
10. **13-governance-risk** — policy, escalation, human approval gates, cost control.

---

## 3. Document Manifest

Legend: ✅ complete · 🔲 planned (not yet written)

### 00-foundation
- ✅ `00-MASTER-INDEX.md` — this file
- ✅ `01-company-philosophy-and-goal-loop.md` — the core doctrine: humans define goals only, the company self-organizes the rest
- 🔲 `02-north-star-metrics-and-business-context.md`

### 01-company-structure
- ✅ `01-org-chart-and-reporting-lines.md`
- 🔲 `02-executive-agents-ceo-cto-cro.md` (CEO AI, CTO AI, Chief Architect, Chief Research Officer)
- 🔲 `03-product-and-delivery-agents.md` (Product Director, PM, Scrum Master, Solution Architect)
- 🔲 `04-prompt-layer-agents.md` (Prompt Engineer, Intent Translator, Prompt Compiler, Prompt Optimizer)

### 02-agent-system
- ✅ `01-agent-specification-template.md` (the schema every agent doc must follow)
- 🔲 `02-orchestrator-planning-decision-engines.md`
- 🔲 `03-subagent-lifecycle-and-registry.md`
- 🔲 `04-evaluation-agent-and-human-approval-gate.md`

### 03-goal-architecture
- 🔲 `01-goal-state-machine.md` (Goal → Intent → Research → ... → Continuous Improvement, as a formal state machine with recovery loops)
- 🔲 `02-failure-detection-and-goal-recovery.md`
- 🔲 `03-task-decomposition-and-assignment.md`

### 04-research-rd
- 🔲 `01-research-department-charter.md`
- 🔲 `02-technology-evaluation-framework.md`
- 🔲 `03-standards-and-governance-validation.md`

### 05-memory-knowledge
- 🔲 `01-memory-architecture-overview.md` (long/short/working/context/project memory)
- 🔲 `02-knowledge-base-and-decision-history.md`
- 🔲 `03-lessons-learned-pipeline.md`

### 06-mcp-platform
- 🔲 `01-mcp-platform-architecture.md`
- 🔲 `02-mcp-server-catalog.md` (GitHub, Filesystem, Docker, Database, Playwright, Terminal, Browser, Documentation)

### 07-backend
- 🔲 `01-backend-architecture-and-technology-selection.md`
- 🔲 `02-api-design-standards.md`
- 🔲 `03-database-design-standards.md`

### 08-flutter
- 🔲 `01-flutter-client-architecture.md`
- 🔲 `02-flutter-state-management-and-design-system.md`

### 09-devops-infra
- 🔲 `01-infrastructure-architecture.md`
- 🔲 `02-cicd-and-release-strategy.md`

### 10-security
- 🔲 `01-security-architecture-and-threat-model.md`
- 🔲 `02-secure-sdlc-and-policy-engine.md`

### 11-qa-testing
- 🔲 `01-qa-strategy-and-test-pyramid.md`
- 🔲 `02-playwright-and-automation-standards.md`

### 12-observability
- 🔲 `01-monitoring-and-incident-management.md`
- 🔲 `02-cost-management-and-analytics.md`

### 13-governance-risk
- 🔲 `01-policy-engine-and-risk-manager.md`
- 🔲 `02-human-approval-gates-and-escalation.md`

---

## 4. How to Use This Set

- **Building a new feature?** Start at `03-goal-architecture/01-goal-state-machine.md`, trace which agents in `01-company-structure` own each stage, then check `06-mcp-platform` for which tools those agents are allowed to call.
- **Onboarding a new agent role?** Use the schema in `02-agent-system/01-agent-specification-template.md`.
- **Auditing a decision?** Everything terminates in `05-memory-knowledge/02-knowledge-base-and-decision-history.md`.

---

## 5. Status

Four documents complete (index, philosophy/goal loop, org chart, agent spec template). The remaining 36 will be authored in subsequent batches — each batch will update the ✅/🔲 markers above so this index always reflects the true state of the doc set.
