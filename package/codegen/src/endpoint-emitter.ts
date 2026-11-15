import { DataEntry, RouteModel, ServiceModel } from './endpoint-model'
import { TagValue } from './field-model'

/** Writes `ServiceModel`s as a `ServerApiConfig` module. */
export class EndpointEmitter {
  constructor(private readonly serverModule: string) {}

  emit(sourceName: string, services: ServiceModel[]): string {
    const blocks = services.map((service) => this.emitService(service))
    const only = services.length === 1 ? [`export default ${this.constName(services[0])}`] : []
    return [
      `// Generated from ${sourceName} by datacapy-gen. Do not edit.`,
      '// cspell:disable',
      `import type { ServerApiConfig } from '${this.serverModule}'`,
      '',
      ...blocks,
      ...only,
      '',
    ].join('\n')
  }

  private emitService(service: ServiceModel): string {
    const lines = [
      `export const ${this.constName(service)} = {`,
      `  service: ${this.string(service.serviceName)},`,
    ]
    if (service.path !== null) lines.push(`  path: ${this.string(service.path)},`)
    lines.push(
      '  enable: true,',
      "  acl: { rules: [{ allow: false, role: 'all' }] },",
      '  endpoints: {',
      ...service.routes.map((route) => this.emitRoute(route)),
      '  },',
      '} satisfies ServerApiConfig',
      '',
    )
    return lines.join('\n')
  }

  private emitRoute(route: RouteModel): string {
    const parts = [`method: ${this.string(route.method)}`]
    parts.push(`verbs: [${route.verbs.map((v) => this.string(v)).join(', ')}]`)
    if (route.path !== null) parts.push(`path: ${this.string(route.path)}`)
    if (!route.enable) parts.push('enable: false')
    parts.push(`data: {${route.data.map((d) => ` ${this.emitData(d)},`).join('')} }`)
    const rules = route.rules.map((r) => `{ allow: ${r.allow}, role: ${this.string(r.role)} }`)
    parts.push(`acl: { rules: [${rules.join(', ')}] }`)
    if (route.errors.length > 0) {
      const errors = route.errors.map((e) => `${e.errorClass}: { http: { code: ${e.code} } }`)
      parts.push(`response: { error: { ${errors.join(', ')} } }`)
    }
    return `    ${this.key(route.key)}: { ${parts.join(', ')} },`
  }

  private emitData(entry: DataEntry): string {
    const parts = [`src: ${this.string(entry.src)}`]
    if (entry.srcPath !== null) parts.push(`srcPath: ${this.string(entry.srcPath)}`)
    parts.push(`required: ${entry.required}`)
    if (entry.type) parts.push(`type: ${entry.type}`)
    if (entry.defaultValue !== undefined)
      parts.push(`defaultValue: ${this.value(entry.defaultValue)}`)
    return `${this.key(entry.name)}: { ${parts.join(', ')} }`
  }

  private constName(service: ServiceModel): string {
    return `${service.serviceName}Config`
  }

  private key(name: string): string {
    return /^[A-Za-z_$][\w$]*$/.test(name) ? name : this.string(name)
  }

  private string(value: string): string {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }

  private value(value: TagValue): string {
    if (typeof value === 'string') return this.string(value)
    if (Array.isArray(value)) return `[${value.map((v) => this.value(v)).join(', ')}]`
    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value).map(([k, v]) => `${this.key(k)}: ${this.value(v)}`)
      return `{ ${entries.join(', ')} }`
    }
    return String(value)
  }
}
