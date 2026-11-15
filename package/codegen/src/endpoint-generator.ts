import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

import { ResolvedConfig, ResolvedEndpointsConfig } from './config'
import { EndpointEmitter } from './endpoint-emitter'
import {
  AclRule,
  DataEntry,
  DataSource,
  DataType,
  ErrorResponse,
  RouteModel,
  ServiceModel,
} from './endpoint-model'
import { GeneratorError } from './errors'
import { TagValue } from './field-model'
import { Formatter } from './formatter'
import { SourceHost } from './source-host'
import { TypeAnalyser } from './type-analyser'
import { CheckResult, GeneratedFile } from './schema-generator'

const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
const SOURCE_TAGS: DataSource[] = [
  'param',
  'query',
  'body',
  'header',
  'config',
  'request',
  'container',
]
const SKIPPED_TAGS = ['aclContext', 'aclConditions']
const KNOWN_TAGS = [...SOURCE_TAGS, ...SKIPPED_TAGS, 'default']
const NAME = /^[A-Za-z_$][\w$]*$/

/** Finds `@endpoints` service classes and writes the endpoint config module for each source file. */
export class EndpointGenerator {
  private readonly settings: ResolvedEndpointsConfig
  private readonly host: SourceHost
  private readonly formatter: Formatter
  private readonly emitter: EndpointEmitter

  constructor(private readonly config: ResolvedConfig) {
    if (!config.endpoints) throw new Error('the config has no "endpoints" section')
    this.settings = config.endpoints
    this.host = new SourceHost({
      tsconfig: config.tsconfig,
      rootDir: config.rootDir,
      include: this.settings.include,
      marker: this.settings.marker,
    })
    this.formatter = new Formatter(config.rootDir)
    this.emitter = new EndpointEmitter(this.settings.serverModule)
  }

  /** Generates every endpoint file in memory; throws one error listing every problem. */
  async generate(): Promise<GeneratedFile[]> {
    const { files, problems } = await this.run()
    if (problems.length > 0) {
      throw new Error(problems.map((problem) => problem.message).join('\n'))
    }
    return files
  }

  /** Every problem across all marked classes; writes nothing. */
  async report(): Promise<GeneratorError[]> {
    return (await this.run()).problems
  }

  async write(): Promise<string[]> {
    const files = await this.generate()
    for (const file of files) {
      fs.mkdirSync(path.dirname(file.path), { recursive: true })
      fs.writeFileSync(file.path, file.content)
    }
    return files.map((f) => f.path)
  }

  async check(): Promise<CheckResult> {
    const stale = (await this.generate())
      .filter(
        (file) => !fs.existsSync(file.path) || fs.readFileSync(file.path, 'utf8') !== file.content,
      )
      .map((file) => file.path)
    return { stale }
  }

  private async run(): Promise<{ files: GeneratedFile[]; problems: GeneratorError[] }> {
    const program = this.host.createProgram()
    const checker = program.getTypeChecker()
    const analyser = new TypeAnalyser(checker, () => undefined)
    const problems: GeneratorError[] = []
    const files: GeneratedFile[] = []

    for (const source of program.getSourceFiles()) {
      if (!this.host.isIncluded(source.fileName)) continue
      const services: ServiceModel[] = []
      for (const statement of source.statements) {
        if (!ts.isClassDeclaration(statement) || !statement.name) continue
        if (!this.host.markerTag(statement)) continue
        this.host.collect(problems, () =>
          services.push(this.readService(statement as ClassWithName, checker, analyser, problems)),
        )
      }
      if (services.length === 0) continue
      const out = this.outputPath(source.fileName)
      const content = this.emitter.emit(path.basename(source.fileName), services)
      files.push({ path: out, content: await this.formatter.format(out, content) })
    }
    return { files: files.sort((a, b) => a.path.localeCompare(b.path)), problems }
  }

