#!/usr/bin/env node
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { CONFIG_FILE, ConfigLoader, ResolvedConfig } from './config'
import { EndpointGenerator } from './endpoint-generator'
import { GeneratorError } from './errors'
import { CheckResult, SchemaGenerator } from './schema-generator'

/** What the CLI needs from a generator; both file generators provide it. */
interface Generator {
  write(): Promise<string[]>
  check(): Promise<CheckResult>
  report(): GeneratorError[] | Promise<GeneratorError[]>
}

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
      const generators = this.generators(config)
      if (argv.includes('--report')) return await this.report(generators)
      if (argv.includes('--check')) return await this.check(generators, cwd)
      for (const generator of generators) {
        for (const file of await generator.write()) {
          console.log(`wrote ${path.relative(cwd, file)}`)
        }
      }
      return 0
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      return 1
    }
  }

  private generators(config: ResolvedConfig): Generator[] {
    const generators: Generator[] = [new SchemaGenerator(config)]
    if (config.endpoints) generators.push(new EndpointGenerator(config))
    return generators
  }

  /** Lists every unsupported property and every endpoint problem; writes nothing. */
  private async report(generators: Generator[]): Promise<number> {
    const problems: GeneratorError[] = []
    for (const generator of generators) problems.push(...(await generator.report()))
    if (problems.length === 0) {
      console.log('No unsupported properties.')
      return 0
    }
    console.error(`${problems.length} unsupported:`)
    for (const problem of problems) console.error(`  ${problem.message}`)
    return 1
  }

  private async check(generators: Generator[], cwd: string): Promise<number> {
    const stale: string[] = []
    for (const generator of generators) stale.push(...(await generator.check()).stale)
    if (stale.length === 0) return 0
    console.error('Generated files are stale; run datacapy-gen:')
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
      const source = fs.readFileSync(file, 'utf8')
      const markers = [config.marker, config.endpoints?.marker].filter(Boolean)
      if (markers.some((marker) => source.includes(`@${marker}`))) {
        packages.set(dir, config)
      }
    }
    for (const config of packages.values()) {
      const written: string[] = []
      for (const generator of this.generators(config)) written.push(...(await generator.write()))
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
