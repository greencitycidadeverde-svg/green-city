export type MissionStage = 'collect' | 'deliver' | 'solar' | 'vehicle' | 'complete';
export type PortMissionStage = 'inspect' | 'treatment' | 'septic' | 'collect' | 'deliver' | 'sorting' | 'complete';
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
  | 'sort-cooperative-materials';

export interface MapObjective {
  id: string;
  label: string;
  x: number;
  z: number;
  status: 'done' | 'next' | 'upcoming';
}

export interface GameProgressData {
  phase: 1 | 2;
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
}

export interface GameSnapshot {
  phase: 1 | 2;
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
