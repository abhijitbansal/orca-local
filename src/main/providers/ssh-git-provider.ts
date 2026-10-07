import type { CommitMessagePlan } from '../../shared/commit-message-plan'
import type {
  LocalBaseBranchFastForwardOutcome,
  LocalBaseBranchRefs
} from '../../shared/worktree/local-base-branch-fast-forward'
import type { RemoteCommitMessageExecResult } from '../text-generation/commit-message-text-generation'
import type { RemoteHostPlatform } from '../ssh/ssh-remote-platform'
import type { IGitProvider } from './types'

// Why a type only: no SSH git provider can be constructed in this build, but the `getSshGitProvider`
// stub and its `if (connectionId)` callers still name this surface.
export type SshGitProvider = IGitProvider &
  Required<Pick<IGitProvider, 'renameCurrentBranch' | 'forceDeletePreservedBranch'>> & {
    getHostPlatform(): RemoteHostPlatform | null
    clone(
      args: string[],
      cwd: string,
      options?: {
        signal?: AbortSignal
        timeoutMs?: number
        onProgress?: (progress: { phase: string; percent: number }) => void
      }
    ): Promise<{ stdout: string; stderr: string }>
    executeCommitMessagePlan(
      plan: CommitMessagePlan,
      cwd: string,
      timeoutMs: number,
      operation?: string
    ): Promise<RemoteCommitMessageExecResult>
    execNonInteractive(
      binary: string,
      args: string[],
      cwd: string,
      timeoutMs: number,
      signal?: AbortSignal,
      env?: Record<string, string>
    ): Promise<RemoteCommitMessageExecResult>
    cancelGenerateCommitMessage(worktreePath: string, operation?: string): Promise<void>
    fetchRemoteTrackingRef(
      worktreePath: string,
      remote: string,
      branch: string,
      ref: string,
      options?: { skipAutoMaintenance?: boolean }
    ): Promise<void>
    markRemoteOrcaCreated(repoPath: string, remoteName: string): Promise<void>
    refreshLocalBaseRefForWorktreeCreate(
      args: LocalBaseBranchRefs
    ): Promise<LocalBaseBranchFastForwardOutcome>
    getLocalBaseRefFastForwardableBehind(args: LocalBaseBranchRefs): Promise<number | undefined>
  }
