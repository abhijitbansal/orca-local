import { describe, expect, it } from 'vitest'
import { getServeFlagTypoError, getServeOptionValidationError } from './serve-option-validation'

const validOptions = {
  recipeJson: false,
  projectRoot: null
}

describe('getServeOptionValidationError', () => {
  it('accepts compatible options', () => {
    expect(getServeOptionValidationError(validOptions)).toBeNull()
  })

  it('requires a project root for recipe JSON', () => {
    expect(getServeOptionValidationError({ ...validOptions, recipeJson: true })).toMatch(
      /requires --project-root/i
    )
    expect(getServeOptionValidationError({ recipeJson: true, projectRoot: '/tmp/repo' })).toBeNull()
  })
})

describe('getServeFlagTypoError', () => {
  it('accepts exact serve flags and arbitrary Chromium switches', () => {
    expect(
      getServeFlagTypoError([
        '/opt/orca/orca-ide',
        '--serve',
        '--serve-recipe-json',
        '--disable-gpu',
        '--disable-features=Vulkan',
        '--no-parent'
      ])
    ).toBeNull()
  })

  it.each(['--recipe-jsn', '--recipe-jason', '--serve-recipe-jsn'])(
    'suggests the intended flag for %s',
    (flag) => {
      expect(getServeFlagTypoError(['/opt/orca/orca-ide', '--serve', flag])).toMatch(
        /Unknown flag .*Did you mean --(?:serve-)?recipe-json\?/i
      )
    }
  )

  it('does not reinterpret tokens after --', () => {
    expect(
      getServeFlagTypoError(['/opt/orca/orca-ide', '--serve', '--', '--recipe-jsn'])
    ).toBeNull()
  })

  it('does not inspect an equals-form value as a flag', () => {
    expect(
      getServeFlagTypoError(['/opt/orca/orca-ide', '--serve-project-root=--recipe-jsn'])
    ).toBeNull()
  })

  it('keeps flag-shaped space values subject to typo validation', () => {
    expect(
      getServeFlagTypoError(['/opt/orca/orca-ide', '--serve-project-root', '--recipe-jsn'])
    ).toMatch(/Unknown flag --recipe-jsn.*--recipe-json/i)
  })
})
