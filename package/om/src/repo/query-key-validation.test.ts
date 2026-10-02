import Repo from 'repo'
import MockDataSource from 'data-source/mock'

type User = {
  _id: string
  name: string
}

const makeRepo = (schema: object = {}, config: object = {}) => {
  const repo = new Repo({
    name: 'user',
    schema,
    ...config,
  }) as Repo<User>
  repo.dataSource = new MockDataSource({ user: [{ _id: '1', name: 'Kevin' }] })
  return repo
}

describe('Repo — unknown query key warning', () => {
  const originalNodeEnv = process.env.NODE_ENV
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    warnSpy.mockRestore()
  })

  it('does not warn for a query key that is a schema field', async () => {
    const repo = makeRepo({ name: { $type: String } })
    await repo.find({ name: 'Kevin' })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('warns for a query key not present in the schema', async () => {
    const repo = makeRepo({ name: { $type: String } })
    await repo.find({ workspaceId: 'workspace-1' } as Record<string, unknown>)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"workspaceId"')
    )
  })

  it('does not warn for the primary key field even when absent from the schema spec', async () => {
    const repo = makeRepo({ name: { $type: String } })
    await repo.find({ _id: '1' })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does not warn for a custom primary key field', async () => {
    const repo = makeRepo({ name: { $type: String } }, { pkey: 'code' })
    await repo.find({ code: 'ABC' } as Record<string, unknown>)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does not warn for a $-prefixed query operator', async () => {
    const repo = makeRepo({ name: { $type: String } })
    await repo.find({ $or: [{ name: 'Kevin' }, { name: 'Tom' }] })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does not warn for a dot-notation path whose root is a schema field', async () => {
    const repo = makeRepo({ meta: { $type: Object } })
    await repo.find({ 'meta.enabled': true } as Record<string, unknown>)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does not warn for a key explicitly listed in allowedQueryFields', async () => {
    const repo = makeRepo(
      { name: { $type: String } },
      { allowedQueryFields: ['aclConditions'] }
    )
    await repo.find({ aclConditions: { $in: ['a'] } } as Record<
      string,
      unknown
    >)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does not warn in production even for an unknown key', async () => {
    process.env.NODE_ENV = 'production'
    const repo = makeRepo({ name: { $type: String } })
    await repo.find({ workspaceId: 'workspace-1' } as Record<string, unknown>)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('never blocks the query, even when it warns', async () => {
    const repo = makeRepo({ name: { $type: String } })
    const docs = await repo.find({ workspaceId: 'workspace-1' } as Record<
      string,
      unknown
    >)
    expect(docs).toBeDefined()
  })

  it('also warns on findOne and count, not just find', async () => {
    const repo = makeRepo({ name: { $type: String } })
    await repo.findOne({ workspaceId: 'workspace-1' } as Record<
      string,
      unknown
    >)
    await repo.count({ workspaceId: 'workspace-1' } as Record<string, unknown>)
    expect(warnSpy).toHaveBeenCalledTimes(2)
  })
})
