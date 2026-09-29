import SchemaManager from 'manager'
import Schema from 'schema'

describe('SchemaManager', () => {
  describe('init()', () => {
    it('should inject schemas into each schema', async () => {
      const userSchema = new Schema({ $name: 'user' })
      const orderSchema = new Schema({ $name: 'order' })

      expect(userSchema.schemas.user).toBeUndefined()
      expect(userSchema.schemas.order).toBeUndefined()
      expect(orderSchema.schemas.user).toBeUndefined()
      expect(orderSchema.schemas.order).toBeUndefined()

      const schemaManager = new SchemaManager()
      schemaManager.addSchema(userSchema)
      schemaManager.addSchema(orderSchema)

      await schemaManager.init()

      expect(userSchema.schemas.user).toBe(userSchema)
      expect(userSchema.schemas.order).toBe(orderSchema)
      expect(orderSchema.schemas.user).toBe(userSchema)
      expect(orderSchema.schemas.order).toBe(orderSchema)
    })

    it('should inject constructors into each schema', async () => {
      function User() {}
      function Order() {}

      const userSchema = new Schema({ $name: 'user' })
      const orderSchema = new Schema({ $name: 'order' })

      expect(userSchema.constructors.User).toBeUndefined()
      expect(userSchema.constructors.Order).toBeUndefined()
      expect(orderSchema.constructors.User).toBeUndefined()
      expect(orderSchema.constructors.Order).toBeUndefined()

      const schemaManager = new SchemaManager()
      schemaManager.addSchema(userSchema)
      schemaManager.addSchema(orderSchema)
      schemaManager.addConstructor(User)
      schemaManager.addConstructor(Order)

      await schemaManager.init()

      expect(userSchema.constructors.User).toBe(User)
      expect(userSchema.constructors.Order).toBe(Order)
      expect(orderSchema.constructors.User).toBe(User)
      expect(orderSchema.constructors.Order).toBe(Order)
    })
  })
})
