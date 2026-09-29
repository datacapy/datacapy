import ModelManager from 'model-manager'
import Repo from 'repo'
import Service from 'service'
import MockDataSource from 'data-source/mock'
import Schema from '@datacapy/schema'

describe('ModelManager', () => {
  describe('init()', () => {
    describe('loadDataSources()', () => {
      it('should inject named datasource into each repo', async () => {
        const person = new Repo({ name: 'person', dataSource: 'db' })
        expect(person.dataSource).toBeUndefined()

        const modelManager = new ModelManager()
        const dataSource = new MockDataSource({})
        modelManager.dataSources = { db: dataSource }
        modelManager.addRepo(person)
        await modelManager.init()

        expect(person.dataSource).toEqual(dataSource)
      })
      it('should set config.dataSource to the default datasource name when a repo declares none, so repo.transaction() can resolve it', async () => {
        const person = new Repo({ name: 'person' })
        expect(person.config.dataSource).toBe('')

        const modelManager = new ModelManager()
        const dataSource = new MockDataSource({})
        modelManager.dataSources = { db: dataSource }
        modelManager.addRepo(person)
        await modelManager.init()

        expect(person.dataSource).toEqual(dataSource)
        expect(person.config.dataSource).toBe('db')
      })
    })
    describe('initSchemas()', () => {
      it('should inject constructors into each schema', async () => {
        const Person = function () {}
        const Post = function () {}
        const userSchema = new Schema({ $name: 'user' })

        expect(userSchema.constructors.Person).toBeUndefined()
        expect(userSchema.constructors.Post).toBeUndefined()

        const modelManager = new ModelManager()
        modelManager.addConstructor(Person)
        modelManager.addConstructor(Post)
        modelManager.addSchema(userSchema)
        await modelManager.init()

        expect(userSchema.constructors.Person).toBe(Person)
        expect(userSchema.constructors.Post).toBe(Post)
      })
      it('should inject schemas into each schema', async () => {
        const userSchema = new Schema({ $name: 'user' })
        const orderSchema = new Schema({ $name: 'order' })

        expect(userSchema.schemas.user).toBeUndefined()
        expect(userSchema.schemas.order).toBeUndefined()
        expect(orderSchema.schemas.user).toBeUndefined()
        expect(orderSchema.schemas.order).toBeUndefined()

        const modelManager = new ModelManager()
        modelManager.addSchema(userSchema)
        modelManager.addSchema(orderSchema)
        await modelManager.init()

        expect(userSchema.schemas.user).toBe(userSchema)
        expect(userSchema.schemas.order).toBe(orderSchema)
        expect(orderSchema.schemas.user).toBe(userSchema)
        expect(orderSchema.schemas.order).toBe(orderSchema)
      })
    })
    describe('initRepos()', () => {
      it('should inject constructors into each repo', async () => {
        const Order = function () {}
        const Post = function () {}
        const userRepo = new Repo({ name: 'user' })

        expect(userRepo.constructors.Order).toBeUndefined()
        expect(userRepo.constructors.Post).toBeUndefined()

        const modelManager = new ModelManager()
        modelManager.addConstructor(Order)
        modelManager.addConstructor(Post)
        modelManager.addRepo(userRepo)
        await modelManager.init()

        expect(userRepo.constructors.Order).toBe(Order)
        expect(userRepo.constructors.Post).toBe(Post)
      })
      it('should inject schemas into each repo', async () => {
        const userSchema = new Schema({ $name: 'user' })
        const orderSchema = new Schema({ $name: 'order' })
        const userRepo = new Repo({ name: 'user' })

        expect(userRepo.schemas.user).toBeUndefined()
        expect(userRepo.schemas.order).toBeUndefined()

        const modelManager = new ModelManager()
        modelManager.addSchema(userSchema)
        modelManager.addSchema(orderSchema)
        modelManager.addRepo(userRepo)
        await modelManager.init()

        expect(userRepo.schemas.user).toBe(userSchema)
        expect(userRepo.schemas.order).toBe(orderSchema)
      })
      it('should inject repos into each repo', async () => {
        const userRepo = new Repo({ name: 'user' })
        const orderRepo = new Repo({ name: 'order' })

        expect(userRepo.repos.user).toBeUndefined()
        expect(userRepo.repos.order).toBeUndefined()

        const modelManager = new ModelManager()
        modelManager.addRepo(userRepo)
        modelManager.addRepo(orderRepo)
        await modelManager.init()

        expect(userRepo.repos.user).toBe(userRepo)
        expect(userRepo.repos.order).toBe(orderRepo)
      })
      it('should inject services into each repo', async () => {
        const orderService = new Service({ name: 'order' })
        const signupService = new Service({ name: 'signup' })
        const userRepo = new Repo({ name: 'user' })

        expect(userRepo.services.order).toBeUndefined()
        expect(userRepo.services.signup).toBeUndefined()

        const modelManager = new ModelManager()
        modelManager.addService(orderService)
        modelManager.addService(signupService)
        modelManager.addRepo(userRepo)
        await modelManager.init()

        expect(userRepo.services.order).toBe(orderService)
        expect(userRepo.services.signup).toBe(signupService)
      })
    })
    describe('initServices()', () => {
      it('should inject repos into each service', async () => {
        const person = new Repo({ name: 'person' })
        const post = new Repo({ name: 'post' })
        const checkoutService = new Service({ name: 'checkout' })

        expect(checkoutService.repos.person).toBeUndefined()
        expect(checkoutService.repos.post).toBeUndefined()

        const modelManager = new ModelManager()
        modelManager.addRepo(person)
        modelManager.addRepo(post)
        modelManager.addService(checkoutService)
        await modelManager.init()

        expect(checkoutService.repos.person).toBe(person)
        expect(checkoutService.repos.post).toBe(post)
      })
      it('should inject services into each service', async () => {
        const checkoutService = new Service({ name: 'checkout' })
        const refundService = new Service({ name: 'refund' })

        expect(checkoutService.services.checkout).toBeUndefined()
        expect(checkoutService.services.refund).toBeUndefined()
        expect(refundService.services.checkout).toBeUndefined()
        expect(refundService.services.refund).toBeUndefined()

        const modelManager = new ModelManager()
        modelManager.addService(checkoutService)
        modelManager.addService(refundService)
        await modelManager.init()

        expect(checkoutService.services.checkout).toBe(checkoutService)
        expect(checkoutService.services.refund).toBe(refundService)
        expect(refundService.services.checkout).toBe(checkoutService)
        expect(refundService.services.refund).toBe(refundService)
      })
    })
  })
})
