import type { PlayerSnapshot } from '@shared/types'

export function fmt(n: number | undefined | null, digits = 0): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—'
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  })
}

export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function sortSnapshots(snaps: PlayerSnapshot[]): PlayerSnapshot[] {
  return [...snaps].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
}

export function snapshotsFor(snaps: PlayerSnapshot[], steamId: string): PlayerSnapshot[] {
  return sortSnapshots(snaps.filter((s) => s.steamId === steamId))
}

export interface SeriesInput {
  key: string
  points: { t: string; v: number | undefined }[]
}

/**
 * Merges several time series onto a shared set of dates (x axis), carrying
 * each friend's last known value forward so curves stay continuous even when
 * players update at different times.
 */
export function mergeSeries(series: SeriesInput[]): { date: string; [key: string]: unknown }[] {
  const dates = new Set<string>()
  series.forEach((s) => s.points.forEach((p) => dates.add(p.t)))
  const sorted = [...dates].sort()
  return sorted.map((t) => {
    const row: { date: string; [key: string]: unknown } = { date: t }
    series.forEach((s) => {
      let last: number | undefined
      for (const p of s.points) {
        if (p.t <= t && p.v !== undefined) last = p.v
        if (p.t === t) break
      }
      row[s.key] = last
    })
    return row
  })
}

export function mmrPoints(snaps: PlayerSnapshot[]): { t: string; v: number | undefined }[] {
  return snaps.map((s) => ({ t: s.capturedAt, v: s.mmr }))
}

export function valuePoints(snaps: PlayerSnapshot[], pick: (s: PlayerSnapshot) => number | undefined): { t: string; v: number | undefined }[] {
  return snaps.map((s) => ({ t: s.capturedAt, v: pick(s) }))
}

export function delta(a: PlayerSnapshot | null, b: PlayerSnapshot | null, pick: (s: PlayerSnapshot) => number | undefined): number | undefined {
  if (!a || !b) return undefined
  const x = pick(a)
  const y = pick(b)
  if (x === undefined || y === undefined) return undefined
  return y - x
}
