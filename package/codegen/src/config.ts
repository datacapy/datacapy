import * as fs from 'fs'
import * as path from 'path'

/** Contents of a package's `datacapy.config.json`. Every path is relative to the file. */
export interface CodegenConfig {
  /** tsconfig that describes the sources. Default `tsconfig.json`. */
  tsconfig?: string
  /** Globs (`*`, `**`) of source files to scan, relative to the config. Default `src/**\/*.ts`. */
  include?: string[]
  /** Write generated files here, mirroring the source layout. Default: beside each source file. */
  outDir?: string
  /** JSDoc tag that marks an interface. Default `schema`. */
  marker?: string
  /** Module that exports `Schema`, `SchemaBuilder` and the `AssertSchema` type. Default `@datacapy/schema`. */
  schemaModule?: string
  /**
   * Module that exports `validators`, `filters` and/or `initialisers` objects of functions, looked up by the
   * names in `Validate<Name>`, `Filter<Name>`, `InitFn<Name>` and `DefaultFn<Name>` tags. Required when those tags are used.
   */
  registry?: string
  /** Emit `.strict()` on every schema unless the interface says `no-strict`. Default false. */
  strict?: boolean
  /**
   * Collection constructor name by schema name, emitted as `.constructCollection('Name')`
   * (after `.construct(...)`, before `.strict()`). Kept here, not in the marker, so the marker
   * grammar stays `construct=` and `strict`.
   */
  collections?: Record<string, string>
  /**
   * Where to import a schema class and its interface from, by interface name, instead of the
   * sibling files. For schemas that live in another package.
   */
  importMap?: Record<string, { schema: string; type: string }>
}

export interface ResolvedConfig {
  rootDir: string
  tsconfig: string
  include: string[]
  outDir: string | null
  marker: string
  schemaModule: string
  registry: string | null
  strict: boolean
  collections: Record<string, string>
  importMap: Record<string, { schema: string; type: string }>
}

export const CONFIG_FILE = 'datacapy.config.json'

/** Reads and resolves the config of one consuming package. */
export class ConfigLoader {
  /** Loads `datacapy.config.json` from `dir`, or the file at `configPath`. */
  load(dir: string, configPath?: string): ResolvedConfig {
    const file = configPath ? path.resolve(dir, configPath) : path.join(dir, CONFIG_FILE)
    const raw: CodegenConfig = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
    return this.resolve(path.dirname(file), raw)
  }

  resolve(rootDir: string, raw: CodegenConfig): ResolvedConfig {
    return {
      rootDir,
      tsconfig: path.resolve(rootDir, raw.tsconfig ?? 'tsconfig.json'),
      include: raw.include ?? ['src/**/*.ts'],
      outDir: raw.outDir ? path.resolve(rootDir, raw.outDir) : null,
      marker: raw.marker ?? 'schema',
      schemaModule: raw.schemaModule ?? '@datacapy/schema',
      registry: raw.registry ? path.resolve(rootDir, raw.registry) : null,
      strict: raw.strict ?? false,
      collections: raw.collections ?? {},
      importMap: raw.importMap ?? {},
    }
  }
}
