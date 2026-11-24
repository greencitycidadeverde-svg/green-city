export interface GameSnapshot {
  cit: number;
  collected: number;
  total: number;
  missionComplete: boolean;
  restored: boolean;
  paused: boolean;
  mapOpen: boolean;
  inVehicle: boolean;
  vehicleSpeed: number;
  playerX: number;
  playerZ: number;
  message: string;
}

export type SnapshotListener = (snapshot: GameSnapshot) => void;
