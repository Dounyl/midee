const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
const TEXT_ENTRY_INPUT_TYPES = new Set([
  '',
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
])

export function isKeyboardShortcutEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (!INPUT_TAGS.has(target.tagName)) return false
  if (target.tagName !== 'INPUT') return true
  return TEXT_ENTRY_INPUT_TYPES.has((target as HTMLInputElement).type.toLowerCase())
}

export function isKeyboardShortcutIgnored(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  return isKeyboardShortcutEditingTarget(e.target)
}
