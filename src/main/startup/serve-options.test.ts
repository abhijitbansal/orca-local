import { describe, expect, it } from 'vitest'
import { getServeOptions } from './serve-options'

describe('getServeOptions', () => {
  it('parses a valid launch', () => {
    expect(getServeOptions(['/AppRun', '--serve', '--serve-json'])).toEqual({ json: true })
  })

  it('keeps JSON enabled for an equals-form global flag', () => {
    expect(getServeOptions(['/AppRun', '--serve', '--json=false']).json).toBe(true)
  })

  it('accepts Chromium switches', () => {
    expect(
      getServeOptions(['/AppRun', '--serve', '--disable-gpu', '--disable-features=Vulkan']).json
    ).toBe(false)
  })

  it('ignores serve-looking arguments after the terminator', () => {
    expect(getServeOptions(['/AppRun', '--serve', '--', '--serve-json'])).toEqual({ json: false })
  })
})
