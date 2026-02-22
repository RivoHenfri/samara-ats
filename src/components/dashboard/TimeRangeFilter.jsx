import { startOfWeek, startOfMonth, subDays, startOfQuarter } from 'date-fns'

const PRESETS = [
  { label: 'This Week',    calc: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: new Date() }) },
  { label: 'This Month',   calc: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
  { label: 'Last 30 Days', calc: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { label: 'This Quarter', calc: () => ({ start: startOfQuarter(new Date()), end: new Date() }) },
]

export default function TimeRangeFilter({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {PRESETS.map(p => (
        <button
          key={p.label}
          onClick={() => onChange({ ...p.calc(), label: p.label })}
          className={`btn btn-sm ${value.label === p.label ? 'btn-primary' : 'btn-ghost'}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

/** Returns the default date range (Last 30 Days) */
export function getDefaultDateRange() {
  return { start: subDays(new Date(), 30), end: new Date(), label: 'Last 30 Days' }
}
