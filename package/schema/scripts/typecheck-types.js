// Type-checks the *.type-test.ts files with strictNullChecks on. The library
// source itself is written without strictNullChecks, so tsc also reports
// errors in it; only errors located in a type-test file count here.
const { spawnSync } = require('child_process')

const result = spawnSync('npx', ['tsc', '-p', 'tsconfig.types.json'], {
  encoding: 'utf8',
})
const lines = (result.stdout || '').split('\n')
const own = lines.filter((line) => /^src\/.*\.type-test\.ts\(/.test(line))
if (own.length > 0) {
  console.error(own.join('\n'))
  process.exit(1)
}
console.log('type tests ok')
