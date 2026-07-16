import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('getNextValue()', function () {
  it('returns sequential values on repeated calls', async () => {
    var counter = new Repo({ name: 'counter' })
    const dataSource = new MockDataSource({})
    counter.dataSource = dataSource

    expect(await counter.getNextValue('invoice')).toBe(1)
    expect(await counter.getNextValue('invoice')).toBe(2)
  })

  it('passes the repo collection name and counter name through to the datasource', async () => {
    var counter = new Repo({ name: 'counter' })
    const dataSource = new MockDataSource({})
    counter.dataSource = dataSource
    const getNextValueSpy = jest.spyOn(dataSource, 'getNextValue')

    await counter.getNextValue('invoice')

    expect(getNextValueSpy).toHaveBeenCalledWith(
      'counter',
      'invoice',
      undefined
    )
  })

  it('throws when no collection name is configured', async () => {
    var counter = new Repo({ name: 'counter' })
    counter.config.collectionName = undefined
    const dataSource = new MockDataSource({})
    counter.dataSource = dataSource

    await expect(counter.getNextValue('invoice')).rejects.toThrow(
      'No collection name provided'
    )
  })
})
