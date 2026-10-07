// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../shared/repo-types'
import type { Worktree } from '../../../shared/worktree/types'
import { useAppStore } from '@/store'
import { useFileDeletion } from '@/components/right-sidebar/useFileDeletion'
import { getFileExplorerOperationOwner } from '@/components/right-sidebar/file-explorer-operation-owner'
import type {
  FileExplorerOperationOwner,
  TreeNode
} from '@/components/right-sidebar/file-explorer-types'
import { renameFileOnDisk } from '@/lib/rename-file'

const { confirm, toastError } = vi.hoisted(() => ({
  confirm: vi.fn(),
  toastError: vi.fn()
}))
const fsReadFile = vi.fn()
const fsDeletePath = vi.fn()
const fsRenamePath = vi.fn()
const runtimeEnvironmentCall = vi.fn()

vi.mock('@/components/confirmation-dialog-context', () => ({
  useConfirmationDialog: () => confirm
}))
vi.mock('@/hooks/useShortcutLabel', () => ({ useShortcutLabel: () => 'Delete' }))
vi.mock('@/components/editor/editor-autosave', () => ({
  requestEditorFileSave: vi.fn().mockResolvedValue(undefined),
  requestEditorSaveQuiesce: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@/components/right-sidebar/fileExplorerUndoRedo', () => ({
  commitFileExplorerOp: vi.fn()
}))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const initialState = useAppStore.getInitialState()
const SSH_ID = 'ssh-target-1'
const LOCAL_REPO_ID = 'repo-shared'
const LOCAL_WORKTREE_ID = `${LOCAL_REPO_ID}::/tmp/project`
const localNode: TreeNode = {
  name: 'index.ts',
  path: '/tmp/project/src/index.ts',
  relativePath: 'src/index.ts',
  isDirectory: false,
  depth: 0,
  operationOwner: { kind: 'local' }
}

function makeRepo(overrides: Partial<Repo> & { id: string; path: string }): Repo {
  return { displayName: overrides.id, badgeColor: '#000', addedAt: 0, ...overrides }
}

function makeWorktree(hostId: Worktree['hostId'], runtimeOwnerEnvironmentId?: string): Worktree {
  return {
    id: LOCAL_WORKTREE_ID,
    repoId: LOCAL_REPO_ID,
    path: '/tmp/project',
    hostId,
    runtimeOwnerEnvironmentId
  } as Worktree
}

function renderDelete(activeWorktreeId: string) {
  return renderHook(() =>
    useFileDeletion({
      activeWorktreeId,
      openFiles: [],
      closeFile: vi.fn(),
      refreshDir: vi.fn().mockResolvedValue(undefined),
      setSelectedPaths: vi.fn(),
      isWindows: false
    })
  )
}

async function requestDelete(
  result: ReturnType<typeof renderDelete>['result'],
  node: TreeNode,
  operationOwner: FileExplorerOperationOwner
): Promise<void> {
  await act(async () => {
    result.current.requestDelete({ ...node, operationOwner })
  })
}

beforeEach(() => {
  confirm.mockReset().mockResolvedValue(true)
  toastError.mockReset()
  fsReadFile.mockReset().mockResolvedValue({ content: 'content', isBinary: false })
  fsDeletePath.mockReset().mockResolvedValue(undefined)
  fsRenamePath.mockReset().mockResolvedValue(undefined)
  runtimeEnvironmentCall.mockReset()
  vi.stubGlobal('window', {
    api: {
      fs: {
        readFile: fsReadFile,
        deletePath: fsDeletePath,
        rename: fsRenamePath,
        renamePath: fsRenamePath
      },
      runtime: { call: vi.fn() },
      runtimeEnvironments: { call: runtimeEnvironmentCall, subscribe: vi.fn() }
    }
  })
})

afterEach(() => {
  useAppStore.setState(initialState, true)
  vi.unstubAllGlobals()
})

