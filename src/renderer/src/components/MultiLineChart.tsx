import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { fmtDate, mergeSeries } from '../utils'

export interface Series {
  key: string
  name: string
  color: string
  points: { t: string; v: number | undefined }[]
}

interface TipProps {
  active?: boolean
  payload?: { dataKey?: string; value?: number | string }[]
  label?: string
  series: Series[]
  format?: (v: number) => string
}

function Tip({ active, payload, label, series, format }: TipProps): React.ReactNode | null {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      style={{
        background: '#181a1d',
        border: '1px solid #34373c',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
        minWidth: 150
      }}
    >
      <div style={{ color: '#9aa1a8', marginBottom: 4 }}>{fmtDate(label)}</div>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey)
        if (!s) return null
        const raw = p.value
        const value = typeof raw === 'number' ? (format ? format(raw) : raw.toLocaleString()) : raw
        return (
          <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, color: '#e4e6e8' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 50, background: s.color }} />
              {s.name}
            </span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</b>
          </div>
        )
      })}
    </div>
  )
}

interface Props {
  series: Series[]
  format?: (v: number) => string
}

export default function MultiLineChart({ series, format }: Props): React.ReactNode {
  const data = mergeSeries(series.map((s) => ({ key: s.key, points: s.points })))
  if (data.length === 0) {
    return <div className="hint" style={{ padding: 18 }}>No data yet.</div>
  }
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 14, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(t: string) => fmtDate(t)}
            stroke="#6b7278"
            tick={{ fontSize: 11 }}
            minTickGap={44}
            axisLine={{ stroke: '#34373c' }}
            tickLine={false}
          />
          <YAxis
            stroke="#6b7278"
            tick={{ fontSize: 11 }}
            width={54}
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => (format ? format(v) : String(v))}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<Tip series={series} format={format} />} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
