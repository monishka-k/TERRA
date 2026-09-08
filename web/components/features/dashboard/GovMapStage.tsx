'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  DEMO_HABITATIONS,
  HabitationData,
  HazardFilter,
  RiskLevelFilter,
  ScenarioTime
} from './demoData';
import {
  HexSpatialCell,
  CellRenderState,
  generateIndiaHexGrid,
  evaluateHexCellState,
  getActiveDataPulses,
  CellDetailTooltip,
} from './animation';

export interface GovMapStageProps {
  selectedHabitation: HabitationData | null;
  selectedHazard: HazardFilter;
  selectedRegion: string;
  selectedRisk: RiskLevelFilter;
  selectedScenarioTime: ScenarioTime;
  onSelectHabitation: (habitation: HabitationData) => void;
  onSelectHexCell?: (cell: HexSpatialCell) => void;
  currentTime?: number;
  isDarkTheme?: boolean;
  className?: string;
}

// India Outline Polygon Coordinates (Normalized 0..100)
const RAW_INDIA_COORDS: [number, number][] = [
  [30, 95], [33, 93], [36, 90], [38, 85], [37, 80], [39, 76],
  [43, 76], [48, 77], [52, 79], [56, 80], [60, 78], [63, 76],
  [65, 78], [72, 79], [78, 80], [84, 82], [88, 78], [86, 74],
  [82, 72], [76, 70], [70, 68], [64, 67], [60, 64], [58, 60],
  [60, 56], [62, 52], [61, 47], [58, 43], [54, 38], [50, 32],
  [48, 25], [45, 18], [43, 10], [42, 5],  [40, 0],  [38, 6],
  [35, 12], [32, 20], [28, 28], [24, 35], [20, 42], [15, 48],
  [12, 52], [10, 56], [8, 60],  [12, 62], [15, 60], [18, 62],
  [15, 66], [12, 70], [16, 73], [20, 75], [24, 80], [25, 85],
  [27, 90], [30, 95]
];

