import { useEffect, useRef, useState } from 'react'
import { Download, FolderOpen } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { NeedsSetupProjectHostOption } from '@/lib/project-host-setup-options'
import { parseExecutionHostId } from '../../../../shared/execution-host'
import type { RepoKind } from '../../../../shared/repo-types'
import { pickLocalProjectLocationFolder } from './pick-local-project-folder'
import { CloneForm, ExistingFolderForm, LocationActionButton } from './SetProjectLocationForms'

type DialogView = 'choose' | 'existing' | 'clone'

type SetProjectLocationDialogProps = {
  option: NeedsSetupProjectHostOption | null
  projectName: string
  projectKind: RepoKind
  defaultCloneUrl: string
  onClose: () => void
  onReady: (setupId: string) => void
}

export function SetProjectLocationDialog({
  option,
  projectName,
  projectKind,
  defaultCloneUrl,
  onClose,
  onReady
}: SetProjectLocationDialogProps): React.JSX.Element {
  const open = option !== null
  // Why: keep the last option rendered through the close animation, so the body
  // doesn't blank out as the dialog slides away.
  const [renderOption, setRenderOption] = useState(option)
  if (option !== null && option !== renderOption) {
    setRenderOption(option)
  }
  const activeOption = option ?? renderOption
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
    >
      <DialogContent data-testid="set-project-location-dialog" className="sm:max-w-lg">
        {activeOption ? (
          <SetProjectLocationDialogBody
            key={activeOption.id}
            option={activeOption}
            projectName={projectName}
            projectKind={projectKind}
            defaultCloneUrl={defaultCloneUrl}
            onReady={onReady}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SetProjectLocationDialogBody({
  option,
  projectName,
  projectKind,
  defaultCloneUrl,
  onReady
}: {
  option: NeedsSetupProjectHostOption
  projectName: string
  projectKind: RepoKind
  defaultCloneUrl: string
  onReady: (setupId: string) => void
}): React.JSX.Element {
  const setupProjectExistingFolder = useAppStore((state) => state.setupProjectExistingFolder)
  const setupProjectClone = useAppStore((state) => state.setupProjectClone)
  const [view, setView] = useState<DialogView>('choose')
  const [setupPath, setSetupPath] = useState('')
  const [setupKind, setSetupKind] = useState<RepoKind>(projectKind)
  const [cloneUrl, setCloneUrl] = useState(defaultCloneUrl)
  const [cloneDestination, setCloneDestination] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Why: an SSH clone is unbounded and the dialog stays dismissable while it
  // runs. Without this, a clone the user backed out of minutes ago still fires
  // onReady, silently moving the run target (and resetting start-from) under a
  // form they have since pointed at another host.
  const abandoned = useRef(false)
  useEffect(() => {
    // Re-armed on mount: StrictMode runs mount/cleanup/mount, and latching this
    // on the first cleanup would disable the success path for the whole session.
    abandoned.current = false
    return () => {
      abandoned.current = true
    }
  }, [])
  const parsedHost = parseExecutionHostId(option.hostId)
  // Why: the native picker returns a client path, so a remote host's path is typed instead.
  const remoteHost =
    parsedHost?.kind === 'ssh' || parsedHost?.kind === 'runtime' ? parsedHost : null
  const canClone = projectKind === 'git'

  const openHostBrowser = (setPath: (path: string) => void): void => {
    if (!remoteHost) {
      void pickLocalProjectLocationFolder(setPath)
    }
  }

  const handleExistingSubmit = async (): Promise<void> => {
    if (!setupPath.trim()) {
      return
    }
    setIsSubmitting(true)
    try {
      const result = await setupProjectExistingFolder({
        projectId: option.projectId,
        hostId: option.hostId,
        path: setupPath.trim(),
        kind: setupKind,
        displayName: projectName
      })
      if (result && !abandoned.current) {
        onReady(result.setup.id)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloneSubmit = async (): Promise<void> => {
    if (!cloneUrl.trim() || !cloneDestination.trim()) {
      return
    }
    setIsSubmitting(true)
    try {
      const result = await setupProjectClone({
        projectId: option.projectId,
        hostId: option.hostId,
        url: cloneUrl.trim(),
        destination: cloneDestination.trim(),
        displayName: projectName
      })
      if (result && !abandoned.current) {
        onReady(result.setup.id)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {translate(
            'auto.components.new.workspace.SetProjectLocationDialog.title',
            'Set project location'
          )}
        </DialogTitle>
        <DialogDescription>
          {translate(
            'auto.components.new.workspace.SetProjectLocationDialog.description',
            'Choose where {{project}} lives on {{host}}.',
            { project: projectName, host: option.label }
          )}
        </DialogDescription>
      </DialogHeader>
      {view === 'choose' ? (
        <div className="space-y-2">
          <LocationActionButton
            icon={FolderOpen}
            title={translate(
              'auto.components.new.workspace.SetProjectLocationDialog.browseFolder',
              'Browse folder'
            )}
            description={translate(
              'auto.components.new.workspace.SetProjectLocationDialog.browseFolderHelp',
              'Use an existing checkout or folder on this host.'
            )}
            onClick={() => {
              setView('existing')
              // Local hosts get the native picker straight away — one click instead of two.
              if (!remoteHost && !setupPath) {
                void pickLocalProjectLocationFolder(setSetupPath)
              }
            }}
          />
          {canClone ? (
            <LocationActionButton
              icon={Download}
              title={translate(
                'auto.components.new.workspace.SetProjectLocationDialog.cloneFromUrl',
                'Clone from URL'
              )}
              description={translate(
                'auto.components.new.workspace.SetProjectLocationDialog.cloneFromUrlHelp',
                'Clone this repository onto {{host}}.',
                { host: option.label }
              )}
              onClick={() => setView('clone')}
            />
          ) : null}
        </div>
      ) : null}
      {view === 'existing' ? (
        <ExistingFolderForm
          setupPath={setupPath}
          setupKind={setupKind}
          isSubmitting={isSubmitting}
          onBack={() => setView('choose')}
          onPathChange={setSetupPath}
          onKindChange={setSetupKind}
          onBrowse={() => openHostBrowser(setSetupPath)}
          onSubmit={() => void handleExistingSubmit()}
        />
      ) : null}
      {view === 'clone' ? (
        <CloneForm
          cloneUrl={cloneUrl}
          cloneDestination={cloneDestination}
          isSubmitting={isSubmitting}
          onBack={() => setView('choose')}
          onCloneUrlChange={setCloneUrl}
          onCloneDestinationChange={setCloneDestination}
          onBrowse={() => openHostBrowser(setCloneDestination)}
          onSubmit={() => void handleCloneSubmit()}
        />
      ) : null}
    </>
  )
}
