export type TagValue = string | number | boolean | null | string[]

export type BaseKind =
  | { kind: 'string' }
  | { kind: 'literals'; values: string[] }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'date' }
  | { kind: 'mixed' }
  | { kind: 'array'; item: FieldModel }
  | { kind: 'object'; fields: { name: string; model: FieldModel }[] }
  | { kind: 'map'; value: FieldModel }
  /** An object with no shape, typed as `type` (e.g. `Record<string, unknown>`). */
  | { kind: 'opaque'; type: string }
  | { kind: 'ref'; target: SchemaTarget }
  | { kind: 'or'; members: FieldModel[] }

/** One property of an interface, reduced to what the builder chain needs. */
export interface FieldModel {
  base: BaseKind
  nullable: boolean
  optional: boolean
  /** Tags by name without the `$dc:` prefix, e.g. `maxLength`. */
  tags: Map<string, TagValue>
}

/** A schema generated from another `@schema` interface. */
export interface SchemaTarget {
  className: string
  /** Name of the marked interface the schema is generated from. */
  interfaceName: string
  /** Module to import the class from; null when it is generated into the same file. */
  module: string | null
  /** Module to import the interface from; null when it is declared in the same file. */
  interfaceModule: string | null
}

/** Maps an interface type to the schema generated for it, if it is marked. */
export type RefResolver = (type: import('typescript').Type) => SchemaTarget | undefined
