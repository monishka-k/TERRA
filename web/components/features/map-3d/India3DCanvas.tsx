'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { cellToLatLng } from 'h3-js';
import gsap from 'gsap';
import { useTheme } from '@/components/providers';
import type { HazardCell } from '@/lib/api/types';
import {
  latLngTo3D,
  REGIONAL_CAMERA_PRESETS,
  CameraRegionPreset,
} from '@/lib/geo/indiaBoundary';
import {
  createIndiaLandmass,
  IndiaLandmassController,
} from './IndiaLandmassMesh';
import { HEX_BASE_Z } from './hexGridProjection';
import {
  createHexRiskColumns,
  HexRiskColumnsController,
} from './HexRiskColumns';
import {
  createHexTargetBeacon,
  HexTargetBeaconController,
} from './HexTargetBeacon';
import { Hex3DTooltip } from './Hex3DTooltip';
import { Map3DControlBar } from './Map3DControlBar';

/** Stable identity so a default `breaks` prop cannot re-trigger effects each render. */
const EMPTY_BREAKS: number[] = [];

export interface India3DCanvasProps {
  cells: HazardCell[];
  /** Ascending quantile breaks from the API legend; drives colour and height classing. */
  breaks?: number[];
  przThreshold?: number;
  selectedH3?: string | null;
  hoveredH3?: string | null;
  onSelectCell?: (h3: string | null) => void;
  onHoverCell?: (h3: string | null) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  className?: string;
}

