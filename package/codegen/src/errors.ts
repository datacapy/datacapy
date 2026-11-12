/** A construct the generator cannot turn into a schema; the message names the property path. */
export class GeneratorError extends Error {
  constructor(
    public readonly path: string,
    reason: string,
  ) {
    super(`${path}: ${reason}`)
    this.name = 'GeneratorError'
  }
}
