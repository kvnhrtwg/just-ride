import { useEffect, useRef } from 'react'

export function useScreenWakeLock(isEnabled: boolean): void {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (
      !isEnabled ||
      typeof window === 'undefined' ||
      !('wakeLock' in navigator)
    ) {
      const wakeLock = wakeLockRef.current
      wakeLockRef.current = null
      if (wakeLock) {
        void wakeLock.release().catch(() => {})
      }
      return
    }

    let isDisposed = false

    const releaseWakeLock = async () => {
      const wakeLock = wakeLockRef.current
      wakeLockRef.current = null
      if (!wakeLock) {
        return
      }

      try {
        await wakeLock.release()
      } catch {
        // Ignore release failures. The browser may already have released it.
      }
    }

    const requestWakeLock = async () => {
      if (isDisposed || document.visibilityState !== 'visible') {
        return
      }
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        return
      }

      try {
        const wakeLock = await navigator.wakeLock.request('screen')
        if (isDisposed) {
          await wakeLock.release().catch(() => {})
          return
        }

        wakeLockRef.current = wakeLock
        wakeLock.addEventListener('release', () => {
          if (wakeLockRef.current === wakeLock) {
            wakeLockRef.current = null
          }

          if (
            !isDisposed &&
            isEnabled &&
            document.visibilityState === 'visible'
          ) {
            void requestWakeLock()
          }
        })
      } catch {
        // Unsupported browser, denied permission, or transient OS restriction.
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock()
        return
      }

      void releaseWakeLock()
    }

    void requestWakeLock()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isDisposed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void releaseWakeLock()
    }
  }, [isEnabled])
}
