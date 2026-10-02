import { useEffect, useRef, useState } from 'react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  AiVaultSearchSettingsSchema,
  resolveAiVaultSearchSettings
} from '../../../../shared/ai-vault-search-settings'
import {
  getLocalExecutionHostLabel,
  LOCAL_EXECUTION_HOST_ID
} from '../../../../shared/execution-host'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { isWebClientLocation } from '@/lib/web-client-location'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { SettingsRow } from './SettingsFormControls'
import { SessionSearchAdvancedSection } from './SessionSearchAdvancedSection'
import { SessionHistoryComputerRow } from './SessionHistoryComputerRow'
import { SessionSearchComputerList } from './SessionSearchComputerList'
import type { SessionSearchComputerEntry } from './session-search-computer-rollup'
import {
  sessionSearchCheckingMessage,
  sessionSearchReadErrorMessage,
  sessionSearchStatusDetails,
  sessionSearchStatusMessage
} from './session-history-status-copy'
import { useSessionSearchStatus } from './use-session-search-status'

export function SessionHistorySettingsPane({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => Promise<void>
}): React.JSX.Element {
  const policy = resolveAiVaultSearchSettings(settings)
  const isWebClient = isWebClientLocation()
  const closeSettingsPage = useAppStore((state) => state.closeSettingsPage)
  const showAiVaultSearch = useAppStore((state) => state.showAiVaultSearch)
  const markFeatureTipsSeen = useAppStore((state) => state.markFeatureTipsSeen)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const localRead = useSessionSearchStatus({
    executionHostId: LOCAL_EXECUTION_HOST_ID,
    active: policy.enabled && !isWebClient,
    refresh
  })
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const localEntry: SessionSearchComputerEntry = {
    id: LOCAL_EXECUTION_HOST_ID,
    name: getLocalExecutionHostLabel(),
    state: policy.enabled ? 'on' : 'off'
  }
  function writePolicy(updates: Partial<typeof policy>): Promise<void> {
    if (updates.enabled !== undefined) {
      // Why: switching search proves the user found it; turning it off later must not re-offer the tip.
      markFeatureTipsSeen(['agent-session-search'])
    }
    return updateSettings({
      aiVaultSearch: AiVaultSearchSettingsSchema.parse({ ...policy, ...updates })
    })
  }

  async function save(updates: Partial<typeof policy>): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await writePolicy(updates)
    } catch {
      if (mounted.current) {
        setError(saveErrorMessage())
      }
    } finally {
      if (mounted.current) {
        setBusy(false)
      }
    }
  }

  function toggleEnabled(): Promise<void> {
    return save({ enabled: !policy.enabled })
  }

  /** False when the settings write failed or the pane went away, so the delete is skipped. */
  async function turnSearchOffBeforeDelete(): Promise<boolean> {
    try {
      await writePolicy({ enabled: false })
    } catch {
      if (mounted.current) {
        setError(saveErrorMessage())
      }
      return false
    }
    return mounted.current
  }

  // A stale answer from before the switch went off must not keep reporting progress.
  const localStatus = policy.enabled ? localRead.status : null
  let localStatusText: string | undefined
  if (policy.enabled) {
    localStatusText = localRead.failed
      ? sessionSearchReadErrorMessage()
      : localStatus
        ? sessionSearchStatusMessage(localStatus)
        : sessionSearchCheckingMessage()
  }

  return (
    <div>
      <div className="space-y-1 py-3">
        <Label className="select-text">
          {translate('sessionHistory.settings.indexComputers', 'Search inside sessions')}
        </Label>
        <p className="select-text text-xs text-muted-foreground">
          {isWebClient
            ? translate(
                'sessionHistory.settings.webUnsupported',
                'Turn on session search from the Orca desktop app on that computer.'
              )
            : translate(
                'sessionHistory.settings.computersConsent',
                'Each computer keeps a searchable copy of its own agent conversations and tool output. Nothing leaves that computer.'
              )}
        </p>
      </div>
      <SessionSearchComputerList
        local={
          <SessionHistoryComputerRow
            kind="local"
            name={localEntry.name}
            checked={policy.enabled}
            disabled={busy || isWebClient}
            onToggle={() => void toggleEnabled()}
            {...(isWebClient || localStatusText === undefined
              ? {}
              : { status: localStatusText, details: sessionSearchStatusDetails(localStatus) })}
          />
        }
        servers={[]}
      />
      {isWebClient ? null : (
        <SettingsRow
          className="border-t border-border"
          label={translate('sessionHistory.settings.openInSidebar', 'Open in the sidebar')}
          description={translate(
            'sessionHistory.settings.openInSidebarCopy',
            'Type what you remember, or ask an agent: “find the session where we fixed the login timeout.”'
          )}
          control={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                showAiVaultSearch()
                closeSettingsPage()
              }}
            >
              {translate('sessionHistory.settings.open', 'Open')}
            </Button>
          }
        />
      )}
      <SessionSearchAdvancedSection
        enabled={policy.enabled}
        disabled={isWebClient}
        turnSearchOff={turnSearchOffBeforeDelete}
        onError={setError}
        onCleared={() => setRefresh((value) => value + 1)}
      />
      {error ? (
        <p role="alert" className="pt-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function saveErrorMessage(): string {
  return translate('sessionHistory.settings.saveError', 'Could not save. Try again.')
}
