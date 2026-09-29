import ServerAclRoleAssessor from '../acl/role-assessor'
import { AclRegistry } from './acl-registry'

describe('AclRegistry', () => {
  let registry: AclRegistry

  beforeEach(() => {
    registry = new AclRegistry()
  })

  describe('constructor()', () => {
    it('initializes with empty role assessors object', () => {
      const roleAssessors = registry.getRoleAssessors()

      expect(roleAssessors).toEqual({})
    })
  })

  describe('addRoleAssessor()', () => {
    it('adds a role assessor to the registry', () => {
      const roleAssessor = new ServerAclRoleAssessor('admin')

      registry.addRoleAssessor(roleAssessor)
      const roleAssessors = registry.getRoleAssessors()

      expect(roleAssessors['admin']).toBe(roleAssessor)
    })

    it('overwrites existing role assessor with same role', () => {
      const roleAssessor1 = new ServerAclRoleAssessor('admin')
      const roleAssessor2 = new ServerAclRoleAssessor('admin')

      registry.addRoleAssessor(roleAssessor1)
      registry.addRoleAssessor(roleAssessor2)
      const roleAssessors = registry.getRoleAssessors()

      expect(roleAssessors['admin']).toBe(roleAssessor2)
    })

    it('stores multiple role assessors with different roles', () => {
      const adminAssessor = new ServerAclRoleAssessor('admin')
      const userAssessor = new ServerAclRoleAssessor('user')

      registry.addRoleAssessor(adminAssessor)
      registry.addRoleAssessor(userAssessor)
      const roleAssessors = registry.getRoleAssessors()

      expect(roleAssessors['admin']).toBe(adminAssessor)
      expect(roleAssessors['user']).toBe(userAssessor)
    })
  })

  describe('addRoleAssessors()', () => {
    it('adds multiple role assessors to the registry', () => {
      const assessors = [
        new ServerAclRoleAssessor('admin'),
        new ServerAclRoleAssessor('user'),
        new ServerAclRoleAssessor('guest'),
      ]

      registry.addRoleAssessors(assessors)
      const roleAssessors = registry.getRoleAssessors()

      expect(roleAssessors['admin']).toBe(assessors[0])
      expect(roleAssessors['user']).toBe(assessors[1])
      expect(roleAssessors['guest']).toBe(assessors[2])
    })

    it('handles empty array', () => {
      registry.addRoleAssessors([])
      const roleAssessors = registry.getRoleAssessors()

      expect(roleAssessors).toEqual({})
    })

    it('adds role assessors to existing registry', () => {
      const existingAssessor = new ServerAclRoleAssessor('admin')
      registry.addRoleAssessor(existingAssessor)

      const newAssessors = [
        new ServerAclRoleAssessor('user'),
        new ServerAclRoleAssessor('guest'),
      ]
      registry.addRoleAssessors(newAssessors)
      const roleAssessors = registry.getRoleAssessors()

      expect(roleAssessors['admin']).toBe(existingAssessor)
      expect(roleAssessors['user']).toBe(newAssessors[0])
      expect(roleAssessors['guest']).toBe(newAssessors[1])
    })
  })

  describe('getRoleAssessors()', () => {
    it('returns empty object when no assessors added', () => {
      const roleAssessors = registry.getRoleAssessors()

      expect(roleAssessors).toEqual({})
    })

    it('returns all added role assessors', () => {
      const adminAssessor = new ServerAclRoleAssessor('admin')
      const userAssessor = new ServerAclRoleAssessor('user')

      registry.addRoleAssessor(adminAssessor)
      registry.addRoleAssessor(userAssessor)
      const roleAssessors = registry.getRoleAssessors()

      expect(Object.keys(roleAssessors)).toHaveLength(2)
      expect(roleAssessors['admin']).toBe(adminAssessor)
      expect(roleAssessors['user']).toBe(userAssessor)
    })
  })
})
