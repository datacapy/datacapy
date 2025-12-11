import {
  dateToMysqlString,
  convertValue,
  formatNestedColumnName,
  stripWhitespace,
  sanitizeIdentifier,
  quoteIdentifier,
  jsonExtract,
  jsonUnquote,
  jsonValue,
  left,
  strToDate,
} from './mysql-sql-utils'

describe('MySQL SQL Utils', () => {
  describe('dateToMysqlString', () => {
    it('should convert Date to MySQL datetime format', () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const result = dateToMysqlString(testDate)
      expect(result).toBe('2023-01-01 12:00:00')
    })

    it('should convert Date with milliseconds to MySQL datetime format', () => {
      const testDate = new Date('2023-01-01T12:30:45.123Z')
      const result = dateToMysqlString(testDate)
      expect(result).toBe('2023-01-01 12:30:45')
    })

    it('should handle timezone correctly (always UTC)', () => {
      const testDate = new Date('2023-06-15T14:30:00.000Z')
      const result = dateToMysqlString(testDate)
      expect(result).toBe('2023-06-15 14:30:00')
    })
  })

  describe('convertValue', () => {
    it('should convert Date objects to MySQL format', () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const result = convertValue(testDate)
      expect(result).toBe('2023-01-01 12:00:00')
    })

    it('should pass through non-Date values unchanged', () => {
      expect(convertValue('string')).toBe('string')
      expect(convertValue(42)).toBe(42)
      expect(convertValue(true)).toBe(true)
      expect(convertValue(null)).toBe(null)
      expect(convertValue(undefined)).toBe(undefined)
    })
  })

  describe('formatNestedColumnName', () => {
    it('should replace dots with underscores', () => {
      expect(formatNestedColumnName('address.city')).toBe('address_city')
      expect(formatNestedColumnName('user.profile.name')).toBe(
        'user_profile_name'
      )
      expect(formatNestedColumnName('simple')).toBe('simple')
    })
  })

  describe('stripWhitespace', () => {
    it('should remove new lines and extra spaces from SQL', () => {
      const sql = `
        SELECT *
        FROM \`users\`
        WHERE id = 1
      `
      const stripped = stripWhitespace(sql)
      expect(stripped).toBe('SELECT * FROM \`users\` WHERE id = 1')
    })

    it('should handle multiple spaces and tabs', () => {
      const sql = 'SELECT   *\t\tFROM    users'
      const result = stripWhitespace(sql)
      expect(result).toBe('SELECT * FROM users')
    })
  })

  describe('sanitizeIdentifier', () => {
    it('should validate and return valid identifiers', () => {
      expect(sanitizeIdentifier('valid_name')).toBe('valid_name')
      expect(sanitizeIdentifier('table123')).toBe('table123')
    })

    it('should quote identifiers when requested', () => {
      expect(sanitizeIdentifier('valid_name', true)).toBe('`valid_name`')
    })

    it('should throw for invalid identifiers', () => {
      expect(() => sanitizeIdentifier('invalid-name')).toThrow(
        'Invalid identifier'
      )
      expect(() => sanitizeIdentifier('invalid name')).toThrow(
        'Invalid identifier'
      )
    })
  })

  describe('quoteIdentifier', () => {
    it('should correctly quote an identifier', () => {
      const result = quoteIdentifier('column_name')
      expect(result).toBe('`column_name`')
    })

    it('should handle identifiers with underscores', () => {
      const result = quoteIdentifier('my_table_name')
      expect(result).toBe('`my_table_name`')
    })
  })

  describe('jsonExtract', () => {
    it('should correctly format JSON_EXTRACT', () => {
      const result = jsonExtract('doc', "'$.field'")
      expect(result).toBe("JSON_EXTRACT(doc, '$.field')")
    })

    it('should handle nested paths', () => {
      const result = jsonExtract('doc', "'$.nested.field'")
      expect(result).toBe("JSON_EXTRACT(doc, '$.nested.field')")
    })
  })

  describe('jsonUnquote', () => {
    it('should correctly format JSON_UNQUOTE', () => {
      const result = jsonUnquote("JSON_EXTRACT(doc, '$.field')")
      expect(result).toBe("JSON_UNQUOTE(JSON_EXTRACT(doc, '$.field'))")
    })

    it('should work with a simple string', () => {
      const result = jsonUnquote("'value'")
      expect(result).toBe("JSON_UNQUOTE('value')")
    })
  })

  describe('jsonValue', () => {
    it('should correctly format JSON_VALUE', () => {
      const result = jsonValue('doc', "'$.field'")
      expect(result).toBe("JSON_VALUE(doc, '$.field')")
    })
  })

  describe('left', () => {
    it('should correctly format LEFT function', () => {
      const result = left('some_column', 5)
      expect(result).toBe('LEFT(some_column, 5)')
    })

    it('should work with complex expressions', () => {
      const result = left("CONCAT(first_name, ' ', last_name)", 10)
      expect(result).toBe("LEFT(CONCAT(first_name, ' ', last_name), 10)")
    })
  })

  describe('strToDate', () => {
    it('should correctly format STR_TO_DATE function', () => {
      const result = strToDate('2023-05-15', '%Y-%m-%d')
      expect(result).toBe("STR_TO_DATE(2023-05-15, '%Y-%m-%d')")
    })

    it('should handle different date formats', () => {
      const result = strToDate('2023-05-15 10:30:00', '%Y-%m-%d %H:%i:%s')
      expect(result).toBe(
        "STR_TO_DATE(2023-05-15 10:30:00, '%Y-%m-%d %H:%i:%s')"
      )
    })

    it('should work with column references', () => {
      const result = strToDate('date_column', '%Y-%m-%d')
      expect(result).toBe("STR_TO_DATE(date_column, '%Y-%m-%d')")
    })
  })

  describe('integration of functions', () => {
    it('should correctly combine jsonExtract, jsonUnquote, and quoteIdentifier', () => {
      const doc = quoteIdentifier('my_document')
      const extracted = jsonExtract(doc, "'$.field'")
      const result = jsonUnquote(extracted)
      expect(result).toBe(
        "JSON_UNQUOTE(JSON_EXTRACT(`my_document`, '$.field'))"
      )
    })

    it('should correctly combine left and strToDate functions', () => {
      const leftResult = left('date_column', 10)
      const finalResult = strToDate(leftResult, '%Y-%m-%d')
      expect(finalResult).toBe("STR_TO_DATE(LEFT(date_column, 10), '%Y-%m-%d')")
    })
  })
})
