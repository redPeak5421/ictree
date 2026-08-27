/**
 * Space colonization (Runions et al. 2007): grow a branch graph toward a cloud
 * of attraction points until every point has a branch tip within `kill` of it.
 *
 * Every attractor ends up anchored to a node, which is the property the canopy
 * needs: a leaf cluster placed around its anchor is, by construction, sitting on
 * the end of a twig — nothing floats.
 */
export interface Point {
  x: number
  y: number
  z: number
}

export interface ColonizeNode extends Point {
  /** Index into the node list; -1 for the root. */
  parent: number
  depth: number
}

export interface ColonizeParams {
  /** Attractors farther than this from every node do not steer growth. */
  influence: number
  /** An attractor this close to a node is reached and removed. */
  kill: number
  /** Length of each new segment. */
  step: number
  maxIterations: number
  /** Random perturbation added to growth direction, in step units. */
  jitter: number
}

export interface Colony {
  nodes: ColonizeNode[]
  /** attractor index -> node index that reached it. */
  anchors: number[]
}

export function colonize(
  seeds: ColonizeNode[],
  attractors: Point[],
  params: ColonizeParams,
  rng: () => number,
): Colony {
  const nodes = seeds.slice()
  const n = attractors.length
  const nearest = new Int32Array(n).fill(-1)
  const nearestD = new Float64Array(n).fill(Infinity)
  const alive = new Uint8Array(n).fill(1)
  const anchors = new Array<number>(n).fill(-1)

  // Nodes are only ever appended, so an attractor's nearest node can only get
  // closer: each iteration needs to look at the nodes added since the last one.
  const consider = (a: number, from: number, to: number) => {
    const p = attractors[a]!
    let best = nearestD[a]!
    let bi = nearest[a]!
    for (let j = from; j < to; j++) {
      const q = nodes[j]!
      const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z)
      if (d < best) {
        best = d
        bi = j
      }
    }
    nearestD[a] = best
    nearest[a] = bi
  }
  for (let a = 0; a < n; a++) consider(a, 0, nodes.length)

  const growFrom = (ni: number, dx: number, dy: number, dz: number) => {
    const len = Math.hypot(dx, dy, dz)
    if (len < 1e-4) return false
    const q = nodes[ni]!
    nodes.push({
      x: q.x + (dx / len) * params.step,
      y: q.y + (dy / len) * params.step,
      z: q.z + (dz / len) * params.step,
      parent: ni,
      depth: q.depth + 1,
    })
    return true
  }

  let from = 0
  for (let iter = 0; iter < params.maxIterations; iter++) {
    const to = nodes.length
    if (iter > 0) for (let a = 0; a < n; a++) if (alive[a]) consider(a, from, to)

    const acc = new Map<number, [number, number, number, number]>()
    let remaining = 0
    for (let a = 0; a < n; a++) {
      if (!alive[a]) continue
      const d = nearestD[a]!
      const ni = nearest[a]!
      if (d < params.kill) {
        alive[a] = 0
        anchors[a] = ni
        continue
      }
      remaining++
      if (d > params.influence) continue
      const p = attractors[a]!
      const q = nodes[ni]!
      let e = acc.get(ni)
      if (!e) {
        e = [0, 0, 0, 0]
        acc.set(ni, e)
      }
      e[0] += (p.x - q.x) / d
      e[1] += (p.y - q.y) / d
      e[2] += (p.z - q.z) / d
      e[3]++
    }
    if (remaining === 0) break

    from = nodes.length
    let grew = false
    for (const [ni, e] of acc) {
      const j = params.jitter
      if (
        growFrom(
          ni,
          e[0] / e[3] + (rng() - 0.5) * j,
          e[1] / e[3] + (rng() - 0.5) * j,
          e[2] / e[3] + (rng() - 0.5) * j,
        )
      )
        grew = true
    }
    if (!grew) {
      // Nothing left inside the influence radius: reach for the stragglers.
      for (let a = 0; a < n; a++) {
        if (!alive[a]) continue
        const p = attractors[a]!
        const q = nodes[nearest[a]!]!
        growFrom(nearest[a]!, p.x - q.x, p.y - q.y, p.z - q.z)
      }
    }
  }

  // Anything still unreached gets a direct chain so the guarantee holds.
  for (let a = 0; a < n; a++) {
    if (!alive[a]) continue
    consider(a, from, nodes.length)
    let ni = nearest[a]!
    const p = attractors[a]!
    for (let guard = 0; guard < 64; guard++) {
      const q = nodes[ni]!
      if (Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < params.kill) break
      if (!growFrom(ni, p.x - q.x, p.y - q.y, p.z - q.z)) break
      ni = nodes.length - 1
    }
    anchors[a] = ni
    alive[a] = 0
  }

  return { nodes, anchors }
}
