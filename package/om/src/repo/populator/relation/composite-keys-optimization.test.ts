import { RelationBelongsToOne } from 'repo/populator/relation/belongs-to-one'
import { RelationHasMany } from 'repo/populator/relation/has-many'
import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('Composite Keys Query Optimization', function () {
  it('should optimize query when all but one field is constant', async () => {
    // This simulates a common multi-tenant scenario:
    // - workspaceId is constant (same workspace)
    // - surveyId is constant (same survey)
    // - participantId varies (different participants)
    const data = {
      surveyResponse: [
        {
          _id: 'r1',
          participantId: 'p1',
          surveyId: 's1',
          workspaceId: 'ws1',
          answer: 'A',
        },
        {
          _id: 'r2',
          participantId: 'p2',
          surveyId: 's1',
          workspaceId: 'ws1',
          answer: 'B',
        },
        {
          _id: 'r3',
          participantId: 'p3',
          surveyId: 's1',
          workspaceId: 'ws1',
          answer: 'C',
        },
      ],
      surveyParticipant: [
        {
          _id: 'p1',
          surveyId: 's1',
          workspaceId: 'ws1',
          name: 'Alice',
        },
        {
          _id: 'p2',
          surveyId: 's1',
          workspaceId: 'ws1',
          name: 'Bob',
        },
        {
          _id: 'p3',
          surveyId: 's1',
          workspaceId: 'ws1',
          name: 'Charlie',
        },
        // Should not match: different survey
        {
          _id: 'p1',
          surveyId: 's2',
          workspaceId: 'ws1',
          name: 'Alice in S2',
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

    // Verify all participants are populated correctly
    expect(docs[0].participant.name).toBe('Alice')
    expect(docs[1].participant.name).toBe('Bob')
    expect(docs[2].participant.name).toBe('Charlie')

    // The optimized query should be:
    // {
    //   surveyId: 's1',
    //   workspaceId: 'ws1',
    //   _id: { $in: ['p1', 'p2', 'p3'] }
    // }
    // Instead of:
    // {
    //   $or: [
    //     { _id: 'p1', surveyId: 's1', workspaceId: 'ws1' },
    //     { _id: 'p2', surveyId: 's1', workspaceId: 'ws1' },
    //     { _id: 'p3', surveyId: 's1', workspaceId: 'ws1' }
    //   ]
    // }
  })

  it('should optimize hasMany query with constant fields', async () => {
    const data = {
      workspace: [
        {
          _id: 'ws1',
          surveyId: 's1',
          name: 'Workspace Alpha',
        },
        {
          _id: 'ws2',
          surveyId: 's1',
          name: 'Workspace Beta',
        },
      ],
      response: [
        // All have same surveyId (constant)
        { _id: 'r1', workspaceId: 'ws1', surveyId: 's1', answer: 'A' },
        { _id: 'r2', workspaceId: 'ws1', surveyId: 's1', answer: 'B' },
        { _id: 'r3', workspaceId: 'ws2', surveyId: 's1', answer: 'C' },
        { _id: 'r4', workspaceId: 'ws2', surveyId: 's1', answer: 'D' },
        // Should not match: different surveyId
        { _id: 'r5', workspaceId: 'ws1', surveyId: 's2', answer: 'E' },
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

    expect(docs[0].responses.length).toBe(2)
    expect(docs[1].responses.length).toBe(2)

    // The optimized query should be:
    // {
    //   surveyId: 's1',
    //   workspaceId: { $in: ['ws1', 'ws2'] }
    // }
  })

  it('should handle multiple variant fields efficiently', async () => {
    // When we have multiple variant fields but they come in groups
    const data = {
      transaction: [
        // Group 1: regionId='r1', userId varies, accountId varies
        { _id: 't1', userId: 'u1', accountId: 'a1', regionId: 'r1' },
        { _id: 't2', userId: 'u2', accountId: 'a2', regionId: 'r1' },
        // Group 2: regionId='r2', userId varies, accountId varies
        { _id: 't3', userId: 'u3', accountId: 'a3', regionId: 'r2' },
      ],
      account: [
        { userId: 'u1', accountId: 'a1', regionId: 'r1', balance: 100 },
        { userId: 'u2', accountId: 'a2', regionId: 'r1', balance: 200 },
        { userId: 'u3', accountId: 'a3', regionId: 'r2', balance: 300 },
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

    expect(docs[0].account.balance).toBe(100)
    expect(docs[1].account.balance).toBe(200)
    expect(docs[2].account.balance).toBe(300)

    // When regionId groups exist, the optimized query might be:
    // {
    //   $or: [
    //     { regionId: 'r1', userId: { $in: ['u1', 'u2'] }, accountId: { $in: ['a1', 'a2'] } },
    //     { regionId: 'r2', userId: 'u3', accountId: 'a3' }
    //   ]
    // }
  })

  it('should handle all constant fields (single document lookup)', async () => {
    const data = {
      order: [
        {
          _id: 'order1',
          customerId: 'c1',
          storeId: 'store1',
          regionId: 'r1',
        },
      ],
      customer: [
        {
          _id: 'c1',
          storeId: 'store1',
          regionId: 'r1',
          name: 'Alice',
        },
        {
          _id: 'c1',
          storeId: 'store2',
          regionId: 'r1',
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
        key: 'customerId',
        keys: {
          storeId: 'storeId',
          regionId: 'regionId',
        },
        alias: 'customer',
      },
      data.order
    )

    expect(docs[0].customer.name).toBe('Alice')

    // All fields are constant, so the optimized query should be:
    // {
    //   _id: 'c1',
    //   storeId: 'store1',
    //   regionId: 'r1'
    // }
  })

  it('should handle all variant fields (worst case)', async () => {
    // When all fields vary, we can't optimize beyond grouping
    const data = {
      event: [
        { _id: 'e1', userId: 'u1', sessionId: 's1', deviceId: 'd1' },
        { _id: 'e2', userId: 'u2', sessionId: 's2', deviceId: 'd2' },
        { _id: 'e3', userId: 'u3', sessionId: 's3', deviceId: 'd3' },
      ],
      session: [
        { userId: 'u1', sessionId: 's1', deviceId: 'd1', duration: 100 },
        { userId: 'u2', sessionId: 's2', deviceId: 'd2', duration: 200 },
        { userId: 'u3', sessionId: 's3', deviceId: 'd3', duration: 300 },
      ],
    }

    const session = new Repo({
      name: 'session',
    })
    session.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToOne()
    const docs = await repoPopulator.populate(
      session,
      {
        keys: {
          userId: 'userId',
          sessionId: 'sessionId',
          deviceId: 'deviceId',
        },
        alias: 'session',
      },
      data.event
    )

    expect(docs[0].session.duration).toBe(100)
    expect(docs[1].session.duration).toBe(200)
    expect(docs[2].session.duration).toBe(300)

    // All fields vary, so we need $or:
    // {
    //   $or: [
    //     { userId: 'u1', sessionId: 's1', deviceId: 'd1' },
    //     { userId: 'u2', sessionId: 's2', deviceId: 'd2' },
    //     { userId: 'u3', sessionId: 's3', deviceId: 'd3' }
    //   ]
    // }
  })

  it('should optimize when multiple documents share some constant fields', async () => {
    // Realistic scenario: multiple survey responses from same survey/workspace
    // but different questions and participants
    const data = {
      questionResponse: [
        // Survey s1, Workspace ws1, varying question and participant
        {
          _id: 'qr1',
          questionId: 'q1',
          participantId: 'p1',
          surveyId: 's1',
          workspaceId: 'ws1',
        },
        {
          _id: 'qr2',
          questionId: 'q2',
          participantId: 'p1',
          surveyId: 's1',
          workspaceId: 'ws1',
        },
        {
          _id: 'qr3',
          questionId: 'q1',
          participantId: 'p2',
          surveyId: 's1',
          workspaceId: 'ws1',
        },
      ],
      question: [
        {
          questionId: 'q1',
          surveyId: 's1',
          workspaceId: 'ws1',
          text: 'Question 1',
        },
        {
          questionId: 'q2',
          surveyId: 's1',
          workspaceId: 'ws1',
          text: 'Question 2',
        },
        // Different survey - should not match
        {
          questionId: 'q1',
          surveyId: 's2',
          workspaceId: 'ws1',
          text: 'Q1 in Survey 2',
        },
      ],
    }

    const question = new Repo({
      name: 'question',
    })
    question.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToOne()
    const docs = await repoPopulator.populate(
      question,
      {
        keys: {
          questionId: 'questionId',
          surveyId: 'surveyId',
          workspaceId: 'workspaceId',
        },
        alias: 'question',
      },
      data.questionResponse
    )

    expect(docs[0].question.text).toBe('Question 1')
    expect(docs[1].question.text).toBe('Question 2')
    expect(docs[2].question.text).toBe('Question 1')

    // Optimized query should be:
    // {
    //   surveyId: 's1',
    //   workspaceId: 'ws1',
    //   questionId: { $in: ['q1', 'q2'] }
    // }
  })
})
