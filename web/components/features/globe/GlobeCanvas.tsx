'use client';
/* eslint-disable react-hooks/immutability */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap, M3_EASE, type M3AnimationConfig } from '@/lib/motion/m3';
import { INTRO_TIMINGS } from '@/lib/motion/introSequence';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { useTheme } from '@/components/providers';
import { HotspotData, DEAD_ZONES_DATA } from './types';
import { generateProceduralEarthCanvas } from './procedural-textures';

export interface CameraTarget {
  y: number;
  dist: number;
  duration?: number;
}

export interface GlobeCanvasProps {
  /** Mode: 'landing' starts framed for hero presentation; 'login' spins and glides globe off-screen */
  viewMode?: 'landing' | 'login';
  /** Whether earth is auto-rotating */
  isAutoRotating?: boolean;
  /** Whether cyber radar sweep is active */
  isRadarActive?: boolean;
  /** Active camera animation target */
  cameraTarget?: CameraTarget | null;
  /** List of hotspots to display */
  hotspots?: HotspotData[];
  /** Primary focus hotspot ID (default 'himalayan-arc' for India) */
  primaryFocusId?: string;
  /** Target trigger counter to re-center on primary hazard */
  focusTrigger?: number;
  /** Callback when hotspot is hovered */
  onHoverHotspot?: (payload: { spot: HotspotData; position: { x: number; y: number } } | null) => void;
  /** Custom root className */
  className?: string;
  /** Entrance animation overrides for the canvas container */
  animation?: M3AnimationConfig;
  /** Normalized scroll progress across the landing narrative track (0.0 to 1.0) */
  scrollProgress?: number;
  /** Active landing section index (0: Hero, 1: Triage, 2: SoVI, 3: SAR, 4: Horizon) for snap transitions */
  activeSection?: number;
}

/**
 * Calculates the exact Y position in 3D world space such that the sphere's
 * equator aligns with the top edge of the frosted glass footer.
 * When earthGroup.position.y = getFooterTopY(height), exactly 50% of the sphere
 * crowns above the frosted footer, while the lower 50% is submerged behind the frosted glass!
 */
export const getFooterTopY = (h: number) => {
  const footerEl = typeof document !== 'undefined' ? document.getElementById('landing-footer') : null;
  const footerHeight = footerEl ? footerEl.getBoundingClientRect().height : 224;
  const vFovRad = (45 * Math.PI) / 180;
  const visibleWorldHeight = 2 * 4.8 * Math.tan(vFovRad / 2); // ~3.97645 at camera z = 4.8
  const footerWorldHeight = (footerHeight / Math.max(h, 1)) * visibleWorldHeight;
  return (-visibleWorldHeight / 2) + footerWorldHeight;
};

/**
 * Calculates the target position and scale for each discrete landing section:
 * - Section 0 (Hero): Right side, hero scale (x = 1.55, y = 0, scale = 0.92)
 * - Section 1 (H3 Triage): Left side empty space, story scale (x = -1.55, y = 0, scale = storyScale)
 * - Section 2 (SoVI Relocation): Right side empty space, story scale (x = 1.55, y = 0, scale = storyScale)
 * - Section 3 (Sentinel SAR Radar): Left side empty space, story scale (x = -1.55, y = 0, scale = storyScale)
 * - Section 4 (Horizon Command): Bottom center, horizon scale, 50% above frosted footer!
 */
