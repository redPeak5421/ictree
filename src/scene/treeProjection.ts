import { Euler, Quaternion, Vector3 } from 'three'
import { toLumaHex } from '../qr/contrast'
import type { ModuleGrid } from '../qr/types'
import { silhouette, type Point2 } from './leafShape'
import { carpetOutline, vegetationOutline, type FinderCarpetInstance, type FinderVegetationInstance } from './grassLayout'
import { finderInkTones, foliageTones, hexRgb, type SceneColors } from './palettes'
import { type LeafInstance, type TreeRig } from './tree'

export interface ProjectionOptions {
  modulePx: number
  quiet: number
  colors: SceneColors
}

export interface TreeProjection {
  data: Uint8ClampedArray
  mask: Uint8Array
  width: number
  height: number
  modulePx: number
  quiet: number
}

export interface RasterImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface ProjectionStats {
  darkMean: number
  darkMin: number
  finderMean: number
  lightMean: number
  lightMax: number
  lightCentersClean: boolean
}

const rotation = new Quaternion()
const point = new Vector3()

type ProjectableLeaf = Pick<LeafInstance, 'position' | 'euler' | 'scale'> & { shape?: LeafInstance['shape'] }

/** Project the exact scaled/rotated/translated Three.js leaf plane into X/Z. */
export function projectLeafOutline(leaf: ProjectableLeaf): readonly Point2[] {
  rotation.setFromEuler(new Euler(leaf.euler[0], leaf.euler[1], leaf.euler[2], 'YXZ'))
  const shape = leaf.shape ?? 'ovate'
  return silhouette(shape).map(([x, y]) => {
    point.set(x * leaf.scale, y * leaf.scale, 0).applyQuaternion(rotation)
    return [point.x + leaf.position[0], point.z + leaf.position[2]] as const
  })
}

/** Same transform the finder-tuft renderer uses: root + lean/heading + width/height. */
export function projectVegetationOutline(item: FinderVegetationInstance): readonly Point2[] {
  const ux = Math.sin(item.lean) * Math.sin(item.heading)
  const uz = Math.sin(item.lean) * Math.cos(item.heading)
  const px = item.root[0] + (ux * item.height) / 2
  const pz = item.root[2] + (uz * item.height) / 2
  rotation.setFromEuler(new Euler(item.lean, item.heading, 0, 'YXZ'))
  return vegetationOutline(item.form).map(([x, y]) => {
    point.set(x * item.width, y * item.height, 0).applyQuaternion(rotation)
    return [point.x + px, point.z + pz] as const
  })
}

export function projectCarpetOutline(leaf: FinderCarpetInstance): readonly Point2[] {
  rotation.setFromEuler(new Euler(leaf.euler[0], leaf.euler[1], leaf.euler[2], 'YXZ'))
  return carpetOutline().map(([x, y]) => {
    point.set(x * leaf.scale, y * leaf.scale, 0).applyQuaternion(rotation)
    return [point.x + leaf.position[0], point.z + leaf.position[2]] as const
  })
}

function insidePolygon(x: number, y: number, polygon: readonly Point2[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!
    const [xj, yj] = polygon[j]!
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

function fillBackground(data: Uint8ClampedArray, rgb: readonly number[]) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0]!
    data[i + 1] = rgb[1]!
    data[i + 2] = rgb[2]!
    data[i + 3] = 255
  }
}

function paintPixel(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  x: number,
  y: number,
  rgb: readonly number[],
) {
  if (x < 0 || y < 0 || x >= width || y >= width) return
  const pixel = y * width + x
  const offset = pixel * 4
  data[offset] = rgb[0]!
  data[offset + 1] = rgb[1]!
  data[offset + 2] = rgb[2]!
  data[offset + 3] = 255
  mask[pixel] = 1
}

