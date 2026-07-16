import DataSourceDynamic from 'data-source/dynamic'

describe('DataSourceDynamic', () => {
  describe('getNextValue', () => {
    it('rejects, directing callers to use repo methods with DataSourceContext', async () => {
      const dataSource = new DataSourceDynamic()
      await expect(
        dataSource.getNextValue('counters', 'invoice')
      ).rejects.toThrow(
        'Cannot query dynamic datasource directly. Use repo methods with DataSourceContext (e.g., repo.getNextValue(counterName, options, context))'
      )
    })
  })

  describe('bulkWrite', () => {
    it('rejects, directing callers to use repo methods with DataSourceContext', async () => {
      const dataSource = new DataSourceDynamic()
      await expect(
        dataSource.bulkWrite('users', [
          { insertOne: { document: { name: 'Kevin' } } },
        ])
      ).rejects.toThrow(
        'Cannot bulk write to dynamic datasource directly. Use repo methods with DataSourceContext'
      )
    })
  })
})
