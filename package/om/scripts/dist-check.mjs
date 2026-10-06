import { readFileSync } from 'node:fs'

const file = new URL('../dist/repo/index.d.ts', import.meta.url)
if (!/from '\.\/repo(\.js)?'/.test(readFileSync(file, 'utf8'))) {
  console.error(
    'dist/repo/index.d.ts does not re-export from ./repo: tsc-alias has rewritten the path (known bug in tsc-alias 1.9.7, keep it pinned at 1.9.1).'
  )
  process.exit(1)
}
