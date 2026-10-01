import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

const pr = parse(readFileSync('.github/workflows/pr.yml', 'utf8'))

function assertJoinedBefore(steps, id, consumer) {
  const start = steps.findIndex((step) => step.id === id)
  const join = steps.findIndex((step) => [step.wait].flat().includes(id))
  const end = steps.findIndex(consumer)
  expect(start).toBeGreaterThanOrEqual(0)
  expect(steps[start].background).toBe(true)
  expect(join).toBeGreaterThan(start)
  expect(end).toBeGreaterThan(join)
}

describe('CI background step barriers', () => {
  it('joins every background check without suppressing failures', () => {
    for (const job of [
      pr.jobs.static_analysis,
      pr.jobs.typecheck,
      pr.jobs.package,
      pr.jobs.shell_contracts
    ]) {
      const pending = new Set()
      for (const step of job.steps) {
        if (step.background) {
          expect(step.id).toBeTruthy()
          expect(pending.has(step.id)).toBe(false)
          expect(step['continue-on-error']).toBeUndefined()
          pending.add(step.id)
        }
        if (step.wait) {
          expect(step.if).toBeUndefined()
          expect(step['continue-on-error']).toBeUndefined()
          for (const id of [step.wait].flat()) {
            expect(pending.delete(id), `missing background step ${id}`).toBe(true)
          }
        }
        expect(pending.size).toBeLessThanOrEqual(job === pr.jobs.package ? 4 : 3)
      }
      expect([...pending]).toEqual([])
    }
  })

  it('joins planning before publishing the unit artifact', () => {
    assertJoinedBefore(
      pr.jobs.typecheck.steps,
      'unit-plan',
      (step) => step.uses === 'actions/upload-artifact@v7'
    )
  })

  it('finishes native import-cycle analysis before the changed-code gate', () => {
    assertJoinedBefore(
      pr.jobs.static_analysis.steps,
      'native-code-quality',
      (step) => step.id === 'changed-code-quality'
    )
  })

  it('joins shell installation before checking fish and running live shell tests', () => {
    const steps = pr.jobs.shell_contracts.steps
    assertJoinedBefore(steps, 'shells', (step) => step.name === 'Require fish 4+')
    assertJoinedBefore(steps, 'shells', (step) => step.name === 'Test real shell contracts')
    const install = steps.findIndex((step) => step.uses?.endsWith('/install-node-dependencies'))
    expect(install).toBeGreaterThan(steps.findIndex((step) => step.id === 'shells'))
    expect(install).toBeLessThan(steps.findIndex((step) => step.wait === 'shells'))
  })

  it('joins package setup before reading outputs and preserves isolated native probes', () => {
    const steps = pr.jobs.package.steps
    // Parallel composites must not race to download their shared cache action on first use.
    const cacheAction = steps.findIndex((step) => step.uses === 'actions/cache/restore@v5')
    expect(cacheAction).toBeGreaterThanOrEqual(0)
    expect(cacheAction).toBeLessThan(
      steps.findIndex((step) => step.id === 'shutdown-fixture-cache')
    )
    for (const [id, consumer] of [
      ['linux-package-tools', 'Package unpacked app'],
      ['shutdown-fixture-cache', 'Verify headless serve signal shutdown'],
      ['cli-fixture-cache', 'Verify Linux CLI launch contract']
    ]) {
      assertJoinedBefore(steps, id, (step) => step.name === consumer)
      expect(steps.findIndex((step) => step.id === id)).toBeGreaterThan(
        steps.findIndex((step) => step.name === 'Test Linux Electron lifecycle boundary')
      )
    }
  })
})
