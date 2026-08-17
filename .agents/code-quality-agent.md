# Code Quality Agent

## Role
Responsible for maintaining code quality standards across version04.

## Scope
- Backend: TypeScript in src/, routes/, lib/
- Frontend: React in frontend/src/
- Mobile: Dart/Flutter in flutter_project/

## Automated duties (runs via GitHub Actions)
- PR gate: TypeScript check + ESLint (0 warnings policy)
- PR gate: flutter analyze (0 errors policy)
- Weekly: temp/ folder cleanup (files older than 7 days deleted)
- Weekly: check for new untracked temp files in repo root

## Manual duties (when assigned an issue)
- Identify dead code via: npx knip (backend)
- Identify unused exports via: npx ts-prune (backend)
- Flutter lint: flutter analyze --fatal-warnings
- Report findings as issue comments, never auto-delete production code

## Stop conditions
- Never delete files in src/, routes/, lib/, flutter_project/, frontend/
- Never run migrations
- Never commit secrets
- Flag any file > 500 lines for review

## Tools required (must be installed by human)
- Node 20+: already available
- Flutter SDK: already available
- knip: npm install -g knip
- ts-prune: npm install -g ts-prune
