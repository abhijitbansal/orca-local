import { useAppStore } from '@/store'
import type { WorktreeCreationRequest } from './pending-worktree-creation'
import { ensureHooksConfirmed, readAndConfirmRuntimeIssueCommand } from './ensure-hooks-confirmed'
import { buildTrustedComposerIssueCommand } from './composer-issue-command'
import { getInitialWorktreeCreationPhase } from './worktree-creation-flow-startup'

export async function prepareWorktreeCreationHooks(
  creationId: string,
  request: WorktreeCreationRequest
): Promise<WorktreeCreationRequest | null> {
  const preparation = request.hookPreparation
  if (!preparation) {
    return request
  }

  const isCancelled = (): boolean => !useAppStore.getState().pendingWorktreeCreations[creationId]
  const trustDecision = await ensureHooksConfirmed(
    useAppStore.getState,
    request.repoId,
    'setup',
    preparation.executionHostId,
    undefined,
    isCancelled
  )
  if (isCancelled()) {
    return null
  }

  let issueCommand = request.issueCommand
  if (preparation.issueCommand && preparation.executionHostId && trustDecision !== 'skip') {
    const confirmed = await readAndConfirmRuntimeIssueCommand(
      useAppStore.getState(),
      request.repoId,
      preparation.executionHostId,
      isCancelled
    )
    if (isCancelled()) {
      return null
    }
    issueCommand = buildTrustedComposerIssueCommand({
      ...preparation.issueCommand,
      enabled: true,
      template: confirmed.template,
      trustDecision: confirmed.trustDecision
    })
  }

  const prepared: WorktreeCreationRequest = {
    ...request,
    hookPreparation: undefined,
    executionHostId: request.executionHostId ?? preparation.executionHostId,
    setupDecision: trustDecision === 'skip' ? 'skip' : request.setupDecision,
    issueCommand
  }
  useAppStore.getState().updatePendingWorktreeCreation(creationId, {
    request: prepared,
    phase: getInitialWorktreeCreationPhase(prepared)
  })
  return prepared
}
