import should = require('should')
import ServerRemoteObject from 'remote-object'
import ServerAcl from 'acl'
import ServerAclRoleAssessor from 'acl/role-assessor'
import ExpressMockRequest from './test/fixtures/express/mock-request'
import ExpressMockResponse from './test/fixtures/express/mock-response'

describe('ServerRemoteObject', function () {
  describe('getMiddlewareConfig()', function () {
    it('generates middleware for configured endpoints', async () => {
      const targetObject = {
        save: function () {
          return Promise.resolve('save response')
        },
        getLatest: function () {
          return Promise.resolve('getLatest response')
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
          },
          'get-latest': {
            path: '/latest',
            method: 'getLatest',
            verbs: ['get'],
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      should(middlewareConfigs[0].verb).eql('post')
      should(middlewareConfigs[0].path).eql('/api/save')
      should(middlewareConfigs[1].verb).eql('get')
      should(middlewareConfigs[1].path).eql('/api/latest')

      const promises: Promise<any>[] = []

      const reqSave = new ExpressMockRequest()
      const resSave = new ExpressMockResponse()
      promises.push(
        middlewareConfigs[0].callback(reqSave, resSave).then(function () {
          should(resSave.mockData).eql('save response')
        })
      )

      const reqGetLatest = new ExpressMockRequest()
      const resGetLatest = new ExpressMockResponse()
      promises.push(
        middlewareConfigs[1]
          .callback(reqGetLatest, resGetLatest)
          .then(function () {
            should(resGetLatest.mockData).eql('getLatest response')
          })
      )

      await Promise.all(promises)
    })
    it('generates middleware array ordered by priority', function () {
      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          a: {
            path: '/a',
            method: 'a',
            verbs: ['post'],
            priority: 10,
          },
          b: {
            path: '/b',
            method: 'b',
            verbs: ['get'],
            priority: -1000,
          },
          c: {
            path: '/c',
            method: 'c',
            verbs: ['get'],
            priority: 90,
          },
          d: {
            path: '/d',
            method: 'd',
            verbs: ['get'],
            priority: 100,
          },
        },
      }

      const remoteObject = new ServerRemoteObject({}, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      should(Array.isArray(middlewareConfigs)).eql(true)
      should(middlewareConfigs[0].method).eql('d')
      should(middlewareConfigs[1].method).eql('c')
      should(middlewareConfigs[2].method).eql('a')
      should(middlewareConfigs[3].method).eql('b')
    })
    it('injects configured body as field on argument to remote method', async () => {
      const targetObject = {
        save: function (data) {
          return Promise.resolve(data.theBody)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              theBody: { srcPath: 'body', src: 'request' },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      should(middlewareConfigs[0]['verb']).eql('post')
      should(middlewareConfigs[0]['path']).eql('/api/save')

      const reqSave = new ExpressMockRequest({ body: 'post body' })
      const resSave = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqSave, resSave)
      should(resSave.mockData).eql('post body')
    })
    it('injects configured body-field as argument to remote method', async () => {
      const targetObject = {
        save: function ({ content }) {
          return Promise.resolve(content)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              content: { srcPath: 'content', src: 'body' },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqSave = new ExpressMockRequest({
        body: { content: 'content value' },
      })
      const resSave = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqSave, resSave)
      should(resSave.mockData).eql('content value')
    })
    it('injects configured body-field as field on argument to remote method', async () => {
      const targetObject = {
        save: function (data) {
          return Promise.resolve(data.thebody)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              thebody: { srcPath: 'content', src: 'body' },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqSave = new ExpressMockRequest({
        body: { content: 'content value' },
      })
      const resSave = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqSave, resSave)
      should(resSave.mockData).eql('content value')
    })
    it('injects configured param to remote method', async () => {
      const targetObject = {
        getByPkey: function ({ pkey }) {
          return Promise.resolve(pkey)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'get-byPkey': {
            path: '/:pkey',
            method: 'getByPkey',
            verbs: ['get'],
            data: {
              pkey: { src: 'param' },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqGetByPkey = new ExpressMockRequest({ params: { pkey: 123 } })
      const resGetByPkey = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqGetByPkey, resGetByPkey)
      should(resGetByPkey.mockData).eql(123)
    })
    it('injects configured query-field to remote method', async () => {
      const targetObject = {
        getAll: function ({ offset }) {
          return Promise.resolve(offset)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              offset: { src: 'query' },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqGetAll = new ExpressMockRequest({ query: { offset: 50 } })
      const resGetAll = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqGetAll, resGetAll)
      should(resGetAll.mockData).eql(50)
    })
    it('injects configured query to remote method', async () => {
      const targetObject = {
        getAll: function ({ query }) {
          return Promise.resolve(query)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              query: { src: 'request' },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqGetAll = new ExpressMockRequest({ query: { offset: 50 } })
      const resGetAll = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqGetAll, resGetAll)
      should(resGetAll.mockData).eql({ offset: 50 })
    })
    it('injects configured request field as argument to remote method', async () => {
      const targetObject = {
        getAll: function ({ query }) {
          return Promise.resolve(query)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              query: { src: 'request' },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqGetAll = new ExpressMockRequest({ query: { offset: 50 } })
      const resGetAll = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqGetAll, resGetAll)
      should(resGetAll.mockData).eql(reqGetAll.query)
    })
    it('injects configured response field to remote method', async () => {
      const targetObject = {
        getAll: function ({ test }) {
          return Promise.resolve(test)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              test: { src: 'response' },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqGetAll = new ExpressMockRequest()
      const resGetAll = new ExpressMockResponse()
      resGetAll.test = 'a'
      await middlewareConfigs[0].callback(reqGetAll, resGetAll)
      should(resGetAll.mockData).eql('a')
    })
    it('injects configured config field as argument to remote method', async () => {
      const targetObject = {
        getAll: function ({ test }) {
          return Promise.resolve(test)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              test: { src: 'config' },
            },
          },
        },
        server: {
          test: 123,
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqGetAll = new ExpressMockRequest()
      const resGetAll = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqGetAll, resGetAll)
      should(resGetAll.mockData).eql(123)
    })
    it('injects configured config field path as argument to remote method', async () => {
      const targetObject = {
        getAll: function ({ test }) {
          return Promise.resolve(test)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              test: { srcPath: 'test.a.b.c', src: 'config' },
            },
          },
        },
        server: {
          test: {
            a: {
              b: {
                c: 123,
              },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqGetAll = new ExpressMockRequest()
      const resGetAll = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqGetAll, resGetAll)
      should(resGetAll.mockData).eql(123)
    })
    it('returns 200 response code by default', async () => {
      const targetObject = {
        save: function () {
          return Promise.resolve('success')
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqSave = new ExpressMockRequest()
      const resSave = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqSave, resSave)
      should(resSave.mockCode).eql(200)
    })
    it('returns configured success response code', async () => {
      const targetObject = {
        save: function () {
          return Promise.resolve('success')
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            response: {
              success: { http: { code: 202 } },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqSave = new ExpressMockRequest()
      const resSave = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqSave, resSave)
      should(resSave.mockCode).eql(202)
    })
    it('returns 500 response code on error', async () => {
      const targetObject = {
        getAll: function () {
          return Promise.reject(new Error('Error message'))
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqGetAll = new ExpressMockRequest()
      const resGetAll = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqGetAll, resGetAll)
      should(resGetAll.mockCode).eql(500)
    })
    it('returns configured error response code', async () => {
      class CustomerErrorValidation extends Error {}
      class CustomerErrorNotFound extends Error {}

      const targetObject = {
        save: function () {
          return Promise.reject(
            new CustomerErrorValidation('403 error message')
          )
        },
        getOne: function () {
          return Promise.reject(new CustomerErrorNotFound('404 error message'))
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            response: {
              error: {
                CustomerErrorValidation: { http: { code: 403 } },
                CustomerErrorNotFound: { http: { code: 404 } },
              },
            },
          },
          'get-one': {
            path: '/getOne',
            method: 'getOne',
            verbs: ['get'],
            response: {
              error: {
                CustomerErrorValidation: { http: { code: 403 } },
                CustomerErrorNotFound: { http: { code: 404 } },
              },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const promises = []

      const reqSave = new ExpressMockRequest()
      const resSave = new ExpressMockResponse()
      middlewareConfigs[0]
        .callback(reqSave, resSave)
        .then(function () {
          should(resSave.mockCode).eql(403)
        })
        .catch(function (error) {
          should(error).eql('403 error message')
        })

      const reqGetOne = new ExpressMockRequest()
      const resGetOne = new ExpressMockResponse()
      middlewareConfigs[1]
        .callback(reqGetOne, resGetOne)
        .then(function () {
          should(resGetOne.mockCode).eql(404)
        })
        .catch(function (error) {
          should(error).eql('404 error message')
        })

      await Promise.all(promises)
    })
    it('typecasts injected arguments', async () => {
      const targetObject = {
        save: function ({
          stringToNumber,
          stringToBooleanTrue,
          stringToBooleanFalse,
          stringToDate,
          stringToObjectId,
        }) {
          return Promise.resolve({
            stringToNumber: stringToNumber,
            stringToBooleanTrue: stringToBooleanTrue,
            stringToBooleanFalse: stringToBooleanFalse,
            stringToDate: stringToDate,
            stringToObjectId: stringToObjectId,
          })
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              stringToNumber: { type: Number, src: 'body' },
              stringToBooleanTrue: { type: Boolean, src: 'body' },
              stringToBooleanFalse: { type: Boolean, src: 'body' },
              stringToDate: { type: Date, src: 'body' },
              stringToObjectId: { type: 'ObjectID', src: 'body' },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqSave = new ExpressMockRequest({
        body: {
          stringToNumber: '456',
          stringToBooleanTrue: '1',
          stringToBooleanFalse: '0',
          stringToDate: '2016-12-08T17:25:55.588Z',
          stringToObjectId: '507f191e810c19729de860ea',
        },
      })
      const resSave = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqSave, resSave)

      should(resSave.mockData.stringToNumber).eql(456)
      should(resSave.mockData.stringToNumber.constructor).eql(Number)
      should(resSave.mockData.stringToBooleanTrue).eql(true)
      should(resSave.mockData.stringToBooleanTrue.constructor).eql(Boolean)
      should(resSave.mockData.stringToBooleanFalse).eql(false)
      should(resSave.mockData.stringToBooleanFalse.constructor).eql(Boolean)
      should(resSave.mockData.stringToDate.constructor).eql(Date)
      should(resSave.mockData.stringToObjectId.constructor.name).eql('ObjectID')
    })
    it('returns 403 error response code on arg "required" validation error', async () => {
      const targetObject = {
        save: function ({ name }) {
          return Promise.resolve(name)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              name: { type: String, src: 'body', required: true },
            },
          },
        },
      }

      const promises: Promise<any>[] = []

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqSaveFail = new ExpressMockRequest()
      const resSaveFail = new ExpressMockResponse()
      promises.push(
        middlewareConfigs[0]
          .callback(reqSaveFail, resSaveFail)
          .then(function () {
            should(resSaveFail.mockCode).eql(403)
          })
      )

      const reqSaveSuccess = new ExpressMockRequest({ body: { name: 'Kevin' } })
      const resSaveSuccess = new ExpressMockResponse()
      promises.push(
        middlewareConfigs[0]
          .callback(reqSaveSuccess, resSaveSuccess)
          .then(function () {
            should(resSaveSuccess.mockData).eql('Kevin')
          })
      )

      await Promise.all(promises)
    })
    it('returns 403 error response code on arg "notNull" validation error', async () => {
      const targetObject = {
        save: function ({ name }) {
          return Promise.resolve(name)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              name: { type: String, src: 'body', notNull: true },
            },
          },
        },
      }

      const promises: Promise<any>[] = []

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqSaveFail = new ExpressMockRequest({ body: { name: 'NULL' } })
      const resSaveFail = new ExpressMockResponse()
      promises.push(
        middlewareConfigs[0]
          .callback(reqSaveFail, resSaveFail)
          .then(function () {
            should(resSaveFail.mockCode).eql(403)
          })
      )

      const reqSaveSuccess = new ExpressMockRequest({ body: { name: 'Kevin' } })
      const resSaveSuccess = new ExpressMockResponse()
      promises.push(
        middlewareConfigs[0]
          .callback(reqSaveSuccess, resSaveSuccess)
          .then(function () {
            should(resSaveSuccess.mockData).eql('Kevin')
          })
      )

      await Promise.all(promises)
    })
    it('injects callback arg with default value for undefined input', async () => {
      const targetObject = {
        save: function ({ name }) {
          return Promise.resolve(name)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              name: { type: String, src: 'body', defaultValue: 'Kevin' },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqSave = new ExpressMockRequest()
      const resSave = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqSave, resSave)
      should(resSave.mockData).eql('Kevin')
    })
    it('injects callback arg with default value for null input', async () => {
      const targetObject = {
        save: function ({ name }) {
          return Promise.resolve(name)
        },
      }

      const config = {
        path: '/api',
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              name: { type: String, src: 'body', defaultValue: 'Kevin' },
            },
          },
        },
      }

      const remoteObject = new ServerRemoteObject(targetObject, config)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const reqSave = new ExpressMockRequest({ body: { name: null } })
      const resSave = new ExpressMockResponse()
      await middlewareConfigs[0].callback(reqSave, resSave)
      should(resSave.mockData).eql('Kevin')
    })
    it('returns 401 unauthorized if not permitted by ACL', async () => {
      const targetObject = {
        getAll: function () {
          return Promise.resolve()
        },
      }

      const config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/',
            method: 'getAll',
            verbs: ['get'],
            data: {},
            acl: {
              rules: [{ allow: false, role: 'all' }],
            },
          },
        },
      }

      const acl = new ServerAcl({
        endpoints: config.endpoints,
      })
      acl.loadDefaultRoleAssessors()

      const remoteObject = new ServerRemoteObject(targetObject, config)
      remoteObject.setAcl(acl)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const req = new ExpressMockRequest()
      const res = new ExpressMockResponse()
      await middlewareConfigs[0].callback(req, res)
      should(res.mockCode).eql(401)
    })
    it('executes remote method if ACL permits', async () => {
      const targetObject = {
        getAll: function () {
          return Promise.resolve('success')
        },
      }

      const config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/',
            method: 'getAll',
            verbs: ['get'],
            data: {},
            acl: {
              rules: [{ allow: true, role: 'all' }],
            },
          },
        },
      }

      const acl = new ServerAcl({
        endpoints: config.endpoints,
      })

      const remoteObject = new ServerRemoteObject(targetObject, config)
      remoteObject.setAcl(acl)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const req = new ExpressMockRequest()
      const res = new ExpressMockResponse()
      await middlewareConfigs[0].callback(req, res)
      should(res.mockData).eql('success')
    })
    it('injects aclContext into callack method', async () => {
      const targetObject = {
        // aclContext and aclConditions are always appended as arguments - they are no configurable as with requestArgs
        getAll: function ({ aclContext }) {
          return Promise.resolve(aclContext)
        },
      }

      const config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/',
            method: 'getAll',
            verbs: ['get'],
            data: {},
            acl: {
              rules: [{ allow: true, role: 'all' }],
            },
          },
        },
      }

      class MockRoleAssessor extends ServerAclRoleAssessor {
        async initContext(_request, context) {
          context.user = { id: '123' }
        }
      }

      const acl = new ServerAcl({
        endpoints: config.endpoints,
      })
      acl.addRoleAssessor(new MockRoleAssessor('user'))

      const remoteObject = new ServerRemoteObject(targetObject, config)
      remoteObject.setAcl(acl)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const req = new ExpressMockRequest()
      const res = new ExpressMockResponse()
      await middlewareConfigs[0].callback(req, res)
      should(res.mockData.user.id).eql('123')
    })
    it('injects aclConditions into callack method', async () => {
      const targetObject = {
        // aclContext and aclConditions are always appended as arguments - they are no configurable as with requestArgs
        getAll: function ({ aclConditions }) {
          return Promise.resolve(aclConditions)
        },
      }

      const config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/',
            method: 'getAll',
            verbs: ['get'],
            data: {},
            acl: {
              rules: [{ allow: true, role: 'user' }],
            },
          },
        },
      }

      class MockRoleAssessor extends ServerAclRoleAssessor {
        async hasRole(_context) {
          return { userId: '123' }
        }
      }

      const acl = new ServerAcl({
        endpoints: config.endpoints,
      })
      acl.addRoleAssessor(new MockRoleAssessor('user'))

      const remoteObject = new ServerRemoteObject(targetObject, config)
      remoteObject.setAcl(acl)
      const middlewareConfigs = remoteObject.getMiddlewareConfig()

      const req = new ExpressMockRequest()
      const res = new ExpressMockResponse()
      await middlewareConfigs[0].callback(req, res)
      should(res.mockData.userId).eql('123')
    })
  })
})
