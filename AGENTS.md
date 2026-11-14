# Repository working instructions

- Read README.md, CONTRIBUTING.md and docs/safety.md before implementation.
- Use a separate Issue-linked branch from develop. Open draft PRs targeting develop for ordinary changes.
- Keep scope small; preserve unrelated changes and never overwrite another worker's worktree.
- Use synthetic fixtures only. Never add pupil records, private school/interview material, credentials or private local paths to tracked files, Issues, PRs or logs.
- External AI, file uploads, storage, authentication and payments are not implemented. Do not introduce them implicitly.
- Run npm run check and npm run build; disclose checks not run. Review npm audit results without force-upgrading dependencies blindly.
- A public repository is not an open-source license. Do not add a license, publish a release, deploy, change account/security permissions or merge without task-specific authorization.
- For authorized releases, preserve branch ancestry: feature PRs squash into develop; release PRs merge develop into main with a merge commit. Sync hotfixes back to develop.
- Keep secrets server-side if future work explicitly introduces them. Never use NEXT_PUBLIC_ for credentials.
