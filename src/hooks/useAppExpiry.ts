import { useEffect, useState } from 'react'
import { appExpiry } from '@/lib/appExpiry'

/** The installed app's expiry date (iPhone app only), read once at launch. */
export function useAppExpiry(): Date | undefined {
  const [expires, setExpires] = useState<Date>()
  useEffect(() => {
    appExpiry().then(setExpires, () => {})
  }, [])
  return expires
}
