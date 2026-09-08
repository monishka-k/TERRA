import * as THREE from 'three';
import {
  MAINLAND_INDIA_COORDS,
  ISLAND_GROUPS_COORDS,
  latLngTo3D,
} from '@/lib/geo/indiaBoundary';

/** Extrusion depth of the subcontinent slab. */
export const LANDMASS_DEPTH = 2.4;
/** Bevel added above the extrusion by `ExtrudeGeometry`. */
export const LANDMASS_BEVEL_THICKNESS = 0.45;
/**
 * World Z of the landmass top face. Anything seated on the terrain must use
 * this rather than the raw depth — the bevel lifts the surface above it, and a
 * correctly-sized hex column is far too short to survive being buried.
 */
export const LANDMASS_TOP_Z = LANDMASS_DEPTH + LANDMASS_BEVEL_THICKNESS;

export interface IndiaLandmassController {
  group: THREE.Group;
  updateTheme: (isDark: boolean) => void;
  dispose: () => void;
}

/**
 * Creates and manages the procedural 3D Subcontinent Mesh for India.
 * Extrudes survey-grade boundaries with beveling and gold contour edge lines.
 */
export function createIndiaLandmass(
  isDark = true,
  depth = LANDMASS_DEPTH,
  contourColor = 0xd49a45,
): IndiaLandmassController {
  const group = new THREE.Group();
  group.name = 'india-landmass-group';

  // 1. Build Mainland Shape & Geometry
  const shape = new THREE.Shape();
  MAINLAND_INDIA_COORDS.forEach(([lng, lat], idx) => {
    const { x, y } = latLngTo3D(lng, lat);
    if (idx === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth,
    bevelEnabled: true,
    bevelThickness: LANDMASS_BEVEL_THICKNESS,
    bevelSize: 0.35,
    bevelSegments: 3,
  };

  const mainlandGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const mainlandEdgesGeom = new THREE.EdgesGeometry(mainlandGeom, 22);

  const landColor = isDark ? 0x132720 : 0xf8fbf4;
  const landMaterial = new THREE.MeshStandardMaterial({
    color: landColor,
    roughness: 0.72,
    metalness: 0.18,
  });

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: contourColor,
    transparent: true,
    opacity: isDark ? 0.38 : 0.55,
  });

  const mainlandMesh = new THREE.Mesh(mainlandGeom, landMaterial);
  mainlandMesh.castShadow = true;
  mainlandMesh.receiveShadow = true;
  group.add(mainlandMesh);

  const mainlandEdges = new THREE.LineSegments(mainlandEdgesGeom, edgeMaterial);
  group.add(mainlandEdges);

  // 2. Build Island Meshes (Andaman & Nicobar)
  const islandMeshes: THREE.Mesh[] = [];
  ISLAND_GROUPS_COORDS.forEach((isl) => {
    const islShape = new THREE.Shape();
    isl.forEach(([lng, lat], idx) => {
      const { x, y } = latLngTo3D(lng, lat);
      if (idx === 0) islShape.moveTo(x, y);
      else islShape.lineTo(x, y);
    });
    const islGeom = new THREE.ExtrudeGeometry(islShape, {
      steps: 1,
      depth: depth * 0.8,
      bevelEnabled: true,
      bevelThickness: 0.25,
      bevelSize: 0.18,
    });
    const islMesh = new THREE.Mesh(islGeom, landMaterial);
    islMesh.castShadow = true;
    islMesh.receiveShadow = true;
    group.add(islMesh);
    islandMeshes.push(islMesh);
  });

  const updateTheme = (dark: boolean) => {
    const nextColor = dark ? 0x132720 : 0xf8fbf4;
    landMaterial.color.setHex(nextColor);
    edgeMaterial.opacity = dark ? 0.38 : 0.55;
  };

  const dispose = () => {
    mainlandGeom.dispose();
    mainlandEdgesGeom.dispose();
    landMaterial.dispose();
    edgeMaterial.dispose();
    islandMeshes.forEach((m) => m.geometry.dispose());
  };

  return { group, updateTheme, dispose };
}
