export type MissionStage = 'collect' | 'deliver' | 'solar' | 'vehicle' | 'complete';
export type NearbyAction = 'collect-waste' | 'deliver-waste' | 'enter-vehicle' | 'exit-vehicle' | 'install-building-solar' | 'convert-vehicle';

export interface GameSnapshot {
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