describe('file explorer deletion owner provenance', () => {
  function useRuntimeOwnedWorktree(): void {
    useAppStore.setState({
      settings: { activeRuntimeEnvironmentId: 'different-hub' } as never,
      repos: [
        makeRepo({
          id: LOCAL_REPO_ID,
          path: '/tmp/project',
          connectionId: SSH_ID,
          executionHostId: 'runtime:owner-hub'
        })
      ],
      worktreesByRepo: {
        [LOCAL_REPO_ID]: [makeWorktree(`ssh:${SSH_ID}`, 'owner-hub')]
      },
      sshStateByEnvironment: new Map([
        [
          'owner-hub',
          { connectionStates: new Map([[SSH_ID, { connectionGeneration: 1 }]]) } as never
        ]
      ])
    })
  }

  it('fails a runtime-owned delete closed and never deletes locally or over local SSH', async () => {
    useRuntimeOwnedWorktree()
    const owner = getFileExplorerOperationOwner(LOCAL_WORKTREE_ID)
    expect(owner).toMatchObject({ kind: 'runtime', environmentId: 'owner-hub' })

    const { result } = renderDelete(LOCAL_WORKTREE_ID)
    await requestDelete(result, localNode, owner)

    await vi.waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(fsDeletePath).not.toHaveBeenCalled()
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('fails a runtime-owned rename closed and never renames locally or over local SSH', async () => {
    useRuntimeOwnedWorktree()

    await renameFileOnDisk({
      oldPath: '/tmp/project/src/old.ts',
      newName: 'new.ts',
      worktreeId: LOCAL_WORKTREE_ID,
      worktreePath: '/tmp/project'
    })

    // Why: renameFileOnDisk reports failures through a toast rather than rejecting.
    expect(toastError).toHaveBeenCalled()
    expect(fsRenamePath).not.toHaveBeenCalled()
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('fails a paired-server delete closed instead of deleting the local path', async () => {
    useAppStore.setState({
      settings: { activeRuntimeEnvironmentId: 'web-server-b' } as never,
      repos: [
        makeRepo({
          id: LOCAL_REPO_ID,
          path: '/tmp/project',
          executionHostId: 'runtime:web-server-a'
        })
      ],
      worktreesByRepo: { [LOCAL_REPO_ID]: [makeWorktree('runtime:web-server-a')] }
    })
    const owner = getFileExplorerOperationOwner(LOCAL_WORKTREE_ID)
    expect(owner).toMatchObject({ kind: 'runtime', environmentId: 'web-server-a' })

    const { result } = renderDelete(LOCAL_WORKTREE_ID)
    await requestDelete(result, localNode, owner)

    await vi.waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(fsDeletePath).not.toHaveBeenCalled()
  })

  it('fails closed when the same SSH worktree is projected by two HUBs', async () => {
    useAppStore.setState({
      repos: [],
      worktreesByRepo: {
        [LOCAL_REPO_ID]: [
          makeWorktree(`ssh:${SSH_ID}`, 'hub-a'),
          makeWorktree(`ssh:${SSH_ID}`, 'hub-b')
        ]
      }
    })
    expect(getFileExplorerOperationOwner(LOCAL_WORKTREE_ID)).toEqual({ kind: 'unresolved' })

    await expect(
      renameFileOnDisk({
        oldPath: '/tmp/project/src/old.ts',
        newName: 'new.ts',
        worktreeId: LOCAL_WORKTREE_ID,
        worktreePath: '/tmp/project'
      })
    ).rejects.toThrow("Couldn't determine which host owns this workspace")
    expect(fsRenamePath).not.toHaveBeenCalled()
  })

  it('keeps an explicit local worktree local when duplicate repo IDs include SSH', async () => {
    useAppStore.setState({
      settings: { activeRuntimeEnvironmentId: 'focused-env' } as never,
      repos: [
        makeRepo({ id: LOCAL_REPO_ID, path: '/tmp/project', executionHostId: 'local' }),
        makeRepo({ id: LOCAL_REPO_ID, path: '/home/user/project', connectionId: SSH_ID })
      ],
      worktreesByRepo: { [LOCAL_REPO_ID]: [makeWorktree('local')] }
    })
    const owner = getFileExplorerOperationOwner(LOCAL_WORKTREE_ID)
    expect(owner).toEqual({ kind: 'local' })

    const { result } = renderDelete(LOCAL_WORKTREE_ID)
    await requestDelete(result, localNode, owner)

    await vi.waitFor(() =>
      expect(fsDeletePath).toHaveBeenCalledWith({
        targetPath: localNode.path,
        connectionId: undefined,
        expectedExecutionHostId: 'local',
        recursive: false
      })
    )
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })
})
