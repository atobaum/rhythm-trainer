import { useEffect } from 'react'
import { browserWakeLockEnvironment, createScreenWakeLock } from './screen-wake-lock.ts'

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return
    }
    const lock = createScreenWakeLock(browserWakeLockEnvironment())
    lock.start()
    return () => lock.stop()
  }, [active])
}
