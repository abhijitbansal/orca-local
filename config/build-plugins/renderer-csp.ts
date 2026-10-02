import type { Plugin } from 'vite'

// Why one string: the HTML files carry the literal policy so the packaged renderer never depends on a
// build step for its CSP; this constant exists so the test and the dev relaxation share the text.
export const RENDERER_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: file:",
  "media-src 'self' data: blob: file:",
  "font-src 'self' data: file:",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: ws://127.0.0.1:* http://127.0.0.1:* ws://localhost:* http://localhost:*",
  "frame-src 'self' data: blob: file: http: https: orca-preview:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

export function relaxScriptSrcForDev(html: string): string {
  return html.replace(
    "script-src 'self' 'wasm-unsafe-eval'",
    "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'"
  )
}

// Why serve-only: @vitejs/plugin-react injects an inline refresh preamble in dev; production has no inline scripts.
export function rendererCspPlugin(): Plugin {
  return {
    name: 'orca-renderer-csp-dev-relaxation',
    apply: 'serve',
    transformIndexHtml: relaxScriptSrcForDev
  }
}
