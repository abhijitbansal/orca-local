import { withSshMutationExpectation } from './runtime-file-routing'
import type { ImportItemResult } from '../../../shared/filesystem-import-result-types'
import type { LocalFileAccess } from '../../../shared/local-file-access'
import type { RuntimeFileOperationArgs } from './runtime-file-client-types'
import { createUnsupportedInLocalBuildError } from './runtime-environment-unsupported'
import { localAccess } from './runtime-file-read-client'

export async function importExternalPathsToRuntime(
  context: RuntimeFileOperationArgs,
  sourcePaths: string[],
  destinationDir: string,
  options?: {
    ensureDestinationDir?: boolean
    assertCurrent?: () => void
    /** Local imports only; remote destinations stay root-relative. */
    access?: LocalFileAccess
    /** Remote `.orca/drops` uploads: name an extensionless image by its bytes. */
    nameExtensionlessImages?: boolean
  }
): Promise<{ results: ImportItemResult[] }> {
  // Why: remote runtimes are removed in this build; a runtime: owner fails closed, never local.
  if (context.target.kind === 'environment') {
    throw createUnsupportedInLocalBuildError()
  }
  return window.api.fs.importExternalPaths(
    withSshMutationExpectation(context, {
      sourcePaths,
      destDir: destinationDir,
      connectionId: context.connectionId,
      ensureDir: options?.ensureDestinationDir,
      ...localAccess(context.connectionId, options?.access)
    })
  )
}
