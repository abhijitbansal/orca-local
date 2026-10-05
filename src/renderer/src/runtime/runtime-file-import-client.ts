import { withSshMutationExpectation } from './runtime-file-routing'
import type { ImportItemResult } from '../../../shared/filesystem-import-result-types'
import type { RuntimeFileOperationArgs } from './runtime-file-client-types'
import { getActiveRuntimeTarget } from './runtime-rpc-client'

export async function importExternalPathsToRuntime(
  context: RuntimeFileOperationArgs,
  sourcePaths: string[],
  destinationDir: string,
  options?: { ensureDestinationDir?: boolean; assertCurrent?: () => void }
): Promise<{ results: ImportItemResult[] }> {
  const target = getActiveRuntimeTarget(context.settings)
  if (target.kind !== 'environment' || !context.worktreeId || !context.worktreePath) {
    return window.api.fs.importExternalPaths(
      withSshMutationExpectation(context, {
        sourcePaths,
        destDir: destinationDir,
        connectionId: context.connectionId,
        ensureDir: options?.ensureDestinationDir
      })
    )
  }
  throw new Error(
    'unsupported_in_local_build: importing files into a remote Orca runtime was removed'
  )
}
