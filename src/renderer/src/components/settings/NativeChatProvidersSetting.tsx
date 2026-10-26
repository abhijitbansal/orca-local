import { useChatProgramFacts } from '@/lib/host-chat-program-acquisition'
import { readHostStructuredAgents } from '@/runtime/host-structured-agents'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { isNativeChatProviderDisplayedOn } from '../../../../shared/native-chat/native-chat-providers'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { isTuiAgentEnabled } from '../../../../shared/tui-agent-selection'
import { translate } from '@/i18n/i18n'
import { AgentIcon, getAgentCatalog, getAgentLabel } from '@/lib/agent-catalog'
import { chatProviderAgents, useHostStructuredAgentsVersion } from '@/lib/chat-provider-agents'
import { useAppStore } from '../../store'
import { readNativeDetectedAgents } from '@/store/slices/local-detected-agent-store-state'
import { saveNativeChatProviderChoice } from './native-chat-provider-choice'
import { Card, CardContent } from '../ui/card'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSubsectionHeader, SettingsSwitch } from './SettingsFormControls'
import { getChatProvidersSearchEntry } from './chat-providers-search'

const BUILT_IN_CHAT_AGENTS: readonly TuiAgent[] = ['claude', 'codex']

function ProviderStatus({
  agent,
  installed,
  enabledInAgents
}: {
  agent: TuiAgent
  installed: readonly TuiAgent[] | null
  enabledInAgents: boolean
}): React.JSX.Element | null {
  if (!enabledInAgents) {
    return (
      <span>
        {translate('settings.chat.providers.agentDisabled', 'Turned off in Agent settings')}
      </span>
    )
  }
  if (installed === null) {
    return null
  }
  if (installed.includes(agent)) {
    return <span>{translate('settings.chat.providers.installed', 'Installed')}</span>
  }
  const homepageUrl = getAgentCatalog().find((entry) => entry.id === agent)?.homepageUrl
  return (
    <span>
      {translate('settings.chat.providers.notInstalled', 'Not installed')}
      {homepageUrl ? (
        <>
          {' · '}
          <a
            href={homepageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline-offset-2 hover:underline"
          >
            {translate('settings.chat.providers.install', 'Install')}
          </a>
        </>
      ) : null}
    </span>
  )
}

/** The agent's name and status line, plus any install button, which sits beside the switch.
 *  An agent whose chats run a program Orca downloads shows that program's install state as its
 *  status line, since its CLI's install state says nothing about whether its chats can start. */
function ProviderDetail(props: {
  agent: TuiAgent
  label: string
  installed: readonly TuiAgent[] | null
  enabledInAgents: boolean
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
}): React.JSX.Element {
  const on = isNativeChatProviderDisplayedOn(props.settings, props.agent, [
    ...(props.installed ?? [])
  ])
  const unsettled =
    !on &&
    props.settings.nativeChatProviders?.[props.agent] === undefined &&
    props.installed === null
  const control = unsettled ? (
    <div className="h-5 w-9 shrink-0 rounded-full bg-muted/50 animate-pulse" aria-hidden="true" />
  ) : (
    <SettingsSwitch
      checked={on}
      disabled={!props.enabledInAgents}
      ariaLabel={translate('settings.chat.providers.toggleLabel', 'Open {{value0}} as a chat', {
        value0: props.label
      })}
      onChange={() =>
        saveNativeChatProviderChoice({
          agent: props.agent,
          on: !on,
          fallbackSettings: props.settings,
          updateSettings: props.updateSettings
        })
      }
    />
  )
  const summary = (line: React.ReactNode): React.JSX.Element => (
    <div className="min-w-0 flex-1">
      <div className="text-sm font-medium leading-none">{props.label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{line}</div>
    </div>
  )
  return (
    <>
      {summary(
        <ProviderStatus
          agent={props.agent}
          installed={props.installed}
          enabledInAgents={props.enabledInAgents}
        />
      )}
      {control}
    </>
  )
}

export function NativeChatProvidersSetting({
  settings,
  updateSettings,
  forceVisible = false
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
  forceVisible?: boolean
}): React.JSX.Element | null {
  useChatProgramFacts({ kind: 'floating' })
  const entry = getChatProvidersSearchEntry()
  useHostStructuredAgentsVersion()
  const agents = chatProviderAgents(LOCAL_EXECUTION_HOST_ID, undefined)
  const detectedIds = useAppStore(readNativeDetectedAgents)
  const managed = readHostStructuredAgents(LOCAL_EXECUTION_HOST_ID, undefined)
  const visibleAgents = agents.filter(
    (agent) =>
      detectedIds !== null ||
      BUILT_IN_CHAT_AGENTS.includes(agent) ||
      settings.nativeChatProviders?.[agent] !== undefined ||
      managed?.some((row) => row.agent === agent && row.managedRuntime)
  )
  return (
    <SearchableSetting
      {...entry}
      id={entry.targetSectionId}
      forceVisible={forceVisible}
      className="max-w-none space-y-3"
    >
      <SettingsSubsectionHeader title={entry.title} description={entry.description} />
      <Card>
        <CardContent>
          <div className="divide-y divide-border/40">
            {visibleAgents.map((agent) => {
              const label = getAgentLabel(agent)
              const enabledInAgents = isTuiAgentEnabled(agent, settings.disabledTuiAgents)
              return (
                <div key={agent} className="space-y-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/50">
                      <AgentIcon agent={agent} size={16} />
                    </div>
                    <ProviderDetail
                      agent={agent}
                      label={label}
                      installed={detectedIds}
                      enabledInAgents={enabledInAgents}
                      settings={settings}
                      updateSettings={updateSettings}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </SearchableSetting>
  )
}
