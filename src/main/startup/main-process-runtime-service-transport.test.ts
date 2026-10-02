import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('main-process runtime composition in the local-only build', () => {
  it('never wires an orchestration environment transport', () => {
    const source = readFileSync(join(__dirname, 'main-process-runtime-service.ts'), 'utf8')
    expect(source).not.toMatch(
      /runtime-environment-transport-routing|runtime-environment-store|orchestrationEnvironmentTransport/
    )
  })
})
