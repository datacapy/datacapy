import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

import { BuilderEmitter, EmitContext } from './builder-emitter'
import { ResolvedConfig } from './config'
import { GeneratorError } from './errors'
import { SchemaTarget } from './field-model'
import { Formatter } from './formatter'
import { TypeAnalyser } from './type-analyser'

export interface GeneratedFile {
  /** Absolute path of the schema file. */
  path: string
  content: string
}

export interface CheckResult {
  /** Files whose checked-in content differs from the generated content, or that are missing. */
  stale: string[]
}

/** An interface, or a class with a name, that carries the marker. */
type ModelDeclaration = (ts.InterfaceDeclaration | ts.ClassDeclaration) & {
  name: ts.Identifier
}

/** What the `@schema` marker says: `name [construct=Name] [strict|no-strict]`. */
interface MarkerOptions {
  schemaName: string
  construct: string | null
  /** Per-interface override; null defers to the config default. */
  strict: boolean | null
}

interface MarkedInterface {
  node: ModelDeclaration
  schemaName: string
  construct: string | null
  strict: boolean
}

/** Finds `@schema` interfaces and writes the schema module for each source file. */
export class SchemaGenerator {
  private readonly emitter = new BuilderEmitter()
  private readonly formatter: Formatter

  constructor(private readonly config: ResolvedConfig) {
    this.formatter = new Formatter(config.rootDir)
  }

  /** Generates every schema file in memory. */
  async generate(): Promise<GeneratedFile[]> {
    const program = this.createProgram()
    const checker = program.getTypeChecker()
    const files: GeneratedFile[] = []

    for (const source of program.getSourceFiles()) {
      if (!this.isIncluded(source.fileName)) continue
      const marked = this.findMarked(source)
      if (marked.length === 0) continue
      const out = this.outputPath(source.fileName)
      const analyser = new TypeAnalyser(checker, (type) => this.resolveRef(type, source.fileName))
      files.push({
        path: out,
        content: await this.formatter.format(
          out,
          this.render(source.fileName, marked, checker, analyser),
        ),
      })
    }
    return files.sort((a, b) => a.path.localeCompare(b.path))
  }

  /**
   * Tries every marked interface and returns every problem instead of stopping at the first.
   * Writes nothing; used to size the work before adopting the generator.
   */
  report(): GeneratorError[] {
    const program = this.createProgram()
    const checker = program.getTypeChecker()
    const problems: GeneratorError[] = []
    for (const source of program.getSourceFiles()) {
      if (!this.isIncluded(source.fileName)) continue
      const analyser = new TypeAnalyser(checker, (type) => this.resolveRef(type, source.fileName))
      for (const statement of source.statements) {
        if (!this.isModelDeclaration(statement)) continue
        if (!ts.getJSDocTags(statement).some((t) => t.tagName.text === this.config.marker)) {
          continue
        }
        this.collect(problems, () => this.reportInterface(statement, checker, analyser, problems))
      }
    }
    return problems
  }

  private reportInterface(
    node: ModelDeclaration,
    checker: ts.TypeChecker,
    analyser: TypeAnalyser,
    problems: GeneratorError[],
  ): void {
    const tag = ts.getJSDocTags(node).find((t) => t.tagName.text === this.config.marker)!
    this.parseMarker(node, ts.getTextOfJSDocComment(tag.comment) ?? '')
    const ctx = new EmitContext(this.config.registry !== null)
    const type = checker.getTypeAtLocation(node)
    const valueType = analyser.mapValueType(type)
    if (valueType) {
      this.collect(problems, () => {
        const iface = node.name.text
        this.emitter.emit(analyser.mapValue(valueType, `${iface}[]`), `${iface}[]`, ctx)
      })
      return
    }
    for (const prop of this.fieldsOf(checker, node, type)) {
      const fieldPath = `${node.name.text}.${prop.name}`
      this.collect(problems, () => {
        this.emitter.emit(analyser.analyseProperty(prop, fieldPath), fieldPath, ctx)
      })
    }
  }

