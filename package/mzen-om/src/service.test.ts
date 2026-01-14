import Service from 'service'

describe('Service', () => {
  describe('getName()', () => {
    it('should return configured name', () => {
      const checkoutService = new Service({ name: 'CheckoutService' })
      expect(checkoutService.getName()).toBe('CheckoutService')
    })
    it('should return constructor name if name not configured', () => {
      class CheckoutService extends Service {}
      const checkoutService = new CheckoutService()
      expect(checkoutService.getName()).toBe('CheckoutService')

      class NewCheckoutService extends CheckoutService {}
      const newCheckoutService = new NewCheckoutService()
      expect(newCheckoutService.getName()).toBe('NewCheckoutService')
    })
    it('should throw an exception if service name is not configured when using the default constructor', () => {
      const aService = new Service()
      expect(() => {
        aService.getName()
      }).toThrow('Service name not configured')
    })
  })
})
