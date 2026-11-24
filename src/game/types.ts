export type MissionStage = 'collect' | 'deliver' | 'solar' | 'vehicle' | 'complete';
export type PortMissionStage = 'inspect' | 'treatment' | 'septic' | 'collect' | 'complete';
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
  | 'collect-company-waste';

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
  inVehicle: boolean;
  vehicleSpeed: number;
  nearbyAction: NearbyAction | null;
  nearbyLabel: string;
  playerX: number;
  playerZ: number;
  vehicleX: number;
  vehicleZ: number;
  message: string;
}
export type SnapshotListener = (snapshot: GameSnapshot) => void;
