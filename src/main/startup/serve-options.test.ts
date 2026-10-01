import { describe, expect, it } from 'vitest'
import { getServeOptions } from './serve-options'
import { normalizeServeModeArgv } from './serve-mode-argv'

describe('getServeOptions', () => {
  it('parses a valid launch', () => {
    expect(getServeOptions(['/AppRun', '--serve', '--serve-json'])).toEqual({
      json: true,
      recipeJson: false,
      projectRoot: null
    })
  })

  it('accepts equals-form values in the normalized shape', () => {
    expect(getServeOptions(['/AppRun', '--serve', '--serve-project-root=/tmp/repo'])).toMatchObject(
      { projectRoot: '/tmp/repo' }
    )
  })

  it('uses the final occurrence of each value flag', () => {
    expect(
      getServeOptions([
        '/AppRun',
        '--serve',
        '--serve-project-root',
        '/first',
        '--serve-project-root=/last'
      ])
    ).toMatchObject({ projectRoot: '/last' })
  })

  it('uses the final value of mixed boolean aliases', () => {
    expect(
      getServeOptions(['/AppRun', '--serve', '--serve-recipe-json', '--recipe-json=false'])
        .recipeJson
    ).toBe(false)
    expect(
      getServeOptions([
        '/AppRun',
        '--serve',
        '--recipe-json=false',
        '--serve-recipe-json',
        '--serve-project-root',
        '/tmp/repo'
      ]).recipeJson
    ).toBe(true)
  })

  it('keeps JSON enabled for an equals-form global flag', () => {
    expect(getServeOptions(['/AppRun', '--serve', '--json=false']).json).toBe(true)
  })

  it('accepts an equals-form value that resembles a serve flag', () => {
    const argv = normalizeServeModeArgv(['/AppRun', 'serve', '--project-root=--recipe-jsn'])
    expect(getServeOptions(argv).projectRoot).toBe('--recipe-jsn')
  })

  it('requires a project root for recipe JSON', () => {
    expect(() => getServeOptions(['/AppRun', '--serve', '--serve-recipe-json'])).toThrow(
      /requires --project-root/i
    )
    expect(() =>
      getServeOptions(['/AppRun', '--serve', '--serve-recipe-json', '--serve-project-root', '/r'])
    ).not.toThrow()
  })

  it('rejects a serve-flag typo while allowing Chromium switches', () => {
    const normalized = normalizeServeModeArgv(['/AppRun', 'serve', '--recipe-jsn'])
    expect(() => getServeOptions(normalized)).toThrow(/Unknown flag --recipe-jsn.*--recipe-json/i)
    expect(
      getServeOptions(['/AppRun', '--serve', '--disable-gpu', '--disable-features=Vulkan'])
        .recipeJson
    ).toBe(false)
  })

  it('still rejects a flag-shaped space value, as the CLI does', () => {
    expect(() =>
      getServeOptions(['/AppRun', '--serve', '--serve-project-root', '--recipe-jsn'])
    ).toThrow(/Unknown flag --recipe-jsn.*--recipe-json/i)
  })

  it('ignores serve-looking arguments after the terminator', () => {
    expect(
      getServeOptions(['/AppRun', '--serve', '--', '--serve-recipe-json', '--serve-json'])
    ).toEqual({ json: false, recipeJson: false, projectRoot: null })
  })
})
