type ConsolePattern = string | RegExp

// No known-benign console.error/warn patterns - Repo.warnUnknownQueryKeys' false positive on
// schema-less/field-free-schema repos is fixed at the source (see repo.ts), so this warning
// only fires now for a repo that has a real, populated schema - genuine signal, not noise.
const KNOWN_BENIGN_PATTERNS: ConsolePattern[] = []

const activeScopedPatterns: ConsolePattern[] = []

function matchesAnyPattern(
  message: string,
  patterns: ConsolePattern[]
): boolean {
  return patterns.some((pattern) =>
    typeof pattern === 'string'
      ? message.includes(pattern)
      : pattern.test(message)
  )
}

function guard(methodName: 'error' | 'warn') {
  const original = console[methodName].bind(console)
  return jest
    .spyOn(console, methodName)
    .mockImplementation((...args: unknown[]) => {
      const message = args.map(String).join(' ')
      if (
        matchesAnyPattern(message, KNOWN_BENIGN_PATTERNS) ||
        matchesAnyPattern(message, activeScopedPatterns)
      ) {
        return
      }
      original(...args)
      throw new Error(
        `Unexpected console.${methodName} call: "${message}". If this is expected, wrap the ` +
          `triggering code in allowConsole(...) from src/test-utils/consoleGuard.ts.`
      )
    })
}

export function installConsoleGuard(): void {
  let errorSpy: jest.SpyInstance
  let warnSpy: jest.SpyInstance
  let logSpy: jest.SpyInstance

  beforeEach(() => {
    errorSpy = guard('error')
    warnSpy = guard('warn')
    // Lifecycle logging from DataSourceRegistry/DataSourceManager is informational only.
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    errorSpy.mockRestore()
    warnSpy.mockRestore()
    logSpy.mockRestore()
  })
}

export async function allowConsole<T>(
  patterns: ConsolePattern[] | ConsolePattern,
  fn: () => T | Promise<T>
): Promise<T> {
  const patternList = Array.isArray(patterns) ? patterns : [patterns]
  activeScopedPatterns.push(...patternList)
  try {
    return await fn()
  } finally {
    for (const pattern of patternList) {
      const index = activeScopedPatterns.indexOf(pattern)
      if (index !== -1) activeScopedPatterns.splice(index, 1)
    }
  }
}
