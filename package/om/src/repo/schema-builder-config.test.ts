import { SchemaBuilder as sb } from '@datacapy/schema'
import Repo from 'repo'

describe('Repo schema config', () => {
  it('accepts a schema builder without build()', () => {
    const repo = new Repo({
      name: 'user',
      schema: sb.schema('user').shape({
        _id: sb.string(),
        name: sb.string().required(),
      }),
    })
    repo.initSchema()

    const viaBuilt = new Repo({
      name: 'user',
      schema: sb
        .schema('user')
        .shape({ _id: sb.string(), name: sb.string().required() })
        .build(),
    })
    viaBuilt.initSchema()

    expect(repo.schema.spec).toEqual(viaBuilt.schema.spec)
    expect(repo.schema.spec.name).toBeDefined()
  })
})
