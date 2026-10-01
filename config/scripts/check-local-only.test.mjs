import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanLocalOnly } from './check-local-only.mjs'

const roots = []
function fixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'orca-local-only-'))
  roots.push(root)
  for (const [rel, body] of Object.entries(files)) {
    const target = path.join(root, rel)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, body)
  }
  return root
}
const minimalPackage = JSON.stringify({ dependencies: {}, devDependencies: {} })
const minimalBuilder = 'module.exports = { appId: "x" }\n'
function base(extra) {
  return fixture({
    'package.json': minimalPackage,
    'config/electron-builder.config.cjs': minimalBuilder,
    ...extra
  })
}
afterEach(() => {
  for (const r of roots.splice(0)) {
    rmSync(r, { recursive: true, force: true })
  }
})

describe('scanLocalOnly', () => {
  it('returns no violations for a clean tree', () => {
    expect(
      scanLocalOnly({
        rootDir: base({ 'src/main/a.ts': 'const x = "http://127.0.0.1:1"\n' }),
        allowlist: new Set()
      })
    ).toEqual([])
  })

  it('flags an Orca cloud hostname in source', () => {
    const v = scanLocalOnly({
      rootDir: base({ 'src/main/a.ts': 'x\nconst u = "https://api.onorca.dev/v1"\n' }),
      allowlist: new Set()
    })
    expect(v).toEqual([
      { file: 'src/main/a.ts', line: 2, rule: 'forbidden-host', match: 'onorca.dev' }
    ])
  })

  it('ignores test files and fixtures', () => {
    const root = base({
      'src/main/a.test.ts': 'https://us.i.posthog.com',
      'src/main/__fixtures__/b.ts': 'https://onorca.dev'
    })
    expect(scanLocalOnly({ rootDir: root, allowlist: new Set() })).toEqual([])
  })

  it('flags forbidden imports and dependencies', () => {
    const root = fixture({
      'package.json': JSON.stringify({
        dependencies: { 'posthog-node': '1' },
        devDependencies: {}
      }),
      'config/electron-builder.config.cjs': minimalBuilder,
      'src/main/u.ts': "import { autoUpdater } from 'electron-updater'\n"
    })
    const rules = scanLocalOnly({ rootDir: root, allowlist: new Set() })
      .map((v) => v.rule)
      .sort()
    expect(rules).toEqual(['forbidden-dependency', 'forbidden-import'])
  })

  it('flags electron-builder publish and protocols blocks', () => {
    const root = base({})
    writeFileSync(
      path.join(root, 'config/electron-builder.config.cjs'),
      'module.exports = {\n  publish: [],\n  protocols: [{ schemes: ["orca"] }]\n}\n'
    )
    const rules = scanLocalOnly({ rootDir: root, allowlist: new Set() })
      .map((v) => v.rule)
      .sort()
    expect(rules).toEqual(['builder-protocols', 'builder-publish'])
  })

  it('flags wildcard bind literals', () => {
    const v = scanLocalOnly({
      rootDir: base({ 'src/main/s.ts': "server.listen(0, '0.0.0.0')\n" }),
      allowlist: new Set()
    })
    expect(v.map((x) => x.rule)).toEqual(['wildcard-bind'])
  })

  it('does not treat a :: id separator as a bind', () => {
    const root = base({
      'src/shared/id.ts': "const SEPARATOR = '::'\nconst key = [a, b].join('::')\n"
    })
    expect(scanLocalOnly({ rootDir: root, allowlist: new Set() })).toEqual([])
  })

  it('flags a wildcard host option', () => {
    const v = scanLocalOnly({
      rootDir: base({ 'src/main/s.ts': "new Server({ port, host: '::' })\n" }),
      allowlist: new Set()
    })
    expect(v.map((x) => x.rule)).toEqual(['wildcard-bind'])
  })

  it('checks every module specifier on a line', () => {
    const root = base({
      'src/main/u.ts': "const a = require('x'), b = require('electron-updater')\n"
    })
    expect(scanLocalOnly({ rootDir: root, allowlist: new Set() }).map((x) => x.match)).toEqual([
      'electron-updater'
    ])
  })

  it('scans every electron-builder config', () => {
    const root = base({
      'config/electron-builder-pr-linux.config.cjs': 'module.exports = {\n  publish: null\n}\n'
    })
    expect(scanLocalOnly({ rootDir: root, allowlist: new Set() }).map((x) => x.file)).toEqual([
      'config/electron-builder-pr-linux.config.cjs'
    ])
  })

  it('honours path:rule allowlist entries', () => {
    const root = base({ 'src/main/a.ts': 'https://onorca.dev' })
    expect(
      scanLocalOnly({ rootDir: root, allowlist: new Set(['src/main/a.ts:forbidden-host']) })
    ).toEqual([])
  })
})
