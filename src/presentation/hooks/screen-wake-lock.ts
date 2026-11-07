export type WakeLockHandle = {
  released: boolean
  release: () => Promise<void>
}

export type WakeLockEnvironment = {
  request: (() => Promise<WakeLockHandle>) | null
  isVisible: () => boolean
  onVisibilityChange: (listener: () => void) => () => void
}

export type ScreenWakeLock = {
  start: () => void
  stop: () => void
}

// 브라우저는 화면이 가려지면 잠금을 풀기 때문에 다시 보일 때마다 새로 요청한다.
export function createScreenWakeLock(environment: WakeLockEnvironment): ScreenWakeLock {
  let active = false
  let handle: WakeLockHandle | null = null
  let requesting = false
  let unsubscribe: (() => void) | null = null

  const releaseQuietly = (target: WakeLockHandle) => {
    target.release().catch(() => {})
  }

  const acquire = () => {
    const request = environment.request
    if (!request || !active || requesting || !environment.isVisible() || (handle !== null && !handle.released)) {
      return
    }
    requesting = true
    request()
      .then((acquired) => {
        if (active) {
          handle = acquired
        } else {
          releaseQuietly(acquired)
        }
      })
      .catch(() => {})
      .finally(() => {
        requesting = false
      })
  }

  return {
    start: () => {
      if (active) {
        return
      }
      active = true
      unsubscribe = environment.onVisibilityChange(acquire)
      acquire()
    },
    stop: () => {
      active = false
      unsubscribe?.()
      unsubscribe = null
      if (handle !== null) {
        releaseQuietly(handle)
        handle = null
      }
    },
  }
}

export function browserWakeLockEnvironment(): WakeLockEnvironment {
  const wakeLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator ? navigator.wakeLock : null
  return {
    request: wakeLock ? () => wakeLock.request('screen') : null,
    isVisible: () => document.visibilityState === 'visible',
    onVisibilityChange: (listener) => {
      document.addEventListener('visibilitychange', listener)
      return () => document.removeEventListener('visibilitychange', listener)
    },
  }
}
