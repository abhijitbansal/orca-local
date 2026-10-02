import { describe, expect, it } from 'vitest'
import { updatedSkillSelection } from './skill-share-selection'

describe('updatedSkillSelection', () => {
  it('adds a selected skill without mutating the previous set', () => {
    const current = new Set(['a'])
    const next = updatedSkillSelection(current, 'b', true)
    expect([...next]).toEqual(['a', 'b'])
    expect([...current]).toEqual(['a'])
  })

  it('removes a deselected skill', () => {
    expect([...updatedSkillSelection(new Set(['a', 'b']), 'a', false)]).toEqual(['b'])
  })

  it('refuses to add past the maximum selection', () => {
    expect([...updatedSkillSelection(new Set(['a']), 'b', true, 1)]).toEqual(['a'])
  })
})
