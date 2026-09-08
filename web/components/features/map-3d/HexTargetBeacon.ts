import * as THREE from 'three';
import gsap from 'gsap';

export interface HexTargetBeaconController {
  group: THREE.Group;
  setPosition: (pos: { x: number; y: number; z: number } | null) => void;
  /** Scales the beacon to the grid it is marking; built at 1 world unit. */
  setScale: (scale: number) => void;
  updateTheme: (isDark: boolean) => void;
  dispose: () => void;
}

/**
 * Animated 3D Targeting Beacon and expanding ground halo controller.
 * Visually locks onto selected or hovered H3 cells on the 3D subcontinent.
 */
export function createHexTargetBeacon(
  isDark = true,
  color = 0x10b981,
): HexTargetBeaconController {
  const group = new THREE.Group();
  group.name = 'hex-target-beacon';
  group.visible = false;

  // 1. Vertical Target Beam
  const beamGeom = new THREE.CylinderGeometry(0.08, 0.22, 9.0, 16);
  const beamMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: isDark ? 0.75 : 0.85,
    blending: THREE.AdditiveBlending,
  });
  const beamMesh = new THREE.Mesh(beamGeom, beamMat);
  beamMesh.position.set(0, 0, 4.5);
  beamMesh.rotation.x = Math.PI / 2;
  group.add(beamMesh);

  // 2. Expanding Ground Ring Halo
  const ringGeom = new THREE.RingGeometry(0.8, 1.15, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });
  const ringMesh = new THREE.Mesh(ringGeom, ringMat);
  ringMesh.position.set(0, 0, 0.15);
  group.add(ringMesh);

  // 3. Center Target Point
  const pointGeom = new THREE.CircleGeometry(0.3, 16);
  const pointMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pointMesh = new THREE.Mesh(pointGeom, pointMat);
  pointMesh.position.set(0, 0, 0.2);
  group.add(pointMesh);

  // GSAP Animations
  const ringAnim = gsap.to(ringMesh.scale, {
    x: 1.8,
    y: 1.8,
    duration: 1.4,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });

  const beamAnim = gsap.to(beamMesh.scale, {
    z: 1.25,
    duration: 1.1,
    repeat: -1,
    yoyo: true,
    ease: 'power1.inOut',
  });

  const setPosition = (pos: { x: number; y: number; z: number } | null) => {
    if (!pos) {
      group.visible = false;
      return;
    }
    group.visible = true;
    group.position.set(pos.x, pos.y, pos.z);
  };

  const setScale = (scale: number) => {
    if (!Number.isFinite(scale) || scale <= 0) return;
    group.scale.setScalar(scale);
  };

  const updateTheme = (dark: boolean) => {
    beamMat.opacity = dark ? 0.75 : 0.85;
  };

  const dispose = () => {
    ringAnim.kill();
    beamAnim.kill();
    beamGeom.dispose();
    beamMat.dispose();
    ringGeom.dispose();
    ringMat.dispose();
    pointGeom.dispose();
    pointMat.dispose();
  };

  return { group, setPosition, setScale, updateTheme, dispose };
}
