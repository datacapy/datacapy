import ServerAcl from './acl'
import ServerAclRoleAssessor from './acl/role-assessor'
import ServerAclRoleAssessorAll from './acl/role-assessor/all'

describe('ServerAcl', function () {
  describe('hasRole()', function () {
    it('returns true for role "all"', async () => {
      const acl = new ServerAcl()
      acl.addRoleAssessor(new ServerAclRoleAssessorAll())
      const hasRole = await acl.hasRole('all')
      expect(hasRole).toBe(true)
    })
    it('delegates to role assessor', async () => {
      const config = {
        endpoints: {},
        rules: [{ role: 'admin', allow: true }],
      }

      class TestAssessorTrue extends ServerAclRoleAssessor {
        constructor() {
          super('admin')
        }

        hasRole(_context) {
          return Promise.resolve(true)
        }
      }

      class TestAssessorFalse extends ServerAclRoleAssessor {
        constructor() {
          super('admin')
        }
        hasRole(_context) {
          return Promise.resolve(false)
        }
      }

      const promises: Promise<boolean | void>[] = []

      // Test that the assessor can return true
      const aclA = new ServerAcl(config)
      aclA.addRoleAssessor(new TestAssessorTrue())
      promises.push(
        aclA.hasRole('admin').then(function (hasRole) {
          expect(hasRole).toBe(true)
        })
      )

      // Test that the assessor can return false
      const aclB = new ServerAcl(config)
      aclB.addRoleAssessor(new TestAssessorFalse())
      promises.push(
        aclB.hasRole('admin').then(function (hasRole) {
          expect(hasRole).toBe(false)
        })
      )

      await Promise.all(promises)
    })
    it('role accessor evaluates context', async () => {
      const config = {
        endpoints: {},
        rules: [{ role: 'admin', allow: true }],
      }
      class TestAssessor extends ServerAclRoleAssessor {
        constructor() {
          super('admin')
        }
        hasRole(context) {
          return Promise.resolve(context.adminPassword == 'qwerty')
        }
      }

      const acl = new ServerAcl(config)
      acl.addRoleAssessor(new TestAssessor())
      const hasRole = await acl.hasRole('admin', { adminPassword: 'qwerty' })
      expect(hasRole).toBe(true)
    })
  })
  describe('isPermitted()', function () {
    it('rule allow option defaults to true', async () => {
      const config = {
        endpoints: {},
        rules: [{ role: 'all', allow: true }],
      }
      const acl = new ServerAcl(config)
      acl.addRoleAssessor(new ServerAclRoleAssessorAll())
      const permitted = await acl.isPermitted('test')
      expect(permitted).toBe(true)
    })
    it('rule allow option can be set to false', async () => {
      const config = {
        endpoints: {},
        rules: [{ role: 'admin', allow: false }],
      }
      const acl = new ServerAcl(config)
      acl.addRoleAssessor(new ServerAclRoleAssessorAll())
      const permitted = await acl.isPermitted('test')
      expect(permitted).toBe(false)
    })
    it('processes rules in sequence', async () => {
      const config = {
        endpoints: {},
        rules: [
          { allow: true, role: 'all' },
          { allow: false, role: 'guest' },
          { allow: true, role: 'admin' },
          { allow: false, role: 'public' },
        ],
      }

      class AclAssessorGuest extends ServerAclRoleAssessor {
        constructor() {
          super('guest')
        }
        hasRole(context) {
          return Promise.resolve(!!context)
        }
      }

      class AclAssessorAdmin extends ServerAclRoleAssessor {
        constructor() {
          super('admin')
        }
        hasRole(context) {
          return Promise.resolve(!!context)
        }
      }

      class AclAssessorPublic extends ServerAclRoleAssessor {
        constructor() {
          super('public')
        }
        hasRole(context) {
          return Promise.resolve(!!context)
        }
      }

      const acl = new ServerAcl(config)
      acl.addRoleAssessor(new AclAssessorGuest())
      acl.addRoleAssessor(new AclAssessorAdmin())
      acl.addRoleAssessor(new AclAssessorPublic())
      const permitted = await acl.isPermitted('guest')
      expect(permitted).toBe(false)
    })
    it('returns conditions object if role specifies conditions', async () => {
      const config = {
        endpoints: {},
        rules: [
          { allow: true, role: 'all' },
          { allow: false, role: 'guest' },
          { allow: true, role: 'admin' },
          { allow: false, role: 'public' },
        ],
      }

      const conditions = { isAdmin: 1 }

      class AclAssessorGuest extends ServerAclRoleAssessor {
        constructor() {
          super('guest')
        }
        hasRole(context) {
          return Promise.resolve(!!context)
        }
      }

      class AclAssessorAdmin extends ServerAclRoleAssessor {
        constructor() {
          super('admin')
        }
        hasRole(context) {
          return Promise.resolve(!!context ? conditions : false)
        }
      }

      const acl = new ServerAcl(config)
      acl.addRoleAssessor(new AclAssessorGuest())
      acl.addRoleAssessor(new AclAssessorAdmin())
      const permitted = await acl.isPermitted('guest')
      expect(permitted).toEqual(conditions)
    })
    it('denies when a role returning conditions is matched by an allow:false rule', async () => {
      const config = {
        endpoints: {},
        rules: [{ allow: false, role: 'workspaceAdmin' }],
      }

      class AclAssessorWorkspaceAdmin extends ServerAclRoleAssessor {
        constructor() {
          super('workspaceAdmin')
        }
        hasRole(context) {
          // Returns a conditions object, same shape as the real
          // workspaceAdmin/workspaceOwner assessors, whenever the role applies.
          return Promise.resolve(!!context ? { workspaceAdmin: ['p1'] } : false)
        }
      }

      const acl = new ServerAcl(config)
      acl.addRoleAssessor(new AclAssessorWorkspaceAdmin())
      const permitted = await acl.isPermitted('test', {})
      expect(permitted).toBe(false)
    })
  })
  describe('populateContext()', function () {
    it('populates context object from each role assessor initContext()', async () => {
      const config = {
        endpoints: {},
        rules: [
          { allow: false, role: 'guest' },
          { allow: true, role: 'admin' },
        ],
      }

      //var conditions = {isAdmin: 1};

      class AclAssessorGuest extends ServerAclRoleAssessor {
        constructor() {
          super('guest')
        }
        initContext(request, context) {
          request = request ? request : {}
          context['guest'] = 'guest condition'
          return Promise.resolve()
        }
      }

      class AclAssessorAdmin extends ServerAclRoleAssessor {
        constructor() {
          super('admin')
        }
        initContext(request, context) {
          request = request ? request : {}
          context['admin'] = 'admin condition'
          return Promise.resolve()
        }
      }

      const finalContext = {} as { admin: string; guest: string }

      const acl = new ServerAcl(config)
      acl.addRoleAssessor(new AclAssessorGuest())
      acl.addRoleAssessor(new AclAssessorAdmin())
      await acl.populateContext({}, finalContext)
      expect(finalContext.admin).toEqual('admin condition')
      expect(finalContext.guest).toEqual('guest condition')
    })
  })
  describe('getRules()', function () {
    it('returns global rules', () => {
      const config = {
        endpoints: {},
        rules: [
          { allow: false, role: 'guest' },
          { allow: true, role: 'admin' },
        ],
      }

      const acl = new ServerAcl(config)
      const rules = acl.getRules('test')

      expect(rules).toEqual(config.rules)
    })
    it('returns named endpoint rules', () => {
      const config = {
        rules: [],
        endpoints: {
          'post-getAll': {
            acl: {
              rules: [
                { role: 'authed', allow: true },
                { role: 'admin', allow: true },
              ],
            },
          },
        },
      }

      const acl = new ServerAcl(config)
      const rules = acl.getRules('post-getAll')

      expect(rules).toEqual(config.endpoints['post-getAll'].acl.rules)
    })
    it('returns named endpoint rules with global rules prepended', () => {
      const config = {
        rules: [
          { allow: false, role: 'guest' },
          { allow: true, role: 'admin' },
        ],
        endpoints: {
          'post-getAll': {
            acl: {
              rules: [
                { allow: true, role: 'authed' },
                { allow: true, role: 'admin' },
              ],
            },
          },
        },
      }

      const acl = new ServerAcl(config)
      const rules = acl.getRules('post-getAll')

      const expectedRules = config.rules.concat(
        config.endpoints['post-getAll'].acl.rules
      )
      expect(rules).toEqual(expectedRules)
    })
  })
  describe('setRepos()', function () {
    it('injects repos into role assessors', () => {
      class AclAssessorTeamMember extends ServerAclRoleAssessor {
        constructor() {
          super('team-member')
        }
      }

      class AclAssessorAdmin extends ServerAclRoleAssessor {
        constructor() {
          super('admin')
        }
      }

      const repos = {
        teamMember: [],
        admin: [],
      }

      const acl = new ServerAcl()
      const assessorTeamMember = new AclAssessorTeamMember()
      const assessorAdmin = new AclAssessorAdmin()
      acl.addRoleAssessor(assessorTeamMember)
      acl.addRoleAssessor(assessorAdmin)
      acl.setRepos(repos)

      expect(assessorTeamMember.repos).toEqual(repos)
      expect(assessorAdmin.repos).toEqual(repos)
    })
  })
})