export function rasterTreeProjection(
  grid: ModuleGrid,
  rig: TreeRig,
  options: ProjectionOptions,
): TreeProjection {
  const width = (grid.size + options.quiet * 2) * options.modulePx
  const data = new Uint8ClampedArray(width * width * 4)
  const mask = new Uint8Array(width * width)
  fillBackground(data, hexRgb('#f2efe6'))
  const half = (grid.size - 1) / 2
  const toPixel = (value: number) => (value + half + options.quiet + 0.5) * options.modulePx

  const grassTones = finderInkTones(options.colors)
  const lift = options.colors.inkLift
  const paintPolygon = (world: readonly Point2[], rgb: readonly number[]) => {
    const polygon = world.map(([x, z]) => [toPixel(x), toPixel(z)] as const)
    const xs = polygon.map(([x]) => x)
    const ys = polygon.map(([, y]) => y)
    const left = Math.max(0, Math.floor(Math.min(...xs)))
    const right = Math.min(width - 1, Math.ceil(Math.max(...xs)))
    const top = Math.max(0, Math.floor(Math.min(...ys)))
    const bottom = Math.min(width - 1, Math.ceil(Math.max(...ys)))
    for (let py = top; py <= bottom; py++) {
      for (let px = left; px <= right; px++) {
        if (insidePolygon(px + 0.5, py + 0.5, polygon)) paintPixel(data, mask, width, px, py, rgb)
      }
    }
  }

  for (const leaf of rig.finderCarpet) {
    paintPolygon(projectCarpetOutline(leaf), hexRgb(toLumaHex(grassTones[leaf.tone]!, leaf.ink + lift)))
  }

  const tones = foliageTones(options.colors)
  for (const leaf of rig.leaves) {
    const world = projectLeafOutline(leaf)
    const polygon = world.map(([x, z]) => [toPixel(x), toPixel(z)] as const)
    const xs = polygon.map(([x]) => x)
    const ys = polygon.map(([, y]) => y)
    const left = Math.max(0, Math.floor(Math.min(...xs)))
    const right = Math.min(width - 1, Math.ceil(Math.max(...xs)))
    const top = Math.max(0, Math.floor(Math.min(...ys)))
    const bottom = Math.min(width - 1, Math.ceil(Math.max(...ys)))
    const rgb = hexRgb(toLumaHex(tones[leaf.tone]!, leaf.ink + lift))
    for (let py = top; py <= bottom; py++) {
      for (let px = left; px <= right; px++) {
        if (insidePolygon(px + 0.5, py + 0.5, polygon)) paintPixel(data, mask, width, px, py, rgb)
      }
    }
  }

  return { data, mask, width, height: width, modulePx: options.modulePx, quiet: options.quiet }
}

export function projectionStats(grid: ModuleGrid, projection: TreeProjection): ProjectionStats {
  const dark: number[] = []
  const finder: number[] = []
  const light: number[] = []
  let lightCentersClean = true
  const modulePx = projection.modulePx
  for (const cell of grid.cells) {
    const x0 = (projection.quiet + cell.x) * modulePx
    const y0 = (projection.quiet + cell.y) * modulePx
    let covered = 0
    let centerCovered = 0
    for (let py = 0; py < modulePx; py++) {
      for (let px = 0; px < modulePx; px++) {
        const ink = projection.mask[(y0 + py) * projection.width + x0 + px]!
        covered += ink
        if (px >= modulePx * 0.25 && px < modulePx * 0.75 && py >= modulePx * 0.25 && py < modulePx * 0.75) {
          centerCovered += ink
        }
      }
    }
    const ratio = covered / (modulePx * modulePx)
    if (cell.dark) {
      dark.push(ratio)
      if (cell.kind === 'finder') finder.push(ratio)
    } else {
      light.push(ratio)
      if (centerCovered > 0) lightCentersClean = false
    }
  }
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
  return {
    darkMean: mean(dark),
    darkMin: Math.min(...dark),
    finderMean: mean(finder),
    lightMean: mean(light),
    lightMax: Math.max(...light),
    lightCentersClean,
  }
}

/** Bilinear browser-like resampling for the resolution decode matrix. */
export function resampleProjection(source: TreeProjection, size: number): RasterImage {
  const data = new Uint8ClampedArray(size * size * 4)
  const scaleX = source.width / size
  const scaleY = source.height / size
  for (let y = 0; y < size; y++) {
    const sy = (y + 0.5) * scaleY - 0.5
    const y0 = Math.max(0, Math.floor(sy))
    const y1 = Math.min(source.height - 1, y0 + 1)
    const fy = Math.max(0, sy - y0)
    for (let x = 0; x < size; x++) {
      const sx = (x + 0.5) * scaleX - 0.5
      const x0 = Math.max(0, Math.floor(sx))
      const x1 = Math.min(source.width - 1, x0 + 1)
      const fx = Math.max(0, sx - x0)
      const target = (y * size + x) * 4
      for (let channel = 0; channel < 4; channel++) {
        const a = source.data[(y0 * source.width + x0) * 4 + channel]!
        const b = source.data[(y0 * source.width + x1) * 4 + channel]!
        const c = source.data[(y1 * source.width + x0) * 4 + channel]!
        const d = source.data[(y1 * source.width + x1) * 4 + channel]!
        data[target + channel] = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy
      }
    }
  }
  return { data, width: size, height: size }
}
