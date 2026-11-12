/**
 * Main entry point for the builder API
 * Use `sb.string()`, `sb.number()`, etc. to create field builders
 */

import { BuilderString } from './builder-string'
import { BuilderNumber } from './builder-number'
import { BuilderBoolean } from './builder-boolean'
import { BuilderDate } from './builder-date'
import { BuilderArray } from './builder-array'
import { BuilderObject } from './builder-object'
import { BuilderMixed } from './builder-mixed'
import { BuilderOr } from './builder-or'
import { BuilderSchema } from './builder-schema'
import { BuilderBase } from './builder-base'
import SchemaSpec from '../spec'
import { ArrayItem, ArrayItemInput } from './builder-array'
import { BuilderRef } from './builder-ref'
import { OrValue } from './builder-or'
import { resolveConstructor } from '../utilities/resolve-constructor'
import {
  HasBuilderFields,
  Infer,
  InferSpec,
  SchemaThunk,
  SpecInput,
} from './infer'

interface Step {
  key: string
  initial?: BuilderBase
  caster?: BuilderBase
  construct?: Function
  itemConstruct?: Function
}

export class SchemaBuilder {
  /**
   * Create a string field builder
   */
  static string(): BuilderString {
    return new BuilderString()
  }

  /**
   * Create a number field builder
   */
  static number(): BuilderNumber {
    return new BuilderNumber()
  }

  /**
   * Create a boolean field builder
   */
  static boolean(): BuilderBoolean {
    return new BuilderBoolean()
  }

  /**
   * Create a date field builder
   */
  static date(): BuilderDate {
    return new BuilderDate()
  }

  /**
   * Create an array field builder
   */
  static array(): BuilderArray<any>
  static array<X extends ArrayItemInput>(
    itemSpec: X
  ): BuilderArray<ArrayItem<X>>
  static array(itemSpec?: ArrayItemInput): BuilderArray<any> {
    return new BuilderArray(itemSpec)
  }

  /**
   * Create an object field builder
   */
  static object(): BuilderObject<any>
  static object<S extends SpecInput>(shape: S): BuilderObject<InferSpec<S>>
  static object(shape?: SpecInput): BuilderObject<any> {
    return new BuilderObject(shape)
  }

  /**
   * Create a mixed (any) field builder
   */
  static mixed(): BuilderMixed<unknown> {
    return new BuilderMixed()
  }

  /**
   * Create an $or field builder for alternative specs
   */
  static or<const X extends ReadonlyArray<SchemaSpec | BuilderBase<any>>>(
    specs: X
  ): BuilderOr<OrValue<X>> {
    return new BuilderOr(specs)
  }

  /**
   * Create a top-level schema builder
   */
  static schema(name?: string): BuilderSchema<{}> {
    return new BuilderSchema(name)
  }

  /**
   * Reference another schema lazily; the type is inferred from the schema.
   * Example: sb.ref(() => schemaSurveyQuestion)
   */
  static ref<S extends SchemaThunk>(
    schema: S
  ): BuilderRef<Infer<ReturnType<S>>> {
    return new BuilderRef(schema)
  }

  /**
   * Reference another schema lazily with a stated value type. Use it where schemas
   * refer to each other in a cycle: `sb.ref` would infer the type from the schema
   * class, which TypeScript cannot resolve when the class is in its own base
   * expression. The generated code uses it for every reference.
   * Example: sb.refTo<SpecFor<AuthorData>>(() => new SchemaAuthor())
   */
  static refTo<T>(schema: () => unknown): BuilderRef<T> {
    return new BuilderRef<T>(schema as SchemaThunk)
  }

  /**
   * Fill the defaults of a shape into `data`: each key that is `undefined` or `null` takes
   * its `default()` value, else its `init()` value. Other values pass through
   * untouched, and a key with no starting value stays as given. A synchronous
   * counterpart of the default filter, for a constructor that sets its own
   * fields.
   */
  static applyDefaults<S extends SpecInput>(
    source: S | HasBuilderFields<S> | (new () => HasBuilderFields<S>),
    data?: { [K in keyof InferSpec<S>]?: unknown } | null
  ): Partial<InferSpec<S>> {
    return SchemaBuilder.defaultsFor(source)(data)
  }

  /**
   * `applyDefaults` with the work that depends only on the shape and options
   * done once: build the function at module level and call it from a
   * constructor that runs often.
   */
  static defaultsFor<S extends SpecInput>(
    source: S | HasBuilderFields<S> | (new () => HasBuilderFields<S>)
  ): <T extends object = Partial<InferSpec<S>>>(
    data?: { [K in keyof InferSpec<S>]?: unknown } | null,
    target?: T
  ) => T & Partial<InferSpec<S>> {
    const shape = SchemaBuilder.specOf(source)
    const steps: Step[] = Object.entries(shape).map(([key, field]) => {
      const builder = field instanceof BuilderBase ? field : undefined
      return {
        key,
        initial: builder?.hasInitial() ? builder : undefined,
        caster: builder,
        construct: builder?.constructedBy(),
        itemConstruct: builder?.itemConstructedBy(),
      }
    })
    const none: Record<string, unknown> = {}

    return (data, target) => {
      const input = (data ?? none) as Record<string, unknown>
      const result = (target ?? { ...input }) as Record<string, unknown>
      if (target) Object.assign(result, input)
      for (const step of steps) {
        const { key, initial, caster, construct, itemConstruct } = step
        let value = input[key]
        const isMissing = value == null
        if (isMissing) {
          if (initial) value = initial.resolveInitial()
        }
        if (caster) value = caster.coerce(value)
        if (value != null) {
          if (construct) {
            const Wrapper = SchemaBuilder.classOf(construct, key)
            value = new Wrapper(value)
          } else if (itemConstruct && Array.isArray(value)) {
            const Item = SchemaBuilder.classOf(itemConstruct, key)
            value = value.map((item) => (item == null ? item : new Item(item)))
          }
        }
        if (value !== undefined || key in input) result[key] = value
      }
      return result as never
    }
  }

  private static classOf(
    ref: Function,
    key: string
  ): new (value: unknown) => unknown {
    const resolved = resolveConstructor(ref)
    if (typeof resolved !== 'function') {
      throw new Error(`Constructor for "${key}" did not resolve to a class`)
    }
    return resolved as new (value: unknown) => unknown
  }

  /** The builder map of a spec, a schema instance or a schema class. */
  private static specOf<S extends SpecInput>(
    source: S | HasBuilderFields<S> | (new () => HasBuilderFields<S>)
  ): S {
    const schema = typeof source === 'function' ? new source() : source
    return typeof (schema as HasBuilderFields<S>).builderFields === 'function'
      ? (schema as HasBuilderFields<S>).builderFields()
      : (schema as S)
  }
}
