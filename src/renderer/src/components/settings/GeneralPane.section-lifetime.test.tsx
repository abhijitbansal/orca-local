// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { GeneralPane } from './GeneralPane'
const fake = vi.hoisted(() => ({ query: '' }))
vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string, values?: Record<string, string | number>) =>
    Object.entries(values ?? {}).reduce(
      (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
      fallback
    )
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ settingsSearchQuery: fake.query })
}))
vi.mock('@/components/settings/GeneralWorkspaceSettingsSection', () => ({
  GeneralWorkspaceSettingsSection: () => null
}))
vi.mock('@/components/settings/CliSection', () => ({ CliSection: () => null }))
vi.mock('@/components/settings/DefaultWindowsProjectRuntimeSetting', () => ({
  DefaultWindowsProjectRuntimeSetting: () => null
}))
beforeEach(() => {
  vi.clearAllMocks()
  fake.query = ''
})
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'api')
})
it('preserves an autosave draft until external settings change or the section hides', async () => {
  const settings = { ...getDefaultSettings('/synthetic'), editorAutoSaveDelayMs: 1000 }
  const props = { settings, updateSettings: vi.fn(), fontSuggestions: [] }
  const view = render(<GeneralPane {...props} />)
  await act(async () => {})
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2500' } })
  fake.query = 'Auto Save'
  await act(async () => view.rerender(<GeneralPane {...props} />))
  expect(screen.getByRole('spinbutton').getAttribute('value')).toBe('2500')
  expect(props.updateSettings).not.toHaveBeenCalled()
  const changedProps = { ...props, settings: { ...settings, editorAutoSaveDelayMs: 3000 } }
  await act(async () => view.rerender(<GeneralPane {...changedProps} />))
  expect(screen.getByRole('spinbutton').getAttribute('value')).toBe('3000')
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3500' } })
  fake.query = 'Tab Order'
  await act(async () => view.rerender(<GeneralPane {...changedProps} />))
  expect(screen.queryByRole('spinbutton')).toBeNull()
  fake.query = 'Auto Save'
  await act(async () => view.rerender(<GeneralPane {...changedProps} />))
  expect(screen.getByRole('spinbutton').getAttribute('value')).toBe('3000')
  expect(props.updateSettings).not.toHaveBeenCalled()
})
