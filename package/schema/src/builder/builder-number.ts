import { BuilderBase } from './builder-base'

/**
 * Builder for Number field types
 * Provides number-specific validation methods
 */
export class BuilderNumber extends BuilderBase<number> {
  protected getType() {
    return Number
  }

  // Number-specific validation methods can be added here in the future
  // For example: min(), max(), integer(), positive(), negative(), etc.
  // Currently, the base validation methods (required, notNull, etc.) are sufficient
  // for the existing schema definitions
}

export default BuilderNumber
