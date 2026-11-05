import { assignments, courses } from './courses'
import { events } from './events'
import { tasks } from './tasks'

/** Example semester for trying the app before entering real data. */
export function sampleData() {
  return { courses, assignments, events, tasks }
}
