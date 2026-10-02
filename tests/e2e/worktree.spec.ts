import { openSidebarWorkspaceComposer } from './helpers/sidebar-project-dialog'
/**
 * E2E tests for the "Create Workspace" flow in Orca.
 *
 * Why: the old 'create-worktree' modal was replaced by the composer modal
 * (`activeModal === 'new-workspace-composer'`) in #710. A prior version of
 * this spec bypassed the UI entirely — it called `state.createWorktree(...)`
 * directly on the store — which is why the #1186 regression (a React #31
 * crash when `StartFromField` rendered the new `getBaseRefDefault` envelope
 * as JSX) shipped despite a green suite.
 *
 * The spec now drives the real user flow: open the composer, type a
 * workspace name, click Create, and assert the worktree actually
 * materialized and became active. See `tests/e2e/AGENTS.md` for the rule
 * that E2E assertions must target the DOM, not the store.
 *
 * Note: the original StartFromField regression guard was removed with #1191
 * (Tabbed Create Workspace), which deleted StartFromField/StartFromPicker
 * entirely. The render-error sweep below still catches any React #31-class
 * crash in whatever replaces it.
 */

import type { ConsoleMessage } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import {
  waitForSessionReady,
  waitForActiveWorktree,
  getActiveWorktreeId,
  ensureTerminalVisible,
  worktreeExists
} from './helpers/store'