export const getSectionConfig = (
  sectionIdx: number,
  w: number,
  h: number,
  viewMode: 'landing' | 'login' = 'landing'
) => {
  if (viewMode === 'login') {
    const desktop = w > 1024;
    return {
      x: desktop ? 3.3 : 1.7,
      y: 0,
      scale: 1.0,
    };
  }

  const desktop = w > 1024;
  const vFovRad = (45 * Math.PI) / 180;
  const visibleWorldHeight = 2 * 4.8 * Math.tan(vFovRad / 2);
  const visibleWorldWidth = visibleWorldHeight * (w / Math.max(h, 1));

  // Target diameter fits cleanly within card height (~400px, ~0.50 of viewport height)
  // and within the empty horizontal half of the viewport:
  const targetStoryDiameter = desktop
    ? Math.min(visibleWorldHeight * 0.52, visibleWorldWidth * 0.36)
    : Math.min(visibleWorldHeight * 0.44, visibleWorldWidth * 0.65);
  const storyScale = targetStoryDiameter / 4.0; // ~0.50 - 0.52 on desktop

  const heroScale = desktop ? 0.92 : 0.80;
  const horizonScale = desktop ? 0.95 : 0.85;

  const ampX = desktop ? 1.55 : w > 640 ? 0.85 : 0.35;
  const bottomY = getFooterTopY(h);

  switch (sectionIdx) {
    case 0:
      return { x: ampX, y: 0.0, scale: heroScale };
    case 1:
      return { x: -ampX, y: 0.0, scale: storyScale };
    case 2:
      return { x: ampX, y: 0.0, scale: storyScale };
    case 3:
      return { x: -ampX, y: 0.0, scale: storyScale };
    case 4:
    default:
      return { x: 0.0, y: bottomY, scale: horizonScale };
  }
};

