import { describe, expect, it } from 'vitest'
import { createScreenWakeLock } from './screen-wake-lock.ts'
import type { WakeLockEnvironment, WakeLockHandle } from './screen-wake-lock.ts'

type FakeEnvironment = WakeLockEnvironment & {
  requestCount: () => number
  releaseCount: () => number
  setVisible: (visible: boolean) => void
  dropLocks: () => void
  listenerCount: () => number
}

function fakeEnvironment(options: { supported?: boolean; rejects?: boolean } = {}): FakeEnvironment {
  let visible = true
  let requests = 0
  let releases = 0
  const listeners = new Set<() => void>()
  const handles: (WakeLockHandle & { released: boolean })[] = []
  return {
    request:
      options.supported === false
        ? null
        : async () => {
            requests += 1
            if (options.rejects) {
              throw new Error('거부됨')
            }
            const handle = {
              released: false,
              release: async () => {
                handle.released = true
                releases += 1
              },
            }
            handles.push(handle)
            return handle
          },
    isVisible: () => visible,
    onVisibilityChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    requestCount: () => requests,
    releaseCount: () => releases,
    setVisible: (next) => {
      visible = next
      listeners.forEach((listener) => listener())
    },
    dropLocks: () => handles.forEach((handle) => (handle.released = true)),
    listenerCount: () => listeners.size,
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createScreenWakeLock', () => {
  it('requests a lock on start and releases it on stop', async () => {
    const environment = fakeEnvironment()
    const lock = createScreenWakeLock(environment)
    lock.start()
    await settle()
    expect(environment.requestCount()).toBe(1)
    lock.stop()
    await settle()
    expect(environment.releaseCount()).toBe(1)
    expect(environment.listenerCount()).toBe(0)
  })

  it('requests again when the page becomes visible after the browser dropped the lock', async () => {
    const environment = fakeEnvironment()
    const lock = createScreenWakeLock(environment)
    lock.start()
    await settle()
    environment.setVisible(false)
    environment.dropLocks()
    await settle()
    expect(environment.requestCount()).toBe(1)
    environment.setVisible(true)
    await settle()
    expect(environment.requestCount()).toBe(2)
    lock.stop()
  })

  it('does not request twice while the current lock is still held', async () => {
    const environment = fakeEnvironment()
    const lock = createScreenWakeLock(environment)
    lock.start()
    await settle()
    environment.setVisible(true)
    await settle()
    expect(environment.requestCount()).toBe(1)
    lock.stop()
  })

  it('releases a lock that arrives after stop', async () => {
    const environment = fakeEnvironment()
    const lock = createScreenWakeLock(environment)
    lock.start()
    lock.stop()
    await settle()
    expect(environment.requestCount()).toBe(1)
    expect(environment.releaseCount()).toBe(1)
  })

  it('waits for visibility before the first request', async () => {
    const environment = fakeEnvironment()
    environment.setVisible(false)
    const lock = createScreenWakeLock(environment)
    lock.start()
    await settle()
    expect(environment.requestCount()).toBe(0)
    environment.setVisible(true)
    await settle()
    expect(environment.requestCount()).toBe(1)
    lock.stop()
  })

  it('does nothing when the API is missing', async () => {
    const environment = fakeEnvironment({ supported: false })
    const lock = createScreenWakeLock(environment)
    expect(() => lock.start()).not.toThrow()
    await settle()
    expect(() => lock.stop()).not.toThrow()
  })

  it('ignores a rejected request', async () => {
    const environment = fakeEnvironment({ rejects: true })
    const lock = createScreenWakeLock(environment)
    lock.start()
    await settle()
    expect(environment.requestCount()).toBe(1)
    expect(() => lock.stop()).not.toThrow()
  })
})
