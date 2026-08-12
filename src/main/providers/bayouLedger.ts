import type { PlayerSnapshot } from '../../shared/types'
import type { ProviderFetchResult, StatsProvider } from './types'

const BASE_URL = 'https://bayouledger.com'
const USER_AGENT = 'BayouBoard/0.1 (personal Hunt: Showdown stats tracker)'
const TIMEOUT_MS = 15000

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Resolves SvelteKit's `__data.json` serialization. In that format every plain
 * object in the `data` array is a "template": its integer values are indices
 * into the same `data` array. Negative indices mean `undefined`. Date markers
 * are encoded as `["Date", "..."]`.
 */
function resolveIndex(data: unknown[], idx: number): unknown {
  if (idx < 0) return undefined
  const el = data[idx]
  if (isPlainObject(el)) {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(el)) {
      out[key] = typeof value === 'number' && Number.isInteger(value) ? resolveIndex(data, value) : value
    }
    return out
  }
  if (Array.isArray(el)) {
    if (el[0] === 'Date') return el[1]
    return el.map((item) => item)
  }
  return el
}

interface LedgerPlayer {
  steam_id?: string
  name?: string
  skill_rating?: number
  skill_variance?: number
  clash_skill_rating?: number
  rank?: number
  prestige?: number
  player_kills?: number
  killed_by_player?: number
  player_kill_assists?: number
  kd_ratio?: number
  kda_ratio?: number
  total_bounty?: number
  targets_banished?: number
  hunt_playtime_minutes?: number
  last_stat_change_at?: unknown
  last_change_at?: unknown
}

interface LedgerNode {
  steamId?: string
  subjectName?: string
  player?: LedgerPlayer | null
  snapshotCount?: number
  lastSnapshotAt?: unknown
  firstSnapshotAt?: unknown
  historyGated?: boolean
}

function toIso(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }
  return undefined
}

function buildSnapshot(steamId: string, node: LedgerNode, capturedAt: string): PlayerSnapshot {
  const p = node.player
  const mmr = typeof p?.skill_rating === 'number' ? Math.round(p.skill_rating * 100) : undefined
  return {
    steamId,
    capturedAt,
    source: 'bayou',
    mmr,
    kd: p?.kd_ratio,
    kda: p?.kda_ratio,
    kills: p?.player_kills,
    deaths: p?.killed_by_player,
    assists: p?.player_kill_assists,
    bounty: p?.total_bounty,
    banishes: p?.targets_banished,
    playtimeMinutes: p?.hunt_playtime_minutes,
    level: p?.rank,
    prestige: p?.prestige,
    ledgerSnapshotCount: node.snapshotCount,
    lastStatChangeAt: toIso(p?.last_stat_change_at)
  }
}

async function fetchLedgerNode(steamId: string): Promise<LedgerNode> {
  const url = `${BASE_URL}/p/${steamId}/__data.json`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  if (!res.ok) {
    throw new Error(`Bayou Ledger returned HTTP ${res.status}`)
  }
  const text = await res.text()
  let doc: { nodes?: { data?: unknown[] }[] }
  try {
    doc = JSON.parse(text) as { nodes?: { data?: unknown[] }[] }
  } catch {
    throw new Error('Bayou Ledger returned data we could not parse')
  }
  const nodes = doc?.nodes
  if (!Array.isArray(nodes) || nodes.length < 2) {
    throw new Error('Bayou Ledger returned an unexpected page')
  }
  const node = nodes[1]
  if (!node || !Array.isArray(node.data) || node.data.length === 0) {
    throw new Error('Bayou Ledger returned an unexpected page')
  }
  const resolved = resolveIndex(node.data, 0)
  if (!isPlainObject(resolved)) {
    throw new Error('Bayou Ledger returned an unexpected page')
  }
  return resolved as unknown as LedgerNode
}

const bayouLedgerProvider: StatsProvider = {
  id: 'bayouLedger',
  label: 'The Bayou Ledger (public profile pages)',

  async fetchPlayer(steamId: string): Promise<ProviderFetchResult> {
    try {
      const node = await fetchLedgerNode(steamId)
      if (!node.player) {
        return {
          ok: true,
          found: false,
          error: 'Not tracked on the Bayou Ledger yet (stats hidden or not on the rolls).'
        }
      }
      const capturedAt = new Date().toISOString()
      const snapshot = buildSnapshot(steamId, node, capturedAt)
      return {
        ok: true,
        found: true,
        snapshot,
        autoName: node.subjectName || node.player?.name
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, found: false, error: message }
    }
  }
}

export default bayouLedgerProvider
