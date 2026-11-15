import * as path from 'path'

import { SourceHost } from './source-host'

describe('SourceHost', () => {
  const rootDir = path.resolve('/project')
  const host = new SourceHost({
    tsconfig: path.join(rootDir, 'tsconfig.json'),
    rootDir,
    include: ['src/model/**/*.ts', 'src/*.ts'],
    marker: 'schema',
  })

  describe('isIncluded()', () => {
    it('matches nested files for a ** glob', () => {
      expect(host.isIncluded(path.join(rootDir, 'src/model/a/b/Note.ts'))).toBe(true)
      expect(host.isIncluded(path.join(rootDir, 'src/model/Note.ts'))).toBe(true)
    })

    it('keeps a single * within one directory', () => {
      expect(host.isIncluded(path.join(rootDir, 'src/Note.ts'))).toBe(true)
      expect(host.isIncluded(path.join(rootDir, 'src/other/Note.ts'))).toBe(false)
    })

    it('skips declaration files and node_modules', () => {
      expect(host.isIncluded(path.join(rootDir, 'src/model/Note.d.ts'))).toBe(false)
      expect(host.isIncluded(path.join(rootDir, 'src/node_modules/x/Note.ts'))).toBe(false)
    })
  })

  describe('importPath()', () => {
    it('is relative, drops the extension and uses forward slashes', () => {
      expect(host.importPath('/p/src/a/Note.schema.ts', '/p/src/b/Note.ts')).toBe('../b/Note')
    })

    it('prefixes ./ for a sibling', () => {
      expect(host.importPath('/p/src/Note.schema.ts', '/p/src/Note.ts')).toBe('./Note')
    })
  })
})
