import * as path from 'path'
import * as ts from 'typescript'

import { ResolvedConfig } from './config'
import { GeneratorError } from './errors'

/** The part of the config the host needs; each generator's resolved config satisfies it. */
export type SourceHostConfig = Pick<ResolvedConfig, 'tsconfig' | 'rootDir' | 'include' | 'marker'>

/** Program building, file selection and marker lookup shared by the generators. */
export class SourceHost {
  constructor(private readonly config: SourceHostConfig) {}

  createProgram(): ts.Program {
    const read = ts.readConfigFile(this.config.tsconfig, ts.sys.readFile)
    if (read.error) {
      throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'))
    }
    const parsed = ts.parseJsonConfigFileContent(
      read.config,
      ts.sys,
      path.dirname(this.config.tsconfig),
    )
    // `T | null` and optional keys only survive in the checker with strictNullChecks on
    return ts.createProgram(parsed.fileNames, {
      ...parsed.options,
      strictNullChecks: true,
      noEmit: true,
    })
  }

  isIncluded(fileName: string): boolean {
    if (fileName.endsWith('.d.ts') || fileName.includes('node_modules')) {
      return false
    }
    const relative = path.relative(this.config.rootDir, fileName).split(path.sep).join('/')
    return this.config.include.some((glob) => this.globToRegExp(glob).test(relative))
  }

  /** The JSDoc tag named by the config's marker, if the node carries it. */
  markerTag(node: ts.Node): ts.JSDocTag | undefined {
    return ts.getJSDocTags(node).find((t) => t.tagName.text === this.config.marker)
  }

  /** The text after the marker, or an empty string. */
  markerText(tag: ts.JSDocTag): string {
    return ts.getTextOfJSDocComment(tag.comment) ?? ''
  }

  /** Relative module specifier from one file to another, without the extension. */
  importPath(from: string, to: string): string {
    const relative = path
      .relative(path.dirname(from), to.replace(/\.tsx?$/, ''))
      .split(path.sep)
      .join('/')
    return relative.startsWith('.') ? relative : `./${relative}`
  }

  /** Runs `run`, keeping a `GeneratorError` instead of throwing it. */
  collect(into: GeneratorError[], run: () => void): void {
    try {
      run()
    } catch (error) {
      if (!(error instanceof GeneratorError)) throw error
      into.push(error)
    }
  }

  private globToRegExp(glob: string): RegExp {
    const source = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '\u0000')
      .replace(/\*/g, '[^/]*')
      .replace(/\u0000/g, '(?:.*/)?')
    return new RegExp(`^${source}$`)
  }
}
