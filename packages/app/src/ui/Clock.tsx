import { useEffect, useState } from 'react'

const format = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Current time in the top-right corner, refreshed on every minute change. */
export function Clock() {
  const [time, setTime] = useState(format)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setTime(format())
      timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50)
    }
    tick()
    return () => clearTimeout(timer)
  }, [])
  return <div className="clock">{time}</div>
}
