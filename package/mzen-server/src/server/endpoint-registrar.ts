import { Repo, Service } from 'mzen-om'

import {
  ConfigurationManagerInterface,
  ExpressAppManagerInterface,
  AclRegistryInterface,
  ApiConfigRegistryInterface,
  EndpointRegistrarInterface,
  LoggerInterface,
} from './interfaces'
import { ServerApiConfig } from '../api-config'
import ServerAcl from '../acl'
import { ServerRemoteObject } from '../remote-object'
import { ErrorTranslator } from '../remote-object/interfaces'

/**
 * Converts camelCase to kebab-case
 * Example: 'surveyParticipant' -> 'survey-participant'
 */
function camelToKebab(input: string): string {
  return input ? input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() : ''
}

/**
 * Responsible for endpoint registration coordination
 * Follows Single Responsibility Principle
 */
export class EndpointRegistrar implements EndpointRegistrarInterface {
  private configurationManager: ConfigurationManagerInterface
  private expressAppManager: ExpressAppManagerInterface
  private aclRegistry: AclRegistryInterface
  private apiConfigRegistry: ApiConfigRegistryInterface
  private logger: LoggerInterface
  private errorTranslator?: ErrorTranslator

  constructor(
    configurationManager: ConfigurationManagerInterface,
    expressAppManager: ExpressAppManagerInterface,
    aclRegistry: AclRegistryInterface,
    apiConfigRegistry: ApiConfigRegistryInterface,
    logger: LoggerInterface
  ) {
    this.configurationManager = configurationManager
    this.expressAppManager = expressAppManager
    this.aclRegistry = aclRegistry
    this.apiConfigRegistry = apiConfigRegistry
    this.logger = logger
  }

  registerEndpoints(): void {
    const apiConfigs = this.apiConfigRegistry.getApiConfigs()
    if (apiConfigs) {
      for (const apiConfig of apiConfigs) {
        this.registerEndpointsConfig(apiConfig)
      }
    }
  }

  private registerEndpointsConfig(config: ServerApiConfig): void {
    let remoteObjectName: string | null = null
    let remoteObject: Repo<any> | Service | null = null
    const modelManager = this.configurationManager.getModelManager()

    if (config.object) {
      remoteObject = config.object
    } else if (config.service) {
      remoteObjectName = config.service
      remoteObject = modelManager.services[remoteObjectName]
    } else if (config.repo) {
      remoteObjectName = config.repo
      remoteObject = modelManager.repos[remoteObjectName]
    }

    const path =
      config.path != null ? config.path : '/' + camelToKebab(remoteObjectName)

    const enable = config.enable ? config.enable : {}
    const aclConfig = config.acl ? config.acl : {}
    const endpointsDisable = config.disable ? config.disable : {}
    const endpointDisableGroup = config.disableGroup ? config.disableGroup : {}
    const endpoints = config.endpoints ? config.endpoints : {}

    if (!enable) return

    // Remove any endpoints that have been disabled
    for (const endpointName in endpoints) {
      const groups = endpoints[endpointName].groups
      if (Array.isArray(groups)) {
        groups.forEach(function (group) {
          if (endpoints[endpointName] && endpointDisableGroup[group] == true) {
            delete endpoints[endpointName]
          }
        })
      }
      if (endpoints[endpointName] && endpointsDisable[endpointName] == true) {
        delete endpoints[endpointName]
      }
    }

    // This service has no end points - nothing more to do
    if (Object.keys(endpoints).length == 0) return

    const acl = new ServerAcl({
      rules: aclConfig.rules,
      endpoints,
    })
    acl.loadDefaultRoleAssessors()
    acl.setRepos(modelManager.repos)
    const aclRoleAssessors = this.aclRegistry.getRoleAssessors()
    for (const role in aclRoleAssessors) {
      acl.addRoleAssessor(aclRoleAssessors[role])
    }

    const serverConfig = this.configurationManager.getConfig()
    const remote = new ServerRemoteObject(
      remoteObject,
      {
        path,
        endpoints,
        server: serverConfig,
        remoteObjectName,
      },
      modelManager
    )
    remote.setLogger(this.logger)
    remote.setErrorTranslator(this.errorTranslator)
    remote.setAcl(acl)
    remote.initRouter(this.expressAppManager.getRouter())
  }
}
