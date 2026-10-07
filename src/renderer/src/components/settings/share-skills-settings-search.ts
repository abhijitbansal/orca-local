import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'

export const getShareSkillsSettingsSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.shareSkills.showButton', 'Show Skills Button'),
    description: translate(
      'auto.components.settings.shareSkills.showButtonDescription',
      'Show the Skills shortcut in the sidebar.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.shareSkills.keywordSkills', 'skills')
    ]
  }
])
