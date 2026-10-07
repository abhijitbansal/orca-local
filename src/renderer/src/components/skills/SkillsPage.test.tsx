// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { DiscoveredSkill, SkillDiscoveryResult } from '../../../../shared/skills'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ConfirmationDialogProvider } from '@/components/confirmation-dialog'
import { useAppStore } from '@/store'
import SkillsPage from './SkillsPage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null

function skill(name: string, overrides: Partial<DiscoveredSkill> = {}): DiscoveredSkill {
  return {
    id: `skill-${name}`,
    name,
    description: null,
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Agent skills home',
    rootPath: `/home/dev/.agents/skills`,
    directoryPath: `/home/dev/.agents/skills/${name}`,
    skillFilePath: `/home/dev/.agents/skills/${name}/SKILL.md`,
    installed: true,
    updatedAt: null,
    ...overrides
  }
}

function discoveryResult(names: string[]): SkillDiscoveryResult {
  return { skills: names.map((name) => skill(name)), sources: [], scannedAt: 1 }
}

function skillsApi(discover: ReturnType<typeof vi.fn>) {
  return {
    discover,
    deleteSupported: () => Promise.resolve(true)
  }
}

function setRuntimeOwner(environmentId: string | null): void {
  useAppStore.setState({
    settings: { activeRuntimeEnvironmentId: environmentId } as GlobalSettings,
    runtimeEnvironments: (environmentId ? [{ id: environmentId }] : []) as never,
    runtimeEnvironmentCatalogSettled: true
  })
}

async function renderPage(): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <TooltipProvider>
        <ConfirmationDialogProvider>
          <SkillsPage />
        </ConfirmationDialogProvider>
      </TooltipProvider>
    )
  })
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    for (let tick = 0; tick < 8; tick += 1) {
      await Promise.resolve()
    }
  })
}

/** Skill names currently rendered as rows. */
function renderedSkillNames(): string[] {
  return [...(container?.querySelectorAll('[data-skill-name]') ?? [])].map(
    (node) => node.textContent ?? ''
  )
}

function buttonNamed(name: string): HTMLButtonElement {
  const button = [...(container?.querySelectorAll('button') ?? [])].find(
    (candidate) =>
      candidate.textContent?.trim() === name || candidate.getAttribute('aria-label') === name
  )
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${name}`)
  }
  return button
}

function buttonStartingWith(prefix: string): HTMLButtonElement {
  const button = [...(container?.querySelectorAll('button') ?? [])].find((candidate) =>
    candidate.textContent?.trim().startsWith(prefix)
  )
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Missing button starting with: ${prefix}`)
  }
  return button
}

function skillRow(name: string): HTMLElement {
  const row = [...(container?.querySelectorAll('[role="option"]') ?? [])].find(
    (candidate) => candidate.querySelector('[data-skill-name]')?.textContent === name
  )
  if (!(row instanceof HTMLElement)) {
    throw new Error(`Missing skill row: ${name}`)
  }
  return row
}

beforeEach(() => {
  setRuntimeOwner(null)
})

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount()
    })
  }
  root = null
  container?.remove()
  container = null
  useAppStore.setState({
    settings: null,
    runtimeEnvironments: [],
    runtimeEnvironmentCatalogSettled: false
  })
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'api')
})

