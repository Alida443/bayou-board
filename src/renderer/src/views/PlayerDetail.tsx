import { useMemo, useState } from 'react'
import type { AppData, ManualSnapshotInput } from '@shared/types'
import StatChart from '../components/StatChart'
import { fmt, fmtDateTime, snapshotsFor, valuePoints } from '../utils'

interface Props {
  data: AppData
  steamId: string
  onBack: () => void
}

type Metric = 'mmr' | 'kd' | 'kills' | 'deaths' | 'bounty'

const METRICS: { id: Metric; label: string; pick: (s: { mmr?: number; kd?: number; kills?: number; deaths?: number; bounty?: number }) => number | undefined; digits: number }[] = [
  { id: 'mmr', label: 'MMR', pick: (s) => s.mmr, digits: 0 },
  { id: 'kd', label: 'KD', pick: (s) => s.kd, digits: 2 },
  { id: 'kills', label: 'Kills', pick: (s) => s.kills, digits: 0 },
  { id: 'deaths', label: 'Deaths', pick: (s) => s.deaths, digits: 0 },
  { id: 'bounty', label: 'Bounty', pick: (s) => s.bounty, digits: 0 }
]

interface StatInput {
  mmr?: string
  kills?: string
  deaths?: string
  bounty?: string
  moneyExtracted?: string
  bountyTokens?: string
}