test.describe('Create Workspace', () => {
  test.beforeEach(async ({ orcaPage }) => {
    await waitForSessionReady(orcaPage)
    await waitForActiveWorktree(orcaPage)
  })

  test('creates a worktree through the composer UI and activates it', async ({ orcaPage }) => {
    const worktreeIdBefore = await getActiveWorktreeId(orcaPage)

    // Capture render errors for the #1186 guard. React logs "Objects are not
    // valid as a React child" via console.error before throwing the
    // minified-production error #31; capture both paths so the test fails
    // loudly whether the build is dev or prod.
    const pageErrors: Error[] = []
    orcaPage.on('pageerror', (err) => {
      pageErrors.push(err)
    })
    const consoleErrors: string[] = []
    const onConsole = (msg: ConsoleMessage): void => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    }
    orcaPage.on('console', onConsole)

    const workspaceName = `e2e-create-${Date.now()}`

    try {
      // 1. Open the composer through the visible affordance so the lazy modal
      // mount path stays covered along with the composer body.
      await openSidebarWorkspaceComposer(orcaPage)

      const dialog = orcaPage.getByRole('dialog', { name: /Create (Workspace|Worktree)/i })
      await expect(dialog).toBeVisible()

      // Wait for the composer to settle. The card fires several async effects
      // on mount (detected-agent probe, name-field autofocus + hydration,
      // setup-hooks fetch). Clicking before those settle can race Radix's
      // FocusScope reparenting.
      await expect(dialog.locator('[data-workspace-name-input="true"]')).toBeVisible()

      // Force the `getBaseRefDefault` IPC to round-trip so any consumer that
      // renders the envelope (e.g. SourceControl) has a chance to crash
      // inside the open modal's React tree — the console/pageerror sweep
      // below is what catches #1186-class regressions now that the
      // StartFromField trigger no longer exists (#1191).
      await orcaPage.evaluate(async () => {
        const repoId = Object.values(window.__store!.getState().worktreesByRepo).flat()[0]?.repoId
        if (!repoId) {
          return
        }
        await window.api.repos.getBaseRefDefault({ repoId })
      })
      await orcaPage.waitForTimeout(100)

      // 3. Type the workspace name into the unified smart-name input.
      // The composer's default mode is 'smart'; its placeholder advertises
      // multiple input shapes ("Type a name, #1234, branch, GitHub or
      // Linear URL"). Plain free-form text is treated as a workspace name
      // by submitQuick, which is what we want here.
      const nameInput = dialog.getByPlaceholder(/Type a name/i)
      await expect(nameInput).toBeVisible()
      await nameInput.fill(workspaceName)

      // 4. Click Create. This fires the full submitQuick path:
      // createWorktree IPC, applyWorktreeMeta, activateAndRevealWorktree,
      // and closeModal via onCreated.
      const createButton = dialog.getByRole('button', { name: /Create (Workspace|Worktree)/i })
      await expect(createButton).toBeEnabled()
      await createButton.click()

      // 5. The modal closes once submitQuick completes successfully. If
      // something inside the flow threw (IPC failure, hook error), the modal
      // would stay open with a createError banner — catch that as a fail.
      await expect(dialog).toBeHidden({ timeout: 15_000 })

      // 6. The new worktree must actually exist on disk and in the store.
      await expect
        .poll(async () => worktreeExists(orcaPage, workspaceName), {
          timeout: 10_000,
          message: `Worktree "${workspaceName}" did not appear in the store`
        })
        .toBe(true)

      // 7. The new worktree must become active (different from whatever was
      // active before we opened the composer).
      await expect
        .poll(
          async () => {
            const id = await getActiveWorktreeId(orcaPage)
            return id !== null && id !== worktreeIdBefore
          },
          { timeout: 10_000, message: 'New worktree did not become the active worktree' }
        )
        .toBe(true)

      // 8. A terminal tab must auto-create for the new worktree. This is
      // the downstream signal that `activateAndRevealWorktree` actually
      // fired, not just that the store row exists.
      await ensureTerminalVisible(orcaPage)

      // Final render-error sweep. Any render crash during the flow (whether
      // it tore down the modal or bubbled past it) shows up here.
      expect(pageErrors, `pageerror fired: ${pageErrors.map((e) => e.message).join(', ')}`).toEqual(
        []
      )
      const reactChildErrors = consoleErrors.filter((text) =>
        /Objects are not valid as a React child|Minified React error #31/i.test(text)
      )
      expect(reactChildErrors, `React render error: ${reactChildErrors.join(', ')}`).toEqual([])
    } finally {
      orcaPage.off('console', onConsole)
      // Best-effort close if the test failed mid-flow and left the modal open.
      await orcaPage
        .evaluate(() => {
          window.__store?.getState().closeModal()
        })
        .catch(() => {
          /* page may already be torn down */
        })
    }
  })

  test('creates an emoji-named worktree with a safe git branch', async ({ orcaPage }) => {
    const workspaceName = '🚀🧪✨'

    try {
      await openSidebarWorkspaceComposer(orcaPage)

      const dialog = orcaPage.getByRole('dialog', { name: /Create (Workspace|Worktree)/i })
      await expect(dialog).toBeVisible()
      await expect(dialog.locator('[data-workspace-name-input="true"]')).toBeVisible()

      const nameInput = dialog.getByPlaceholder(/Type a name/i)
      await nameInput.fill(workspaceName)

      const createButton = dialog.getByRole('button', { name: /Create (Workspace|Worktree)/i })
      await expect(createButton).toBeEnabled()
      await createButton.click()

      await expect(dialog).toBeHidden({ timeout: 15_000 })
      await expect(orcaPage.getByRole('option', { name: new RegExp(workspaceName) })).toBeVisible({
        timeout: 10_000
      })

      const branch = await orcaPage.evaluate((displayName) => {
        const worktrees = Object.values(window.__store!.getState().worktreesByRepo).flat()
        return worktrees.find((worktree) => worktree.displayName === displayName)?.branch ?? null
      }, workspaceName)
      expect(branch).toBe('refs/heads/rocket-test-tube-sparkles')
    } finally {
      await orcaPage
        .evaluate(() => {
          window.__store?.getState().closeModal()
        })
        .catch(() => {
          /* page may already be torn down */
        })
    }
  })

  test('enters the Korean flag with the flag_kr shortcode suggestion', async ({ orcaPage }) => {
    try {
      await openSidebarWorkspaceComposer(orcaPage)

      const dialog = orcaPage.getByRole('dialog', { name: /Create (Workspace|Worktree)/i })
      const nameInput = dialog.getByPlaceholder(/Type a name/i)
      await expect(nameInput).toBeVisible()

      await nameInput.pressSequentially('Launch :flag_kr', { delay: 100 })
      const emojiSuggestions = orcaPage.locator('[data-workspace-emoji-suggestions="true"]')
      const sourceSuggestions = orcaPage.locator('[data-workspace-source-suggestions="true"]')
      await expect(emojiSuggestions).toBeVisible()
      await expect(emojiSuggestions.getByRole('option', { name: ':flag_kr:' })).toBeVisible()
      await expect(emojiSuggestions).toHaveAttribute('data-side', 'top')
      await expect(sourceSuggestions).toBeVisible()
      await expect(sourceSuggestions).toHaveAttribute('data-side', 'bottom')
      // Keep both independently positioned suggestion surfaces visible in proof recordings.
      await orcaPage.waitForTimeout(750)

      await nameInput.pressSequentially(':')
      await expect(nameInput).toHaveValue('Launch 🇰🇷')
      await expect(orcaPage.getByRole('option', { name: /:flag_kr:/i })).toHaveCount(0)
      await nameInput.pressSequentially(' experiment')
      await expect(nameInput).toHaveValue('Launch 🇰🇷 experiment')
      // Keep the asserted result visible in retained proof recordings.
      await orcaPage.waitForTimeout(750)
    } finally {
      await orcaPage
        .evaluate(() => {
          window.__store?.getState().closeModal()
        })
        .catch(() => {
          /* page may already be torn down */
        })
    }
  })

  test('shows a failed workspace entry when worktree creation fails', async ({ orcaPage }) => {
    await orcaPage.evaluate(() => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      const originalCreateWorktree = store.getState().createWorktree
      ;(
        window as unknown as {
          __restoreCreateWorktree?: () => void
        }
      ).__restoreCreateWorktree = () => {
        store.setState({ createWorktree: originalCreateWorktree })
      }
      store.setState({
        createWorktree: async () => {
          throw new Error('could not resolve a default base ref for the E2E fixture')
        }
      })
    })

    try {
      const workspaceName = `e2e-create-failure-${Date.now()}`

      await openSidebarWorkspaceComposer(orcaPage)

      const dialog = orcaPage.getByRole('dialog', { name: /Create (Workspace|Worktree)/i })
      await expect(dialog).toBeVisible()
      await expect(dialog.locator('[data-workspace-name-input="true"]')).toBeVisible()

      const nameInput = dialog.getByPlaceholder(/Type a name/i)
      await expect(nameInput).toBeVisible()
      await nameInput.fill(workspaceName)

      const createButton = dialog.getByRole('button', { name: /Create (Workspace|Worktree)/i })
      await expect(createButton).toBeEnabled()
      await createButton.click()

      await expect(dialog).toBeHidden()
      const failedWorkspace = orcaPage.getByRole('button', {
        name: new RegExp(`${workspaceName} No base branch found`)
      })
      await expect(failedWorkspace).toBeVisible()
      await expect(orcaPage.getByText('Couldn’t create worktree')).toBeVisible()
      await expect(failedWorkspace).toContainText('No base branch found')
      await expect(orcaPage.getByRole('button', { name: 'Retry' })).toBeVisible()
    } finally {
      await orcaPage
        .evaluate(() => {
          ;(
            window as unknown as {
              __restoreCreateWorktree?: () => void
            }
          ).__restoreCreateWorktree?.()
          window.__store?.getState().closeModal()
        })
        .catch(() => {
          /* page may already be torn down */
        })
    }
  })
})
