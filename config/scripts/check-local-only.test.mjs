import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findStaleAllowlistRows, readAllowlist, scanLocalOnly } from './check-local-only.mjs'

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

  it('flags the OpenAI API hostname in source', () => {
    const v = scanLocalOnly({
      rootDir: base({
        'src/main/a.ts': 'const u = "https://api.openai.com/v1/audio/transcriptions"\n'
      }),
      allowlist: new Set()
    })
    expect(v).toEqual([
      { file: 'src/main/a.ts', line: 1, rule: 'forbidden-host', match: 'api.openai.com' }
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

  it('allows publish: null, which suppresses app-update.yml generation', () => {
    const root = base({})
    writeFileSync(
      path.join(root, 'config/electron-builder.config.cjs'),
      'module.exports = {\n  publish: null\n}\n'
    )
    expect(scanLocalOnly({ rootDir: root, allowlist: new Set() })).toEqual([])
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
      'config/electron-builder-pr-linux.config.cjs': 'module.exports = {\n  publish: []\n}\n'
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

  it('flags the pinned Node and skill-package download hosts', () => {
    const v = scanLocalOnly({
      rootDir: base({
        'src/shared/pin.ts':
          "const official = 'https://nodejs.org/dist'\nconst grant = 'https://storage.googleapis.com/x'\n"
      }),
      allowlist: new Set()
    })
    expect(v.map((x) => x.match)).toEqual(['nodejs.org/dist', 'storage.googleapis.com'])
  })

  it('flags value imports of ssh2, its subpaths and ssh2-* packages', () => {
    const v = scanLocalOnly({
      rootDir: base({
        'src/main/a.ts': "import { Client } from 'ssh2'\n",
        'src/main/b.ts': "const c = require('ssh2/lib/protocol/constants.js')\n",
        'src/main/c.ts': "import sftp from 'ssh2-sftp-client'\n",
        'src/shared/d.ts': "import nacl from 'tweetnacl'\n"
      }),
      allowlist: new Set()
    })
    expect(v.map((x) => [x.rule, x.match]).sort()).toEqual([
      ['forbidden-import', 'ssh2'],
      ['forbidden-import', 'ssh2-sftp-client'],
      ['forbidden-import', 'ssh2/lib/protocol/constants.js'],
      ['forbidden-import', 'tweetnacl']
    ])
  })

  it('ignores type-only ssh2 imports, single-line and multi-line', () => {
    const root = base({
      'src/main/hook-service.ts': "import type { SFTPWrapper } from 'ssh2'\n",
      'src/main/provider.ts': "import type {\n  Stats,\n  SFTPWrapper\n} from 'ssh2'\n",
      'src/main/reexport.ts': "export type { ClientChannel } from 'ssh2'\n"
    })
    expect(scanLocalOnly({ rootDir: root, allowlist: new Set() })).toEqual([])
  })

  it('still flags a mixed value and inline-type ssh2 import', () => {
    const v = scanLocalOnly({
      rootDir: base({ 'src/main/a.ts': "import { utils, type ParsedKey } from 'ssh2'\n" }),
      allowlist: new Set()
    })
    expect(v.map((x) => x.rule)).toEqual(['forbidden-import'])
  })

  it('flags ssh2 and tweetnacl dependencies but not @types/ssh2', () => {
    const root = fixture({
      'package.json': JSON.stringify({
        dependencies: { ssh2: '1', tweetnacl: '1' },
        devDependencies: { '@types/ssh2': '1' }
      }),
      'config/electron-builder.config.cjs': minimalBuilder
    })
    expect(scanLocalOnly({ rootDir: root, allowlist: new Set() }).map((x) => x.match)).toEqual([
      'ssh2',
      'tweetnacl'
    ])
  })

  it('honours path:rule:match allowlist entries', () => {
    const root = fixture({
      'package.json': JSON.stringify({ dependencies: { ssh2: '1', tweetnacl: '1' } }),
      'config/electron-builder.config.cjs': minimalBuilder
    })
    expect(
      scanLocalOnly({
        rootDir: root,
        allowlist: new Set(['package.json:forbidden-dependency:ssh2'])
      }).map((x) => x.match)
    ).toEqual(['tweetnacl'])
  })
})

describe('findStaleAllowlistRows', () => {
  it('reports rows whose file no longer exists', () => {
    const root = base({ 'src/main/present.ts': '' })
    expect(
      findStaleAllowlistRows({
        rootDir: root,
        allowlist: new Set([
          'src/main/present.ts:forbidden-host',
          'src/main/gone.ts:forbidden-import',
          'package.json:forbidden-dependency:ssh2'
        ])
      })
    ).toEqual(['src/main/gone.ts:forbidden-import'])
  })
})

describe('repository', () => {
  it('has no local-only violations outside the allowlist', () => {
    const rootDir = path.resolve(import.meta.dirname, '../..')
    expect(scanLocalOnly({ rootDir, allowlist: readAllowlist(rootDir) })).toEqual([])
  })

  it('has no stale allowlist rows', () => {
    const rootDir = path.resolve(import.meta.dirname, '../..')
    expect(findStaleAllowlistRows({ rootDir, allowlist: readAllowlist(rootDir) })).toEqual([])
  })
})
