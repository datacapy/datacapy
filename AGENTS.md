# AGENT.md

### Code Style

- This codebase is written in an OOP style. Prefer methods on the relevant class over standalone/module-level helper functions, even for small utilities (e.g. a config-normalising helper used only within one class should be a private method on that class, not a free function above it).

### Naming Conventions

Timestamp fields use the `xxxAt` suffix (e.g. `createdAt`, `updatedAt`, `deletedAt`), never the bare word alone. `mzen-om` has no auto-populating hook for document lifecycle timestamps: schemas declare their own `createdAt`/`updatedAt` with a schema default (e.g. `createdAt: sb.date().default('now')`). Soft-delete support (`softDelete: true` on a repo) is hardcoded in `repo.ts` to use the field name `deletedAt`; schemas enabling it must declare `deletedAt: sb.date().default(null)`.

### Committing Changes

- `pnpm commit` - Interactive guided commit prompt (commitizen). Prompts for type, scope, and summary. `feat` and `fix` get additional prompts for body, breaking changes, and issue references.
- Commit scopes are predefined (custom scopes disallowed). Add new scopes to `.cz-config.js` as needed.
- Both source code and commit messages are spell-checked via cspell (en-GB). Staged files are checked by a `pre-commit` hook; commit messages by a `commit-msg` hook. Add unrecognised project terms to `.cspell-words.txt`. Bypass with `git commit --no-verify` if needed.
- **Spell-check suppressions**: prefer inline ignores over adding to `.cspell-words.txt`:
  - File-specific terms: use `// cspell:ignore term` inline or at the top of the file
  - Whole file (e.g. generated files): use `// cspell:disable` at the top
  - Genuinely project-wide terms only: add to `.cspell-words.txt`
