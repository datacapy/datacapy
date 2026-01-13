import { MysqlWhereBuilder } from '../mysql-where-builder'
import { stripWhitespace } from '../mysql-sql-utils'

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
    expect(strippedInt).toBe("jdoc->>'$.score' = ?")
    expect(resultInt.params).toEqual([100])

    // Test floats
    const queryFloat = { rating: 4.5 }
    const resultFloat = await whereBuilder.buildWhereClause(queryFloat)
    const strippedFloat = stripWhitespace(resultFloat.clause)
    expect(strippedFloat).toBe("jdoc->>'$.rating' = ?")
    expect(resultFloat.params).toEqual([4.5])

    // Test zero
    const queryZero = { count: 0 }
    const resultZero = await whereBuilder.buildWhereClause(queryZero)
    const strippedZero = stripWhitespace(resultZero.clause)
    expect(strippedZero).toBe("jdoc->>'$.count' = ?")
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
})
