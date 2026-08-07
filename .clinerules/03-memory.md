# 03 — Memory & Artifacts

Maintain these files in the project. Create them on first use.

## docs/memory/decision-history.md
Append-only log. Every significant decision gets an entry:
```
## [YYYY-MM-DD] <decision title>
- **Goal:** <which goal this serves>
- **Decision:** <what was chosen>
- **Alternatives rejected:** <what and why>
- **Rationale:** <why the winner won, for this product>
```

## docs/memory/lessons-learned.md
Append after every completed goal or notable failure:
```
## [YYYY-MM-DD] <goal / incident>
- **What happened:**
- **Root cause (if failure):** bad intent | bad research | bad architecture | bad implementation | bad test
- **Rule for next time:**
```

## docs/adr/NNN-<slug>.md
One file per architecture decision:
```
# ADR-NNN: <title>
- Status: proposed | accepted | superseded
- Context:
- Decision:
- Alternatives considered:
- Consequences:
- Rollback strategy:
```

## docs/memory/goal-log.md
Track every goal's state through the loop:
```
| Goal ID | Goal (one line) | Current stage | Failures | Status |
```

## Rules
- Read `decision-history.md` and `lessons-learned.md` at the START of every new goal — past lessons override your defaults.
- Never delete entries; supersede them.
- If memory files contradict current user instructions, the user wins — but note the contradiction in lessons-learned.
