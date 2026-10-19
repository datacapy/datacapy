# Developing DataCapy

This is a pnpm monorepo.

```bash
# Install dependencies
pnpm install

# Build and test everything
pnpm build
pnpm test

# Build or test one package (id, schema, om, server, migrate)
pnpm build:om
pnpm test:om

# Format and clean
pnpm format
pnpm clean
```

To consume a checkout from another workspace, see
[Use DataCapy from a git checkout](workspace-install.md).
