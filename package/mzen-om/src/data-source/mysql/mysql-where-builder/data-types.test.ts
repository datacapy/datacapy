import { MysqlWhereBuilder } from '../mysql-where-builder'
import { stripWhitespace } from '../mysql-sql-utils'

const numCompare = (field: string) =>
  `(CASE WHEN JSON_TYPE(JSON_EXTRACT(jdoc, '$.${field}')) IN ('INTEGER', 'DOUBLE', 'DECIMAL') THEN JSON_EXTRACT(jdoc, '$.${field}') ELSE NULL END)`

describe('MysqlWhereBuilder - Data Type Handling Analysis', () => {
  let whereBuilder: MysqlWhereBuilder

  beforeEach(() => {
    whereBuilder = new MysqlWhereBuilder()
  })

  it('should test numeric comparisons - current behavior', async () => {
    // Test integers
    const queryInt = { score: 100 }
    const resultInt = await whereBuilder.buildWhereClause(queryInt)
    const strippedInt = stripWhitespace(resultInt.clause)
    expect(strippedInt).toBe(`${numCompare('score')} = ?`)
    expect(resultInt.params).toEqual([100])

    // Test floats
    const queryFloat = { rating: 4.5 }
    const resultFloat = await whereBuilder.buildWhereClause(queryFloat)
    const strippedFloat = stripWhitespace(resultFloat.clause)
    expect(strippedFloat).toBe(`${numCompare('rating')} = ?`)
    expect(resultFloat.params).toEqual([4.5])

    // Test zero
    const queryZero = { count: 0 }
    const resultZero = await whereBuilder.buildWhereClause(queryZero)
    const strippedZero = stripWhitespace(resultZero.clause)
    expect(strippedZero).toBe(`${numCompare('count')} = ?`)
    expect(resultZero.params).toEqual([0])
  })

  it('should test date/string comparisons - current behavior', async () => {
    // Test date strings
    const queryDate = { createdAt: '2023-01-01' }
    const resultDate = await whereBuilder.buildWhereClause(queryDate)
    const strippedDate = stripWhitespace(resultDate.clause)
    expect(strippedDate).toBe("jdoc->>'$.createdAt' = ?")
    expect(resultDate.params).toEqual(['2023-01-01'])

    // Test regular strings
    const queryString = { name: 'John' }
    const resultString = await whereBuilder.buildWhereClause(queryString)
    const strippedString = stripWhitespace(resultString.clause)
    expect(strippedString).toBe("jdoc->>'$.name' = ?")
    expect(resultString.params).toEqual(['John'])
  })

  it('should test potential numeric edge cases', async () => {
    // Test zero (could be confused with false)
    const queryZero = { count: 0 }
    const resultZero = await whereBuilder.buildWhereClause(queryZero)
    expect(resultZero.params).toEqual([0])

    // Test negative numbers
    const queryNeg = { balance: -100 }
    const resultNeg = await whereBuilder.buildWhereClause(queryNeg)
    expect(resultNeg.params).toEqual([-100])

    // Test large numbers
    const queryLarge = { userId: 9007199254740991 } // MAX_SAFE_INTEGER
    const resultLarge = await whereBuilder.buildWhereClause(queryLarge)
    expect(resultLarge.params).toEqual([9007199254740991])

    // Test decimal precision
    const queryDecimal = { price: 19.99 }
    const resultDecimal = await whereBuilder.buildWhereClause(queryDecimal)
    expect(resultDecimal.params).toEqual([19.99])
  })

  // Regression test: ->> extracts JSON as text, so comparing a nullable numeric
  // field to a number parameter without a JSON_TYPE guard makes MySQL implicitly
  // cast the stored text side. A JSON-null-valued field renders as the literal
  // text 'null' via ->>, and casting that to compare against a number fails with
  // "Truncated incorrect DOUBLE value: 'null'" in strict SQL mode instead of just
  // not matching. This previously affected numeric equality/comparison filters
  // (e.g. ServiceUsageTracking.recordResponseStarted matching on
  // responsesStartedPeriodStartMs, which defaults to null).
  it('should guard numeric comparisons with JSON_TYPE instead of raw ->> extraction', async () => {
    const query = { responsesStartedPeriodStartMs: 1754568000000 }
    const result = await whereBuilder.buildWhereClause(query)
    expect(result.clause).not.toContain('->>')
    expect(result.clause).toContain(
      "JSON_TYPE(JSON_EXTRACT(jdoc, '$.responsesStartedPeriodStartMs'))"
    )
    expect(result.clause).toContain("IN ('INTEGER', 'DOUBLE', 'DECIMAL')")
    expect(result.params).toEqual([1754568000000])
  })
})
