import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorSheet } from '@/components/editor/EditorSheet'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { ToastHost } from '@/components/ui/Toast'
import { useDashboard } from '@/context/DashboardContext'
import { onMenuBar } from '@/lib/macApp'
import { blur, ease, ltr, spring } from '@/lib/motion'
import { isNative } from '@/lib/native'
import { views } from '@/views'
import { AmbientBackground } from './AmbientBackground'
import { Intro } from './Intro'
import { PullToRefresh } from './PullToRefresh'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

function usePhone() {
  const query = '(max-width: 639px)'
  const [phone, setPhone] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const onChange = () => setPhone(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])
  return phone
}

const pageVariants = {
  enter: (dir: number) => ({ x: dir * 36 * ltr, opacity: 0, ...blur(4) }),
  center: { x: 0, opacity: 1, ...blur(0) },
  exit: (dir: number) => ({ x: dir * -36 * ltr, opacity: 0, ...blur(4), transition: { x: spring.smooth, opacity: { duration: 0.09 } } }),
}

export function AppShell() {
  const { view, setView, editor, openEditor, closeEditor, dismissToast, calendar, cloud, profile } = useDashboard()
  const reduce = useReducedMotion()
  const phone = usePhone()
  // Scale around the middle of what's on screen, not the top of the page.
  const [originY, setOriginY] = useState(0)
  if (editor && phone && originY === 0) setOriginY(window.scrollY + window.innerHeight / 2)
  if (!editor && originY !== 0) setOriginY(0)
  const View = views.find((v) => v.id === view)!.component
  // Which way to slide: towards the tab you picked, like moving along the tab bar.
  const index = views.findIndex((v) => v.id === view)
  const [nav, setNav] = useState({ index, dir: 0 })
  if (nav.index !== index) setNav({ index, dir: index > nav.index ? 1 : -1 })

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view])

  const refresh = useCallback(async () => {
    cloud.syncNow()
    calendar.sync()
    await new Promise((r) => setTimeout(r, 900))
  }, [cloud, calendar])

  // Mac app: New and the sections in the menu bar menu.
  const closeRef = useRef(closeEditor)
  useEffect(() => {
    closeRef.current = closeEditor
  })
  useEffect(
    () =>
      onMenuBar((choice) => {
        if (choice === 'new') return openEditor({ type: 'new' })
        closeRef.current()
        setView(choice)
      }),
    [openEditor, setView],
  )

  // Keyboard: N opens New, 1–4 switch sections.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editor || !profile.onboarded || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        openEditor({ type: 'new' })
      }
      const index = Number(e.key) - 1
      if (views[index]) setView(views[index].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor, openEditor, setView, profile.onboarded])

  const { scrollY } = useScroll()
  const statusFade = useTransform(scrollY, [0, 28], [0, 1])

  return (
    <div className="relative min-h-dvh">
      <AmbientBackground />
      {isNative ? (
        // iPhone app: at the top of the page nothing covers the status bar, so the page and its glow run
        // straight up behind the Dynamic Island. Once you scroll, a soft fade (tint and blur tapering off)
        // fades in so the clock stays readable over content; the compact title bar takes over after that.
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[calc(env(safe-area-inset-top)+1.5rem)] backdrop-blur-md"
          style={{
            opacity: statusFade,
            background: 'linear-gradient(to bottom, var(--bg) calc(env(safe-area-inset-top) - 0.25rem), transparent)',
            maskImage: 'linear-gradient(to bottom, black env(safe-area-inset-top), transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black env(safe-area-inset-top), transparent)',
          }}
        />
      ) : (
        // Keeps a browser's status bar legible as content scrolls under it.
        <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-bg/70 backdrop-blur-xl" />
      )}
      <PullToRefresh onRefresh={refresh} />
      <Sidebar />
      {/* On phones an open sheet pushes the page back, like iOS. */}
      <motion.main
        animate={phone && editor && !reduce ? { scale: 0.93, borderRadius: 28, y: 8 } : { scale: 1, borderRadius: 0, y: 0 }}
        transition={spring.smooth}
        style={{ transformOrigin: `50% ${originY || window.scrollY + window.innerHeight / 2}px` }}
        className="overflow-clip lg:ps-[15.5rem]"
      >
        <div className="relative mx-auto w-full max-w-[70rem] px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-36 sm:px-6 lg:px-10 lg:pt-11 lg:pb-16">
          {/* The new page slides in while the old one slides away: no blank moment in between.
              (No initial={false} here: it would also switch off every entrance inside the first page.) */}
          <AnimatePresence mode="popLayout" custom={nav.dir}>
            <motion.div
              key={view}
              custom={nav.dir}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: spring.smooth, opacity: { duration: 0.14, ease: ease.out }, filter: { duration: 0.18 } }}
            >
              {/* During first-open setup the page waits, so its entrance plays as the setup closes. */}
              {profile.onboarded && <View />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
      <TabBar />
      <EditorSheet />
      <AnimatePresence>{!profile.onboarded && <Onboarding key="setup" />}</AnimatePresence>
      <ToastHost onDismiss={dismissToast} />
      <Intro skip={!profile.onboarded} />
    </div>
  )
}
