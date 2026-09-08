import * as THREE from 'three';
import { cellToBoundary, cellToLatLng } from 'h3-js';
import { latLngTo3D } from '@/lib/geo/indiaBoundary';
import { LANDMASS_TOP_Z } from './IndiaLandmassMesh';

/**
 * Top surface of the extruded India landmass. Hex columns are seated at this
 * height so their bases sit flush with the terrain.
 */
export const HEX_BASE_Z = LANDMASS_TOP_Z;

/**
 * Fraction of a cell's true footprint that is actually drawn. The small inset
 * leaves a visible gutter between neighbours (which reads as a grid) and keeps
 * adjacent side walls from z-fighting along shared edges.
 */
export const HEX_FILL_RATIO = 0.94;

export interface HexCellPlacement {
  h3: string;
  /** Projected centroid in world space. */
  x: number;
  y: number;
  /** Rotation about Z that aligns the shared prism to this cell's true orientation. */
  rotation: number;
  /** Mean projected circumradius of the cell, in world units. */
  radius: number;
}

/** Projects one H3 cell's true boundary into world space, centroid-relative. */
function projectBoundary(h3: string): { center: THREE.Vector2; verts: THREE.Vector2[] } {
  const [lat, lng] = cellToLatLng(h3);
  const c = latLngTo3D(lng, lat);
  const center = new THREE.Vector2(c.x, c.y);
  const verts = cellToBoundary(h3).map(([vLat, vLng]) => {
    const v = latLngTo3D(vLng, vLat);
    return new THREE.Vector2(v.x - c.x, v.y - c.y);
  });
  return { center, verts };
}

/** Signed area of a polygon; positive when wound counter-clockwise. */
function signedArea(verts: THREE.Vector2[]): number {
  let a = 0;
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i];
    const q = verts[(i + 1) % verts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * Derives the world-space placement of a cell from its real H3 boundary rather
 * than from an assumed radius, so columns tile at their true geographic size.
 */
export function computeHexPlacement(h3: string): HexCellPlacement | null {
  let projected;
  try {
    projected = projectBoundary(h3);
  } catch {
    return null;
  }
  const { center, verts } = projected;
  if (verts.length < 3) return null;

  const radius = verts.reduce((s, v) => s + v.length(), 0) / verts.length;
  if (!Number.isFinite(radius) || radius <= 0) return null;

  return {
    h3,
    x: center.x,
    y: center.y,
    rotation: Math.atan2(verts[0].y, verts[0].x),
    radius,
  };
}

/**
 * Builds the shared prism geometry from a real H3 cell, normalised to unit
 * circumradius, unit height and zero rotation. Instancing this against each
 * cell's own rotation and radius reproduces the true grid: H3 cells are not
 * regular hexagons, and the map projection stretches them further, so a
 * synthetic hexagon would not tile cleanly.
 *
 * The bottom cap is omitted — it is never visible against the landmass.
 */
export function createUnitHexPrismGeometry(referenceH3: string): THREE.BufferGeometry {
  const { verts: rawVerts } = projectBoundary(referenceH3);
  const meanRadius =
    rawVerts.reduce((s, v) => s + v.length(), 0) / rawVerts.length;

  const scale = meanRadius > 0 ? 1 / meanRadius : 1;
  const rot = -Math.atan2(rawVerts[0].y, rawVerts[0].x);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const ring = rawVerts.map((v) =>
    new THREE.Vector2(
      (v.x * cos - v.y * sin) * scale,
      (v.x * sin + v.y * cos) * scale,
    ),
  );
  // Guarantee counter-clockwise winding so outward faces are front-facing.
  if (signedArea(ring) < 0) ring.reverse();

  const n = ring.length;
  const positions: number[] = [];
  const normals: number[] = [];

  const pushTri = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    normal: THREE.Vector3,
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) normals.push(normal.x, normal.y, normal.z);
  };

  // Top cap — a fan from the centre, flat-shaded upward.
  const up = new THREE.Vector3(0, 0, 1);
  const apex = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    pushTri(
      apex,
      new THREE.Vector3(p.x, p.y, 1),
      new THREE.Vector3(q.x, q.y, 1),
      up,
    );
  }

  // Side walls — one faceted quad per edge.
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    const edge = new THREE.Vector2(q.x - p.x, q.y - p.y);
    const normal = new THREE.Vector3(edge.y, -edge.x, 0).normalize();

    const p0 = new THREE.Vector3(p.x, p.y, 0);
    const q0 = new THREE.Vector3(q.x, q.y, 0);
    const p1 = new THREE.Vector3(p.x, p.y, 1);
    const q1 = new THREE.Vector3(q.x, q.y, 1);

    pushTri(p0, q0, q1, normal);
    pushTri(p0, q1, p1, normal);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.computeBoundingSphere();
  return geom;
}
