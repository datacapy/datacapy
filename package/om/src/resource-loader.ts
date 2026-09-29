import * as fs from 'fs'
import * as path from 'path'

interface ResourceLoaderConfig {
  dirPaths: string[]
  subdir?: string
  fileExt?: string
  fileNamesExclude?: string[]
  fileNamesLimit?: string[]
}

export class ResourceLoader {
  options: ResourceLoaderConfig

  constructor(options?: ResourceLoaderConfig) {
    this.options = this.configNormalise(options)
  }

  configNormalise(options?: ResourceLoaderConfig): ResourceLoaderConfig {
    // If a given option is not specified use the object scope value or the default value

    let normalised = options ? options : { dirPaths: [] }

    normalised.dirPaths =
      options && options.dirPaths !== undefined
        ? options.dirPaths
        : this.options.dirPaths !== undefined
          ? this.options.dirPaths
          : []
    normalised.subdir =
      options && options.subdir !== undefined
        ? options.subdir
        : this.options.subdir !== undefined
          ? this.options.subdir
          : undefined
    normalised.fileExt =
      options && options.fileExt !== undefined
        ? options.fileExt
        : this.options.fileExt !== undefined
          ? this.options.fileExt
          : undefined
    normalised.fileNamesExclude =
      options && options.fileNamesExclude !== undefined
        ? options.fileNamesExclude
        : this.options.fileNamesExclude !== undefined
          ? this.options.fileNamesExclude
          : undefined
    normalised.fileNamesLimit =
      options && options.fileNamesLimit !== undefined
        ? options.fileNamesLimit
        : this.options.fileNamesLimit !== undefined
          ? this.options.fileNamesLimit
          : undefined

    return normalised
  }

  /**
   * Load Resources
   *
   * Loads all files in each of dirPaths via require().
   * If subdir is specified we will only look in subdir of each dirPaths.
   * By default only loads files with extension '.js' unless fileExt is specified.
   */
  getResources(options?: ResourceLoaderConfig): Record<string, any> {
    var resources = {}
    var resourcePaths = this.getResourcePaths(options)

    resourcePaths.forEach((filePath) => {
      resources[filePath] = ResourceLoader.loadModule(filePath)
    })

    return resources
  }

  getResourcePaths(options?: ResourceLoaderConfig): string[] {
    const opts = this.configNormalise(options)

    var fileExt = opts.fileExt ? opts.fileExt : '.js'
    var resourcePaths: string[] = []

    opts.dirPaths.forEach((dirPath) => {
      const dir = opts.subdir ? path.join(dirPath, opts.subdir) : dirPath
      if (!dir) return
      try {
        fs.accessSync(dir, fs.constants.R_OK) // This throws if any accessibility checks fail, and does nothing otherwise.
        const filenames = fs.readdirSync(dir)

        filenames.forEach((fileName) => {
          const extStartOffset = fileName.length - fileExt.length
          const realExt = fileName.substring(extStartOffset)
          if (
            realExt === fileExt &&
            (!Array.isArray(opts.fileNamesExclude) ||
              !opts.fileNamesExclude.includes(fileName)) && // file not excluded
            (!Array.isArray(opts.fileNamesLimit) ||
              opts.fileNamesLimit.includes(fileName)) // file is in the limit list
          ) {
            const filePath = path.resolve(path.join(dir, fileName))
            resourcePaths.push(filePath)
          }
        })
      } catch (err) {
        // Config directory does not exist
      }
    })

    return resourcePaths
  }

  /**
   * Get resource config
   *
   * Given a resource file path, returns the associated config object loaded from a config file with the same name.
   */
  getResourceConfig(
    resourcePath: string,
    resourceExt = '.js',
    configExt = '.json'
  ): any {
    const configPath = resourcePath.slice(0, -resourceExt.length) + configExt

    try {
      fs.accessSync(configPath, fs.constants.R_OK)
      const configModule = require(configPath)
      return configModule && configModule.__esModule
        ? configModule.default
        : configModule
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : `Config file not found for resource ${configPath}`
      console.error(errorMsg)
      return null
    }
  }

  static loadModule(filePath: string): any {
    try {
      const loadedModule = require(filePath)
      return loadedModule && loadedModule.__esModule
        ? loadedModule.default
        : loadedModule
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : `Config file not found for resource ${filePath}`
      console.error(errorMsg)
      return null
    }
  }

  static resourcePathToName(resourcePath: string, ext = '.js'): string {
    let result = path.basename(resourcePath, ext)
    if (typeof result === 'string') {
      result = result.charAt(0).toLowerCase() + result.slice(1)
    }
    return result
  }
}

export default ResourceLoader
