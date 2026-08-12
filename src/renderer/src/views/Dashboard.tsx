import { useState } from 'react'
import type { AppData, PlayerSnapshot } from '@shared/types'
import MultiLineChart, { type Series } from '../components/MultiLineChart'
import { fmt, valuePoints } from '../utils'
import { friendViews } from '../friendViews'
import huntLogo from '../assets/hunt-logo.png'

interface Props {
  data: AppData
  onRefresh: () => void
  onOpen: (steamId: string) => void
  onGoAdd: () => void
}

type Metric = 'mmr' | 'kd' | 'kda' | 'kills' | 'deaths' | 'bounty'

const METRICS: { id: Metric; label: string; digits: number; pick: (s: PlayerSnapshot) => number | undefined }[] = [
  { id: 'mmr', label: 'MMR', digits: 0, pick: (s) => s.mmr },
  { id: 'kd', label: 'KD', digits: 2, pick: (s) => s.kd },
  { id: 'kda', label: 'KDA', digits: 2, pick: (s) => s.kda },
  { id: 'kills', label: 'Kills', digits: 0, pick: (s) => s.kills },
  { id: 'deaths', label: 'Deaths', digits: 0, pick: (s) => s.deaths },
  { id: 'bounty', label: 'Bounty', digits: 0, pick: (s) => s.bounty }
]

type SortKey = 'mmr' | 'kd' | 'kda' | 'kills' | 'deaths' | 'bounty' | 'snaps'

const SORT_PICK: Record<SortKey, (v: { latest: PlayerSnapshot | null; count: number }) => number | undefined> = {
  mmr: (v) => v.latest?.mmr,
  kd: (v) => v.latest?.kd,
  kda: (v) => v.latest?.kda,
  kills: (v) => v.latest?.kills,
  deaths: (v) => v.latest?.deaths,
  bounty: (v) => v.latest?.bounty,
  snaps: (v) => v.count
}

function Delta({ value, digits = 0 }: { value: number | undefined; digits?: number }): React.ReactNode {
  if (value === undefined) return <span className="delta-flat">—</span>
  const sign = value > 0 ? '+' : ''
  const cls = value > 0 ? 'delta-up' : value < 0 ? 'delta-down' : 'delta-flat'
  return (
    <span className={cls}>
      {sign}
      {value.toFixed(digits)}
    </span>
  )
}

