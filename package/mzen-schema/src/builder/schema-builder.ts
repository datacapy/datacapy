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
  static array<T = any>(): BuilderArray<T> {
    return new BuilderArray<T>()
  }

  /**
   * Create an object field builder
   */
  static object<T extends object = any>(): BuilderObject<T> {
    return new BuilderObject<T>()
  }

  /**
   * Create a mixed (any) field builder
   */
  static mixed(): BuilderMixed {
    return new BuilderMixed()
  }

  /**
   * Create an $or field builder for alternative specs
   */
  static or(specs: Array<SchemaSpec | BuilderBase<any>>): BuilderOr {
    return new BuilderOr(specs)
  }

  /**
   * Create a top-level schema builder
   */
  static schema(name?: string): BuilderSchema {
    return new BuilderSchema(name)
  }

  /**
   * Shorthand for creating a schema reference
   * Example: sb.ref('surveyQuestion') => { $schema: 'surveyQuestion' }
   */
  static ref(schemaName: string): SchemaSpec {
    return { $schema: schemaName }
  }
}