  private collect(into: GeneratorError[], run: () => void): void {
    try {
      run()
    } catch (error) {
      if (!(error instanceof GeneratorError)) throw error
      into.push(error)
    }
  }

  /** Writes the generated files, returning their paths. */
  async write(): Promise<string[]> {
    const files = await this.generate()
    for (const file of files) {
      fs.mkdirSync(path.dirname(file.path), { recursive: true })
      fs.writeFileSync(file.path, file.content)
    }
    return files.map((f) => f.path)
  }

  /** Compares generated content with the files on disk without writing. */
  async check(): Promise<CheckResult> {
    const stale = (await this.generate())
      .filter(
        (file) => !fs.existsSync(file.path) || fs.readFileSync(file.path, 'utf8') !== file.content,
      )
      .map((file) => file.path)
    return { stale }
  }

  private createProgram(): ts.Program {
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

  private isIncluded(fileName: string): boolean {
    if (fileName.endsWith('.d.ts') || fileName.includes('node_modules')) {
      return false
    }
    const relative = path.relative(this.config.rootDir, fileName).split(path.sep).join('/')
    return this.config.include.some((glob) => this.globToRegExp(glob).test(relative))
  }

  private globToRegExp(glob: string): RegExp {
    const source = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '\u0000')
      .replace(/\*/g, '[^/]*')
      .replace(/\u0000/g, '(?:.*/)?')
    return new RegExp(`^${source}$`)
  }

  private findMarked(source: ts.SourceFile): MarkedInterface[] {
    const found: MarkedInterface[] = []
    for (const statement of source.statements) {
      if (!this.isModelDeclaration(statement)) continue
      const tag = ts.getJSDocTags(statement).find((t) => t.tagName.text === this.config.marker)
      if (!tag) continue
      const options = this.parseMarker(statement, ts.getTextOfJSDocComment(tag.comment) ?? '')
      found.push({
        node: statement,
        schemaName: options.schemaName,
        construct: this.constructFor(statement, options),
        strict: options.strict ?? this.config.strict,
      })
    }
    return found
  }

  private outputPath(sourceFile: string): string {
    const base = sourceFile.replace(/\.tsx?$/, '.schema.ts')
    if (!this.config.outDir) return base
    return path.join(this.config.outDir, path.relative(this.config.rootDir, base))
  }

  private render(
    sourceFile: string,
    marked: MarkedInterface[],
    checker: ts.TypeChecker,
    analyser: TypeAnalyser,
  ): string {
    const ctx = new EmitContext(this.config.registry !== null)
    const out = this.outputPath(sourceFile)
    const importPath = this.importPath(out, sourceFile)
    const interfaces = marked.map((m) => m.node.name.text)
    const body = marked.map((m) => this.renderSchema(m, checker, analyser, ctx)).join('\n')

    return [
      `// Generated from ${path.basename(sourceFile)} by datacapy-gen. Do not edit.`,
      '// cspell:disable',
      `import { Schema, SchemaBuilder as sb } from '${this.config.schemaModule}'`,
      `import type { AssertSchema${ctx.refs.length > 0 ? ', SpecFor' : ''} } from '${this.config.schemaModule}'`,
      `import type { ${interfaces.join(', ')} } from '${importPath}'`,
      ...this.extraImports(out, ctx),
      '',
      body,
    ].join('\n')
  }

