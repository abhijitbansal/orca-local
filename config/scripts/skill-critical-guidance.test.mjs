import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

function readGuide(name) {
  return readFileSync(
    resolve(import.meta.dirname, '../../skill-guides', `${name}.md`),
    'utf8'
  ).replace(/\s+/gu, ' ')
}

it('preserves verification distinctions and emulator cleanup', () => {
  const text = readGuide('computer-use')
  expect(text).toContain('`verified` means the changed value was read back')
  expect(text).toContain('unverified (accessibility action unasserted)')
  expect(text).toContain('unverified (synthetic input)')
  expect(text).toContain('Missing verification metadata is unverified')
  for (const name of ['orca-emulator', 'orca-emulator-android']) {
    expect(readGuide(name)).toContain('Run `kill` when you are done')
  }
})
