import { hashString, mulberry32 } from './hash'

export interface ScatterAt {
  x: number
  z: number
  y?: number
}

export interface ScatterOptions {
  /** Fraction of items to keep, rounded to the nearest whole count. */
  share: number
  /** Hard ceiling — apples stay a handful even on a large QR crown. */
  max?: number
  /** Preferred centre-to-centre gap in the XZ plane. */
  minDist: number
  /** Closest the relax passes may go. */
  minFloor?: number
  /** Angular bins around the origin. */
  sectors?: number
  /** Height bins when items carry `y`. Ignored otherwise. */
  bands?: number
}

export const FRUIT_ORNAMENT_COUNT = 36
export const FRUIT_ORNAMENT_GAP = 1.8

function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = items[i]!
    items[i] = items[j]!
    items[j] = tmp
  }
  return items
}

function binOf(
  x: number,
  z: number,
  y: number | undefined,
  sectors: number,
  bands: number,
  yLo: number,
  yHi: number,
): number {
  let angle = Math.atan2(z, x)
  if (angle < 0) angle += Math.PI * 2
  const sector = Math.min(sectors - 1, Math.floor((angle / (Math.PI * 2)) * sectors))
  if (bands <= 1 || y === undefined) return sector
  const t = yHi <= yLo ? 0.5 : (y - yLo) / (yHi - yLo)
  const band = Math.min(bands - 1, Math.floor(Math.min(0.999, Math.max(0, t)) * bands))
  return band * sectors + sector
}

/**
 * Keep about `share` of `items`, spaced in XZ and drawn evenly from every
 * angular sector (and height band). Independent coin-flips clump; this does
 * not.
 */
export function scatterEven<T>(
  items: readonly T[],
  at: (item: T) => ScatterAt,
  rng: () => number,
  options: ScatterOptions,
): T[] {
  if (items.length === 0) return []
  const sectors = options.sectors ?? 6
  const wantBands = options.bands ?? 1
  const raw = Math.round(items.length * options.share)
  const target = Math.max(
    1,
    Math.min(items.length, options.max === undefined ? raw : Math.min(options.max, raw)),
  )
  const coords = items.map(at)
  const heights = coords.map((point) => point.y).filter((value): value is number => value !== undefined)
  const bands = heights.length > 0 ? wantBands : 1
  const yLo = heights.length > 0 ? Math.min(...heights) : 0
  const yHi = heights.length > 0 ? Math.max(...heights) : 0
  const bins = Array.from({ length: sectors * bands }, () => [] as T[])
  items.forEach((item, index) => {
    const point = coords[index]!
    bins[binOf(point.x, point.z, point.y, sectors, bands, yLo, yHi)]!.push(item)
  })
  for (const bin of bins) shuffleInPlace(bin, rng)

  const quota = bins.map((bin) => Math.round(target * (bin.length / items.length)))
  let drift = target - quota.reduce((sum, value) => sum + value, 0)
  const order = shuffleInPlace(
    bins.map((_, index) => index),
    rng,
  )
  for (let step = 0; drift !== 0 && step < bins.length * 4; step++) {
    const index = order[step % order.length]!
    if (drift > 0 && quota[index]! < bins[index]!.length) {
      quota[index]! += 1
      drift -= 1
    } else if (drift < 0 && quota[index]! > 0) {
      quota[index]! -= 1
      drift += 1
    }
  }

  const picked: T[] = []
  const taken = new Set<T>()
  const pickedAt: ScatterAt[] = []
  const pickedFrom = bins.map(() => 0)
  const floor = options.minFloor ?? 0
  const farEnough = (item: T, dist: number) => {
    const point = at(item)
    return pickedAt.every((other) => (point.x - other.x) ** 2 + (point.z - other.z) ** 2 >= dist * dist)
  }
  const pass = (dist: number) => {
    const gap = Math.max(dist, floor)
    for (let index = 0; index < bins.length; index++) {
      for (const item of bins[index]!) {
        if (pickedFrom[index]! >= quota[index]!) break
        if (taken.has(item) || !farEnough(item, gap)) continue
        taken.add(item)
        picked.push(item)
        pickedAt.push(at(item))
        pickedFrom[index]! += 1
      }
    }
  }
  pass(options.minDist)
  if (picked.length < target) pass(options.minDist * 0.72)
  if (picked.length < target) pass(floor)
  return picked
}

