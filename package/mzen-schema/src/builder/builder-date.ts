import { BuilderBase } from './builder-base'

/**
 * Builder for Date field types
 */
export class BuilderDate extends BuilderBase<Date> {
  protected getType() {
    return Date
  }

  // Date-specific validation methods can be added here in the future
  // For example: min(), max(), before(), after(), etc.
  // Currently, the base validation methods and filters (like default('now')) are sufficient
}

export default BuilderDate
