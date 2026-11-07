import { useEffect, useRef } from 'react'

// 첫 화면이 아닐 때 브라우저 기록을 한 칸 쌓아 두고, 뒤로가기를 누르면 앱을 떠나지 않고 첫 화면으로 돌아온다.
export function useBackToHome(atHome: boolean, goHome: () => void): void {
  const pushedRef = useRef(false)
  const goHomeRef = useRef(goHome)

  useEffect(() => {
    goHomeRef.current = goHome
  })

  useEffect(() => {
    if (!atHome && !pushedRef.current) {
      window.history.pushState({ rhythmLab: 'screen' }, '')
      pushedRef.current = true
    } else if (atHome && pushedRef.current) {
      pushedRef.current = false
      window.history.back()
    }
  }, [atHome])

  useEffect(() => {
    const handlePop = () => {
      if (pushedRef.current) {
        pushedRef.current = false
        goHomeRef.current()
      }
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])
}
