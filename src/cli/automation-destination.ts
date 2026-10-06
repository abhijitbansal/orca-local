/**
 * Where a CLI create — or an edit that moves the record's project/workspace —
 * wants the automation to land.
 *
 * The CLI cannot project a host itself, so it asks the same authority that will
 * perform the write to resolve the selector it was given. In this build every
 * reachable repo lives on this machine, so the destination is always `self`.
 */

import type { AutomationDestination } from '../shared/automation-owner-precondition'
import type { RuntimeWorktreeRecord } from '../shared/runtime-types'
import type { Repo } from '../shared/repo-types'
import type { RuntimeClient } from './runtime-client'

/** The project/workspace selectors the same request carries; both empty means the host cannot change. */
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
