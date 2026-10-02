export function updatedSkillSelection(
  current: ReadonlySet<string>,
  skillId: string,
  selected: boolean,
  maxSelection?: number
): Set<string> {
  const next = new Set(current)
  if (selected && (maxSelection === undefined || next.size < maxSelection)) {
    next.add(skillId)
  } else {
    next.delete(skillId)
  }
  return next
}