export default function PlayerDetail({ data, steamId, onBack }: Props): React.ReactNode {
  const friend = data.friends.find((f) => f.steamId === steamId)
  const snaps = useMemo(() => snapshotsFor(data.snapshots, steamId), [data.snapshots, steamId])
  const [metric, setMetric] = useState<Metric>('mmr')
  const [form, setForm] = useState<StatInput>({})
  const [formMsg, setFormMsg] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')

  if (!friend) {
    return (
      <div className="empty">
        <h2>Player not found</h2>
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
      </div>
    )
  }

  const latest = snaps[snaps.length - 1] ?? null
  const first = snaps[0] ?? null
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const weekSnap = snaps.find((s) => new Date(s.capturedAt).getTime() >= weekAgo) ?? null

  const commitRename = async (): Promise<void> => {
    const trimmed = renameDraft.trim()
    if (trimmed) await window.api.renameFriend(steamId, trimmed)
    setRenaming(false)
  }

  const toNum = (s: string | undefined): number | undefined => {
    if (s === undefined || s.trim() === '') return undefined
    const n = Number(s)
    return Number.isFinite(n) ? n : undefined
  }

  const submitManual = async (): Promise<void> => {
    setFormMsg(null)
    const input: ManualSnapshotInput = {
      mmr: toNum(form.mmr),
      kills: toNum(form.kills),
      deaths: toNum(form.deaths),
      bounty: toNum(form.bounty),
      moneyExtracted: toNum(form.moneyExtracted),
      bountyTokens: toNum(form.bountyTokens)
    }
    if (
      input.mmr === undefined &&
      input.kills === undefined &&
      input.deaths === undefined &&
      input.bounty === undefined
    ) {
      setFormMsg('Enter at least one number.')
      return
    }
    const result = await window.api.addManualSnapshot(steamId, input)
    if (result.ok) {
      setForm({})
      setFormMsg('Snapshot added.')
    } else {
      setFormMsg(result.error ?? 'Could not add snapshot.')
    }
  }

  const clearHistory = async (): Promise<void> => {
    await window.api.clearFriendSnapshots(steamId)
  }

  const metricDef = METRICS.find((m) => m.id === metric) as (typeof METRICS)[number]

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="btn small ghost" onClick={onBack} style={{ marginBottom: 10 }}>
            ← Players
          </button>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 14, height: 14, borderRadius: 50, background: friend.color }} />
            {renaming ? (
              <input
                className="input"
                value={renameDraft}
                autoFocus
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename()
                  if (e.key === 'Escape') setRenaming(false)
                }}
              />
            ) : (
              friend.name
            )}
            {friend.demo && <span className="chip demo">demo</span>}
          </h1>
          <p className="page-sub mono">{friend.steamId}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!renaming && (
            <button
              className="btn small"
              onClick={() => {
                setRenameDraft(friend.name)
                setRenaming(true)
              }}
            >
              Rename
            </button>
          )}
          {!friend.demo && (
            <button className="btn" onClick={() => void window.api.refreshOne(steamId)}>
              Refresh
            </button>
          )}
          {!friend.demo && (
            <a className="btn ghost link" href={`https://bayouledger.com/p/${steamId}`} target="_blank" rel="noreferrer">
              Open on Ledger ↗
            </a>
          )}
        </div>
      </div>

      <div className="grid cards">
        <StatBlock label="MMR" value={fmt(latest?.mmr)} sub={deltaText(latest?.mmr, first?.mmr, weekSnap?.mmr, 0)} />
        <StatBlock label="KD" value={fmt(latest?.kd, 2)} sub={deltaText(latest?.kd, first?.kd, weekSnap?.kd, 2)} />
        <StatBlock label="KDA" value={fmt(latest?.kda, 2)} />
        <StatBlock label="Kills" value={fmt(latest?.kills)} sub={deltaText(latest?.kills, first?.kills, weekSnap?.kills, 0)} />
        <StatBlock label="Deaths" value={fmt(latest?.deaths)} sub={deltaText(latest?.deaths, first?.deaths, weekSnap?.deaths, 0)} />
        <StatBlock label="Assists" value={fmt(latest?.assists)} />
        <StatBlock label="Bounty" value={fmt(latest?.bounty)} sub={deltaText(latest?.bounty, first?.bounty, weekSnap?.bounty, 0)} />
        <StatBlock label="Banishes" value={fmt(latest?.banishes)} />
        {latest?.playtimeMinutes !== undefined && (
          <StatBlock label="Playtime" value={`${Math.round(latest.playtimeMinutes / 60)} h`} />
        )}
      </div>

      <div className="card section">
        <div className="row-between">
          <h3>Progression</h3>
          <div className="seg">
            {METRICS.map((m) => (
              <button key={m.id} className={metric === m.id ? 'active' : ''} onClick={() => setMetric(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <StatChart
          points={valuePoints(snaps, metricDef.pick)}
          color={friend.color}
          label={metricDef.label}
          format={(v) => v.toLocaleString(undefined, { maximumFractionDigits: metricDef.digits, minimumFractionDigits: metricDef.digits })}
        />
      </div>

      {!friend.demo && (
        <div className="card section">
          <h3>Add a manual snapshot</h3>
          <p className="hint" style={{ marginTop: 0 }}>
            Handy when a friend isn't on the Ledger yet, or to log per-match money / bounty tokens.
          </p>
          <div className="form-grid">
            <Field label="MMR" value={form.mmr ?? ''} onChange={(v) => setForm((f) => ({ ...f, mmr: v }))} />
            <Field label="Kills" value={form.kills ?? ''} onChange={(v) => setForm((f) => ({ ...f, kills: v }))} />
            <Field label="Deaths" value={form.deaths ?? ''} onChange={(v) => setForm((f) => ({ ...f, deaths: v }))} />
            <Field label="Total bounty" value={form.bounty ?? ''} onChange={(v) => setForm((f) => ({ ...f, bounty: v }))} />
            <Field label="Money extracted" value={form.moneyExtracted ?? ''} onChange={(v) => setForm((f) => ({ ...f, moneyExtracted: v }))} />
            <Field label="Bounty tokens" value={form.bountyTokens ?? ''} onChange={(v) => setForm((f) => ({ ...f, bountyTokens: v }))} />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn primary" onClick={() => void submitManual()}>
              Add snapshot
            </button>
            {formMsg && <span className="hint">{formMsg}</span>}
          </div>
        </div>
      )}

      <div className="card section">
        <div className="row-between">
          <h3>History ({snaps.length} snapshots)</h3>
          {snaps.length > 0 && (
            <button className="btn small danger" onClick={() => void clearHistory()}>
              Clear history
            </button>
          )}
        </div>
        {snaps.length === 0 ? (
          <p className="hint">No snapshots yet. Hit refresh or add a manual snapshot.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th className="num">MMR</th>
                  <th className="num">KD</th>
                  <th className="num">Kills</th>
                  <th className="num">Deaths</th>
                  <th className="num">Bounty</th>
                  {latest?.moneyExtracted !== undefined && <th className="num">Money</th>}
                  {latest?.bountyTokens !== undefined && <th className="num">Tokens</th>}
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {[...snaps].reverse().map((s, i) => (
                  <tr key={`${s.capturedAt}-${i}`}>
                    <td>{fmtDateTime(s.capturedAt)}</td>
                    <td className="num">{fmt(s.mmr)}</td>
                    <td className="num">{fmt(s.kd, 2)}</td>
                    <td className="num">{fmt(s.kills)}</td>
                    <td className="num">{fmt(s.deaths)}</td>
                    <td className="num">{fmt(s.bounty)}</td>
                    {latest?.moneyExtracted !== undefined && <td className="num">{fmt(s.moneyExtracted)}</td>}
                    {latest?.bountyTokens !== undefined && <td className="num">{fmt(s.bountyTokens)}</td>}
                    <td>{s.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatBlock({ label, value, sub }: { label: string; value: string; sub?: string }): React.ReactNode {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

function deltaText(
  latest: number | undefined,
  first: number | undefined,
  week: number | undefined,
  digits: number
): string | undefined {
  if (latest === undefined || first === undefined) return undefined
  const parts: string[] = []
  const d = latest - first
  if (d !== 0) parts.push(`${d > 0 ? '+' : ''}${d.toFixed(digits)} since first`)
  if (week !== undefined && week !== first) {
    const w = latest - week
    if (w !== 0) parts.push(`${w > 0 ? '+' : ''}${w.toFixed(digits)} last 7d`)
  }
  if (parts.length === 0) return 'no change since first snapshot'
  return parts.join(' · ')
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): React.ReactNode {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
