#!/usr/bin/env node
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { CONFIG_FILE, ConfigLoader, ResolvedConfig } from './config'
import { SchemaGenerator } from './schema-generator'

/**
 * Command line entry:
 *
 *   datacapy-gen [--check | --report] [--config <file>]
 *   datacapy-gen --staged <file>...   (for lint-staged: regenerate and stage)
 */
export class Cli {
  async run(argv: string[], cwd: string): Promise<number> {
    try {
      if (argv.includes('--staged')) {
        return await this.staged(
          argv.filter((a) => a !== '--staged'),
          cwd,
        )
      }
      const at = argv.indexOf('--config')
      const config = new ConfigLoader().load(cwd, at >= 0 ? argv[at + 1] : undefined)
      const generator = new SchemaGenerator(config)
      if (argv.includes('--report')) return this.report(generator)
      if (argv.includes('--check')) return await this.check(generator, cwd)
      for (const file of await generator.write()) {
        console.log(`wrote ${path.relative(cwd, file)}`)
      }
      return 0
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      return 1
    }
  }

  /** Lists every unsupported property across all marked interfaces; writes nothing. */
  private report(generator: SchemaGenerator): number {
    const problems = generator.report()
    if (problems.length === 0) {
      console.log('No unsupported properties.')
      return 0
    }
    console.error(`${problems.length} unsupported:`)
    for (const problem of problems) console.error(`  ${problem.message}`)
    return 1
  }

  private async check(generator: SchemaGenerator, cwd: string): Promise<number> {
    const { stale } = await generator.check()
    if (stale.length === 0) return 0
    console.error('Generated schemas are stale; run datacapy-gen:')
    for (const file of stale) console.error(`  ${path.relative(cwd, file)}`)
    return 1
  }

  /** Regenerates every package that has a staged file carrying the marker, then stages the output. */
  private async staged(files: string[], cwd: string): Promise<number> {
    const packages = new Map<string, ResolvedConfig>()
    for (const file of files.map((f) => path.resolve(cwd, f))) {
      const dir = this.configDir(path.dirname(file))
      if (!dir || packages.has(dir)) continue
      const config = new ConfigLoader().load(dir)
      if (fs.readFileSync(file, 'utf8').includes(`@${config.marker}`)) {
        packages.set(dir, config)
      }
    }
    for (const config of packages.values()) {
      const written = await new SchemaGenerator(config).write()
      if (written.length > 0) {
        execFileSync('git', ['add', '--', ...written], { cwd: config.rootDir })
      }
    }
    return 0
  }

  private configDir(from: string): string | null {
    for (let dir = from; ; dir = path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, CONFIG_FILE))) return dir
      if (path.dirname(dir) === dir) return null
    }
  }
}

if (require.main === module) {
  new Cli().run(process.argv.slice(2), process.cwd()).then((code) => {
    process.exitCode = code
  })
}
