import Repo from 'repo'
import MockDataSource from 'data-source/mock'

type User = {
  _id?: string
  name: string
  deleted?: Date | null
}

function buildSoftDeleteRepo(data: { user: User[] }) {
  const repo = new Repo({
    name: 'user',
    softDelete: true,
    schema: {
      name: String,
      deleted: { $type: Date, $default: null },
    },
  }) as Repo<User>
  const dataSource = new MockDataSource(data)
  repo.dataSource = dataSource
  return { repo, dataSource }
}

describe('soft delete', () => {
  it('excludes deleted docs from find() by default', async () => {
    const { repo } = buildSoftDeleteRepo({
      user: [
        { _id: '1', name: 'Kevin', deleted: null },
        { _id: '2', name: 'Tom', deleted: new Date() },
      ],
    })

    const docs = await repo.find()
    expect(docs.length).toBe(1)
    expect(docs[0].name).toBe('Kevin')
  })

  it('excludes deleted docs from findOne() by default', async () => {
    const { repo } = buildSoftDeleteRepo({
      user: [{ _id: '2', name: 'Tom', deleted: new Date() }],
    })

    const doc = await repo.findOne({ name: 'Tom' })
    expect(doc).toBeUndefined()
  })

  it('excludes deleted docs from count() by default', async () => {
    const { repo } = buildSoftDeleteRepo({
      user: [
        { _id: '1', name: 'Kevin', deleted: null },
        { _id: '2', name: 'Tom', deleted: new Date() },
      ],
    })

    const count = await repo.count()
    expect(count).toBe(1)
  })

  it('includes deleted docs when includeDeleted option is set', async () => {
    const { repo } = buildSoftDeleteRepo({
      user: [
        { _id: '1', name: 'Kevin', deleted: null },
        { _id: '2', name: 'Tom', deleted: new Date() },
      ],
    })

    const docs = await repo.find({}, { includeDeleted: true })
    expect(docs.length).toBe(2)
  })

  it('does not exclude deleted docs when a repo does not have softDelete enabled', async () => {
    const repo = new Repo({
      name: 'user',
      schema: { name: String, deleted: { $type: Date, $default: null } },
    }) as Repo<User>
    repo.dataSource = new MockDataSource({
      user: [{ _id: '2', name: 'Tom', deleted: new Date() }],
    })

    const docs = await repo.find()
    expect(docs.length).toBe(1)
    expect(docs[0].name).toBe('Tom')
  })

  it('merges the not-deleted condition into updateOne/updateMany filters', async () => {
    const { repo, dataSource } = buildSoftDeleteRepo({ user: [] })
    const spy = jest.spyOn(dataSource, 'updateOne')

    await repo.updateOne({ name: 'Kevin' }, { $set: { name: 'Kevin Foster' } })

    expect(spy.mock.calls[0][1]).toEqual({
      name: 'Kevin',
      deleted: { $in: [null] },
    })
  })

  it('deleteOne() performs a soft delete (update) instead of removing the document', async () => {
    const { repo, dataSource } = buildSoftDeleteRepo({ user: [] })
    const updateSpy = jest.spyOn(dataSource, 'updateOne')
    const deleteSpy = jest.spyOn(dataSource, 'deleteOne')

    await repo.deleteOne({ name: 'Kevin' })

    expect(deleteSpy).not.toHaveBeenCalled()
    expect(updateSpy).toHaveBeenCalled()
    expect(dataSource.dataUpdate[0]['$set'].deleted).toBeInstanceOf(Date)
  })

  it('deleteMany() performs a soft delete (update) instead of removing documents', async () => {
    const { repo, dataSource } = buildSoftDeleteRepo({ user: [] })
    const updateSpy = jest.spyOn(dataSource, 'updateMany')
    const deleteSpy = jest.spyOn(dataSource, 'deleteMany')

    await repo.deleteMany({ name: 'Kevin' })

    expect(deleteSpy).not.toHaveBeenCalled()
    expect(updateSpy).toHaveBeenCalled()
    expect(dataSource.dataUpdate[0]['$set'].deleted).toBeInstanceOf(Date)
  })

  it('forceHardDelete option performs a real hard delete', async () => {
    const { repo, dataSource } = buildSoftDeleteRepo({ user: [] })
    const updateSpy = jest.spyOn(dataSource, 'updateOne')
    const deleteSpy = jest.spyOn(dataSource, 'deleteOne')

    await repo.deleteOne({ name: 'Kevin' }, { forceHardDelete: true })

    expect(updateSpy).not.toHaveBeenCalled()
    expect(deleteSpy).toHaveBeenCalled()
  })

  it('deleteOne() hard deletes when softDelete is not enabled', async () => {
    const repo = new Repo({
      name: 'user',
      schema: { name: String },
    }) as Repo<User>
    const dataSource = new MockDataSource({ user: [] })
    repo.dataSource = dataSource
    const deleteSpy = jest.spyOn(dataSource, 'deleteOne')

    await repo.deleteOne({ name: 'Kevin' })

    expect(deleteSpy).toHaveBeenCalled()
  })
})