describe('SkillsPage', () => {
  it('uses platform-neutral Escape navigation without stealing editable input Escape', async () => {
    const closeSkillsPage = vi.fn()
    const discover = vi.fn().mockResolvedValue(discoveryResult(['alpha']))
    useAppStore.setState({ closeSkillsPage })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { skills: skillsApi(discover), runtimeEnvironments: { call: vi.fn() } }
    })
    await renderPage()
    await flushMicrotasks()

    const search = container?.querySelector('input[placeholder="Search skills"]')
    if (!(search instanceof HTMLInputElement)) {
      throw new Error('Missing skill search')
    }
    await act(async () => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(closeSkillsPage).not.toHaveBeenCalled()

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(closeSkillsPage).toHaveBeenCalledOnce()
  })

  it('contains long cross-platform skill paths while preserving the full path', async () => {
    const longPath = `C:\\Users\\orca\\${'nested-folder\\'.repeat(30)}SKILL.md`
    const discover = vi.fn().mockResolvedValue({
      skills: [skill('long-path', { skillFilePath: longPath })],
      sources: [],
      scannedAt: 1
    } satisfies SkillDiscoveryResult)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { skills: skillsApi(discover), runtimeEnvironments: { call: vi.fn() } }
    })

    await renderPage()
    await flushMicrotasks()
    // Why: the path lives in the detail dialog, where it must wrap inside the
    // column instead of pushing the dialog into horizontal scroll.
    await act(async () => fireEvent.click(skillRow('long-path')))

    const dialog = document.querySelector('[role="dialog"]')
    const path = [...(dialog?.querySelectorAll('*') ?? [])].find(
      (element) => element.textContent === longPath && element.children.length === 0
    )
    expect(path?.classList.contains('break-all')).toBe(true)
    expect(path?.textContent).toBe(longPath)
  })

  // Why: a cold local scan walks every skill root, so it can land after a newer
  // remote scan. Without a generation guard it overwrites the remote list and
  // the page silently shows the client's skills again — #6789 all over.
  it('keeps scanning rather than listing client skills before the owner is known', async () => {
    const discover = vi.fn().mockResolvedValue(discoveryResult(['local-only']))
    const call = vi.fn()
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { skills: skillsApi(discover), runtimeEnvironments: { call } }
    })
    useAppStore.setState({ runtimeEnvironmentCatalogSettled: false })

    await renderPage()
    await flushMicrotasks()

    expect(discover).not.toHaveBeenCalled()
    expect(call).not.toHaveBeenCalled()
    expect(container?.textContent).toContain('Scanning skills')
  })

  it('filters by source from the count chips', async () => {
    const discover = vi.fn().mockResolvedValue({
      skills: [skill('home-skill'), skill('plugin-skill', { sourceKind: 'plugin' })],
      sources: [],
      scannedAt: 1
    } satisfies SkillDiscoveryResult)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { skills: skillsApi(discover), runtimeEnvironments: { call: vi.fn() } }
    })

    await renderPage()
    await flushMicrotasks()
    await act(async () => fireEvent.click(buttonStartingWith('Plugin')))

    expect(renderedSkillNames()).toEqual(['plugin-skill'])
    expect(container?.textContent).toContain('1 result')
  })

  // Why: the reason is per-row state, but on a remote runtime it applies to every
  // row at once — 114 copies of the same sentence is not an explanation.
  it('distinguishes a failed scan from empty skill folders', async () => {
    const discover = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Error invoking remote method 'skills:discover': Error: EACCES: permission denied\nSSH host unavailable"
        )
      )
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { skills: skillsApi(discover), runtimeEnvironments: { call: vi.fn() } }
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await renderPage()
    await flushMicrotasks()

    expect(container?.textContent).toContain('Could not scan skills')
    expect(container?.textContent).toContain('EACCES: permission denied')
    expect(container?.textContent).toContain('SSH host unavailable')
    expect(container?.textContent).not.toContain('Error invoking remote method')
    // Why: nothing was scanned, so "the scanned skill folders are empty" would be a claim we cannot make.
    expect(container?.textContent).not.toContain('No skills found')
  })

  it('retries the failed scan from the error band and clears it on success', async () => {
    const discover = vi
      .fn()
      .mockRejectedValueOnce(new Error('EACCES: permission denied'))
      .mockResolvedValueOnce(discoveryResult(['alpha']))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { skills: skillsApi(discover), runtimeEnvironments: { call: vi.fn() } }
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await renderPage()
    await flushMicrotasks()
    await act(async () => fireEvent.click(buttonNamed('Retry')))
    await flushMicrotasks()

    expect(container?.textContent).not.toContain('Could not scan skills')
    expect(renderedSkillNames()).toEqual(['alpha'])
  })

  it('keeps a previously confirmed empty result visible when a refresh fails', async () => {
    const discover = vi
      .fn()
      .mockResolvedValueOnce(discoveryResult([]))
      .mockRejectedValueOnce(new Error('host unavailable'))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { skills: skillsApi(discover), runtimeEnvironments: { call: vi.fn() } }
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await renderPage()
    await flushMicrotasks()
    expect(container?.textContent).toContain('No skills found')

    await act(async () => fireEvent.click(buttonNamed('Refresh')))
    await flushMicrotasks()

    expect(container?.textContent).toContain('Could not scan skills')
    expect(container?.textContent).toContain('No skills found')
  })
})
