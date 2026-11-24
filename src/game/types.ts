export type MissionStage = 'collect' | 'deliver' | 'improve' | 'complete';
export type NearbyAction = 'collect-waste' | 'deliver-waste' | 'enter-vehicle' | 'exit-vehicle';

export interface GameSnapshot {
  cit: number;
  collected: number;
  total: number;
  delivered: boolean;
  solarInstalled: boolean;
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
  message: string;
}

export type SnapshotListener = (snapshot: GameSnapshot) => void;