export default function Dashboard({ data, onRefresh, onOpen, onGoAdd }: Props): React.ReactNode {
  const views = friendViews(data)
  const [metric, setMetric] = useState<Metric>('mmr')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'mmr', dir: -1 })

  const metricDef = METRICS.find((m) => m.id === metric) as (typeof METRICS)[number]

  if (data.friends.length === 0) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-sub">Your squad's progression at a glance.</p>
          </div>
        </div>
        <div className="empty">
          <img src={huntLogo} alt="Hunt: Showdown" className="empty-logo" />
          <h2>No players on the board yet</h2>
          <p>Add your friends by Steam ID to start tracking their Hunt: Showdown stats.</p>
          <div className="actions">
            <button className="btn primary" onClick={onGoAdd}>
              Add players
            </button>
          </div>
        </div>
      </div>
    )
  }

  const toggleHidden = (steamId: string): void => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(steamId)) next.delete(steamId)
      else next.add(steamId)
      return next
    })
  }

  const visible = views.filter((v) => !hidden.has(v.friend.steamId))

  const series: Series[] = visible.map((v) => ({
    key: v.friend.steamId,
    name: v.friend.name,
    color: v.friend.color,
    points: valuePoints(
      data.snapshots.filter((s) => s.steamId === v.friend.steamId),
      metricDef.pick
    )
  }))

  const hasAny = series.some((s) => s.points.length > 0)

  if (!hasAny) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-sub">Your squad's progression at a glance.</p>
          </div>
          <button className="btn primary" onClick={onRefresh}>
            Refresh stats
          </button>
        </div>
        <div className="empty">
          <img src={huntLogo} alt="Hunt: Showdown" className="empty-logo" />
          <h2>No stats recorded yet</h2>
          <p>Press refresh to pull the latest numbers from the Bayou Ledger.</p>
          <div className="actions">
            <button className="btn primary" onClick={onRefresh}>
              Refresh stats
            </button>
          </div>
        </div>
      </div>
    )
  }

  const clickHeader = (key: SortKey): void => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: -1 }))
  }

  const sortedViews = (() => {
    const arr = [...views]
    if (sort.key) {
      const pick = SORT_PICK[sort.key]
      arr.sort((a, b) => {
        const av = pick(a)
        const bv = pick(b)
        if (av === undefined && bv === undefined) return 0
        if (av === undefined) return 1
        if (bv === undefined) return -1
        return (av - bv) * sort.dir
      })
    }
    return arr
  })()

  const sortArrow = (key: SortKey): string => (sort.key === key ? (sort.dir === -1 ? ' ↓' : ' ↑') : '')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            {views.length} {views.length === 1 ? 'friend' : 'friends'} · {data.snapshots.length} snapshots on file
          </p>
        </div>
        <button className="btn primary" onClick={onRefresh}>
          Refresh stats
        </button>
      </div>

      <div className="card">
        <div className="row-between">
          <h3>{metricDef.label} over time</h3>
          <div className="seg">
            {METRICS.map((m) => (
              <button key={m.id} className={metric === m.id ? 'active' : ''} onClick={() => setMetric(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {views.map((v) => {
            const isHidden = hidden.has(v.friend.steamId)
            return (
              <button
                key={v.friend.steamId}
                type="button"
                className={`chip legend${isHidden ? ' dim' : ''}`}
                style={{
                  background: isHidden ? undefined : `${v.friend.color}26`,
                  borderColor: isHidden ? undefined : `${v.friend.color}59`,
                  color: 'var(--text)',
                  cursor: 'pointer'
                }}
                onClick={() => toggleHidden(v.friend.steamId)}
                title={isHidden ? 'Show on chart' : 'Hide from chart'}
              >
                <span style={{ width: 8, height: 8, borderRadius: 50, background: v.friend.color }} />
                {v.friend.name}
              </button>
            )
          })}
        </div>
        <MultiLineChart
          series={series}
          format={(n) => n.toLocaleString(undefined, { maximumFractionDigits: metricDef.digits, minimumFractionDigits: metricDef.digits })}
        />
      </div>

      <div className="card section">
        <h3>Squad board</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Player</th>
                <th className="num sortable" onClick={() => clickHeader('mmr')}>
                  MMR{sortArrow('mmr')}
                </th>
                <th className="num">Δ MMR</th>
                <th className="num sortable" onClick={() => clickHeader('kd')}>
                  KD{sortArrow('kd')}
                </th>
                <th className="num">Δ KD</th>
                <th className="num sortable" onClick={() => clickHeader('kda')}>
                  KDA{sortArrow('kda')}
                </th>
                <th className="num sortable" onClick={() => clickHeader('kills')}>
                  Kills{sortArrow('kills')}
                </th>
                <th className="num sortable" onClick={() => clickHeader('deaths')}>
                  Deaths{sortArrow('deaths')}
                </th>
                <th className="num sortable" onClick={() => clickHeader('bounty')}>
                  Bounty{sortArrow('bounty')}
                </th>
                <th className="num sortable" onClick={() => clickHeader('snaps')}>
                  Snaps{sortArrow('snaps')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedViews.map((v) => {
                const l = v.latest
                return (
                  <tr key={v.friend.steamId} className="clickable" onClick={() => onOpen(v.friend.steamId)}>
                    <td>
                      <span className="name-cell">
                        <span className="friend-dot" style={{ background: v.friend.color }} />
                        {v.friend.name}
                        {v.friend.demo && <span className="chip demo">demo</span>}
                      </span>
                    </td>
                    <td className="num">{fmt(l?.mmr)}</td>
                    <td className="num">
                      <Delta value={v.delta?.mmr} />
                    </td>
                    <td className="num">{fmt(l?.kd, 2)}</td>
                    <td className="num">
                      <Delta value={v.delta?.kd} digits={2} />
                    </td>
                    <td className="num">{fmt(l?.kda, 2)}</td>
                    <td className="num">{fmt(l?.kills)}</td>
                    <td className="num">{fmt(l?.deaths)}</td>
                    <td className="num">{fmt(l?.bounty)}</td>
                    <td className="num">{v.count}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
