import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as ts from 'typescript'

import { ConfigLoader } from './config'
import { EndpointGenerator } from './endpoint-generator'

const FIXTURE = path.resolve(__dirname, '../fixtures/endpoints')

describe('EndpointGenerator', () => {
  const generator = () => new EndpointGenerator(new ConfigLoader().load(FIXTURE))

  it('writes one endpoint per tagged method', async () => {
    const [file] = await generator().generate()
    expect(file.path).toBe(path.join(FIXTURE, 'src/note-service.endpoints.ts'))
    const c = file.content.replace(/\s+/g, ' ')
    expect(c).toContain("service: 'note',")
    expect(c).toContain("list: { method: 'list', verbs: ['get'],")
    expect(c).toContain(
      "projectId: { src: 'header', srcPath: 'X-Project-Id', required: true, type: String },",
    )
    expect(c).toContain("page: { src: 'query', required: false, type: Number, defaultValue: 1 },")
    expect(c).toContain("ip: { src: 'request', required: false, type: String },")
    expect(c).toContain("changes: { src: 'body', required: true, type: Array },")
    expect(c).toContain("meta: { src: 'body', required: false },")
    expect(c).toContain("multi: { method: 'multi', verbs: ['get', 'head'], path: '/multi',")
    expect(c).toContain("batchSave: { method: 'batchSave', verbs: ['patch'], path: '/:noteId',")
    expect(c).toContain('response: { error: { PlanLimitError: { http: { code: 402 } } } }')
    expect(c).toContain("enable: false, data: {}, acl: { rules: [{ allow: true, role: 'all' }] }")
    expect(c).toContain("{ allow: true, role: 'projectAdmin' }, { allow: false, role: 'guest' }")
    expect(c).toContain('export default noteConfig')
    expect(c).not.toContain('aclContext')
  })

  it('matches the checked-in generated file', async () => {
    expect((await generator().check()).stale).toEqual([])
  })

  it('produces a file that compiles against the server config type', () => {
    const configFile = ts.readConfigFile(path.join(FIXTURE, 'tsconfig.json'), ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, FIXTURE)
    const program = ts.createProgram(parsed.fileNames, {
      ...parsed.options,
      strictNullChecks: true,
    })
    const errors = ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    expect(errors).toEqual([])
  })

  it('refuses a config without an endpoints section', () => {
    expect(() => new EndpointGenerator(new ConfigLoader().resolve(FIXTURE, {}))).toThrow(
      /no "endpoints" section/,
    )
  })

  describe('with a temporary project', () => {
    let dir: string

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datacapy-gen-endpoints-'))
      fs.mkdirSync(path.join(dir, 'src'))
      fs.writeFileSync(
        path.join(dir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
      )
    })
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

    const TAGS = `
      type Param = { readonly '$dc:param'?: true }
      type Body = { readonly '$dc:body'?: true }
      type Query = { readonly '$dc:query'?: true }
      type Bogus = { readonly '$dc:bogus'?: true }
    `
    const config = (extra = {}) => ({ endpoints: extra })
    const generator = (cfg = config()) =>
      new EndpointGenerator(new ConfigLoader().resolve(dir, cfg))
    const service = (methods: string, marker = '@endpoints svc') =>
      `${TAGS}\n/** ${marker} */\nexport class S {\n${methods}\n}\n`
    const problems = async (source: string, cfg = config()) => {
      fs.writeFileSync(path.join(dir, 'src/a.ts'), source)
      return (await generator(cfg).report()).map((p) => p.message)
    }

    it('reports a path param with no Param property', async () => {
      const out = await problems(
        service(`/** @route get /:id\n @acl public */ m(a: { x: string & Query }) {}`),
      )
      expect(out).toEqual(['S.m: path param ":id" has no property tagged Param'])
    })

    it('reads tags written on one line', async () => {
      fs.writeFileSync(
        path.join(dir, 'src/a.ts'),
        service(`/** @route patch /:id @acl projectAdmin */ m(a: { id: string & Param }) {}`),
      )
      const [file] = await generator().generate()
      expect(file.content.replace(/\s+/g, ' ')).toContain("verbs: ['patch'], path: '/:id',")
      expect(file.content).toContain("role: 'projectAdmin'")
    })

    it('emits an empty service path for `path=`, so routes carry their full path', async () => {
      fs.writeFileSync(
        path.join(dir, 'src/a.ts'),
        service(`/** @route get /a/b @acl public */ m() {}`, '@endpoints svc path='),
      )
      const [file] = await generator().generate()
      expect(file.content).toContain("path: '',")
      expect(file.content).toContain("path: '/a/b'")
    })

    it('reports a property whose type does not resolve instead of losing its tags', async () => {
      const out = await problems(
        service(
          `/** @route post /:id\n @acl public */ m(a: { id: string & Param; ctx: Missing & Body }) {}`,
        ).replace('/** @endpoints', "import type { Missing } from './nowhere'\n/** @endpoints"),
      )
      expect(out).toEqual([expect.stringMatching(/^S\.m\.ctx: type resolves to any/)])
    })

    it('reports a Param property that is not in the path', async () => {
      const out = await problems(
        service(`/** @route get /list\n @acl public */ m(a: { id: string & Param }) {}`),
      )
      expect(out).toEqual(['S.m: property "id" is tagged Param but the path has no ":id"'])
    })

    it('reports a duplicate route', async () => {
      const out = await problems(
        service(`
          /** @route get /a\n @acl public */ one() {}
          /** @route get /a\n @acl public */ two() {}
        `),
      )
      expect(out).toEqual(['S.two: duplicate route GET /a (also one)'])
    })

    it('reports a parametrised route that shadows a later literal one', async () => {
      const out = await problems(
        service(`
          /** @route get /:id\n @acl public */ byId(a: { id: string & Param }) {}
          /** @route get /list\n @acl public */ list() {}
        `),
      )
      expect(out).toEqual([
        'S.list: route GET /list is shadowed by byId (/:id), which is registered first',
      ])
    })

    it('does not flag a literal route registered before a parametrised one', async () => {
      const out = await problems(
        service(`
          /** @route get /list\n @acl public */ list() {}
          /** @route get /:id\n @acl public */ byId(a: { id: string & Param }) {}
        `),
      )
      expect(out).toEqual([])
    })

    it('requires an @acl on every @route, unless requireAcl is off', async () => {
      const source = service(`/** @route get /a */ m() {}`)
      expect(await problems(source)).toEqual([
        'S.m: @route needs an @acl, e.g. @acl projectAdmin or @acl public',
      ])
      expect(await problems(source, config({ requireAcl: false }))).toEqual([])
    })

    it('reports a role-less @acl', async () => {
      expect(await problems(service(`/** @route get /a\n @acl */ m() {}`))).toEqual([
        'S.m: @acl needs a role, e.g. @acl projectAdmin',
      ])
    })

    it('reports an unknown tag and more than one source tag', async () => {
      expect(
        await problems(
          service(`/** @route get /a\n @acl public */ m(a: { x: string & Bogus }) {}`),
        ),
      ).toEqual(['S.m.x: unknown tag "bogus"'])
      expect(
        await problems(
          service(`/** @route post /a\n @acl public */ m(a: { x: string & Body & Query }) {}`),
        ),
      ).toEqual(['S.m.x: has more than one source tag (query, body)'])
    })

    it('reports an unmappable data type and an untyped or non-object params argument', async () => {
      expect(
        await problems(
          service(`/** @route get /a\n @acl public */ m(a: { x: string | number }) {}`),
        ),
      ).toEqual(['S.m.x: cannot map type string | number to a request data type'])
      expect(await problems(service(`/** @route get /a\n @acl public */ m(a) {}`))).toEqual([
        'S.m: the params object needs a type annotation',
      ])
      expect(await problems(service(`/** @route get /a\n @acl public */ m(a: string) {}`))).toEqual(
        ['S.m: the first parameter must be a params object type'],
      )
    })

    it('reports a bad @route verb, a private method and a missing service name', async () => {
      expect(await problems(service(`/** @route fetch /a\n @acl public */ m() {}`))).toEqual([
        'S.m: @route needs verbs from get, post, put, patch, delete, head, options, e.g. @route get /:id',
      ])
      expect(await problems(service(`/** @route get /a\n @acl public */ private m() {}`))).toEqual([
        'S.m: @route needs a public method',
      ])
      expect(
        await problems(service(`/** @route get\n @acl public */ m() {}`, '@endpoints')),
      ).toEqual(['S: @endpoints needs a service name, e.g. @endpoints surveyNote'])
    })

    it('puts a service path prefix in the output and counts its params', async () => {
      fs.writeFileSync(
        path.join(dir, 'src/a.ts'),
        service(
          `/** @route get\n @acl public */ m(a: { orgId: string & Param }) {}`,
          '@endpoints svc path=/platform/svc/:orgId',
        ),
      )
      const [file] = await generator().generate()
      expect(file.content).toContain("path: '/platform/svc/:orgId',")
    })

    it('throws one error listing every problem from generate', async () => {
      fs.writeFileSync(
        path.join(dir, 'src/a.ts'),
        service(`
          /** @route get /a */ one() {}
          /** @route get /b */ two() {}
        `),
      )
      await expect(generator().generate()).rejects.toThrow(/S\.one.*\nS\.two/s)
    })

    it('reports stale and missing files in check mode', async () => {
      fs.writeFileSync(
        path.join(dir, 'src/a.ts'),
        service(`/** @route get /a\n @acl public */ m() {}`),
      )
      const gen = generator()
      const target = path.join(dir, 'src/a.endpoints.ts')
      expect((await gen.check()).stale).toEqual([target])
      await gen.write()
      expect((await gen.check()).stale).toEqual([])
      fs.appendFileSync(target, '// edited\n')
      expect((await gen.check()).stale).toEqual([target])
    })

    it('ignores classes without the marker', async () => {
      fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export class S { m() {} }\n')
      expect(await generator().generate()).toEqual([])
    })

    it('honours outDir', async () => {
      fs.writeFileSync(
        path.join(dir, 'src/a.ts'),
        service(`/** @route get /a\n @acl public */ m() {}`),
      )
      const [file] = await generator().generate()
      expect(file.path).toBe(path.join(dir, 'src/a.endpoints.ts'))
      const [moved] = await generator(config({ outDir: 'gen' })).generate()
      expect(moved.path).toBe(path.join(dir, 'gen/src/a.endpoints.ts'))
    })
  })
})
