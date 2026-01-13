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
  sanitizeJsonPathKey,
  validateOperator,
  validateJsonType,
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

  describe('SQL Injection Protection', () => {
    describe('sanitizeJsonPathKey', () => {
      it('should allow valid alphanumeric keys', () => {
        expect(sanitizeJsonPathKey('name')).toBe('name')
        expect(sanitizeJsonPathKey('userName')).toBe('userName')
        expect(sanitizeJsonPathKey('user123')).toBe('user123')
        expect(sanitizeJsonPathKey('Name123')).toBe('Name123')
      })

      it('should allow underscores in keys', () => {
        expect(sanitizeJsonPathKey('user_name')).toBe('user_name')
        expect(sanitizeJsonPathKey('_private')).toBe('_private')
        expect(sanitizeJsonPathKey('user_id_123')).toBe('user_id_123')
      })

      it('should allow dots for nested paths', () => {
        expect(sanitizeJsonPathKey('address.city')).toBe('address.city')
        expect(sanitizeJsonPathKey('user.profile.name')).toBe(
          'user.profile.name'
        )
        expect(sanitizeJsonPathKey('a.b.c.d')).toBe('a.b.c.d')
      })

      it('should allow combination of alphanumeric, underscores, and dots', () => {
        expect(sanitizeJsonPathKey('user_profile.first_name')).toBe(
          'user_profile.first_name'
        )
        expect(sanitizeJsonPathKey('data123.field_456.value')).toBe(
          'data123.field_456.value'
        )
      })

      it('should reject keys with SQL injection attempts - quotes', () => {
        expect(() => sanitizeJsonPathKey("name' OR '1'='1")).toThrow(
          'Invalid JSON path key'
        )
        expect(() =>
          sanitizeJsonPathKey('name"; DROP TABLE users; --')
        ).toThrow('Invalid JSON path key')
        expect(() => sanitizeJsonPathKey("name' --")).toThrow(
          'Invalid JSON path key'
        )
      })

      it('should reject keys with SQL injection attempts - semicolons', () => {
        expect(() => sanitizeJsonPathKey('name; DELETE FROM users')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('id;')).toThrow(
          'Invalid JSON path key'
        )
      })

      it('should reject keys with SQL injection attempts - spaces', () => {
        expect(() => sanitizeJsonPathKey('name OR 1=1')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('id AND 1=1')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('user name')).toThrow(
          'Invalid JSON path key'
        )
      })

      it('should reject keys with special characters', () => {
        expect(() => sanitizeJsonPathKey('name-field')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name@domain')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name#tag')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name$var')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name%mod')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name&and')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name*star')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name(paren')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name)paren')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name+plus')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name=equals')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name[bracket')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name]bracket')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name{brace')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name}brace')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name|pipe')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name\\backslash')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name/slash')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name<less')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name>greater')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name?question')).toThrow(
          'Invalid JSON path key'
        )
      })

      it('should reject keys with control characters', () => {
        expect(() => sanitizeJsonPathKey('name\n')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name\r')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name\t')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name\0')).toThrow(
          'Invalid JSON path key'
        )
      })

      it('should reject keys with SQL comments', () => {
        expect(() => sanitizeJsonPathKey('name--comment')).toThrow(
          'Invalid JSON path key'
        )
        expect(() => sanitizeJsonPathKey('name/*comment*/')).toThrow(
          'Invalid JSON path key'
        )
      })

      it('should reject empty strings', () => {
        expect(() => sanitizeJsonPathKey('')).toThrow('Invalid JSON path key')
      })
    })

    describe('validateOperator', () => {
      it('should allow valid comparison operators', () => {
        expect(validateOperator('=')).toBe('=')
        expect(validateOperator('!=')).toBe('!=')
        expect(validateOperator('>')).toBe('>')
        expect(validateOperator('<')).toBe('<')
        expect(validateOperator('>=')).toBe('>=')
        expect(validateOperator('<=')).toBe('<=')
      })

      it('should reject invalid operators', () => {
        expect(() => validateOperator('OR')).toThrow('Invalid SQL operator')
        expect(() => validateOperator('AND')).toThrow('Invalid SQL operator')
        expect(() => validateOperator('LIKE')).toThrow('Invalid SQL operator')
        expect(() => validateOperator('IN')).toThrow('Invalid SQL operator')
        expect(() => validateOperator('BETWEEN')).toThrow(
          'Invalid SQL operator'
        )
      })

      it('should reject SQL injection attempts via operators', () => {
        expect(() => validateOperator("= OR '1'='1")).toThrow(
          'Invalid SQL operator'
        )
        expect(() => validateOperator('= --')).toThrow('Invalid SQL operator')
        expect(() => validateOperator('; DROP TABLE')).toThrow(
          'Invalid SQL operator'
        )
        expect(() => validateOperator('= UNION SELECT')).toThrow(
          'Invalid SQL operator'
        )
      })

      it('should reject operators with spaces', () => {
        expect(() => validateOperator('= ')).toThrow('Invalid SQL operator')
        expect(() => validateOperator(' =')).toThrow('Invalid SQL operator')
        expect(() => validateOperator('> OR 1=1')).toThrow(
          'Invalid SQL operator'
        )
      })

      it('should reject empty or malformed operators', () => {
        expect(() => validateOperator('')).toThrow('Invalid SQL operator')
        expect(() => validateOperator('==')).toThrow('Invalid SQL operator')
        expect(() => validateOperator('===')).toThrow('Invalid SQL operator')
        expect(() => validateOperator('<>')).toThrow('Invalid SQL operator')
      })
    })

    describe('validateJsonType', () => {
      it('should allow valid JSON types in uppercase', () => {
        expect(validateJsonType('DATETIME')).toBe('DATETIME')
        expect(validateJsonType('STRING')).toBe('STRING')
        expect(validateJsonType('INTEGER')).toBe('INTEGER')
        expect(validateJsonType('DOUBLE')).toBe('DOUBLE')
        expect(validateJsonType('BOOLEAN')).toBe('BOOLEAN')
        expect(validateJsonType('ARRAY')).toBe('ARRAY')
        expect(validateJsonType('OBJECT')).toBe('OBJECT')
        expect(validateJsonType('NULL')).toBe('NULL')
      })

      it('should allow valid JSON types in lowercase and convert to uppercase', () => {
        expect(validateJsonType('datetime')).toBe('DATETIME')
        expect(validateJsonType('string')).toBe('STRING')
        expect(validateJsonType('integer')).toBe('INTEGER')
        expect(validateJsonType('double')).toBe('DOUBLE')
        expect(validateJsonType('boolean')).toBe('BOOLEAN')
        expect(validateJsonType('array')).toBe('ARRAY')
        expect(validateJsonType('object')).toBe('OBJECT')
        expect(validateJsonType('null')).toBe('NULL')
      })

      it('should allow valid JSON types in mixed case and convert to uppercase', () => {
        expect(validateJsonType('DateTime')).toBe('DATETIME')
        expect(validateJsonType('String')).toBe('STRING')
        expect(validateJsonType('Boolean')).toBe('BOOLEAN')
      })

      it('should reject invalid JSON types', () => {
        expect(() => validateJsonType('VARCHAR')).toThrow('Invalid JSON type')
        expect(() => validateJsonType('TEXT')).toThrow('Invalid JSON type')
        expect(() => validateJsonType('INT')).toThrow('Invalid JSON type')
        expect(() => validateJsonType('FLOAT')).toThrow('Invalid JSON type')
      })

      it('should reject SQL injection attempts via type names', () => {
        expect(() => validateJsonType("STRING' OR '1'='1")).toThrow(
          'Invalid JSON type'
        )
        expect(() => validateJsonType('STRING; DROP TABLE')).toThrow(
          'Invalid JSON type'
        )
        expect(() => validateJsonType("STRING' --")).toThrow(
          'Invalid JSON type'
        )
        expect(() => validateJsonType('STRING UNION SELECT')).toThrow(
          'Invalid JSON type'
        )
      })

      it('should reject types with special characters', () => {
        expect(() => validateJsonType('STRING-TYPE')).toThrow(
          'Invalid JSON type'
        )
        expect(() => validateJsonType('STRING_TYPE')).toThrow(
          'Invalid JSON type'
        )
        expect(() => validateJsonType('STRING TYPE')).toThrow(
          'Invalid JSON type'
        )
        expect(() => validateJsonType('STRING/*comment*/')).toThrow(
          'Invalid JSON type'
        )
      })

      it('should reject empty or malformed type names', () => {
        expect(() => validateJsonType('')).toThrow('Invalid JSON type')
        expect(() => validateJsonType(' ')).toThrow('Invalid JSON type')
      })

      it('should reject SQL commands disguised as types', () => {
        expect(() => validateJsonType('DROP')).toThrow('Invalid JSON type')
        expect(() => validateJsonType('DELETE')).toThrow('Invalid JSON type')
        expect(() => validateJsonType('UPDATE')).toThrow('Invalid JSON type')
        expect(() => validateJsonType('INSERT')).toThrow('Invalid JSON type')
        expect(() => validateJsonType('SELECT')).toThrow('Invalid JSON type')
      })
    })
  })
})
