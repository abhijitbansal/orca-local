import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AgentIcon } from './agent-catalog'

describe('AgentIcon', () => {
  it('never renders an image from a remote host', () => {
    const markup = renderToStaticMarkup(<AgentIcon agent="codebuddy" size={14} />)
    expect(markup).not.toMatch(/src="https?:/)
  })
})
