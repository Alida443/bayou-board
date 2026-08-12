import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { fmtDate } from '../utils'

interface Point {
  t: string
  v: number | undefined
}

interface TipProps {
  active?: boolean
  payload?: { value?: number | string }[]
  label?: string
  color: string
  format?: (v: number) => string
}

function Tip({ active, payload, label, color, format }: TipProps): React.ReactNode | null {
  if (!active || !payload || payload.length === 0) return null
  const raw = payload[0]?.value
  const value = typeof raw === 'number' ? (format ? format(raw) : raw.toLocaleString()) : raw
  return (
    <div
      style={{
        background: '#181a1d',
        border: '1px solid #34373c',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12
      }}
    >
      <div style={{ color: '#9aa1a8' }}>{fmtDate(label)}</div>
      <div style={{ color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

interface Props {
  points: Point[]
  color: string
  label: string
  format?: (v: number) => string
}

export default function StatChart({ points, color, label, format }: Props): React.ReactNode {
  const data = points.filter((p) => p.v !== undefined).map((p) => ({ t: p.t, v: p.v as number }))
  if (data.length === 0) {
    return <div className="hint" style={{ padding: 18 }}>No data yet.</div>
  }
  const gradId = `grad-${label.replace(/\W/g, '').toLowerCase()}`
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 14, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="t"
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
          <Tooltip content={<Tip color={color} format={format} />} />
          <Area
            type="monotone"
            dataKey="v"
            name={label}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