  private readService(
    node: ClassWithName,
    checker: ts.TypeChecker,
    analyser: TypeAnalyser,
    problems: GeneratorError[],
  ): ServiceModel {
    const className = node.name.text
    const marker = this.parseMarker(className, this.host.markerText(this.host.markerTag(node)!))
    const routes: RouteModel[] = []
    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member)) continue
      const tags = ts.getJSDocTags(member)
      if (!tags.some((t) => t.tagName.text === 'route')) continue
      this.host.collect(problems, () =>
        routes.push(this.readRoute(className, member, tags, checker, analyser)),
      )
    }
    this.host.collect(problems, () => this.checkRoutes(className, marker.path, routes, problems))
    return { className, serviceName: marker.serviceName, path: marker.path, routes }
  }

  private parseMarker(
    className: string,
    text: string,
  ): { serviceName: string; path: string | null } {
    const [serviceName, ...words] = text.trim().split(/\s+/).filter(Boolean)
    const marker = this.settings.marker
    if (!serviceName || serviceName.includes('=') || !NAME.test(serviceName)) {
      throw new GeneratorError(
        className,
        `@${marker} needs a service name, e.g. @${marker} surveyNote`,
      )
    }
    let servicePath: string | null = null
    for (const word of words) {
      const match = /^path=(\/\S*)?$/.exec(word)
      if (!match) {
        throw new GeneratorError(
          className,
          `unknown @${marker} option "${word}"; expected path=/<prefix> or path=`,
        )
      }
      servicePath = match[1] ?? ''
    }
    return { serviceName, path: servicePath }
  }

  private readRoute(
    className: string,
    method: ts.MethodDeclaration,
    tags: readonly ts.JSDocTag[],
    checker: ts.TypeChecker,
    analyser: TypeAnalyser,
  ): RouteModel {
    const methodName = method.name.getText()
    const where = `${className}.${methodName}`
    if (
      method.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword,
      )
    ) {
      throw new GeneratorError(where, '@route needs a public method')
    }
    const text = (name: string): string[] =>
      tags
        .filter((t) => t.tagName.text === name)
        .map((t) => (ts.getTextOfJSDocComment(t.comment) ?? '').trim())

    const routeTags = text('route')
    if (routeTags.length > 1) throw new GeneratorError(where, 'only one @route is allowed')
    const [verbText, ...pathWords] = routeTags[0].split(/\s+/).filter(Boolean)
    const verbs = (verbText ?? '').toLowerCase().split(',').filter(Boolean)
    if (verbs.length === 0 || verbs.some((v) => !VERBS.includes(v))) {
      throw new GeneratorError(
        where,
        `@route needs verbs from ${VERBS.join(', ')}, e.g. @route get /:id`,
      )
    }
    if (pathWords.length > 1 || (pathWords[0] && !pathWords[0].startsWith('/'))) {
      throw new GeneratorError(where, `@route path must be one segment string starting with "/"`)
    }

    const enables = text('enable')
    if (enables.some((e) => e !== 'false')) {
      throw new GeneratorError(where, '@enable only accepts "false"')
    }

    const rules = this.readAcl(where, text('acl'))
    if (rules.length === 0 && this.settings.requireAcl) {
      throw new GeneratorError(where, '@route needs an @acl, e.g. @acl projectAdmin or @acl public')
    }

    return {
      key: methodName,
      method: methodName,
      verbs,
      path: pathWords[0] ?? null,
      data: this.readData(where, method, checker, analyser),
      rules,
      enable: enables.length === 0,
      errors: this.readErrors(where, text('error')),
    }
  }

  private readAcl(where: string, lines: string[]): AclRule[] {
    const rules: AclRule[] = []
    for (const line of lines) {
      const words = line.split(/\s+/).filter(Boolean)
      const deny = words.includes('allow=false')
      const roles = words
        .filter((w) => w !== 'allow=false')
        .flatMap((w) => w.split(','))
        .filter(Boolean)
      if (roles.length === 0) {
        throw new GeneratorError(where, '@acl needs a role, e.g. @acl projectAdmin')
      }
      for (const role of roles) {
        if (!NAME.test(role)) throw new GeneratorError(where, `@acl role "${role}" is not a name`)
        rules.push({ allow: !deny, role: role === 'public' ? 'all' : role })
      }
    }
    return rules
  }

  private readErrors(where: string, lines: string[]): ErrorResponse[] {
    return lines.map((line) => {
      const match = /^([A-Za-z_$][\w$]*)\s+(\d{3})$/.exec(line)
      if (!match) {
        throw new GeneratorError(
          where,
          `@error needs a class and status, e.g. @error PlanLimitError 402`,
        )
      }
      return { errorClass: match[1], code: Number(match[2]) }
    })
  }

  private readData(
    where: string,
    method: ts.MethodDeclaration,
    checker: ts.TypeChecker,
    analyser: TypeAnalyser,
  ): DataEntry[] {
    const [param] = method.parameters
    if (!param) return []
    if (!param.type) {
      throw new GeneratorError(where, 'the params object needs a type annotation')
    }
    const type = checker.getTypeFromTypeNode(param.type)
    if (!(type.flags & ts.TypeFlags.Object) || checker.isArrayType(type)) {
      throw new GeneratorError(where, 'the first parameter must be a params object type')
    }
    const entries: DataEntry[] = []
    for (const prop of checker.getPropertiesOfType(type)) {
      const entry = this.readEntry(`${where}.${prop.name}`, prop, checker, analyser)
      if (entry) entries.push(entry)
    }
    return entries
  }

  private readEntry(
    at: string,
    prop: ts.Symbol,
    checker: ts.TypeChecker,
    analyser: TypeAnalyser,
  ): DataEntry | null {
    const propType = checker.getTypeOfSymbol(prop)
    if (propType.flags & ts.TypeFlags.Any) {
      throw new GeneratorError(
        at,
        'type resolves to any (an unresolved import or an explicit any), so its tags would be lost; give it a concrete type',
      )
    }
    const { bases, tags } = analyser.split(propType, at)
    for (const name of tags.keys()) {
      if (!KNOWN_TAGS.includes(name)) throw new GeneratorError(at, `unknown tag "${name}"`)
    }
    if (SKIPPED_TAGS.some((name) => tags.has(name))) return null
    const sources = SOURCE_TAGS.filter((name) => tags.has(name))
    if (sources.length > 1) {
      throw new GeneratorError(at, `has more than one source tag (${sources.join(', ')})`)
    }
    const src = sources[0] ?? 'query'
    const tagValue = tags.get(src)
    const srcPath = typeof tagValue === 'string' ? tagValue : null
    const defaultValue: TagValue | undefined = tags.get('default')
    const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0
    return {
      name: prop.name,
      src,
      srcPath: srcPath === prop.name ? null : srcPath,
      required: !optional && defaultValue === undefined,
      type: this.dataType(at, bases, checker),
      defaultValue,
    }
  }

  /** String, number, boolean and array get a cast; objects, dates and `unknown` pass through as parsed. */
  private dataType(at: string, bases: ts.Type[], checker: ts.TypeChecker): DataType | null {
    if (bases.length === 0) return null
    const all = (flag: ts.TypeFlags) => bases.every((b) => b.flags & flag)
    if (all(ts.TypeFlags.String | ts.TypeFlags.StringLiteral)) return 'String'
    if (all(ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) return 'Number'
    if (all(ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) return 'Boolean'
    if (bases.every((b) => checker.isArrayType(b))) return 'Array'
    if (bases.every((b) => b.flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Any))) return null
    if (
      bases.every(
        (b) =>
          b.flags & (ts.TypeFlags.Object | ts.TypeFlags.NonPrimitive) && !checker.isArrayType(b),
      )
    ) {
      return null
    }
    const shown = bases.map((b) => checker.typeToString(b)).join(' | ')
    throw new GeneratorError(at, `cannot map type ${shown} to a request data type`)
  }

  private checkRoutes(
    className: string,
    servicePath: string | null,
    routes: RouteModel[],
    problems: GeneratorError[],
  ): void {
    const seen: { verb: string; path: string; route: RouteModel }[] = []
    for (const route of routes) {
      const where = `${className}.${route.method}`
      const routePath = `${servicePath ?? ''}${route.path ?? ''}`
      this.host.collect(problems, () => this.checkParams(where, routePath, route))

      for (const verb of route.verbs) {
        const clash = seen.find((s) => s.verb === verb && s.path === routePath)
        if (clash) {
          problems.push(
            new GeneratorError(
              where,
              `duplicate route ${verb.toUpperCase()} ${routePath || '/'} (also ${clash.route.method})`,
            ),
          )
        }
        const shadow = seen.find((s) => s.verb === verb && this.shadows(s.path, routePath))
        if (shadow) {
          problems.push(
            new GeneratorError(
              where,
              `route ${verb.toUpperCase()} ${routePath} is shadowed by ${shadow.route.method} (${shadow.path}), which is registered first`,
            ),
          )
        }
        seen.push({ verb, path: routePath, route })
      }
    }
  }

  private checkParams(where: string, routePath: string, route: RouteModel): void {
    const inPath = Array.from(routePath.matchAll(/:([A-Za-z_]\w*)/g), (m) => m[1])
    const tagged = route.data.filter((d) => d.src === 'param').map((d) => d.srcPath ?? d.name)
    for (const name of inPath) {
      if (!tagged.includes(name)) {
        throw new GeneratorError(where, `path param ":${name}" has no property tagged Param`)
      }
    }
    for (const name of tagged) {
      if (!inPath.includes(name)) {
        throw new GeneratorError(
          where,
          `property "${name}" is tagged Param but the path has no ":${name}"`,
        )
      }
    }
  }

  /** True when `earlier` has a param segment where the later literal route has fixed text, so it matches first. */
  private shadows(earlier: string, later: string): boolean {
    const a = earlier.split('/')
    const b = later.split('/')
    if (a.length !== b.length || earlier === later) return false
    const laterHasLiteral = b.some((seg, i) => !seg.startsWith(':') && a[i].startsWith(':'))
    const matches = a.every((seg, i) => seg.startsWith(':') || seg === b[i])
    return laterHasLiteral && matches
  }

  private outputPath(sourceFile: string): string {
    const base = sourceFile.replace(/\.tsx?$/, '.endpoints.ts')
    if (!this.settings.outDir) return base
    return path.join(this.settings.outDir, path.relative(this.config.rootDir, base))
  }
}

type ClassWithName = ts.ClassDeclaration & { name: ts.Identifier }
