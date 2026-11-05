import { MotionConfig } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardProvider } from '@/context/DashboardContext'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <DashboardProvider>
        <AppShell />
      </DashboardProvider>
    </MotionConfig>
  )
}
