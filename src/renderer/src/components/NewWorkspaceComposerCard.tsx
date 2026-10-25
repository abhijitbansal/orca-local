import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { getScreenSubmitModifierLabel } from '@/lib/screen-submit-shortcut'
import { useContextualTour } from '@/components/contextual-tours/use-contextual-tour'
import {
  DEFAULT_DISABLED_TUI_AGENTS,
  filterEnabledTuiAgents
} from '../../../shared/tui-agent-selection'
import type { TuiAgent } from '../../../shared/tui-agent'
import { NewWorkspaceComposerAdvancedSection } from './new-workspace/NewWorkspaceComposerAdvancedSection'
import { NewWorkspaceComposerAgentSection } from './new-workspace/NewWorkspaceComposerAgentSection'
import { NewWorkspaceComposerFooter } from './new-workspace/NewWorkspaceComposerFooter'
import { NewWorkspaceComposerNameSection } from './new-workspace/NewWorkspaceComposerNameSection'
import { NewWorkspaceComposerProjectSection } from './new-workspace/NewWorkspaceComposerProjectSection'
import {
  EMPTY_PROJECT_OPTIONS,
  type NewWorkspaceComposerCardProps
} from './new-workspace/new-workspace-composer-card-props'
import { useNewWorkspaceComposerFileDrop } from './new-workspace/use-new-workspace-composer-file-drop'
import { useComposerFileDragOver } from './new-workspace/use-composer-file-drag-over'
import { buildDefaultAgentSettingsUpdate } from '../../../shared/default-agent-settings'

