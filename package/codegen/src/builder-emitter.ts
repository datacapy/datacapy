import { GeneratorError } from './errors'
import { BaseKind, FieldModel, SchemaTarget, TagValue } from './field-model'

/** Tags that call a no-argument builder method, in emit order. */
const FLAG_TAGS: ReadonlyArray<[string, string]> = [
  ['email', 'email'],
  ['notEmpty', 'notEmpty'],
  ['trim', 'trim'],
  ['lowercase', 'lowercase'],
  ['uppercase', 'uppercase'],
  ['stripHtml', 'stripHtml'],
  ['private', 'private'],
  ['privateValue', 'privateValue'],
  ['encrypt', 'encrypt'],
  ['noCast', 'noCast'],
  ['relation', 'relation'],
]

/** Tags that call a builder method with their literal argument, in emit order. */
const VALUE_TAGS: ReadonlyArray<[string, string]> = [
  ['pattern', 'regex'],
  ['minLength', 'minLength'],
  ['maxLength', 'maxLength'],
  ['label', 'label'],
]

/** Tags the MVP does not generate yet; they fail the build rather than vanish silently. */
const KNOWN_TAGS = new Set([
  'default',
  'init',
  'initFn',
  'constructCollection',
  'defaultFn',
  ...FLAG_TAGS.map(([tag]) => tag),
  ...VALUE_TAGS.map(([tag]) => tag),
  'validate',
  'filter',
])

/** What one generated file needs imported, collected while emitting. */
export class EmitContext {
  readonly refs: SchemaTarget[] = []
  readonly registry = new Set<'validators' | 'filters' | 'initialisers'>()

  constructor(readonly hasRegistry: boolean) {}
}

/** Writes the `sb` builder chain for one field model. */
export class BuilderEmitter {
  emit(field: FieldModel, path: string, ctx: EmitContext): string {
    this.checkTags(field, path)
    const calls = [
      ...this.presenceCalls(field, path, ctx),
      ...this.baseCalls(field.base),
      ...this.collectionCalls(field, path),
      ...this.tagCalls(field),
      ...this.callbackCalls(field, path, ctx),
    ]
    if (field.nullable && field.tags.get('default') !== null) {
      calls.push('nullable()')
    }
    if (field.optional && this.hasDefaultOrInit(field)) {
      calls.push('optional()')
    }
    return `${this.constructorCall(field.base, path, ctx)}${calls.map((c) => `.${c}`).join('')}`
  }

  private checkTags(field: FieldModel, path: string): void {
    for (const name of field.tags.keys()) {
      if (!KNOWN_TAGS.has(name)) {
        throw new GeneratorError(path, `tag ${name} is not supported yet`)
      }
    }
  }

  private hasDefaultOrInit(field: FieldModel): boolean {
    return ['default', 'init', 'defaultFn', 'initFn'].some((tag) => field.tags.has(tag))
  }

  private presenceCalls(field: FieldModel, path: string, ctx: EmitContext): string[] {
    const calls: string[] = []
    for (const [literalTag, fnTag] of [
      ['default', 'defaultFn'],
      ['init', 'initFn'],
    ]) {
      if (field.tags.has(literalTag) && field.tags.has(fnTag)) {
        throw new GeneratorError(path, `tags ${literalTag} and ${fnTag} cannot be combined`)
      }
    }
    if (!field.optional && !this.hasDefaultOrInit(field)) {
      calls.push('required()')
    }
    if (field.tags.has('default')) {
      calls.push(`default(${this.literal(field.tags.get('default')!)})`)
    }
    if (field.tags.has('init')) {
      calls.push(`init(${this.literal(field.tags.get('init')!)})`)
    }
    for (const [tag, method] of [
      ['defaultFn', 'default'],
      ['initFn', 'init'],
    ]) {
      if (!field.tags.has(tag)) continue
      this.useRegistry(tag, path, ctx, 'initialisers')
      calls.push(`${method}(initialisers.${field.tags.get(tag)})`)
    }
    return calls
  }

  private baseCalls(base: BaseKind): string[] {
    if (base.kind !== 'literals') return []
    return [`inArray([${base.values.map((v) => this.literal(v)).join(', ')}])`]
  }

  private collectionCalls(field: FieldModel, path: string): string[] {
    if (!field.tags.has('constructCollection')) return []
    if (field.base.kind !== 'array') {
      throw new GeneratorError(path, 'tag constructCollection only applies to arrays')
    }
    return [`constructCollection(${this.literal(field.tags.get('constructCollection')!)})`]
  }

  private tagCalls(field: FieldModel): string[] {
    const calls: string[] = []
    for (const [tag, method] of VALUE_TAGS) {
      if (field.tags.has(tag)) {
        calls.push(`${method}(${this.literal(field.tags.get(tag)!)})`)
      }
    }
    for (const [tag, method] of FLAG_TAGS) {
      if (field.tags.has(tag)) calls.push(`${method}()`)
    }
    return calls
  }

  private callbackCalls(field: FieldModel, path: string, ctx: EmitContext): string[] {
    const calls: string[] = []
    const uses: Array<['validate' | 'filter', 'validators' | 'filters']> = [
      ['validate', 'validators'],
      ['filter', 'filters'],
    ]
    for (const [tag, registry] of uses) {
      if (!field.tags.has(tag)) continue
      this.useRegistry(tag, path, ctx, registry)
      calls.push(`${tag}(${registry}.${field.tags.get(tag)})`)
    }
    return calls
  }

  private useRegistry(
    tag: string,
    path: string,
    ctx: EmitContext,
    registry: 'validators' | 'filters' | 'initialisers',
  ): void {
    if (!ctx.hasRegistry) {
      throw new GeneratorError(path, `tag ${tag} needs a "registry" module in datacapy.config.json`)
    }
    ctx.registry.add(registry)
  }

  private constructorCall(base: BaseKind, path: string, ctx: EmitContext): string {
    switch (base.kind) {
      case 'string':
      case 'literals':
        return 'sb.string()'
      case 'number':
        return 'sb.number()'
      case 'boolean':
        return 'sb.boolean()'
      case 'date':
        return 'sb.date()'
      case 'mixed':
        return 'sb.mixed()'
      case 'array':
        return `sb.array(${this.emit(this.asItem(base.item), `${path}[]`, ctx)})`
      case 'object': {
        const fields = base.fields.map(
          (f) => `${this.key(f.name)}: ${this.emit(f.model, `${path}.${f.name}`, ctx)}`,
        )
        return `sb.object({ ${fields.join(', ')} })`
      }
      case 'map':
        return `sb.object().matchAll(${this.emit(base.value, `${path}[]`, ctx)})`
      case 'opaque':
        return `sb.object().as<${base.type}>()`
      case 'ref':
        ctx.refs.push(base.target)
        return `sb.refTo<SpecFor<${base.target.interfaceName}>>((): unknown => ${base.target.className})`
      case 'or': {
        const members = base.members.map((m, i) => this.emit(m, `${path}|${i}`, ctx))
        return `sb.or([${members.join(', ')}])`
      }
    }
  }

  /** Array items are always present, so the element type infers without `undefined`. */
  private asItem(item: FieldModel): FieldModel {
    return { ...item, optional: false }
  }

  private key(name: string): string {
    return /^[A-Za-z_$][\w$]*$/.test(name) ? name : `'${name}'`
  }

  private literal(value: TagValue): string {
    if (typeof value === 'string') {
      return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
    }
    return String(value)
  }
}
