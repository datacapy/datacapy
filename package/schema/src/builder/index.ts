/**
 * Schema Builder API
 * Provides a fluent builder pattern for defining schemas
 * Inspired by Zod and Joi, adapted for @datacapy/schema
 */

import { SchemaBuilder } from './schema-builder'
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
import { BuilderRef } from './builder-ref'

// Export individual builder classes for advanced use cases
export {
  SchemaBuilder,
  BuilderBase,
  BuilderString,
  BuilderNumber,
  BuilderBoolean,
  BuilderDate,
  BuilderArray,
  BuilderObject,
  BuilderMixed,
  BuilderOr,
  BuilderSchema,
  BuilderRef,
}

export { SchemaConstructor } from './schema-constructor'
export type { SchemaConstructorClass } from './schema-constructor'
export { SchemaConstructorBase } from './schema-constructor-base'
export type { SchemaConstructorBaseInput } from './schema-constructor-base'
export type {
  Infer,
  InferSpec,
  InferInputSpec,
  InferValue,
  Plain,
  SchemaThunk,
  SpecInput,
  HasSpec,
  HasBuilderFields,
} from './infer'
export type {
  BuilderPresent,
  BuilderNullable,
  BuilderOptional,
} from './builder-base'
