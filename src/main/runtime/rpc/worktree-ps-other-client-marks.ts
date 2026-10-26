import type { RuntimeWorktreePsResult } from '../../../shared/runtime-worktree-contracts'
import type { RpcContext } from './core'

/** No phone client exists in this build, so no caller is shown other-client marks. */
export function markWorktreePsOtherClientRows<T extends RuntimeWorktreePsResult>(
  result: T,
  _context: Pick<RpcContext, 'clientKind' | 'pairedDeviceParentId'>
): T {
  return result
}