export const GlobeCanvas: React.FC<GlobeCanvasProps> = ({
  viewMode = 'landing',
  isAutoRotating = true,
  isRadarActive = true,
  cameraTarget = null,
  hotspots = DEAD_ZONES_DATA,
  primaryFocusId = 'himalayan-arc',
  focusTrigger = 0,
  onHoverHotspot,
  className = '',
  animation = {},
  scrollProgress = 0,
  activeSection = 0,
}) => {
  const primarySpot = hotspots.find((s) => s.id === primaryFocusId) || hotspots[0];
  const defaultLat = primarySpot ? primarySpot.lat : 28.5;
  const defaultLon = primarySpot ? primarySpot.lon : 78.5;
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const containerRef = useRef<HTMLDivElement>(null);
  const onHoverHotspotRef = useRef(onHoverHotspot);
  const prefersReducedMotion = usePrefersReducedMotion();
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const scrollProgressRef = useRef(scrollProgress);
  const activeSectionRef = useRef(activeSection);

  useEffect(() => {
    onHoverHotspotRef.current = onHoverHotspot;
  }, [onHoverHotspot]);

  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);

  // Section Snap: Smoothly snaps globe position and scale into place as user finishes scrolling onto each page
  useEffect(() => {
    activeSectionRef.current = activeSection;
    if (!sceneRef.current) return;
    const { earthGroup } = sceneRef.current;
    const w = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const h = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const target = getSectionConfig(activeSection, w, h, viewMode);

    if (activeSection === 4) {
      // Bottom horizon: smooth glide down into bottom center, 50% above frosted footer
      gsap.to(earthGroup.position, {
        x: target.x,
        y: target.y,
        duration: 1.15,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    } else {
      // Lateral section transitions: slide X, subtle diagonal dip down and recovery to target Y
      gsap.to(earthGroup.position, {
        x: target.x,
        duration: 1.1,
        ease: 'power3.out',
        overwrite: 'auto',
      });
      gsap.timeline({ overwrite: 'auto' })
        .to(earthGroup.position, { y: -0.28, duration: 0.45, ease: 'power2.in' })
        .to(earthGroup.position, { y: target.y, duration: 0.65, ease: 'power3.out' });
    }

    gsap.to(earthGroup.scale, {
      x: target.scale,
      y: target.scale,
      z: target.scale,
      duration: 1.1,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }, [activeSection, viewMode]);

  const sceneRef = useRef<{
    earthGroup: THREE.Group;
    earthMesh: THREE.Mesh;
    camera: THREE.PerspectiveCamera;
    radarMesh: THREE.Mesh;
    orbitRing: THREE.Mesh;
    hotspotGroup: THREE.Group;
    primaryBeaconGroup: THREE.Group;
    isAutoRotating: boolean;
    isRadarActive: boolean;
  } | null>(null);

  // Dynamically update globe lighting when theme changes
  useEffect(() => {
    if (ambientLightRef.current) {
      ambientLightRef.current.color.setHex(isLight ? 0xc4d4c5 : 0x0e1b14);
      ambientLightRef.current.intensity = isLight ? 2.5 : 1.3;
    }
    if (sunLightRef.current) {
      sunLightRef.current.intensity = isLight ? 2.2 : 1.9;
    }
  }, [isLight]);

  // Sync animation flags
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.isAutoRotating = isAutoRotating;
      sceneRef.current.isRadarActive = isRadarActive;
      if (sceneRef.current.radarMesh) {
        sceneRef.current.radarMesh.visible = isRadarActive;
      }
    }
  }, [isAutoRotating, isRadarActive]);

  // Focus Trigger: Smoothly rotate Earth to center on India Hazard Red Zone
  useEffect(() => {
    if (!sceneRef.current || focusTrigger === 0) return;
    const { earthMesh, hotspotGroup, primaryBeaconGroup, camera } = sceneRef.current;

    const targetY = -2.93;
    gsap.to([earthMesh.rotation, hotspotGroup.rotation, primaryBeaconGroup.rotation], {
      y: targetY,
      duration: 1.6,
      ease: 'power3.inOut',
      overwrite: 'auto',
    });
    gsap.to(camera.position, {
      z: 4.8,
      duration: 1.4,
      ease: 'power2.out',
    });
  }, [focusTrigger]);

  // Camera Target transitions
  useEffect(() => {
    if (!sceneRef.current || !cameraTarget) return;
    const { earthMesh, hotspotGroup, primaryBeaconGroup, camera } = sceneRef.current;
    const duration = cameraTarget.duration || 1.4;

    gsap.to([earthMesh.rotation, hotspotGroup.rotation, primaryBeaconGroup.rotation], {
      y: cameraTarget.y,
      duration,
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
    gsap.to(camera.position, {
      z: cameraTarget.dist,
      duration,
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
  }, [cameraTarget]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Strictly measure browser viewport dimensions (never transformed parent container)
    let width = typeof window !== 'undefined' ? window.innerWidth : 1920;
    let height = typeof window !== 'undefined' ? window.innerHeight : 1080;

    // 1. Scene & Perspective Camera at normal framing distance
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 0, 4.8);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    if ('toneMapping' in renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.35;
    }
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100vw';
    renderer.domElement.style.height = '100vh';
    renderer.domElement.style.zIndex = '1';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Directional & Atmospheric Lighting
    const sunLight = new THREE.DirectionalLight(0xfff8ee, isLight ? 2.2 : 1.9);
    sunLight.position.set(6, 4, 4.5);
    sunLightRef.current = sunLight;
    scene.add(sunLight);

    const atmosphereLight = new THREE.DirectionalLight(0x5eead4, 0.6);
    atmosphereLight.position.set(-5, -2, -4);
    scene.add(atmosphereLight);

    const ambientLight = new THREE.AmbientLight(isLight ? 0xc4d4c5 : 0x0e1b14, isLight ? 2.5 : 1.3);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    // 4. Starfield Dust Particles
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 260 + Math.random() * 450;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = r * Math.cos(phi);

      const tint = Math.random();
      starColors[i] = tint > 0.7 ? 0.75 : 0.95;
      starColors[i + 1] = tint > 0.7 ? 0.95 : 0.95;
      starColors[i + 2] = tint > 0.7 ? 0.7 : 0.9;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 5. Earth Group:
    // Moves across the screen in 3D in the empty space next to text!
    // Rotation is centered on its own local origin (0, 0, 0).
    const initialConfig = getSectionConfig(activeSectionRef.current, width, height, viewMode);
    const earthGroup = new THREE.Group();
    earthGroup.rotation.z = 23.4 * (Math.PI / 180);
    earthGroup.position.set(initialConfig.x, initialConfig.y, 0);
    earthGroup.scale.set(initialConfig.scale, initialConfig.scale, initialConfig.scale);
    scene.add(earthGroup);

    // 6. Earth Mesh (Normal size: radius 2.0)
    const proceduralCanvas = generateProceduralEarthCanvas();
    const proceduralTexture = new THREE.CanvasTexture(proceduralCanvas);
    proceduralTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const earthGeo = new THREE.SphereGeometry(2.0, 128, 128);
    const earthMat = new THREE.MeshPhongMaterial({
      map: proceduralTexture,
      shininess: 28,
      specular: new THREE.Color(0x1a3325),
      bumpScale: 0.05,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.rotation.y = -2.93; // India front and center
    earthGroup.add(earthMesh);

    // Background NASA texture loader
    const textureLoader = new THREE.TextureLoader();
    const cdnBase = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/';
    textureLoader.load(
      cdnBase + 'earth_atmos_2048.jpg',
      (tex) => {
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        earthMat.map = tex;
        earthMat.needsUpdate = true;
      },
      undefined,
      () => { }
    );

    // 7. Atmosphere Rim Glow Shader
    const atmosphereGeo = new THREE.SphereGeometry(2.05, 64, 64);
    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(0.35, 0.95, 0.55, 1.0) * intensity * 0.45;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    earthGroup.add(atmosphereMesh);

    // 8. Glowing Lime Elliptical Orbital Trajectory Ring
    const orbitCurve = new THREE.EllipseCurve(0, 0, 2.8, 2.65, 0, 2 * Math.PI, false, 0);
    const curvePoints = orbitCurve.getPoints(128);
    const points3D = curvePoints.map((p) => new THREE.Vector3(p.x, 0, p.y));
    const path3D = new THREE.CatmullRomCurve3(points3D, true);
    const orbitTubeGeo = new THREE.TubeGeometry(path3D, 128, 0.009, 8, true);
    const orbitTubeMat = new THREE.MeshBasicMaterial({
      color: 0xd2f83f,
      transparent: true,
      opacity: 0.65,
    });
    const orbitRing = new THREE.Mesh(orbitTubeGeo, orbitTubeMat);
    orbitRing.rotation.x = Math.PI / 3.4;
    orbitRing.rotation.z = -Math.PI / 6.5;
    earthGroup.add(orbitRing);

    // 9. Secondary Cyber Orbital Radar Sweep Ring
    const radarGeo = new THREE.RingGeometry(2.28, 2.32, 64);
    const radarMat = new THREE.MeshBasicMaterial({
      color: 0xd2f83f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22,
    });
    const radarMesh = new THREE.Mesh(radarGeo, radarMat);
    radarMesh.rotation.x = Math.PI / 2.3;
    earthGroup.add(radarMesh);

    // Coordinate conversion utility
    const latLonToVector3 = (lat: number, lon: number, radius = 2.03) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      return new THREE.Vector3(
        -(radius * Math.sin(phi) * Math.cos(theta)),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
    };

    // 10. Concentric Disaster Hazard Beacon on India
    const primaryBeaconGroup = new THREE.Group();
    primaryBeaconGroup.rotation.y = -2.93;
    earthGroup.add(primaryBeaconGroup);

    const indiaPos = latLonToVector3(defaultLat, defaultLon, 2.035);

    const coreGeo = new THREE.SphereGeometry(0.048, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff1e38 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.copy(indiaPos);
    primaryBeaconGroup.add(coreMesh);

    const rippleRings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
    for (let r = 0; r < 3; r++) {
      const ringGeo = new THREE.RingGeometry(0.04, 0.12, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff2840,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(indiaPos);
      ringMesh.lookAt(new THREE.Vector3(0, 0, 0));
      ringMesh.userData = {
        isRipple: true,
        phase: (r * Math.PI) / 1.5,
        speed: 2.2,
      };
      primaryBeaconGroup.add(ringMesh);
      rippleRings.push(ringMesh);
    }

    // 11. Hotspot Pins for disaster zones
    const hotspotGroup = new THREE.Group();
    hotspotGroup.rotation.y = -2.93;
    earthGroup.add(hotspotGroup);

    hotspots.forEach((spot) => {
      const pos = latLonToVector3(spot.lat, spot.lon);
      const isRed = spot.color > 0xff2000;

      const pinGeo = new THREE.SphereGeometry(isRed ? 0.042 : 0.035, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: spot.color });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.copy(pos);
      pinMesh.userData = spot;

      const auraGeo = new THREE.SphereGeometry(0.08, 16, 16);
      const auraMat = new THREE.MeshBasicMaterial({
        color: spot.color,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });
      const auraMesh = new THREE.Mesh(auraGeo, auraMat);
      auraMesh.position.copy(pos);

      hotspotGroup.add(pinMesh);
      hotspotGroup.add(auraMesh);
    });

    // 12. Direct Sphere Drag Rotation & Scroll-Spin Physics:
    // When user scrolls, the scroll actively spins the globe!
    // When user drags, they rotate the globe around its own center axis!
    let isPointerDown = false;
    let prevPointer = { x: 0, y: 0 };
    let dragVelocity = { x: 0, y: 0 };
    let scrollSpinVelocity = 0;
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

    const domEl = renderer.domElement;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      isPointerDown = true;
      prevPointer = { x: e.clientX, y: e.clientY };
      dragVelocity = { x: 0, y: 0 };
      domEl.style.cursor = 'grabbing';
      try {
        domEl.setPointerCapture(e.pointerId);
      } catch { }
    };

    const handlePointerMoveDrag = (e: PointerEvent) => {
      if (!isPointerDown) return;
      const dx = e.clientX - prevPointer.x;
      const dy = e.clientY - prevPointer.y;
      prevPointer = { x: e.clientX, y: e.clientY };

      const rotSpeed = 0.005;
      dragVelocity = { x: dx * rotSpeed, y: dy * rotSpeed };

      earthMesh.rotation.y += dragVelocity.x;
      hotspotGroup.rotation.y += dragVelocity.x;
      primaryBeaconGroup.rotation.y += dragVelocity.x;

      earthGroup.rotation.x = Math.max(-0.45, Math.min(0.45, earthGroup.rotation.x + dragVelocity.y));
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isPointerDown) {
        isPointerDown = false;
        domEl.style.cursor = 'grab';
        try {
          domEl.releasePointerCapture(e.pointerId);
        } catch { }
      }
    };

    // Scroll spin: responsive, lively rotation as the user scrolls
    const handleScrollSpin = () => {
      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      const deltaY = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      // Increased impulse a bit as requested
      const impulse = deltaY * 0.00045;
      scrollSpinVelocity = Math.max(-0.014, Math.min(0.014, scrollSpinVelocity + impulse));
    };

    const handleWheelSpin = (e: WheelEvent) => {
      const impulse = (e.deltaY || 0) * 0.00035;
      scrollSpinVelocity = Math.max(-0.014, Math.min(0.014, scrollSpinVelocity + impulse));
    };

    domEl.addEventListener('pointerdown', handlePointerDown);
    domEl.addEventListener('pointermove', handlePointerMoveDrag);
    domEl.addEventListener('pointerup', handlePointerUp);
    domEl.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('scroll', handleScrollSpin, { passive: true });
    window.addEventListener('wheel', handleWheelSpin, { passive: true });

    // 13. Raycasting for hover tooltips
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(hotspotGroup.children);

      if (intersects.length > 0 && intersects[0].object.userData.name) {
        const spot = intersects[0].object.userData as HotspotData;
        if (onHoverHotspotRef.current) {
          onHoverHotspotRef.current({
            spot,
            position: { x: e.clientX, y: e.clientY },
          });
        }
      } else {
        if (onHoverHotspotRef.current) {
          onHoverHotspotRef.current(null);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Responsive Resize Handler: strictly updates with window viewport dimensions
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      const target = getSectionConfig(activeSectionRef.current, width, height, viewMode);
      earthGroup.position.set(target.x, target.y, 0);
      earthGroup.scale.set(target.scale, target.scale, target.scale);
    };
    window.addEventListener('resize', handleResize);

    sceneRef.current = {
      earthGroup,
      earthMesh,
      camera,
      radarMesh,
      orbitRing,
      hotspotGroup,
      primaryBeaconGroup,
      isAutoRotating,
      isRadarActive,
    };

    // 14. Animation Render Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = performance.now() * 0.001;

      // Continuous Auto-Rotation: increased a bit as requested
      if (sceneRef.current?.isAutoRotating) {
        earthMesh.rotation.y += 0.0016;
        hotspotGroup.rotation.y += 0.0016;
        primaryBeaconGroup.rotation.y += 0.0016;
      }

      // Smooth 3D scroll & mouse parallax on Earth camera
      if (!prefersReducedMotion) {
        const scrollParallaxY = -scrollProgressRef.current * 0.45;
        const targetCamX = mouse.x * 0.14;
        const targetCamY = scrollParallaxY + mouse.y * 0.12;
        camera.position.x += (targetCamX - camera.position.x) * 0.05;
        camera.position.y += (targetCamY - camera.position.y) * 0.05;
      }

      // Scroll-Driven Spin: lively planetary rotation with smooth inertia damping
      if (Math.abs(scrollSpinVelocity) > 0.00001) {
        earthMesh.rotation.y += scrollSpinVelocity;
        hotspotGroup.rotation.y += scrollSpinVelocity;
        primaryBeaconGroup.rotation.y += scrollSpinVelocity;
        scrollSpinVelocity *= 0.91;
      }

      // Manual drag inertia momentum decay
      if (!isPointerDown) {
        dragVelocity.x *= 0.95;
        dragVelocity.y *= 0.95;
        if (Math.abs(dragVelocity.x) > 0.00005) {
          earthMesh.rotation.y += dragVelocity.x;
          hotspotGroup.rotation.y += dragVelocity.x;
          primaryBeaconGroup.rotation.y += dragVelocity.x;
        }
        if (Math.abs(dragVelocity.y) > 0.00005) {
          earthGroup.rotation.x = Math.max(
            -0.45,
            Math.min(0.45, earthGroup.rotation.x + dragVelocity.y)
          );
        }
      }

      // Orbital lime ring gentle wobble
      if (orbitRing) {
        orbitRing.rotation.y += 0.0004;
      }

      // Cyber Radar Sweep
      if (radarMesh && sceneRef.current?.isRadarActive) {
        radarMesh.rotation.z += 0.008;
        radarMesh.material.opacity = 0.18 + Math.sin(elapsed * 2) * 0.1;
      }

      // Concentric Radar Ripple Waves Animation
      rippleRings.forEach((ring) => {
        const phase = ring.userData.phase || 0;
        const speed = ring.userData.speed || 2.2;
        const progress = ((elapsed * speed + phase) % Math.PI) / Math.PI;
        const scale = 1.0 + progress * 2.8;
        ring.scale.set(scale, scale, 1);
        ring.material.opacity = Math.max(0, (1 - progress) * 0.75);
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      domEl.removeEventListener('pointerdown', handlePointerDown);
      domEl.removeEventListener('pointermove', handlePointerMoveDrag);
      domEl.removeEventListener('pointerup', handlePointerUp);
      domEl.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('scroll', handleScrollSpin);
      window.removeEventListener('wheel', handleWheelSpin);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [hotspots, viewMode]);

  const {
    disabled: animationDisabled = false,
    duration: introDuration = 0.9,
    delay: introDelay = INTRO_TIMINGS.globe,
  } = animation;

  // Fade the WebGL stage in with the rest of the intro
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (animationDisabled || prefersReducedMotion) {
      gsap.set(el, { opacity: 1, scale: 1 });
      return;
    }
    const tween = gsap.fromTo(
      el,
      { opacity: 0, scale: 1.04 },
      {
        opacity: 1,
        scale: 1,
        duration: introDuration,
        delay: introDelay,
        ease: M3_EASE.decelerate,
      }
    );
    return () => {
      tween.kill();
      gsap.set(el, { opacity: 1, scale: 1 });
    };
  }, [animationDisabled, prefersReducedMotion, introDuration, introDelay]);

  return (
    <div
      ref={containerRef}
      id="globe-container"
      className={`fixed inset-0 z-[1] pointer-events-auto cursor-grab active:cursor-grabbing select-none ${className}`}
    />
  );
};
