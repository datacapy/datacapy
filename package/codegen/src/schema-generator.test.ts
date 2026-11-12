import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as ts from 'typescript'

import { ConfigLoader } from './config'
import { GeneratorError } from './errors'
import { SchemaGenerator } from './schema-generator'

const FIXTURE = path.resolve(__dirname, '../fixtures/note')

describe('SchemaGenerator', () => {
  const generator = () => new SchemaGenerator(new ConfigLoader().load(FIXTURE))

  it('writes a builder chain per property', async () => {
    const [file] = await generator().generate()
    expect(file.path).toBe(path.join(FIXTURE, 'src/note.schema.ts'))
    const c = file.content
    expect(c).toContain("_id: sb.string().init('x'),")
    expect(c).toContain("title: sb.string().default('untitled').maxLength(200).trim(),")
    expect(c).toContain('email: sb.string().email().encrypt(),')
    expect(c).toContain("status: sb.string().required().inArray(['draft', 'published']),")
    expect(c).toContain("slug: sb.string().required().regex('^[a-z0-9-]+$').label('Slug'),")
    expect(c).toContain('count: sb.number().default(0),')
    expect(c).toContain('pinned: sb.boolean().required(),')
    expect(c).toContain('tags: sb.array(sb.string().required().lowercase()).required(),')
    expect(c).toContain("createdAt: sb.date().default('now'),")
    expect(c).toContain('closedAt: sb.date().default(null),')
    expect(c).toContain("note: sb.string().default('n').optional(),")
    expect(c).toContain('extra: sb.mixed(),')
    expect(c).toContain("sb.schema('note')")
    expect(c).toContain('export class SchemaNote extends Schema.from(')
  })

  it('matches the checked-in generated file', async () => {
    expect((await generator().check()).stale).toEqual([])
  })

  it('produces a file that compiles and matches the interface exactly', () => {
    const configFile = ts.readConfigFile(path.join(FIXTURE, 'tsconfig.json'), ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, FIXTURE)
    const program = ts.createProgram(parsed.fileNames, {
      ...parsed.options,
      // the exactness check is only meaningful with null and optional tracked
      strictNullChecks: true,
    })
    const errors = ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    expect(errors).toEqual([])
  })

  describe('options fixture', () => {
    const OPTIONS = path.resolve(__dirname, '../fixtures/options')
    const gen = () => new SchemaGenerator(new ConfigLoader().load(OPTIONS))

    it('emits construct, constructCollection and strict in the hand-written order', async () => {
      const [file] = await gen().generate()
      const c = file.content.replace(/\s+/g, '')
      expect(c).toContain(
        "sb.schema('strict-thing').construct('StrictThing').constructCollection('StrictThingCollection').strict().shape({".replace(
          /\s+/g,
          '',
        ),
      )
      // config default strict: true applies; no-strict overrides it
      expect(c).toContain("sb.schema('loose-thing').shape({".replace(/\s+/g, ''))
      expect(c).toContain(
        "sb.schema('plain-thing').constructCollection('PlainThingCollection').strict().shape({".replace(
          /\s+/g,
          '',
        ),
      )
    })

    it('matches the checked-in file', async () => {
      expect((await gen().check()).stale).toEqual([])
    })

    it('rejects an unknown key only when strict', async () => {
      const { SchemaStrictThing, SchemaLooseThing } =
        await import('../fixtures/options/src/options.schema')
      const strict = await new SchemaStrictThing().validate({ name: 'a', other: 1 })
      expect(Object.keys(strict.errors ?? {}).length).toBeGreaterThan(0)
      const loose = await new SchemaLooseThing().validate({ name: 'a', other: 1 })
      expect(Object.keys(loose.errors ?? {})).toEqual([])
    })
  })

  describe('maps fixture', () => {
    const MAPS = path.resolve(__dirname, '../fixtures/maps')
    const gen = () => new SchemaGenerator(new ConfigLoader().load(MAPS))

    it('maps index signatures to matchAll and unknown records to opaque objects', async () => {
      const [file] = await gen().generate()
      const c = file.content
      expect(c).toContain(
        "sb.schema('l10n').construct('L10n').strict().matchAll(sb.string().trim())",
      )
      expect(c).toContain('attributes: sb.object().matchAll(sb.string().stripHtml()).required(),')
      expect(c).toContain('counts: sb.object().matchAll(sb.number()).required(),')
      expect(c).toContain('meta: sb.object().as<Record<string, unknown>>().required(),')
      expect(c).toContain('raw: sb.object().as<object>(),')
      expect(c).toContain('optionalMap: sb.object().matchAll(sb.string()),')
      expect(c).toContain('nullableMap: sb.object().matchAll(sb.boolean()).required().nullable(),')
    })

    it('matches the checked-in file', async () => {
      expect((await gen().check()).stale).toEqual([])
    })

    it('compiles with exact types', () => {
      const configFile = ts.readConfigFile(path.join(MAPS, 'tsconfig.json'), ts.sys.readFile)
      const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, MAPS)
      const program = ts.createProgram(parsed.fileNames, {
        ...parsed.options,
        strictNullChecks: true,
      })
      const errors = ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
      expect(errors).toEqual([])
    })

    it('validates every map entry at runtime', async () => {
      const { SchemaL10n } = await import('../fixtures/maps/src/maps.schema')
      const ok = await new SchemaL10n().validate({ en: ' hi ', de: 'hallo' })
      expect(Object.keys(ok.errors ?? {})).toEqual([])
      const bad = await new SchemaL10n().validate({ en: { nested: true } })
      expect(Object.keys(bad.errors ?? {}).length).toBeGreaterThan(0)
    })
  })

  describe('shapes fixture', () => {
    const SHAPES = path.resolve(__dirname, '../fixtures/shapes')
    const gen = () => new SchemaGenerator(new ConfigLoader().load(SHAPES))

    it('generates refs, objects, unions, relations and registry callbacks', async () => {
      const files = await gen().generate()
      const post = files.find((f) => f.path.endsWith('post.schema.ts'))!.content
      expect(post).toContain("import { SchemaAuthor } from './author.schema'")
      expect(post).toContain("import { filters, initialisers, validators } from './registry'")
      expect(post).toContain('_id: sb.string().init(initialisers.genId),')
      expect(post).toContain('createdAt: sb.date().default(initialisers.now),')
      expect(post).toContain('.validate(validators.slugUnique)')
      expect(post).toContain('.filter(filters.stripEmoji)')
      expect(post).toContain('sb.refTo<SpecFor<AuthorData>>((): unknown => SchemaAuthor)')
      expect(post).toContain("import type { AuthorData } from './author'")
      expect(post).toMatch(/\.required\(\)\s*\.relation\(\)/)
      expect(post).toMatch(
        /reviewer: sb\s*\.refTo<SpecFor<AuthorData>>\(\(\): unknown => SchemaAuthor\)\s*\.nullable\(\)/,
      )
      expect(post).toMatch(/\.or\(\[\s*sb\.refTo<SpecFor<ParagraphData>>/)
      expect(post).toContain('lat: sb.number().required()')
    })

    it('matches the checked-in files', async () => {
      expect((await gen().check()).stale).toEqual([])
    })

    it('compiles with exact types, including the import cycle', () => {
      const configFile = ts.readConfigFile(path.join(SHAPES, 'tsconfig.json'), ts.sys.readFile)
      const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, SHAPES)
      const program = ts.createProgram(parsed.fileNames, {
        ...parsed.options,
        strictNullChecks: true,
      })
      const errors = ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
      expect(errors).toEqual([])
    })
  })

  describe('with a temporary project', () => {
    let dir: string

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datacapy-gen-'))
      fs.mkdirSync(path.join(dir, 'src'))
      fs.writeFileSync(
        path.join(dir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
      )
    })
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

    const generator = (config = {}) => new SchemaGenerator(new ConfigLoader().resolve(dir, config))
    const generate = (source: string, config = {}) => {
      fs.writeFileSync(path.join(dir, 'src/a.ts'), source)
      return generator(config).generate()
    }

    it('reports stale and missing files in check mode', async () => {
      fs.writeFileSync(
        path.join(dir, 'src/a.ts'),
        '/** @schema a */\nexport interface A { n: number }\n',
      )
      const gen = generator()
      const target = path.join(dir, 'src/a.schema.ts')
      expect((await gen.check()).stale).toEqual([target])
      await gen.write()
      expect((await gen.check()).stale).toEqual([])
      fs.appendFileSync(target, '// edited\n')
      expect((await gen.check()).stale).toEqual([target])
    })

    it('ignores interfaces without the marker', async () => {
      expect(await generate('export interface A { n: number }\n')).toEqual([])
    })

    it('honours outDir', async () => {
      const [file] = await generate('/** @schema a */\nexport interface A { n: number }\n', {
        outDir: 'gen',
      })
      expect(file.path).toBe(path.join(dir, 'gen/src/a.schema.ts'))
      expect(file.content).toContain("from '../../src/a'")
    })

    it('uses importMap for a schema declared in another package', async () => {
      fs.writeFileSync(
        path.join(dir, 'src/b.ts'),
        '/** @schema b */\nexport interface B { n: number }\n',
      )
      const files = await generate(
        '/** @schema a */\nexport interface A { b: import("./b").B }\n',
        { importMap: { B: { schema: '@other/pkg/schema', type: '@other/pkg' } } },
      )
      const a = files.find((f) => f.path.endsWith('a.schema.ts'))!
      expect(a.content).toContain("import { SchemaB } from '@other/pkg/schema'")
      expect(a.content).toContain("import type { B } from '@other/pkg'")
    })

    describe('patterns VeySur relies on', () => {
      const tags = [
        `type MaxLength<N extends number> = { readonly '$dc:maxLength'?: N }`,
        `type Default<V extends string | number | boolean | null> = { readonly '$dc:default'?: V }`,
        `type Trim = { readonly '$dc:trim'?: true }`,
      ].join('\n')

      it('resolves a tag argument given as typeof a const', async () => {
        const [file] = await generate(
          `${tags}\nexport const MAX = 64 as const\nexport const ROLE = 'customer' as const\n` +
            `/** @schema a */\nexport interface A {\n` +
            `  name: string & MaxLength<typeof MAX>\n  role: string & Default<typeof ROLE>\n}\n`,
        )
        expect(file.content).toContain('name: sb.string().required().maxLength(64),')
        expect(file.content).toContain("role: sb.string().default('customer'),")
      })

      it('generates an extending interface that narrows a base property', async () => {
        const [file] = await generate(
          `${tags}\ninterface Base { name: string & MaxLength<200>; kind: string; note?: string }\n` +
            `/** @schema a */\nexport interface A extends Base {\n` +
            `  name: string & MaxLength<50> & Trim\n  kind: 'x' | 'y'\n}\n`,
        )
        expect(file.content).toContain('name: sb.string().required().maxLength(50).trim(),')
        expect(file.content).toContain("kind: sb.string().required().inArray(['x', 'y']),")
        expect(file.content).toContain('note: sb.string(),')
      })

      it('generates an interface extending a marked base declared in another file', async () => {
        fs.writeFileSync(
          path.join(dir, 'src/base.ts'),
          `${tags}\n/** @schema base */\nexport interface BaseData { name: string & MaxLength<200> }\n`,
        )
        const files = await generate(
          `import type { BaseData } from './base'\n/** @schema a */\n` +
            `export interface A extends BaseData { extra: number }\n`,
        )
        const a = files.find((f) => f.path.endsWith('a.schema.ts'))!
        expect(a.content).toContain('name: sb.string().required().maxLength(200),')
        expect(a.content).toContain('extra: sb.number().required(),')
      })
    })

    it('names the property path for an unsupported type', async () => {
      await expect(
        generate('/** @schema a */\nexport interface A { m: Map<string, string> }\n'),
      ).rejects.toThrow(new GeneratorError('A.m', 'unsupported type Map<string, string>'))
    })

    it('rejects a marker without a name', async () => {
      await expect(generate('/** @schema */\nexport interface A { n: number }\n')).rejects.toThrow(
        /needs a schema name/,
      )
    })

    it('emits constructCollection for a tagged array, nested or not', async () => {
      const tags = `type C<N extends string> = { readonly '$dc:constructCollection'?: N }\n`
      const [file] = await generate(
        `${tags}/** @schema a */\nexport interface A {\n` +
          `  rows: ({ n: number })[] & C<'RowCollection'>\n` +
          `  grid: ((string)[] & C<'RowCollection'>)[] & C<'GridCollection'>\n}\n`,
      )
      const c = file.content.replace(/\s+/g, '')
      expect(c).toContain(
        "rows:sb.array(sb.object({n:sb.number().required()}).required()).required().constructCollection('RowCollection')",
      )
      expect(c).toContain(
        "sb.array(sb.array(sb.string().required()).required().constructCollection('RowCollection')).required().constructCollection('GridCollection')",
      )
    })

    it('rejects constructCollection on a non-array', async () => {
      const tags = `type C = { readonly '$dc:constructCollection'?: 'X' }\n`
      await expect(
        generate(`${tags}/** @schema a */\nexport interface A { r: string & C }\n`),
      ).rejects.toThrow(/A\.r: tag constructCollection only applies to arrays/)
    })

    it('emits constructCollection from the config without a construct', async () => {
      const src = '/** @schema a */\nexport interface A { n: number }\n'
      const [file] = await generate(src, { collections: { a: 'ACollection' } })
      expect(file.content).toContain("sb.schema('a').constructCollection('ACollection')")
      expect(file.content).not.toContain('.construct(')
    })

    it('rejects an index signature mixed with named properties', async () => {
      await expect(
        generate('/** @schema a */\nexport interface A { id: string; [k: string]: string }\n'),
      ).rejects.toThrow(/index signature mixed with named properties/)
      await expect(
        generate(
          '/** @schema a */\nexport interface A { m: { id: string; [k: string]: string } }\n',
        ),
      ).rejects.toThrow(/A\.m: an index signature mixed with named properties/)
    })

    it('does not emit strict by default, and the config default can turn it on', async () => {
      const src = '/** @schema a */\nexport interface A { n: number }\n'
      expect((await generate(src))[0].content).not.toContain('.strict()')
      expect((await generate(src, { strict: true }))[0].content).toContain(
        "sb.schema('a').strict()",
      )
    })

    it('lets a per-interface option override the config default', async () => {
      const src = '/** @schema a strict */\nexport interface A { n: number }\n'
      expect((await generate(src))[0].content).toContain("sb.schema('a').strict()")
      const off = '/** @schema a no-strict */\nexport interface A { n: number }\n'
      expect((await generate(off, { strict: true }))[0].content).not.toContain('.strict()')
    })

    it('rejects an unknown marker option and a bad construct name', async () => {
      await expect(
        generate('/** @schema a colour=red */\nexport interface A { n: number }\n'),
      ).rejects.toThrow(/unknown @schema option "colour=red"/)
      await expect(
        generate('/** @schema a construct= */\nexport interface A { n: number }\n'),
      ).rejects.toThrow(/construct needs a class name/)
    })

    it('rejects a marker that starts with an option instead of a name', async () => {
      await expect(
        generate('/** @schema strict */\nexport interface A { n: number }\n'),
      ).rejects.toThrow(/needs a schema name/)
    })

    it('rejects Validate without a registry', async () => {
      const tags = `type V = { readonly '$dc:validate'?: 'x' }\n`
      await expect(
        generate(`${tags}/** @schema a */\nexport interface A { r: string & V }\n`),
      ).rejects.toThrow(/needs a "registry" module/)
    })

    it('rejects InitFn without a registry', async () => {
      const tags = `type F = { readonly '$dc:initFn'?: 'x' }\n`
      await expect(
        generate(`${tags}/** @schema a */\nexport interface A { r: string & F }\n`),
      ).rejects.toThrow(/tag initFn needs a "registry" module/)
    })

    it('rejects a literal and a function for the same slot', async () => {
      const tags =
        `type I = { readonly '$dc:init'?: 'a' }\n` + `type F = { readonly '$dc:initFn'?: 'x' }\n`
      await expect(
        generate(`${tags}/** @schema a */\nexport interface A { r: string & I & F }\n`, {
          registry: 'r.ts',
        }),
      ).rejects.toThrow(/tags init and initFn cannot be combined/)
    })

    it('rejects tags it does not know', async () => {
      const tags = `type W = { readonly '$dc:whatever'?: true }\n`
      await expect(
        generate(`${tags}/** @schema a */\nexport interface A { r: string & W }\n`),
      ).rejects.toThrow(/tag whatever is not supported/)
    })
  })
})
