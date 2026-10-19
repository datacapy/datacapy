# Use DataCapy from a git checkout

To use DataCapy straight from source in your own pnpm workspace, without installing it
from the npm registry, add the checkout as a submodule:

```bash
git submodule add https://github.com/datacapy/datacapy external/datacapy
```

List its packages in your `pnpm-workspace.yaml`:

```yaml
packages:
  - "package/*"
  - "external/datacapy/package/*"
```

Depend on them with the workspace protocol in your `package.json`:

```json
{
  "dependencies": {
    "@datacapy/om": "workspace:*",
    "mysql2": "^3.0.0"
  }
}
```

Then install and build once, because each package's `main` points at `dist/`:

```bash
pnpm install
pnpm --filter "@datacapy/*" build
```

Run `pnpm install` from your own workspace root only; it installs the checkout's
dependencies too, so there is no separate install inside `external/datacapy`.
Rebuild a package after changing its source.
