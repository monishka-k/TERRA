export type HazardSeverity = 'critical_red' | 'high_orange' | 'caution_amber';

export interface HotspotData {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
  severity: HazardSeverity;
  color: number;
  emissiveColor: number;
  pulseRadius: number;
  desc: string;
  intensity: number; // 0 to 1
}

export const DEAD_ZONES_DATA: HotspotData[] = [
  // RED ZONES (Critical Vulnerability & Active Dead Zones)
  {
    id: "himalayan-arc",
    name: "Uttarakhand Himalayan Arc",
    lat: 30.3,
    lon: 78.0,
    type: "DEAD ZONE :: HIGH SLIP",
    severity: "critical_red",
    color: 0xff2244,
    emissiveColor: 0xff0033,
    pulseRadius: 0.12,
    desc: "Severe slope destabilization & seismic rupture zone. 2,847 indexed catastrophic events.",
    intensity: 0.98,
  },
  {
    id: "indo-gangetic-flood",
    name: "Gangetic Basin Dead Zone",
    lat: 25.6,
    lon: 85.1,
    type: "DEAD ZONE :: FLOOD DELUGE",
    severity: "critical_red",
    color: 0xff3355,
    emissiveColor: 0xff0022,
    pulseRadius: 0.11,
    desc: "Uninhabitable monsoon sedimentation surge belt.",
    intensity: 0.94,
  },
  {
    id: "sunda-megathrust",
    name: "Sunda Trench Megathrust",
    lat: -0.5,
    lon: 99.5,
    type: "DEAD ZONE :: TSUNAMIGENIC",
    severity: "critical_red",
    color: 0xff1e38,
    emissiveColor: 0xff0022,
    pulseRadius: 0.13,
    desc: "Subduction collision generating mega-tsunamis and rapid coastal loss.",
    intensity: 0.99,
  },
  {
    id: "japan-triple-junction",
    name: "Japan Sagami Trench",
    lat: 35.6,
    lon: 139.7,
    type: "DEAD ZONE :: MEGA-QUAKE",
    severity: "critical_red",
    color: 0xff2244,
    emissiveColor: 0xff0033,
    pulseRadius: 0.12,
    desc: "Triple plate junction with extreme recurring liquefaction danger.",
    intensity: 0.96,
  },
  {
    id: "chile-subduction",
    name: "Atacama Subduction Fault",
    lat: -23.8,
    lon: -70.4,
    type: "DEAD ZONE :: MEGA-SEISMIC",
    severity: "critical_red",
    color: 0xff2840,
    emissiveColor: 0xff0028,
    pulseRadius: 0.11,
    desc: "Nazca-South American convergence causing extreme trench deformation.",
    intensity: 0.95,
  },

  // ORANGE ZONES (High Vulnerability & Accelerated Degradation)
  {
    id: "gujarat-kutch",
    name: "Rann of Kutch Intraplate Zone",
    lat: 23.4,
    lon: 70.2,
    type: "HAZARD ORANGE :: SEISMIC V",
    severity: "high_orange",
    color: 0xff7b00,
    emissiveColor: 0xff5500,
    pulseRadius: 0.09,
    desc: "Intraplate blind thrust fault with severe soil liquefaction susceptibility.",
    intensity: 0.88,
  },
  {
    id: "san-andreas-fault",
    name: "San Andreas Transform Zone",
    lat: 37.7,
    lon: -122.4,
    type: "HAZARD ORANGE :: STRIKE-SLIP",
    severity: "high_orange",
    color: 0xff8c00,
    emissiveColor: 0xff6600,
    pulseRadius: 0.09,
    desc: "Major shear margin with high probability rupture forecast.",
    intensity: 0.85,
  },
  {
    id: "east-african-rift",
    name: "Afar Triple Rift Zone",
    lat: 11.5,
    lon: 41.5,
    type: "HAZARD ORANGE :: TECTONIC RIFT",
    severity: "high_orange",
    color: 0xff7700,
    emissiveColor: 0xff4400,
    pulseRadius: 0.1,
    desc: "Continental breakup zone active with thermal magma anomalies.",
    intensity: 0.87,
  },
  {
    id: "mediterranean-arc",
    name: "Hellenic Subduction Arc",
    lat: 35.2,
    lon: 25.0,
    type: "HAZARD ORANGE :: SUBDUCTION",
    severity: "high_orange",
    color: 0xff8000,
    emissiveColor: 0xff5000,
    pulseRadius: 0.08,
    desc: "African-Eurasian collision causing submarine landslides and quakes.",
    intensity: 0.82,
  },
  {
    id: "brahmaputra-floodway",
    name: "Brahmaputra Erosion Corridor",
    lat: 26.2,
    lon: 92.9,
    type: "HAZARD ORANGE :: FLASH INUNDATION",
    severity: "high_orange",
    color: 0xff9100,
    emissiveColor: 0xff6200,
    pulseRadius: 0.08,
    desc: "Rapid riverbank scouring and seasonal habitation wipeout.",
    intensity: 0.84,
  },
];
