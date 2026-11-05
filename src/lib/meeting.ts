/** Online lessons: meeting links (Teams, Zoom, Meet) and how to tell an online class from one on campus. */

const LINK = /https:\/\/(?:teams\.microsoft\.com|teams\.live\.com|[\w-]+\.zoom\.us|zoom\.us|meet\.google\.com)\/[^\s"'<>)\]]+/i

/** The first meeting link in any of these texts (descriptions can be HTML). */
export function findMeetingLink(...texts: Array<string | undefined>): string | undefined {
  for (const t of texts) {
    const m = t?.replace(/&amp;/g, '&').match(LINK)
    if (m) return m[0].replace(/[.,;]+$/, '')
  }
  return undefined
}

const ANY_LINK = /https?:\/\/[^\s"'<>)\]]+/gi

/** The first web link that isn't a meeting link (a practice site, course page…), from notes that may be HTML. */
export function findOtherLink(...texts: Array<string | undefined>): string | undefined {
  for (const t of texts) {
    for (const m of t?.replace(/&amp;/g, '&').matchAll(ANY_LINK) ?? []) {
      const url = m[0].replace(/[.,;]+$/, '')
      if (!LINK.test(url)) return url
    }
  }
  return undefined
}

/** A short button label for a link: "Practice" for practice and test sites, else "Open link". */
export const linkLabel = (url: string) => (/practi|quiz|test|exam|mock/i.test(url) ? 'Practice' : 'Open link')

/** "Teams", "Zoom" or "Meet". */
export const meetingName = (url: string) => (/zoom\.us/i.test(url) ? 'Zoom' : /meet\.google/i.test(url) ? 'Meet' : 'Teams')

const ONLINE = /\bonline\b|διαδικτυακ|εξ αποστάσεως|εξ αποστασεως|\bteams\b/i

/** Online when the title or notes say so, or when there's a meeting link. */
export const looksOnline = (link: string | undefined, ...texts: Array<string | undefined>) => Boolean(link) || texts.some((t) => t && ONLINE.test(t))
