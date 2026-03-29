# AGENT.md

### Committing Changes

- `pnpm commit` - Interactive guided commit prompt (commitizen). Prompts for type, scope, and summary. `feat` and `fix` get additional prompts for body, breaking changes, and issue references.
- Commit scopes are predefined (custom scopes disallowed). Add new scopes to `.cz-config.js` as needed.
- Commits are spell-checked automatically via a `commit-msg` hook (cspell, en-GB). Add unrecognised project terms to `.cspell-words.txt`. Bypass with `git commit --no-verify` if needed.
