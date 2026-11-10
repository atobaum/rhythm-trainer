export type AppArea = 'rhythm' | 'fretboard'

const AREAS: { value: AppArea; label: string }[] = [
  { value: 'rhythm', label: '리듬' },
  { value: 'fretboard', label: '지판' },
]

export default function AreaSwitch({ value, onChange }: { value: AppArea; onChange: (area: AppArea) => void }) {
  return (
    <nav className="tabs area-switch" aria-label="연습 종류">
      {AREAS.map((area) => (
        <button
          type="button"
          key={area.value}
          className={area.value === value ? 'tab tab-selected' : 'tab'}
          onClick={() => onChange(area.value)}
        >
          {area.label}
        </button>
      ))}
    </nav>
  )
}
