export interface Friend {
  steamId: string
  name: string
  autoName?: string
  color: string
  addedAt: string
  lastError?: string
  lastFetchedAt?: string
  demo?: boolean
}

export type SnapshotSource = 'bayou' | 'manual' | 'demo'

export interface PlayerSnapshot {
  steamId: string
  capturedAt: string
  source: SnapshotSource
  mmr?: number
  kd?: number
  kda?: number
  kills?: number
  deaths?: number
  assists?: number
  bounty?: number
  banishes?: number
  playtimeMinutes?: number
  level?: number
  prestige?: number
  moneyExtracted?: number
  bountyTokens?: number
  ledgerSnapshotCount?: number
  lastStatChangeAt?: string
}

export type PollState = 'idle' | 'polling' | 'error'

export interface PollStatus {
  state: PollState
  message?: string
  lastPollAt?: string
  lastError?: string
}

export interface Settings {
  refreshMinutes: number
  autoRefresh: boolean
  mmrAlertThreshold: number
  lastPollAt?: string
  pollStatus?: PollStatus
}

export interface AppData {
  friends: Friend[]
  snapshots: PlayerSnapshot[]
  settings: Settings
}

export interface ManualSnapshotInput {
  mmr?: number | null
  kills?: number | null
  deaths?: number | null
  bounty?: number | null
  moneyExtracted?: number | null
  bountyTokens?: number | null
}

export interface FriendView {
  friend: Friend
  latest: PlayerSnapshot | null
  first: PlayerSnapshot | null
  count: number
  delta?: {
    mmr?: number
    kills?: number
    deaths?: number
    kd?: number
    bounty?: number
  }
}

export const PALETTE = [
  '#d7263d', // blood
  '#e2b585', // sand
  '#c1973e', // gold
  '#a66b3d', // rust
  '#6d8970', // sage
  '#5f8fc9', // river
  '#8a6bb5', // dusk violet
  '#9a4b13' // burnt orange
]

export const VALID_STEAM_ID = /^\d{15,17}$/
