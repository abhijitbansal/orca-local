import { describe, expect, it, vi } from 'vitest'
import { buildMobileTerminalChatFork } from './mobile-terminal-chat-fork'
import { prepareStructuredChatCliFork } from '../../../ai-vault/structured-chat-cli-fork'
import { OrchestrationError } from '../../orchestration/orchestration-error'
import { PROJECT_RUNTIME_REPAIR_REQUIRED_CODE } from '../../../../shared/project-runtime-repair-message'
import '../../orca-runtime-test-lifecycle.spec'
vi.mock('../../../ai-vault/structured-chat-cli-fork', () => ({
  prepareStructuredChatCliFork: vi.fn(),
  isStructuredChatCliForkSourceCurrent: vi.fn(() => true)
}))
const cwd = process.platform === 'win32' ? 'C:\\repo' : '/tmp/repo'
const filePath = process.platform === 'win32' ? 'C:\\sessions\\chat.jsonl' : '/tmp/chat.jsonl'
const runtime = {
  platform: process.platform,
  pty: { shellOverride: undefined, terminalWindowsWslDistro: null }
}

describe('native chat fork launch recipe', () => {
  it('keeps Manual empty args, custom command and environment in an independent fork', () => {
    const startup = buildMobileTerminalChatFork({
      prepared: {
        useRealCodexHome: false,
        cliForkSource: {
          agent: 'claude',
          sourceAgent: 'claude',
          sessionId: 'original-chat',
          filePath,
          cwd,
          codexHome: null,
          executionHostPlatform: process.platform
        }
      },
      settings: {
        agentCmdOverrides: { claude: 'my-claude' },
        agentDefaultArgs: { claude: '' },
        agentDefaultEnv: { claude: { MY_SETTING: 'present' } }
      },
      runtime
    })
    expect(startup.command).toContain('my-claude')
    expect(startup.command).toContain('original-chat')
    expect(startup.command).toContain('fork-session')
    expect(startup.env).toMatchObject({ MY_SETTING: 'present' })
    expect(startup.cwd).toBe(cwd)
    expect(startup.launchRuntime).toBe(runtime)
    expect(startup).not.toHaveProperty('resumeProviderSession')
  })

  it('opens the host copy without reusing the chat identity', () => {
    const startup = buildMobileTerminalChatFork({
      prepared: {
        useRealCodexHome: false,
        forkedSession: { agent: 'opencode', sessionId: 'copy', filePath },
        cliForkSource: {
          agent: 'opencode',
          sourceAgent: 'opencode',
          sessionId: 'copy',
          filePath,
          cwd,
          codexHome: null,
          executionHostPlatform: process.platform
        }
      },
      settings: { agentDefaultArgs: { opencode: '' } },
      runtime
    })
    expect(startup.command).toContain('copy')
    expect(startup.command).not.toContain('original-chat')
    expect(startup.resumeProviderSession?.id).toBe('copy')
  })
})

it('keeps preparation and runtime failures from starting a terminal', async () => {
  const { OrcaRuntimeService } = await import('../../orca-runtime-test-mocks.spec')
  const { store, TEST_WORKTREE_ID } = await import('../../orca-runtime-test-fixtures.spec')
  const runtime = new OrcaRuntimeService(store)
  const spawn = vi.fn()
  runtime.setPtyController({
    spawn,
    write: () => true,
    kill: () => true,
    getForegroundProcess: async () => null
  })
  const ensure = vi.spyOn(runtime, 'ensureStructuredAgentSessionHost')
  for (const [failure, expected] of [
    [
      new Error(
        'Could not confirm this conversation was saved. Try again after the agent responds.'
      ),
      { message: 'chat_fork_source_unavailable' }
    ],
    [
      new Error('This chat has no saved conversation to copy.'),
      { message: 'chat_fork_source_unavailable' }
    ],
    [
      new OrchestrationError(PROJECT_RUNTIME_REPAIR_REQUIRED_CODE, 'Repair project settings.'),
      { code: PROJECT_RUNTIME_REPAIR_REQUIRED_CODE }
    ]
  ] as const) {
    ensure.mockResolvedValueOnce(undefined)
    vi.mocked(prepareStructuredChatCliFork).mockRejectedValueOnce(failure)
    await expect(
      runtime['createMobileChatForkTerminal']({
        workspace: {
          id: TEST_WORKTREE_ID,
          path: cwd,
          connectionId: null,
          repo: null,
          folderWorkspace: null
        },
        worktreeId: TEST_WORKTREE_ID,
        opts: { sourceChatFork: { sessionId: 'unsaved-chat' }, clientMutationId: 'next-create' },
        graphEpoch: 0
      })
    ).rejects.toMatchObject(expected)
  }
  expect(spawn).not.toHaveBeenCalled()
})