  private renderSchema(
    marked: MarkedInterface,
    checker: ts.TypeChecker,
    analyser: TypeAnalyser,
    ctx: EmitContext,
  ): string {
    const iface = marked.node.name.text
    const className = `Schema${this.pascalCase(marked.schemaName)}`
    const type = checker.getTypeAtLocation(marked.node)
    const mapValue = analyser.mapValueType(type)
    if (mapValue) {
      return this.renderMapSchema(marked, type, mapValue, analyser, ctx, className)
    }
    const props = this.fieldsOf(checker, marked.node, type)
    const fields = props
      .map((prop) => {
        const fieldPath = `${iface}.${prop.name}`
        const model = analyser.analyseProperty(prop, fieldPath)
        return `    ${this.propertyKey(prop.name)}: ${this.emitter.emit(model, fieldPath, ctx)},`
      })
      .join('\n')

    return [
      `export class ${className} extends Schema.from(`,
      `  ${this.schemaHead(marked)}.shape({`,
      fields,
      '  }),',
      ') {}',
      '',
      `const _check${className}: AssertSchema<${className}, ${this.assertTarget(marked, props)}> = true`,
      `void _check${className}`,
      '',
    ].join('\n')
  }

  /** An interface that is only a string index signature: `matchAll` with no `shape`. */
  private renderMapSchema(
    marked: MarkedInterface,
    type: ts.Type,
    valueType: ts.Type,
    analyser: TypeAnalyser,
    ctx: EmitContext,
    className: string,
  ): string {
    const iface = marked.node.name.text
    if (type.getProperties().length > 0) {
      throw new GeneratorError(
        iface,
        'an index signature mixed with named properties is not supported',
      )
    }
    const value = this.emitter.emit(analyser.mapValue(valueType, `${iface}[]`), `${iface}[]`, ctx)
    return [
      `export class ${className} extends Schema.from(`,
      `  ${this.schemaHead(marked)}.matchAll(${value}),`,
      ') {}',
      '',
      `const _check${className}: AssertSchema<${className}, ${this.assertTarget(marked, [])}> = true`,
      `void _check${className}`,
      '',
    ].join('\n')
  }

  /**
   * A class also has methods, accessors and private members that are not schema fields, so it is
   * checked only on the fields that were generated.
   */
  private assertTarget(marked: MarkedInterface, props: ts.Symbol[]): string {
    const name = marked.node.name.text
    if (!ts.isClassDeclaration(marked.node)) return name
    const keys = props.map((prop) => `'${prop.name}'`).join(' | ')
    return props.length > 0 ? `Pick<${name}, ${keys}>` : name
  }

  private schemaHead(marked: MarkedInterface): string {
    const construct = marked.construct ? `.construct('${marked.construct}')` : ''
    const collectionName = this.config.collections[marked.schemaName]
    const collection = collectionName ? `.constructCollection('${collectionName}')` : ''
    const strict = marked.strict ? '.strict()' : ''
    return `sb.schema('${marked.schemaName}')${construct}${collection}${strict}`
  }

  private extraImports(out: string, ctx: EmitContext): string[] {
    const lines: string[] = []
    const byModule = new Map<string, Set<string>>()
    for (const ref of ctx.refs) {
      if (ref.module === null) continue
      const names = byModule.get(ref.module) ?? new Set<string>()
      names.add(ref.className)
      byModule.set(ref.module, names)
    }
    for (const [module, names] of byModule) {
      lines.push(`import { ${[...names].sort().join(', ')} } from '${module}'`)
    }
    const types = new Map<string, Set<string>>()
    for (const ref of ctx.refs) {
      if (ref.interfaceModule === null) continue
      const names = types.get(ref.interfaceModule) ?? new Set<string>()
      names.add(ref.interfaceName)
      types.set(ref.interfaceModule, names)
    }
    for (const [module, names] of types) {
      lines.push(`import type { ${[...names].sort().join(', ')} } from '${module}'`)
    }
    if (ctx.registry.size > 0 && this.config.registry) {
      const names = [...ctx.registry].sort().join(', ')
      lines.push(`import { ${names} } from '${this.importPath(out, this.config.registry)}'`)
    }
    return lines
  }

