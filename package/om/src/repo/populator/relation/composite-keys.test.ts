import { RelationBelongsToOne } from 'repo/populator/relation/belongs-to-one'
import { RelationHasMany } from 'repo/populator/relation/has-many'
import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('Composite Keys', function () {
  it('should populate belongsToOne with composite keys', async () => {
    const data = {
      surveyResponse: [
        {
          _id: 'response1',
          participantId: 'p1',
          surveyId: 's1',
          workspaceId: 'ws1',
          answer: 'Yes',
        },
        {
          _id: 'response2',
          participantId: 'p1',
          surveyId: 's2',
          workspaceId: 'ws1',
          answer: 'No',
        },
      ],
      surveyParticipant: [
        // Match: p1 + s1 + ws1
        {
          _id: 'p1',
          surveyId: 's1',
          workspaceId: 'ws1',
          name: 'John Doe',
        },
        // No match: p1 + s2 + ws1 (different surveyId)
        {
          _id: 'p1',
          surveyId: 's2',
          workspaceId: 'ws1',
          name: 'John in Survey 2',
        },
        // No match: different workspaceId
        {
          _id: 'p1',
          surveyId: 's1',
          workspaceId: 'ws2',
          name: 'John in Workspace 2',
        },
      ],
    }

    const surveyParticipant = new Repo({
      name: 'surveyParticipant',
    })
    surveyParticipant.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToOne()
    const docs = await repoPopulator.populate(
      surveyParticipant,
      {
        key: 'participantId',
        keys: {
          surveyId: 'surveyId',
          workspaceId: 'workspaceId',
        },
        alias: 'participant',
      },
      data.surveyResponse
    )

    // First response should match John Doe (s1 + ws1)
    expect(docs[0].participant.name).toBe('John Doe')
    expect(docs[0].participant.surveyId).toBe('s1')
    expect(docs[0].participant.workspaceId).toBe('ws1')

    // Second response should match John in Survey 2 (s2 + ws1)
    expect(docs[1].participant.name).toBe('John in Survey 2')
    expect(docs[1].participant.surveyId).toBe('s2')
    expect(docs[1].participant.workspaceId).toBe('ws1')
  })

  it('should populate hasMany with composite keys', async () => {
    const data = {
      workspace: [
        {
          _id: 'ws1',
          surveyId: 's1',
          name: 'Workspace Alpha',
        },
        {
          _id: 'ws2',
          surveyId: 's2',
          name: 'Workspace Beta',
        },
      ],
      response: [
        // Match ws1 + s1
        { _id: 'r1', workspaceId: 'ws1', surveyId: 's1', answer: 'A' },
        { _id: 'r2', workspaceId: 'ws1', surveyId: 's1', answer: 'B' },
        // No match: wrong surveyId
        { _id: 'r3', workspaceId: 'ws1', surveyId: 's2', answer: 'C' },
        // Match ws2 + s2
        { _id: 'r4', workspaceId: 'ws2', surveyId: 's2', answer: 'D' },
      ],
    }

    const response = new Repo({
      name: 'response',
    })
    response.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationHasMany()
    const docs = await repoPopulator.populate(
      response,
      {
        keys: {
          _id: 'workspaceId',
          surveyId: 'surveyId',
        },
        alias: 'responses',
      },
      data.workspace
    )

    // Workspace Alpha should have 2 responses (r1, r2)
    expect(docs[0].responses.length).toBe(2)
    expect(docs[0].responses[0].answer).toBe('A')
    expect(docs[0].responses[1].answer).toBe('B')

    // Workspace Beta should have 1 response (r4)
    expect(docs[1].responses.length).toBe(1)
    expect(docs[1].responses[0].answer).toBe('D')
  })

  it('should support mixing key and keys properties', async () => {
    const data = {
      order: [
        {
          _id: 'order1',
          customerId: 'c1',
          storeId: 'store1',
          total: 100,
        },
      ],
      customer: [
        {
          _id: 'c1',
          storeId: 'store1',
          name: 'Alice',
        },
        {
          _id: 'c1',
          storeId: 'store2',
          name: 'Alice at Store 2',
        },
      ],
    }

    const customer = new Repo({
      name: 'customer',
    })
    customer.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToOne()
    const docs = await repoPopulator.populate(
      customer,
      {
        key: 'customerId', // This will be merged with keys
        keys: {
          storeId: 'storeId',
        },
        alias: 'customer',
      },
      data.order
    )

    // Should match Alice at store1
    expect(docs[0].customer.name).toBe('Alice')
    expect(docs[0].customer.storeId).toBe('store1')
  })

  it('should handle no matches with composite keys', async () => {
    const data = {
      order: [
        {
          _id: 'order1',
          customerId: 'c1',
          storeId: 'store1',
        },
      ],
      customer: [
        // No match: wrong storeId
        {
          _id: 'c1',
          storeId: 'store2',
          name: 'Alice',
        },
      ],
    }

    const customer = new Repo({
      name: 'customer',
    })
    customer.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToOne()
    const docs = await repoPopulator.populate(
      customer,
      {
        key: 'customerId',
        keys: {
          storeId: 'storeId',
        },
        alias: 'customer',
      },
      data.order
    )

    // Should not populate (no match)
    expect(docs[0].customer).toBeUndefined()
  })

  it('should work with triple composite keys', async () => {
    const data = {
      transaction: [
        {
          _id: 't1',
          userId: 'u1',
          accountId: 'a1',
          regionId: 'r1',
          amount: 100,
        },
      ],
      account: [
        {
          userId: 'u1',
          accountId: 'a1',
          regionId: 'r1',
          balance: 1000,
        },
        // No match: wrong regionId
        {
          userId: 'u1',
          accountId: 'a1',
          regionId: 'r2',
          balance: 2000,
        },
      ],
    }

    const account = new Repo({
      name: 'account',
    })
    account.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToOne()
    const docs = await repoPopulator.populate(
      account,
      {
        keys: {
          userId: 'userId',
          accountId: 'accountId',
          regionId: 'regionId',
        },
        alias: 'account',
      },
      data.transaction
    )

    // Should match the first account (all 3 fields match)
    expect(docs[0].account.balance).toBe(1000)
    expect(docs[0].account.regionId).toBe('r1')
  })
})