export const GovMapStage: React.FC<GovMapStageProps> = ({
  selectedHabitation,
  selectedHazard,
  selectedRegion,
  selectedRisk,
  selectedScenarioTime,
  onSelectHabitation,
  onSelectHexCell,
  currentTime = 0,
  isDarkTheme = true,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Hover states for tooltips
  const [hoveredHabitation, setHoveredHabitation] = useState<HabitationData | null>(null);
  const [hoveredHexCell, setHoveredHexCell] = useState<HexSpatialCell | null>(null);
  const [hoveredHexState, setHoveredHexState] = useState<CellRenderState | undefined>(undefined);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // References for continuous 60 FPS animation without re-instantiation
  const currentTimeRef = useRef<number>(currentTime);
  const isDarkThemeRef = useRef<boolean>(isDarkTheme);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    isDarkThemeRef.current = isDarkTheme;
  }, [isDarkTheme]);

  // Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const landMeshRef = useRef<THREE.Mesh | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const pulseLinesGroupRef = useRef<THREE.Group | null>(null);

  const hexMeshesRef = useRef<{ mesh: THREE.Mesh; data: HexSpatialCell }[]>([]);
  const habitationMarkersRef = useRef<{ mesh: THREE.Group; data: HabitationData }[]>([]);

  // Setup Three.js 3D Cartography Scene with Full Hexagonal Grid
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    const bgColor = isDarkThemeRef.current ? 0x162522 : 0xf7f5f0;
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.007);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 1000);
    camera.position.set(0, -55, 78);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 35;
    controls.maxDistance = 140;
    controls.target.set(0, 5, 0);
    controlsRef.current = controls;

    // Lighting (Warm Editorial Lighting)
    const ambientLight = new THREE.AmbientLight(0xf7f5f0, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
    dirLight.position.set(40, -50, 65);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x6f8f72, 0.6);
    rimLight.position.set(-40, 50, 20);
    scene.add(rimLight);

    // Grid Floor Helper (Cartographic coordinates floor)
    const gridColor1 = isDarkThemeRef.current ? 0x2a3e39 : 0xd8d3c5;
    const gridColor2 = isDarkThemeRef.current ? 0x1d2e2b : 0xe6e2d6;
    const gridHelper = new THREE.GridHelper(180, 36, gridColor1, gridColor2);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -2;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // 1. Build Extruded India Landmass
    const indiaShape = new THREE.Shape();
    RAW_INDIA_COORDS.forEach(([x, y], idx) => {
      const nx = (x - 45) * 0.95;
      const ny = (y - 48) * 0.95;
      if (idx === 0) indiaShape.moveTo(nx, ny);
      else indiaShape.lineTo(nx, ny);
    });

    const extrudeSettings = {
      steps: 1,
      depth: 2.5,
      bevelEnabled: true,
      bevelThickness: 0.6,
      bevelSize: 0.4,
      bevelSegments: 3
    };

    const landGeometry = new THREE.ExtrudeGeometry(indiaShape, extrudeSettings);
    const landColor = isDarkThemeRef.current ? 0x1f3430 : 0xe6e2d8;
    const landMaterial = new THREE.MeshStandardMaterial({
      color: landColor,
      roughness: 0.75,
      metalness: 0.15
    });

    const landMesh = new THREE.Mesh(landGeometry, landMaterial);
    landMesh.castShadow = true;
    landMesh.receiveShadow = true;
    scene.add(landMesh);
    landMeshRef.current = landMesh;

    // 2. Add Topographic Elevation Contour Lines
    const edgesGeom = new THREE.EdgesGeometry(landGeometry, 24);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xd49a45,
      transparent: true,
      opacity: isDarkThemeRef.current ? 0.45 : 0.6,
      linewidth: 1
    });
    const edgeLines = new THREE.LineSegments(edgesGeom, edgeMaterial);
    scene.add(edgeLines);

    // 3. Render Nationwide Hexagonal Spatial Grid (~180 cells)
    const hexGroup = new THREE.Group();
    scene.add(hexGroup);

    const createHexGeometry = (radius: number) => {
      const hexShape = new THREE.Shape();
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60 * Math.PI) / 180;
        const hx = radius * Math.cos(angle);
        const hy = radius * Math.sin(angle);
        if (i === 0) hexShape.moveTo(hx, hy);
        else hexShape.lineTo(hx, hy);
      }
      return new THREE.ExtrudeGeometry(hexShape, {
        depth: 1.0, // base unit height scaled by scale.z
        bevelEnabled: false
      });
    };

    const hexGeom = createHexGeometry(1.65);
    const generatedCells = generateIndiaHexGrid();
    const hexMeshes: { mesh: THREE.Mesh; data: HexSpatialCell }[] = [];

    generatedCells.forEach((cell) => {
      const cellMat = new THREE.MeshStandardMaterial({
        color: 0x1c2e29,
        roughness: 0.35,
        metalness: 0.2,
        transparent: true,
        opacity: 0.25
      });

      const cellMesh = new THREE.Mesh(hexGeom, cellMat);
      cellMesh.position.set(cell.x, cell.y, 2.5);
      cellMesh.scale.set(1, 1, 0.35);
      cellMesh.castShadow = true;
      cellMesh.receiveShadow = true;
      cellMesh.userData = { hexData: cell };

      hexGroup.add(cellMesh);
      hexMeshes.push({ mesh: cellMesh, data: cell });
    });
    hexMeshesRef.current = hexMeshes;

    // 4. Directional Data Pulses Line Group
    const pulseLinesGroup = new THREE.Group();
    scene.add(pulseLinesGroup);
    pulseLinesGroupRef.current = pulseLinesGroup;

    // 5. Render 3D Habitation Markers / Pins
    const habitationGroup = new THREE.Group();
    scene.add(habitationGroup);

    const habitationsWithMeshes: { mesh: THREE.Group; data: HabitationData }[] = [];

    DEMO_HABITATIONS.forEach((hab) => {
      const markerGroup = new THREE.Group();
      markerGroup.position.set(hab.mapCoords.x, hab.mapCoords.y, 3.2);

      let pinColor = 0xb9433f;
      if (hab.riskLevel === 'High') pinColor = 0xc96b3b;
      else if (hab.riskLevel === 'Medium') pinColor = 0xd49a45;

      // Pin Cylinder Stem
      const stemGeom = new THREE.CylinderGeometry(0.2, 0.2, 2.8, 8);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0xf7f5f0 });
      const stem = new THREE.Mesh(stemGeom, stemMat);
      stem.rotation.x = Math.PI / 2;
      stem.position.z = 1.4;
      markerGroup.add(stem);

      // Pin Head Sphere
      const headGeom = new THREE.SphereGeometry(0.75, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({
        color: pinColor,
        roughness: 0.3,
        emissive: pinColor,
        emissiveIntensity: 0.3
      });
      const head = new THREE.Mesh(headGeom, headMat);
      head.position.z = 2.8;
      markerGroup.add(head);

      // Pulse Halo Ring
      const ringGeom = new THREE.RingGeometry(0.9, 1.3, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: pinColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.z = 0.1;
      markerGroup.add(ring);

      markerGroup.userData = { habitationData: hab };
      habitationGroup.add(markerGroup);
      habitationsWithMeshes.push({ mesh: markerGroup, data: hab });
    });
    habitationMarkersRef.current = habitationsWithMeshes;

    // 6. Animation Loop (60 FPS evaluating risk wave propagation)
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const time = currentTimeRef.current;
      const isDark = isDarkThemeRef.current;

      // Evaluate each hexagon's spatial risk state
      hexMeshes.forEach(({ mesh, data }) => {
        const state = evaluateHexCellState(data, time, isDark, elapsed);

        // Update mesh scale (height)
        mesh.scale.z = state.height * state.pulseScale;

        // Update material color and opacity
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.setHex(state.threeColor);
        mat.opacity = state.opacity;

        if (state.isPulsing) {
          mat.emissive.setHex(state.threeColor);
          mat.emissiveIntensity = 0.25 + Math.sin(elapsed * 4 + data.x) * 0.15;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      });

      // Update Directional Data Pulses (`>>>` flows during Stage 5)
      const activePulses = getActiveDataPulses(time);
      while (pulseLinesGroup.children.length > 0) {
        pulseLinesGroup.remove(pulseLinesGroup.children[0]);
      }

      activePulses.forEach((pulse) => {
        // Linear interpolation between from and to
        const curX = pulse.fromCoords.x + (pulse.toCoords.x - pulse.fromCoords.x) * pulse.progress;
        const curY = pulse.fromCoords.y + (pulse.toCoords.y - pulse.fromCoords.y) * pulse.progress;
        const arcZ = 3.5 + Math.sin(pulse.progress * Math.PI) * 4.0;

        const pulseGeom = new THREE.SphereGeometry(0.45, 8, 8);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: 0xd49a45,
          transparent: true,
          opacity: pulse.intensity * 0.9,
        });
        const pulseMesh = new THREE.Mesh(pulseGeom, pulseMat);
        pulseMesh.position.set(curX, curY, arcZ);
        pulseLinesGroup.add(pulseMesh);
      });

      // Subtle breathing on habitation pin halos
      habitationsWithMeshes.forEach(({ mesh }) => {
        const ring = mesh.children[2];
        if (ring) {
          const scale = 1 + Math.sin(elapsed * 2.5) * 0.22;
          ring.scale.set(scale, scale, 1);
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle Resize
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
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, []);

  // Synchronize Theme Switching with Three.js Scene
  useEffect(() => {
    if (!sceneRef.current || !landMeshRef.current || !gridHelperRef.current) return;
    const isDark = isDarkTheme;
    const bgColor = isDark ? 0x162522 : 0xf7f5f0;

    sceneRef.current.background = new THREE.Color(bgColor);
    if (sceneRef.current.fog) {
      sceneRef.current.fog.color.setHex(bgColor);
    }

    const landMat = landMeshRef.current.material as THREE.MeshStandardMaterial;
    landMat.color.setHex(isDark ? 0x1f3430 : 0xe6e2d8);
  }, [isDarkTheme]);

  // Raycasting for Hover and Click on Map
  const handlePointerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      // 1. Check Habitation markers
      const markerObjects = habitationMarkersRef.current.map((h) => h.mesh);
      const markerIntersects = raycaster.intersectObjects(markerObjects, true);

      if (markerIntersects.length > 0) {
        let rootGroup: THREE.Object3D | null = markerIntersects[0].object;
        while (rootGroup && !rootGroup.userData.habitationData && rootGroup.parent) {
          rootGroup = rootGroup.parent;
        }
        if (rootGroup && rootGroup.userData.habitationData) {
          onSelectHabitation(rootGroup.userData.habitationData);
          return;
        }
      }

      // 2. Check Hexagonal Spatial Cells
      const hexObjects = hexMeshesRef.current.map((h) => h.mesh);
      const hexIntersects = raycaster.intersectObjects(hexObjects, false);

      if (hexIntersects.length > 0) {
        const cellData: HexSpatialCell = hexIntersects[0].object.userData.hexData;
        if (cellData) {
          if (onSelectHexCell) onSelectHexCell(cellData);

          // If close to a known habitation, select it
          const matchedHab = DEMO_HABITATIONS.find(
            (hab) => Math.hypot(hab.mapCoords.x - cellData.x, hab.mapCoords.y - cellData.y) < 5.0
          );
          if (matchedHab) {
            onSelectHabitation(matchedHab);
          }
        }
      }
    },
    [onSelectHabitation, onSelectHexCell]
  );

  const handlePointerMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !cameraRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Check Habitation markers
    const markerObjects = habitationMarkersRef.current.map((h) => h.mesh);
    const markerIntersects = raycaster.intersectObjects(markerObjects, true);

    if (markerIntersects.length > 0) {
      let rootGroup: THREE.Object3D | null = markerIntersects[0].object;
      while (rootGroup && !rootGroup.userData.habitationData && rootGroup.parent) {
        rootGroup = rootGroup.parent;
      }
      if (rootGroup && rootGroup.userData.habitationData) {
        setHoveredHabitation(rootGroup.userData.habitationData);
        setHoveredHexCell(null);
        setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        return;
      }
    }
    setHoveredHabitation(null);

    // Check Hexagonal Cells
    const hexObjects = hexMeshesRef.current.map((h) => h.mesh);
    const hexIntersects = raycaster.intersectObjects(hexObjects, false);

    if (hexIntersects.length > 0) {
      const cellData: HexSpatialCell = hexIntersects[0].object.userData.hexData;
      if (cellData) {
        const cellState = evaluateHexCellState(cellData, currentTimeRef.current, isDarkThemeRef.current);
        setHoveredHexCell(cellData);
        setHoveredHexState(cellState);
        setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        return;
      }
    }
    setHoveredHexCell(null);
  }, []);

  // Filter Visibility
  useEffect(() => {
    habitationMarkersRef.current.forEach(({ mesh, data }) => {
      const isHazardMatch = selectedHazard === 'All' || data.hazardType === selectedHazard;
      const isRegionMatch = selectedRegion === 'All India' || data.state.includes(selectedRegion);
      const isRiskMatch = selectedRisk === 'All' || data.riskState === selectedRisk;
      mesh.visible = isHazardMatch && isRegionMatch && isRiskMatch;
    });
  }, [selectedHazard, selectedRegion, selectedRisk]);

  // Reset Camera View Helper
  const handleResetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.reset();
      cameraRef.current.position.set(0, -55, 78);
      controlsRef.current.target.set(0, 5, 0);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[500px] overflow-hidden bg-gov-bg-light dark:bg-gov-bg cursor-grab active:cursor-grabbing select-none transition-colors duration-200 ${className}`}
      onClick={handlePointerClick}
      onMouseMove={handlePointerMove}
      onMouseLeave={() => {
        setHoveredHabitation(null);
        setHoveredHexCell(null);
      }}
    >
      {/* THREE.JS WEBGL CANVAS */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* MAP FLOATING CONTROLS (Top Right Zoom & Reset) */}
      <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-10">
        <button
          type="button"
          onClick={() => {
            if (cameraRef.current) cameraRef.current.position.multiplyScalar(0.85);
          }}
          className="w-8 h-8 rounded-md bg-gov-bg-light/90 dark:bg-gov-bg/90 border border-gov-bg/20 dark:border-gov-bg-light/20 flex items-center justify-center text-gov-bg dark:text-gov-bg-light hover:bg-white dark:hover:bg-gov-surface-hover text-sm font-bold shadow-sm transition-all"
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            if (cameraRef.current) cameraRef.current.position.multiplyScalar(1.15);
          }}
          className="w-8 h-8 rounded-md bg-gov-bg-light/90 dark:bg-gov-bg/90 border border-gov-bg/20 dark:border-gov-bg-light/20 flex items-center justify-center text-gov-bg dark:text-gov-bg-light hover:bg-white dark:hover:bg-gov-surface-hover text-sm font-bold shadow-sm transition-all"
          title="Zoom Out"
        >
          –
        </button>
        <button
          type="button"
          onClick={handleResetCamera}
          className="w-8 h-8 rounded-md bg-gov-bg-light/90 dark:bg-gov-bg/90 border border-gov-bg/20 dark:border-gov-bg-light/20 flex items-center justify-center text-gov-bg dark:text-gov-bg-light hover:bg-white dark:hover:bg-gov-surface-hover text-xs font-mono shadow-sm transition-all"
          title="Reset View"
        >
          ⟲
        </button>
      </div>

      {/* INTERACTIVE HEXAGON CELL TOOLTIP INSPECTOR */}
      {hoveredHexCell && (
        <CellDetailTooltip
          cell={hoveredHexCell}
          cellState={hoveredHexState}
          position={hoverPos}
          onOpenDossier={() => {
            const matchedHab = DEMO_HABITATIONS.find(
              (hab) => Math.hypot(hab.mapCoords.x - hoveredHexCell.x, hab.mapCoords.y - hoveredHexCell.y) < 6.0
            );
            if (matchedHab) onSelectHabitation(matchedHab);
          }}
        />
      )}

      {/* INTERACTIVE HABITATION PIN TOOLTIP */}
      {hoveredHabitation && !hoveredHexCell && (
        <div
          className="absolute pointer-events-none z-30 px-3 py-2 rounded-md bg-gov-bg/95 text-gov-bg-light border border-gov-bg-light/20 shadow-xl backdrop-blur-md text-xs -translate-x-1/2 -translate-y-full mb-3"
          style={{ left: `${hoverPos.x}px`, top: `${hoverPos.y}px` }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-sm font-serif">
              {hoveredHabitation.name}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                hoveredHabitation.priority === 'Immediate Priority'
                  ? 'bg-gov-red text-white'
                  : hoveredHabitation.priority === 'Short-term Action'
                  ? 'bg-gov-orange text-white'
                  : 'bg-gov-amber text-black'
              }`}
            >
              {hoveredHabitation.priority}
            </span>
          </div>

          <div className="text-[11px] text-gov-bg-light/70 mt-0.5">
            {hoveredHabitation.district}, {hoveredHabitation.state}
          </div>

          <div className="flex items-center justify-between gap-4 mt-2 pt-1.5 border-t border-gov-bg-light/15 font-mono text-[11px]">
            <span>
              Risk Score: <strong className="text-gov-red">{hoveredHabitation.riskScore.toFixed(2)}</strong>
            </span>
            <span>
              Exposed: <strong className="text-gov-amber">{hoveredHabitation.population.toLocaleString()}</strong>
            </span>
          </div>
        </div>
      )}

      {/* MAP BOTTOM TELEMETRY BAR */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-gov-bg/60 dark:text-cream/60 pointer-events-none">
        <div>
          <span>PROJECTION: </span>
          <span className="text-gov-bg dark:text-cream">EPSG:4326 WGS84 · H3 RES-8</span>
        </div>
        <div>
          <span>SELECTED AOI: </span>
          <span className="text-gov-amber">
            {selectedHabitation ? `${selectedHabitation.name}, ${selectedHabitation.state}` : 'India National Grid'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GovMapStage;
