import { afterEach, describe, expect, it, vi } from 'vitest'
import { runAgentHibernationTick } from './agent-hibernation-coordinator'
import {
  entry,
  installEligibleState,
  installRuntimeListResponses,
  LEAF,
  mockRuntimeEnvironmentCall,
  resetAgentHibernationCoordinatorFixture,
  tab
} from './agent-hibernation-coordinator-test-fixture'
import { makeWorktree } from '@/store/slices/worktrees-slice-test-fixtures'

afterEach(resetAgentHibernationCoordinatorFixture)

// One repo id + path published by both an SSH host and a managed runtime (mid-migration).
const twinRows = {
  'fixture-repo': [
    makeWorktree({ id: 'wt-bg', repoId: 'fixture-repo', hostId: 'ssh:ssh-1' }),
    makeWorktree({
      id: 'wt-bg',
      repoId: 'fixture-repo',
      hostId: 'local',
      runtimeOwnerEnvironmentId: 'runtime-1'
    })
  ]
}

function installTwin(ptyId: string) {
  return installEligibleState(vi.fn().mockResolvedValue(undefined), {
    worktreesByRepo: twinRows,
    tabsByWorktree: { 'wt-bg': [tab()] },
    terminalLayoutsByTabId: {
      'tab-1': {
        root: { type: 'leaf', leafId: LEAF },
        activeLeafId: LEAF,
        expandedLeafId: null,
        ptyIdsByLeafId: { [LEAF]: ptyId }
      }
    },
    ptyIdsByTabId: { 'tab-1': [ptyId] },
    agentStatusByPaneKey: { [entry().paneKey]: entry() }
  })
}

function listSelectors(): string[] {
  return mockRuntimeEnvironmentCall.mock.calls
    .map(([args]) => args)
    .filter((args) => args.method === 'terminal.list')
    .map((args) => ('selector' in args ? String(args.selector) : ''))
}

describe('agent sleep coordinator with a twin-published worktree', () => {
  it('never hibernates a remote PTY whose runtime it cannot name', async () => {
    installRuntimeListResponses()
    const shutdown = installTwin('remote:pty-1')

    await runAgentHibernationTick()
    await runAgentHibernationTick()

    expect(listSelectors()).toEqual([])
    expect(shutdown).not.toHaveBeenCalled()
  })

  it('hibernates an SSH-host PTY locally, without a runtime stop', async () => {
    installRuntimeListResponses()
    const shutdown = installTwin('ssh:ssh-1@@pty-1')

    await runAgentHibernationTick()
    await runAgentHibernationTick()

    expect(listSelectors()).toEqual([])
    expect(shutdown).toHaveBeenCalledWith('wt-bg', {
      paneKey: `tab-1:${LEAF}`,
      tabId: 'tab-1',
      leafId: LEAF,
      ptyId: 'ssh:ssh-1@@pty-1'
    })
  })
})
