import { RuntimeClientError } from './runtime/types'

const PAIRED_SERVER_ENV_VARS = ['ORCA_ENVIRONMENT', 'ORCA_PAIRING_CODE', 'ORCA_REMOTE_PAIRING']

// Why: these variables used to route every command to a paired server; silently ignoring them
// would run the command against the local runtime instead, so fail closed.
export function refusePairedServerEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const name = PAIRED_SERVER_ENV_VARS.find((key) => (env[key] ?? '').trim().length > 0)
  if (!name) {
    return
  }
  throw new RuntimeClientError(
    'invalid_argument',
    `${name} selects a paired Orca server; remote runtimes are unsupported in this build. Unset it to target this machine.`
  )
}
