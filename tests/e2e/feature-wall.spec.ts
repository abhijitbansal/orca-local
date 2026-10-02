import { test, expect } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'
import type { ElectronApplication } from '@stablyai/playwright-test'

async function openFeatureTourFromMenu(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow, Menu }) => {
    const featureTourItem = Menu.getApplicationMenu()
      ?.items.find((item) => item.label === 'Help')
      ?.submenu?.items.find((item) => item.label === 'Explore Orca')

    if (!featureTourItem) {
      throw new Error('Explore Orca menu item was not registered')
    }

    const window = BrowserWindow.getAllWindows()[0]
    featureTourItem.click(featureTourItem, window, {
      triggeredByAccelerator: false,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false
    } as Electron.KeyboardEvent)
  })
}

test.describe('Feature tour modal', () => {
  test.beforeEach(async ({ orcaPage }) => {
    await waitForSessionReady(orcaPage)
  })

  test('opens from the Help menu and renders the workflow rail', async ({
    electronApp,
    orcaPage
  }) => {
    await openFeatureTourFromMenu(electronApp)

    await expect(orcaPage.getByRole('dialog', { name: 'Get to know Orca' })).toBeVisible({
      timeout: 10_000
    })
    await expect(orcaPage.getByText('Reopen any time from Help > Explore Orca.')).toBeVisible()

    // Four workflow rows in the rail.
    const rail = orcaPage.getByRole('navigation', { name: 'Workflows' })
    await expect(rail.getByRole('tab')).toHaveCount(4)
    await expect(rail.getByRole('tab', { name: /Workspaces/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    await expect(orcaPage.locator('[data-ws-id]')).toHaveCount(3)

    // ArrowDown moves selection through the rail.
    await rail.getByRole('tab', { name: /Workspaces/i }).focus()
    await orcaPage.keyboard.press('ArrowDown')
    await expect(rail.getByRole('tab', { name: /Agents/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    await rail.getByRole('tab', { name: /Workbench/i }).click()
    await rail.getByRole('button', { name: /Browser/i }).click()
    await expect(
      orcaPage.getByText(
        "Run your app in Orca's browser, send selected UI elements to agents, and let your agents interact with your webpage."
      )
    ).toBeVisible()
    await expect(orcaPage.getByRole('heading', { name: 'Browser Use skill' })).toBeVisible()
    await expect(
      orcaPage.getByText("Enables agents to navigate and verify pages in Orca's browser.")
    ).toBeVisible()
    await expect(orcaPage.getByRole('heading', { name: 'CLI skill' })).toHaveCount(0)
    await expect(orcaPage.getByText('With the Orca CLI skill', { exact: false })).toHaveCount(0)
  })

  test('continue advances through workflow substeps before the next workflow', async ({
    orcaPage
  }) => {
    await orcaPage.evaluate(() => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      store.getState().openModal('feature-wall', { source: 'help_menu' })
    })

    const rail = orcaPage.getByRole('navigation', { name: 'Workflows' })
    const continueButton = orcaPage.getByRole('button', { name: /^Continue/ })

    await continueButton.click()
    await expect(rail.getByRole('tab', { name: /Agents/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(rail.getByRole('button', { name: /Visibility/i })).toHaveAttribute(
      'aria-current',
      'step'
    )

    await continueButton.click()
    await expect(rail.getByRole('button', { name: /Orchestration/i })).toHaveAttribute(
      'aria-current',
      'step'
    )
    await expect(rail.getByRole('tab', { name: /Workbench/i })).toHaveAttribute(
      'aria-selected',
      'false'
    )

    await continueButton.click()
    await expect(rail.getByRole('button', { name: /Usage/i })).toHaveAttribute(
      'aria-current',
      'step'
    )

    await continueButton.click()
    await expect(rail.getByRole('tab', { name: /Workbench/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(rail.getByRole('button', { name: /Terminal/i })).toHaveAttribute(
      'aria-current',
      'step'
    )
  })

  test('does not pre-check configured workflows until the user visits them', async ({
    orcaPage,
    electronApp
  }) => {
    await electronApp.evaluate(
      ({ ipcMain }, preflightStatus) => {
        ipcMain.removeHandler('preflight:check')
        ipcMain.handle('preflight:check', () => preflightStatus)
      },
      {
        git: { installed: true }
      }
    )
    await orcaPage.evaluate(async () => {
      for (const key of [
        'orca.featureWall.visitedWorkflows.v1',
        'orca.featureWall.visitedAgentSteps.v1',
        'orca.featureWall.visitedWorkbenchSteps.v1',
        'orca.featureWall.visitedReviewSteps.v1',
        'orca.featureWall.completedWorkflows.v1',
        'orca.featureWall.completedAgentSteps.v1',
        'orca.featureWall.completedWorkbenchSteps.v1',
        'orca.featureWall.completedReviewSteps.v1'
      ]) {
        localStorage.removeItem(key)
      }
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      // Seed through the status actions so each result gets the current execution context.
      await store.getState().refreshPreflightStatus({ force: true })
      store.getState().openModal('feature-wall', { source: 'help_menu' })
    })

    const rail = orcaPage.getByRole('navigation', { name: 'Workflows' })
    const workspacesTab = rail.locator('[data-feature-wall-workflow-id="workspaces"]')
    const agentsTab = rail.locator('[data-feature-wall-workflow-id="agents-orchestration"]')
    const visibilityStep = rail.getByRole('button', { name: /Visibility/i })
    await expect(workspacesTab.locator('[aria-label="Completed"]')).toHaveCount(1)
    await expect(agentsTab.locator('[aria-label="Completed"]')).toHaveCount(0)
    // Agents has setup-backed substeps, so visiting completes only its Visibility substep.
    await agentsTab.click()
    await expect(visibilityStep.locator('[aria-label="Completed"]')).toHaveCount(1)
    await expect(workspacesTab.locator('[aria-label="Completed"]')).toHaveCount(1)
  })

  test('keeps persisted completed setup-backed substeps checked when reopened', async ({
    orcaPage
  }) => {
    await orcaPage.evaluate(() => {
      localStorage.setItem(
        'orca.featureWall.completedAgentSteps.v1',
        JSON.stringify(['orchestration'])
      )
      localStorage.setItem(
        'orca.featureWall.completedWorkbenchSteps.v1',
        JSON.stringify(['browser'])
      )
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      store.getState().openModal('feature-wall', { source: 'help_menu' })
    })

    const rail = orcaPage.getByRole('navigation', { name: 'Workflows' })

    await rail.getByRole('tab', { name: /Agents/i }).click()
    await expect(
      rail.getByRole('button', { name: /Orchestration/i }).locator('[aria-label="Completed"]')
    ).toHaveCount(1)

    await rail.getByRole('tab', { name: /Workbench/i }).click()
    await expect(
      rail.getByRole('button', { name: /Browser/i }).locator('[aria-label="Completed"]')
    ).toHaveCount(1)
  })
})
