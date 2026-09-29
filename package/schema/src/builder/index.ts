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

/**
 * Export as 'sb' for convenience
 * Example usage: sb.string().required().maxLength(64).build()
 */
export const sb = SchemaBuilder

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
}

export default sb
