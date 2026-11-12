import { spawn } from 'child_process'
import * as path from 'path'

/**
 * Formats generated source with the consumer's own Prettier and config, so a
 * pre-commit formatter never makes a checked-in file look stale. Without
 * Prettier installed the source is returned as generated.
 */
export class Formatter {
  private binary: string | null | undefined

  constructor(private readonly rootDir: string) {}

  async format(file: string, source: string): Promise<string> {
    const binary = this.find()
    if (!binary) return source
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [binary, '--stdin-filepath', file], {
        cwd: this.rootDir,
      })
      let out = ''
      let err = ''
      child.stdout.on('data', (chunk) => (out += chunk))
      child.stderr.on('data', (chunk) => (err += chunk))
      child.on('close', (code) =>
        code === 0 ? resolve(out) : reject(new Error(`prettier failed for ${file}: ${err}`)),
      )
      child.stdin.end(source)
    })
  }

  private find(): string | null {
    if (this.binary !== undefined) return this.binary
    try {
      const entry = require.resolve('prettier/package.json', { paths: [this.rootDir] })
      this.binary = path.join(path.dirname(entry), 'bin', 'prettier.cjs')
    } catch {
      this.binary = null
    }
    return this.binary
  }
}
