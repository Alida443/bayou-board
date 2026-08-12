import type { AppData, FriendView } from '@shared/types'
import { snapshotsFor } from './utils'

export function friendViews(data: AppData): FriendView[] {
  return data.friends.map((friend) => {
    const snaps = snapshotsFor(data.snapshots, friend.steamId)
    const latest = snaps[snaps.length - 1] ?? null
    const first = snaps[0] ?? null

    const diff = (pick: (s: NonNullable<FriendView['latest']>) => number | undefined): number | undefined => {
      if (!latest || !first) return undefined
      const a = pick(latest)
      const b = pick(first)
      if (a === undefined || b === undefined) return undefined
      return a - b
    }

    return {
      friend,
      latest,
      first,
      count: snaps.length,
      delta: {
        mmr: diff((s) => s.mmr),
        kills: diff((s) => s.kills),
        deaths: diff((s) => s.deaths),
        kd: diff((s) => s.kd),
        bounty: diff((s) => s.bounty)
      }
    }
  })
}
