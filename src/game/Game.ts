import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, DynamicTexture, Engine, HemisphericLight,
  Mesh, MeshBuilder, Scene, StandardMaterial, Vector3,
} from '@babylonjs/core';
import { ImportMeshAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AbstractMesh } from '@babylonjs/core';
import type { GameSnapshot, MissionStage, NearbyAction, PortMissionStage, SnapshotListener } from './types';

const TOTAL_TRASH = 5;
const TOTAL_SOLAR_BUILDINGS = 8;
const SOLAR_BUILDINGS_REQUIRED_FOR_EV = 3;
const SOLAR_BUILDING_COST = 10;
const ELECTRIC_VEHICLE_COST = 20;

interface SolarBuildingRecord {
  x: number; z: number; width: number; height: number; label: string; solarInstalled: boolean;
}
interface PortSite { x: number; z: number; }

export class GreenCityGame {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly player: Mesh;
  private readonly vehicle: Mesh;
  private vehicleMaterial!: StandardMaterial;
  private readonly ecoCenterPosition = new Vector3(-25, 0, 8);
  private readonly vehicleBasePosition = new Vector3(31, 0, 23.5);
  private readonly buildings: SolarBuildingRecord[] = [];
  private solarBuildingsInstalled = 0;
  private vehicleStationActive = false;
  private vehicleStationSignTexture?: DynamicTexture;
  private vehicleStationChargerMaterial?: StandardMaterial;
  private inVehicle = false;
  private vehicleSpeed = 0;
  private readonly trash: Mesh[] = [];
  private readonly keys = new Set<string>();
  private readonly listener: SnapshotListener;
  private velocityY = 0;
  private onGround = true;
  private cit = 0;
  private collected = 0;
  private delivered = false;
  private electricVehicle = false;
  private recyclingRate = 18;
  private renewableShare = 5;
  private sustainableMobility = 8;
  private airQuality = 38;
  private missionStage: MissionStage = 'collect';
  private paused = false;
  private mapOpen = false;
  private message = 'Investigue o bairro e recolha os resíduos espalhados.';
  private lastInteract = 0;
  private lastSnapshotAt = 0;
  private readonly riverMaterial: StandardMaterial;
  private readonly parkTrees: Mesh[] = [];
  private readonly playerArms: Mesh[] = [];
  private readonly playerLegs: Mesh[] = [];
  private characterAnimationTime = 0;
  private mobileMoveX = 0;
  private mobileMoveY = 0;
  private modelManifestPromise?: Promise<Record<string, string>>;
  private playerModelRoot?: AbstractMesh;
  private vehicleModelRoot?: AbstractMesh;
  private portTruckModelRoot?: AbstractMesh;
  private activePhase: 1 | 2 = 1;
  private portMissionStage: PortMissionStage = 'inspect';
  private readonly portOutfallPositions: PortSite[] = [{ x: 4, z: -20 }, { x: 4, z: 0 }, { x: 4, z: 20 }];
  private readonly portSepticPositions: PortSite[] = [{ x: 8, z: -31 }, { x: 8, z: 31 }];
  private readonly portCompanyNames = ['ARMAZÉM NORTE', 'DOCAS CENTRAIS', 'LOGÍSTICA SUL'];
  private readonly portCompanyPositions: PortSite[] = [{ x: -8, z: -20 }, { x: -8, z: 0 }, { x: -8, z: 20 }];
  private readonly portCooperativePosition = new Vector3(20, 0, 23);
  private readonly portCooperativeBinPositions: PortSite[] = [
    { x: 15, z: 27 }, { x: 17.5, z: 27 }, { x: 20, z: 27 }, { x: 22.5, z: 27 }, { x: 25, z: 27 },
  ];
  private readonly portCooperativeMaterialNames = ['PAPEL / PAPELÃO', 'PLÁSTICO', 'VIDRO', 'METAL', 'ORGÂNICO'];
  private readonly portCooperativeBinMaterials: StandardMaterial[] = [];
  private readonly portCooperativeSorted: boolean[] = [false, false, false, false, false];
  private readonly portOutfallMarkers: Mesh[] = [];
  private readonly portOutfallInspected = new Set<number>();
  private readonly portOutletMaterials: StandardMaterial[] = [];
  private readonly portWastePiles: Mesh[] = [];
  private readonly portSepticInstalled: boolean[] = [false, false];
  private readonly portMeshes: Mesh[] = [];
  private phaseOneMeshes: Mesh[] = [];
  private readonly phaseOneModelRoots: AbstractMesh[] = [];
  private readonly portModelRoots: AbstractMesh[] = [];
  private portTruck!: Mesh;
  private portRiverMaterial!: StandardMaterial;
  private portTreatmentInstalled = false;
  private portOutfallsInspected = 0;
  private portWasteCollected = 0;
  private portWaterQuality = 24;

  constructor(canvas: HTMLCanvasElement, listener: SnapshotListener) {
    this.listener = listener;
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.56, 0.78, 0.91, 1);
    this.scene.collisionsEnabled = true;
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0011;
    this.scene.fogColor = new Color3(0.56, 0.78, 0.91);
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.contrast = 1.18;
    this.scene.imageProcessingConfiguration.exposure = 1.12;

    const sky = new HemisphericLight('sky-light', new Vector3(0, 1, 0), this.scene);
    sky.intensity = 1.22;
    const sun = new DirectionalLight('sun-light', new Vector3(-0.45, -1, 0.35), this.scene);
    sun.position = new Vector3(25, 45, -20);
    sun.intensity = 1.28;

    this.buildDistrict();
    this.buildEcoCenter();
    this.buildVehicleConversionStation();
    this.player = this.createPlayer();
    void this.loadPlayerModel();
    this.vehicle = this.createVehicle();
    this.camera = new ArcRotateCamera('third-person-camera', -Math.PI / 2, 1.15, 8, new Vector3(0, 1.3, 0), this.scene);
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 11;
    this.camera.lowerBetaLimit = 0.65;
    this.camera.upperBetaLimit = 1.45;
    this.camera.panningSensibility = 0;
    this.camera.wheelPrecision = 45;
    this.camera.attachControl(canvas, true);
    this.camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
    this.camera.setTarget(new Vector3(8.5, 1.2, 23.5));

    this.riverMaterial = new StandardMaterial('river-material', this.scene);
    this.riverMaterial.diffuseColor = new Color3(0.30, 0.34, 0.28);
    this.riverMaterial.alpha = 0.92;
    this.buildRiver();
    this.buildTrash();
    const portStartIndex = this.scene.meshes.length;
    this.buildPortDistrict();
    this.portMeshes.push(...this.scene.meshes.slice(portStartIndex) as Mesh[]);
    this.portMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.phaseOneMeshes = this.scene.meshes.slice(0, portStartIndex).filter((mesh) => !this.isPlayerPart(mesh as Mesh)) as Mesh[];
    void this.loadWorldModels();
    this.bindInput(canvas);
    this.emit();

