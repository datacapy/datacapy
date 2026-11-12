import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { Cli } from './cli'

describe('Cli --staged', () => {
  let dir: string
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datacapy-staged-'))
    fs.mkdirSync(path.join(dir, 'src'))
    fs.writeFileSync(path.join(dir, 'datacapy.config.json'), '{}')
    fs.writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
    )
    fs.writeFileSync(
      path.join(dir, 'src/a.ts'),
      '/** @schema a */\nexport interface A { n: number }\n',
    )
    fs.writeFileSync(path.join(dir, 'src/plain.ts'), 'export const x = 1\n')
    git('init', '-q')
    git('add', 'src/a.ts', 'src/plain.ts')
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('regenerates and stages the schema for a staged marked file', async () => {
    expect(await new Cli().run(['--staged', 'src/a.ts'], dir)).toBe(0)
    expect(git('diff', '--cached', '--name-only')).toContain('src/a.schema.ts')
  })

  it('does nothing for staged files without the marker', async () => {
    expect(await new Cli().run(['--staged', 'src/plain.ts'], dir)).toBe(0)
    expect(fs.existsSync(path.join(dir, 'src/a.schema.ts'))).toBe(false)
  })
})

describe('Cli --report', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datacapy-report-'))
    fs.mkdirSync(path.join(dir, 'src'))
    fs.writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
    )
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
    jest.restoreAllMocks()
  })

  it('lists every unsupported property, across interfaces, and writes nothing', async () => {
    fs.writeFileSync(
      path.join(dir, 'src/a.ts'),
      '/** @schema a */\nexport interface A { ok: string; m: Map<string, string>; t: [string, number] }\n' +
        '/** @schema b colour=red */\nexport interface B { n: number }\n' +
        '/** @schema c */\nexport interface C { fine: number; bad: Set<string> }\n',
    )
    const errors: string[] = []
    jest.spyOn(console, 'error').mockImplementation((m: string) => void errors.push(m))
    expect(await new Cli().run(['--report'], dir)).toBe(1)
    expect(errors.join('\n')).toMatch(/4 unsupported/)
    expect(errors.join('\n')).toContain('A.m: unsupported type Map<string, string>')
    expect(errors.join('\n')).toContain('A.t: unsupported type')
    expect(errors.join('\n')).toContain('unknown @schema option "colour=red"')
    expect(errors.join('\n')).toContain('C.bad: unsupported type Set<string>')
    expect(fs.existsSync(path.join(dir, 'src/a.schema.ts'))).toBe(false)
  })

  it('exits 0 when everything is supported', async () => {
    fs.writeFileSync(
      path.join(dir, 'src/a.ts'),
      '/** @schema a */\nexport interface A { n: number }\n',
    )
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    expect(await new Cli().run(['--report'], dir)).toBe(0)
    expect(log).toHaveBeenCalledWith('No unsupported properties.')
  })
})
