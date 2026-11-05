/**
 * Monthly transport card (metro, bus, suburban): it runs out on the 3rd, so on the 2nd dash says it expires tomorrow.
 */
export const CARD_REMINDER_DAY = 2
export const CARD_REMINDER_HOUR = 10

/** The next `count` reminder times after `now` (10:00 on the 2nd of each month). */
export function cardReminders(now: Date, count = 2): Date[] {
  const out: Date[] = []
  for (let m = 0; out.length < count && m < count + 2; m++) {
    const at = new Date(now.getFullYear(), now.getMonth() + m, CARD_REMINDER_DAY, CARD_REMINDER_HOUR, 0)
    if (at > now) out.push(at)
  }
  return out
}

/** On Today: the 2nd ("expires tomorrow") and the 3rd ("expires today"). */
export function cardStatus(now: Date): 'tomorrow' | 'today' | undefined {
  if (now.getDate() === CARD_REMINDER_DAY) return 'tomorrow'
  if (now.getDate() === CARD_REMINDER_DAY + 1) return 'today'
  return undefined
}
