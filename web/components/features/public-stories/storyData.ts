export type ZoneId = 'North' | 'West' | 'Central' | 'East' | 'South';

export interface StorySlide {
  id: string;
  title: string;
  subtitle: string;
  hazardType: string;
  riskSeverity: 'Critical' | 'High' | 'Moderate' | 'Monitored';
  image: string;
  description: string;
  telemetry: {
    label: string;
    value: string;
  }[];
  mitigation: string;
}

export interface ZoneStoryData {
  id: ZoneId;
  label: string;
  regionName: string;
  coordinates: {
    display: {
      lat: string;
      lng: string;
    };
    raw: {
      lat: number;
      lng: number;
    };
  };
  mapCoords: {
    x: number; // percentage on SVG
    y: number;
  };
  previewImage: string;
  shortSummary: string;
  primaryHazard: string;
  slides: StorySlide[];
}

export const REGIONAL_STORIES: Record<ZoneId, ZoneStoryData> = {
  North: {
    id: 'North',
    label: 'North',
    regionName: 'Joshimath & Chamoli Basin, Uttarakhand',
    coordinates: {
      display: {
        lat: 'N 30° 33\' 21.648"',
        lng: 'E 79° 34\' 01.192"',
      },
      raw: { lat: 30.556, lng: 79.567 },
    },
    mapCoords: { x: 42, y: 22 },
    previewImage: '/stories/north.jpg',
    primaryHazard: 'Subsidence & Slope Shear',
    shortSummary:
      'Perched at 1,890m on prehistoric glacial debris, Joshimath sits on the Main Central Thrust. Intermittent tectonic creep and rapid groundwater saturation triggered deep ground fissures across Sunil and Manohar Bagh wards.',
    slides: [
      {
        id: 'north-1',
        title: 'The Sinking Foothills of Joshimath',
        subtitle: 'Main Central Thrust & Slump Escarpments',
        hazardType: 'Tectonic Subsidence',
        riskSeverity: 'Critical',
        image: '/stories/north.jpg',
        description:
          'In January 2023, widespread cracking fractured over 800 structures across Joshimath. Siting on moraine colluvium without consolidated bedrock, extreme seasonal infiltration accelerates toe-erosion along the Alaknanda riverbed.',
        telemetry: [
          { label: 'Elevation', value: '1,890 m' },
          { label: 'Slope Gradient', value: '38°' },
          { label: 'Subsidence Velocity', value: '5.4 cm/month' },
          { label: 'Population Exposed', value: '3,420 souls' },
        ],
        mitigation:
          'Real-time InSAR SAR satellite interferometry coupled with extensometer boreholes provides continuous early warnings.',
      },
      {
        id: 'north-2',
        title: 'Geological Anatomy: Prehistoric Moraine',
        subtitle: 'Why the Foundation is Liquefying',
        hazardType: 'Slope Shear Failure',
        riskSeverity: 'Critical',
        image: '/stories/north.jpg',
        description:
          'Geotechnical soil cores reveal unconsolidated boulders embedded in sandy-silty matrix. When unchanneled household wastewater and heavy monsoon downpours saturate the stratum, internal friction drops by 65%.',
        telemetry: [
          { label: 'Soil Saturation', value: '91%' },
          { label: 'Recent Rainfall', value: '218 mm' },
          { label: 'Active Fissures', value: '14 Major' },
          { label: 'NDRF Status', value: 'Tier 1 Standby' },
        ],
        mitigation:
          'Underground toe drainage galleries and rock-bolting along river cliffs to halt toe scouring.',
      },
      {
        id: 'north-3',
        title: 'Frontline Community Resilience: Sunil Ward',
        subtitle: 'Lived Realities of Himalayan Relocation',
        hazardType: 'Displacement Risk',
        riskSeverity: 'High',
        image: '/stories/north.jpg',
        description:
          'Generations of apple orchardists and pilgrimage trail keepers faced sudden evacuation orders. The SETU-DRR platform triages high-risk clusters, matching families with stable bedrock plateaus.',
        telemetry: [
          { label: 'Evacuated Families', value: '296' },
          { label: 'Temporary Shelters', value: '18 Camps' },
          { label: 'Livelihood Retain', value: '74%' },
          { label: 'Community Trust', value: 'High' },
        ],
        mitigation:
          'Participatory town-hall mapping of community grazing corridors to preserve generational bonds during relocation.',
      },
      {
        id: 'north-4',
        title: 'Safe Haven: Bhatoli Plateau Sanctuary',
        subtitle: 'Category-C State Bedrock Benchmark',
        hazardType: 'Resettlement Solution',
        riskSeverity: 'Monitored',
        image: '/stories/north.jpg',
        description:
          'Identified by automated OR-Tools spatial matching, the Bhatoli Plateau offers 8.4° gentle slope gradients on competent sandstone bedrock, 8.4 km away from the shear zone.',
        telemetry: [
          { label: 'Distance from Hazard', value: '8.4 km' },
          { label: 'Bedrock Type', value: 'Sandstone' },
          { label: 'Water Source Capacity', value: '140 L/day' },
          { label: 'Road Link Feasibility', value: '4.2 km needed' },
        ],
        mitigation:
          'Construction of prefabricated eco-timber dwellings with integrated solar micro-grids and rainwater percolation ponds.',
      },
    ],
  },
  South: {
    id: 'South',
    label: 'South',
    regionName: 'Wayanad (Meppadi–Chooralmala), Kerala',
    coordinates: {
      display: {
        lat: 'N 11° 33\' 14.412"',
        lng: 'E 76° 07\' 33.628"',
      },
      raw: { lat: 11.554, lng: 76.126 },
    },
    mapCoords: { x: 44, y: 78 },
    previewImage: '/stories/south.jpg',
    primaryHazard: 'Catastrophic Debris Flows',
    shortSummary:
      'The Western Ghats escarpment at Meppadi experienced unprecedented cloudburst-triggered debris avalanches, mobilizing millions of tonnes of saturated regolith down steep tea estate gorges.',
    slides: [
      {
        id: 'south-1',
        title: 'The Chooralmala Cloudburst Inundation',
        subtitle: 'Western Ghats Orographic Catastrophe',
        hazardType: 'Debris Avalanche',
        riskSeverity: 'Critical',
        image: '/stories/south.jpg',
        description:
          'Over 372 mm of rain fell in 24 hours over the Vellarimala ridgeline. The saturated overburden failed at 1,200m elevation, funneling massive granite boulders and mud slurries through Chooralmala and Mundakkai townships.',
        telemetry: [
          { label: '24h Rainfall Record', value: '372 mm' },
          { label: 'Slope Angle', value: '42°' },
          { label: 'Debris Velocity', value: '48 km/h' },
          { label: 'PRZ Area Designated', value: '14.2 km²' },
        ],
        mitigation:
          'Designation of permanent 300m riparian exclusion buffers and hydro-meteorological rain gauge arrays.',
      },
      {
        id: 'south-2',
        title: 'Geomorphology of Western Ghats Soils',
        subtitle: 'Laterite Crust over Weathered Gneiss',
        hazardType: 'Soil Liquefaction',
        riskSeverity: 'Critical',
        image: '/stories/south.jpg',
        description:
          'Subsurface pipe erosion (piping) creates hidden conduits inside steep tea hillocks. When hydrostatic pressure peaks, the entire hillside delaminates from the slick metamorphic bedrock below.',
        telemetry: [
          { label: 'Pore Pressure Index', value: '96%' },
          { label: 'Basal Shear Depth', value: '4.8 m' },
          { label: 'Exposed Habitations', value: '520 Homes' },
          { label: 'MHI Score', value: '0.89' },
        ],
        mitigation:
          'Deep borehole drainage relief wells and acoustic sensor arrays to detect micro-tremors preceding mass movements.',
      },
      {
        id: 'south-3',
        title: 'Tea Worker Hamlets: The Cost of Exposure',
        subtitle: 'Frontline Estate Quarters & Vulnerability',
        hazardType: 'Socio-Economic Exposure',
        riskSeverity: 'High',
        image: '/stories/south.jpg',
        description:
          'Plantation line-houses (layams) historically constructed along low-gradient stream flats absorbed the blunt kinetic force. SETU-DRR guarantees equitable relocation that maintains access to regional plantation employment.',
        telemetry: [
          { label: 'Households Relocated', value: '520' },
          { label: 'Relocation Distance', value: '< 12 km' },
          { label: 'State Relief Fund', value: '₹100 Cr' },
          { label: 'School Access Target', value: '< 2.5 km' },
        ],
        mitigation:
          'Rapid allotment of foothill tea-estate fringe lands held under Government Category-A revenue lease.',
      },
      {
        id: 'south-4',
        title: 'Foothill Resettlement: Kalpetta East Ridge',
        subtitle: 'Safe Gentle Terraces with Sustainable Infrastructure',
        hazardType: 'Safe Haven Benchmark',
        riskSeverity: 'Monitored',
        image: '/stories/south.jpg',
        description:
          'Located out of the alluvial fan zone, the Kalpetta East Ridge sits upon stable hornblende gneiss with a mild 6.2° gradient, providing immediate connectivity to State Highway 59.',
        telemetry: [
          { label: 'Terrain Slope', value: '6.2°' },
          { label: 'Elevation Buffer', value: '+140m above river' },
          { label: 'Hospital Access', value: '14 min' },
          { label: 'Solar Potential', value: '5.2 kWh/m²' },
        ],
        mitigation:
          'Decentralized bamboo-reinforced earth construction with indigenous vetiver grass terracing for slope protection.',
      },
    ],
  },
  East: {
    id: 'East',
    label: 'East',
    regionName: 'Barpeta & Teesta Gorge, Assam & Sikkim',
    coordinates: {
      display: {
        lat: 'N 26° 19\' 12.000"',
        lng: 'E 91° 00\' 36.000"',
      },
      raw: { lat: 26.32, lng: 91.01 },
    },
    mapCoords: { x: 74, y: 38 },
    previewImage: '/stories/east.jpg',
    primaryHazard: 'Braided Flood Inundation & GLOF',
    shortSummary:
      'The Brahmaputra river plain in Assam and the high-altitude Teesta River in Sikkim represent India\'s most volatile hydrologic systems, where glacial bursts upstream meet massive floodplain avulsions downstream.',
    slides: [
      {
        id: 'east-1',
        title: 'Teesta III Dam Breach & Glacial Outburst',
        subtitle: 'South Lhonak Lake Surge Corridor',
        hazardType: 'Glacial Lake Outburst Flood',
        riskSeverity: 'Critical',
        image: '/stories/east.jpg',
        description:
          'In October 2023, a massive ice-avalanche into South Lhonak Glacial Lake discharged millions of cubic meters of water, destroying the Chungthang dam and obliterating low-lying settlements downstream.',
        telemetry: [
          { label: 'Peak Surge Height', value: '18.4 m' },
          { label: 'Discharge Rate', value: '14,000 m³/s' },
          { label: 'Downstream Velocity', value: '55 km/h' },
          { label: 'Warning Lead Time', value: '22 min' },
        ],
        mitigation:
          'Automated satellite radar altimetry alarms on all high-altitude glacial lakes in the eastern Himalayas.',
      },
      {
        id: 'east-2',
        title: 'Brahmaputra Embankment Breach: Barpeta Char',
        subtitle: 'Perennial River Migration & Sandbar Vulnerability',
        hazardType: 'Fluvial Inundation',
        riskSeverity: 'High',
        image: '/stories/east.jpg',
        description:
          'River chars (shifting silt islands) in Barpeta are completely submerged during annual peak monsoon discharges. Families dismantle their homes up to 6 times a decade to outrun collapsing riverbanks.',
        telemetry: [
          { label: 'Bank Erosion Rate', value: '120 m/year' },
          { label: 'Submerged Acreage', value: '4,200 ha' },
          { label: 'Displaced Population', value: '31,500' },
          { label: 'S1 SAR Inundation Freq', value: '88%' },
        ],
        mitigation:
          'Geotextile sand-tube revetments and drone-monitored braided channel bathymetry to predict avulsion channels.',
      },
      {
        id: 'east-3',
        title: 'Floating Classrooms & High-Plinth Clusters',
        subtitle: 'Community Ingenuity in the Flood Regime',
        hazardType: 'Community Adaptation',
        riskSeverity: 'Moderate',
        image: '/stories/east.jpg',
        description:
          'Rather than resisting the flood regime, local communities construct homes on 3-meter elevated earthen mounds with bamboo stilts, accompanied by solar-powered boat schools and mobile healthcare flotillas.',
        telemetry: [
          { label: 'Plinth Elevation', value: '+3.2 m' },
          { label: 'Solar Boat Coverage', value: '42 Chars' },
          { label: 'Livestock High-Grounds', value: '16 Benches' },
          { label: 'Water Filtration Units', value: '100% Mobile' },
        ],
        mitigation:
          'Scaling elevated cluster villages with permanent community grain storage and high-elevation drinking water bores.',
      },
      {
        id: 'east-4',
        title: 'Permanent Relocation: Barpeta High Ridge',
        subtitle: 'Alluvial High Terrace Relocation Scheme',
        hazardType: 'Sustainable Relocation',
        riskSeverity: 'Monitored',
        image: '/stories/east.jpg',
        description:
          'SETU-DRR prioritized the Barpeta High Ridge site, 14 km inland, protected by natural paleochannel levees with zero historical breach records over the last 70 years.',
        telemetry: [
          { label: 'Flood Free Margin', value: '+5.5 m AMSL' },
          { label: 'Distance from River', value: '14 km' },
          { label: 'Cultivable Alluvium', value: '850 Acres' },
          { label: 'Tenure Regularization', value: 'Pattas Issued' },
        ],
        mitigation:
          'Construction of flood-resilient agro-processing cooperatives and deep perennial irrigation channels.',
      },
    ],
  },
  West: {
    id: 'West',
    label: 'West',
    regionName: 'Kutch Mainland Basin, Gujarat',
    coordinates: {
      display: {
        lat: 'N 23° 20\' 31.200"',
        lng: 'E 69° 49\' 15.600"',
      },
      raw: { lat: 23.342, lng: 69.821 },
    },
    mapCoords: { x: 22, y: 46 },
    previewImage: '/stories/west.jpg',
    primaryHazard: 'Intraplate Seismic Thrust & Soil Liquefaction',
    shortSummary:
      'The Kutch rift basin is an active intraplate fault system where blind thrust faults generate deep seismic shear, causing extensive soil liquefaction and long-term ground subsidence across coastal salt marsh edges.',
    slides: [
      {
        id: 'west-1',
        title: 'The Kutch Blind Thrust Fault',
        subtitle: 'Intraplate Seismic Rupture Dynamics',
        hazardType: 'Seismic Rupture',
        riskSeverity: 'High',
        image: '/stories/west.jpg',
        description:
          'The 2001 Bhuj event proved that blind thrust faults beneath the Kutch plain accumulate immense strain. Deep InSAR interferograms reveal localized surface warping of 2.1 mm/year along the Mainland Fault.',
        telemetry: [
          { label: 'Seismic Zone', value: 'Zone V (Highest)' },
          { label: 'Fault Length', value: '150 km' },
          { label: 'Liquefaction Potential', value: 'Severe' },
          { label: 'Exposed Population', value: '3,110' },
        ],
        mitigation:
          'Continuous GPS geodesy networks and automated seismic alert relays integrated into national emergency channels.',
      },
      {
        id: 'west-2',
        title: 'Salt Marsh Subsidence & Cyclonic Surges',
        subtitle: 'Compound Coastal Flooding in the Rann',
        hazardType: 'Coastal Inundation',
        riskSeverity: 'Moderate',
        image: '/stories/west.jpg',
        description:
          'Subsidence of coastal mudflats intensifies Arabian Sea cyclone storm surges. Seawater pushes up to 18 km inland through creeks, contaminating scarce groundwater aquifers with hypersaline brine.',
        telemetry: [
          { label: 'Salinity Intrusion', value: '18 km Inland' },
          { label: 'Cyclone Surge Risk', value: '4.8 m' },
          { label: 'Subsidence Rate', value: '3.1 mm/year' },
          { label: 'Groundwater TDS', value: '4,800 ppm' },
        ],
        mitigation:
          'Subsurface saline barrier cutoff walls and multi-species mangrove afforestation along tidal creeks.',
      },
      {
        id: 'west-3',
        title: 'Bhunga Architecture: 200 Years of Wisdom',
        subtitle: 'Earthquake-Defying Traditional Cylindrical Dwellings',
        hazardType: 'Indigenous Architecture',
        riskSeverity: 'Monitored',
        image: '/stories/west.jpg',
        description:
          'Following the devastating 2001 earthquake, circular mud-and-thatch "Bhunga" houses remained completely intact while concrete buildings collapsed. Their cylindrical geometry evenly distributes lateral seismic forces.',
        telemetry: [
          { label: 'Seismic Resistance', value: 'Magnitude 8.0+' },
          { label: 'Thermal Comfort', value: '12°C Cooler' },
          { label: 'Local Materials', value: 'Clay, Bamboo, Straw' },
          { label: 'Rebuild Time', value: '14 Days' },
        ],
        mitigation:
          'Codifying vernacular Bhunga engineering into modern rural disaster housing codes and insurance incentives.',
      },
      {
        id: 'west-4',
        title: 'Inland Rock Bench Relocation: Habo Hill',
        subtitle: 'Seismically Isolated Bedrock Sanctuary',
        hazardType: 'Relocation Destination',
        riskSeverity: 'Monitored',
        image: '/stories/west.jpg',
        description:
          'Habo Hill offers stable Jurassic sandstone bedrock well elevated above salt flat surge levels, free from liquefaction-prone fine silt and clay beds.',
        telemetry: [
          { label: 'Bedrock Age', value: 'Jurassic Sandstone' },
          { label: 'Elevation above Rann', value: '+65 m' },
          { label: 'Desalination Hub Link', value: '6.5 km' },
          { label: 'Buffer from Fault', value: '12 km' },
        ],
        mitigation:
          'Constructing seismically isolated community centers with integrated rooftop water harvesting reservoirs.',
      },
    ],
  },
  Central: {
    id: 'Central',
    label: 'Central',
    regionName: 'Satpura & Vindhyachal Heartland, Madhya Pradesh',
    coordinates: {
      display: {
        lat: 'N 22° 30\' 18.000"',
        lng: 'E 77° 45\' 42.000"',
      },
      raw: { lat: 22.505, lng: 77.761 },
    },
    mapCoords: { x: 46, y: 50 },
    previewImage: '/stories/central.jpg',
    primaryHazard: 'Climate Buffer & Ecological Baseline',
    shortSummary:
      'The ancient crystalline basalt shield of Central India represents the geologically stable core of the subcontinent, serving as a vital ecological corridor, catchment sponge, and national relocation baseline.',
    slides: [
      {
        id: 'central-1',
        title: 'The Resilient Heartland: Deccan Basalt Shield',
        subtitle: 'Ancient Stable Craton & Watershed Anchor',
        hazardType: 'Low Geological Hazard',
        riskSeverity: 'Monitored',
        image: '/stories/central.jpg',
        description:
          'Unlike the Himalayan fold mountains or coastal deltas, the Central Indian shield features deep, ancient basalt bedrock with exceptional tectonic stability. It forms the benchmark control region in the SETU-DRR model.',
        telemetry: [
          { label: 'Seismic Zone', value: 'Zone II (Lowest)' },
          { label: 'Bedrock Thickness', value: '800+ m Basalt' },
          { label: 'Slope Stability Index', value: '0.98 (Stable)' },
          { label: 'Water Table Depth', value: '18 m' },
        ],
        mitigation:
          'Preservation of continuous Sal and Teak canopy forests to protect the headwaters of the Narmada and Tapti river systems.',
      },
      {
        id: 'central-2',
        title: 'Forest Canopy as Climate Heat Buffer',
        subtitle: 'Thermal Inversion & Microclimate Regulation',
        hazardType: 'Extreme Heat Stress',
        riskSeverity: 'Moderate',
        image: '/stories/central.jpg',
        description:
          'While seismic and landslide risks are negligible, central plains face severe summer heatwaves exceeding 47°C. The dense Satpura hill canopy reduces ambient surface temperatures by up to 6.8°C.',
        telemetry: [
          { label: 'Canopy Cooling Delta', value: '-6.8°C' },
          { label: 'Forest Cover', value: '62%' },
          { label: 'Soil Organic Carbon', value: '1.4%' },
          { label: 'Heat Index Level', value: 'High in May' },
        ],
        mitigation:
          'Community agroforestry corridors and misting bioclimatic community pavilions in rural market centers.',
      },
      {
        id: 'central-3',
        title: 'Indigenous Gond & Baiga Forest Knowledge',
        subtitle: 'Living in Harmony with Nature Reserves',
        hazardType: 'Ecological Stewardship',
        riskSeverity: 'Monitored',
        image: '/stories/central.jpg',
        description:
          'Indigenous tribal councils manage sacred groves and water stepwells (baolis) that maintain year-round moisture regimes without electrical pumping, proving that traditional water conservation outlasts mechanical dams.',
        telemetry: [
          { label: 'Traditional Stepwells', value: '142 Active' },
          { label: 'Sacred Groves', value: '88 Protected' },
          { label: 'Rainwater Retention', value: '84%' },
          { label: 'Biodiversity Index', value: '0.92' },
        ],
        mitigation:
          'Community-led forest tenure rights documentation to protect indigenous conservation reserves.',
      },
      {
        id: 'central-4',
        title: 'National Strategic Relocation Reserve',
        subtitle: 'Long-Term Sanctuary for High-Risk Populations',
        hazardType: 'Sanctuary Benchmark',
        riskSeverity: 'Monitored',
        image: '/stories/central.jpg',
        description:
          'Because of its geological permanence and abundant solar radiation, the central plateau is being assessed as India’s strategic buffer for long-term climate resettlement institutions and research reserves.',
        telemetry: [
          { label: 'Geological Permanence', value: '500+ Million Yrs' },
          { label: 'Solar Irradiance', value: '5.8 kWh/m²' },
          { label: 'Highway & Rail Grid', value: '4 National Hubs' },
          { label: 'Ecological Carrying Cap', value: 'Optimal' },
        ],
        mitigation:
          'Developing eco-sanctuary research facilities and climate data centers powered 100% by renewable microgrids.',
      },
    ],
  },
};
