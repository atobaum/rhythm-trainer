export function localDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function previousDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return localDay(new Date(year, month - 1, date - 1))
}

// 오늘 아직 연습하지 않았어도 어제까지 이어졌으면 연속 기록은 살아 있다.
export function practiceStreak(practicedDays: string[], today: Date): number {
  const days = new Set(practicedDays)
  let cursor = localDay(today)
  if (!days.has(cursor)) {
    cursor = previousDay(cursor)
  }
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = previousDay(cursor)
  }
  return streak
}
