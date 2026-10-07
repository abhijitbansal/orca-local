import { RuntimeRpcCallError } from './runtime-rpc-result'

export const UNSUPPORTED_IN_LOCAL_BUILD_CODE = 'unsupported_in_local_build'
// Diagnostic text on an unreachable path, not UI copy.
const UNSUPPORTED_IN_LOCAL_BUILD_DETAIL = 'Remote Orca runtimes are unsupported in this build.'

// Why: a runtime: id names a paired Orca server this build cannot dial; never fall back to local.
export function createUnsupportedInLocalBuildError(): RuntimeRpcCallError {
  return new RuntimeRpcCallError({
    id: 'local-only',
    ok: false,
    error: {
      code: UNSUPPORTED_IN_LOCAL_BUILD_CODE,
      message: UNSUPPORTED_IN_LOCAL_BUILD_DETAIL
    }
  })
}
