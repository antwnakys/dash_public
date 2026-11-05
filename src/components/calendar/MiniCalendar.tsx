import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Segmented } from '@/components/ui/Segmented'
import { Card, Section } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/cn'
import { addDays, addMonths, fmt, isSameDay, monthGrid, startOfDay, weekOf } from '@/lib/date'

type Mode = 'month' | 'week'

const modes = [
  { value: 'month' as const, label: 'Month' },
  { value: 'week' as const, label: 'Week' },
]

const dayKey = (d: Date) => startOfDay(d).toDateString()

export function MiniCalendar({ large = false }: { large?: boolean }) {
  const { agenda, selectedDate, setSelectedDate } = useDashboard()
  const [mode, setMode] = useState<Mode>('month')
  const [cursor, setCursor] = useState(selectedDate)
  const [direction, setDirection] = useState(0)
  const today = startOfDay(useNow(60_000))

  const days = mode === 'month' ? monthGrid(cursor) : weekOf(cursor)

  // Per day, up to three dots: an exam in accent, a class in course green, everything else grey.
  const marks = useMemo(() => {
    const m = new Map<string, { count: number; exam: boolean; class: boolean }>()
    for (const item of agenda) {
      const k = dayKey(item.date)
      const prev = m.get(k) ?? { count: 0, exam: false, class: false }
      m.set(k, { count: prev.count + 1, exam: prev.exam || item.kind === 'exam', class: prev.class || item.kind === 'class' })
    }
    return m
  }, [agenda])

  const step = (dir: 1 | -1) => {
    setDirection(dir)
    setCursor((c) => (mode === 'month' ? addMonths(c, dir) : addDays(c, dir * 7)))
  }

  const select = (d: Date) => {
    setSelectedDate(d)
    if (mode === 'month' && d.getMonth() !== cursor.getMonth()) {
      setDirection(d < cursor ? -1 : 1)
      setCursor(d)
    }
  }

  const showingToday = mode === 'month' ? cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear() : days.some((d) => isSameDay(d, today))

  return (
    <Section
      title={fmt.monthYear.format(mode === 'week' ? days[3] : cursor)}
      action={<Segmented label="Calendar view" options={modes} value={mode} onChange={setMode} />}
    >
      <Card className="p-3 sm:p-4">
        <div className="mb-1 flex items-center justify-between">
          <Button
            variant="plain"
            size="sm"
            disabled={showingToday && isSameDay(selectedDate, today)}
            onClick={() => {
              setDirection(today < cursor ? -1 : 1)
              setCursor(today)
              setSelectedDate(today)
            }}
            className="-ml-1"
          >
            Today
          </Button>
          <div className="flex">
            <IconButton icon={ChevronLeft} label={mode === 'month' ? 'Previous month' : 'Previous week'} onClick={() => step(-1)} />
            <IconButton icon={ChevronRight} label={mode === 'month' ? 'Next month' : 'Next week'} onClick={() => step(1)} />
          </div>
        </div>

        <div className="grid grid-cols-7 pb-1 text-center text-caption font-medium text-faint">
          {weekOf(today).map((d) => (
            <span key={d.getDay()} aria-hidden>
              {fmt.weekdayShort.format(d).slice(0, 1)}
            </span>
          ))}
        </div>

        <div className="relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={`${mode}-${dayKey(days[0])}`}
              custom={direction}
              variants={{
                enter: (dir: number) => ({ x: dir * 28, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (dir: number) => ({ x: dir * -28, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              // Swipe sideways to change month or week; the grid follows the finger and rubber-bands back.
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.3}
              onDragEnd={(_, info) => {
                if (info.offset.x < -48 || info.velocity.x < -450) step(1)
                else if (info.offset.x > 48 || info.velocity.x > 450) step(-1)
              }}
              className="grid touch-pan-y grid-cols-7 gap-y-0.5"
            >
              {days.map((d) => {
                const mark = marks.get(dayKey(d))
                const isToday = isSameDay(d, today)
                const selected = isSameDay(d, selectedDate)
                const outside = mode === 'month' && d.getMonth() !== cursor.getMonth()
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => select(d)}
                    aria-pressed={selected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={`${fmt.longDate.format(d)}${mark ? `, ${mark.count} scheduled` : ''}`}
                    className={cn(
                      'relative mx-auto flex flex-col items-center justify-center rounded-full text-body tabular-nums transition-colors duration-150',
                      large ? 'size-11 sm:size-12' : 'size-10',
                      mode === 'week' && 'h-14 rounded-[1rem]',
                      selected ? 'bg-accent-fill font-semibold text-accent-ink' : 'hover:bg-fill',
                      !selected && isToday && 'font-semibold text-accent',
                      !selected && !isToday && (outside ? 'text-faint/60' : 'text-ink'),
                    )}
                  >
                    {d.getDate()}
                    <span className="absolute bottom-1 flex gap-[3px]">
                      {mark &&
                        [...(mark.exam ? ['bg-accent'] : []), ...(mark.class ? ['bg-course'] : []), 'bg-faint', 'bg-faint', 'bg-faint']
                          .slice(0, Math.min(mark.count, 3))
                          .map((tone, i) => <span key={i} className={cn('size-1 rounded-full', selected ? 'bg-accent-ink/80' : tone)} />)}
                    </span>
                  </button>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </Card>
    </Section>
  )
}
