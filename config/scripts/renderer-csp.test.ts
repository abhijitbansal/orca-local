import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  RENDERER_CSP,
  relaxScriptSrcForDev,
  rendererCspPlugin
} from '../build-plugins/renderer-csp'

const REQUIRED = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  // Why: markdown export fetch()es blob: image URLs, which 'self' does not cover.
  "connect-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'"
]

describe('renderer CSP', () => {
  for (const file of ['src/renderer/index.html', 'src/renderer/popout.html']) {
    it(`${file} carries the strict policy`, () => {
      // Why: prettier wraps the long meta tag across lines; compare on collapsed whitespace.
      const html = readFileSync(file, 'utf8').replace(/\s+/g, ' ')
      expect(html).toContain(
        `<meta http-equiv="Content-Security-Policy" content="${RENDERER_CSP}" />`
      )
      for (const directive of REQUIRED) {
        expect(RENDERER_CSP).toContain(directive)
      }
      expect(RENDERER_CSP).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    })
  }
  it('relaxes only script-src for the dev server', () => {
    const plugin = rendererCspPlugin()
    const html = `<meta http-equiv="Content-Security-Policy" content="${RENDERER_CSP}" />`
    const out = relaxScriptSrcForDev(html)
    expect(out).toContain("script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'")
    expect(out.split('<meta').length).toBe(html.split('<meta').length)
    expect(plugin.apply).toBe('serve')
    expect(typeof plugin.transformIndexHtml).toBe('function')
  })
})
