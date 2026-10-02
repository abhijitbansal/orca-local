import { translate } from '@/i18n/i18n'
import { isWebClientLocation } from '@/lib/web-client-location'
import { useAppStore } from '@/store'
import { SettingsSwitchRow } from './SettingsFormControls'

export function ShareSkillsSettingsPane(): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const isWebClient = isWebClientLocation()

  return (
    <div className="divide-y divide-border">
      {!isWebClient ? (
        <SettingsSwitchRow
          label={translate('auto.components.settings.shareSkills.showButton', 'Show Skills Button')}
          description={translate(
            'auto.components.settings.shareSkills.showButtonDescription',
            'Show the Skills shortcut in the sidebar.'
          )}
          checked={settings?.showSkillsButton === true}
          onChange={() => void updateSettings({ showSkillsButton: !settings?.showSkillsButton })}
        />
      ) : null}
    </div>
  )
}
