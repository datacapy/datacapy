// cspell:ignore Conn
import { DataSourceMysql } from './mysql'
import { createPool as mysqlCreatePool } from 'mysql2/promise'

import { JSON_DOCUMENT_COLUMN_NAME } from './mysql/mysql-constants'

jest.mock('mysql2/promise')

describe('DataSourceMysql', () => {
  let dataSource: DataSourceMysql
  let mockQuery: jest.Mock

  beforeEach(() => {
    mockQuery = jest.fn()
    const createPool = mysqlCreatePool as jest.Mock
    createPool.mockReturnValue({
      query: mockQuery,
    })
    dataSource = new DataSourceMysql({
      host: 'localhost',
      user: 'test',
      password: 'test',
      database: 'testdb',
    })
  })

  describe('find', () => {
    it('should support fields option for inclusion', async () => {
      const mockResult = [
        {
          [JSON_DOCUMENT_COLUMN_NAME]: {
            id: 1,
            name: 'John',
            age: 30,
            email: 'john@example.com',
          },
        },
        {
          [JSON_DOCUMENT_COLUMN_NAME]: {
            id: 2,
            name: 'Jane',
            age: 25,
            email: 'jane@example.com',
          },
        },
      ]
      mockQuery.mockResolvedValue([mockResult, []])

      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      const result = await dataSource.find(
        'users',
        {},
        { fields: { name: 1, age: 1 } }
      )
      expect(result).toEqual([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ])
    })

    it('should support fields option for exclusion', async () => {
      const mockResult = [
        {
          [JSON_DOCUMENT_COLUMN_NAME]: {
            id: 1,
            name: 'John',
            age: 30,
            email: 'john@example.com',
          },
        },
        {
          [JSON_DOCUMENT_COLUMN_NAME]: {
            id: 2,
            name: 'Jane',
            age: 25,
            email: 'jane@example.com',
          },
        },
      ]
      mockQuery.mockResolvedValue([mockResult])

      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      const result = await dataSource.find(
        'users',
        {},
        { fields: { email: 0 } }
      )

      expect(result).toEqual([
        { id: 1, name: 'John', age: 30 },
        { id: 2, name: 'Jane', age: 25 },
      ])
    })
  })

  describe('groupCount', () => {
    it('should query and transform rows', async () => {
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(true)
      mockQuery.mockResolvedValue([[{ surveyId: 'survey-1', count: 3 }]])

      const result = await dataSource.groupCount('surveyResponse', ['surveyId'])

      expect(result).toEqual([{ _id: { surveyId: 'survey-1' }, count: 3 }])
    })
  })

  describe('findOne', () => {
    it('should handle queries with null values (regression test for bug)', async () => {
      // This test reproduces the bug where findOne with stopped: null wasn't matching records
      const mockResult = [
        {
          [JSON_DOCUMENT_COLUMN_NAME]: {
            _id: 'event-123',
            surveyId: 'survey-456',
            projectId: 'project-789',
            stopped: null,
          },
        },
      ]
      mockQuery.mockResolvedValue([mockResult])

      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)

      const result = await dataSource.findOne('surveyPublishEvent', {
        surveyId: 'survey-456',
        projectId: 'project-789',
        stopped: null,
      })

      expect(result).toBeDefined()
      expect(result).toEqual({
        _id: 'event-123',
        surveyId: 'survey-456',
        projectId: 'project-789',
        stopped: null,
      })

      // Verify that setColumnExistsChecker was called
      expect(mockQuery).toHaveBeenCalled()
      const sqlCall = mockQuery.mock.calls[0][0]
      // Verify the SQL includes proper NULL check using JSON_TYPE
      expect(sqlCall).toContain('JSON_TYPE')
      expect(sqlCall).toContain('JSON_EXTRACT')
      expect(sqlCall).toContain("= 'NULL'")
    })

    it('should support fields option for inclusion', async () => {
      const mockResult = [
        {
          [JSON_DOCUMENT_COLUMN_NAME]: {
            id: 1,
            name: 'John',
            age: 30,
            email: 'john@example.com',
          },
        },
      ]
      mockQuery.mockResolvedValue([mockResult])

      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      const result = await dataSource.findOne(
        'users',
        { id: 1 },
        { fields: { name: 1, age: 1 } }
      )

      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should support fields option for exclusion', async () => {
      const mockResult = [
        {
          [JSON_DOCUMENT_COLUMN_NAME]: {
            id: 1,
            name: 'John',
            age: 30,
            email: 'john@example.com',
          },
        },
      ]
      mockQuery.mockResolvedValue([mockResult])

      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      const result = await dataSource.findOne(
        'users',
        { id: 1 },
        { fields: { email: 0 } }
      )

      expect(result).toEqual({ id: 1, name: 'John', age: 30 })
    })

    it('should return null when no results are found', async () => {
      mockQuery.mockResolvedValue([[]])

      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      const result = await dataSource.findOne(
        'users',
        { id: 999 },
        { fields: { name: 1 } }
      )

      expect(result).toBeNull()
    })
  })

  describe('formatNestedColumnName', () => {
    it('should replace dots with underscores for simple nested path', () => {
      const result = (dataSource as any).formatNestedColumnName('address.city')
      expect(result).toBe('address_city')
    })

    it('should replace dots with underscores for deeply nested path', () => {
      const result = (dataSource as any).formatNestedColumnName(
        'user.profile.preferences.theme'
      )
      expect(result).toBe('user_profile_preferences_theme')
    })

    it('should handle single-level field names without changes', () => {
      const result = (dataSource as any).formatNestedColumnName('name')
      expect(result).toBe('name')
    })

    it('should handle field names with multiple consecutive dots', () => {
      const result = (dataSource as any).formatNestedColumnName('a..b.c')
      expect(result).toBe('a__b_c')
    })
  })

  describe('createIndex with nested fields', () => {
    beforeEach(() => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      jest.spyOn(dataSource, 'indexExists' as any).mockResolvedValue(false)
      mockQuery.mockResolvedValue([{ affectedRows: 1 }])
    })

    it('should create index for nested field with proper column name', async () => {
      await dataSource.createIndex('users', { 'address.city': 1 })

      const calls = mockQuery.mock.calls
      const addColumnCall = calls.find((call) =>
        call[0].includes('ADD COLUMN `gen_address_city`')
      )
      expect(addColumnCall).toBeDefined()
      expect(addColumnCall[0]).toContain("JSON_VALUE(jdoc, '$.address.city')")
    })

    it('should create index for deeply nested field', async () => {
      await dataSource.createIndex(
        'products',
        { 'meta.pricing.discount.amount': -1 },
        { typeHint: 'decimal' }
      )

      const calls = mockQuery.mock.calls
      const addColumnCall = calls.find((call) =>
        call[0].includes('ADD COLUMN `gen_meta_pricing_discount_amount`')
      )
      expect(addColumnCall).toBeDefined()
      expect(addColumnCall[0]).toContain(
        "JSON_VALUE(jdoc, '$.meta.pricing.discount.amount')"
      )
    })

    it('should create index with multiple nested fields', async () => {
      await dataSource.createIndex('users', {
        'address.city': 1,
        'profile.age': -1,
      })

      const calls = mockQuery.mock.calls
      const addressColumnCall = calls.find((call) =>
        call[0].includes('ADD COLUMN `gen_address_city`')
      )
      const profileColumnCall = calls.find((call) =>
        call[0].includes('ADD COLUMN `gen_profile_age`')
      )
      expect(addressColumnCall).toBeDefined()
      expect(profileColumnCall).toBeDefined()
    })

    it('should handle mixed single-level and nested fields', async () => {
      await dataSource.createIndex('users', {
        'name': 1,
        'address.city': -1,
      })

      const calls = mockQuery.mock.calls
      const nameColumnCall = calls.find((call) =>
        call[0].includes('ADD COLUMN `gen_name`')
      )
      const addressColumnCall = calls.find((call) =>
        call[0].includes('ADD COLUMN `gen_address_city`')
      )
      expect(nameColumnCall).toBeDefined()
      expect(addressColumnCall).toBeDefined()
      expect(nameColumnCall[0]).toContain("JSON_VALUE(jdoc, '$.name')")
      expect(addressColumnCall[0]).toContain(
        "JSON_VALUE(jdoc, '$.address.city')"
      )
    })

    it('should use per-field typeHint when typeHint is an object', async () => {
      await dataSource.createIndex(
        'projectSubscription',
        { subscriptionCode: 1, started: -1 },
        { typeHint: { started: 'timestamp' } }
      )

      const calls = mockQuery.mock.calls
      const startedColumnCall = calls.find((call) =>
        call[0].includes('ADD COLUMN `gen_started`')
      )
      const codeColumnCall = calls.find((call) =>
        call[0].includes('ADD COLUMN `gen_subscriptionCode`')
      )
      expect(startedColumnCall).toBeDefined()
      expect(startedColumnCall[0]).toContain('TIMESTAMP(3)')
      expect(codeColumnCall).toBeDefined()
      // subscriptionCode has no typeHint entry so defaults to VARCHAR
      expect(codeColumnCall[0]).not.toContain('TIMESTAMP')
    })

    it('should fall back to undefined typeHint for fields not in the object', async () => {
      await dataSource.createIndex(
        'orders',
        { status: 1, created: -1 },
        { typeHint: { created: 'timestamp' } }
      )

      const calls = mockQuery.mock.calls
      const createdColumnCall = calls.find((call) =>
        call[0].includes('ADD COLUMN `gen_created`')
      )
      const statusColumnCall = calls.find((call) =>
        call[0].includes('ADD COLUMN `gen_status`')
      )
      expect(createdColumnCall).toBeDefined()
      expect(createdColumnCall[0]).toContain('TIMESTAMP(3)')
      expect(statusColumnCall).toBeDefined()
      expect(statusColumnCall[0]).not.toContain('TIMESTAMP')
    })

    it('should skip column creation when columnExists is true, even with object typeHint', async () => {
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(true)

      await dataSource.createIndex(
        'projectSubscription',
        { subscriptionCode: 1, started: -1 },
        { typeHint: { started: 'timestamp' } }
      )

      const calls = mockQuery.mock.calls
      const addColumnCall = calls.find((call) => call[0].includes('ADD COLUMN'))
      expect(addColumnCall).toBeUndefined()
    })
  })

  describe('upsertOne', () => {
    it('should return { count: 1, upsertedCount: 0 } when the UPDATE matches a row', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery.mockResolvedValue([{ affectedRows: 1 }])

      const result = await dataSource.upsertOne(
        'users',
        { email: 'x@y.com' },
        { $set: { name: 'Bob' } }
      )
      expect(result).toEqual({ count: 1, upsertedCount: 0 })
    })

    it('should execute only an UPDATE query when the row exists', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery.mockResolvedValue([{ affectedRows: 1 }])

      await dataSource.upsertOne(
        'users',
        { email: 'x@y.com' },
        { $set: { name: 'Bob' } }
      )
      const statements: string[] = mockQuery.mock.calls.map(
        (c) => c[0] as string
      )
      expect(
        statements.some((s) => s.trim().toUpperCase().startsWith('UPDATE'))
      ).toBe(true)
      expect(
        statements.some((s) => s.trim().toUpperCase().startsWith('INSERT'))
      ).toBe(false)
    })

    it('should INSERT when the UPDATE matches no rows and return { count: 1, upsertedCount: 1, upsertedId }', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 42 }])

      const result = await dataSource.upsertOne(
        'users',
        { email: 'x@y.com' },
        { $set: { name: 'Bob' } }
      )
      expect(result).toEqual({ count: 1, upsertedCount: 1, upsertedId: 42 })
    })

    it('should merge scalar filter fields with $set fields into the insert document', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }])

      await dataSource.upsertOne(
        'users',
        { email: 'x@y.com' },
        { $set: { name: 'Bob' } }
      )
      const insertCall = mockQuery.mock.calls.find((c) =>
        (c[0] as string).trim().toUpperCase().startsWith('INSERT')
      )
      expect(insertCall).toBeDefined()
      const insertedDoc = JSON.parse(insertCall[1][0])
      expect(insertedDoc).toMatchObject({ email: 'x@y.com', name: 'Bob' })
    })

    it('should create the table when it does not exist before inserting', async () => {
      jest
        .spyOn(dataSource, 'tableExists' as any)
        .mockResolvedValueOnce(false) // upsertOne initial check → createTable
        .mockResolvedValueOnce(false) // createTable's own check → allow CREATE
        .mockResolvedValueOnce(true) // insertOne check → skip re-create
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery
        .mockResolvedValueOnce([{}]) // CREATE TABLE
        .mockResolvedValueOnce([{ affectedRows: 0 }]) // UPDATE
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 7 }]) // INSERT

      const result = await dataSource.upsertOne(
        'users',
        { email: 'new@y.com' },
        { $set: { name: 'New' } }
      )
      expect(result.upsertedCount).toBe(1)
    })

    it('should include $setOnInsert fields in the insert doc on miss', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }])

      await dataSource.upsertOne(
        'fxRates',
        { currency: 'EUR' },
        {
          $set: { rate: 1.2, fetchedAt: '2024-01-01' },
          $setOnInsert: { _id: 'abc', baseCurrency: 'GBP' },
        }
      )
      const insertCall = mockQuery.mock.calls.find((c) =>
        (c[0] as string).trim().toUpperCase().startsWith('INSERT')
      )
      expect(insertCall).toBeDefined()
      const insertedDoc = JSON.parse(insertCall[1][0])
      expect(insertedDoc).toMatchObject({
        currency: 'EUR',
        rate: 1.2,
        _id: 'abc',
        baseCurrency: 'GBP',
      })
    })

    it('should not include $setOnInsert in the UPDATE SET clause on hit', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery.mockResolvedValue([{ affectedRows: 1 }])

      await dataSource.upsertOne(
        'fxRates',
        { currency: 'EUR' },
        {
          $set: { rate: 1.2 },
          $setOnInsert: { _id: 'abc', baseCurrency: 'GBP' },
        }
      )
      const updateCall = mockQuery.mock.calls.find((c) =>
        (c[0] as string).trim().toUpperCase().startsWith('UPDATE')
      )
      expect(updateCall).toBeDefined()
      expect((updateCall[0] as string).toLowerCase()).not.toContain(
        'setoninsert' // cspell:ignore setoninsert
      )
      expect(
        mockQuery.mock.calls.some((c) =>
          (c[0] as string).trim().toUpperCase().startsWith('INSERT')
        )
      ).toBe(false)
    })

    it('should insert using only $setOnInsert fields when $set is absent', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 9 }])

      await dataSource.upsertOne(
        'fxRates',
        { currency: 'EUR' },
        { $setOnInsert: { _id: 'xyz', baseCurrency: 'GBP', currency: 'EUR' } }
      )
      const insertCall = mockQuery.mock.calls.find((c) =>
        (c[0] as string).trim().toUpperCase().startsWith('INSERT')
      )
      expect(insertCall).toBeDefined()
      const insertedDoc = JSON.parse(insertCall[1][0])
      expect(insertedDoc).toMatchObject({
        _id: 'xyz',
        baseCurrency: 'GBP',
        currency: 'EUR',
      })
    })
  })

  describe('upsertMany', () => {
    it('should return { count: N, upsertedCount: 0 } when the UPDATE matches rows', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery.mockResolvedValue([{ affectedRows: 3 }])

      const result = await dataSource.upsertMany(
        'users',
        { active: true },
        { $set: { updated: 1 } }
      )
      expect(result).toEqual({ count: 3, upsertedCount: 0 })
    })

    it('should execute only an UPDATE query (without LIMIT 1) when rows exist', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery.mockResolvedValue([{ affectedRows: 2 }])

      await dataSource.upsertMany(
        'users',
        { active: true },
        { $set: { updated: 1 } }
      )
      const updateCall = mockQuery.mock.calls.find((c) =>
        (c[0] as string).trim().toUpperCase().startsWith('UPDATE')
      )
      expect(updateCall).toBeDefined()
      expect((updateCall[0] as string).toUpperCase()).not.toContain('LIMIT')
    })

    it('should INSERT one document when no rows match and return { count: 1, upsertedCount: 1 }', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 55 }])

      const result = await dataSource.upsertMany(
        'users',
        { email: 'a@b.com' },
        { $set: { name: 'Alice' } }
      )
      expect(result).toEqual({ count: 1, upsertedCount: 1, upsertedId: 55 })
    })

    it('should merge scalar filter fields with $set for the insert document', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }])

      await dataSource.upsertMany(
        'users',
        { email: 'a@b.com' },
        { $set: { name: 'Alice' } }
      )
      const insertCall = mockQuery.mock.calls.find((c) =>
        (c[0] as string).trim().toUpperCase().startsWith('INSERT')
      )
      expect(insertCall).toBeDefined()
      expect(JSON.parse(insertCall[1][0])).toMatchObject({
        email: 'a@b.com',
        name: 'Alice',
      })
    })

    it('should include $setOnInsert fields in the insert doc on miss', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }])

      await dataSource.upsertMany(
        'fxRates',
        { currency: 'USD' },
        {
          $set: { rate: 1.3 },
          $setOnInsert: { _id: 'def', baseCurrency: 'GBP' },
        }
      )
      const insertCall = mockQuery.mock.calls.find((c) =>
        (c[0] as string).trim().toUpperCase().startsWith('INSERT')
      )
      expect(insertCall).toBeDefined()
      const insertedDoc = JSON.parse(insertCall[1][0])
      expect(insertedDoc).toMatchObject({
        currency: 'USD',
        rate: 1.3,
        _id: 'def',
        baseCurrency: 'GBP',
      })
    })

    it('should not include $setOnInsert in the UPDATE SET clause on hit', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
      mockQuery.mockResolvedValue([{ affectedRows: 2 }])

      await dataSource.upsertMany(
        'fxRates',
        { currency: 'USD' },
        {
          $set: { rate: 1.3 },
          $setOnInsert: { _id: 'def', baseCurrency: 'GBP' },
        }
      )
      const updateCall = mockQuery.mock.calls.find((c) =>
        (c[0] as string).trim().toUpperCase().startsWith('UPDATE')
      )
      expect(updateCall).toBeDefined()
      expect((updateCall[0] as string).toLowerCase()).not.toContain(
        'setoninsert' // cspell:ignore setoninsert
      )
    })
  })

  describe('bulkWrite', () => {
    let mockConnQuery: jest.Mock
    let mockConn: {
      query: jest.Mock
      beginTransaction: jest.Mock
      commit: jest.Mock
      rollback: jest.Mock
      release: jest.Mock
    }
    let mockGetConnection: jest.Mock
    let mockPoolEnd: jest.Mock

    beforeEach(() => {
      mockConnQuery = jest.fn()
      mockConn = {
        query: mockConnQuery,
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      }
      mockGetConnection = jest.fn().mockResolvedValue(mockConn)
      mockPoolEnd = jest.fn().mockResolvedValue(undefined)

      const createPool = mysqlCreatePool as jest.Mock
      createPool.mockReturnValue({
        query: mockQuery,
        getConnection: mockGetConnection,
        end: mockPoolEnd,
      })

      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      jest.spyOn(dataSource, 'columnExists' as any).mockResolvedValue(false)
    })

    it('joins a mixed insert/update/delete batch into one semicolon-separated statement with flattened params', async () => {
      mockConnQuery.mockResolvedValue([
        [
          { affectedRows: 1, insertId: 10 },
          { affectedRows: 2, insertId: 0 },
          { affectedRows: 1, insertId: 0 },
        ],
        [],
      ])

      await dataSource.bulkWrite('users', [
        { insertOne: { document: { name: 'John' } } },
        { updateOne: { filter: { _id: '1' }, update: { $set: { age: 30 } } } },
        { deleteOne: { filter: { _id: '2' } } },
      ])

      expect(mockConnQuery).toHaveBeenCalledTimes(1)
      const [sql, values] = mockConnQuery.mock.calls[0]
      const statements = (sql as string).split('; ')
      expect(statements).toHaveLength(3)
      expect(statements[0].toUpperCase()).toContain('INSERT INTO')
      expect(statements[1].toUpperCase()).toContain('UPDATE')
      expect(statements[2].toUpperCase()).toContain('DELETE FROM')
      // values: 1 for the insert doc + 1 for the update SET + 1 for update WHERE + 1 for delete WHERE
      expect(values).toHaveLength(4)
    })

    it('parses per-op results into insertedCount/matchedCount/modifiedCount/deletedCount/insertedIds', async () => {
      mockConnQuery.mockResolvedValue([
        [
          { affectedRows: 1, insertId: 10 },
          { affectedRows: 3, insertId: 0 },
          { affectedRows: 2, insertId: 0 },
        ],
        [],
      ])

      const result = await dataSource.bulkWrite('users', [
        { insertOne: { document: { name: 'John' } } },
        {
          updateMany: {
            filter: { active: true },
            update: { $set: { seen: true } },
          },
        },
        { deleteMany: { filter: { archived: true } } },
      ])

      expect(result).toEqual({
        insertedCount: 1,
        matchedCount: 3,
        modifiedCount: 3,
        deletedCount: 2,
        upsertedCount: 0,
        insertedIds: { 0: 10 },
        upsertedIds: {},
      })
      expect(mockConn.commit).toHaveBeenCalledTimes(1)
    })

    it('handles a single-op batch where mysql2 returns an unwrapped result', async () => {
      mockConnQuery.mockResolvedValue([{ affectedRows: 1, insertId: 42 }, []])

      const result = await dataSource.bulkWrite('users', [
        { insertOne: { document: { name: 'Solo' } } },
      ])

      expect(result.insertedCount).toBe(1)
      expect(result.insertedIds).toEqual({ 0: 42 })
    })

    it('rolls back the transaction and rethrows on a rejected query, releasing the connection without closing the dedicated pool', async () => {
      const dbError = new Error('duplicate entry')
      mockConnQuery.mockRejectedValue(dbError)

      await expect(
        dataSource.bulkWrite('users', [
          { insertOne: { document: { name: 'John' } } },
          {
            updateOne: { filter: { _id: '1' }, update: { $set: { age: 30 } } },
          },
        ])
      ).rejects.toThrow(dbError)

      expect(mockConn.rollback).toHaveBeenCalledTimes(1)
      expect(mockConn.commit).not.toHaveBeenCalled()
      expect(mockConn.release).toHaveBeenCalledTimes(1)
      // the dedicated pool is cached and reused across calls - it must not be torn down per call
      expect(mockPoolEnd).not.toHaveBeenCalled()
    })

    it('never mutates the shared pool config with multipleStatements', async () => {
      mockConnQuery.mockResolvedValue([{ affectedRows: 1, insertId: 1 }, []])

      await dataSource.bulkWrite('users', [
        { insertOne: { document: { name: 'John' } } },
      ])

      const createPool = mysqlCreatePool as jest.Mock
      // First call is the constructor's shared pool - must not have multipleStatements set
      expect(createPool.mock.calls[0][0].multipleStatements).toBeUndefined()
      // The bulkWrite call creates its own dedicated pool with multipleStatements: true
      const bulkWriteCall = createPool.mock.calls.find(
        (c) => c[0].multipleStatements === true
      )
      expect(bulkWriteCall).toBeDefined()
    })

    it('lazily creates the dedicated pool once and reuses it across multiple bulkWrite calls', async () => {
      mockConnQuery.mockResolvedValue([{ affectedRows: 1, insertId: 1 }, []])
      const createPool = mysqlCreatePool as jest.Mock
      const createPoolCallsBefore = createPool.mock.calls.length

      await dataSource.bulkWrite('users', [
        { insertOne: { document: { name: 'John' } } },
      ])
      await dataSource.bulkWrite('users', [
        { insertOne: { document: { name: 'Jane' } } },
      ])

      // Exactly one new createPool call for the dedicated bulk pool, even though bulkWrite was
      // called twice - the second call must reuse the cached pool instead of creating another
      expect(createPool.mock.calls.length - createPoolCallsBefore).toBe(1)
      expect(mockGetConnection).toHaveBeenCalledTimes(2)
    })

    it('close() ends the dedicated pool only if bulkWrite ever created it', async () => {
      const mainPoolEnd = jest.fn().mockResolvedValue(undefined)
      ;(dataSource as any).pool.end = mainPoolEnd

      // close() before any bulkWrite call must not attempt to end a pool that was never created
      await dataSource.close()
      expect(mainPoolEnd).toHaveBeenCalledTimes(1)
      expect(mockPoolEnd).not.toHaveBeenCalled()

      mockConnQuery.mockResolvedValue([{ affectedRows: 1, insertId: 1 }, []])
      await dataSource.bulkWrite('users', [
        { insertOne: { document: { name: 'John' } } },
      ])

      await dataSource.close()
      expect(mainPoolEnd).toHaveBeenCalledTimes(2)
      expect(mockPoolEnd).toHaveBeenCalledTimes(1)
    })

    it('threads limitOne per op type: updateOne/deleteOne limit to one row, updateMany/deleteMany do not', async () => {
      mockConnQuery.mockResolvedValue([
        [
          { affectedRows: 1, insertId: 0 },
          { affectedRows: 1, insertId: 0 },
          { affectedRows: 1, insertId: 0 },
          { affectedRows: 1, insertId: 0 },
        ],
        [],
      ])

      await dataSource.bulkWrite('users', [
        { updateOne: { filter: { _id: '1' }, update: { $set: { age: 30 } } } },
        {
          updateMany: {
            filter: { active: true },
            update: { $set: { seen: true } },
          },
        },
        { deleteOne: { filter: { _id: '2' } } },
        { deleteMany: { filter: { archived: true } } },
      ])

      const [sql] = mockConnQuery.mock.calls[0]
      const statements = (sql as string).split('; ')
      expect(statements[0].toUpperCase()).toContain('LIMIT 1')
      expect(statements[1].toUpperCase()).not.toContain('LIMIT 1')
      expect(statements[2].toUpperCase()).toContain('LIMIT 1')
      expect(statements[3].toUpperCase()).not.toContain('LIMIT 1')
    })
  })

  describe('transaction leases', () => {
    type MockConn = {
      query: jest.Mock
      beginTransaction: jest.Mock
      commit: jest.Mock
      rollback: jest.Mock
      release: jest.Mock
    }

    const makeMockConn = (): MockConn => ({
      query: jest.fn().mockResolvedValue([[], []]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    })

    let mockConn: MockConn
    let mockGetConnection: jest.Mock

    beforeEach(() => {
      mockConn = makeMockConn()
      mockGetConnection = jest.fn().mockResolvedValue(mockConn)

      const createPool = mysqlCreatePool as jest.Mock
      createPool.mockReturnValue({
        query: mockQuery,
        getConnection: mockGetConnection,
      })

      // The outer beforeEach constructs `dataSource` against a pool mock with no
      // getConnection() - reconstruct against the pool mock configured above so
      // transactionStart() has a getConnection() to call.
      dataSource = new DataSourceMysql({
        host: 'localhost',
        user: 'test',
        password: 'test',
        database: 'testdb',
      })
    })

    it('gives two concurrent transactionStart() calls independent leases on independent connections', async () => {
      const connA = makeMockConn()
      const connB = makeMockConn()
      mockGetConnection
        .mockResolvedValueOnce(connA)
        .mockResolvedValueOnce(connB)

      const [leaseA, leaseB] = await Promise.all([
        dataSource.transactionStart(),
        dataSource.transactionStart(),
      ])

      expect(leaseA).not.toBe(leaseB)
      expect(connA.beginTransaction).toHaveBeenCalledTimes(1)
      expect(connB.beginTransaction).toHaveBeenCalledTimes(1)
      expect(dataSource.hasActiveLeases()).toBe(true)
    })

    it('does not throw "Transaction already in progress" for concurrent transactionStart() calls', async () => {
      await expect(
        Promise.all([
          dataSource.transactionStart(),
          dataSource.transactionStart(),
        ])
      ).resolves.toBeDefined()
    })

    it('routes a plain find() concurrent with an open lease through the pool, not the lease connection', async () => {
      jest.spyOn(dataSource, 'tableExists' as any).mockResolvedValue(true)
      await dataSource.transactionStart()
      mockQuery.mockResolvedValue([[], []])

      await dataSource.find('users', {})

      expect(mockQuery).toHaveBeenCalled()
      expect(mockConn.query).not.toHaveBeenCalled()
    })

    it('commit releases the connection and clears the lease from the active count', async () => {
      const lease = await dataSource.transactionStart()

      await lease.transactionCommit()

      expect(mockConn.commit).toHaveBeenCalledTimes(1)
      expect(mockConn.release).toHaveBeenCalledTimes(1)
      expect(dataSource.hasActiveLeases()).toBe(false)
    })

    it('rollback releases the connection and clears the lease from the active count', async () => {
      const lease = await dataSource.transactionStart()

      await lease.transactionRollback()

      expect(mockConn.rollback).toHaveBeenCalledTimes(1)
      expect(mockConn.release).toHaveBeenCalledTimes(1)
      expect(dataSource.hasActiveLeases()).toBe(false)
    })

    it('throws a clear error on post-commit lease use', async () => {
      const lease = await dataSource.transactionStart()
      await lease.transactionCommit()

      await expect(lease.transactionCommit()).rejects.toThrow(
        /already been committed or rolled back/
      )
      await expect(lease.find('users', {})).rejects.toThrow(
        /already been committed or rolled back/
      )
    })

    it('throws a clear error on post-rollback lease use', async () => {
      const lease = await dataSource.transactionStart()
      await lease.transactionRollback()

      await expect(lease.transactionRollback()).rejects.toThrow(
        /already been committed or rolled back/
      )
    })
  })
})