export default function NewWorkspaceComposerCard(
  props: NewWorkspaceComposerCardProps
): React.JSX.Element {
  useTranslation()
  const {
    contextualTourSource,
    containerClassName,
    contentClassName,
    composerRef,
    onComposerNodeChange,
    nameInputRef,
    setupConfig,
    setupControlsEnabled = true,
    selectedProjectId = null,
    parentWorktreeId,
    onParentWorktreeIdChange,
    selectedRepoExecutionHostId,
    selectedRepoProjectId,
    activeFolderWorkspaceId,
    onAddProjectOverride
  } = props
  const projectOptions = props.projectOptions ?? EMPTY_PROJECT_OPTIONS
  const { isFileDragOver, dragHandlers } = useComposerFileDragOver()
  const attachDropOwner = useNewWorkspaceComposerFileDrop({
    projectPath: props.selectedRepoPath,
    hostId: selectedRepoExecutionHostId,
    connectionId: props.selectedRepoConnectionId,
    applyDrop: props.onNativeFileDrop
  })
  const openModal = useAppStore((state) => state.openModal)
  const activeModal = useAppStore((state) => state.activeModal)
  const defaultTuiAgent = useAppStore((state) => state.settings?.defaultTuiAgent ?? null)
  const disabledTuiAgents = useAppStore(
    (state) => state.settings?.disabledTuiAgents ?? DEFAULT_DISABLED_TUI_AGENTS
  )
  const updateSettings = useAppStore((state) => state.updateSettings)
  const nameInputFocusFrameRef = React.useRef<number | null>(null)
  const branchNameInputId = React.useId()
  const projectDescriptionId = React.useId()
  const [sparseEditing, setSparseEditing] = React.useState(false)

  const setupConfigLabel =
    setupConfig?.kind === 'default-tabs'
      ? 'Default tab commands'
      : setupConfig?.kind === 'setup-and-default-tabs'
        ? 'Setup and default tab commands'
        : 'Setup script'
  const setupRunLabel =
    setupConfig?.kind === 'default-tabs'
      ? 'Run default tab commands'
      : setupConfig?.kind === 'setup-and-default-tabs'
        ? 'Run setup and default tab commands'
        : 'Run setup command'
  const setupAskLabel =
    setupConfig?.kind === 'default-tabs'
      ? 'Run default tab commands now?'
      : setupConfig?.kind === 'setup-and-default-tabs'
        ? 'Run setup and default tab commands now?'
        : 'Run setup now?'
  const setupRunButtonLabel = setupConfig?.kind === 'setup' ? 'Run setup now' : 'Run commands now'
  const setupSkipButtonLabel = setupConfig?.kind === 'setup' ? 'Skip for now' : 'Skip commands'
  const showSetupAgentStartupPolicy =
    setupControlsEnabled && setupConfig !== null && setupConfig.kind !== 'default-tabs'
  const agentCatalog = getAgentCatalog()
  const enabledAgentIds = new Set(
    filterEnabledTuiAgents(
      agentCatalog.map((candidate) => candidate.id),
      disabledTuiAgents
    )
  )
  const visibleQuickAgents = agentCatalog.filter((agent) => {
    return (
      enabledAgentIds.has(agent.id) &&
      (props.detectedAgentIds === null || props.detectedAgentIds.has(agent.id))
    )
  })

  const cancelNameInputFocusFrame = React.useCallback((): void => {
    if (nameInputFocusFrameRef.current !== null) {
      cancelAnimationFrame(nameInputFocusFrameRef.current)
      nameInputFocusFrameRef.current = null
    }
  }, [])
  const setComposerNode = React.useCallback(
    (node: HTMLDivElement | null): void => {
      if (!node) {
        cancelNameInputFocusFrame()
      }
      attachDropOwner(node)
      if (composerRef) {
        composerRef.current = node
      }
      onComposerNodeChange?.(node)
    },
    [attachDropOwner, cancelNameInputFocusFrame, composerRef, onComposerNodeChange]
  )
  const focusNameInput = React.useCallback((): void => {
    cancelNameInputFocusFrame()
    nameInputFocusFrameRef.current = requestAnimationFrame(() => {
      nameInputFocusFrameRef.current = null
      nameInputRef?.current?.focus()
    })
  }, [cancelNameInputFocusFrame, nameInputRef])
  const handleAddProject = React.useCallback((): void => {
    if (onAddProjectOverride) {
      onAddProjectOverride()
      return
    }
    openModal('add-repo')
  }, [onAddProjectOverride, openModal])
  const handleSetDefaultAgent = React.useCallback(
    (next: TuiAgent | 'blank' | null): void => {
      void updateSettings(buildDefaultAgentSettingsUpdate(next))
    },
    [updateSettings]
  )
  const handleNamePlainEnter = React.useCallback((): void => {
    const agentTrigger = composerRef?.current?.querySelector<HTMLElement>(
      '[data-agent-combobox-root="true"][role="combobox"]'
    )
    agentTrigger?.focus()
  }, [composerRef])

  useContextualTour(
    'workspace-creation',
    projectOptions.length > 0 && Boolean(selectedProjectId),
    contextualTourSource ??
      (activeModal === 'new-workspace-composer'
        ? 'workspace_creation_modal'
        : 'workspace_creation_visible')
  )

  return (
    <div
      ref={setComposerNode}
      data-workspace-composer-root="true"
      data-sparse-preset-editing={sparseEditing ? 'true' : undefined}
      onDragEnter={dragHandlers.onDragEnter}
      onDragLeave={dragHandlers.onDragLeave}
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col gap-1 rounded-md transition',
        isFileDragOver &&
          props.selectedRepoPath &&
          selectedRepoExecutionHostId &&
          props.onNativeFileDrop &&
          'ring-2 ring-ring/30',
        containerClassName
      )}
    >
      <div className={cn('min-h-0 min-w-0 space-y-4 pt-3', contentClassName)}>
        <NewWorkspaceComposerProjectSection
          {...props}
          disabled={sparseEditing}
          projectOptions={projectOptions}
          projectDescriptionId={projectDescriptionId}
          onAddProject={handleAddProject}
          focusNameInput={focusNameInput}
        />
        <NewWorkspaceComposerNameSection {...props} onNamePlainEnter={handleNamePlainEnter} />
        <NewWorkspaceComposerAgentSection
          {...props}
          createDisabled={props.createDisabled || sparseEditing}
          advancedLocked={sparseEditing}
          visibleQuickAgents={visibleQuickAgents}
          defaultTuiAgent={defaultTuiAgent}
          handleSetDefaultAgent={handleSetDefaultAgent}
        />
        <NewWorkspaceComposerAdvancedSection
          {...props}
          onSparseEditingChange={setSparseEditing}
          sparseEditing={sparseEditing}
          branchNameInputId={branchNameInputId}
          setupConfigLabel={setupConfigLabel}
          setupRunLabel={setupRunLabel}
          setupAskLabel={setupAskLabel}
          setupRunButtonLabel={setupRunButtonLabel}
          setupSkipButtonLabel={setupSkipButtonLabel}
          showSetupAgentStartupPolicy={showSetupAgentStartupPolicy}
          parentWorktreeId={parentWorktreeId}
          onParentWorktreeIdChange={onParentWorktreeIdChange}
          selectedRepoExecutionHostId={selectedRepoExecutionHostId}
          selectedRepoProjectId={selectedRepoProjectId}
          activeFolderWorkspaceId={activeFolderWorkspaceId}
        />
      </div>
      {!sparseEditing ? (
        <div className="shrink-0 space-y-1">
          <NewWorkspaceComposerFooter
            {...props}
            submitShortcutModifierLabel={getScreenSubmitModifierLabel()}
          />
        </div>
      ) : null}
    </div>
  )
}
