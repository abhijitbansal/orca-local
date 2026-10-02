// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../../store'
import { createEmptyRateLimitState } from '../../../../shared/rate-limit-state-factory'

const storeMocks = vi.hoisted(() => ({
  openSettingsPage: vi.fn(),
  openSettingsTarget: vi.fn(),
  recordFeatureInteraction: vi.fn()
}))

const mockStoreState = {
  rateLimits: createEmptyRateLimitState({
    grok: {
      provider: 'grok',
      session: null,
      weekly: {
        usedPercent: 42,
        windowMinutes: 10_080,
        resetsAt: null,
        resetDescription: 'Tue'
      },
      updatedAt: 1,
      error: null,
      status: 'ok'
    },
    grokAuthConfigured: true
  }),
  openSettingsPage: storeMocks.openSettingsPage,
  openSettingsTarget: storeMocks.openSettingsTarget,
  recordFeatureInteraction: storeMocks.recordFeatureInteraction
} satisfies Partial<AppState>

vi.mock('../../store', () => ({
  useAppStore: Object.assign(
    (selector: (state: Partial<AppState>) => unknown) => selector(mockStoreState),
    {
      getState: () => mockStoreState
    }
  )
}))

vi.mock('../ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    values
      ? Object.entries(values).reduce(
          (text, [token, value]) => text.replace(`{{${token}}}`, value),
          fallback
        )
      : fallback
}))

import { GrokUsagePane } from './GrokUsagePane'

describe('GrokUsagePane', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders the weekly usage without a manual refresh control', () => {
    render(<GrokUsagePane />)

    expect(screen.getByTestId('grok-usage-pane')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refresh Grok usage' })).not.toBeInTheDocument()
  })
})
