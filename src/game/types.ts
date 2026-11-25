export type MissionStage = 'collect' | 'deliver' | 'solar' | 'vehicle' | 'complete';
export type PortMissionStage = 'inspect' | 'treatment' | 'septic' | 'collect' | 'deliver' | 'sorting' | 'complete';
export type PeripheryMissionStage = 'survey' | 'collect' | 'sorting' | 'compost' | 'sanitation' | 'rain-garden' | 'complete';
export type ForestMissionStage = 'survey' | 'harvest' | 'transport' | 'process' | 'market' | 'sorting' | 'cooperative' | 'restore' | 'complete';
export type NearbyAction =
  | 'collect-waste'
  | 'deliver-waste'
  | 'enter-vehicle'
  | 'exit-vehicle'
  | 'install-building-solar'
  | 'convert-vehicle'
  | 'inspect-outfall'
  | 'install-treatment'
  | 'install-septic'
  | 'collect-company-waste'
  | 'deliver-cooperative'
  | 'sort-cooperative-materials'
  | 'inspect-neighborhood-issue'
  | 'collect-community-waste'
  | 'sort-community-organics'
  | 'sort-community-recyclables'
  | 'turn-community-compost'
  | 'connect-community-sewer'
  | 'build-rain-garden'
  | 'inspect-forest-habitat' | 'harvest-farm-produce' | 'load-farm-truck' | 'process-food-products'
  | 'stock-local-market' | 'sort-consumer-packaging' | 'deliver-forest-cooperative'
  | 'plant-native-seedling' | 'protect-forest-spring' | 'record-forest-wildlife' | 'inspect-forest-fire-prevention';

export interface LearningNotice {
  id: number;
  eyebrow: string;
  title: string;
  description: string;
  destination: string;
  afterwards: string;
}

export interface MapObjective {
  id: string;
  label: string;
  x: number;
  z: number;
  status: 'done' | 'next' | 'upcoming';
}

export interface GameProgressData {
  phase: 1 | 2 | 3 | 4;
  cit: number;
  collectedWaste: boolean[];
  deliveredWaste: boolean;
  solarBuildings: boolean[];
  electricVehicle: boolean;
  missionStage: MissionStage;
  outfallsInspected: number[];
  treatmentInstalled: boolean;
  septicInstalled: boolean[];
  companyWasteCollected: boolean[];
  cooperativeSorted: boolean[];
  portMissionStage: PortMissionStage;
  portWaterQuality: number;
  peripheryMissionStage: PeripheryMissionStage;
  communityIssuesInspected: number[];
  communityWasteCollected: boolean[];
  communityOrganicDeposited?: boolean[];
  communityRecyclableDeposited?: boolean[];
  communityOrganicsSorted: boolean;
  communityRecyclablesSorted: boolean;
  communityCompostTurned: boolean;
  communitySewerConnected: boolean[];
  communityRainGardenBuilt: boolean;
  forestMissionStage?: ForestMissionStage;
  forestHabitatsInspected?: boolean[];
  forestProduceHarvested?: boolean[];
  forestTruckLoaded?: boolean;
  forestProcessed?: boolean;
  forestMarketStocked?: boolean;
  forestPackagingSorted?: boolean[];
  forestPackagingLegacy?: boolean;
  forestCooperativeDelivered?: boolean;
  forestSeedlingsPlanted?: boolean[];
  forestSpringProtected?: boolean;
  forestWildlifeRecorded?: boolean;
  forestFirePreventionInspected?: boolean;
}

export interface GameSnapshot {
  phase: 1 | 2 | 3 | 4;
  completedNeighborhoods: number;
  thirdNeighborhoodUnlocked: boolean;
  portMissionStage: PortMissionStage;
  outfallsInspected: number;
  outfallsTotal: number;
  treatmentInstalled: boolean;
  septicInstalled: number;
  septicTotal: number;
  companyWasteCollected: number;
  companyWasteTotal: number;
  cooperativeSorted: number;
  cooperativeTotal: number;
  waterQuality: number;
  peripheryMissionStage: PeripheryMissionStage;
  communityIssuesInspected: number;
  communityIssuesTotal: number;
  communityWasteCollected: number;
  communityWasteTotal: number;
  communityOrganicDeposited: number;
  communityOrganicTotal: number;
  communityRecyclableDeposited: number;
  communityRecyclableTotal: number;
  learningNotice: LearningNotice | null;
  communityOrganicsSorted: boolean;
  communityRecyclablesSorted: boolean;
  communityCompostTurned: boolean;
  communitySewerConnections: number;
  communitySewerTotal: number;
  communityRainGardenBuilt: boolean;
  communityWaterQuality: number;
  forestMissionStage: ForestMissionStage;
  forestHabitatsInspected: number;
  forestHabitatsTotal: number;
  forestProduceHarvested: number;
  forestProduceTotal: number;
  forestTruckLoaded: boolean;
  forestProcessed: boolean;
  forestMarketStocked: boolean;
  forestPackagingSorted: number;
  forestPackagingTotal: number;
  forestCooperativeDelivered: boolean;
  forestSeedlingsPlanted: number;
  forestSeedlingsTotal: number;
  forestSpringProtected: boolean;
  forestWildlifeRecorded: boolean;
  forestFirePreventionInspected: boolean;
  cit: number;
  collected: number;
  total: number;
  delivered: boolean;
  solarBuildingsInstalled: number;
  solarBuildingsTotal: number;
  electricVehicle: boolean;
  recyclingRate: number;
  renewableShare: number;
  sustainableMobility: number;
  airQuality: number;
  missionStage: MissionStage;
  nextNeighborhoodUnlocked: boolean;
  paused: boolean;
  mapOpen: boolean;
  mapObjectives: MapObjective[];
  nextObjectiveLabel: string;
  inVehicle: boolean;
  vehicleSpeed: number;
  nearbyAction: NearbyAction | null;
  nearbyLabel: string;
  playerX: number;
  playerZ: number;
  vehicleX: number;
  vehicleZ: number;
  message: string;
  progressData: GameProgressData;
}
export type SnapshotListener = (snapshot: GameSnapshot) => void;
