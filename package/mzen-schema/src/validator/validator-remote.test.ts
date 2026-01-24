import { ValidatorRemote } from 'validator/index'

describe('validator - remote', () => {
  const createMockAxios = (responseData: any) => {
    return jest.fn().mockResolvedValue({ data: responseData })
  }

  it('should return true when API returns true', async () => {
    const mockAxios = createMockAxios(true)
    const validator = new ValidatorRemote()

    const result = await validator.validate('test-value', {
      url: '/api/validate',
      axios: mockAxios,
    })

    expect(result).toBe(true)
  })

  it('should return error message when API returns a string', async () => {
    const mockAxios = createMockAxios('Username is already taken')
    const validator = new ValidatorRemote()

    const result = await validator.validate('test-value', {
      url: '/api/validate',
      axios: mockAxios,
    })

    expect(result).toBe('Username is already taken')
  })

  it('should return error array when API returns an array', async () => {
    const mockAxios = createMockAxios(['Error 1', 'Error 2'])
    const validator = new ValidatorRemote()

    const result = await validator.validate('test-value', {
      url: '/api/validate',
      axios: mockAxios,
    })

    expect(result).toEqual(['Error 1', 'Error 2'])
  })

  it('should throw when no axios instance provided', () => {
    const validator = new ValidatorRemote()

    expect(() => {
      validator.validate('test-value', { url: '/api/validate' })
    }).toThrow('Remote validator requires an axios instance')
  })

  it('should reject on network failure', async () => {
    const mockAxios = jest.fn().mockRejectedValue(new Error('Network error'))
    const validator = new ValidatorRemote()

    await expect(
      validator.validate('test-value', {
        url: '/api/validate',
        axios: mockAxios,
      })
    ).rejects.toThrow('Network error')
  })

  it('should correctly resolve paramPaths from root object', async () => {
    const mockAxios = createMockAxios(true)
    const validator = new ValidatorRemote()
    const root = { user: { id: 123, name: 'John' } }

    await validator.validate('test-value', {
      url: '/api/validate',
      axios: mockAxios,
      root,
      paramPaths: {
        userId: 'user.id',
      },
    })

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ userId: 123 }),
      })
    )
  })

  it('should correctly resolve dataPaths from root object', async () => {
    const mockAxios = createMockAxios(true)
    const validator = new ValidatorRemote()
    const root = { user: { id: 456, name: 'Jane' } }

    await validator.validate('test-value', {
      url: '/api/validate',
      axios: mockAxios,
      root,
      dataPaths: {
        userId: 'user.id',
      },
    })

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 456 }),
      })
    )
  })

  it('should include value in request data', async () => {
    const mockAxios = createMockAxios(true)
    const validator = new ValidatorRemote()

    await validator.validate('my-test-value', {
      url: '/api/validate',
      axios: mockAxios,
    })

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ value: 'my-test-value' }),
      })
    )
  })

  it('should use default method POST', async () => {
    const mockAxios = createMockAxios(true)
    const validator = new ValidatorRemote()

    await validator.validate('test-value', {
      url: '/api/validate',
      axios: mockAxios,
    })

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('should allow custom method', async () => {
    const mockAxios = createMockAxios(true)
    const validator = new ValidatorRemote()

    await validator.validate('test-value', {
      url: '/api/validate',
      method: 'GET',
      axios: mockAxios,
    })

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('should use default timeout of 5000ms', async () => {
    const mockAxios = createMockAxios(true)
    const validator = new ValidatorRemote()

    await validator.validate('test-value', {
      url: '/api/validate',
      axios: mockAxios,
    })

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 5000 })
    )
  })

  it('should allow custom timeout', async () => {
    const mockAxios = createMockAxios(true)
    const validator = new ValidatorRemote()

    await validator.validate('test-value', {
      url: '/api/validate',
      timeout: 10000,
      axios: mockAxios,
    })

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 10000 })
    )
  })

  it('should merge static params with resolved paramPaths', async () => {
    const mockAxios = createMockAxios(true)
    const validator = new ValidatorRemote()
    const root = { user: { id: 789 } }

    await validator.validate('test-value', {
      url: '/api/validate',
      axios: mockAxios,
      root,
      params: { staticParam: 'static-value' },
      paramPaths: { userId: 'user.id' },
    })

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { userId: 789, staticParam: 'static-value' },
      })
    )
  })

  it('should merge static data with resolved dataPaths', async () => {
    const mockAxios = createMockAxios(true)
    const validator = new ValidatorRemote()
    const root = { user: { id: 101 } }

    await validator.validate('test-value', {
      url: '/api/validate',
      axios: mockAxios,
      root,
      data: { staticData: 'static-value' },
      dataPaths: { userId: 'user.id' },
    })

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 101, staticData: 'static-value', value: 'test-value' },
      })
    )
  })

  it('should have getName return "remote"', () => {
    const validator = new ValidatorRemote()
    expect(validator.getName()).toBe('remote')
  })
})
