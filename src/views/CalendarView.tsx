import { Plus } from 'lucide-react'
import { Agenda } from '@/components/calendar/Agenda'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Reveal, RevealItem } from '@/components/ui/Reveal'
import { useDashboard } from '@/context/DashboardContext'

export function CalendarView() {
  const { openEditor, calendar } = useDashboard()
  return (
    <Reveal id="calendar">
      <PageHeader
        shortTitle="Calendar"
        eyebrow={calendar.google.account ? `Synced with ${calendar.google.account.email}` : calendar.status === 'off' ? 'Not connected to Google Calendar' : 'Synced from iCal links'}
        title="Calendar"
        aside={
          <Button variant="primary" onClick={() => openEditor({ type: 'event' })}>
            <Plus aria-hidden className="size-4" strokeWidth={2.4} />
            Add event
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <RevealItem className="xl:sticky xl:top-8">
          <MiniCalendar large />
        </RevealItem>
        <RevealItem>
          <Agenda title="Schedule" />
        </RevealItem>
      </div>
    </Reveal>
  )
}
