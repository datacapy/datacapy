import ServerAclRoleAssessor from '../acl/role-assessor'
import { AclRegistryInterface } from './interfaces'

/**
 * Responsible for role assessor management
 * Follows Single Responsibility Principle
 */
export class AclRegistry implements AclRegistryInterface {
  private aclRoleAssessors: { [key: string]: any }

  constructor() {
    this.aclRoleAssessors = {}
  }

  addRoleAssessor(roleAssessor: ServerAclRoleAssessor): void {
    this.aclRoleAssessors[roleAssessor.role] = roleAssessor
  }

  addRoleAssessors(roleAssessors: ServerAclRoleAssessor[]): void {
    roleAssessors.forEach((roleAssessor) => {
      this.addRoleAssessor(roleAssessor)
    })
  }

  getRoleAssessors(): { [key: string]: any } {
    return this.aclRoleAssessors
  }
}
