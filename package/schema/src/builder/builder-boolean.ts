import { BuilderBase } from './builder-base'

/**
 * Builder for Boolean field types
 */
export class BuilderBoolean extends BuilderBase<boolean> {
  protected getType() {
    return Boolean
  }

  // Boolean-specific validation methods can be added here in the future
  // Currently, the base validation methods are sufficient
}

export default BuilderBoolean
