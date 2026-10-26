// Capture the authority's SSH generation so it can reject removed or re-registered targets at write time.

import type { AutomationDestination } from '../shared/automation-owner-precondition'
import type { RuntimeWorktreeRecord } from '../shared/runtime-types'
import type { Repo } from '../shared/repo-types'
import type { RuntimeClient } from './runtime-client'

/** Empty selectors mean the execution host cannot change. */
export type AutomationDestinationTarget = { repo?: string; workspace?: string }

async function resolveTargetRepo(
  client: RuntimeClient,
  target: AutomationDestinationTarget
): Promise<Repo> {
  if (target.repo) {
    return (await client.call<{ repo: Repo }>('repo.show', { repo: target.repo })).result.repo
  }
  const worktree = (
    await client.call<{ worktree: RuntimeWorktreeRecord }>('worktree.show', {
      worktree: target.workspace
    })
  ).result.worktree
  return (await client.call<{ repo: Repo }>('repo.show', { repo: `id:${worktree.repoId}` })).result
    .repo
}

export async function resolveAutomationDestination(
  client: RuntimeClient,
  target: AutomationDestinationTarget
): Promise<AutomationDestination | undefined> {
  if (!target.repo && !target.workspace) {
    return undefined
  }
  // Why: resolving the repo still fails loudly when the selector names nothing reachable.
  await resolveTargetRepo(client, target)
  return { selector: { kind: 'self' } }
}