export const India3DCanvas: React.FC<India3DCanvasProps> = ({
  cells,
  breaks = EMPTY_BREAKS,
  przThreshold = 0.85,
  selectedH3 = null,
  hoveredH3 = null,
  onSelectCell,
  onHoverCell,
  isLoading = false,
  className = '',
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scene and controller references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  const landmassRef = useRef<IndiaLandmassController | null>(null);
  const hexColumnsRef = useRef<HexRiskColumnsController | null>(null);
  const beaconRef = useRef<HexTargetBeaconController | null>(null);

  // Picking scratch state — allocated once, never per pointer event.
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const pickRafRef = useRef<number | null>(null);
  /** Identity of the grid the camera has already been framed against. */
  const framedGridRef = useRef<string | null>(null);

  // Floating HUD Tooltip State
  const [tooltipData, setTooltipData] = useState<{
    cell: HazardCell | null;
    pos: { x: number; y: number } | null;
  }>({ cell: null, pos: null });

  // Control bar state
  const [activePreset, setActivePreset] = useState<string>('national');
  const [isTopDown, setIsTopDown] = useState(false);

  // Selected cell world coordinate for the beacon
  const selectedBeaconPos = useMemo(() => {
    if (!selectedH3) return null;
    try {
      const [lat, lng] = cellToLatLng(selectedH3);
      const { x, y } = latLngTo3D(lng, lat);
      return { x, y, z: HEX_BASE_Z };
    } catch {
      return null;
    }
  }, [selectedH3]);

  // Setup Three.js Scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const bgColor = isDark ? 0x0b1614 : 0xe9f0e4;
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.006);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.01, 1000);
    const initialPreset = REGIONAL_CAMERA_PRESETS.national;
    camera.position.set(
      initialPreset.cameraPos.x,
      initialPreset.cameraPos.y,
      initialPreset.cameraPos.z,
    );
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.15;
    // A single res-8 cell is ~0.02 world units across, so the near limit has to
    // be small enough to actually inspect one column.
    controls.minDistance = 0.05;
    controls.maxDistance = 200;
    controls.target.set(
      initialPreset.target.x,
      initialPreset.target.y,
      initialPreset.target.z,
    );
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xfdfbf7, isDark ? 1.0 : 1.6);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xfffaed, isDark ? 1.5 : 1.8);
    dirLight.position.set(35, -45, 55);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x86efac, isDark ? 0.6 : 0.4);
    rimLight.position.set(-30, 45, 25);
    scene.add(rimLight);

    // Subtle Cartographic Grid Floor
    const gridColor = isDark ? 0x163026 : 0xcfdcc8;
    const gridHelper = new THREE.GridHelper(160, 32, gridColor, gridColor);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -1.5;
    scene.add(gridHelper);

    // 1. Initialize India Landmass
    const landmass = createIndiaLandmass(isDark);
    scene.add(landmass.group);
    landmassRef.current = landmass;

    // 2. Initialize Hex Risk Columns
    const hexColumns = createHexRiskColumns();
    scene.add(hexColumns.group);
    hexColumnsRef.current = hexColumns;

    // 3. Initialize Target Beacon
    const beacon = createHexTargetBeacon(isDark);
    scene.add(beacon.group);
    beaconRef.current = beacon;

    // Animation Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      landmass.dispose();
      hexColumns.dispose();
      beacon.dispose();
      renderer.dispose();
    };
  }, []);

  // Update cells when stream data or props change
  useEffect(() => {
    if (!hexColumnsRef.current) return;
    hexColumnsRef.current.updateCells(
      cells,
      przThreshold,
      isDark,
      selectedH3,
      hoveredH3,
      breaks,
    );
    beaconRef.current?.setScale(hexColumnsRef.current.getCellRadius());
  }, [cells, breaks, przThreshold, isDark, selectedH3, hoveredH3]);

  // Update target beacon position
  useEffect(() => {
    if (!beaconRef.current) return;
    beaconRef.current.setPosition(selectedBeaconPos);
  }, [selectedBeaconPos]);

  // Theme synchronization
  useEffect(() => {
    if (!sceneRef.current || !ambientLightRef.current) return;
    const bgColor = isDark ? 0x0b1614 : 0xe9f0e4;
    sceneRef.current.background = new THREE.Color(bgColor);
    if (sceneRef.current.fog) sceneRef.current.fog.color.setHex(bgColor);
    ambientLightRef.current.intensity = isDark ? 1.0 : 1.6;

    landmassRef.current?.updateTheme(isDark);
    beaconRef.current?.updateTheme(isDark);
  }, [isDark]);

  // Smooth Camera Flight Navigation (GSAP)
  const flyTo = useCallback(
    (target: { x: number; y: number; z: number }, cameraPos: { x: number; y: number; z: number }) => {
      if (!cameraRef.current || !controlsRef.current) return;
      const camera = cameraRef.current;
      const controls = controlsRef.current;

      gsap.to(camera.position, {
        x: cameraPos.x,
        y: cameraPos.y,
        z: cameraPos.z,
        duration: 1.2,
        ease: 'power3.inOut',
      });

      gsap.to(controls.target, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: 1.2,
        ease: 'power3.inOut',
        onUpdate: () => controls.update(),
      });
    },
    [],
  );

  /** Default oblique viewing direction, matching the national preset. */
  const OBLIQUE_DIR = useMemo(
    () => new THREE.Vector3(0, -30, 65).normalize(),
    [],
  );

  /**
   * Frames an arbitrary world-space volume. Camera distances can no longer be
   * hardcoded: a district grid spans ~1.5 world units where the subcontinent
   * spans ~60, so every flight has to be derived from the target's extent.
   */
  const fitToBounds = useCallback(
    (box: THREE.Box3, padding = 1.3) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls || box.isEmpty()) return;

      const sphere = box.getBoundingSphere(new THREE.Sphere());
      if (sphere.radius <= 0) return;

      const fov = (camera.fov * Math.PI) / 180;
      const distance = (sphere.radius / Math.sin(fov / 2)) * padding;

      const dir = new THREE.Vector3()
        .subVectors(camera.position, controls.target);
      if (dir.lengthSq() < 1e-12) dir.copy(OBLIQUE_DIR);
      else dir.normalize();

      const center = sphere.center;
      flyTo(
        { x: center.x, y: center.y, z: center.z },
        {
          x: center.x + dir.x * distance,
          y: center.y + dir.y * distance,
          z: center.z + dir.z * distance,
        },
      );
    },
    [flyTo, OBLIQUE_DIR],
  );

  // Frame a newly loaded grid once, so correctly-sized cells are actually on
  // screen rather than a few sub-pixel specks at national zoom.
  useEffect(() => {
    if (cells.length === 0) return;
    const gridId = `${cells.length}:${cells[0].h3}:${cells[cells.length - 1].h3}`;
    if (framedGridRef.current === gridId) return;

    const bounds = hexColumnsRef.current?.getBounds();
    if (!bounds) return;

    framedGridRef.current = gridId;
    fitToBounds(bounds);
  }, [cells, fitToBounds]);

  // Regional Focus Presets
  const handleSelectPreset = useCallback(
    (preset: CameraRegionPreset) => {
      setActivePreset(preset.id);
      flyTo(preset.target, preset.cameraPos);
    },
    [flyTo],
  );

  // Auto-focus Camera when a cell is selected, framing its neighbourhood.
  useEffect(() => {
    if (!selectedBeaconPos) return;
    const radius = hexColumnsRef.current?.getCellRadius() ?? 0;
    if (radius <= 0) return;

    const span = radius * 12;
    fitToBounds(
      new THREE.Box3(
        new THREE.Vector3(
          selectedBeaconPos.x - span,
          selectedBeaconPos.y - span,
          selectedBeaconPos.z,
        ),
        new THREE.Vector3(
          selectedBeaconPos.x + span,
          selectedBeaconPos.y + span,
          selectedBeaconPos.z + radius * 4,
        ),
      ),
    );
  }, [selectedBeaconPos, fitToBounds]);

  const handleResetCamera = useCallback(() => {
    const bounds = hexColumnsRef.current?.getBounds();
    if (bounds) fitToBounds(bounds);
    else handleSelectPreset(REGIONAL_CAMERA_PRESETS.national);
  }, [fitToBounds, handleSelectPreset]);

  // View Angle Toggle (2D Plan vs 3D Oblique)
  const handleToggleTopDown = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const next = !isTopDown;
    setIsTopDown(next);

    const target = controlsRef.current.target;
    if (next) {
      // Preserve the current viewing distance — a fixed altitude would fly past
      // a district-sized grid entirely.
      const distance = cameraRef.current.position.distanceTo(target);
      flyTo(
        { x: target.x, y: target.y, z: target.z },
        { x: target.x, y: target.y + distance * 1e-4, z: target.z + distance },
      );
    } else {
      const preset = REGIONAL_CAMERA_PRESETS[activePreset] ?? REGIONAL_CAMERA_PRESETS.national;
      flyTo(preset.target, preset.cameraPos);
    }
  }, [isTopDown, activePreset, flyTo]);

  // Pointer Picking — resolved analytically by the grid controller.
  const pickAtClient = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const columns = hexColumnsRef.current;
    if (!canvas || !camera || !columns) return null;

    const rect = canvas.getBoundingClientRect();
    pointerRef.current.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycasterRef.current.setFromCamera(pointerRef.current, camera);
    return columns.pickCell(raycasterRef.current);
  }, []);

  // Hover is coalesced to one pick per frame; pointer events fire far more
  // often than the scene can meaningfully respond to.
  const handlePointerMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      pendingPointerRef.current = { x: e.clientX, y: e.clientY };
      if (pickRafRef.current !== null) return;

      pickRafRef.current = requestAnimationFrame(() => {
        pickRafRef.current = null;
        const pending = pendingPointerRef.current;
        if (!pending) return;

        const hit = pickAtClient(pending.x, pending.y);
        setTooltipData(
          hit ? { cell: hit, pos: pending } : { cell: null, pos: null },
        );
        onHoverCell?.(hit?.h3 ?? null);
      });
    },
    [pickAtClient, onHoverCell],
  );

  const handlePointerLeave = useCallback(() => {
    pendingPointerRef.current = null;
    setTooltipData({ cell: null, pos: null });
    onHoverCell?.(null);
  }, [onHoverCell]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const hit = pickAtClient(e.clientX, e.clientY);
      if (hit) onSelectCell?.(hit.h3);
    },
    [pickAtClient, onSelectCell],
  );

  useEffect(
    () => () => {
      if (pickRafRef.current !== null) cancelAnimationFrame(pickRafRef.current);
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      onClick={handleClick}
      className={`relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating 3D Control Bar (Top) */}
      <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none">
        <Map3DControlBar
          activePresetId={activePreset}
          onSelectPreset={handleSelectPreset}
          isTopDown={isTopDown}
          onToggleTopDown={handleToggleTopDown}
          onResetCamera={handleResetCamera}
          isLoading={isLoading}
          cellCount={cells.length}
        />
      </div>

      {/* Floating HUD Tooltip */}
      <Hex3DTooltip
        cell={tooltipData.cell}
        position={tooltipData.pos}
        przThreshold={przThreshold}
        isDark={isDark}
      />
    </div>
  );
};
