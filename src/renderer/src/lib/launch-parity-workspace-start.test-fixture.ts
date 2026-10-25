// Test-only: runs the row-8 producers (an agent started with a workspace) against the parity
// harness's real store. Only what precedes the launch is stubbed: setup policy, hooks trust, agent
// detection and the create itself.
import type { LaunchTestStore } from './launch-parity-renderer.test-fixture'
import type * as FolderComposerSubmit from '@/components/sidebar/folder-workspace-composer-submit'
import {
  resolveTuiAgentLaunchArgs,
  resolveTuiAgentLaunchEnv
} from '../../../shared/tui-agent-launch-defaults'
import {
  LAUNCH_FOLDER_ID,
  type WindowLaunchCase
} from '../../../shared/launch-parity-window-request.test-fixture'

type WorkspaceStartProducer = Extract<
  WindowLaunchCase['producer'],
  { kind: 'work-item' | 'folder-composer' }
>

export type WorkspaceStartModules = {
  folder: typeof FolderComposerSubmit
}

export const loadWorkspaceStartModules = async (): Promise<WorkspaceStartModules> => ({
  folder: await import('@/components/sidebar/folder-workspace-composer-submit')
})

export async function startWorkspaceAgent(
  modules: WorkspaceStartModules,
  store: LaunchTestStore,
  c: WindowLaunchCase & { producer: WorkspaceStartProducer }
): Promise<void> {
  const { producer } = c
  const state = store.getState()
  // Activating a workspace asks for a PR refresh, which this harness has no bridge for; a prompt
  // pasted after start waits on timers.
  Object.assign(window.api, { gh: {} })
  Object.assign(window, { setTimeout, clearTimeout })
  store.setState({
    ensureDetectedAgents: async () => [producer.agent],
    updateWorktreeMeta: async () => ({ ok: true })
  })
  if (producer.kind === 'work-item') {
    throw new Error(`${c.name}: work-item launches are removed in this build`)
  }
  const folderWorkspace = state.folderWorkspaces.find(
    (workspace) => `folder:${workspace.id}` === LAUNCH_FOLDER_ID
  )
  const settings = state.settings
  await modules.folder.submitFolderWorkspaceCreate({
    projectGroup: {
      id: 'pg-1',
      name: 'group',
      parentPath: c.workspace.path,
      parentGroupId: null,
      createdFrom: 'manual',
      tabOrder: 0,
      isCollapsed: false,
      color: null,
      createdAt: 0,
      updatedAt: 0
    },
    name: 'folder',
    lastAutoName: '',
    linkedWorkItem: null,
    note: producer.note,
    quickAgent: producer.agent,
    autoRenameBranchFromWork: false,
    // As the composer's folder submit passes them.
    agentCmdOverrides: settings?.agentCmdOverrides,
    agentArgs: resolveTuiAgentLaunchArgs(producer.agent, settings),
    agentEnv: resolveTuiAgentLaunchEnv(producer.agent, settings),
    terminalWindowsShell: settings?.terminalWindowsShell,
    launchSource: 'new_workspace_composer',
    createFolderWorkspace: async () => folderWorkspace ?? null,
    onOpenChange: () => {}
  })
}
