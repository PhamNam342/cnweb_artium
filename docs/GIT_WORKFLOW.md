
# Git Workflow

This project follows a simplified GitFlow workflow.

## Main branches

- `main`: production-ready code.
- `develop`: integration branch for upcoming features.

## Supporting branches

- `feature/<name>`: new features.
- `release/<version>`: release preparation.
- `hotfix/<name>`: urgent production fixes.

## Feature workflow

1. Create a feature branch from `develop`.
2. Implement the feature.
3. Run lint, typecheck, test and build.
4. Push the branch.
5. Open a Pull Request into `develop`.
6. Review and merge.

Example:

```bash
git switch develop
git pull origin develop
git switch -c feature/user-authentication
```

## Release workflow

1. Create a release branch from `develop`.
2. Update version and release notes.
3. Run the full quality checks.
4. Open a Pull Request into `main`.
5. Merge and tag the release.
6. Merge release changes back into `develop`.

## Commit convention

Use Conventional Commits.

Examples:

- `feat: add authentication`
- `fix: handle invalid token`
- `docs: update API documentation`
- `refactor: simplify user service`
- `test: add authentication tests`
- `chore: configure CI pipeline`

