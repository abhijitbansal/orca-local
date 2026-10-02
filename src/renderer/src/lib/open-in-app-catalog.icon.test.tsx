import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { OpenInApplicationIcon } from './open-in-app-catalog'

describe('OpenInApplicationIcon', () => {
  it('never renders an image from a remote host', () => {
    const markup = renderToStaticMarkup(<OpenInApplicationIcon />)
    expect(markup).not.toMatch(/src="https?:/)
  })
})
