import { EndpointPathChecker } from './endpoint-path-check'

describe('EndpointPathChecker', () => {
  const checker = new EndpointPathChecker()

  it('accepts a path param with a matching data entry', () => {
    expect(
      checker.check({
        endpoints: {
          get: {
            path: '/:id',
            data: { id: { src: 'param' }, q: { src: 'query' } },
          },
        },
      })
    ).toEqual([])
  })

  it('honours srcPath when the data key differs', () => {
    expect(
      checker.check({
        endpoints: {
          get: {
            path: '/:id',
            data: { surveyId: { src: 'param', srcPath: 'id' } },
          },
        },
      })
    ).toEqual([])
  })

  it('reports a path param with no data entry', () => {
    expect(
      checker.check({ endpoints: { get: { path: '/:id', data: {} } } })
    ).toEqual([
      `endpoint "get": path param ":id" has no data entry with src 'param'`,
    ])
  })

  it('reports a param data entry absent from the path', () => {
    expect(
      checker.check({
        endpoints: { get: { path: '/list', data: { id: { src: 'param' } } } },
      })
    ).toEqual([
      `endpoint "get": data entry reads param "id" but the path has no ":id"`,
    ])
  })

  it('counts params declared on the service path', () => {
    expect(
      checker.check({
        path: '/project/:projectId',
        endpoints: { get: { data: { projectId: { src: 'param' } } } },
      })
    ).toEqual([])
  })

  it('ignores endpoints without a path or data', () => {
    expect(checker.check({ endpoints: { list: {} } })).toEqual([])
  })
})
