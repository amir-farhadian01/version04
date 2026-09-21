# Codex manager / Cline GLM executor

For tasks handed off by Codex, read `.agents/cline-glm-executor.md` and the single relevant specialist card. Codex handles planning and independent acceptance; Cline executes the bounded authorized task and provides evidence. The user remains the final decision-maker.

Start each task with: task ID, selected role, objective, allowed files, exclusions, acceptance criteria, and verification commands. If any essential boundary is missing, inspect relevant files read-only and return the gap.

Keep cost low: focused searches, small output, one task at a time, no unrelated refactors, no repeated full-repository ingestion. Escalate before changing model/provider or starting additional agents. Do not purchase credits or subscriptions.

Return changed files, check commands/results, evidence paths, blockers, and remaining risks. Do not claim independent approval of your own implementation. Never commit or perform release actions merely because tests passed.

These files define a handoff workflow; they do not create an automatic connection between Codex and Cline or configure an API provider. Provider authentication must be verified separately in Cline.
