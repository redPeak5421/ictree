import { SphereGeometry } from 'three'

/**
 * A low turf mound: a unit sphere whose horizontal outline is pushed from a
 * circle toward a rounded square (a superellipse, |x|^6 + |z|^6 = 1, whose
 * corners reach 0.89 of the way to a true square's). A circle inscribed in a
 * module leaves its corners bare and scallops the finder rings, and even a
 * pinhole of paving where four mounds meet breaks a decoder's run through a
 * finder's solid centre at high resolution; this covers the module edge to
 * edge while still reading as a soft mound from the side. Scale it by
 * (radius, height, radius) to place.
 */
export function moundGeometry(): SphereGeometry {
  const geometry = new SphereGeometry(1, 24, 12)
  const pos = geometry.attributes.position!
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 1e-6) continue
    const cx = x / r
    const cz = z / r
    // Point on the superellipse in this direction, times the ring's radius.
    const sx = Math.sign(cx) * Math.cbrt(Math.abs(cx))
    const sz = Math.sign(cz) * Math.cbrt(Math.abs(cz))
    pos.setX(i, sx * r)
    pos.setZ(i, sz * r)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}
