import * as ts from 'typescript'

import { GeneratorError } from './errors'
import { BaseKind, FieldModel, RefResolver, TagValue } from './field-model'

const TAG_PREFIX = '$dc:'

/** Splits a property's checker type into a base kind, nullability and tags. */
export class TypeAnalyser {
  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly resolveRef: RefResolver,
  ) {}

  analyseProperty(property: ts.Symbol, path: string): FieldModel {
    const type = this.checker.getTypeOfSymbol(property)
    const optional = (property.flags & ts.SymbolFlags.Optional) !== 0
    return this.analyse(type, path, optional)
  }

  analyse(type: ts.Type, path: string, optional: boolean): FieldModel {
    const tags = new Map<string, TagValue>()
    let nullable = false
    const bases: ts.Type[] = []

    for (const member of this.unionMembers(type)) {
      if (member.flags & ts.TypeFlags.Undefined) continue
      if (member.flags & ts.TypeFlags.Null) {
        nullable = true
        continue
      }
      for (const part of this.intersectionParts(member)) {
        if (this.isTagType(part)) this.readTags(part, tags, path)
        else bases.push(part)
      }
    }

    if (tags.has('opaque')) {
      const mixed: FieldModel = {
        base: { kind: 'mixed' },
        nullable: false,
        optional: false,
        tags: new Map(),
      }
      const isArray = bases.length === 1 && this.checker.isArrayType(bases[0])
      const base: BaseKind = isArray
        ? { kind: 'array', item: mixed }
        : { kind: 'opaque', type: 'object' }
      return { base, nullable, optional, tags }
    }

    return {
      // `unknown & Tag` collapses to the tag alone, so a tag with no base is `unknown`
      base: bases.length === 0 && tags.size > 0 ? { kind: 'mixed' } : this.baseKind(bases, path),
      nullable,
      optional,
      tags,
    }
  }

  private unionMembers(type: ts.Type): ts.Type[] {
    return type.isUnion() ? type.types : [type]
  }

  private intersectionParts(type: ts.Type): ts.Type[] {
    return type.isIntersection() ? type.types : [type]
  }

  private isTagType(type: ts.Type): boolean {
    if (!(type.flags & ts.TypeFlags.Object)) return false
    return type.getProperties().some((p) => p.name.startsWith(TAG_PREFIX))
  }

  private readTags(type: ts.Type, into: Map<string, TagValue>, path: string): void {
    for (const prop of type.getProperties()) {
      if (!prop.name.startsWith(TAG_PREFIX)) continue
      const name = prop.name.slice(TAG_PREFIX.length)
      const valueType = this.withoutUndefined(this.checker.getTypeOfSymbol(prop))
      into.set(name, this.tagValue(valueType, `${path} tag ${name}`))
    }
  }

  private withoutUndefined(type: ts.Type): ts.Type {
    if (!type.isUnion()) return type
    const rest = type.types.filter((t) => !(t.flags & ts.TypeFlags.Undefined))
    return rest.length === 1 ? rest[0] : type
  }

  private tagValue(type: ts.Type, path: string): TagValue {
    if (type.isStringLiteral()) return type.value
    if (type.isNumberLiteral()) return type.value
    if (type.flags & ts.TypeFlags.BooleanLiteral) {
      return this.checker.typeToString(type) === 'true'
    }
    if (type.flags & ts.TypeFlags.Null) return null
    if (this.checker.isTupleType(type)) {
      return this.checker
        .getTypeArguments(type as ts.TypeReference)
        .map((item, i) => this.tagValue(this.withoutUndefined(item), `${path}[${i}]`))
    }
    if (type.flags & ts.TypeFlags.Object) {
      const value: { [key: string]: TagValue } = {}
      for (const prop of this.checker.getPropertiesOfType(type)) {
        value[prop.name] = this.tagValue(
          this.withoutUndefined(this.checker.getTypeOfSymbol(prop)),
          `${path}.${prop.name}`,
        )
      }
      return value
    }
    if (type.isUnion()) {
      const members = type.types.filter((member) => !(member.flags & ts.TypeFlags.Undefined))
      if (members.every((member) => member.isStringLiteral())) {
        return members.map((member) => (member as ts.StringLiteralType).value)
      }
    }
    throw new GeneratorError(path, 'tag arguments must be literal types ')
  }

  private baseKind(bases: ts.Type[], path: string): BaseKind {
    if (bases.length === 0) {
      throw new GeneratorError(path, 'no base type found')
    }
    const first = bases[0]
    const all = (flag: ts.TypeFlags) => bases.every((b) => b.flags & flag)

    if (all(ts.TypeFlags.StringLiteral)) {
      return {
        kind: 'literals',
        values: bases.map((b) => (b as ts.StringLiteralType).value),
      }
    }
    if (all(ts.TypeFlags.String)) return { kind: 'string' }
    if (all(ts.TypeFlags.Number)) return { kind: 'number' }
    if (all(ts.TypeFlags.BooleanLiteral | ts.TypeFlags.Boolean)) {
      return { kind: 'boolean' }
    }
    if (bases.length === 1) {
      if (first.flags & ts.TypeFlags.Unknown) return { kind: 'mixed' }
      if (first.symbol?.name === 'Date') return { kind: 'date' }
      if (this.checker.isArrayType(first)) {
        const [element] = this.checker.getTypeArguments(first as ts.TypeReference)
        return {
          kind: 'array',
          item: this.analyse(element, `${path}[]`, false),
        }
      }
    }
    const objectKind = this.objectKind(bases, path)
    if (objectKind) return objectKind
    const shown = bases.map((b) => this.checker.typeToString(b)).join(' | ')
    throw new GeneratorError(path, `unsupported type ${shown}`)
  }

  /** A reference, an inline object, or a union of those; undefined for anything else. */
  private objectKind(bases: ts.Type[], path: string): BaseKind | undefined {
    if (!bases.every((b) => this.isObjectLike(b))) return undefined
    if (bases.length === 1) return this.singleObject(bases[0], path)
    return {
      kind: 'or',
      members: bases.map((b, i) => ({
        base: this.singleObject(b, `${path}|${i}`),
        nullable: false,
        // alternatives carry no presence of their own
        optional: true,
        tags: new Map(),
      })),
    }
  }

  /** The value type of a string index signature (`Record<string, V>`), if the type has one. */
  mapValueType(type: ts.Type): ts.Type | undefined {
    return this.checker.getIndexInfoOfType(type, ts.IndexKind.String)?.type
  }

  private isObjectLike(type: ts.Type): boolean {
    if (type.flags & ts.TypeFlags.NonPrimitive) return true
    if (!(type.flags & ts.TypeFlags.Object)) return false
    if (this.checker.isArrayType(type) || type.symbol?.name === 'Date') {
      return false
    }
    return (
      !!this.resolveRef(type) ||
      this.mapValueType(type) !== undefined ||
      this.isAnonymousObject(type)
    )
  }

  private isAnonymousObject(type: ts.Type): boolean {
    return ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Anonymous) !== 0
  }

  private singleObject(type: ts.Type, path: string): BaseKind {
    const target = this.resolveRef(type)
    if (target) return { kind: 'ref', target }
    if (type.flags & ts.TypeFlags.NonPrimitive) return { kind: 'opaque', type: 'object' }
    const valueType = this.mapValueType(type)
    if (valueType) return this.mapKind(type, valueType, path)
    return {
      kind: 'object',
      fields: this.checker.getPropertiesOfType(type).map((prop) => ({
        name: prop.name,
        model: this.analyseProperty(prop, `${path}.${prop.name}`),
      })),
    }
  }

  /** `Record<string, unknown>` is opaque; any other value type becomes `matchAll`. */
  private mapKind(type: ts.Type, valueType: ts.Type, path: string): BaseKind {
    if (this.checker.getPropertiesOfType(type).length > 0) {
      throw new GeneratorError(
        path,
        'an index signature mixed with named properties is not supported',
      )
    }
    if (valueType.flags & ts.TypeFlags.Unknown) {
      return { kind: 'opaque', type: 'Record<string, unknown>' }
    }
    return { kind: 'map', value: this.mapValue(valueType, `${path}[]`) }
  }

  /** Map entries are always present, so they carry no presence call of their own. */
  mapValue(valueType: ts.Type, path: string): FieldModel {
    return { ...this.analyse(valueType, path, true) }
  }
}
