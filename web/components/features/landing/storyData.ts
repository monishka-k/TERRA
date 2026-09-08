export interface StorySectionData {
  id: string;
  index: string;
  align: 'left' | 'right';
  badge: string;
  badgeTone?: 'critical' | 'warning' | 'emerald' | 'citron';
  title: string;
  subtitle: string;
  description: string;
  pills: string[];
  metrics: { value: string; label: string }[];
  actionLabel?: string;
  actionHref?: string;
}

export const LANDING_STORIES: StorySectionData[] = [
  {
    id: 'triage-engine',
    index: '01',
    align: 'right', // Globe on left, text on right
    badge: 'UBER H3 RESOLUTION-8 CLUSTERING',
    badgeTone: 'critical',
    title: 'Geospatial Hazard Triage',
    subtitle: 'High-density climate exposure modeling & automated habitation escalation',
    description:
      'Continuous spatial indexing across Uttarakhand and Himalayan riverine corridors. SETU-DRR aggregates precipitation thresholds, slope rupture gradients, and seismic fault proximity into real-time hexagonal triage clusters, classifying vulnerable villages into Urgent Relocation and Caseload Watch tiers.',
    pills: ['Sub-100m Resolution', 'Dynamic Flash Flood Watch', 'Zero Blindspot Coverage'],
    metrics: [
      { value: '14', label: 'Tier-1 Critical Red Zones' },
      { value: '4.2x', label: 'Lead-Time Advantage' },
    ],
    actionLabel: 'Explore Triage Engine',
    actionHref: '/login',
  },
  {
    id: 'sovi-relocation',
    index: '02',
    align: 'left', // Globe on right, text on left
    badge: 'HUMAN RESILIENCE & TOPOGRAPHY',
    badgeTone: 'emerald',
    title: 'Social Vulnerability & Relocation',
    subtitle: 'Explainable AI scoring for safe habitation site selection',
    description:
      'Moving habitations is not merely civil engineering—it is preserving social fabric. Our multi-criteria suitability engine pairs census-level SoVI indices with LiDAR elevation, road connectivity, and hydrological safety to match displaced families with sustainable, hazard-free resettlement corridors.',
    pills: ['SoVI Demographic Weighting', 'LiDAR Slope Analysis', 'SHAP Model Explainability'],
    metrics: [
      { value: '98.2%', label: 'Topological Safety Match' },
      { value: '48h', label: 'Corridor Optimization' },
    ],
    actionLabel: 'View Relocation Models',
    actionHref: '/login',
  },
  {
    id: 'sar-radar',
    index: '03',
    align: 'right', // Globe on left, text on right
    badge: 'ORBITAL SYNTHETIC APERTURE RADAR',
    badgeTone: 'citron',
    title: 'Sentinel InSAR Telemetry',
    subtitle: 'Millimeter-scale ground displacement radar feeds with automated alerts',
    description:
      'Sub-surface moisture saturation and micro-fractures often precede catastrophic mass-wasting events. SETU-DRR synchronizes with dual-frequency satellite radar sweeps, detecting ground creep before visible landslides occur and triggering immediate SMS and radio dispatch to district magistrate control rooms.',
    pills: ['Sentinel-1 SAR Feeds', 'Millimeter Deformation', 'NDRF Auto-Dispatch'],
    metrics: [
      { value: '2.4mm', label: 'Deformation Detection' },
      { value: '24 / 7', label: 'Continuous Orbital Sweep' },
    ],
    actionLabel: 'Launch Radar Sweeps',
    actionHref: '/login',
  },
];
