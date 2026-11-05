/**
 * Monthly transport pass (optional, set up in Settings): it renews on day `renewDay`, so the day before
 * unidash says it renews tomorrow.
 */
export const PASS_REMINDER_HOUR = 10

/** The next `count` reminder times after `now` (10:00 the day before the pass renews). */
export function passReminders(renewDay: number, now: Date, count = 2): Date[] {
  const out: Date[] = []
  for (let m = 0; out.length < count && m < count + 2; m++) {
    const at = new Date(now.getFullYear(), now.getMonth() + m, renewDay - 1, PASS_REMINDER_HOUR, 0)
    if (at > now) out.push(at)
  }
  return out
}

/** On Today: the day before ("runs out tomorrow") and the day itself ("runs out today"). */
export function passStatus(renewDay: number, now: Date): 'tomorrow' | 'today' | undefined {
  if (now.getDate() === renewDay) return 'today'
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return tomorrow.getDate() === renewDay ? 'tomorrow' : undefined
}