    this.engine.runRenderLoop(() => {
      if (!this.paused && !this.mapOpen) this.update(this.engine.getDeltaTime() / 1000);
      this.scene.render();
    });
    window.addEventListener('resize', this.resize);
  }

  private readonly resize = () => this.engine.resize();

  private material(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = color;
    material.specularColor = new Color3(0.16, 0.16, 0.16);
    material.specularPower = 56;
    return material;
  }

  private buildDistrict(): void {
    const ground = MeshBuilder.CreateGround('district-ground', { width: 90, height: 90 }, this.scene);
    ground.position.y = -0.08;
    ground.checkCollisions = true;
    ground.material = this.material('ground', new Color3(0.43, 0.56, 0.35));

    const roadMat = this.material('asphalt', new Color3(0.13, 0.16, 0.17));
    const sidewalkMat = this.material('sidewalk', new Color3(0.55, 0.57, 0.52));
    const lineMat = this.material('road-lines', new Color3(0.88, 0.82, 0.57));
    const road = MeshBuilder.CreateBox('main-road', { width: 16, depth: 82, height: 0.12 }, this.scene);
    road.position.y = 0.01;
    road.material = roadMat;
    road.checkCollisions = true;
    for (const x of [-9.3, 9.3]) {
      for (const [centerZ, depth] of [[-10.5, 61], [34.5, 13]]) {
        const walk = MeshBuilder.CreateBox('sidewalk', { width: 2.6, depth, height: 0.22 }, this.scene);
        walk.position.set(x, 0.09, centerZ); walk.material = sidewalkMat; walk.checkCollisions = true;
      }
    }
    for (let z = -36; z <= 36; z += 9) {
      const stripe = MeshBuilder.CreateBox('road-dash', { width: 0.18, depth: 3.5, height: 0.02 }, this.scene);
      stripe.position.set(0, 0.085, z);
      stripe.material = lineMat;
    }

    // A crosswalk and curb details give the main street a legible scale.
    for (let i = -3; i <= 3; i++) {
      const crossing = MeshBuilder.CreateBox('crosswalk-mark', { width: 1.0, height: 0.025, depth: 0.34 }, this.scene);
      crossing.position.set(i * 1.45, 0.10, 11);
      crossing.material = lineMat;
    }
    const curbMat = this.material('curb', new Color3(0.72, 0.70, 0.61));
    for (const x of [-10.72, 10.72]) {
      for (const [centerZ, depth] of [[-10.5, 61], [34.5, 13]]) {
        const curb = MeshBuilder.CreateBox('street-curb', { width: 0.18, height: 0.28, depth }, this.scene);
        curb.position.set(x, 0.15, centerZ); curb.material = curbMat;
      }
    }
    const serviceRoad = MeshBuilder.CreateGround('ev-service-road', { width: 44, height: 7 }, this.scene);
    serviceRoad.position.set(22, 0.025, 23.5); serviceRoad.material = roadMat;
    const serviceMarkings = this.material('ev-service-road-markings', new Color3(0.92, 0.87, 0.62));
    for (let x = 5; x <= 41; x += 6) {
      const dash = MeshBuilder.CreateBox('ev-service-road-dash', { width: 2.8, height: 0.025, depth: 0.12 }, this.scene);
      dash.position.set(x, 0.055, 23.5); dash.material = serviceMarkings;
    }

    const facadeTexture = new DynamicTexture('district-facade-finish-texture', { width: 512, height: 512 }, this.scene, false);
    const facadeContext = facadeTexture.getContext() as unknown as CanvasRenderingContext2D;
    const facadeGradient = facadeContext.createLinearGradient(0, 0, 512, 512);
    facadeGradient.addColorStop(0, '#F6F1E6'); facadeGradient.addColorStop(0.55, '#E6E2D7'); facadeGradient.addColorStop(1, '#D7D4CA');
    facadeContext.fillStyle = facadeGradient; facadeContext.fillRect(0, 0, 512, 512);
    for (let y = 32; y < 512; y += 48) {
      facadeContext.fillStyle = 'rgba(95,105,92,.10)'; facadeContext.fillRect(0, y, 512, 2);
      facadeContext.fillStyle = 'rgba(255,255,255,.28)'; facadeContext.fillRect(0, y + 3, 512, 2);
    }
    for (let x = 24; x < 512; x += 64) { facadeContext.fillStyle = 'rgba(110,112,96,.05)'; facadeContext.fillRect(x, 0, 1, 512); }
    facadeTexture.update();
    const buildingColors = [new Color3(0.66, 0.48, 0.34), new Color3(0.38, 0.58, 0.62), new Color3(0.72, 0.65, 0.48)];
    const positions = [
      [-19, -27, 10, 15], [-28, -8, 12, 18], [-19, 18, 10, 13], [-31, 34, 12, 11],
      [20, -30, 12, 17], [30, -10, 10, 14], [20, 15, 13, 16], [31, 34, 11, 12],
    ];
    positions.forEach(([x, z, w, h], i) => {
      const building = MeshBuilder.CreateBox(`building-${i}`, { width: w - 0.66, depth: 9.34, height: h }, this.scene);
      building.position.set(x, h / 2, z);
      const facadeMaterial = this.material(`building-mat-${i}`, buildingColors[i % buildingColors.length]);
      facadeMaterial.diffuseTexture = facadeTexture;
      building.material = facadeMaterial;
      building.checkCollisions = true;
      // Soft vertical corners turn the old block silhouette into a rounded animated-city facade.
      for (const cornerX of [-1, 1]) for (const cornerZ of [-1, 1]) {
        const roundedCorner = MeshBuilder.CreateCapsule(`building-rounded-corner-${i}`, { height: h + 0.08, radius: 0.34, tessellation: 18 }, this.scene);
        roundedCorner.position.set(x + cornerX * (w / 2 - 0.33), h / 2, z + cornerZ * 4.66);
        roundedCorner.material = facadeMaterial;
        roundedCorner.checkCollisions = true;
      }
      const roof = MeshBuilder.CreateSphere(`roof-${i}`, { diameter: 1, segments: 24 }, this.scene);
      roof.position.set(x, h + 0.12, z);
      roof.scaling.set(w / 2 + 0.36, 0.22, 5.18);
      roof.material = this.material(`roof-mat-${i}`, new Color3(0.31, 0.35, 0.32));
      const roofTrim = this.material(`roof-trim-${i}`, new Color3(0.82, 0.79, 0.68));
      for (const side of [-1, 1]) {
        const parapet = MeshBuilder.CreateBox(`roof-parapet-${i}`, { width: w + 0.42, height: 0.28, depth: 0.18 }, this.scene);
        parapet.position.set(x, h + 0.44, z + side * 5.05); parapet.material = roofTrim;
        const sideParapet = MeshBuilder.CreateBox(`roof-side-parapet-${i}`, { width: 0.18, height: 0.28, depth: 10.1 }, this.scene);
        sideParapet.position.set(x + side * (w / 2 + 0.12), h + 0.44, z); sideParapet.material = roofTrim;
      }
      const rooftopUnit = MeshBuilder.CreateBox(`rooftop-service-unit-${i}`, { width: 1.6, height: 0.75, depth: 1.45 }, this.scene);
      rooftopUnit.position.set(x - w * 0.34, h + 0.72, z - 4.05);
      rooftopUnit.material = this.material(`rooftop-service-unit-mat-${i}`, new Color3(0.55, 0.60, 0.57));
      const rooftopVent = MeshBuilder.CreateCylinder(`rooftop-vent-${i}`, { height: 0.8, diameterTop: 0.36, diameterBottom: 0.48, tessellation: 20 }, this.scene);
      rooftopVent.position.set(x + w * 0.34, h + 0.75, z + 4.05);
      rooftopVent.material = this.material(`rooftop-vent-mat-${i}`, new Color3(0.40, 0.44, 0.42));

      // Low-poly facade kit: recessed storefront, framed glazing and readable entrances.
      const facadeSide = x < 0 ? 1 : -1;
      const facadeX = x + facadeSide * (w / 2 + 0.08);
      const glassMat = this.material(`window-glass-${i}`, new Color3(0.12, 0.27, 0.31));
      const frameMat = this.material(`window-frame-${i}`, new Color3(0.77, 0.74, 0.63));
      const storefrontLabels = ['OFICINAS', 'ARMAZÉM', 'MERCADO', 'SERVIÇOS', 'LOGÍSTICA', 'ENERGIA', 'RECICLAGEM', 'COMÉRCIO'];
      this.buildings.push({ x, z, width: w, height: h, label: storefrontLabels[i], solarInstalled: false });
      const facadeBase = MeshBuilder.CreateBox(`facade-base-${i}`, { width: 0.34, height: 0.48, depth: 10.15 }, this.scene);
      facadeBase.position.set(facadeX + facadeSide * 0.13, 0.26, z);
      facadeBase.material = frameMat;
      for (const edge of [-4.72, 4.72]) {
        const pilaster = MeshBuilder.CreateBox(`facade-pilaster-${i}`, { width: 0.34, height: h, depth: 0.38 }, this.scene);
        pilaster.position.set(facadeX + facadeSide * 0.14, h / 2, z + edge);
        pilaster.material = frameMat;
      }
      const windowRows = Math.max(1, Math.floor((h - 3) / 4));
      for (let row = 0; row < windowRows; row++) {
        for (const offset of [-3, 0, 3]) {
          const frame = MeshBuilder.CreateCapsule('facade-window-frame', { height: 1.72, radius: 0.58, tessellation: 16 }, this.scene);
          frame.position.set(facadeX, 3.5 + row * 3.5, z + offset);
          frame.material = frameMat;
          const glass = MeshBuilder.CreateCapsule('facade-window-glass', { height: 1.48, radius: 0.46, tessellation: 16 }, this.scene);
          glass.position.set(facadeX + facadeSide * 0.035, 3.5 + row * 3.5, z + offset);
          glass.material = glassMat;
          const mullion = MeshBuilder.CreateCapsule('facade-window-mullion', { height: 1.10, radius: 0.035, tessellation: 10 }, this.scene);
          mullion.position.set(facadeX + facadeSide * 0.14, 3.5 + row * 3.5, z + offset);
          mullion.material = frameMat;
        }
      }
      const entrance = MeshBuilder.CreateCapsule('facade-entry', { height: 2.25, radius: 0.66, tessellation: 18 }, this.scene);
      entrance.position.set(facadeX + facadeSide * 0.03, 1.16, z - 2.9);
      entrance.material = glassMat;
      const storefront = MeshBuilder.CreateCapsule('storefront-sign-panel', { height: 4.1, radius: 0.32, tessellation: 16 }, this.scene);
      storefront.position.set(facadeX + facadeSide * 0.03, 2.65, z + 1.25);
      storefront.material = this.material(`storefront-sign-${i}`, new Color3(0.12, 0.35, 0.24));
      const storefrontTexture = new DynamicTexture(`storefront-label-texture-${i}`, { width: 512, height: 128 }, this.scene, false);
      const storefrontContext = storefrontTexture.getContext() as unknown as CanvasRenderingContext2D;
      storefrontContext.fillStyle = '#123F2B';
      storefrontContext.fillRect(0, 0, 512, 128);
      storefrontContext.fillStyle = '#D9F2C5';
      storefrontContext.font = 'bold 56px Arial';
      storefrontContext.textAlign = 'center';
      storefrontContext.fillText(storefrontLabels[i], 256, 83, 470);
      storefrontTexture.update();
      const storefrontFace = MeshBuilder.CreatePlane(`storefront-sign-face-${i}`, { width: 3.85, height: 0.48 }, this.scene);
      storefrontFace.position.set(facadeX + facadeSide * 0.14, 2.65, z + 1.25);
      storefrontFace.rotation.y = facadeSide * Math.PI / 2;
      const storefrontFaceMaterial = this.material(`storefront-face-material-${i}`, new Color3(1, 1, 1));
      storefrontFaceMaterial.diffuseTexture = storefrontTexture;
      storefrontFaceMaterial.emissiveColor = new Color3(0.10, 0.16, 0.11);
      storefrontFace.material = storefrontFaceMaterial;
      const awning = MeshBuilder.CreateCapsule('storefront-awning', { height: 4.35, radius: 0.20, tessellation: 16 }, this.scene);
      awning.position.set(facadeX + facadeSide * 0.28, 2.34, z + 1.25);
      awning.rotation.x = Math.PI / 2;
      awning.material = frameMat;
      const awningAccent = MeshBuilder.CreateCapsule('storefront-awning-accent', { height: 4.15, radius: 0.055, tessellation: 12 }, this.scene);
      awningAccent.position.set(facadeX + facadeSide * 0.43, 2.22, z + 1.25);
      awningAccent.rotation.x = Math.PI / 2;
      awningAccent.material = this.material(`storefront-awning-accent-${i}`, new Color3(0.94, 0.72, 0.34));
    });

    const treeMaterials = [
      this.material('tree-leaves-deep', new Color3(0.10, 0.34, 0.16)),
      this.material('tree-leaves-main', new Color3(0.17, 0.48, 0.19)),
      this.material('tree-leaves-light', new Color3(0.30, 0.59, 0.25)),
    ];
    const trunkMat = this.material('tree-trunk', new Color3(0.25, 0.15, 0.09));
    const branchMat = this.material('tree-branch', new Color3(0.31, 0.20, 0.12));
    for (const [treeIndex, [x, z]] of [[-11, -29], [-11, -14], [-11, 4], [-11, 24], [11, -25], [11, -6], [11, 13], [11, 30], [-35, 5], [35, -20]].entries()) {
      const trunk = MeshBuilder.CreateCylinder('tree-trunk', { height: 2.65, diameterTop: 0.22, diameterBottom: 0.46, tessellation: 18 }, this.scene);
      trunk.position.set(x, 1.32, z);
      trunk.material = trunkMat;
      trunk.checkCollisions = true;

      for (const side of [-1, 1]) {
        const branch = MeshBuilder.CreateCylinder('tree-branch', { height: 1.45, diameterTop: 0.12, diameterBottom: 0.20, tessellation: 14 }, this.scene);
        branch.position.set(x + side * 0.37, 2.05, z);
        branch.rotation.z = side * -0.62;
        branch.material = branchMat;
      }

      const crown = MeshBuilder.CreateSphere('tree-crown', { diameter: 2.62, segments: 24 }, this.scene);
      crown.position.set(x, 3.18, z); crown.scaling.set(1.02, 1.08, 0.98);
      crown.material = treeMaterials[treeIndex % treeMaterials.length]; this.parkTrees.push(crown);
      const foliageClusters = [
        [-0.72, 3.04, 0.05, 1.15], [0.68, 3.13, -0.10, 1.12],
        [-0.12, 3.70, 0.12, 1.20], [0.18, 2.82, 0.60, 0.96], [-0.45, 3.45, -0.55, 0.92],
      ];
      foliageClusters.forEach(([dx, y, dz, diameter], clusterIndex) => {
        const foliage = MeshBuilder.CreateSphere('tree-foliage-cluster', { diameter, segments: 20 }, this.scene);
        foliage.position.set(x + dx, y, z + dz); foliage.scaling.set(1.0 + (clusterIndex % 2) * 0.08, 0.92, 1.0);
        foliage.material = treeMaterials[(treeIndex + clusterIndex + 1) % treeMaterials.length];
      });
    }

    const plaza = MeshBuilder.CreateGround('plaza', { width: 14, height: 12 }, this.scene);
    plaza.position.set(-25, 0.03, 0);
    plaza.material = sidewalkMat;
    const sign = MeshBuilder.CreateBox('district-sign', { width: 4.5, height: 2.2, depth: 0.25 }, this.scene);
    sign.position.set(-35, 2.4, 6.5);
    sign.material = this.material('sign-green', new Color3(0.07, 0.25, 0.16));

    // Small public-space details make the EcoCentro plaza feel occupied.
    const benchMat = this.material('bench-wood', new Color3(0.42, 0.30, 0.19));
    const lampMat = this.material('streetlamp-metal', new Color3(0.18, 0.23, 0.20));
    const lampLens = this.material('streetlamp-lens', new Color3(0.88, 0.78, 0.52));
    for (const bx of [-29.5, -20.5]) {
      const seat = MeshBuilder.CreateBox('plaza-bench-seat', { width: 2.2, height: 0.16, depth: 0.62 }, this.scene);
      seat.position.set(bx, 0.72, 4.2);
      seat.material = benchMat;
      for (const dx of [-0.8, 0.8]) {
        const leg = MeshBuilder.CreateBox('plaza-bench-leg', { width: 0.12, height: 0.72, depth: 0.12 }, this.scene);
        leg.position.set(bx + dx, 0.36, 4.2);
        leg.material = lampMat;
      }
    }
    for (const z of [-30, -8, 15, 34]) {
      for (const lx of [-10.7, 10.7]) {
        const pole = MeshBuilder.CreateCylinder('streetlamp-pole', { height: 5.1, diameter: 0.12, tessellation: 8 }, this.scene);
        pole.position.set(lx, 2.55, z);
        pole.material = lampMat;
        const arm = MeshBuilder.CreateBox('streetlamp-arm', { width: 0.95, height: 0.1, depth: 0.12 }, this.scene);
        arm.position.set(lx + (lx < 0 ? 0.4 : -0.4), 4.95, z);
        arm.material = lampMat;
        const lens = MeshBuilder.CreateBox('streetlamp-lens', { width: 0.42, height: 0.12, depth: 0.28 }, this.scene);
        lens.position.set(lx + (lx < 0 ? 0.8 : -0.8), 4.9, z);
        lens.material = lampLens;
      }
    }
  }

  private buildEcoCenter(): void {
    // Processing building. The public unloading point sits outside, in clear view.
    const walls = MeshBuilder.CreateBox('eco-center-building', { width: 7, depth: 4.5, height: 3.2 }, this.scene);
    walls.position.set(-25, 1.6, -1.2);
    walls.material = this.material('eco-center-walls', new Color3(0.34, 0.43, 0.34));
    walls.checkCollisions = true;

    const roof = MeshBuilder.CreateBox('eco-center-roof', { width: 7.4, depth: 4.9, height: 0.3 }, this.scene);
    roof.position.set(-25, 3.25, -1.2);
    roof.material = this.material('eco-center-roof-material', new Color3(0.17, 0.22, 0.19));

    const signFrame = MeshBuilder.CreateBox('eco-center-sign-frame', { width: 5.4, height: 1.25, depth: 0.22 }, this.scene);
    signFrame.position.set(-25, 3.1, 1.25);
    signFrame.material = this.material('eco-center-sign-frame-material', new Color3(0.07, 0.23, 0.15));

    const signTexture = new DynamicTexture('eco-center-sign-texture', { width: 1024, height: 256 }, this.scene, false);
    const context = signTexture.getContext();
    context.fillStyle = '#123F2B';
    context.fillRect(0, 0, 1024, 256);
    context.fillStyle = '#B9EE91';
    context.font = 'bold 76px Arial';
    context.fillText('ECOCENTRO', 42, 104);
    context.fillStyle = '#F0F5E8';
    context.font = 'bold 38px Arial';
    context.fillText('ENTREGA  ·  TRIAGEM  ·  RECICLAGEM', 44, 178);
    signTexture.update();

    const signFace = MeshBuilder.CreatePlane('eco-center-sign-face', { width: 5.05, height: 1.05 }, this.scene);
    signFace.position.set(-25, 3.1, 1.38);
    const signMaterial = this.material('eco-center-sign-face-material', new Color3(1, 1, 1));
    signMaterial.diffuseTexture = signTexture;
    signMaterial.emissiveColor = new Color3(0.16, 0.24, 0.17);
    signFace.material = signMaterial;

    // A dedicated pedestrian access route leads from the street to the unloading pad.
    const accessPath = MeshBuilder.CreateGround('eco-center-access-path', { width: 16, height: 2.8 }, this.scene);
    accessPath.position.set(-17, 0.035, 8);
    accessPath.material = this.material('eco-center-access-path-material', new Color3(0.62, 0.63, 0.55));

    const deliveryPad = MeshBuilder.CreateGround('eco-center-delivery-pad', { width: 12, height: 8 }, this.scene);
    deliveryPad.position.set(-25, 0.045, 8.8);
    deliveryPad.material = this.material('eco-center-delivery-pad-material', new Color3(0.48, 0.58, 0.45));

    const padRing = MeshBuilder.CreateTorus('eco-center-delivery-ring', { diameter: 8.7, thickness: 0.2, tessellation: 32 }, this.scene);
    padRing.position.set(this.ecoCenterPosition.x, 0.12, this.ecoCenterPosition.z);
    padRing.material = this.material('eco-center-delivery-ring-material', new Color3(0.48, 0.93, 0.35));

    const marker = MeshBuilder.CreateCylinder('eco-center-delivery-marker', { diameter: 2.0, height: 0.12, tessellation: 24 }, this.scene);
    marker.position.set(this.ecoCenterPosition.x, 0.11, this.ecoCenterPosition.z);
    marker.material = this.material('eco-center-marker-material', new Color3(0.18, 0.58, 0.28));

    // Containers follow Brazil's selective collection color palette.
    const containers = [
      { x: -29.5, color: new Color3(0.12, 0.34, 0.66), hex: '#1976D2', label: 'PAPEL / PAPELÃO', examples: 'CAIXAS · JORNAIS', icon: 'paper' },
      { x: -27.2, color: new Color3(0.72, 0.18, 0.18), hex: '#B83232', label: 'PLÁSTICO', examples: 'GARRAFAS · EMBALAGENS', icon: 'plastic' },
      { x: -24.9, color: new Color3(0.12, 0.48, 0.29), hex: '#237D4B', label: 'VIDRO', examples: 'POTES · GARRAFAS', icon: 'glass' },
      { x: -22.6, color: new Color3(0.82, 0.64, 0.10), hex: '#A98013', label: 'METAL', examples: 'LATAS · ALUMÍNIO', icon: 'metal' },
      { x: -20.3, color: new Color3(0.43, 0.27, 0.16), hex: '#70452C', label: 'ORGÂNICO', examples: 'ALIMENTOS · FOLHAS', icon: 'organic' },
    ];
    containers.forEach(({ x, color, hex, label, examples, icon }, index) => {
      const body = MeshBuilder.CreateBox('eco-center-recycling-container', { width: 1.82, height: 1.62, depth: 1.42 }, this.scene);
      body.position.set(x, 0.83, 12.0);
      body.material = this.material('eco-center-container-' + index, color);

      const lid = MeshBuilder.CreateBox('eco-center-container-lid', { width: 1.94, height: 0.18, depth: 1.52 }, this.scene);
      lid.position.set(x, 1.72, 12.0);
      lid.material = this.material('eco-center-container-lid-' + index, new Color3(0.09, 0.13, 0.11));

      const labelFrame = MeshBuilder.CreateBox('eco-center-container-label-frame', { width: 1.96, height: 1.02, depth: 0.08 }, this.scene);
      labelFrame.position.set(x, 1.16, 12.78);
      labelFrame.material = this.material('eco-center-container-label-frame-' + index, new Color3(0.91, 0.94, 0.86));

      const labelTexture = new DynamicTexture('eco-center-container-label-texture-' + index, { width: 512, height: 256 }, this.scene, false);
      const labelContext = labelTexture.getContext() as unknown as CanvasRenderingContext2D;
      labelContext.fillStyle = '#F4F5E9';
      labelContext.fillRect(0, 0, 512, 256);
      labelContext.fillStyle = hex;
      labelContext.fillRect(0, 0, 512, 24);
      labelContext.strokeStyle = hex;
      labelContext.fillStyle = hex;
      labelContext.lineWidth = 15;
      labelContext.lineCap = 'round';
      labelContext.lineJoin = 'round';

      // Pictogramas distintos permitem identificar o material sem depender só da cor.
      if (icon === 'paper') {
        labelContext.beginPath();
        labelContext.moveTo(39, 55); labelContext.lineTo(82, 55); labelContext.lineTo(105, 78);
        labelContext.lineTo(105, 188); labelContext.lineTo(39, 188); labelContext.closePath(); labelContext.stroke();
        labelContext.beginPath();
        labelContext.moveTo(82, 55); labelContext.lineTo(82, 80); labelContext.lineTo(105, 80);
        labelContext.moveTo(52, 111); labelContext.lineTo(91, 111);
        labelContext.moveTo(52, 139); labelContext.lineTo(91, 139);
        labelContext.stroke();
      } else if (icon === 'plastic') {
        labelContext.beginPath();
        labelContext.moveTo(59, 48); labelContext.lineTo(85, 48); labelContext.lineTo(85, 72);
        labelContext.lineTo(101, 89); labelContext.lineTo(101, 177);
        labelContext.quadraticCurveTo(101, 190, 88, 190);
        labelContext.lineTo(47, 190); labelContext.quadraticCurveTo(34, 190, 34, 177);
        labelContext.lineTo(34, 89); labelContext.lineTo(50, 72); labelContext.lineTo(50, 48);
        labelContext.stroke();
        labelContext.beginPath(); labelContext.moveTo(51, 39); labelContext.lineTo(93, 39); labelContext.stroke();
        labelContext.beginPath(); labelContext.moveTo(38, 133); labelContext.lineTo(97, 133); labelContext.stroke();
      } else if (icon === 'glass') {
        labelContext.beginPath();
        labelContext.moveTo(47, 54); labelContext.lineTo(95, 54);
        labelContext.lineTo(95, 91); labelContext.lineTo(109, 108);
        labelContext.lineTo(109, 178); labelContext.quadraticCurveTo(109, 190, 96, 190);
        labelContext.lineTo(46, 190); labelContext.quadraticCurveTo(33, 190, 33, 178);
        labelContext.lineTo(33, 108); labelContext.lineTo(47, 91); labelContext.closePath();
        labelContext.stroke();
        labelContext.beginPath(); labelContext.moveTo(39, 145); labelContext.lineTo(103, 145); labelContext.stroke();
        labelContext.beginPath(); labelContext.moveTo(44, 45); labelContext.lineTo(99, 45); labelContext.stroke();
      } else if (icon === 'metal') {
        labelContext.beginPath();
        labelContext.ellipse(71, 72, 32, 11, 0, 0, Math.PI * 2);
        labelContext.moveTo(39, 72); labelContext.lineTo(39, 171);
        labelContext.ellipse(71, 171, 32, 11, 0, 0, Math.PI);
        labelContext.moveTo(103, 72); labelContext.lineTo(103, 171);
        labelContext.stroke();
        labelContext.beginPath(); labelContext.ellipse(71, 72, 17, 5, 0, 0, Math.PI * 2); labelContext.stroke();
      } else {
        labelContext.beginPath();
        labelContext.moveTo(35, 169); labelContext.bezierCurveTo(37, 93, 96, 57, 111, 62);
        labelContext.bezierCurveTo(108, 132, 76, 180, 35, 169); labelContext.stroke();
        labelContext.beginPath(); labelContext.moveTo(38, 166); labelContext.quadraticCurveTo(74, 121, 105, 68); labelContext.stroke();
      }

      labelContext.fillStyle = '#17251C';
      labelContext.textAlign = 'left';
      labelContext.font = 'bold 64px Arial';
      labelContext.fillText(label, 132, 111, 360);
      labelContext.font = 'bold 25px Arial';
      labelContext.fillText(examples, 132, 151, 360);
      labelContext.fillStyle = '#5D6E60';
      labelContext.font = 'bold 20px Arial';
      labelContext.fillText('COLETA SELETIVA', 132, 196);
      labelTexture.update();

      const labelFace = MeshBuilder.CreatePlane('eco-center-container-label-face-' + index, { width: 1.90, height: 0.96 }, this.scene);
      labelFace.position.set(x, 1.16, 12.84);
      labelFace.billboardMode = Mesh.BILLBOARDMODE_Y;
      const labelMaterial = this.material('eco-center-container-label-material-' + index, new Color3(1, 1, 1));
      labelMaterial.diffuseTexture = labelTexture;
      labelMaterial.emissiveColor = new Color3(0.10, 0.10, 0.08);
      labelFace.material = labelMaterial;
    });


    // Large educational legend placed above the bins so every material is readable on approach.
    const legendFrame = MeshBuilder.CreateBox('eco-center-material-legend-frame', { width: 12.2, height: 2.0, depth: 0.16 }, this.scene);
    legendFrame.position.set(-25, 4.25, 12.53);
    legendFrame.material = this.material('eco-center-material-legend-frame-material', new Color3(0.06, 0.20, 0.13));
    const legendTexture = new DynamicTexture('eco-center-material-legend-texture', { width: 1800, height: 360 }, this.scene, false);
    const legendContext = legendTexture.getContext() as unknown as CanvasRenderingContext2D;
    legendContext.fillStyle = '#123F2B';
    legendContext.fillRect(0, 0, 1800, 360);
    legendContext.fillStyle = '#DDF5D0';
    legendContext.font = 'bold 35px Arial';
    legendContext.textAlign = 'center';
    legendContext.fillText('IDENTIFIQUE PELO NOME, SÍMBOLO E COR', 900, 48);
    const legendItems = [
      { name: 'PAPEL / PAPELÃO', example: 'CAIXAS · JORNAIS', color: '#1976D2', symbol: 'paper' },
      { name: 'PLÁSTICO', example: 'GARRAFAS · POTES', color: '#D93636', symbol: 'plastic' },
      { name: 'VIDRO', example: 'POTES · GARRAFAS', color: '#259653', symbol: 'glass' },
      { name: 'METAL', example: 'LATAS · ALUMÍNIO', color: '#E5B52B', symbol: 'metal' },
      { name: 'ORGÂNICO', example: 'RESTOS · FOLHAS', color: '#865335', symbol: 'organic' },
    ];
    legendItems.forEach((item, index) => {
      const left = index * 360;
      legendContext.fillStyle = item.color;
      legendContext.fillRect(left + 8, 65, 344, 278);
      legendContext.fillStyle = '#FFFFFF';
      legendContext.strokeStyle = '#FFFFFF';
      legendContext.lineWidth = 8;
      legendContext.lineCap = 'round';
      legendContext.lineJoin = 'round';
      legendContext.beginPath();
      if (item.symbol === 'paper') {
        legendContext.rect(left + 34, 126, 76, 132);
        legendContext.moveTo(left + 84, 126); legendContext.lineTo(left + 110, 152);
        legendContext.moveTo(left + 84, 126); legendContext.lineTo(left + 84, 152); legendContext.lineTo(left + 110, 152);
        legendContext.moveTo(left + 48, 190); legendContext.lineTo(left + 96, 190);
        legendContext.moveTo(left + 48, 216); legendContext.lineTo(left + 96, 216);
      } else if (item.symbol === 'plastic' || item.symbol === 'glass') {
        legendContext.moveTo(left + 56, 126); legendContext.lineTo(left + 88, 126); legendContext.lineTo(left + 88, 150);
        legendContext.lineTo(left + 112, 172); legendContext.lineTo(left + 112, 252);
        legendContext.quadraticCurveTo(left + 112, 266, left + 98, 266);
        legendContext.lineTo(left + 46, 266); legendContext.quadraticCurveTo(left + 32, 266, left + 32, 252);
        legendContext.lineTo(left + 32, 172); legendContext.lineTo(left + 56, 150); legendContext.closePath();
        if (item.symbol === 'glass') { legendContext.moveTo(left + 34, 216); legendContext.lineTo(left + 110, 216); }
      } else if (item.symbol === 'metal') {
        legendContext.ellipse(left + 72, 150, 39, 14, 0, 0, Math.PI * 2);
        legendContext.moveTo(left + 33, 150); legendContext.lineTo(left + 33, 250);
        legendContext.ellipse(left + 72, 250, 39, 14, 0, 0, Math.PI);
        legendContext.moveTo(left + 111, 150); legendContext.lineTo(left + 111, 250);
      } else {
        legendContext.moveTo(left + 35, 250);
        legendContext.bezierCurveTo(left + 34, 160, left + 88, 116, left + 116, 128);
        legendContext.bezierCurveTo(left + 112, 210, left + 78, 270, left + 35, 250);
        legendContext.moveTo(left + 40, 250);
        legendContext.quadraticCurveTo(left + 80, 196, left + 110, 132);
      }
      legendContext.stroke();
      legendContext.textAlign = 'left';
      legendContext.fillStyle = '#FFFFFF';
      legendContext.font = 'bold 31px Arial';
      legendContext.fillText(item.name, left + 142, 178, 202);
      legendContext.font = 'bold 22px Arial';
      legendContext.fillText(item.example, left + 142, 224, 202);
      legendContext.font = 'bold 17px Arial';
      legendContext.fillText('COLETA SELETIVA', left + 142, 270, 202);
      if (index > 0) {
        legendContext.strokeStyle = 'rgba(255,255,255,.7)';
        legendContext.lineWidth = 3;
        legendContext.beginPath(); legendContext.moveTo(left, 80); legendContext.lineTo(left, 330); legendContext.stroke();
      }
    });
    legendTexture.update();
    const legendFace = MeshBuilder.CreatePlane('eco-center-material-legend-face', { width: 12.0, height: 1.82 }, this.scene);
    legendFace.position.set(-25, 4.25, 12.63);
    legendFace.billboardMode = Mesh.BILLBOARDMODE_Y;
    const legendMaterial = this.material('eco-center-material-legend-face-material', new Color3(1, 1, 1));
    legendMaterial.diffuseTexture = legendTexture;
    legendMaterial.emissiveColor = new Color3(0.16, 0.20, 0.14);
    legendFace.material = legendMaterial;

    const instructionPost = MeshBuilder.CreateCylinder('eco-center-instruction-post', { height: 2.6, diameter: 0.16, tessellation: 10 }, this.scene);
    instructionPost.position.set(-32.2, 1.3, 8.6);
    instructionPost.material = this.material('eco-center-post-material', new Color3(0.18, 0.22, 0.18));
    const instructionBoard = MeshBuilder.CreateBox('eco-center-instruction-board', { width: 2.65, height: 1.32, depth: 0.12 }, this.scene);
    instructionBoard.position.set(-32.2, 2.6, 8.6);
    instructionBoard.material = this.material('eco-center-instruction-board-material', new Color3(0.12, 0.39, 0.23));
    const instructionTexture = new DynamicTexture('eco-center-instruction-texture', { width: 640, height: 320 }, this.scene, false);
    const instructionContext = instructionTexture.getContext() as unknown as CanvasRenderingContext2D;
    instructionContext.fillStyle = '#123F2B';
    instructionContext.fillRect(0, 0, 640, 320);
    instructionContext.fillStyle = '#B9EE91';
    instructionContext.font = 'bold 42px Arial';
    instructionContext.fillText('SEPARE CORRETAMENTE', 30, 75);
    instructionContext.fillStyle = '#F0F5E8';
    instructionContext.font = 'bold 32px Arial';
    instructionContext.fillText('PAPEL  ·  PLÁSTICO  ·  VIDRO', 30, 145);
    instructionContext.fillText('METAL  ·  ORGÂNICO', 30, 205);
    instructionContext.fillStyle = '#C7DCCB';
    instructionContext.font = '24px Arial';
    instructionContext.fillText('Cada material tem seu destino.', 30, 270);
    instructionTexture.update();
    const instructionFace = MeshBuilder.CreatePlane('eco-center-instruction-face', { width: 2.5, height: 1.22 }, this.scene);
    instructionFace.position.set(-32.2, 2.6, 8.68);
    instructionFace.billboardMode = Mesh.BILLBOARDMODE_Y;
    const instructionMaterial = this.material('eco-center-instruction-face-material', new Color3(1, 1, 1));
    instructionMaterial.diffuseTexture = instructionTexture;
    instructionMaterial.emissiveColor = new Color3(0.12, 0.18, 0.13);
    instructionFace.material = instructionMaterial;
  }


  private get activeVehicle(): Mesh {
    return this.activePhase === 2 ? this.portTruck : this.vehicle;
  }

  private isPlayerPart(mesh: Mesh): boolean {
    let node: any = mesh;
    while (node) {
      if (node === this.player) return true;
      node = node.parent;
    }
    return false;
  }

  private buildPortDistrict(): void {
    const ground = MeshBuilder.CreateGround('port-ground', { width: 90, height: 90 }, this.scene);
    ground.position.y = -0.08;
    ground.checkCollisions = true;
    ground.material = this.material('port-ground-material', new Color3(0.47, 0.48, 0.39));

    const concrete = this.material('port-concrete', new Color3(0.49, 0.53, 0.50));
    const asphalt = this.material('port-asphalt', new Color3(0.16, 0.20, 0.20));
    const hazard = this.material('port-hazard-yellow', new Color3(0.92, 0.68, 0.18));
    const warehouseColors = [
      new Color3(0.64, 0.47, 0.31), new Color3(0.47, 0.55, 0.57), new Color3(0.64, 0.60, 0.43),
    ];
    const road = MeshBuilder.CreateGround('port-service-road', { width: 82, height: 8 }, this.scene);
    road.position.set(0, 0.02, 30);
    road.material = asphalt;
    for (let x = -37; x <= 37; x += 8) {
      const dash = MeshBuilder.CreateBox('port-road-marking', { width: 3.2, height: 0.025, depth: 0.12 }, this.scene);
      dash.position.set(x, 0.06, 30);
      dash.material = hazard;
    }
    const quay = MeshBuilder.CreateGround('port-quay', { width: 23, height: 82 }, this.scene);
    quay.position.set(24, 0.015, 0);
    quay.material = concrete;

    this.portRiverMaterial = this.material('port-polluted-river-material', new Color3(0.28, 0.34, 0.27));
    this.portRiverMaterial.alpha = 0.94;
    const river = MeshBuilder.CreateGround('port-polluted-river', { width: 13, height: 86 }, this.scene);
    river.position.set(37, 0.025, 0);
    river.material = this.portRiverMaterial;
    const bank = this.material('port-river-bank', new Color3(0.36, 0.33, 0.25));
    for (const x of [30.1, 43.8]) {
      const edge = MeshBuilder.CreateBox('port-river-bank-edge', { width: 0.9, height: 0.5, depth: 86 }, this.scene);
      edge.position.set(x, 0.17, 0);
      edge.material = bank;
      edge.checkCollisions = true;
    }

    // Three visible discharge pipes and dirty-water channels lead from the yards to the river.
    for (const [index, site] of this.portOutfallPositions.entries()) {
      const pipeMaterial = this.material(`port-outfall-pipe-${index}`, new Color3(0.26, 0.29, 0.27));
      const pipe = MeshBuilder.CreateCylinder(`port-outfall-pipe-${index}`, { height: 2.4, diameter: 0.78, tessellation: 12 }, this.scene);
      pipe.position.set(29.4, 1.15, site.z);
      pipe.rotation.z = Math.PI / 2;
      pipe.material = pipeMaterial;
      const flowMaterial = this.material(`port-outfall-flow-${index}`, new Color3(0.36, 0.40, 0.27));
      const flow = MeshBuilder.CreateBox(`port-polluted-discharge-${index}`, { width: 7.0, height: 0.055, depth: 0.82 }, this.scene);
      flow.position.set(33.2, 0.09, site.z);
      flow.material = flowMaterial;
      this.portOutletMaterials.push(flowMaterial);

      const marker = MeshBuilder.CreateCylinder(`port-sampling-marker-${index}`, { height: 1.15, diameterTop: 0.42, diameterBottom: 0.62, tessellation: 10 }, this.scene);
      marker.position.set(site.x, 0.58, site.z);
      marker.material = this.material(`port-sampling-marker-material-${index}`, new Color3(0.82, 0.62, 0.20));
      this.portOutfallMarkers.push(marker);
      const markerCap = MeshBuilder.CreateSphere(`port-sampling-beacon-${index}`, { diameter: 0.38, segments: 8 }, this.scene);
      markerCap.position.set(site.x, 1.28, site.z);
      markerCap.material = this.material(`port-sampling-beacon-material-${index}`, new Color3(0.94, 0.70, 0.20));
    }

    // Three port companies with visible signs and loading doors.
    const warehouseZ = [-22, 0, 22];
    warehouseZ.forEach((z, index) => {
      const building = MeshBuilder.CreateBox(`port-warehouse-${index}`, { width: 13, height: 8.5, depth: 11 }, this.scene);
      building.position.set(-25, 4.25, z);
      building.material = this.material(`port-warehouse-material-${index}`, warehouseColors[index]);
      building.checkCollisions = true;
      const roof = MeshBuilder.CreateBox(`port-warehouse-roof-${index}`, { width: 13.5, height: 0.35, depth: 11.5 }, this.scene);
      roof.position.set(-25, 8.62, z);
      roof.material = this.material(`port-warehouse-roof-material-${index}`, new Color3(0.25, 0.30, 0.29));
      const shutter = MeshBuilder.CreateBox(`port-warehouse-door-${index}`, { width: 0.18, height: 3.2, depth: 4.1 }, this.scene);
      shutter.position.set(-18.35, 1.9, z);
      shutter.material = this.material(`port-warehouse-door-material-${index}`, new Color3(0.16, 0.27, 0.29));
      const sign = MeshBuilder.CreateBox(`port-warehouse-sign-${index}`, { width: 0.18, height: 0.85, depth: 5.3 }, this.scene);
      sign.position.set(-18.22, 6.2, z);
      sign.material = this.material(`port-warehouse-sign-material-${index}`, new Color3(0.10, 0.31, 0.26));
      const signTexture = new DynamicTexture(`port-warehouse-label-${index}`, { width: 512, height: 128 }, this.scene, false);
      const ctx = signTexture.getContext() as unknown as CanvasRenderingContext2D;
      ctx.fillStyle = '#104432'; ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = '#E8F5D8'; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center';
      ctx.fillText(this.portCompanyNames[index], 256, 82, 480);
      signTexture.update();
      const face = MeshBuilder.CreatePlane(`port-warehouse-label-face-${index}`, { width: 4.9, height: 0.62 }, this.scene);
      face.position.set(-18.10, 6.2, z);
      face.rotation.y = -Math.PI / 2;
      const faceMat = this.material(`port-warehouse-label-face-mat-${index}`, new Color3(1, 1, 1));
      faceMat.diffuseTexture = signTexture;
      faceMat.emissiveColor = new Color3(0.1, 0.13, 0.1);
      face.material = faceMat;
    });

    const containerColors = [
      new Color3(0.63, 0.26, 0.20), new Color3(0.17, 0.39, 0.53), new Color3(0.72, 0.55, 0.20),
      new Color3(0.20, 0.43, 0.33), new Color3(0.56, 0.31, 0.19),
    ];
    for (let i = 0; i < 5; i++) {
      const container = MeshBuilder.CreateBox(`port-shipping-container-${i}`, { width: 5.6, height: 2.5, depth: 2.6 }, this.scene);
      container.position.set(-7 + (i % 2) * 6.2, 1.25, -29 + Math.floor(i / 2) * 5.5);
      container.material = this.material(`port-container-material-${i}`, containerColors[i]);
      const ribMaterial = this.material(`port-container-rib-material-${i}`, new Color3(0.75, 0.72, 0.62));
      for (let rib = -2; rib <= 2; rib++) {
        const line = MeshBuilder.CreateBox(`port-container-rib-${i}`, { width: 0.055, height: 2.35, depth: 0.04 }, this.scene);
        line.position.set(container.position.x + rib * 0.92, 1.25, container.position.z + 1.33);
        line.material = ribMaterial;
      }
    }

    const craneMat = this.material('port-crane-steel', new Color3(0.75, 0.58, 0.22));
    for (const x of [13, 22]) {
      const leg = MeshBuilder.CreateBox('port-crane-leg', { width: 0.65, height: 12, depth: 0.65 }, this.scene);
      leg.position.set(x, 6, -31);
      leg.material = craneMat;
    }
    const craneBeam = MeshBuilder.CreateBox('port-crane-main-beam', { width: 10, height: 0.72, depth: 0.72 }, this.scene);
    craneBeam.position.set(17.5, 12.1, -31);
    craneBeam.material = craneMat;
    const craneArm = MeshBuilder.CreateBox('port-crane-jib', { width: 0.35, height: 0.35, depth: 12 }, this.scene);
    craneArm.position.set(22.5, 12.0, -25);
    craneArm.material = craneMat;
    const craneCable = MeshBuilder.CreateCylinder('port-crane-cable', { height: 5.2, diameter: 0.08 }, this.scene);
    craneCable.position.set(22.5, 9.2, -20.3);
    craneCable.material = this.material('port-crane-cable-material', new Color3(0.13, 0.15, 0.15));

    const treatmentPad = MeshBuilder.CreateGround('port-treatment-pad', { width: 13, height: 13 }, this.scene);
    treatmentPad.position.set(14, 0.035, 0);
    treatmentPad.material = this.material('port-treatment-pad-material', new Color3(0.34, 0.43, 0.37));
    const treatmentOutline = this.material('port-treatment-outline', new Color3(0.92, 0.75, 0.30));
    for (const z of [-6.1, 6.1]) {
      const line = MeshBuilder.CreateBox('port-treatment-outline-line', { width: 13, height: 0.04, depth: 0.12 }, this.scene);
      line.position.set(14, 0.075, z);
      line.material = treatmentOutline;
    }
    const treatmentSign = MeshBuilder.CreateBox('port-treatment-empty-sign', { width: 0.2, height: 1.4, depth: 6.5 }, this.scene);
    treatmentSign.position.set(7.45, 2.4, 0);
    treatmentSign.material = this.material('port-treatment-empty-sign-material', new Color3(0.10, 0.29, 0.24));
    const treatmentLabel = new DynamicTexture('port-treatment-empty-label', { width: 700, height: 180 }, this.scene, false);
    const treatmentContext = treatmentLabel.getContext() as unknown as CanvasRenderingContext2D;
    treatmentContext.fillStyle = '#124934'; treatmentContext.fillRect(0, 0, 700, 180);
    treatmentContext.fillStyle = '#F0F6E7'; treatmentContext.font = 'bold 48px Arial'; treatmentContext.textAlign = 'center';
    treatmentContext.fillText('ÁREA PARA ETE', 350, 112);
    treatmentLabel.update();
    const treatmentFace = MeshBuilder.CreatePlane('port-treatment-empty-face', { width: 5.9, height: 1.05 }, this.scene);
    treatmentFace.position.set(7.30, 2.45, 0);
    treatmentFace.rotation.y = -Math.PI / 2;
    const treatmentFaceMat = this.material('port-treatment-empty-face-material', new Color3(1, 1, 1));
    treatmentFaceMat.diffuseTexture = treatmentLabel; treatmentFaceMat.emissiveColor = new Color3(0.12, 0.15, 0.11);
    treatmentFace.material = treatmentFaceMat;

    // Septic systems serve isolated sanitary facilities; industrial effluent is treated by the ETE.
    this.portSepticPositions.forEach((site, index) => {
      const pad = MeshBuilder.CreateGround(`port-septic-pad-${index}`, { width: 8, height: 7 }, this.scene);
      pad.position.set(site.x, 0.03, site.z);
      pad.material = this.material(`port-septic-pad-material-${index}`, new Color3(0.42, 0.46, 0.39));
      const building = MeshBuilder.CreateBox(`port-sanitary-building-${index}`, { width: 4.2, height: 2.7, depth: 3.2 }, this.scene);
      building.position.set(site.x - 5.3, 1.35, site.z);
      building.material = this.material(`port-sanitary-building-material-${index}`, new Color3(0.75, 0.69, 0.52));
      building.checkCollisions = true;
      const marker = MeshBuilder.CreateCylinder(`port-septic-marker-${index}`, { height: 0.6, diameter: 0.8, tessellation: 10 }, this.scene);
      marker.position.set(site.x, 0.32, site.z);
      marker.material = this.material(`port-septic-marker-material-${index}`, new Color3(0.77, 0.62, 0.27));
    });

    this.portCompanyPositions.forEach((site, index) => {
      const bay = MeshBuilder.CreateGround(`port-company-waste-bay-${index}`, { width: 7.2, height: 6.2 }, this.scene);
      bay.position.set(site.x, 0.035, site.z);
      bay.material = this.material(`port-company-waste-bay-material-${index}`, new Color3(0.39, 0.42, 0.35));
      for (const x of [site.x - 3.45, site.x + 3.45]) {
        const stripe = MeshBuilder.CreateBox(`port-company-waste-bay-line-${index}`, { width: 0.12, height: 0.035, depth: 6.0 }, this.scene);
        stripe.position.set(x, 0.075, site.z);
        stripe.material = hazard;
      }
      const pile = MeshBuilder.CreateBox(`port-company-waste-pile-${index}`, { width: 2.3, height: 1.3, depth: 2.0 }, this.scene);
      pile.position.set(site.x, 0.72, site.z);
      pile.material = this.material(`port-company-waste-pile-material-${index}`, new Color3(0.55, 0.43, 0.27));
      this.portWastePiles.push(pile);
      const bag = MeshBuilder.CreateSphere(`port-company-waste-bag-${index}`, { diameter: 0.8, segments: 7 }, this.scene);
      bag.position.set(site.x + 0.7, 0.65, site.z + 0.75);
      bag.material = this.material(`port-company-waste-bag-material-${index}`, new Color3(0.21, 0.31, 0.27));
    });

    this.buildPortCooperative();

    // A compact drivable collection truck for the three company pickup points.
    const truck = MeshBuilder.CreateBox('port-collection-truck-collider', { width: 2.35, height: 0.78, depth: 4.4 }, this.scene);
    truck.position.set(-31, 0.52, 30);
    truck.rotation.y = Math.PI / 2;
    truck.checkCollisions = true;
    truck.visibility = 0;
    const truckBody = this.material('port-truck-body', new Color3(0.93, 0.70, 0.13));
    const truckHull = MeshBuilder.CreateSphere('port-collection-truck-rounded-hull', { diameter: 1, segments: 26 }, this.scene);
    truckHull.parent = truck; truckHull.position.set(0, 0.0, 0); truckHull.scaling.set(1.16, 0.42, 2.16); truckHull.material = truckBody;
    const cargo = MeshBuilder.CreateCapsule('port-truck-cargo-box', { height: 2.8, radius: 0.94, tessellation: 18 }, this.scene);
    cargo.parent = truck; cargo.position.set(0, 0.95, -0.55); cargo.rotation.x = Math.PI / 2;
    cargo.scaling.set(1.12, 1.0, 0.68);
    cargo.material = this.material('port-truck-cargo-material', new Color3(0.20, 0.49, 0.34));
    const cab = MeshBuilder.CreateSphere('port-truck-cab', { diameter: 1, segments: 24 }, this.scene);
    cab.parent = truck; cab.position.set(0, 0.8, 1.28); cab.scaling.set(0.98, 0.70, 0.75);
    cab.material = truckBody;
    const cabGlass = MeshBuilder.CreateBox('port-truck-cab-glass', { width: 1.7, height: 0.62, depth: 0.10 }, this.scene);
    cabGlass.parent = truck; cabGlass.position.set(0, 1.0, 1.98);
    cabGlass.material = this.material('port-truck-cab-glass-material', new Color3(0.12, 0.28, 0.32));
    const headlight = this.material('port-truck-headlights', new Color3(0.98, 0.84, 0.48));
    for (const side of [-1, 1]) {
      for (const z of [-1.4, 1.4]) {
        const wheel = MeshBuilder.CreateCylinder('port-truck-wheel', { height: 0.26, diameter: 0.88, tessellation: 12 }, this.scene);
        wheel.parent = truck; wheel.position.set(side * 1.12, -0.27, z);
        wheel.rotation.z = Math.PI / 2;
        wheel.material = this.material('port-truck-wheel-material', new Color3(0.07, 0.08, 0.08));
      }
      const lamp = MeshBuilder.CreateBox('port-truck-headlamp', { width: 0.32, height: 0.25, depth: 0.1 }, this.scene);
      lamp.parent = truck; lamp.position.set(side * 0.78, 0.05, 2.18); lamp.material = headlight;
    }
    const truckMark = MeshBuilder.CreateBox('port-truck-door-mark', { width: 0.06, height: 0.42, depth: 0.82 }, this.scene);
    truckMark.parent = truck; truckMark.position.set(1.19, 0.12, 1.12);
    truckMark.material = this.material('port-truck-door-mark-material', new Color3(0.92, 0.93, 0.82));
    this.portTruck = truck;
  }


  /** Cooperativa onde o jogador descarrega e separa os cinco grupos de materiais. */
  private buildPortCooperative(): void {
    const { x, z } = this.portCooperativePosition;
    const pad = MeshBuilder.CreateGround('port-cooperative-yard', { width: 18, height: 15 }, this.scene);
    pad.position.set(x, 0.04, z);
    pad.material = this.material('port-cooperative-yard-material', new Color3(0.49, 0.56, 0.46));

    const building = MeshBuilder.CreateBox('port-cooperative-building', { width: 10, height: 4.8, depth: 7 }, this.scene);
    building.position.set(x, 2.4, z - 6.2);
    building.material = this.material('port-cooperative-building-material', new Color3(0.73, 0.76, 0.64));
    building.checkCollisions = true;
    const roof = MeshBuilder.CreateBox('port-cooperative-roof', { width: 10.5, height: 0.35, depth: 7.5 }, this.scene);
    roof.position.set(x, 4.88, z - 6.2);
    roof.material = this.material('port-cooperative-roof-material', new Color3(0.17, 0.32, 0.25));

    const sign = MeshBuilder.CreateBox('port-cooperative-sign', { width: 9.0, height: 1.35, depth: 0.18 }, this.scene);
    sign.position.set(x, 5.65, z - 2.55);
    sign.material = this.material('port-cooperative-sign-material', new Color3(0.07, 0.25, 0.17));
    const signTexture = new DynamicTexture('port-cooperative-sign-texture', { width: 1024, height: 256 }, this.scene, false);
    const signContext = signTexture.getContext() as unknown as CanvasRenderingContext2D;
    signContext.fillStyle = '#10432E'; signContext.fillRect(0, 0, 1024, 256);
    signContext.fillStyle = '#E8F6D9'; signContext.font = 'bold 72px Arial'; signContext.textAlign = 'center';
    signContext.fillText('COOPERATIVA', 512, 104);
    signContext.fillStyle = '#B9EE91'; signContext.font = 'bold 42px Arial';
    signContext.fillText('DESCARGA  ·  TRIAGEM  ·  RECICLAGEM', 512, 184);
    signTexture.update();
    const signFace = MeshBuilder.CreatePlane('port-cooperative-sign-face', { width: 8.7, height: 1.15 }, this.scene);
    signFace.position.set(x, 5.65, z - 2.43);
    signFace.billboardMode = Mesh.BILLBOARDMODE_Y;
    const signFaceMaterial = this.material('port-cooperative-sign-face-material', new Color3(1, 1, 1));
    signFaceMaterial.diffuseTexture = signTexture;
    signFaceMaterial.emissiveColor = new Color3(0.14, 0.19, 0.12);
    signFace.material = signFaceMaterial;

    const sortingBelt = MeshBuilder.CreateBox('port-cooperative-sorting-belt', { width: 14.2, height: 0.32, depth: 1.25 }, this.scene);
    sortingBelt.position.set(x, 0.34, z + 2.2);
    sortingBelt.material = this.material('port-cooperative-sorting-belt-material', new Color3(0.20, 0.25, 0.22));

    const palette = [
      { color: new Color3(0.10, 0.34, 0.68), hex: '#1976D2' },
      { color: new Color3(0.74, 0.15, 0.16), hex: '#C93232' },
      { color: new Color3(0.12, 0.48, 0.29), hex: '#237D4B' },
      { color: new Color3(0.86, 0.66, 0.10), hex: '#D3A51B' },
      { color: new Color3(0.43, 0.27, 0.16), hex: '#70452C' },
    ];
    this.portCooperativeBinPositions.forEach((site, index) => {
      const bodyMaterial = this.material(`port-cooperative-bin-material-${index}`, palette[index].color);
      this.portCooperativeBinMaterials.push(bodyMaterial);
      const bin = MeshBuilder.CreateBox(`port-cooperative-sorting-bin-${index}`, { width: 2.12, height: 1.38, depth: 1.55 }, this.scene);
      bin.position.set(site.x, 0.69, site.z);
      bin.material = bodyMaterial;
      const rim = MeshBuilder.CreateBox(`port-cooperative-bin-rim-${index}`, { width: 2.2, height: 0.12, depth: 1.62 }, this.scene);
      rim.position.set(site.x, 1.42, site.z);
      rim.material = this.material(`port-cooperative-bin-rim-material-${index}`, new Color3(0.13, 0.17, 0.14));

      const labelTexture = new DynamicTexture(`port-cooperative-bin-label-${index}`, { width: 512, height: 150 }, this.scene, false);
      const labelContext = labelTexture.getContext() as unknown as CanvasRenderingContext2D;
      labelContext.fillStyle = '#F4F5E9'; labelContext.fillRect(0, 0, 512, 150);
      labelContext.fillStyle = palette[index].hex; labelContext.fillRect(0, 0, 512, 22);
      labelContext.fillStyle = '#17251C'; labelContext.font = 'bold 34px Arial'; labelContext.textAlign = 'center';
      labelContext.fillText(this.portCooperativeMaterialNames[index], 256, 83, 490);
      labelContext.fillStyle = '#53695B'; labelContext.font = 'bold 22px Arial';
      labelContext.fillText('MATERIAL SEPARADO', 256, 123);
      labelTexture.update();
      const label = MeshBuilder.CreatePlane(`port-cooperative-bin-label-face-${index}`, { width: 2.02, height: 0.62 }, this.scene);
      label.position.set(site.x, 1.0, site.z + 0.79);
      label.billboardMode = Mesh.BILLBOARDMODE_Y;
      const labelMaterial = this.material(`port-cooperative-bin-label-material-${index}`, new Color3(1, 1, 1));
      labelMaterial.diffuseTexture = labelTexture;
      labelMaterial.emissiveColor = new Color3(0.10, 0.10, 0.08);
      label.material = labelMaterial;
    });

    const guide = MeshBuilder.CreateBox('port-cooperative-guide-board', { width: 0.16, height: 2.6, depth: 6.2 }, this.scene);
    guide.position.set(29.2, 1.3, z + 1.5);
    guide.material = this.material('port-cooperative-guide-material', new Color3(0.08, 0.26, 0.18));
    const guideTexture = new DynamicTexture('port-cooperative-guide-texture', { width: 512, height: 512 }, this.scene, false);
    const guideContext = guideTexture.getContext() as unknown as CanvasRenderingContext2D;
    guideContext.fillStyle = '#10432E'; guideContext.fillRect(0, 0, 512, 512);
    guideContext.fillStyle = '#EAF5E2'; guideContext.font = 'bold 34px Arial'; guideContext.textAlign = 'center';
    guideContext.fillText('SEPARE EM 5 GRUPOS', 256, 72);
    this.portCooperativeMaterialNames.forEach((name, index) => {
      guideContext.fillStyle = palette[index].hex;
      guideContext.fillRect(26, 108 + index * 76, 460, 62);
      guideContext.fillStyle = '#FFFFFF'; guideContext.font = 'bold 29px Arial';
      guideContext.fillText(name, 256, 150 + index * 76, 430);
    });
    guideTexture.update();
    const guideFace = MeshBuilder.CreatePlane('port-cooperative-guide-face', { width: 2.5, height: 2.5 }, this.scene);
    guideFace.position.set(29.08, 1.65, z + 1.5);
    guideFace.rotation.y = -Math.PI / 2;
    const guideMaterial = this.material('port-cooperative-guide-face-material', new Color3(1, 1, 1));
    guideMaterial.diffuseTexture = guideTexture;
    guideMaterial.emissiveColor = new Color3(0.10, 0.15, 0.10);
    guideFace.material = guideMaterial;
  }

  enterPortPhase(): void {
    if (this.activePhase === 2) { this.setMapOpen(false); return; }
    if (!this.isNextNeighborhoodUnlocked()) {
      this.message = 'Conclua todas as metas do Centro Industrial para liberar o Porto.';
      this.emit();
      return;
    }
    this.activePhase = 2;
    this.phaseOneMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.portMeshes.forEach((mesh) => mesh.setEnabled(true));
    this.phaseOneModelRoots.forEach((root) => root.setEnabled(false));
    this.portModelRoots.forEach((root) => root.setEnabled(true));
    this.player.position.set(-25, 1, 30.5);
    this.player.setEnabled(true);
    this.inVehicle = false;
    this.vehicleSpeed = 0;
    this.keys.clear();
    this.mapOpen = false;
    this.paused = false;
    this.camera.setTarget(new Vector3(-25, 1.2, 30.5));
    this.message = 'Bem-vindo ao Porto. Inspecione os três pontos de despejo antes de escolher a solução de tratamento.';
    this.emit();
  }

  private findNearestOutfall(): number {
    let best = -1;
    let bestDistance = 5.4;
    this.portOutfallMarkers.forEach((marker, index) => {
      if (this.portOutfallInspected.has(index)) return;
      const distance = Math.hypot(this.player.position.x - marker.position.x, this.player.position.z - marker.position.z);
      if (distance < bestDistance) { best = index; bestDistance = distance; }
    });
    return best;
  }

  private findNearestSepticSite(): number {
    let best = -1;
    let bestDistance = 6.2;
    this.portSepticPositions.forEach((site, index) => {
      if (this.portSepticInstalled[index]) return;
      const distance = Math.hypot(this.player.position.x - site.x, this.player.position.z - site.z);
      if (distance < bestDistance) { best = index; bestDistance = distance; }
    });
    return best;
  }

  private findNearestCompanyWaste(): number {
    let best = -1;
    let bestDistance = 5.2;
    this.portCompanyPositions.forEach((site, index) => {
      if (!this.portWastePiles[index]?.isEnabled()) return;
      const distance = Math.hypot(this.activeVehicle.position.x - site.x, this.activeVehicle.position.z - site.z);
      if (distance < bestDistance) { best = index; bestDistance = distance; }
    });
    return best;
  }

  private findNearestCooperativeBin(): number {
    let best = -1;
    let bestDistance = 4.2;
    this.portCooperativeBinPositions.forEach((site, index) => {
      if (this.portCooperativeSorted[index]) return;
      const distance = Math.hypot(this.player.position.x - site.x, this.player.position.z - site.z);
      if (distance < bestDistance) { best = index; bestDistance = distance; }
    });
    return best;
  }

  private getNearbyPortInteraction(): { action: NearbyAction; label: string } | null {
    if (this.inVehicle) {
      const moving = Math.abs(this.vehicleSpeed) > 0.45;
      if (this.portMissionStage === 'collect') {
        const company = this.findNearestCompanyWaste();
        if (company >= 0) {
          return {
            action: 'collect-company-waste',
            label: moving ? 'PARE O CAMINHÃO PARA COLETAR' : `E · CARREGAR RESÍDUOS · ${this.portCompanyNames[company]}`,
          };
        }
      }
      if (this.portMissionStage === 'deliver') {
        const cooperativeDistance = Math.hypot(
          this.portTruck.position.x - this.portCooperativePosition.x,
          this.portTruck.position.z - this.portCooperativePosition.z,
        );
        if (cooperativeDistance <= 9.5) {
          return {
            action: 'deliver-cooperative',
            label: moving ? 'PARE O CAMINHÃO PARA DESCARREGAR' : 'E · DESCARREGAR NA COOPERATIVA',
          };
        }
        return null;
      }
      return { action: 'exit-vehicle', label: moving ? 'F · PARE PARA DESCER DO CAMINHÃO' : 'F · DESCER DO CAMINHÃO' };
    }
    if (this.portMissionStage === 'inspect') {
      const index = this.findNearestOutfall();
      if (index >= 0) return { action: 'inspect-outfall', label: `E · ANALISAR DESPEJO ${index + 1}/3` };
    }
    if (this.portMissionStage === 'treatment') {
      if (Math.hypot(this.player.position.x - 14, this.player.position.z) <= 7.2) {
        return { action: 'install-treatment', label: 'E · CONSTRUIR ESTAÇÃO DE TRATAMENTO' };
      }
    }
    if (this.portMissionStage === 'septic') {
      const index = this.findNearestSepticSite();
      if (index >= 0) return { action: 'install-septic', label: `E · INSTALAR FOSSA SÉPTICA ${index + 1}/2` };
    }
    if (this.portMissionStage === 'sorting') {
      const index = this.findNearestCooperativeBin();
      if (index >= 0) return {
        action: 'sort-cooperative-materials',
        label: `E · SEPARAR ${this.portCooperativeMaterialNames[index]}`,
      };
    }
    if (this.portMissionStage === 'collect' || this.portMissionStage === 'deliver') {
      const truckDistance = Math.hypot(this.player.position.x - this.portTruck.position.x, this.player.position.z - this.portTruck.position.z);
      if (truckDistance <= 8.5) return { action: 'enter-vehicle', label: 'F · ENTRAR NO CAMINHÃO DE COLETA' };
    }
    return null;
  }

  private installPortTreatment(): void {
    if (this.portTreatmentInstalled) return;
    this.portTreatmentInstalled = true;
    const tankMaterials = [
      this.material('port-ete-tank-a', new Color3(0.72, 0.77, 0.72)),
      this.material('port-ete-tank-b', new Color3(0.54, 0.68, 0.62)),
    ];
    for (const [index, x] of [10.5, 14.0, 17.5].entries()) {
      const tank = MeshBuilder.CreateCylinder(`port-ete-treatment-tank-${index}`, { height: 2.4, diameter: 3.0, tessellation: 20 }, this.scene);
      tank.position.set(x, 1.2, 0);
      tank.material = tankMaterials[index % 2];
      const cap = MeshBuilder.CreateCylinder(`port-ete-tank-cap-${index}`, { height: 0.20, diameter: 2.45, tessellation: 20 }, this.scene);
      cap.position.set(x, 2.5, 0);
      cap.material = this.material(`port-ete-tank-cap-material-${index}`, new Color3(0.24, 0.49, 0.39));
    }
    const control = MeshBuilder.CreateBox('port-ete-control-building', { width: 3.8, height: 2.5, depth: 3.2 }, this.scene);
    control.position.set(14, 1.25, 4.7);
    control.material = this.material('port-ete-control-building-material', new Color3(0.86, 0.84, 0.69));
    const pipe = MeshBuilder.CreateTube('port-ete-clean-water-pipe', {
      path: [new Vector3(18.5, 1.0, 0), new Vector3(23, 1.0, 0), new Vector3(27, 0.9, 0)],
      radius: 0.16, tessellation: 10,
    }, this.scene);
    pipe.material = this.material('port-ete-clean-water-pipe-material', new Color3(0.22, 0.67, 0.72));
    this.portRiverMaterial.diffuseColor = new Color3(0.17, 0.50, 0.62);
    this.portOutletMaterials.forEach((material) => { material.diffuseColor = new Color3(0.22, 0.65, 0.70); });
    this.portWaterQuality = 66;
    this.portMissionStage = 'septic';
    this.message = 'ETE implantada! Os efluentes industriais agora passam por tratamento. Instale duas fossas sépticas nas instalações sanitárias isoladas do porto.';
    this.emit();
  }

  private installPortSeptic(): void {
    const index = this.findNearestSepticSite();
    if (index < 0) { this.message = 'Aproxime-se de uma das áreas sanitárias sinalizadas.'; this.emit(); return; }
    this.portSepticInstalled[index] = true;
    const site = this.portSepticPositions[index];
    const tank = MeshBuilder.CreateCylinder(`port-septic-tank-${index}`, { height: 0.9, diameter: 2.7, tessellation: 16 }, this.scene);
    tank.position.set(site.x, 0.35, site.z);
    tank.material = this.material(`port-septic-tank-material-${index}`, new Color3(0.62, 0.69, 0.60));
    const lid = MeshBuilder.CreateCylinder(`port-septic-tank-lid-${index}`, { height: 0.18, diameter: 0.9, tessellation: 12 }, this.scene);
    lid.position.set(site.x, 0.9, site.z);
    lid.material = this.material(`port-septic-tank-lid-material-${index}`, new Color3(0.18, 0.40, 0.32));
    this.portWaterQuality = Math.min(90, this.portWaterQuality + 6);
    if (this.portSepticInstalled.every(Boolean)) {
      this.portMissionStage = 'collect';
      this.message = 'As duas fossas sépticas foram instaladas. Agora use o caminhão amarelo para coletar os resíduos nos três pontos das empresas.';
    } else {
      this.message = `Sistema sanitário ${index + 1}/2 instalado. Vá até a outra instalação isolada para concluir a etapa.`;
    }
    this.emit();
  }

  private collectPortCompanyWaste(): void {
    if (Math.abs(this.vehicleSpeed) > 0.45) {
      this.message = 'Pare completamente o caminhão ao lado do ponto de coleta para carregar os resíduos.';
      this.emit();
      return;
    }
    const index = this.findNearestCompanyWaste();
    if (index < 0) { this.message = 'Aproxime o caminhão de um ponto de coleta de uma empresa.'; this.emit(); return; }
    this.portWastePiles[index].setEnabled(false);
    this.portWasteCollected += 1;
    if (this.portWasteCollected >= this.portCompanyPositions.length) {
      this.portMissionStage = 'deliver';
      this.message = 'As três empresas já foram atendidas. Agora dirija o caminhão até a COOPERATIVA, estacione na área de descarga e toque em DESCARREGAR.';
    } else {
      this.message = `Carga de ${this.portCompanyNames[index]} recolhida (${this.portWasteCollected}/3). Siga até a próxima empresa.`;
    }
    this.emit();
  }

  private deliverPortWaste(): void {
    if (!this.inVehicle) { this.message = 'Entre no caminhão para descarregar a carga na cooperativa.'; this.emit(); return; }
    if (Math.abs(this.vehicleSpeed) > 0.45) { this.message = 'Pare completamente na área de descarga antes de descarregar os materiais.'; this.emit(); return; }
    const distance = Math.hypot(this.portTruck.position.x - this.portCooperativePosition.x, this.portTruck.position.z - this.portCooperativePosition.z);
    if (distance > 9.5) { this.message = 'Siga as placas até a cooperativa de materiais e aproxime o caminhão da área de descarga.'; this.emit(); return; }
    this.portMissionStage = 'sorting';
    this.message = 'Carga descarregada! Desça do caminhão e separe os cinco grupos nas baias identificadas: papel/papelão, plástico, vidro, metal e orgânico.';
    this.emit();
  }

  private sortPortMaterial(): void {
    if (this.inVehicle) { this.message = 'Desça do caminhão para acessar as baias de separação.'; this.emit(); return; }
    const index = this.findNearestCooperativeBin();
    if (index < 0) { this.message = 'Aproxime-se de uma baia ainda não utilizada na cooperativa.'; this.emit(); return; }
    this.portCooperativeSorted[index] = true;
    const binMaterial = this.portCooperativeBinMaterials[index];
    if (binMaterial) binMaterial.emissiveColor = new Color3(0.10, 0.22, 0.10);
    const sortedCount = this.portCooperativeSorted.filter(Boolean).length;
    if (sortedCount === this.portCooperativeMaterialNames.length) {
      this.portMissionStage = 'complete';
      this.portWaterQuality = Math.min(100, this.portWaterQuality + 8);
      this.message = 'Triagem concluída! Papel/papelão, plástico, vidro, metal e orgânico foram separados e encaminhados corretamente. Porto recuperado; Região 03 liberada no mapa.';
    } else {
      this.message = `${this.portCooperativeMaterialNames[index]} separado corretamente (${sortedCount}/5). Continue nas baias restantes da cooperativa.`;
    }
    this.emit();
  }

  private performPortAction(action: NearbyAction): void {
    if (action === 'enter-vehicle' || action === 'exit-vehicle') { this.toggleVehicle(); return; }
    if (action === 'deliver-cooperative') { this.deliverPortWaste(); return; }
    if (action === 'sort-cooperative-materials') { this.sortPortMaterial(); return; }
    if (action === 'inspect-outfall') {
      const index = this.findNearestOutfall();
      if (index < 0) { this.message = 'Aproxime-se de um dos três pontos de despejo para analisar a água.'; this.emit(); return; }
      this.portOutfallsInspected += 1;
      this.portOutfallInspected.add(index);
      this.portOutfallMarkers[index].material = this.material(`port-outfall-inspected-${index}`, new Color3(0.18, 0.62, 0.52));
      if (this.portOutfallsInspected >= this.portOutfallPositions.length) {
        this.portMissionStage = 'treatment';
        this.message = 'Diagnóstico concluído. As três saídas estão contaminadas: construa a ETE no terreno sinalizado entre o pátio e o rio.';
      } else {
        this.message = `Amostra ${this.portOutfallsInspected}/3 registrada. Procure o próximo ponto de despejo indicado no terreno.`;
      }
      this.emit();
      return;
    }
    if (action === 'install-treatment') { this.installPortTreatment(); return; }
    if (action === 'install-septic') { this.installPortSeptic(); return; }
    if (action === 'collect-company-waste') { this.collectPortCompanyWaste(); return; }
    this.message = 'Aproxime-se do próximo objetivo indicado pela missão.';
    this.emit();
  }

  private buildRiver(): void {
    const river = MeshBuilder.CreateGround('polluted-river', { width: 18, height: 84, subdivisions: 1 }, this.scene);
    river.position.set(48, -0.015, 0);
    river.material = this.riverMaterial;
    const bankMat = this.material('river-bank', new Color3(0.39, 0.35, 0.26));
    for (const x of [38.5, 57.5]) {
      const bank = MeshBuilder.CreateBox('river-bank', { width: 1.2, height: 0.55, depth: 84 }, this.scene);
      bank.position.set(x, 0.16, 0);
      bank.material = bankMat;
      bank.checkCollisions = true;
    }
  }


  private buildVehicleConversionStation(): void {
    const pad = MeshBuilder.CreateGround('ev-conversion-parking-pad', { width: 9.2, height: 8.2 }, this.scene);
    pad.position.set(this.vehicleBasePosition.x, 0.04, this.vehicleBasePosition.z);
    pad.material = this.material('ev-conversion-pad-material', new Color3(0.23, 0.36, 0.28));
    const parkingLines = this.material('ev-conversion-parking-lines', new Color3(0.92, 0.88, 0.66));
    for (const x of [26.6, 35.4]) {
      const line = MeshBuilder.CreateBox('ev-conversion-parking-line', { width: 0.13, height: 0.04, depth: 7.4 }, this.scene);
      line.position.set(x, 0.075, this.vehicleBasePosition.z); line.material = parkingLines;
    }
    const frontLine = MeshBuilder.CreateBox('ev-conversion-parking-front-line', { width: 8.8, height: 0.04, depth: 0.13 }, this.scene);
    frontLine.position.set(this.vehicleBasePosition.x, 0.075, 19.5); frontLine.material = parkingLines;
    const support = this.material('ev-base-support-material', new Color3(0.23, 0.31, 0.28));
    for (const x of [27.2, 34.8]) for (const z of [19.7, 27.3]) {
      const post = MeshBuilder.CreateCylinder('ev-base-canopy-post', { height: 4.0, diameter: 0.18, tessellation: 8 }, this.scene);
      post.position.set(x, 2.0, z); post.material = support;
    }
    const canopy = MeshBuilder.CreateBox('ev-base-canopy', { width: 8.2, height: 0.22, depth: 8.0 }, this.scene);
    canopy.position.set(this.vehicleBasePosition.x, 4.05, this.vehicleBasePosition.z);
    canopy.material = this.material('ev-base-canopy-material', new Color3(0.17, 0.25, 0.23));
    const signFrame = MeshBuilder.CreateBox('ev-base-sign-frame', { width: 0.16, height: 0.92, depth: 5.0 }, this.scene);
    signFrame.position.set(26.75, 4.62, this.vehicleBasePosition.z);
    signFrame.material = this.material('ev-base-sign-frame-material', new Color3(0.07, 0.25, 0.18));
    this.vehicleStationSignTexture = new DynamicTexture('ev-base-sign-texture', { width: 1000, height: 180 }, this.scene, false);
    const signContext = this.vehicleStationSignTexture.getContext() as unknown as CanvasRenderingContext2D;
    signContext.fillStyle = '#123F2B'; signContext.fillRect(0, 0, 1000, 180);
    signContext.fillStyle = '#F0F5E8'; signContext.textAlign = 'center'; signContext.font = 'bold 50px Arial';
    signContext.fillText('BASE DE ELETRIFICAÇÃO', 500, 75);
    signContext.fillStyle = '#F6D16A'; signContext.font = 'bold 30px Arial';
    signContext.fillText('AGUARDE 3 PRÉDIOS COM ENERGIA SOLAR', 500, 130);
    this.vehicleStationSignTexture.update();
    const signFace = MeshBuilder.CreatePlane('ev-base-sign-face', { width: 4.8, height: 0.78 }, this.scene);
    signFace.position.set(26.65, 4.62, this.vehicleBasePosition.z); signFace.rotation.y = -Math.PI / 2;
    const signMaterial = this.material('ev-base-sign-face-material', new Color3(1, 1, 1));
    signMaterial.diffuseTexture = this.vehicleStationSignTexture; signMaterial.emissiveColor = new Color3(0.14, 0.19, 0.14);
    signFace.material = signMaterial;
    const charger = MeshBuilder.CreateBox('ev-base-charger', { width: 0.72, height: 1.62, depth: 0.52 }, this.scene);
    charger.position.set(35.2, 0.84, 26.0);
    this.vehicleStationChargerMaterial = this.material('ev-base-charger-material', new Color3(0.35, 0.37, 0.32));
    charger.material = this.vehicleStationChargerMaterial;
    const chargerTexture = new DynamicTexture('ev-base-charger-texture', { width: 256, height: 256 }, this.scene, false);
    const chargerContext = chargerTexture.getContext() as unknown as CanvasRenderingContext2D;
    chargerContext.fillStyle = '#34423B'; chargerContext.fillRect(0, 0, 256, 256);
    chargerContext.fillStyle = '#F3F5E7'; chargerContext.font = 'bold 27px Arial'; chargerContext.textAlign = 'center';
    chargerContext.fillText('AGUARDE', 128, 105);
    chargerContext.fillStyle = '#D9DCCB'; chargerContext.font = 'bold 50px Arial'; chargerContext.fillText('EV', 128, 170);
    chargerTexture.update();
    const chargerFace = MeshBuilder.CreatePlane('ev-base-charger-face', { width: 0.52, height: 0.72 }, this.scene);
    chargerFace.position.set(35.48, 1.02, 26.0); chargerFace.rotation.y = -Math.PI / 2;
    const chargerFaceMaterial = this.material('ev-base-charger-face-material', new Color3(1, 1, 1));
    chargerFaceMaterial.diffuseTexture = chargerTexture; chargerFace.material = chargerFaceMaterial;
    const marker = MeshBuilder.CreateTorus('ev-base-ground-marker', { diameter: 6.9, thickness: 0.13, tessellation: 32 }, this.scene);
    marker.position.set(this.vehicleBasePosition.x, 0.105, this.vehicleBasePosition.z);
    marker.material = this.material('ev-base-ground-marker-material', new Color3(0.93, 0.71, 0.21));
  }

  private activateVehicleStation(): void {
    if (this.vehicleStationActive) return;
    this.vehicleStationActive = true;
    const panelMaterial = this.material('ev-base-solar-panel-material', new Color3(0.05, 0.22, 0.42));
    const gridMaterial = this.material('ev-base-solar-grid-material', new Color3(0.42, 0.70, 0.86));
    for (const x of [28.5, 31.0, 33.5]) for (const z of [21.6, 25.4]) {
      const panel = MeshBuilder.CreateBox('ev-base-solar-canopy-panel', { width: 2.3, height: 0.10, depth: 3.35 }, this.scene);
      panel.position.set(x, 4.22, z); panel.material = panelMaterial;
      for (const offset of [-0.75, 0, 0.75]) {
        const grid = MeshBuilder.CreateBox('ev-base-solar-canopy-grid', { width: 2.2, height: 0.012, depth: 0.025 }, this.scene);
        grid.position.set(x, 4.28, z + offset); grid.material = gridMaterial;
      }
    }
    if (this.vehicleStationChargerMaterial) {
      this.vehicleStationChargerMaterial.diffuseColor = new Color3(0.08, 0.52, 0.48);
      this.vehicleStationChargerMaterial.emissiveColor = new Color3(0.04, 0.18, 0.16);
    }
    if (this.vehicleStationSignTexture) {
      const context = this.vehicleStationSignTexture.getContext() as unknown as CanvasRenderingContext2D;
      context.fillStyle = '#0D583D'; context.fillRect(0, 0, 1000, 180);
      context.fillStyle = '#E4FFCB'; context.textAlign = 'center'; context.font = 'bold 50px Arial';
      context.fillText('ESTAÇÃO SOLAR ATIVA', 500, 75);
      context.fillStyle = '#FFFFFF'; context.font = 'bold 30px Arial';
      context.fillText('ESTACIONE · PARE · DESÇA · CONVERTA', 500, 130);
      this.vehicleStationSignTexture.update();
    }
    const cable = MeshBuilder.CreateTube('ev-base-charger-cable', {
      path: [new Vector3(35.05, 1.42, 25.8), new Vector3(34.5, 1.55, 25.4), new Vector3(33.7, 1.18, 24.8)],
      radius: 0.055, tessellation: 8,
    }, this.scene);
    cable.material = this.material('ev-base-charger-cable-material', new Color3(0.07, 0.10, 0.09));
  }


  /** Lê os GLBs gzipados de um manifesto de texto para manter o download leve. */
  private async loadCompressedAsset(assetName: string): Promise<ArrayBuffer> {
    if (!this.modelManifestPromise) {
      this.modelManifestPromise = fetch('/models/manifest.json', { cache: 'force-cache' })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status} ao carregar o manifesto 3D.`);
          return await response.json() as Record<string, string>;
        })
        .catch((error: unknown) => {
          this.modelManifestPromise = undefined;
          throw error;
        });
    }
    const manifest = await this.modelManifestPromise;
    const encoded = manifest[assetName];
    if (!encoded) throw new Error(`O modelo ${assetName} não está no manifesto 3D.`);
    if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não oferece suporte à descompactação dos modelos 3D.');
    const binary = atob(encoded);
    const compressed = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) compressed[index] = binary.charCodeAt(index);
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).arrayBuffer();
  }

  /**
   * Loads the optimized GREEN CITY GLB asynchronously.
   * The invisible player capsule remains responsible for movement/collisions;
   * the imported visual is a separate scene root so it cannot inherit the collider visibility.
   */
  private async loadPlayerModel(): Promise<void> {
    let objectUrl: string | undefined;
    try {
      await import('@babylonjs/loaders/glTF/2.0');
      const glbBytes = await this.loadCompressedAsset('personagem.glb.gz');
      const fallbackParts = this.player.getChildMeshes();
      objectUrl = URL.createObjectURL(new Blob([glbBytes], { type: 'model/gltf-binary' }));

      const imported = await ImportMeshAsync(objectUrl, this.scene, { pluginExtension: '.glb' });
      const modelRoot = imported.meshes.find((mesh) => mesh.name === '__root__') ?? imported.meshes[0];
      if (!modelRoot) throw new Error('O arquivo GLB não retornou uma malha principal.');

      modelRoot.parent = null;
      modelRoot.position.set(this.player.position.x, this.player.position.y - 1, this.player.position.z);
      modelRoot.rotation.y = this.player.rotation.y;
      modelRoot.scaling.scaleInPlace(0.82);
      modelRoot.isPickable = false;
      this.playerModelRoot = modelRoot;

      this.playerArms.length = 0;
      this.playerLegs.length = 0;
      for (const part of imported.meshes) {
        if (!(part instanceof Mesh) || part === modelRoot) continue;
        part.isPickable = false;
        part.checkCollisions = false;
        if (part.name === 'UpperArm_L' || part.name === 'UpperArm_R') {
          const side = part.name.endsWith('_L') ? -1 : 1;
          part.rotationQuaternion = null;
          part.setPivotPoint(new Vector3(side * 0.33, 1.40, 0));
          this.playerArms.push(part);
        } else if (part.name === 'Trouser_L_Thigh' || part.name === 'Trouser_R_Thigh') {
          const side = part.name.includes('_L_') ? -1 : 1;
          part.rotationQuaternion = null;
          part.setPivotPoint(new Vector3(side * 0.12, 0.94, 0));
          this.playerLegs.push(part);
        }
      }

      // Remove only the temporary procedural visual; keep the collision capsule.
      fallbackParts.forEach((part) => part.dispose(false, false));
      this.message = 'Personagem 3D personalizado carregado.';
      this.emit();
    } catch (error) {
      console.warn('[GREEN CITY] Não foi possível carregar o personagem GLB; mantendo o personagem reserva.', error);
      this.message = 'Personagem reserva ativado; o restante do jogo continua disponível.';
      this.emit();
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }


  /** Importa um GLB compactado em gzip e preserva os materiais PBR embutidos. */
  private async importCompressedModel(assetName: string): Promise<{ root: AbstractMesh; meshes: AbstractMesh[] }> {
    await import('@babylonjs/loaders/glTF/2.0');
    const bytes = await this.loadCompressedAsset(assetName);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
    try {
      const imported = await ImportMeshAsync(url, this.scene, { pluginExtension: '.glb' });
      const root = imported.meshes.find((mesh) => mesh.name === '__root__') ?? imported.meshes[0];
      if (!root) throw new Error(`O GLB ${assetName} não contém uma malha principal.`);
      imported.meshes.forEach((mesh) => {
        mesh.isPickable = false;
        if (mesh instanceof Mesh) mesh.checkCollisions = false;
      });
      return { root, meshes: imported.meshes };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Modelos estáticos e veículos GLB, mantendo os colisores de movimento existentes. */
  private async loadWorldModels(): Promise<void> {
    try {
      const tree = await this.importCompressedModel('arvore.glb.gz');
      tree.root.position.set(-38, 0, 8);
      tree.root.scaling.setAll(0.72);
      this.phaseOneModelRoots.push(tree.root);
      const treeSpots = [[38, 0, -25], [-38, 0, -24], [38, 0, 24], [-38, 0, 30], [14, 0, -39], [-14, 0, -39]];
      treeSpots.forEach(([x, y, z], index) => {
        const clone = tree.root.clone(`green-city-tree-${index}`, null, false);
        if (!clone) return;
        clone.position.set(x, y, z);
        clone.scaling.setAll(index % 2 === 0 ? 0.64 : 0.58);
        this.phaseOneModelRoots.push(clone);
      });
    } catch (error) {
      console.warn('[GREEN CITY] Modelo de árvore não carregado; mantendo a vegetação do cenário.', error);
    }

    try {
      const building = await this.importCompressedModel('edificio.glb.gz');
      building.root.position.set(-34, 0, -31);
      building.root.scaling.setAll(0.58);
      this.phaseOneModelRoots.push(building.root);
    } catch (error) {
      console.warn('[GREEN CITY] Modelo de edifício não carregado; mantendo os edifícios do cenário.', error);
    }

    try {
      const car = await this.importCompressedModel('carro_eletrico.glb.gz');
      this.vehicle.getChildMeshes().forEach((mesh) => mesh.setEnabled(false));
      car.root.parent = null;
      car.root.position.set(this.vehicle.position.x, 0, this.vehicle.position.z);
      car.root.rotation.y = this.vehicle.rotation.y;
      car.root.scaling.setAll(0.90);
      this.vehicleModelRoot = car.root;
      this.phaseOneModelRoots.push(car.root);
    } catch (error) {
      console.warn('[GREEN CITY] Modelo de carro não carregado; mantendo o veículo reserva.', error);
    }

    try {
      const truck = await this.importCompressedModel('caminhao_coleta.glb.gz');
      this.portTruck.getChildMeshes().forEach((mesh) => mesh.setEnabled(false));
      truck.root.parent = null;
      truck.root.position.set(this.portTruck.position.x, 0.04, this.portTruck.position.z);
      truck.root.rotation.y = this.portTruck.rotation.y;
      truck.root.scaling.setAll(0.56);
      this.portTruckModelRoot = truck.root;
      this.portModelRoots.push(truck.root);
    } catch (error) {
      console.warn('[GREEN CITY] Modelo do caminhão não carregado; mantendo o caminhão reserva.', error);
    }

    this.phaseOneModelRoots.forEach((root) => root.setEnabled(this.activePhase === 1));
    this.portModelRoots.forEach((root) => root.setEnabled(this.activePhase === 2));
    this.emit();
  }

  private createPlayer(): Mesh {
    // Collision capsule stays invisible; the rendered character uses smooth, rounded cartoon proportions.
    const root = MeshBuilder.CreateCapsule('player-collider', { height: 1.8, radius: 0.38, tessellation: 20 }, this.scene);
    root.position.set(8.5, 1.0, 23.5);
    root.ellipsoid = new Vector3(0.40, 0.9, 0.40);
    root.ellipsoidOffset = Vector3.Zero();
    root.checkCollisions = true;
    root.visibility = 0;
    root.isPickable = false;

    const jacket = this.material('agent-jacket', new Color3(0.035, 0.42, 0.30));
    const vestMaterial = this.material('agent-safety-vest', new Color3(0.45, 0.82, 0.22));
    const pants = this.material('agent-trousers', new Color3(0.12, 0.23, 0.31));
    const skin = this.material('agent-skin', new Color3(0.76, 0.52, 0.36));
    const helmet = this.material('agent-helmet', new Color3(1.0, 0.72, 0.12));
    const boots = this.material('agent-boots', new Color3(0.07, 0.11, 0.13));
    const gloves = this.material('agent-gloves', new Color3(0.17, 0.23, 0.21));
    const reflective = this.material('agent-reflective-strip', new Color3(1.0, 0.91, 0.43));
    const badgeMaterial = this.material('agent-identification-badge', new Color3(0.95, 0.98, 0.86));
    const eyeWhite = this.material('agent-eye-white', new Color3(1.0, 0.99, 0.93));
    const eyePupil = this.material('agent-eye-pupil', new Color3(0.055, 0.085, 0.075));
    const cheekMaterial = this.material('agent-cheeks', new Color3(0.91, 0.43, 0.35));
    const hairMaterial = this.material('agent-hair', new Color3(0.20, 0.12, 0.09));
    const smileMaterial = this.material('agent-smile', new Color3(0.24, 0.12, 0.10));

    const torso = MeshBuilder.CreateCapsule('agent-torso', { height: 0.94, radius: 0.31, tessellation: 20 }, this.scene);
    torso.parent = root; torso.position.set(0, 0.08, 0); torso.material = jacket;

    const vest = MeshBuilder.CreateCapsule('agent-utility-vest', { height: 0.77, radius: 0.30, tessellation: 18 }, this.scene);
    vest.parent = root; vest.position.set(0, 0.10, 0.16); vest.scaling.z = 0.68; vest.material = vestMaterial;

    const neck = MeshBuilder.CreateCylinder('agent-neck', { height: 0.18, diameter: 0.25, tessellation: 18 }, this.scene);
    neck.parent = root; neck.position.set(0, 0.54, 0); neck.material = skin;

    const head = MeshBuilder.CreateSphere('agent-head', { diameter: 0.58, segments: 24 }, this.scene);
    head.parent = root; head.position.set(0, 0.78, 0.015); head.material = skin;

    // Hair peeks out beneath the safety helmet to make the face more characterful.
    const hair = MeshBuilder.CreateSphere('agent-hair-back', { diameter: 0.57, segments: 20 }, this.scene);
    hair.parent = root; hair.position.set(0, 0.83, -0.055); hair.scaling.set(1.0, 0.78, 0.92); hair.material = hairMaterial;

    for (const side of [-1, 1]) {
      const cheek = MeshBuilder.CreateSphere('agent-cheek', { diameter: 0.12, segments: 16 }, this.scene);
      cheek.parent = root; cheek.position.set(side * 0.17, 0.69, 0.235); cheek.scaling.set(1.15, 0.72, 0.55); cheek.material = cheekMaterial;

      const eye = MeshBuilder.CreateSphere('agent-eye-white', { diameter: 0.115, segments: 18 }, this.scene);
      eye.parent = root; eye.position.set(side * 0.105, 0.82, 0.255); eye.scaling.z = 0.55; eye.material = eyeWhite;
      const pupil = MeshBuilder.CreateSphere('agent-eye-pupil', { diameter: 0.058, segments: 16 }, this.scene);
      pupil.parent = root; pupil.position.set(side * 0.095, 0.815, 0.292); pupil.scaling.z = 0.62; pupil.material = eyePupil;
      const brow = MeshBuilder.CreateCapsule('agent-eyebrow', { height: 0.15, radius: 0.035, tessellation: 12 }, this.scene);
      brow.parent = root; brow.position.set(side * 0.105, 0.91, 0.25); brow.rotation.z = side * -0.28; brow.material = hairMaterial;

      const shoulder = MeshBuilder.CreateSphere('agent-rounded-shoulder', { diameter: 0.34, segments: 18 }, this.scene);
      shoulder.parent = root; shoulder.position.set(side * 0.34, 0.34, 0); shoulder.material = jacket;
    }

    const nose = MeshBuilder.CreateSphere('agent-nose', { diameter: 0.09, segments: 18 }, this.scene);
    nose.parent = root; nose.position.set(0, 0.735, 0.29); nose.scaling.set(0.82, 0.82, 0.72); nose.material = skin;
    const smile = MeshBuilder.CreateTube('agent-smile', {
      path: [new Vector3(-0.075, 0.665, 0.275), new Vector3(-0.035, 0.642, 0.292), new Vector3(0.035, 0.642, 0.292), new Vector3(0.075, 0.665, 0.275)],
      radius: 0.012, tessellation: 10,
    }, this.scene);
    smile.parent = root; smile.material = smileMaterial;

    const helmetCap = MeshBuilder.CreateSphere('agent-safety-helmet', { diameter: 0.62, segments: 24 }, this.scene);
    helmetCap.parent = root; helmetCap.position.set(0, 1.02, 0.0); helmetCap.scaling.set(1.02, 0.42, 0.96); helmetCap.material = helmet;
    const brim = MeshBuilder.CreateCylinder('agent-helmet-brim', { height: 0.075, diameter: 0.70, tessellation: 24 }, this.scene);
    brim.parent = root; brim.position.set(0, 0.96, 0); brim.material = helmet;
    const helmetBadge = MeshBuilder.CreateSphere('agent-helmet-badge', { diameter: 0.16, segments: 16 }, this.scene);
    helmetBadge.parent = root; helmetBadge.position.set(0, 1.01, 0.30); helmetBadge.scaling.set(1.2, 0.75, 0.38); helmetBadge.material = vestMaterial;

    for (const side of [-1, 1]) {
      const arm = MeshBuilder.CreateCapsule('agent-arm', { height: 0.78, radius: 0.15, tessellation: 18 }, this.scene);
      arm.parent = root; arm.position.set(side * 0.38, 0.12, 0); arm.rotation.z = side * -0.12; arm.material = jacket;
      this.playerArms.push(arm);

      const hand = MeshBuilder.CreateSphere('agent-hand', { diameter: 0.21, segments: 18 }, this.scene);
      hand.parent = root; hand.position.set(side * 0.39, -0.27, 0.04); hand.material = gloves;

      const armBand = MeshBuilder.CreateCylinder('agent-sleeve-reflector', { height: 0.12, diameter: 0.31, tessellation: 18 }, this.scene);
      armBand.parent = root; armBand.position.set(side * 0.37, 0.02, 0); armBand.rotation.z = side * -0.12; armBand.material = reflective;

      const leg = MeshBuilder.CreateCapsule('agent-leg', { height: 0.70, radius: 0.15, tessellation: 18 }, this.scene);
      leg.parent = root; leg.position.set(side * 0.15, -0.53, 0); leg.material = pants;
      this.playerLegs.push(leg);

      const kneePad = MeshBuilder.CreateSphere('agent-knee-pad', { diameter: 0.25, segments: 16 }, this.scene);
      kneePad.parent = root; kneePad.position.set(side * 0.15, -0.55, 0.14); kneePad.scaling.set(1.0, 0.70, 0.45); kneePad.material = jacket;

      const boot = MeshBuilder.CreateSphere('agent-boot', { diameter: 0.34, segments: 18 }, this.scene);
      boot.parent = root; boot.position.set(side * 0.15, -0.88, 0.09); boot.scaling.set(0.9, 0.58, 1.25); boot.material = boots;
      const sole = MeshBuilder.CreateCapsule('agent-boot-sole', { height: 0.38, radius: 0.085, tessellation: 16 }, this.scene);
      sole.parent = root; sole.position.set(side * 0.15, -0.98, 0.09); sole.rotation.x = Math.PI / 2; sole.material = gloves;
    }

    const chestStrip = MeshBuilder.CreateCapsule('agent-reflective-strip', { height: 0.49, radius: 0.055, tessellation: 14 }, this.scene);
    chestStrip.parent = root; chestStrip.position.set(0, 0.16, 0.34); chestStrip.rotation.z = Math.PI / 2; chestStrip.material = reflective;
    const idBadge = MeshBuilder.CreateSphere('agent-identification-badge', { diameter: 0.24, segments: 18 }, this.scene);
    idBadge.parent = root; idBadge.position.set(0.18, 0.31, 0.34); idBadge.scaling.set(0.9, 0.9, 0.36); idBadge.material = badgeMaterial;
    const badgeMark = MeshBuilder.CreateSphere('agent-identification-mark', { diameter: 0.09, segments: 14 }, this.scene);
    badgeMark.parent = root; badgeMark.position.set(0.18, 0.31, 0.39); badgeMark.scaling.z = 0.3; badgeMark.material = vestMaterial;

    const backpack = MeshBuilder.CreateSphere('agent-field-backpack', { diameter: 0.55, segments: 18 }, this.scene);
    backpack.parent = root; backpack.position.set(0, 0.12, -0.28); backpack.scaling.set(0.78, 0.90, 0.48);
    backpack.material = this.material('agent-backpack', new Color3(0.12, 0.28, 0.26));
    const backpackPocket = MeshBuilder.CreateSphere('agent-backpack-pocket', { diameter: 0.28, segments: 16 }, this.scene);
    backpackPocket.parent = root; backpackPocket.position.set(0, 0.02, -0.43); backpackPocket.scaling.set(0.86, 0.72, 0.50); backpackPocket.material = jacket;
    const utilityBelt = MeshBuilder.CreateCylinder('agent-utility-belt', { height: 0.13, diameter: 0.68, tessellation: 20 }, this.scene);
    utilityBelt.parent = root; utilityBelt.position.set(0, -0.22, 0); utilityBelt.scaling.y = 0.45;
    utilityBelt.material = this.material('agent-utility-belt-material', new Color3(0.12, 0.16, 0.14));

    const radio = MeshBuilder.CreateSphere('agent-radio', { diameter: 0.25, segments: 16 }, this.scene);
    radio.parent = root; radio.position.set(-0.38, 0.25, -0.02); radio.scaling.set(0.58, 1.0, 0.72);
    radio.material = this.material('agent-radio-material', new Color3(0.12, 0.17, 0.19));
    const antenna = MeshBuilder.CreateCylinder('agent-radio-antenna', { height: 0.22, diameter: 0.03, tessellation: 12 }, this.scene);
    antenna.parent = root; antenna.position.set(-0.40, 0.46, -0.02); antenna.material = reflective;
    return root;
  }

  private buildTrash(): void {
    const paperMat = this.material('waste-paper', new Color3(0.71, 0.67, 0.52));
    const plasticMat = this.material('waste-plastic', new Color3(0.20, 0.54, 0.68));
    const metalMat = this.material('waste-metal', new Color3(0.72, 0.49, 0.23));
    const glassMat = this.material('waste-glass', new Color3(0.29, 0.63, 0.53));
    const organicMat = this.material('waste-organic', new Color3(0.48, 0.36, 0.21));
    const positions = [[-4, 17], [4, 8], [-5, -4], [5, -18], [-3, -30]];
    const makers = [
      () => MeshBuilder.CreateBox('waste-paper-cardboard', { width: 0.62, height: 0.12, depth: 0.48 }, this.scene),
      () => MeshBuilder.CreateCylinder('waste-plastic-bottle', { height: 0.66, diameter: 0.34, tessellation: 8 }, this.scene),
      () => MeshBuilder.CreateCylinder('waste-metal-can', { height: 0.52, diameter: 0.38, tessellation: 10 }, this.scene),
      () => MeshBuilder.CreateCylinder('waste-glass-container', { height: 0.58, diameter: 0.38, tessellation: 8 }, this.scene),
      () => MeshBuilder.CreateSphere('waste-organic', { diameter: 0.46, segments: 7 }, this.scene),
    ];
    const materials = [paperMat, plasticMat, metalMat, glassMat, organicMat];
    positions.forEach(([x, z], index) => {
      const item = makers[index]();
      item.position.set(x, index === 0 ? 0.16 : 0.34, z);
      item.material = materials[index];
      if (index === 1 || index === 3) item.rotation.z = 0.18;
      this.trash.push(item);
    });
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    canvas.addEventListener('pointerdown', this.focusCanvas);
    window.addEventListener('blur', this.clearKeys);
  }

  private readonly keyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'shift', ' ', 'm'].includes(key)) event.preventDefault();
    this.keys.add(key);
    if (key === 'e' && !event.repeat && (!this.inVehicle || this.activePhase === 2)) this.interact();
    if (key === 'f' && !event.repeat && !this.mapOpen && !this.paused) this.toggleVehicle();
    if (key === 'm' && !event.repeat && !this.paused) this.setMapOpen(!this.mapOpen);
    if (key === 'escape' && !event.repeat) {
      if (this.mapOpen) this.setMapOpen(false);
      else this.setPaused(!this.paused);
    }
  };
  private readonly keyUp = (event: KeyboardEvent) => this.keys.delete(event.key.toLowerCase());

  private syncVehicleModel(root: AbstractMesh | undefined, collider: Mesh, groundOffset: number): void {
    if (!root) return;
    root.position.set(collider.position.x, collider.position.y - groundOffset, collider.position.z);
    root.rotation.y = collider.rotation.y;
  }

  private update(dt: number): void {
    const step = Math.min(dt, 0.05);
    let playerMoving = false;
    if (this.inVehicle) {
      const activeVehicle = this.activeVehicle;
      const accelerateInput = Math.max(this.keys.has('w') ? 1 : 0, Math.max(0, -this.mobileMoveY));
      const brakeInput = Math.max(this.keys.has('s') ? 1 : 0, Math.max(0, this.mobileMoveY));
      const maximumSpeed = this.activePhase === 2 ? 10 : 15;
      if (accelerateInput > 0.08) this.vehicleSpeed = Math.min(maximumSpeed, this.vehicleSpeed + 8.5 * accelerateInput * step);
      else if (brakeInput > 0.08) this.vehicleSpeed = this.vehicleSpeed > 0
        ? Math.max(0, this.vehicleSpeed - 18 * brakeInput * step)
        : Math.min(0, this.vehicleSpeed + 18 * brakeInput * step);
      else this.vehicleSpeed *= Math.max(0, 1 - 2.2 * step);
      const steering = Math.max(-1, Math.min(1,
        (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0) + this.mobileMoveX,
      ));
      if (Math.abs(this.vehicleSpeed) > 0.25) {
        activeVehicle.rotation.y += steering * 1.45 * step * Math.sign(this.vehicleSpeed);
        const direction = new Vector3(Math.sin(activeVehicle.rotation.y), 0, Math.cos(activeVehicle.rotation.y));
        activeVehicle.moveWithCollisions(direction.scale(this.vehicleSpeed * step));
      }
      this.player.position.copyFrom(activeVehicle.position).addInPlace(new Vector3(0, 0.2, 0));
    } else {
      const forward = this.camera.target.subtract(this.camera.position);
      forward.y = 0;
      forward.normalize();
      const right = Vector3.Cross(Vector3.Up(), forward).normalize();
      const forwardInput = (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0) - this.mobileMoveY;
      const strafeInput = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0) + this.mobileMoveX;
      const move = forward.scale(forwardInput).addInPlace(right.scale(strafeInput));
      const moveLength = move.length();
      if (moveLength > 0.08) {
        if (moveLength > 1) move.normalize();
        const speed = this.keys.has('shift') ? 8.2 : 5.0;
        this.player.moveWithCollisions(move.scale(speed * step));
        this.player.rotation.y = Math.atan2(move.x, move.z);
        playerMoving = true;
      }
      if (this.keys.has(' ') && this.onGround) {
        this.velocityY = 7.2;
        this.onGround = false;
      }
      this.velocityY -= 19 * step;
      this.player.moveWithCollisions(new Vector3(0, this.velocityY * step, 0));
      if (this.player.position.y <= 1) {
        this.player.position.y = 1;
        this.velocityY = 0;
        this.onGround = true;
      }
    }
    if (this.playerModelRoot) {
      this.playerModelRoot.position.set(this.player.position.x, this.player.position.y - 1, this.player.position.z);
      this.playerModelRoot.rotation.y = this.player.rotation.y;
    }
    this.syncVehicleModel(this.vehicleModelRoot, this.vehicle, 0.48);
    this.syncVehicleModel(this.portTruckModelRoot, this.portTruck, 0.48);
    this.characterAnimationTime += step * (playerMoving ? 10.5 : 1.8);
    const gait = playerMoving ? 0.58 : 0.035;
    this.playerArms.forEach((arm, index) => {
      arm.rotation.x = Math.sin(this.characterAnimationTime + index * Math.PI) * gait;
    });
    this.playerLegs.forEach((leg, index) => {
      leg.rotation.x = -Math.sin(this.characterAnimationTime + index * Math.PI) * gait * 0.9;
    });

    const focus = this.inVehicle
      ? this.activeVehicle.position.add(new Vector3(0, 1.15, 0))
      : this.player.position.add(new Vector3(0, 0.8, 0));
    this.camera.target = Vector3.Lerp(this.camera.target, focus, 0.18);
    const now = performance.now();
    if (now - this.lastSnapshotAt >= 100) {
      this.lastSnapshotAt = now;
      this.emit();
    }
  }

  private createVehicle(): Mesh {
    const startBay = MeshBuilder.CreateGround('municipal-start-parking-bay', { width: 7.5, height: 4.7 }, this.scene);
    startBay.position.set(5.1, 0.025, 23.5);
    startBay.material = this.material('municipal-start-parking-bay-material', new Color3(0.25, 0.31, 0.29));
    const bayLines = this.material('municipal-start-parking-lines', new Color3(0.93, 0.88, 0.67));
    for (const z of [21.2, 25.8]) {
      const line = MeshBuilder.CreateBox('municipal-start-parking-line', { width: 7.1, height: 0.035, depth: 0.12 }, this.scene);
      line.position.set(5.1, 0.06, z);
      line.material = bayLines;
    }
    for (const x of [1.55, 8.65]) {
      const line = MeshBuilder.CreateBox('municipal-start-parking-side-line', { width: 0.12, height: 0.035, depth: 4.6 }, this.scene);
      line.position.set(x, 0.06, 23.5);
      line.material = bayLines;
    }
    const car = MeshBuilder.CreateBox('municipal-service-vehicle-collider', { width: 2.1, height: 0.72, depth: 3.8 }, this.scene);
    car.position.set(5.1, 0.48, 23.5);
    car.rotation.y = Math.PI / 2;
    car.checkCollisions = true;
    car.visibility = 0;
    this.vehicleMaterial = this.material('vehicle-body', new Color3(0.18, 0.48, 0.36));
    const roundedHull = MeshBuilder.CreateSphere('municipal-service-vehicle-rounded-hull', { diameter: 1, segments: 28 }, this.scene);
    roundedHull.parent = car; roundedHull.position.set(0, 0.02, 0); roundedHull.scaling.set(1.08, 0.40, 1.96);
    roundedHull.material = this.vehicleMaterial;

    const cabin = MeshBuilder.CreateSphere('vehicle-cabin-shell', { diameter: 1, segments: 24 }, this.scene);
    cabin.parent = car; cabin.position.set(0, 0.68, -0.15); cabin.scaling.set(0.86, 0.60, 0.94);
    cabin.material = this.material('vehicle-cabin-frame', new Color3(0.88, 0.77, 0.47));
    const glass = this.material('vehicle-glass', new Color3(0.10, 0.24, 0.30));
    const windshield = MeshBuilder.CreatePlane('vehicle-windshield', { width: 1.42, height: 0.54 }, this.scene);
    windshield.parent = car; windshield.position.set(0, 0.84, 0.78); windshield.material = glass;
    const rearGlass = MeshBuilder.CreatePlane('vehicle-rear-window', { width: 1.38, height: 0.48 }, this.scene);
    rearGlass.parent = car; rearGlass.position.set(0, 0.84, -1.08); rearGlass.rotation.y = Math.PI; rearGlass.material = glass;
    for (const side of [-1, 1]) {
      const sideGlass = MeshBuilder.CreatePlane('vehicle-side-window', { width: 1.35, height: 0.48 }, this.scene);
      sideGlass.parent = car; sideGlass.position.set(side * 0.87, 0.84, -0.15);
      sideGlass.rotation.y = side * Math.PI / 2; sideGlass.material = glass;
      const mirror = MeshBuilder.CreateSphere('vehicle-side-mirror', { diameter: 0.24, segments: 18 }, this.scene);
      mirror.parent = car; mirror.position.set(side * 1.03, 0.58, 0.52);
      mirror.scaling.set(0.55, 0.8, 1.15);
      mirror.material = this.material('vehicle-mirror-material', new Color3(0.13, 0.17, 0.16));
    }
    const roofCap = MeshBuilder.CreateSphere('vehicle-rounded-roof', { diameter: 1.7, segments: 24 }, this.scene);
    roofCap.parent = car; roofCap.position.set(0, 1.04, -0.15); roofCap.scaling.set(0.92, 0.24, 0.88);
    roofCap.material = this.material('vehicle-roof-material', new Color3(0.23, 0.30, 0.28));
    const hood = MeshBuilder.CreateSphere('vehicle-rounded-hood', { diameter: 1.8, segments: 24 }, this.scene);
    hood.parent = car; hood.position.set(0, 0.22, 1.12); hood.scaling.set(0.92, 0.28, 0.70); hood.material = this.vehicleMaterial;
    const wheelMat = this.material('vehicle-tires', new Color3(0.045, 0.05, 0.05));
    const hubMat = this.material('vehicle-wheel-hubs', new Color3(0.62, 0.67, 0.63));
    const tailLightMat = this.material('vehicle-tail-light-material', new Color3(0.75, 0.14, 0.10));
    for (const side of [-1, 1]) {
      const tailLight = MeshBuilder.CreateSphere('vehicle-tail-light', { diameter: 0.26, segments: 18 }, this.scene);
      tailLight.parent = car; tailLight.position.set(side * 0.78, 0.12, -1.90);
      tailLight.scaling.set(0.55, 0.75, 0.35); tailLight.material = tailLightMat;
    }
    const grille = MeshBuilder.CreateBox('vehicle-front-grille', { width: 0.9, height: 0.25, depth: 0.06 }, this.scene);
    grille.parent = car;
    grille.position.set(0, -0.08, 1.93);
    grille.material = this.material('vehicle-grille-material', new Color3(0.09, 0.13, 0.13));
    const bumper = MeshBuilder.CreateBox('vehicle-front-bumper', { width: 2.0, height: 0.16, depth: 0.16 }, this.scene);
    bumper.parent = car;
    bumper.position.set(0, -0.31, 1.91);
    bumper.material = this.material('vehicle-bumper-material', new Color3(0.23, 0.26, 0.25));
    const headlightMaterial = this.material('vehicle-headlight-material', new Color3(0.92, 0.84, 0.56));
    for (const side of [-1, 1]) {
      const headlight = MeshBuilder.CreateBox('vehicle-headlight', { width: 0.38, height: 0.18, depth: 0.07 }, this.scene);
      headlight.parent = car;
      headlight.position.set(side * 0.72, 0.08, 1.94);
      headlight.material = headlightMaterial;
    }
    for (const x of [-1.08, 1.08]) for (const z of [-1.25, 1.25]) {
      const wheel = MeshBuilder.CreateCylinder('vehicle-wheel', { diameter: 0.72, height: 0.22, tessellation: 20 }, this.scene);
      wheel.parent = car;
      wheel.position.set(x, -0.12, z);
      wheel.rotation.z = Math.PI / 2; wheel.material = wheelMat;
      const hub = MeshBuilder.CreateCylinder('vehicle-wheel-hub', { diameter: 0.34, height: 0.24, tessellation: 20 }, this.scene);
      hub.parent = car; hub.position.set(x * 1.02, -0.12, z);
      hub.rotation.z = Math.PI / 2; hub.material = hubMat;
    }
    return car;
  }

  private toggleVehicle(): void {
    const activeVehicle = this.activeVehicle;
    if (this.inVehicle) {
      if (Math.abs(this.vehicleSpeed) > 0.45) {
        this.message = this.activePhase === 2
          ? 'Pare completamente o caminhão antes de descer.'
          : 'Freie completamente dentro da vaga antes de descer do veículo.';
        this.emit(); return;
      }
      const atBase = this.activePhase === 1
        && Math.hypot(activeVehicle.position.x - this.vehicleBasePosition.x, activeVehicle.position.z - this.vehicleBasePosition.z) <= 4.2;
      this.inVehicle = false; this.vehicleSpeed = 0;
      this.player.position.copyFrom(activeVehicle.position).addInPlace(new Vector3(2.8, 0.55, 0));
      this.player.setEnabled(true);
      this.message = this.activePhase === 2
        ? 'Você desceu do caminhão. Entre novamente com F para dirigir até o próximo ponto de coleta.'
        : atBase
          ? 'Veículo estacionado na base. Desça e aproxime-se do carro; pressione E para iniciar a conversão elétrica.'
          : 'Você saiu do veículo. Para converter, dirija até a BASE DE ELETRIFICAÇÃO, pare na vaga marcada e desça com F.';
    } else {
      const dx = this.player.position.x - activeVehicle.position.x;
      const dz = this.player.position.z - activeVehicle.position.z;
      if (Math.hypot(dx, dz) > 6.5) {
        this.message = this.activePhase === 2
          ? 'Aproxime-se do caminhão de coleta e pressione F para entrar.'
          : 'Aproxime-se do veículo municipal e pressione F quando aparecer o aviso para entrar.';
        this.emit(); return;
      }
      this.inVehicle = true; this.player.setEnabled(false);
      this.message = this.activePhase === 2
        ? 'Dirija o caminhão amarelo até os três pontos das empresas. W acelera, S freia, A/D viram. Pare para carregar cada ponto.'
        : this.electricVehicle
          ? 'Veículo 100% elétrico. W acelera, S freia, A/D viram. Pare antes de sair.'
          : 'Missão: dirija até a BASE DE ELETRIFICAÇÃO. Siga pela via de serviço à direita, pare na vaga e pressione F para descer.';
    }
    this.keys.clear(); this.emit();
  }

  private readonly focusCanvas = () => this.scene.getEngine().getRenderingCanvas()?.focus();
  private readonly clearKeys = () => { this.keys.clear(); this.mobileMoveX = 0; this.mobileMoveY = 0; };


  private findNearbySolarBuilding(): SolarBuildingRecord | null {
    if (!this.delivered) return null;
    let nearest: SolarBuildingRecord | null = null;
    let nearestDistance = 5.2;
    for (const building of this.buildings) {
      if (building.solarInstalled) continue;
      const side = building.x < 0 ? 1 : -1;
      const facadeX = building.x + side * (building.width / 2 + 0.08);
      const distance = Math.hypot(this.player.position.x - facadeX, this.player.position.z - building.z);
      if (distance < nearestDistance) { nearest = building; nearestDistance = distance; }
    }
    return nearest;
  }

  private createBuildingSolarPanels(building: SolarBuildingRecord, index: number): void {
    const panelMaterial = this.material(`building-solar-panel-material-${index}`, new Color3(0.05, 0.22, 0.43));
    const gridMaterial = this.material(`building-solar-panel-grid-material-${index}`, new Color3(0.43, 0.70, 0.85));
    for (const dx of [-building.width * 0.22, building.width * 0.22]) {
      for (const dz of [-2.0, 2.0]) {
        const panel = MeshBuilder.CreateBox('building-rooftop-solar-panel', { width: 2.35, height: 0.11, depth: 2.65 }, this.scene);
        panel.position.set(building.x + dx, building.height + 0.43, building.z + dz); panel.material = panelMaterial;
        for (const offset of [-0.68, 0, 0.68]) {
          const grid = MeshBuilder.CreateBox('building-solar-panel-grid-line', { width: 2.26, height: 0.012, depth: 0.025 }, this.scene);
          grid.position.set(building.x + dx, building.height + 0.495, building.z + dz + offset); grid.material = gridMaterial;
        }
      }
    }
    const side = building.x < 0 ? 1 : -1;
    const facadeX = building.x + side * (building.width / 2 + 0.16);
    const badge = MeshBuilder.CreateBox('building-solar-status-badge', { width: 0.16, height: 0.46, depth: 1.8 }, this.scene);
    badge.position.set(facadeX, 3.0, building.z + 1.15);
    badge.material = this.material(`building-solar-status-badge-material-${index}`, new Color3(0.12, 0.60, 0.37));
    const texture = new DynamicTexture(`building-solar-sign-texture-${index}`, { width: 400, height: 120 }, this.scene, false);
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    context.fillStyle = '#0D583D'; context.fillRect(0, 0, 400, 120);
    context.fillStyle = '#F0FFD9'; context.font = 'bold 44px Arial'; context.textAlign = 'center';
    context.fillText('ENERGIA SOLAR', 200, 78); texture.update();
    const face = MeshBuilder.CreatePlane('building-solar-status-face', { width: 1.7, height: 0.4 }, this.scene);
    face.position.set(facadeX + side * 0.1, 3.0, building.z + 1.15); face.rotation.y = side * Math.PI / 2;
    const faceMaterial = this.material(`building-solar-status-face-material-${index}`, new Color3(1, 1, 1));
    faceMaterial.diffuseTexture = texture; faceMaterial.emissiveColor = new Color3(0.12, 0.18, 0.13);
    face.material = faceMaterial;
  }

  private refreshMissionStage(): void {
    if (!this.delivered) { this.missionStage = this.collected >= TOTAL_TRASH ? 'deliver' : 'collect'; return; }
    if (this.electricVehicle && this.solarBuildingsInstalled >= TOTAL_SOLAR_BUILDINGS) this.missionStage = 'complete';
    else if (!this.electricVehicle && this.solarBuildingsInstalled >= SOLAR_BUILDINGS_REQUIRED_FOR_EV) this.missionStage = 'vehicle';
    else this.missionStage = 'solar';
  }

  private installNearbyBuildingSolar(): void {
    const building = this.findNearbySolarBuilding();
    if (!building) { this.message = 'Aproxime-se da fachada de um prédio que ainda não recebeu painéis solares.'; this.emit(); return; }
    if (this.cit < SOLAR_BUILDING_COST) {
      this.message = `CIT insuficiente. Instalar painéis neste prédio custa ${SOLAR_BUILDING_COST} CIT.`; this.emit(); return;
    }
    const index = this.buildings.indexOf(building);
    this.cit -= SOLAR_BUILDING_COST; building.solarInstalled = true; this.solarBuildingsInstalled += 1;
    this.renewableShare = Math.min(100, 5 + this.solarBuildingsInstalled * 9);
    this.airQuality = Math.min(100, this.airQuality + 1);
    this.createBuildingSolarPanels(building, index);
    if (this.solarBuildingsInstalled >= SOLAR_BUILDINGS_REQUIRED_FOR_EV) this.activateVehicleStation();
    this.refreshMissionStage();
    this.message = this.solarBuildingsInstalled === SOLAR_BUILDINGS_REQUIRED_FOR_EV
      ? `${building.label} recebeu energia solar! Três prédios já foram modernizados. A BASE DE ELETRIFICAÇÃO está ativa: entre no carro, dirija pela via de serviço, estacione na vaga marcada, desça e pressione E ao lado do veículo.`
      : `${building.label} agora tem painéis solares (${this.solarBuildingsInstalled}/${TOTAL_SOLAR_BUILDINGS}). Continue visitando os prédios sem identificação solar. Custo por instalação: ${SOLAR_BUILDING_COST} CIT.`;
    this.emit();
  }

  private isVehicleInsideBase(): boolean {
    return Math.hypot(this.vehicle.position.x - this.vehicleBasePosition.x, this.vehicle.position.z - this.vehicleBasePosition.z) <= 4.0;
  }

  private isVehicleParkedAtBase(): boolean {
    return this.isVehicleInsideBase() && Math.abs(this.vehicleSpeed) <= 0.45;
  }

  private convertVehicleAtBase(): void {
    if (this.electricVehicle) { this.message = 'O veículo municipal já está convertido para elétrico.'; this.emit(); return; }
    if (!this.vehicleStationActive || this.solarBuildingsInstalled < SOLAR_BUILDINGS_REQUIRED_FOR_EV) {
      this.message = `Modernize ${SOLAR_BUILDINGS_REQUIRED_FOR_EV} prédios com energia solar para ativar a base de eletrificação.`; this.emit(); return;
    }
    if (this.inVehicle || !this.isVehicleParkedAtBase()) {
      this.message = 'Para converter: estacione totalmente dentro da vaga da base e desça do veículo.'; this.emit(); return;
    }
    const playerDistance = Math.hypot(this.player.position.x - this.vehicle.position.x, this.player.position.z - this.vehicle.position.z);
    if (playerDistance > 5.2) { this.message = 'Aproxime-se do carro estacionado na base para realizar a conversão.'; this.emit(); return; }
    if (this.cit < ELECTRIC_VEHICLE_COST) {
      this.message = `CIT insuficiente. A conversão elétrica custa ${ELECTRIC_VEHICLE_COST} CIT.`; this.emit(); return;
    }

    this.cit -= ELECTRIC_VEHICLE_COST; this.electricVehicle = true;
    this.vehicleMaterial.diffuseColor = new Color3(0.08, 0.52, 0.34);
    const badgeTexture = new DynamicTexture('municipal-ev-badge-texture', { width: 512, height: 192 }, this.scene, false);
    const badgeContext = badgeTexture.getContext() as unknown as CanvasRenderingContext2D;
    badgeContext.fillStyle = '#063F31'; badgeContext.fillRect(0, 0, 512, 192);
    badgeContext.fillStyle = '#DFFFF0'; badgeContext.font = 'bold 92px Arial'; badgeContext.textAlign = 'center';
    badgeContext.fillText('100% EV', 256, 122); badgeTexture.update();
    const badgeMaterial = this.material('municipal-ev-badge-material', new Color3(1, 1, 1));
    badgeMaterial.diffuseTexture = badgeTexture; badgeMaterial.emissiveColor = new Color3(0.08, 0.18, 0.12);
    for (const side of [-1, 1]) {
      const badge = MeshBuilder.CreatePlane('municipal-ev-side-badge', { width: 1.05, height: 0.42 }, this.scene);
      badge.parent = this.vehicle; badge.position.set(side * 1.07, 0.37, 0.25);
      badge.rotation.y = side * Math.PI / 2; badge.material = badgeMaterial;
      const sill = MeshBuilder.CreateBox('municipal-ev-green-sill', { width: 0.07, height: 0.14, depth: 2.5 }, this.scene);
      sill.parent = this.vehicle; sill.position.set(side * 1.06, -0.25, 0);
      sill.material = this.material('municipal-ev-green-sill-material', new Color3(0.10, 0.68, 0.48));
    }
    const frontMark = MeshBuilder.CreateBox('municipal-ev-front-mark', { width: 0.48, height: 0.22, depth: 0.07 }, this.scene);
    frontMark.parent = this.vehicle; frontMark.position.set(0, 0.20, 1.96);
    frontMark.material = this.material('municipal-ev-front-mark-material', new Color3(0.12, 0.75, 0.55));
    this.sustainableMobility = 43; this.airQuality = Math.min(100, this.airQuality + 15);
    this.refreshMissionStage();
    this.message = this.missionStage === 'complete'
      ? 'Oito prédios solarizados e veículo convertido! Centro Industrial recuperado; Porto liberado.'
      : `Veículo convertido para 100% elétrico! Continue instalando energia solar nos prédios restantes (${this.solarBuildingsInstalled}/${TOTAL_SOLAR_BUILDINGS}).`;
    this.emit();
  }

  private interact(): void {
    const now = performance.now();
    if (now - this.lastInteract < 180) return;
    this.lastInteract = now;
    if (this.activePhase === 2) {
      const nearby = this.getNearbyInteraction();
      if (!nearby) {
        this.message = 'Aproxime-se de um ponto de inspeção, da estação de tratamento, de uma fossa ou entre no caminhão.';
        this.emit();
        return;
      }
      this.performPortAction(nearby.action);
      return;
    }
    if (this.missionStage === 'deliver') {
      const distance = Math.hypot(this.player.position.x - this.ecoCenterPosition.x, this.player.position.z - this.ecoCenterPosition.z);
      if (distance <= 8.5) this.deliverWaste();
      else { this.message = 'Siga a sinalização verde até o ECOCENTRO e aproxime-se do ponto de entrega.'; this.emit(); }
      return;
    }
    if (this.delivered) {
      const nearby = this.getNearbyInteraction();
      if (nearby?.action === 'install-building-solar') { this.installNearbyBuildingSolar(); return; }
      if (nearby?.action === 'convert-vehicle') { this.convertVehicleAtBase(); return; }
      if (this.solarBuildingsInstalled < SOLAR_BUILDINGS_REQUIRED_FOR_EV) {
        this.message = 'Aproxime-se da fachada de um prédio sem painéis solares e pressione E para iniciar a instalação.';
      } else if (!this.electricVehicle) {
        this.message = 'Entre no carro, dirija até a BASE DE ELETRIFICAÇÃO, pare dentro da vaga e desça para converter o veículo.';
      } else {
        this.message = `Missão final: instale painéis solares nos prédios restantes (${this.solarBuildingsInstalled}/${TOTAL_SOLAR_BUILDINGS}).`;
      }
      this.emit(); return;
    }
    let nearest: Mesh | undefined;
    let nearestDistance = 3.3;
    for (const item of this.trash) {
      if (!item.isEnabled()) continue;
      const distance = Vector3.Distance(this.player.position, item.position);
      if (distance < nearestDistance) { nearest = item; nearestDistance = distance; }
    }
    if (!nearest) { this.message = 'Aproxime-se de um resíduo para recolhê-lo.'; this.emit(); return; }
    nearest.setEnabled(false); this.collected += 1;
    if (this.collected === TOTAL_TRASH) {
      this.missionStage = 'deliver';
      this.message = 'Coleta concluída! Leve a carga ao ECOCENTRO. Depois visite os prédios para instalar energia solar.';
    } else this.message = `Resíduo recolhido (${this.collected}/${TOTAL_TRASH}). Continue a coleta.`;
    this.emit();
  }

  private deliverWaste(): void {
    if (this.delivered || this.collected < TOTAL_TRASH) return;
    this.delivered = true; this.cit += 100; this.recyclingRate = 63;
    this.refreshMissionStage();
    this.message = 'Resíduos entregues! +100 CIT. Percorra as fachadas e instale painéis em cada prédio (10 CIT por instalação). Após três prédios, a base do veículo será ativada.';
    this.emit();
  }

  private isNextNeighborhoodUnlocked(): boolean {
    return this.solarBuildingsInstalled >= TOTAL_SOLAR_BUILDINGS && this.electricVehicle
      && this.recyclingRate >= 60 && this.renewableShare >= 30 && this.sustainableMobility >= 30;
  }

  /** Vetor analógico do direcional; mantém a intensidade do arraste do dedo. */
  setMobileMovement(horizontal: number, vertical: number): void {
    this.mobileMoveX = Math.max(-1, Math.min(1, horizontal));
    this.mobileMoveY = Math.max(-1, Math.min(1, vertical));
  }

  setMobileJump(pressed: boolean): void {
    if (pressed && !this.paused && !this.mapOpen) this.keys.add(' ');
    else this.keys.delete(' ');
  }

  setPaused(value: boolean): void {
    this.paused = value;
    if (value) this.mapOpen = false;
    this.keys.clear(); this.mobileMoveX = 0; this.mobileMoveY = 0;
    this.message = value ? 'Jogo pausado.' : 'De volta à cidade. Continue o plano de recuperação!';
    this.emit();
  }

  setMapOpen(value: boolean): void {
    if (this.paused) return;
    this.mapOpen = value;
    this.keys.clear(); this.mobileMoveX = 0; this.mobileMoveY = 0;
    this.message = value ? 'Mapa geral da cidade aberto.' : 'Mapa fechado. Continue a transformação do bairro.';
    this.emit();
  }

  private getNearbyInteraction(): { action: NearbyAction; label: string } | null {
    if (this.paused || this.mapOpen) return null;
    if (this.activePhase === 2) return this.getNearbyPortInteraction();
    if (this.inVehicle) {
      const atBase = this.isVehicleInsideBase();
      const moving = Math.abs(this.vehicleSpeed) > 0.45;
      if (atBase && moving) return { action: 'exit-vehicle', label: 'PARE COMPLETAMENTE NA VAGA' };
      return { action: 'exit-vehicle', label: atBase ? 'F · DESCER NA BASE DE ELETRIFICAÇÃO' : 'F · SAIR DO VEÍCULO' };
    }
    if (this.missionStage === 'deliver') {
      const distanceToEco = Math.hypot(this.player.position.x - this.ecoCenterPosition.x, this.player.position.z - this.ecoCenterPosition.z);
      if (distanceToEco <= 8.5) return { action: 'deliver-waste', label: 'E · ENTREGAR RESÍDUOS NO ECOCENTRO' };
    }
    if (this.delivered) {
      const building = this.findNearbySolarBuilding();
      if (building) return { action: 'install-building-solar', label: `E · INSTALAR SOLAR EM ${building.label} · 10 CIT` };
      if (!this.electricVehicle && this.vehicleStationActive && this.isVehicleParkedAtBase()) {
        const distanceToCar = Math.hypot(this.player.position.x - this.vehicle.position.x, this.player.position.z - this.vehicle.position.z);
        if (distanceToCar <= 5.2) return { action: 'convert-vehicle', label: 'E · CONVERTER ESTE CARRO PARA ELÉTRICO' };
      }
    }
    if (this.missionStage === 'collect') {
      let closestWaste = Number.POSITIVE_INFINITY;
      for (const item of this.trash) {
        if (!item.isEnabled()) continue;
        const distance = Math.hypot(this.player.position.x - item.position.x, this.player.position.z - item.position.z);
        closestWaste = Math.min(closestWaste, distance);
      }
      if (closestWaste <= 3.3) return { action: 'collect-waste', label: 'E · RECOLHER RESÍDUO' };
    }
    const vehicleDistance = Math.hypot(this.player.position.x - this.vehicle.position.x, this.player.position.z - this.vehicle.position.z);
    if (vehicleDistance <= 6.5) return { action: 'enter-vehicle', label: 'F · ENTRAR NO VEÍCULO' };
    return null;
  }

  performNearbyAction(): void {
    const nearby = this.getNearbyInteraction();
    if (!nearby) {
      this.message = this.activePhase === 2
        ? 'Aproxime-se do objetivo indicado na missão para interagir.'
        : 'Aproxime-se de um resíduo, de um prédio sem painéis ou da base do veículo para interagir.';
      this.emit();
      return;
    }
    if (this.activePhase === 2) { this.performPortAction(nearby.action); return; }
    if (nearby.action === 'enter-vehicle' || nearby.action === 'exit-vehicle') { this.toggleVehicle(); return; }
    if (nearby.action === 'install-building-solar') { this.installNearbyBuildingSolar(); return; }
    if (nearby.action === 'convert-vehicle') { this.convertVehicleAtBase(); return; }
    this.interact();
  }

  getSnapshot(): GameSnapshot {
    const nearby = this.getNearbyInteraction();
    return {
      cit: this.cit,
      collected: this.collected,
      total: TOTAL_TRASH,
      delivered: this.delivered,
      solarBuildingsInstalled: this.solarBuildingsInstalled,
      solarBuildingsTotal: TOTAL_SOLAR_BUILDINGS,
      electricVehicle: this.electricVehicle,
      recyclingRate: this.recyclingRate,
      renewableShare: this.renewableShare,
      sustainableMobility: this.sustainableMobility,
      airQuality: this.airQuality,
      phase: this.activePhase,
      completedNeighborhoods: this.activePhase === 2
        ? (this.portMissionStage === 'complete' ? 2 : 1)
        : (this.missionStage === 'complete' ? 1 : 0),
      thirdNeighborhoodUnlocked: this.activePhase === 2 && this.portMissionStage === 'complete',
      portMissionStage: this.portMissionStage,
      outfallsInspected: this.portOutfallsInspected,
      outfallsTotal: this.portOutfallPositions.length,
      treatmentInstalled: this.portTreatmentInstalled,
      septicInstalled: this.portSepticInstalled.filter(Boolean).length,
      septicTotal: this.portSepticPositions.length,
      companyWasteCollected: this.portWasteCollected,
      companyWasteTotal: this.portCompanyPositions.length,
      cooperativeSorted: this.portCooperativeSorted.filter(Boolean).length,
      cooperativeTotal: this.portCooperativeMaterialNames.length,
      waterQuality: this.portWaterQuality,
      missionStage: this.missionStage,
      nextNeighborhoodUnlocked: this.isNextNeighborhoodUnlocked(),
      paused: this.paused,
      mapOpen: this.mapOpen,
      inVehicle: this.inVehicle,
      vehicleSpeed: Math.round(Math.abs(this.vehicleSpeed) * 3.6),
      nearbyAction: nearby?.action ?? null,
      nearbyLabel: nearby?.label ?? '',
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      vehicleX: this.activeVehicle.position.x,
      vehicleZ: this.activeVehicle.position.z,
      message: this.message,
    };
  }

  private emit(): void { this.listener(this.getSnapshot()); }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.clearKeys);
    this.scene.getEngine().getRenderingCanvas()?.removeEventListener('pointerdown', this.focusCanvas);
    this.camera.detachControl();
    this.scene.dispose();
    this.engine.dispose();
  }
}
