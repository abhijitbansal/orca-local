import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { PACKAGED_RUNTIME_PACKAGE_ROOTS } = require('../packaged-runtime-node-modules.cjs')

describe('packaged runtime package roots', () => {
  it('ships no SSH client: the ssh2 runtime dependency is gone', () => {
    expect(PACKAGED_RUNTIME_PACKAGE_ROOTS).not.toContain('ssh2')
  })

  it('still ships the local and WSL runtime closure', () => {
    for (const name of ['node-pty', '@parcel/watcher', 'ws', 'yaml', 'zod', 'jsonc-parser']) {
      expect(PACKAGED_RUNTIME_PACKAGE_ROOTS).toContain(name)
    }
  })
})
