import { BuilderBase } from './builder-base'
import SchemaTypes from '../types'

/**
 * Builder for Mixed (any) field types
 * Accepts any type of value without type casting
 */
export class BuilderMixed extends BuilderBase<any> {
  protected getType() {
    return SchemaTypes.Mixed
  }
}

export default BuilderMixed
