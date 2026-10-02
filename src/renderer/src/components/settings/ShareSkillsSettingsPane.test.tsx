// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/tooltip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  state: {
    isWebClient: false,
    settings: { showSkillsButton: false }
  }
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('@/lib/web-client-location', () => ({
  isWebClientLocation: () => mocks.state.isWebClient
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      ...mocks.state,
      updateSettings: mocks.updateSettings
    })
}))

import { ShareSkillsSettingsPane } from './ShareSkillsSettingsPane'

describe('ShareSkillsSettingsPane', () => {
  beforeEach(() => {
    mocks.updateSettings.mockReset()
    mocks.state.isWebClient = false
  })

  afterEach(() => {
    cleanup()
  })

  it('toggles the sidebar Skills button', async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <ShareSkillsSettingsPane />
      </TooltipProvider>
    )

    await user.click(screen.getByRole('switch', { name: 'Show Skills Button' }))
    expect(mocks.updateSettings).toHaveBeenCalledWith({ showSkillsButton: true })
  })

  it('hides the Skills button switch on the web client', () => {
    mocks.state.isWebClient = true
    render(
      <TooltipProvider>
        <ShareSkillsSettingsPane />
      </TooltipProvider>
    )

    expect(screen.queryByRole('switch', { name: 'Show Skills Button' })).not.toBeInTheDocument()
  })
})
