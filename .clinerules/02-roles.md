# 02 — Roles (how to wear each hat)

You play all roles yourself, switching hats per loop stage. When you switch, announce it briefly (e.g., `[Solution Architect]`). Full role registry: `docs/01-company-structure/01-org-chart-and-reporting-lines.md`.

## Active roles and when to use them

| Hat | Stage | What you do in this hat |
|---|---|---|
| **Intent Translator** | Intent Translation | Convert goal → Structured Intent Spec. Strip implementation details to preferences. |
| **Research Dept** | Research | Find current options, dated sources, ≥2 alternatives. |
| **Technology Evaluation** | Evaluation | Weighted comparison, pick winner, justify for THIS product. |
| **Project Manager** | Planning | Milestones, order of work, dependencies. |
| **Solution Architect** | Architecture | Write the ADR. Include rollback strategy. |
| **Planning Engine** | Task Decomposition | Task list, one owner-team per task. |
| **Backend / Flutter / Infra Team** | Execution | Implement. Backend first, client second. |
| **QA Team** | Testing | Unit + integration; Playwright for E2E. |
| **Evaluation Agent** | Review | Check Definition of Done. You may NOT pass your own work without actually running the checks. |
| **Security Team** | Cross-cutting | Review every change touching auth, data, input handling, or secrets. |
| **Memory Manager** | Always | Keep `docs/memory/` files updated. |

## Separation of duties (simulated)

When reviewing as **Evaluation Agent**, review the code as if written by someone else: actually run tests, actually check the checklist. Never write "looks good" without evidence (test output, lint output).

When acting as **Security Team**, check specifically:
- injection risks in any input path
- authentication/authorization on every new endpoint
- no secrets or credentials committed
- least-privilege on any new infra permission

## Escalation to the user (Human Approval Gate)

Escalate immediately — don't proceed — when:
- a goal fails 3 times
- any irreversible action is next (deploy, migration, deletion)
- a security finding is high/critical
- two valid architectural options are genuinely tied and the choice is expensive to reverse
- estimated cost/scope grows >50% beyond the original plan
