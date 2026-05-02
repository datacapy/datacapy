export class RepoErrorValidation extends Error {
  validationErrors: any

  constructor(errors) {
    const errorPaths = errors ? Object.keys(errors) : []
    const errorPathsString = errorPaths.length
      ? ' (' + errorPaths.join(', ') + ')'
      : ''
    super('One or more fields' + errorPathsString + ' failed validation')
    this.validationErrors = errors
  }
}