  /** The schema generated for a marked interface, as seen from `fromSource`. */
  private resolveRef(type: ts.Type, fromSource: string): SchemaTarget | undefined {
    const declaration = type.symbol?.declarations?.find((d): d is ModelDeclaration =>
      this.isModelDeclaration(d),
    )
    if (!declaration) return undefined
    const schemaName = this.markerName(declaration)
    if (!schemaName) return undefined
    const className = `Schema${this.pascalCase(schemaName)}`
    const declaredIn = declaration.getSourceFile().fileName
    const interfaceName = declaration.name.text
    if (declaredIn === fromSource) {
      return { className, interfaceName, module: null, interfaceModule: null }
    }
    const mapped = this.config.importMap[interfaceName]
    if (mapped) {
      return {
        className,
        interfaceName,
        module: mapped.schema,
        interfaceModule: mapped.type,
      }
    }
    return {
      className,
      interfaceName,
      interfaceModule: this.importPath(this.outputPath(fromSource), declaredIn),
      module: this.importPath(this.outputPath(fromSource), this.outputPath(declaredIn)),
    }
  }

  /** A class is its own constructor, so `construct` is its name; an interface says so in the marker. */
  private constructFor(node: ModelDeclaration, options: MarkerOptions): string | null {
    if (!ts.isClassDeclaration(node)) return options.construct
    if (options.construct && options.construct !== node.name.text) {
      throw new GeneratorError(
        node.name.text,
        `construct=${options.construct} must match the class name; omit it on a class`,
      )
    }
    return node.name.text
  }

  private isModelDeclaration(node: ts.Node): node is ModelDeclaration {
    return (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) && !!node.name
  }

  /** The properties that become schema fields: every interface member, a class's data fields only. */
  private fieldsOf(checker: ts.TypeChecker, node: ModelDeclaration, type: ts.Type): ts.Symbol[] {
    const props = checker.getPropertiesOfType(type)
    if (!ts.isClassDeclaration(node)) return props
    return props.filter((prop) => {
      if (!(prop.flags & ts.SymbolFlags.Property)) return false
      const flags = ts.getCombinedModifierFlags(prop.valueDeclaration!)
      return !(flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected))
    })
  }

  private markerName(node: ModelDeclaration): string | undefined {
    const tag = ts.getJSDocTags(node).find((t) => t.tagName.text === this.config.marker)
    if (!tag) return undefined
    return this.parseMarker(node, ts.getTextOfJSDocComment(tag.comment) ?? '').schemaName
  }

  private parseMarker(node: ModelDeclaration, text: string): MarkerOptions {
    const interfaceName = node.name.text
    const [schemaName, ...words] = text.trim().split(/\s+/).filter(Boolean)
    if (
      !schemaName ||
      schemaName.includes('=') ||
      schemaName === 'strict' ||
      schemaName === 'no-strict'
    ) {
      throw new GeneratorError(
        interfaceName,
        `@${this.config.marker} needs a schema name, e.g. @${this.config.marker} note`,
      )
    }
    const options: MarkerOptions = { schemaName, construct: null, strict: null }
    for (const word of words) {
      const construct = /^construct=(.*)$/.exec(word)
      if (construct) {
        if (!/^[A-Za-z_$][\w$]*$/.test(construct[1])) {
          throw new GeneratorError(
            interfaceName,
            `construct needs a class name, e.g. construct=Note (got "${word}")`,
          )
        }
        options.construct = construct[1]
      } else if (word === 'strict' || word === 'no-strict') {
        options.strict = word === 'strict'
      } else {
        throw new GeneratorError(
          interfaceName,
          `unknown @${this.config.marker} option "${word}"; expected construct=<Name>, strict or no-strict`,
        )
      }
    }
    return options
  }

  private importPath(from: string, to: string): string {
    const relative = path
      .relative(path.dirname(from), to.replace(/\.tsx?$/, ''))
      .split(path.sep)
      .join('/')
    return relative.startsWith('.') ? relative : `./${relative}`
  }

  private propertyKey(name: string): string {
    return /^[A-Za-z_$][\w$]*$/.test(name) ? name : `'${name}'`
  }

  private pascalCase(name: string): string {
    return name
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join('')
  }
}
