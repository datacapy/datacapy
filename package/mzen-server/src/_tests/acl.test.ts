import should = require('should')
import ServerAcl from 'acl'
import ServerAclRoleAssessor from 'acl/role-assessor'
import ServerAclRoleAssessorAll from 'acl/role-assessor/all'

describe('ServerAcl', function () {
  describe('hasRole()', function () {
    it('returns true for role "all"', function (done) {
      const acl = new ServerAcl()
      acl.addRoleAssessor(new ServerAclRoleAssessorAll())
      acl
        .hasRole('all')
        .then(function (hasRole) {
          should(hasRole).eql(true)
          done()
        })
        .catch(function (err) {
          done(err)
        })
    })
    it('delegates to role assessor', function (done) {
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
          should(hasRole).eql(true)
        })
      )

      // Test that the assessor can return false
      const aclB = new ServerAcl(config)
      aclB.addRoleAssessor(new TestAssessorFalse())
      promises.push(
        aclB.hasRole('admin').then(function (hasRole) {
          should(hasRole).eql(false)
        })
      )

      Promise.all(promises)
        .then(function () {
          done()
        })
        .catch(function (err) {
          done(err)
        })
    })
    it('role accessor evaluates context', function (done) {
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
      acl
        .hasRole('admin', { adminPassword: 'qwerty' })
        .then(function (hasRole) {
          should(hasRole).eql(true)
          done()
        })
    })
  })
  describe('isPermitted()', function () {
    it('rule allow option defaults to true', function (done) {
      const config = {
        endpoints: {},
        rules: [{ role: 'all', allow: true }],
      }
      const acl = new ServerAcl(config)
      acl.addRoleAssessor(new ServerAclRoleAssessorAll())
      acl
        .isPermitted('test')
        .then(function (permitted) {
          should(permitted).eql(true)
          done()
        })
        .catch(function (err) {
          done(err)
        })
    })
    it('rule allow option can be set to false', function (done) {
      const config = {
        endpoints: {},
        rules: [{ role: 'admin', allow: false }],
      }
      const acl = new ServerAcl(config)
      acl.addRoleAssessor(new ServerAclRoleAssessorAll())
      acl
        .isPermitted('test')
        .then(function (permitted) {
          should(permitted).eql(false)
          done()
        })
        .catch(function (err) {
          done(err)
        })
    })
    it('processes rules in sequence', function (done) {
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
      acl
        .isPermitted('guest')
        .then(function (permitted) {
          should(permitted).eql(false)
          done()
        })
        .catch(function (err) {
          done(err)
        })
    })
    it('returns conditions object if role specifies conditions', function (done) {
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
      acl
        .isPermitted('guest')
        .then(function (permitted) {
          should(permitted).eql(conditions)
          done()
        })
        .catch(function (err) {
          done(err)
        })
    })
  })
  describe('populateContext()', function () {
    it('populates context object from each role assessor initContext()', function (done) {
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
      acl
        .populateContext({}, finalContext)
        .then(function () {
          should(finalContext.admin).eql('admin condition')
          should(finalContext.guest).eql('guest condition')
          done()
        })
        .catch(function (err) {
          done(err)
        })
    })
  })
  describe('getRules()', function () {
    it('returns global rules', function () {
      const config = {
        endpoints: {},
        rules: [
          { allow: false, role: 'guest' },
          { allow: true, role: 'admin' },
        ],
      }

      const acl = new ServerAcl(config)
      const rules = acl.getRules('test')

      should(rules).eql(config.rules)
    })
    it('returns named endpoint rules', function () {
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

      should(rules).eql(config.endpoints['post-getAll'].acl.rules)
    })
    it('returns named endpoint rules with global rules prepended', function () {
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
      should(rules).eql(expectedRules)
    })
  })
  describe('setRepos()', function () {
    it('injects repos into role assessors', function () {
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

      should(assessorTeamMember.repos).eql(repos)
      should(assessorAdmin.repos).eql(repos)
    })
  })
})
