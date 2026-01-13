import { MysqlWhereBuilder } from '../mysql-where-builder'
import { stripWhitespace } from '../mysql-sql-utils'

describe('MysqlWhereBuilder - Boolean Handling', () => {
  let whereBuilder: MysqlWhereBuilder

  beforeEach(() => {
    whereBuilder = new MysqlWhereBuilder()
  })

  it('should handle boolean values with direct equality', async () => {
    const query = { isActive: true }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe("JSON_EXTRACT(jdoc, '$.isActive') = ?")
    expect(result.params).toEqual([true])
  })

  it('should handle boolean values with $eq operator', async () => {
    const query = { isActive: { $eq: false } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe("JSON_EXTRACT(jdoc, '$.isActive') = ?")
    expect(result.params).toEqual([false])
  })

  it('should handle boolean values with $ne operator', async () => {
    const query = { isActive: { $ne: true } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe("JSON_EXTRACT(jdoc, '$.isActive') != ?")
    expect(result.params).toEqual([true])
  })

  it('should handle mixed boolean, null, and other types', async () => {
    const query = {
      isActive: true,
      name: null,
      age: { $eq: 25 },
      status: { $ne: false },
    }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "JSON_EXTRACT(jdoc, '$.isActive') = ? AND JSON_TYPE(JSON_EXTRACT(jdoc, '$.name')) = 'NULL' AND jdoc->>'$.age' = ? AND JSON_EXTRACT(jdoc, '$.status') != ?"
    )
    expect(result.params).toEqual([true, 25, false])
  })

  it('should handle nested boolean fields', async () => {
    const query = { 'publish.published': true }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe("JSON_EXTRACT(jdoc, '$.publish.published') = ?")
    expect(result.params).toEqual([true])
  })
})
