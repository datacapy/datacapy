import { readFileSync } from 'fs'
import { join } from 'path'

const schemaPackage = join(__dirname, '..', '..', 'schema')

describe('tags documentation', () => {
  it('mentions every exported tag type in tags.md', () => {
    const source = readFileSync(join(schemaPackage, 'src', 'tags', 'tags.ts'), 'utf8')
    const doc = readFileSync(join(schemaPackage, 'docs', 'tags.md'), 'utf8')
    const exported = [...source.matchAll(/^export type (\w+)/gm)].map((m) => m[1])

    expect(exported.length).toBeGreaterThan(0)
    const missing = exported.filter((name) => !new RegExp(`\`${name}[<\`]`).test(doc))
    expect(missing).toEqual([])
  })
})