/**
 * Shuffle `items` and keep `count` of them, rejecting a candidate only when
 * it sits closer than `minDist` (then `minFloor`) to one already kept.
 * The result is random, not sector-even — two trees with different crowns
 * hang fruit in different places.
 */
export function scatterRandom<T>(
  items: readonly T[],
  at: (item: T) => ScatterAt,
  rng: () => number,
  options: { count: number; minDist: number; minFloor?: number },
): T[] {
  if (items.length === 0) return []
  const target = Math.max(1, Math.min(items.length, options.count))
  const pool = shuffleInPlace(items.slice(), rng)
  const picked: T[] = []
  const taken = new Set<T>()
  const pickedAt: ScatterAt[] = []
  const floor = options.minFloor ?? 0
  const farEnough = (item: T, dist: number) => {
    const point = at(item)
    return pickedAt.every((other) => (point.x - other.x) ** 2 + (point.z - other.z) ** 2 >= dist * dist)
  }
  const pass = (dist: number) => {
    const gap = Math.max(dist, floor)
    for (const item of pool) {
      if (picked.length >= target) return
      if (taken.has(item) || !farEnough(item, gap)) continue
      taken.add(item)
      picked.push(item)
      pickedAt.push(at(item))
    }
  }
  pass(options.minDist)
  if (picked.length < target) pass(options.minDist * 0.72)
  if (picked.length < target) pass(floor)
  if (picked.length < target) {
    for (const item of pool) {
      if (picked.length >= target) break
      if (taken.has(item)) continue
      taken.add(item)
      picked.push(item)
    }
  }
  return picked
}


export interface FruitHost {
  position: [number, number, number]
  euler: [number, number, number]
  scale: number
  ink: number
}

/** One mid-height, outward filler per module — the apple hangs from that leaf. */
export function onePerModule<T extends FruitHost>(filler: readonly T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const leaf of filler) {
    const key = `${Math.round(leaf.position[0])},${Math.round(leaf.position[2])}`
    const group = groups.get(key)
    if (group) group.push(leaf)
    else groups.set(key, [leaf])
  }
  const hosts: T[] = []
  for (const group of groups.values()) {
    const lo = Math.min(...group.map((leaf) => leaf.position[1]))
    const hi = Math.max(...group.map((leaf) => leaf.position[1]))
    const mid = (lo + hi) / 2
    let best = group[0]!
    let score = Infinity
    for (const leaf of group) {
      const radius = Math.hypot(leaf.position[0], leaf.position[2])
      const next = Math.abs(leaf.position[1] - mid) - radius * 0.15
      if (next < score) {
        score = next
        best = leaf
      }
    }
    hosts.push(best)
  }
  return hosts
}

function rngFromHosts(hosts: readonly FruitHost[]): () => number {
  let seed = hosts.length * 2654435761
  for (const leaf of hosts) {
    seed = Math.imul(seed ^ (Math.floor(leaf.position[0] * 1000 + 500_000) | 0), 16777619)
    seed = Math.imul(seed ^ (Math.floor(leaf.position[2] * 1000 + 500_000) | 0), 16777619)
    seed = Math.imul(seed ^ (Math.floor(leaf.position[1] * 1000 + 500_000) | 0), 16777619)
  }
  return mulberry32(hashString(`${seed >>> 0}`))
}

/**
 * Hanging apples: a fixed count, one per chosen module, shuffled across the
 * crown. Fruit-module columns and a 14 % coin-flip on every filler both
 * painted the tree red; this hangs thirty-six single fruits instead.
 */
export function pickFruitOrnaments<T extends FruitHost>(filler: readonly T[]): T[] {
  const hosts = onePerModule(filler)
  return scatterRandom(hosts, (leaf) => ({ x: leaf.position[0], z: leaf.position[2], y: leaf.position[1] }), rngFromHosts(hosts), {
    count: FRUIT_ORNAMENT_COUNT,
    minDist: FRUIT_ORNAMENT_GAP,
    minFloor: 1.2,
  })
}
