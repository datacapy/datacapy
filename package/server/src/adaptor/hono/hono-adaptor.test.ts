import { runAdaptorConformance } from '../../test-utils/adaptor-conformance'
import { HonoAdaptor } from './hono-adaptor'

const logger = { error: jest.fn(), info: jest.fn() }

runAdaptorConformance(
  'Hono',
  () => new HonoAdaptor({ path: '/api', port: 0 }, logger, async () => {}),
  { logsSourceStreamErrors: true }
)
