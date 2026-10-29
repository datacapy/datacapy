import { RepoRelationBuilder as relb } from './relation-builder'

describe('relb', () => {
  it.each([
    ['belongsToOne', relb.belongsToOne('x')],
    ['belongsToMany', relb.belongsToMany('x')],
    ['hasOne', relb.hasOne('x')],
    ['hasMany', relb.hasMany('x')],
    ['hasManyCount', relb.hasManyCount('x')],
    ['embeddedBelongsToOne', relb.embeddedBelongsToOne('x')],
    ['embeddedBelongsToMany', relb.embeddedBelongsToMany('x')],
    ['embeddedHasOne', relb.embeddedHasOne('x')],
    ['embeddedHasMany', relb.embeddedHasMany('x')],
  ])('sets type %s and repo', (type, builder) => {
    expect(builder.build()).toEqual({ type, repo: 'x' })
  })

  it('builds a hasMany with options', () => {
    expect(
      relb
        .hasMany('projectAdmin')
        .alias('projectAdmin')
        .key('userId')
        .autoPopulate(false)
        .recursion(1)
        .build()
    ).toEqual({
      alias: 'projectAdmin',
      type: 'hasMany',
      repo: 'projectAdmin',
      key: 'userId',
      autoPopulate: false,
      recursion: 1,
    })
  })

  it('builds a belongsToOne with composite keys and fields', () => {
    expect(
      relb
        .belongsToOne('surveyParticipant')
        .key('participantId')
        .keys({ surveyId: 'surveyId' })
        .fields({ _id: 1, surveyId: 1 })
        .build()
    ).toEqual({
      type: 'belongsToOne',
      repo: 'surveyParticipant',
      key: 'participantId',
      keys: { surveyId: 'surveyId' },
      fields: { _id: 1, surveyId: 1 },
    })
  })

  it('builds a nested relation with docPath', () => {
    expect(
      relb.belongsToOne('user').docPath('messages.*').key('userId').build()
    ).toEqual({
      type: 'belongsToOne',
      repo: 'user',
      docPath: 'messages.*',
      key: 'userId',
    })
  })

  it('builds hasManyCount with pkey and query, and the query options', () => {
    expect(
      relb
        .hasManyCount('surveyResponse')
        .pkey('_id')
        .key('snapshotId')
        .query({ complete: true })
        .filterPrivate()
        .populate({ a: true })
        .limit(5)
        .skip(1)
        .sort({ createdAt: -1 })
        .build()
    ).toEqual({
      type: 'hasManyCount',
      repo: 'surveyResponse',
      pkey: '_id',
      key: 'snapshotId',
      query: { complete: true },
      filterPrivate: true,
      populate: { a: true },
      limit: 5,
      skip: 1,
      sort: { createdAt: -1 },
    })
  })
})
