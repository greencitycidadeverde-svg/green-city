import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, DynamicTexture, Engine, HemisphericLight,
  Mesh, MeshBuilder, PBRMaterial, Scene, StandardMaterial, TransformNode, Vector3,
} from '@babylonjs/core';
import { ImportMeshAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AbstractMesh } from '@babylonjs/core';
import type { ForestMissionStage, GameSnapshot, LearningNotice, MapObjective, MissionStage, NearbyAction, PortMissionStage, PeripheryMissionStage, SnapshotListener } from './types';

const TOTAL_TRASH = 5;
const TOTAL_SOLAR_BUILDINGS = 8;
const SOLAR_BUILDINGS_REQUIRED_FOR_EV = 3;
const SOLAR_BUILDING_COST = 10;
const ELECTRIC_VEHICLE_COST = 20;
const PORT_TRUCK_ENTRY_DISTANCE = 9.5;

const PERIPHERY_WASTE_CATALOG = [
  { name: 'Casca de banana', kind: 'organic', category: 'RESÍDUO ORGÂNICO', icon: '🍌',
    description: 'A casca de banana é resto de alimento. Ela se decompõe pela ação de microrganismos e outros organismos do processo de compostagem.',
    destination: 'COMPOSTEIRA — junto com outros resíduos orgânicos e materiais secos, como folhas secas. Não coloque plástico, vidro ou metal aqui.',
    afterwards: 'Com manejo, umidade e entrada de ar, o material se transforma aos poucos. Depois da maturação, o composto pode melhorar o solo dos canteiros.' },
  { name: 'Restos de frutas e folhas', kind: 'organic', category: 'RESÍDUO ORGÂNICO', icon: '🍎',
    description: 'Sobras de frutas e folhas de plantas são matéria orgânica. Podem ser aproveitadas na compostagem quando estão separadas de embalagens e outros materiais impróprios.',
    destination: 'COMPOSTEIRA — misture com folhas secas e outros materiais vegetais. Evite colocar embalagens, vidro, metal ou produtos químicos.',
    afterwards: 'Os decompositores transformam a mistura ao longo do tempo. Só o composto maturado e adequado deve ser aplicado no solo para cultivar hortaliças e flores.' },
  { name: 'Garrafa PET', kind: 'recyclable', category: 'RECICLÁVEL · PLÁSTICO', icon: '🧴',
    description: 'Esta garrafa é uma embalagem plástica PET. Está vazia; quando possível, deve estar limpa e seca para não contaminar os outros materiais.',
    destination: 'COLETA SELETIVA — recipiente azul para recicláveis secos. Depois, o sistema local encaminha o material à triagem e aos recicladores que o recebem.',
    afterwards: 'Na triagem, o plástico é separado por tipo e qualidade. A coleta não significa que a garrafa já foi reciclada: ainda existem transporte, beneficiamento e transformação industrial.' },
  { name: 'Lata de alumínio', kind: 'recyclable', category: 'RECICLÁVEL · METAL', icon: '🥫',
    description: 'Esta lata é feita de alumínio, um metal que pode retornar à cadeia produtiva quando coletado e encaminhado corretamente.',
    destination: 'COLETA SELETIVA — recipiente azul para recicláveis secos. Mantenha a lata vazia e não misture com restos de comida na composteira.',
    afterwards: 'Na triagem, o metal é separado dos demais materiais e segue para quem faz o beneficiamento e a reciclagem. O jogo representa a coleta, não uma reciclagem instantânea.' },
  { name: 'Garrafa de vidro inteira', kind: 'recyclable', category: 'RECICLÁVEL · VIDRO', icon: '🍾',
    description: 'Esta é uma garrafa de vidro inteira, não quebrada. Vidro não se decompõe como restos de comida e precisa seguir uma rota de recebimento própria.',
    destination: 'COLETA SELETIVA — recipiente azul nesta atividade. No mundo real, siga as orientações do serviço local e nunca manipule vidro quebrado sem proteção.',
    afterwards: 'O vidro é separado e encaminhado aos operadores que o recebem para triagem e beneficiamento. Não deve ser jogado na composteira.' },
] as const;

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
  private readonly phaseOneDynamicMeshes: Mesh[] = [];
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
  private playerModelHeadingRoot?: TransformNode;
  private playerModelHeadingOffset = 0;
  private vehicleModelRoot?: TransformNode;
  private vehicleModelHeadingOffset = 0;
  private lastDriveCameraHeading?: number;
  private readonly vehicleModelPaintMaterials: PBRMaterial[] = [];
  private portTruckModelRoot?: TransformNode;
  private portTruckModelHeadingOffset = 0;
  private vehicleVisualRoot?: TransformNode;
  private portTruckVisualRoot?: TransformNode;
  private activePhase: 1 | 2 | 3 | 4 = 1;
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
  private readonly portDynamicMeshes: Mesh[] = [];
  private phaseOneMeshes: Mesh[] = [];
  private readonly phaseOneModelRoots: AbstractMesh[] = [];
  private readonly portModelRoots: AbstractMesh[] = [];
  private portTruck!: Mesh;
  private portRiverMaterial!: StandardMaterial;
  private portTreatmentInstalled = false;
  private portOutfallsInspected = 0;
  private portWasteCollected = 0;
  private portWaterQuality = 24;
  private peripheryMissionStage: PeripheryMissionStage = 'survey';
  private readonly peripheryIssuePositions: PortSite[] = [{ x: -9, z: -17 }, { x: 10, z: 8 }, { x: 30, z: -12 }];
  private readonly peripheryWastePositions: PortSite[] = [{ x: -9, z: -4 }, { x: -3, z: 6 }, { x: 5, z: -8 }, { x: 11, z: 3 }, { x: -17, z: -10 }];
  private readonly peripherySewerPositions: PortSite[] = [{ x: 15, z: -17 }, { x: 15, z: 8 }];
  private readonly peripheryCompostPosition = new Vector3(-29, 0, 20);
  private readonly peripheryOrganicDropPosition = new Vector3(-29, 0, 20);
  private readonly peripheryRecyclingDropPosition = new Vector3(-17, 0, 20);
  private readonly peripheryRainGardenPosition = new Vector3(15, 0, -30);
  private readonly peripheryMeshes: Mesh[] = [];
  private readonly peripheryDynamicMeshes: Mesh[] = [];
  private readonly peripheryIssueMarkers: Mesh[] = [];
  private readonly peripheryWastePiles: Mesh[] = [];
  private readonly peripheryIssueInspected = new Set<number>();
  private peripheryWasteTotal: number = PERIPHERY_WASTE_CATALOG.length;
  private peripheryRecyclableTotal: number = 3;
  private readonly peripheryWasteCollected: boolean[] = [false, false, false, false, false];
  private readonly peripheryOrganicDeposited: boolean[] = [false, false];
  private readonly peripheryRecyclableDeposited: boolean[] = [false, false, false];
  private readonly peripheryOrganicDepositMeshes: Mesh[] = [];
  private readonly peripheryRecyclableDepositMeshes: Mesh[] = [];
  private readonly peripherySewerConnected: boolean[] = [false, false];
  private peripheryOrganicsSorted = false;
  private peripheryRecyclablesSorted = false;
  private peripheryCompostTurned = false;
  private peripheryRainGardenBuilt = false;
  private peripheryWaterQuality = 28;
  private learningNotice: LearningNotice | null = null;
  private learningNoticeSequence = 0;

  // Fase 04 — Reserva Florestal e cadeia local da agricultura familiar.
  private readonly phaseFourMeshes: Mesh[] = [];
  private readonly phaseFourDynamicMeshes: Mesh[] = [];
  private readonly forestHabitatPositions: PortSite[] = [{ x: -8, z: -7 }, { x: 8, z: -31 }, { x: 34, z: -18 }];
  private readonly forestProducePositions: PortSite[] = [{ x: -30, z: -15 }, { x: -23, z: -15 }, { x: -16, z: -15 }];
  private readonly forestPackagingPositions: PortSite[] = [{ x: 1, z: 19 }, { x: 5.6, z: 19 }, { x: 10.2, z: 19 }, { x: 14.8, z: 19 }, { x: 19.4, z: 19 }, { x: 24, z: 19 }];
  private readonly forestSeedlingPositions: PortSite[] = [{ x: -34, z: -3 }, { x: -28, z: -8 }, { x: -21, z: -4 }];
  private readonly forestTruckLoadingPosition = new Vector3(-12, 0, -22);
  private readonly forestFactoryDeliveryPosition = new Vector3(13, 0, -25);
  private readonly forestMarketDeliveryPosition = new Vector3(18, 0, 4);
  private readonly forestFactoryProcessPosition = new Vector3(24, 0, -19);
  private readonly forestMarketStockPosition = new Vector3(25, 0, 14);
  private readonly forestCooperativeDeliveryPosition = new Vector3(-13, 0, 16);
  private readonly forestSpringPosition = new Vector3(2, 0, -8);
  private readonly forestWildlifePosition = new Vector3(34, 0, -20);
  private readonly forestFirePreventionPosition = new Vector3(14, 0, 23.5);
  private forestMissionStage: ForestMissionStage = 'survey';
  private readonly forestHabitatsInspected: boolean[] = [false, false, false];
  private readonly forestProduceHarvested: boolean[] = [false, false, false];
  private readonly forestProduceCrates: Mesh[] = [];
  private forestTruckLoaded = false;
  private forestTruckTraveling = false;
  private forestTruckTarget: Vector3 | null = null;
  private forestTruckDestination: 'factory' | 'market' | null = null;
  private forestTruckRoot?: TransformNode;
  private forestProcessed = false;
  private forestMarketStocked = false;
  private readonly forestPackagingSorted: boolean[] = [false, false, false, false, false, false];
  private forestCooperativeDelivered = false;
  private readonly forestSeedlingsPlanted: boolean[] = [false, false, false];
  private readonly forestSeedlingMarkers: Mesh[] = [];
  private forestSpringProtected = false;
  private forestWildlifeRecorded = false;
  private forestFirePreventionInspected = false;
  private readonly forestHabitatMarkers: Mesh[] = [];
  private readonly forestPackagingBins: StandardMaterial[] = [];

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
    this.camera = new ArcRotateCamera('third-person-camera', -Math.PI / 2, 1.15, 13, new Vector3(0, 1.3, 0), this.scene);
    this.camera.lowerRadiusLimit = 7;
    this.camera.upperRadiusLimit = 24;
    this.camera.lowerBetaLimit = 0.65;
    this.camera.upperBetaLimit = 1.45;
    this.camera.panningSensibility = 0;
    this.camera.wheelPrecision = 38;
    this.camera.attachControl(canvas, true);
    // Free-screen gestures use Babylon's native pointer controls: mouse drag / one-finger touch
    // rotates the view, while the mouse wheel / two-finger pinch changes camera distance.
    // The mobile joystick and action buttons sit above the canvas and keep their own touch input.
    const pointerInput = this.camera.inputs.attached.pointers as any;
    if (pointerInput) {
      pointerInput.buttons = [0];
      pointerInput.angularSensibilityX = 800;
      pointerInput.angularSensibilityY = 800;
      pointerInput.pinchPrecision = 9;
      pointerInput.pinchInwards = true;
    }
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
    const peripheryStartIndex = this.scene.meshes.length;
    this.buildPeripheryDistrict();
    this.peripheryMeshes.push(...this.scene.meshes.slice(peripheryStartIndex) as Mesh[]);
    this.peripheryMeshes.forEach((mesh) => mesh.setEnabled(false));
    const phaseFourStartIndex = this.scene.meshes.length;
    this.buildForestDistrict();
    this.phaseFourMeshes.push(...this.scene.meshes.slice(phaseFourStartIndex) as Mesh[]);
    this.phaseFourMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.forestTruckRoot?.setEnabled(false);
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
      labelFrame.position.set(x, 1.16, 11.23);
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
      labelFace.position.set(x, 1.16, 11.15);
      const labelMaterial = this.material('eco-center-container-label-material-' + index, new Color3(1, 1, 1));
      labelMaterial.diffuseTexture = labelTexture;
      labelMaterial.emissiveColor = new Color3(0.10, 0.10, 0.08);
      labelFace.material = labelMaterial;
    });


    // Large educational legend placed above the bins so every material is readable on approach.
    const legendFrame = MeshBuilder.CreateBox('eco-center-material-legend-frame', { width: 12.2, height: 2.0, depth: 0.16 }, this.scene);
    legendFrame.position.set(-25, 4.25, 9.95);
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
    legendFace.position.set(-25, 4.25, 9.85);
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
      // A fachada visível do armazém fica no lado +X; a placa permanece presa a essa parede.
      face.rotation.y = Math.PI / 2;
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
    const truckVisualRoot = new TransformNode('port-truck-visual-root', this.scene);
    truckVisualRoot.position.copyFrom(truck.position);
    truckVisualRoot.rotation.copyFrom(truck.rotation);
    this.portTruckVisualRoot = truckVisualRoot;
    const truckBody = this.material('port-truck-body', new Color3(0.93, 0.70, 0.13));
    const truckHull = MeshBuilder.CreateSphere('port-collection-truck-rounded-hull', { diameter: 1, segments: 26 }, this.scene);
    truckHull.parent = truckVisualRoot; truckHull.position.set(0, 0.0, 0); truckHull.scaling.set(1.16, 0.42, 2.16); truckHull.material = truckBody;
    const cargo = MeshBuilder.CreateCapsule('port-truck-cargo-box', { height: 2.8, radius: 0.94, tessellation: 18 }, this.scene);
    cargo.parent = truckVisualRoot; cargo.position.set(0, 0.95, -0.55); cargo.rotation.x = Math.PI / 2;
    cargo.scaling.set(1.12, 1.0, 0.68);
    cargo.material = this.material('port-truck-cargo-material', new Color3(0.20, 0.49, 0.34));
    const cab = MeshBuilder.CreateSphere('port-truck-cab', { diameter: 1, segments: 24 }, this.scene);
    cab.parent = truckVisualRoot; cab.position.set(0, 0.8, 1.28); cab.scaling.set(0.98, 0.70, 0.75);
    cab.material = truckBody;
    const cabGlass = MeshBuilder.CreateBox('port-truck-cab-glass', { width: 1.7, height: 0.62, depth: 0.10 }, this.scene);
    cabGlass.parent = truckVisualRoot; cabGlass.position.set(0, 1.0, 1.98);
    cabGlass.material = this.material('port-truck-cab-glass-material', new Color3(0.12, 0.28, 0.32));
    const headlight = this.material('port-truck-headlights', new Color3(0.98, 0.84, 0.48));
    for (const side of [-1, 1]) {
      for (const z of [-1.4, 1.4]) {
        const wheel = MeshBuilder.CreateCylinder('port-truck-wheel', { height: 0.26, diameter: 0.88, tessellation: 12 }, this.scene);
        wheel.parent = truckVisualRoot; wheel.position.set(side * 1.12, -0.08, z);
        wheel.rotation.z = Math.PI / 2;
        wheel.material = this.material('port-truck-wheel-material', new Color3(0.07, 0.08, 0.08));
      }
      const lamp = MeshBuilder.CreateBox('port-truck-headlamp', { width: 0.32, height: 0.25, depth: 0.1 }, this.scene);
      lamp.parent = truckVisualRoot; lamp.position.set(side * 0.78, 0.05, 2.18); lamp.material = headlight;
    }
    const truckMark = MeshBuilder.CreateBox('port-truck-door-mark', { width: 0.06, height: 0.42, depth: 0.82 }, this.scene);
    truckMark.parent = truckVisualRoot; truckMark.position.set(1.19, 0.12, 1.12);
    truckMark.material = this.material('port-truck-door-mark-material', new Color3(0.92, 0.93, 0.82));
    this.portTruck = truck;
  }



  /** Cenário 3D da Periferia Verde: moradias, coleta, compostagem e drenagem. */
  private buildPeripheryDistrict(): void {
    const ground = MeshBuilder.CreateGround('periphery-ground', { width: 90, height: 90 }, this.scene);
    ground.position.y = -0.08; ground.material = this.material('periphery-grass', new Color3(0.38, 0.55, 0.35)); ground.checkCollisions = true;
    const asphalt = this.material('periphery-asphalt', new Color3(0.20, 0.25, 0.23));
    const road = MeshBuilder.CreateGround('periphery-main-road', { width: 84, height: 9 }, this.scene);
    road.position.set(0, 0.02, 28); road.material = asphalt;
    for (let x = -39; x <= 39; x += 8) {
      const dash = MeshBuilder.CreateBox('periphery-road-dash', { width: 3.2, height: 0.025, depth: 0.12 }, this.scene);
      dash.position.set(x, 0.055, 28); dash.material = this.material('periphery-road-marking', new Color3(0.91, 0.83, 0.59));
    }
    const sideRoad = MeshBuilder.CreateGround('periphery-cross-road', { width: 8, height: 72 }, this.scene);
    sideRoad.position.set(4, 0.025, -5); sideRoad.material = asphalt;

    const houseColors = [new Color3(0.76, 0.64, 0.48), new Color3(0.62, 0.72, 0.68), new Color3(0.75, 0.72, 0.58), new Color3(0.66, 0.57, 0.48)];
    const houses = [{ x: 23, z: -18 }, { x: 23, z: 8 }, { x: -34, z: -4 }, { x: -5, z: -30 }];
    houses.forEach((site, index) => {
      const house = MeshBuilder.CreateBox('periphery-house-' + index, { width: 10.5, height: 5.2, depth: 9.5 }, this.scene);
      house.position.set(site.x, 2.6, site.z); house.material = this.material('periphery-house-material-' + index, houseColors[index]); house.checkCollisions = true;
      const roof = MeshBuilder.CreateBox('periphery-house-roof-' + index, { width: 11.2, height: 0.42, depth: 10.2 }, this.scene);
      roof.position.set(site.x, 5.35, site.z); roof.material = this.material('periphery-house-roof-material-' + index, new Color3(0.34, 0.29, 0.24));
      const door = MeshBuilder.CreateBox('periphery-house-door-' + index, { width: 0.18, height: 2.0, depth: 1.15 }, this.scene);
      door.position.set(site.x + 5.3, 1.05, site.z); door.material = this.material('periphery-house-door-material-' + index, new Color3(0.27, 0.20, 0.15));
      const window = MeshBuilder.CreateBox('periphery-house-window-' + index, { width: 0.14, height: 1.25, depth: 1.45 }, this.scene);
      window.position.set(site.x + 5.35, 3.35, site.z - 2.2); window.material = this.material('periphery-house-window-material-' + index, new Color3(0.23, 0.48, 0.56));
      const awning = MeshBuilder.CreateBox('periphery-house-awning-' + index, { width: 1.4, height: 0.16, depth: 2 }, this.scene);
      awning.position.set(site.x + 5.8, 2.65, site.z - 2.2); awning.material = this.material('periphery-house-awning-material-' + index, new Color3(0.18 + index * 0.05, 0.40, 0.28));
    });

    const community = MeshBuilder.CreateBox('periphery-community-center', { width: 13, height: 5.6, depth: 9 }, this.scene);
    community.position.set(-22, 2.8, 2); community.material = this.material('periphery-community-center-material', new Color3(0.72, 0.76, 0.63)); community.checkCollisions = true;
    const communityRoof = MeshBuilder.CreateBox('periphery-community-roof', { width: 13.6, height: 0.4, depth: 9.6 }, this.scene);
    communityRoof.position.set(-22, 5.8, 2); communityRoof.material = this.material('periphery-community-roof-material', new Color3(0.18, 0.35, 0.27));

    const sign = (name: string, label: string, x: number, y: number, z: number, width = 5.4, subtitle?: string): void => {
      const board = MeshBuilder.CreateBox(name + '-board', { width, height: subtitle ? 1.5 : 1.15, depth: 0.18 }, this.scene);
      board.position.set(x, y, z); board.material = this.material(name + '-board-material', new Color3(0.08, 0.29, 0.20));
      const textureWidth = subtitle ? 1536 : 1024;
      const textureHeight = subtitle ? 256 : 180;
      const texture = new DynamicTexture(name + '-texture', { width: textureWidth, height: textureHeight }, this.scene, false);
      const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
      ctx.fillStyle = '#10412D'; ctx.fillRect(0, 0, textureWidth, textureHeight);
      ctx.textAlign = 'center'; ctx.fillStyle = '#EAF5DE'; ctx.font = 'bold 46px Arial';
      ctx.fillText(label, textureWidth / 2, subtitle ? 100 : 122, textureWidth - 48);
      if (subtitle) { ctx.fillStyle = '#D2EDC9'; ctx.font = 'bold 31px Arial'; ctx.fillText(subtitle, textureWidth / 2, 194, textureWidth - 48); }
      texture.update();
      const face = MeshBuilder.CreatePlane(name + '-face', { width: width - 0.25, height: subtitle ? 1.28 : 0.95 }, this.scene);
      face.position.set(x, y, z + 0.105);
      const faceMaterial = this.material(name + '-face-material', new Color3(1, 1, 1));
      faceMaterial.diffuseTexture = texture; faceMaterial.emissiveColor = new Color3(0.10, 0.15, 0.10); face.material = faceMaterial;
    };
    sign('periphery-community-sign', 'CENTRO COMUNITARIO', -22, 6.8, 6.7, 8.4);

    // Esgoto sanitário e água da chuva usam redes distintas e identificadas.
    const sewer = MeshBuilder.CreateTube('periphery-sewer-main', { path: [new Vector3(7, 0.28, -24), new Vector3(7, 0.28, 16), new Vector3(7, 0.28, 24)], radius: 0.23, tessellation: 10 }, this.scene);
    sewer.material = this.material('periphery-sewer-main-material', new Color3(0.45, 0.49, 0.39));
    sign('periphery-sewer-sign', 'REDE DE ESGOTO', 10.3, 2.0, -21, 5.0);
    const grate = MeshBuilder.CreateBox('periphery-storm-drain-grate', { width: 2.2, height: 0.12, depth: 1.25 }, this.scene);
    grate.position.set(10, 0.09, 8); grate.material = this.material('periphery-storm-drain-metal', new Color3(0.24, 0.28, 0.27));
    for (let i = -3; i <= 3; i++) {
      const bar = MeshBuilder.CreateBox('periphery-storm-drain-bar', { width: 0.09, height: 0.035, depth: 1.12 }, this.scene);
      bar.position.set(10 + i * 0.27, 0.17, 8); bar.material = this.material('periphery-storm-drain-bar-material-' + i, new Color3(0.66, 0.69, 0.64));
    }
    const rainChannel = MeshBuilder.CreateTube('periphery-rainwater-channel', { path: [new Vector3(11, 0.12, 8), new Vector3(14, 0.12, 8), new Vector3(14, 0.12, -20)], radius: 0.11, tessellation: 8 }, this.scene);
    rainChannel.material = this.material('periphery-rainwater-channel-material', new Color3(0.25, 0.54, 0.70));
    sign('periphery-storm-sign', 'DRENAGEM PLUVIAL', 16, 2.0, 10, 6.4);

    // COMPOSTEIRA ABERTA: o jogador enxerga o material orgânico dentro dela.
    const wood = this.material('periphery-composter-wood', new Color3(0.39, 0.25, 0.14));
    const compostSoil = this.material('periphery-composter-soil', new Color3(0.22, 0.16, 0.10));
    const compostLeaves = this.material('periphery-composter-leaves', new Color3(0.30, 0.37, 0.18));
    const cx = this.peripheryCompostPosition.x; const cz = this.peripheryCompostPosition.z;
    const compostFloor = MeshBuilder.CreateBox('periphery-composter-floor', { width: 6.4, height: 0.24, depth: 3.8 }, this.scene);
    compostFloor.position.set(cx, 0.18, cz); compostFloor.material = wood;
    const compostBack = MeshBuilder.CreateBox('periphery-composter-back', { width: 6.4, height: 2.05, depth: 0.24 }, this.scene);
    compostBack.position.set(cx, 1.16, cz - 1.8); compostBack.material = wood;
    for (const side of [-1, 1]) {
      const wall = MeshBuilder.CreateBox('periphery-composter-side-' + side, { width: 0.24, height: 2.05, depth: 3.8 }, this.scene);
      wall.position.set(cx + side * 3.08, 1.16, cz); wall.material = wood;
    }
    const compostFront = MeshBuilder.CreateBox('periphery-composter-front', { width: 6.4, height: 0.72, depth: 0.24 }, this.scene);
    compostFront.position.set(cx, 0.53, cz + 1.8); compostFront.material = wood;
    const compostBase = MeshBuilder.CreateBox('periphery-composter-base-material', { width: 5.8, height: 0.28, depth: 3.2 }, this.scene);
    compostBase.position.set(cx, 0.42, cz); compostBase.material = compostSoil;
    for (let row = 0; row < 3; row++) {
      const layer = MeshBuilder.CreateBox('periphery-compost-visible-layer-' + row, { width: 5.6, height: 0.22, depth: 2.9 }, this.scene);
      layer.position.set(cx, 0.62 + row * 0.24, cz - 0.65 + row * 0.38);
      layer.material = row === 1 ? compostLeaves : compostSoil;
    }
    for (let i = 0; i < 8; i++) {
      const leaf = MeshBuilder.CreateSphere('periphery-compost-dry-leaf-' + i, { diameter: 0.42, segments: 6 }, this.scene);
      leaf.position.set(cx - 2.2 + (i % 4) * 1.35, 1.28, cz - 0.9 + Math.floor(i / 4) * 1.35);
      leaf.scaling.set(1.2, 0.18, 0.55); leaf.material = compostLeaves;
    }
    sign('periphery-organic-sign', 'COMPOSTEIRA', cx, 3.2, cz + 2.15, 8.4, 'ORGÂNICOS + FOLHAS SECAS → COMPOSTO');

    // Recicláveis secos em recipiente azul aberto e separado da composteira.
    const recycleBlue = this.material('periphery-recycling-dropoff-material', new Color3(0.12, 0.36, 0.57));
    const rx = this.peripheryRecyclingDropPosition.x; const rz = this.peripheryRecyclingDropPosition.z;
    const recycleFloor = MeshBuilder.CreateBox('periphery-recycling-floor', { width: 4.4, height: 0.2, depth: 3.2 }, this.scene);
    recycleFloor.position.set(rx, 0.15, rz); recycleFloor.material = recycleBlue;
    const recycleBack = MeshBuilder.CreateBox('periphery-recycling-back', { width: 4.4, height: 1.85, depth: 0.18 }, this.scene);
    recycleBack.position.set(rx, 1.08, rz - 1.5); recycleBack.material = recycleBlue;
    for (const side of [-1, 1]) {
      const wall = MeshBuilder.CreateBox('periphery-recycling-side-' + side, { width: 0.18, height: 1.85, depth: 3.2 }, this.scene);
      wall.position.set(rx + side * 2.12, 1.08, rz); wall.material = recycleBlue;
    }
    const recycleFront = MeshBuilder.CreateBox('periphery-recycling-front', { width: 4.4, height: 0.6, depth: 0.18 }, this.scene);
    recycleFront.position.set(rx, 0.42, rz + 1.5); recycleFront.material = recycleBlue;
    sign('periphery-recycling-sign', 'RECICLÁVEIS SECOS', rx, 3.1, rz + 1.72, 7.4, 'PLÁSTICO · METAL · VIDRO');

    // Canteiros próximos mostram que o composto maturado retorna ao cultivo.
    const gardenBedPositions = [{ x: -36, z: 10 }, { x: -22, z: 10 }];
    gardenBedPositions.forEach((site, index) => {
      const border = MeshBuilder.CreateBox('periphery-compost-garden-bed-' + index, { width: 6.2, height: 0.46, depth: 3.7 }, this.scene);
      border.position.set(site.x, 0.23, site.z);
      border.material = this.material('periphery-compost-garden-border-' + index, new Color3(0.43, 0.28, 0.16));
      const soilPatch = MeshBuilder.CreateGround('periphery-compost-garden-soil-' + index, { width: 5.7, height: 3.2 }, this.scene);
      soilPatch.position.set(site.x, 0.47, site.z);
      soilPatch.material = this.material('periphery-compost-garden-soil-material-' + index, new Color3(0.25, 0.17, 0.10));
      if (index === 0) {
        // Mudas e uma hortaliça visíveis desde o início: o canteiro é o destino do composto maturado.
        for (let plantIndex = 0; plantIndex < 4; plantIndex++) {
          const x = site.x - 1.85 + plantIndex * 1.2;
          const stem = MeshBuilder.CreateCylinder('periphery-compost-initial-vegetable-stem-' + plantIndex, { height: 0.62, diameterTop: 0.05, diameterBottom: 0.10, tessellation: 6 }, this.scene);
          stem.position.set(x, 0.82, site.z - 0.1); stem.material = this.material('periphery-compost-initial-vegetable-stem-material', new Color3(0.18, 0.39, 0.17));
          const leaf = MeshBuilder.CreateSphere('periphery-compost-initial-vegetable-leaf-' + plantIndex, { diameter: 0.62, segments: 7 }, this.scene);
          leaf.position.set(x, 1.12, site.z + 0.08); leaf.scaling.set(1.0, 0.22, 0.55);
          leaf.material = this.material('periphery-compost-initial-vegetable-leaf-material', new Color3(0.18, 0.48, 0.20));
          const fruit = MeshBuilder.CreateSphere('periphery-compost-initial-fruit-' + plantIndex, { diameter: 0.26, segments: 7 }, this.scene);
          fruit.position.set(x + 0.12, 0.94, site.z + 0.35);
          fruit.material = this.material('periphery-compost-initial-fruit-material', new Color3(0.80, 0.22, 0.13));
        }
      } else {
        // Flores ajudam a mostrar outros usos do solo melhorado pelo composto maturado.
        for (let flowerIndex = 0; flowerIndex < 3; flowerIndex++) {
          const x = site.x - 1.5 + flowerIndex * 1.5;
          const stem = MeshBuilder.CreateCylinder('periphery-compost-initial-flower-stem-' + flowerIndex, { height: 0.72, diameter: 0.07, tessellation: 6 }, this.scene);
          stem.position.set(x, 0.88, site.z); stem.material = this.material('periphery-compost-initial-flower-stem-material', new Color3(0.17, 0.43, 0.17));
          for (let petal = 0; petal < 5; petal++) {
            const angle = Math.PI * 2 * petal / 5;
            const bloom = MeshBuilder.CreateSphere('periphery-compost-initial-flower-petal-' + flowerIndex + '-' + petal, { diameter: 0.23, segments: 6 }, this.scene);
            bloom.position.set(x + Math.cos(angle) * 0.17, 1.28, site.z + Math.sin(angle) * 0.17);
            bloom.material = this.material('periphery-compost-initial-flower-petal-material-' + flowerIndex, flowerIndex % 2 ? new Color3(0.89, 0.63, 0.19) : new Color3(0.78, 0.40, 0.67));
          }
        }
      }
    });
    sign('periphery-vegetable-garden-sign', 'CANTEIRO DE HORTALIÇAS', -36, 3.0, 12.05, 7.7, 'COMPOSTO MADURO AJUDA A MELHORAR O SOLO');
    sign('periphery-flower-garden-sign', 'FLORES E PLANTAS', -22, 3.0, 12.05, 7.0, 'NUTRIENTES RETORNAM AO SOLO');

    const wetArea = MeshBuilder.CreateGround('periphery-wet-area', { width: 11, height: 8 }, this.scene);
    wetArea.position.set(this.peripheryRainGardenPosition.x, 0.015, this.peripheryRainGardenPosition.z); wetArea.material = this.material('periphery-wet-area-material', new Color3(0.39, 0.43, 0.37));
    const puddle = MeshBuilder.CreateDisc('periphery-standing-water', { radius: 2, tessellation: 24 }, this.scene);
    puddle.position.set(15, 0.07, -30); puddle.scaling.x = 1.45; puddle.material = this.material('periphery-standing-water-material', new Color3(0.20, 0.39, 0.50));

    for (const [index, [x, z]] of [[-39, 18], [-39, -19], [-13, -33], [39, 18], [37, -32], [2, -37]].entries()) {
      const trunk = MeshBuilder.CreateCylinder('periphery-tree-trunk-' + index, { height: 2.4, diameter: 0.36, tessellation: 8 }, this.scene);
      trunk.position.set(x, 1.2, z); trunk.material = this.material('periphery-tree-trunk-material-' + index, new Color3(0.28, 0.18, 0.11));
      const crown = MeshBuilder.CreateSphere('periphery-tree-crown-' + index, { diameter: 3.4, segments: 7 }, this.scene);
      crown.position.set(x, 3.1, z); crown.material = this.material('periphery-tree-crown-material-' + index, new Color3(0.17, 0.43, 0.21));
    }
    this.peripheryIssuePositions.forEach((site, index) => {
      const marker = MeshBuilder.CreateCylinder('periphery-issue-marker-' + index, { height: 0.95, diameterTop: 0.38, diameterBottom: 0.62, tessellation: 10 }, this.scene);
      marker.position.set(site.x, 0.48, site.z); marker.material = this.material('periphery-issue-marker-material-' + index, new Color3(0.91, 0.66, 0.18));
      this.peripheryIssueMarkers.push(marker);
      const beacon = MeshBuilder.CreateSphere('periphery-issue-beacon-' + index, { diameter: 0.34, segments: 8 }, this.scene);
      beacon.position.set(site.x, 1.18, site.z); beacon.material = this.material('periphery-issue-beacon-material-' + index, new Color3(0.98, 0.77, 0.25));
    });
    this.peripheryWastePositions.forEach((site, index) => {
      const pile = this.createPeripheryWasteModel(index, site, 'periphery-community-waste');
      this.peripheryWastePiles.push(pile);
    });
    this.peripherySewerPositions.forEach((site, index) => {
      const marker = MeshBuilder.CreateCylinder('periphery-sewer-marker-' + index, { height: 0.35, diameter: 0.82, tessellation: 12 }, this.scene);
      marker.position.set(site.x, 0.18, site.z); marker.material = this.material('periphery-sewer-marker-material-' + index, new Color3(0.70, 0.62, 0.31));
    });
    sign('periphery-drainage-learning-sign', 'CHUVA NAO E ESGOTO', 27, 2.4, 18, 7.8);
  }


  /** Reserva Florestal: floresta demonstrativa, produção familiar e cadeia de alimentos. */
  private buildForestDistrict(): void {
    const ground = MeshBuilder.CreateGround('forest-ground', { width: 90, height: 90 }, this.scene);
    ground.position.y = -0.08; ground.material = this.material('forest-ground-material', new Color3(0.28, 0.43, 0.27)); ground.checkCollisions = true;
    const dirt = this.material('forest-trail-material', new Color3(0.48, 0.37, 0.24));
    const road = MeshBuilder.CreateGround('forest-farm-road', { width: 66, height: 6.8 }, this.scene);
    road.position.set(0, 0.025, -22.5); road.material = dirt;
    const marketRoad = MeshBuilder.CreateGround('forest-market-road', { width: 6.5, height: 37 }, this.scene);
    marketRoad.position.set(17, 0.03, -4); marketRoad.material = dirt;
    const researchTrail = MeshBuilder.CreateGround('forest-research-trail', { width: 5.2, height: 54 }, this.scene);
    researchTrail.position.set(-34, 0.025, 4); researchTrail.material = dirt;

    const sign = (id: string, title: string, subtitle: string, x: number, y: number, z: number, width = 8.2): void => {
      const board = MeshBuilder.CreateBox(id + '-board', { width, height: 1.65, depth: 0.22 }, this.scene);
      board.position.set(x, y, z); board.material = this.material(id + '-board-material', new Color3(0.07, 0.25, 0.17));
      const texture = new DynamicTexture(id + '-texture', { width: 1024, height: 256 }, this.scene, false);
      const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
      ctx.fillStyle = '#103E2B'; ctx.fillRect(0, 0, 1024, 256);
      ctx.strokeStyle = '#F3D67C'; ctx.lineWidth = 10; ctx.strokeRect(12, 12, 1000, 232);
      ctx.textAlign = 'center'; ctx.fillStyle = '#F4F5E8'; ctx.font = 'bold 62px Arial'; ctx.fillText(title, 512, 99, 960);
      ctx.fillStyle = '#D9EBCB'; ctx.font = 'bold 31px Arial'; ctx.fillText(subtitle, 512, 172, 960); texture.update();
      const face = MeshBuilder.CreatePlane(id + '-face', { width: width - 0.24, height: 1.42 }, this.scene);
      face.position.set(x, y, z + 0.125);
      // Placa fixa voltada para a frente (+Z): não acompanha a câmera.
      const mat = this.material(id + '-face-material', new Color3(1, 1, 1));
      mat.diffuseTexture = texture; mat.emissiveColor = new Color3(0.13, 0.17, 0.12); face.material = mat;
    };
    const postSign = (id: string, title: string, subtitle: string, x: number, y: number, z: number, width = 8.2): void => {
      const postMat = this.material(id + '-post-material', new Color3(0.29, 0.19, 0.11));
      for (const dx of [-width * 0.43, width * 0.43]) {
        const post = MeshBuilder.CreateBox(id + '-post', { width: 0.22, height: 2.75, depth: 0.22 }, this.scene);
        post.position.set(x + dx, y - 1.28, z - 0.04); post.material = postMat;
      }
      sign(id, title, subtitle, x, y, z, width);
    };
    const building = (id: string, x: number, z: number, width: number, height: number, depth: number, facade: Color3, roof: Color3): void => {
      const shell = MeshBuilder.CreateBox(id + '-shell', { width, height, depth }, this.scene);
      shell.position.set(x, height / 2, z); shell.material = this.material(id + '-facade', facade); shell.checkCollisions = true;
      const roofMesh = MeshBuilder.CreateBox(id + '-roof', { width: width + 0.7, height: 0.42, depth: depth + 0.7 }, this.scene);
      roofMesh.position.set(x, height + 0.18, z); roofMesh.material = this.material(id + '-roof-material', roof);
      const door = MeshBuilder.CreateBox(id + '-entry', { width: 2.2, height: 2.55, depth: 0.16 }, this.scene);
      door.position.set(x, 1.28, z + depth / 2 + 0.1); door.material = this.material(id + '-door-material', new Color3(0.18, 0.27, 0.22));
      for (const offset of [-width * 0.31, width * 0.31]) {
        const window = MeshBuilder.CreateBox(id + '-window', { width: Math.min(2.5, width * 0.23), height: 1.65, depth: 0.12 }, this.scene);
        window.position.set(x + offset, height * 0.62, z + depth / 2 + 0.09);
        window.material = this.material(id + '-window-material', new Color3(0.17, 0.39, 0.43));
      }
    };

    // Dossel em fragmentos, clareiras e árvores em baixa poligonagem.
    const leafMats = [
      this.material('forest-leaf-dark', new Color3(0.08, 0.27, 0.15)),
      this.material('forest-leaf-mid', new Color3(0.13, 0.39, 0.19)),
      this.material('forest-leaf-light', new Color3(0.25, 0.51, 0.23)),
    ];
    const trunkMat = this.material('forest-trunk', new Color3(0.28, 0.18, 0.11));
    let treeIndex = 0;
    for (let x = -42; x <= 42; x += 8) for (let z = -40; z <= 40; z += 8) {
      const inFarm = x <= -14 && x >= -36 && z >= -19 && z <= -10;
      const nearBuildings = (x < -17 && z > -34 && z < -18) || (x > 16 && z > -34 && z < -17)
        || (x > 18 && z > -1 && z < 19) || (x < -35 && z > 24);
      const onRoad = Math.abs(z + 22.5) < 5 || (Math.abs(x - 17) < 5 && z > -24 && z < 15);
      const onTrail = Math.abs(x + 34) < 4 && z > -28 && z < 34;
      if (inFarm || nearBuildings || onRoad || onTrail) continue;
      const height = 4.1 + (treeIndex % 4) * 0.42;
      const trunk = MeshBuilder.CreateCylinder('forest-tree-trunk-' + treeIndex, { height, diameterTop: 0.22, diameterBottom: 0.62, tessellation: 8 }, this.scene);
      trunk.position.set(x, height / 2, z); trunk.material = trunkMat; trunk.checkCollisions = true;
      const crown = MeshBuilder.CreateSphere('forest-tree-crown-' + treeIndex, { diameter: 3.2 + (treeIndex % 3) * 0.35, segments: 8 }, this.scene);
      crown.position.set(x, height + 0.45, z); crown.scaling.y = 1 + (treeIndex % 2) * 0.16; crown.material = leafMats[treeIndex % 3];
      for (const [dx, dz] of [[-0.78, 0.14], [0.72, -0.3], [0.12, 0.76]]) {
        const cluster = MeshBuilder.CreateSphere('forest-tree-cluster-' + treeIndex, { diameter: 1.8, segments: 7 }, this.scene);
        cluster.position.set(x + dx, height + 0.65, z + dz); cluster.material = leafMats[(treeIndex + 1) % 3];
      }
      treeIndex++;
    }

    // Centro de conservação e viveiro.
    building('forest-research-base', -34, 31, 11, 4.8, 8.5, new Color3(0.72, 0.72, 0.57), new Color3(0.19, 0.3, 0.23));
    sign('forest-research-sign', 'CENTRO DE CONSERVAÇÃO', 'Pesquisa, educação e monitoramento da reserva', -34, 4.1, 35.42, 9.4);
    building('forest-native-nursery', -11, 29, 10, 3.6, 8, new Color3(0.59, 0.72, 0.52), new Color3(0.22, 0.38, 0.24));
    sign('forest-nursery-sign', 'VIVEIRO DE NATIVAS', 'Mudas de espécies adequadas ao ecossistema local', -11, 3.9, 33.2, 8.8);
    for (let row = 0; row < 3; row++) {
      const bed = MeshBuilder.CreateBox('forest-nursery-bed-' + row, { width: 7.5, height: 0.18, depth: 1.2 }, this.scene);
      bed.position.set(-11, 0.12, 22 + row * 2); bed.material = this.material('forest-nursery-bed-material-' + row, new Color3(0.31, 0.22, 0.13));
      for (let col = 0; col < 6; col++) {
        const pot = MeshBuilder.CreateCylinder('forest-nursery-pot', { height: 0.38, diameter: 0.42, tessellation: 8 }, this.scene);
        pot.position.set(-14.1 + col * 1.22, 0.37, 22 + row * 2); pot.material = this.material('forest-nursery-pot-material', new Color3(0.43, 0.27, 0.16));
        const sprout = MeshBuilder.CreateCylinder('forest-nursery-sprout', { height: 0.65, diameterTop: 0.05, diameterBottom: 0.14, tessellation: 6 }, this.scene);
        sprout.position.set(-14.1 + col * 1.22, 0.82, 22 + row * 2); sprout.material = leafMats[2];
      }
    }


    // Corredor ecológico: faixas de vegetação nativa conectam fragmentos junto ao curso d'água.
    const corridorTrunk = this.material('forest-corridor-trunk', new Color3(0.29, 0.19, 0.12));
    const corridorLeaf = this.material('forest-corridor-leaf', new Color3(0.24, 0.49, 0.24));
    for (let i = 0; i < 6; i++) {
      for (const x of [-4.2, 8.1]) {
        const z = -11 - i * 3.1;
        const trunk = MeshBuilder.CreateCylinder('forest-corridor-tree-trunk-' + i + '-' + x, { height: 2.8, diameterTop: 0.12, diameterBottom: 0.34, tessellation: 7 }, this.scene);
        trunk.position.set(x, 1.4, z); trunk.material = corridorTrunk;
        const crown = MeshBuilder.CreateSphere('forest-corridor-tree-crown-' + i + '-' + x, { diameter: 2.3, segments: 7 }, this.scene);
        crown.position.set(x, 3.0, z); crown.material = corridorLeaf;
      }
    }
    postSign('forest-corridor-sign', 'CORREDOR ECOLÓGICO', 'Vegetação conectada pode facilitar o deslocamento da fauna', 10.2, 3.4, -6.1, 9.0);

    // Posto de prevenção: observação de risco, comunicação e apoio a equipes capacitadas.
    building('forest-fire-prevention-station', 14, 30, 10, 4.2, 7,
      new Color3(0.73, 0.65, 0.47), new Color3(0.58, 0.25, 0.16));
    sign('forest-fire-prevention-sign', 'PREVENÇÃO DE INCÊNDIOS', 'Monitoramento de risco, alerta e comunicação segura', 14, 4.0, 33.62, 10.4);
    const waterTank = MeshBuilder.CreateCylinder('forest-fire-water-tank', { height: 3.4, diameter: 2.7, tessellation: 12 }, this.scene);
    waterTank.position.set(21.2, 1.9, 30); waterTank.material = this.material('forest-fire-water-tank-material', new Color3(0.58, 0.66, 0.67));
    const tankCap = MeshBuilder.CreateCylinder('forest-fire-water-tank-cap', { height: 0.35, diameter: 2.9, tessellation: 12 }, this.scene);
    tankCap.position.set(21.2, 3.75, 30); tankCap.material = this.material('forest-fire-water-tank-cap-material', new Color3(0.37, 0.44, 0.44));
    const radioMast = MeshBuilder.CreateCylinder('forest-fire-radio-mast', { height: 6.4, diameter: 0.16, tessellation: 8 }, this.scene);
    radioMast.position.set(7.2, 3.2, 33); radioMast.material = this.material('forest-fire-radio-mast-material', new Color3(0.32, 0.35, 0.32));
    const beacon = MeshBuilder.CreateSphere('forest-fire-radio-beacon', { diameter: 0.68, segments: 8 }, this.scene);
    beacon.position.set(7.2, 6.5, 33); beacon.material = this.material('forest-fire-radio-beacon-material', new Color3(0.88, 0.22, 0.12));
    postSign('forest-fire-safety-sign', 'SEGURANÇA DA RESERVA', 'Não provoque queimadas; comunique fumaça e siga a equipe treinada', 12, 2.9, 23.5, 9.6);

    // Nascente, curso d'água e observação da fauna.
    const creek = MeshBuilder.CreateGround('forest-creek', { width: 11, height: 53 }, this.scene);
    creek.position.set(2, 0.02, -5); creek.material = this.material('forest-creek-water', new Color3(0.17, 0.46, 0.57));
    const spring = MeshBuilder.CreateDisc('forest-spring-water', { radius: 3.1, tessellation: 18 }, this.scene);
    spring.position.set(2, 0.08, -8); spring.scaling.set(1.2, 1, 0.8); spring.material = this.material('forest-spring-water-material', new Color3(0.2, 0.58, 0.67));
    for (let i = 0; i < 12; i++) {
      const angle = Math.PI * 2 * i / 12;
      const rock = MeshBuilder.CreateSphere('forest-spring-rock-' + i, { diameter: 0.9, segments: 7 }, this.scene);
      rock.position.set(2 + Math.cos(angle) * 3.4, 0.25, -8 + Math.sin(angle) * 2.7);
      rock.scaling.set(1.1, 0.55, 0.8); rock.material = this.material('forest-spring-rock-material-' + i, new Color3(0.49, 0.48, 0.37));
    }
    postSign('forest-spring-sign', 'NASCENTE PROTEGIDA', 'Mata ciliar, solo e água fazem parte do mesmo sistema', 2, 2.8, -3, 8.7);
    for (const [x, z] of [[31, -28], [35, -28], [31, -24], [35, -24]]) {
      const post = MeshBuilder.CreateBox('forest-lookout-post', { width: 0.26, height: 8.2, depth: 0.26 }, this.scene);
      post.position.set(x, 4.1, z); post.material = this.material('forest-lookout-post-material', new Color3(0.32, 0.24, 0.15));
    }
    const towerDeck = MeshBuilder.CreateBox('forest-lookout-platform', { width: 5.2, height: 0.35, depth: 5.2 }, this.scene);
    towerDeck.position.set(33, 6.7, -26); towerDeck.material = this.material('forest-lookout-deck-material', new Color3(0.49, 0.36, 0.22));
    const towerRoof = MeshBuilder.CreateBox('forest-lookout-roof', { width: 5.8, height: 0.3, depth: 5.8 }, this.scene);
    towerRoof.position.set(33, 8.6, -26); towerRoof.material = this.material('forest-lookout-roof-material', new Color3(0.21, 0.31, 0.22));
    postSign('forest-wildlife-sign', 'OBSERVAÇÃO DA FAUNA', 'Registre sinais e imagens sem perturbar os animais', 33, 3.7, -21.2, 9.0);

    // Três locais para diagnóstico de fragmentação e conectividade de habitats.
    this.forestHabitatPositions.forEach((site, index) => {
      const marker = MeshBuilder.CreateCylinder('forest-habitat-marker-' + index, { height: 0.85, diameterTop: 0.36, diameterBottom: 0.62, tessellation: 8 }, this.scene);
      marker.position.set(site.x, 0.43, site.z); marker.material = this.material('forest-habitat-marker-material-' + index, new Color3(0.92, 0.68, 0.19));
      this.forestHabitatMarkers.push(marker);
      const beacon = MeshBuilder.CreateSphere('forest-habitat-beacon-' + index, { diameter: 0.36, segments: 8 }, this.scene);
      beacon.position.set(site.x, 1.05, site.z); beacon.material = this.material('forest-habitat-beacon-material-' + index, new Color3(0.98, 0.79, 0.28));
    });

    // Propriedade de agricultura familiar e talhões de cultivo.
    building('family-farm-house', -31, -29, 10.5, 4.4, 8.8, new Color3(0.73, 0.59, 0.39), new Color3(0.31, 0.2, 0.13));
    sign('family-farm-sign', 'AGRICULTURA FAMILIAR', 'Produção local, trabalho da família e cuidado com o solo', -31, 4.0, -24.45, 9.6);
    const soil = this.material('family-farm-soil', new Color3(0.37, 0.25, 0.14));
    const crop = this.material('family-farm-crop', new Color3(0.17, 0.46, 0.2));
    const tomato = this.material('family-farm-tomato', new Color3(0.83, 0.2, 0.12));
    const produce = this.material('family-farm-produce', new Color3(0.93, 0.68, 0.19));
    for (let row = 0; row < 5; row++) {
      const field = MeshBuilder.CreateBox('family-farm-row-' + row, { width: 18, height: 0.16, depth: 1.25 }, this.scene);
      field.position.set(-23, 0.08, -17 + row * 2); field.material = soil;
      for (let col = 0; col < 10; col++) {
        const x = -31 + col * 1.75;
        const plant = MeshBuilder.CreateSphere('family-farm-plant-' + row + '-' + col, { diameter: 0.7, segments: 7 }, this.scene);
        plant.position.set(x, 0.55, -17 + row * 2); plant.scaling.set(1, 0.65, 0.82); plant.material = crop;
        const fruit = MeshBuilder.CreateSphere('family-farm-fruit-' + row + '-' + col, { diameter: 0.27, segments: 7 }, this.scene);
        fruit.position.set(x + 0.16, 0.65, -17 + row * 2 + 0.18); fruit.material = (row + col) % 2 ? tomato : produce;
      }
    }
    this.forestProducePositions.forEach((site, index) => {
      const crate = MeshBuilder.CreateBox('forest-harvest-crate-' + index, { width: 2, height: 1.1, depth: 1.6 }, this.scene);
      crate.position.set(site.x, 0.55, site.z); crate.material = this.material('forest-harvest-crate-material-' + index, new Color3(0.49, 0.31, 0.16));
      for (let item = 0; item < 4; item++) {
        const fruit = MeshBuilder.CreateSphere('forest-harvest-fruit-' + index + '-' + item, { diameter: 0.55, segments: 8 }, this.scene);
        fruit.position.set(site.x - 0.48 + (item % 2) * 0.92, 1.12, site.z - 0.35 + Math.floor(item / 2) * 0.7);
        fruit.material = item % 2 ? tomato : produce;
      }
      this.forestProduceCrates.push(crate);
    });
    postSign('family-farm-field-sign', 'ÁREA DE COLHEITA', 'Aproveitamento da produção e redução de perdas', -23, 3.1, -8.6, 8.3);

    // Caminhão 3D e transporte animado da fazenda até a agroindústria e o mercado.
    const truck = new TransformNode('forest-produce-truck-root', this.scene);
    truck.position.copyFrom(this.forestTruckLoadingPosition); this.forestTruckRoot = truck;
    const truckBody = this.material('forest-truck-body', new Color3(0.86, 0.67, 0.18));
    const cab = MeshBuilder.CreateBox('forest-truck-cab', { width: 2, height: 1.75, depth: 2 }, this.scene);
    cab.parent = truck; cab.position.set(0, 1.2, 1.55); cab.material = truckBody;
    const glass = MeshBuilder.CreateBox('forest-truck-glass', { width: 1.55, height: 0.76, depth: 0.08 }, this.scene);
    glass.parent = truck; glass.position.set(0, 1.52, 2.58); glass.material = this.material('forest-truck-glass-material', new Color3(0.12, 0.28, 0.34));
    const cargo = MeshBuilder.CreateBox('forest-truck-cargo', { width: 2.45, height: 1.65, depth: 3.25 }, this.scene);
    cargo.parent = truck; cargo.position.set(0, 1.22, -1.05); cargo.material = this.material('forest-truck-cargo-material', new Color3(0.89, 0.88, 0.77));
    for (const side of [-1, 1]) for (const z of [-2.15, 1.65]) {
      const wheel = MeshBuilder.CreateCylinder('forest-truck-wheel', { height: 0.26, diameter: 0.88, tessellation: 12 }, this.scene);
      wheel.parent = truck; wheel.position.set(side * 1.22, 0.48, z); wheel.rotation.z = Math.PI / 2;
      wheel.material = this.material('forest-truck-wheel-material', new Color3(0.06, 0.07, 0.07));
    }
    postSign('forest-truck-sign', 'PÁTIO DE CARGA', 'O caminhoneiro transporta a produção até a indústria', -12, 4.2, -17.6, 9.2);

    // Agroindústria: galpão, silos, chaminé e doca com identidade diferente da cooperativa.
    building('food-industry', 26, -28, 17, 8.4, 13, new Color3(0.59, 0.65, 0.64), new Color3(0.19, 0.25, 0.27));
    const chimney = MeshBuilder.CreateCylinder('food-industry-chimney', { height: 10, diameterTop: 1.25, diameterBottom: 1.65, tessellation: 10 }, this.scene);
    chimney.position.set(33, 12.5, -32); chimney.material = this.material('food-industry-chimney-material', new Color3(0.52, 0.55, 0.52));
    for (const x of [20, 24]) {
      const silo = MeshBuilder.CreateCylinder('food-industry-silo', { height: 6.5, diameter: 3, tessellation: 12 }, this.scene);
      silo.position.set(x, 3.25, -18.6); silo.material = this.material('food-industry-silo-material', new Color3(0.73, 0.77, 0.74));
    }
    sign('food-industry-sign', 'AGROINDÚSTRIA', 'Recebe, processa, prepara e embala alimentos', 26, 5.3, -21.25, 9.3);
    const intake = MeshBuilder.CreateBox('food-industry-receiving-dock', { width: 8.5, height: 0.72, depth: 3 }, this.scene);
    intake.position.set(14, 0.36, -25); intake.material = this.material('food-industry-dock-material', new Color3(0.38, 0.42, 0.39));
    const conveyor = MeshBuilder.CreateBox('food-industry-conveyor', { width: 8, height: 0.65, depth: 1.3 }, this.scene);
    conveyor.position.set(28, 1, -17); conveyor.material = this.material('food-industry-conveyor-material', new Color3(0.22, 0.28, 0.26));
    postSign('food-industry-flow-sign', 'LINHA DE PRODUÇÃO', 'Processamento e embalagem também geram resíduos', 25, 3.9, -16.05, 9.5);

    // Mercado local, vitrine e exposição de alimentos.
    building('local-market', 26, 7, 13, 4.8, 9, new Color3(0.79, 0.66, 0.43), new Color3(0.59, 0.19, 0.14));
    const awning = MeshBuilder.CreateBox('local-market-awning', { width: 13.8, height: 0.42, depth: 1.6 }, this.scene);
    awning.position.set(26, 3.15, 12); awning.material = this.material('local-market-awning-material', new Color3(0.83, 0.27, 0.18));
    sign('local-market-sign', 'MERCADO LOCAL', 'Comércio aproxima a produção dos consumidores', 26, 3.9, 11.65, 8.4);
    for (let i = 0; i < 4; i++) {
      const shelf = MeshBuilder.CreateBox('local-market-shelf-' + i, { width: 2.2, height: 0.72, depth: 1.05 }, this.scene);
      shelf.position.set(21.2 + i * 1.55, 0.45, 14.1); shelf.material = this.material('local-market-shelf-material-' + i, new Color3(0.42, 0.29, 0.17));
      const goods = MeshBuilder.CreateSphere('local-market-goods-' + i, { diameter: 0.72, segments: 8 }, this.scene);
      goods.position.set(21.2 + i * 1.55, 1.05, 14.1); goods.material = i % 2 ? tomato : produce;
    }

    // Pós-consumo: recipientes seguem o código de cores da Resolução CONAMA 275/2001.
    // Os quatro recicláveis secos seguem à cooperativa; orgânicos e rejeitos têm rotas separadas.
    const binCatalog = [
      { label: 'PAPEL / PAPELÃO', examples: 'CAIXAS · JORNAIS LIMPOS', color: new Color3(0.09, 0.36, 0.78) },
      { label: 'PLÁSTICO', examples: 'GARRAFAS PET · EMBALAGENS', color: new Color3(0.82, 0.12, 0.16) },
      { label: 'VIDRO', examples: 'POTES · GARRAFAS INTEGRAS', color: new Color3(0.10, 0.49, 0.25) },
      { label: 'METAL', examples: 'LATAS · ALUMÍNIO · AÇO', color: new Color3(0.96, 0.76, 0.08) },
      { label: 'ORGÂNICOS', examples: 'RESTOS DE ALIMENTOS · FOLHAS', color: new Color3(0.38, 0.23, 0.14) },
      { label: 'REJEITO GERAL', examples: 'NÃO RECICLÁVEL · MISTURADO', color: new Color3(0.42, 0.44, 0.46) },
    ];
    this.forestPackagingPositions.forEach((site, index) => {
      const item = binCatalog[index];
      const bin = MeshBuilder.CreateBox('forest-sorting-bin-' + index, { width: 2.5, height: 1.65, depth: 2.05 }, this.scene);
      bin.position.set(site.x, 0.83, site.z);
      const binMaterial = this.material('forest-sorting-bin-material-' + index, item.color);
      bin.material = binMaterial;
      this.forestPackagingBins.push(binMaterial);
      const lid = MeshBuilder.CreateBox('forest-sorting-bin-lid-' + index, { width: 2.66, height: 0.18, depth: 2.16 }, this.scene);
      lid.position.set(site.x, 1.72, site.z); lid.material = binMaterial;
      postSign('forest-sorting-sign-' + index, item.label, item.examples, site.x, 3.1, site.z + 1.12, 4.7);
    });
    postSign('forest-consumer-sign', 'SEPARAÇÃO NA ORIGEM', 'RECICLÁVEIS SECOS · ORGÂNICOS · REJEITOS — NÃO MISTURE', 12.5, 5, 22.5, 12.2);
    postSign('forest-dry-recyclables-sign', 'RECICLÁVEIS SECOS', 'PAPEL · PLÁSTICO · VIDRO · METAL', 8, 4.35, 20.6, 9.8);

    // Painel didático com o código completo de cores da CONAMA 275/2001.
    // Resíduos especiais aparecem apenas como orientação: não são manipulados na coleta comum.
    const colorPanelX = 31; const colorPanelZ = 34.3;
    const colorPanel = MeshBuilder.CreateBox('forest-national-waste-color-panel', { width: 15.8, height: 8.8, depth: 0.22 }, this.scene);
    colorPanel.position.set(colorPanelX, 4.65, colorPanelZ);
    colorPanel.material = this.material('forest-national-waste-color-panel-material', new Color3(0.07, 0.2, 0.16));
    const colorTexture = new DynamicTexture('forest-national-waste-color-panel-texture', { width: 1400, height: 760 }, this.scene, false);
    const colorCtx = colorTexture.getContext() as unknown as CanvasRenderingContext2D;
    colorCtx.fillStyle = '#F4F2E8'; colorCtx.fillRect(0, 0, 1400, 760);
    colorCtx.fillStyle = '#123D2D'; colorCtx.fillRect(0, 0, 1400, 112);
    colorCtx.textAlign = 'center'; colorCtx.fillStyle = '#FFFFFF'; colorCtx.font = 'bold 42px Arial';
    colorCtx.fillText('CÓDIGO BRASILEIRO DE CORES · CONAMA 275/2001', 700, 70);
    const nationalColorItems = [
      ['AZUL', 'PAPEL / PAPELÃO', '#1976D2', '#FFFFFF'],
      ['VERMELHO', 'PLÁSTICO', '#D32F2F', '#FFFFFF'],
      ['VERDE', 'VIDRO', '#2E7D32', '#FFFFFF'],
      ['AMARELO', 'METAL', '#FBC02D', '#1C1C1C'],
      ['PRETO', 'MADEIRA', '#242424', '#FFFFFF'],
      ['LARANJA', 'RESÍDUOS PERIGOSOS', '#EF6C00', '#FFFFFF'],
      ['BRANCO', 'SERVIÇOS DE SAÚDE · MANEJO PRÓPRIO', '#FFFFFF', '#1C1C1C'],
      ['ROXO', 'RESÍDUOS RADIOATIVOS · CONTROLE ESPECIAL', '#7B1FA2', '#FFFFFF'],
      ['MARROM', 'RESÍDUOS ORGÂNICOS', '#795548', '#FFFFFF'],
      ['CINZA', 'REJEITO / MISTURADO / CONTAMINADO NÃO SEPARÁVEL', '#757575', '#FFFFFF'],
    ];
    nationalColorItems.forEach((item, index) => {
      const col = index < 5 ? 0 : 1;
      const row = index % 5;
      const x = 46 + col * 690; const y = 140 + row * 101;
      colorCtx.fillStyle = '#FFFFFF'; colorCtx.fillRect(x, y, 650, 88);
      colorCtx.strokeStyle = '#C8CEC8'; colorCtx.lineWidth = 2; colorCtx.strokeRect(x, y, 650, 88);
      colorCtx.fillStyle = item[2]; colorCtx.fillRect(x + 12, y + 12, 66, 64);
      colorCtx.fillStyle = item[3]; colorCtx.textAlign = 'center'; colorCtx.font = 'bold 20px Arial';
      colorCtx.fillText(item[0], x + 45, y + 51);
      colorCtx.textAlign = 'left'; colorCtx.fillStyle = '#18372B'; colorCtx.font = 'bold 24px Arial';
      colorCtx.fillText(item[1], x + 96, y + 54, 535);
    });
    colorCtx.textAlign = 'center'; colorCtx.fillStyle = '#18372B'; colorCtx.font = 'bold 22px Arial';
    colorCtx.fillText('CORES IDENTIFICAM A CATEGORIA; RÓTULOS EXPLICAM O CONTEÚDO E O RISCO.', 700, 675);
    colorCtx.font = '19px Arial';
    colorCtx.fillText('Saúde, químicos perigosos e radioativos exigem segregação, acondicionamento e destinação específicos.', 700, 716);
    colorTexture.update();
    const colorPanelFace = MeshBuilder.CreatePlane('forest-national-waste-color-panel-face', { width: 15.55, height: 8.55 }, this.scene);
    colorPanelFace.position.set(colorPanelX, 4.65, colorPanelZ + 0.125);
    const colorPanelFaceMat = this.material('forest-national-waste-color-panel-face-material', new Color3(1, 1, 1));
    colorPanelFaceMat.diffuseTexture = colorTexture; colorPanelFaceMat.emissiveColor = new Color3(0.12, 0.14, 0.12);
    colorPanelFace.material = colorPanelFaceMat;

    // Cooperativa fictícia do cenário: recebe e prepara apenas recicláveis secos.
    building('forest-cooperative', -24, 16, 18, 6.7, 13, new Color3(0.62, 0.7, 0.56), new Color3(0.12, 0.31, 0.22));
    sign('forest-cooperative-sign', 'COOPERATIVA RAÍZES DA FLORESTA', 'TRIAGEM DE PAPEL · PLÁSTICO · VIDRO · METAL', -24, 4.3, 22.75, 12.8);
    const dock = MeshBuilder.CreateBox('forest-cooperative-dock', { width: 11, height: 0.68, depth: 3.2 }, this.scene);
    dock.position.set(-13, 0.34, 15); dock.material = this.material('forest-cooperative-dock-material', new Color3(0.4, 0.43, 0.38));
    const cooperativeBays = [
      { x: -30, label: 'PAPEL', color: new Color3(0.09, 0.36, 0.78) },
      { x: -25.2, label: 'PLÁSTICO', color: new Color3(0.82, 0.12, 0.16) },
      { x: -20.4, label: 'VIDRO', color: new Color3(0.10, 0.49, 0.25) },
      { x: -15.6, label: 'METAL', color: new Color3(0.96, 0.76, 0.08) },
    ];
    cooperativeBays.forEach((bayInfo, index) => {
      const bay = MeshBuilder.CreateBox('forest-cooperative-bay-' + index, { width: 3.7, height: 1.1, depth: 3.1 }, this.scene);
      bay.position.set(bayInfo.x, 0.55, 7.3);
      bay.material = this.material('forest-cooperative-bay-material-' + index, bayInfo.color);
      postSign('forest-cooperative-bay-sign-' + index, bayInfo.label, 'MATERIAL TRIADO', bayInfo.x, 2.65, 9.05, 4.45);
    });
    const press = MeshBuilder.CreateBox('forest-cooperative-press', { width: 2.5, height: 3.2, depth: 2 }, this.scene);
    press.position.set(-8.2, 1.6, 7.5); press.material = this.material('forest-cooperative-press-material', new Color3(0.48, 0.53, 0.53));
    const bale = MeshBuilder.CreateBox('forest-cooperative-bale', { width: 2.5, height: 1.8, depth: 2 }, this.scene);
    bale.position.set(-4.7, 0.9, 7.5); bale.material = this.material('forest-cooperative-bale-material', new Color3(0.28, 0.47, 0.34));
    postSign('forest-cooperative-process-sign', 'TRABALHO DA COOPERATIVA', 'RECEBER · CONFERIR · TRIAR · PRENSAR · ENCAMINHAR', -6.4, 3.2, 10.1, 9.8);
    postSign('forest-compost-sign', 'COMPOSTAGEM', 'Resíduos orgânicos limpos retornam ao solo após manejo adequado', 34, 3, 24, 9);
    const compostPad = MeshBuilder.CreateGround('forest-compost-pad', { width: 8.2, height: 6.2 }, this.scene);
    compostPad.position.set(34, 0.035, 17.5); compostPad.material = this.material('forest-compost-pad-material', new Color3(0.38, 0.28, 0.17));
    for (let i = 0; i < 3; i++) {
      const compostRow = MeshBuilder.CreateBox('forest-compost-row-' + i, { width: 5.5, height: 0.7, depth: 1.2 }, this.scene);
      compostRow.position.set(34, 0.4, 15.5 + i * 1.6); compostRow.material = this.material('forest-compost-row-material-' + i, new Color3(0.24 + i * 0.04, 0.19, 0.12));
    }

    // Balde fechado para o serviço opcional de coleta de orgânicos.
    // Fica junto à compostagem e afastado da doca e das baias de recicláveis secos.
    const organicBucketBrown = this.material('forest-organic-bucket-brown', new Color3(0.38, 0.23, 0.14));
    const organicBucket = MeshBuilder.CreateCylinder('forest-organic-pickup-bucket', {
      height: 1.55, diameterTop: 1.18, diameterBottom: 0.94, tessellation: 12,
    }, this.scene);
    organicBucket.position.set(40.2, 0.78, 21.4); organicBucket.material = organicBucketBrown;
    const organicBucketRim = MeshBuilder.CreateTorus('forest-organic-bucket-rim', {
      diameter: 1.2, thickness: 0.09, tessellation: 12,
    }, this.scene);
    organicBucketRim.position.set(40.2, 1.51, 21.4); organicBucketRim.material = organicBucketBrown;
    const organicBucketLid = MeshBuilder.CreateCylinder('forest-organic-bucket-lid', {
      height: 0.14, diameter: 1.24, tessellation: 12,
    }, this.scene);
    organicBucketLid.position.set(40.2, 1.62, 21.4); organicBucketLid.material = this.material('forest-organic-bucket-lid-material', new Color3(0.27, 0.17, 0.1));
    postSign('forest-organic-pickup-sign', 'BALDE DE ORGÂNICOS', 'COLETA SEPARADA · RECIPIENTE COM TAMPA', 40.2, 3.25, 24.0, 8.5);
    postSign('forest-organic-service-sign', 'SERVIÇO OPCIONAL', 'RETIRADA PROGRAMADA CONFORME VOLUME E ROTA', 30.5, 3.2, 25.8, 9.0);

    // Personagens low-poly originais: agricultor, motorista, operário, comerciante, cooperado e biólogo.
    const npc = (id: string, x: number, z: number, clothing: Color3, hat: Color3): void => {
      const root = new TransformNode(id + '-root', this.scene); root.position.set(x, 0, z);
      const body = MeshBuilder.CreateCapsule(id + '-body', { height: 1, radius: 0.34, tessellation: 8 }, this.scene);
      body.parent = root; body.position.set(0, 1.12, 0); body.material = this.material(id + '-clothing', clothing);
      const vest = MeshBuilder.CreateBox(id + '-vest', { width: 0.54, height: 0.74, depth: 0.23 }, this.scene);
      vest.parent = root; vest.position.set(0, 1.18, 0.22); vest.material = this.material(id + '-vest-material', new Color3(0.91, 0.72, 0.2));
      const head = MeshBuilder.CreateSphere(id + '-head', { diameter: 0.62, segments: 10 }, this.scene);
      head.parent = root; head.position.set(0, 1.95, 0.04); head.material = this.material(id + '-skin', new Color3(0.68, 0.46, 0.32));
      const hatMesh = MeshBuilder.CreateCylinder(id + '-hat', { height: 0.16, diameter: 0.82, tessellation: 10 }, this.scene);
      hatMesh.parent = root; hatMesh.position.set(0, 2.28, 0.04); hatMesh.material = this.material(id + '-hat-material', hat);
      for (const side of [-1, 1]) {
        const arm = MeshBuilder.CreateCapsule(id + '-arm', { height: 0.7, radius: 0.13, tessellation: 7 }, this.scene);
        arm.parent = root; arm.position.set(side * 0.43, 1.16, 0.02); arm.material = body.material as StandardMaterial;
        const leg = MeshBuilder.CreateCapsule(id + '-leg', { height: 0.7, radius: 0.14, tessellation: 7 }, this.scene);
        leg.parent = root; leg.position.set(side * 0.17, 0.43, 0); leg.material = this.material(id + '-trousers', new Color3(0.16, 0.23, 0.21));
      }
    };
    npc('npc-family-farmer', -36, -27, new Color3(0.21, 0.37, 0.24), new Color3(0.66, 0.42, 0.18));
    npc('npc-produce-driver', -10, -19, new Color3(0.17, 0.31, 0.48), new Color3(0.9, 0.68, 0.14));
    npc('npc-food-industry-worker', 34, -19, new Color3(0.35, 0.43, 0.47), new Color3(0.89, 0.83, 0.6));
    npc('npc-market-vendor', 32, 13, new Color3(0.52, 0.22, 0.17), new Color3(0.87, 0.76, 0.55));
    npc('npc-cooperative-sorter', -8, 15, new Color3(0.12, 0.41, 0.3), new Color3(0.9, 0.69, 0.16));
    npc('npc-forest-biologist', -28, 34, new Color3(0.15, 0.39, 0.32), new Color3(0.88, 0.67, 0.15));
    npc('npc-forest-fire-ranger', 9, 27, new Color3(0.75, 0.29, 0.16), new Color3(0.25, 0.36, 0.26));

    // Fauna ilustrativa sem atribuir espécies a um bioma ainda não escolhido.
    const birdBody = this.material('forest-bird-body', new Color3(0.19, 0.38, 0.55));
    for (let i = 0; i < 4; i++) {
      const bird = new TransformNode('forest-bird-root-' + i, this.scene);
      bird.position.set(12 + i * 2.1, 4.8 + (i % 2) * 0.8, -34 + (i % 2) * 1.8);
      const body = MeshBuilder.CreateSphere('forest-bird-body-' + i, { diameter: 0.95, segments: 8 }, this.scene);
      body.parent = bird; body.scaling.set(1.3, 0.65, 0.7); body.material = birdBody;
      const wing = MeshBuilder.CreateSphere('forest-bird-wing-' + i, { diameter: 0.8, segments: 7 }, this.scene);
      wing.parent = bird; wing.position.set(0, 0.18, -0.18); wing.scaling.set(0.35, 0.17, 1.15);
      wing.material = this.material('forest-bird-wing-material', new Color3(0.87, 0.58, 0.18));
    }
    const cameraPole = MeshBuilder.CreateCylinder('forest-camera-trap-pole', { height: 2.4, diameter: 0.14, tessellation: 8 }, this.scene);
    cameraPole.position.set(34, 1.2, -17.7); cameraPole.material = this.material('forest-camera-pole-material', new Color3(0.22, 0.25, 0.19));
    const camera = MeshBuilder.CreateBox('forest-camera-trap', { width: 0.58, height: 0.48, depth: 0.32 }, this.scene);
    camera.position.set(34, 2.2, -17.7); camera.material = this.material('forest-camera-trap-material', new Color3(0.29, 0.32, 0.2));

    this.forestSeedlingPositions.forEach((site, index) => {
      const marker = MeshBuilder.CreateCylinder('forest-seedling-marker-' + index, { height: 0.22, diameter: 1.4, tessellation: 8 }, this.scene);
      marker.position.set(site.x, 0.11, site.z); marker.material = this.material('forest-seedling-marker-material-' + index, new Color3(0.52, 0.34, 0.17));
      const sprout = MeshBuilder.CreateCylinder('forest-seedling-sprout-' + index, { height: 0.8, diameterTop: 0.04, diameterBottom: 0.14, tessellation: 6 }, this.scene);
      sprout.position.set(site.x, 0.55, site.z); sprout.material = leafMats[2];
      this.forestSeedlingMarkers.push(marker);
    });
    postSign('forest-restoration-sign', 'RESTAURAÇÃO FLORESTAL', 'Use espécies nativas adequadas e acompanhe sua sobrevivência', -27, 3, 2.6, 9.6);
  }

  private getNearbyForestInteraction(): { action: NearbyAction; label: string } | null {
    const dist = (site: PortSite | Vector3): number => Math.hypot(this.player.position.x - site.x, this.player.position.z - site.z);
    if (this.forestMissionStage === 'survey') {
      const i = this.forestHabitatPositions.findIndex((site, index) => !this.forestHabitatsInspected[index] && dist(site) <= 6.5);
      if (i >= 0) return { action: 'inspect-forest-habitat', label: 'E · INVESTIGAR HABITAT E BIODIVERSIDADE' };
    } else if (this.forestMissionStage === 'harvest') {
      const i = this.forestProducePositions.findIndex((site, index) => !this.forestProduceHarvested[index] && dist(site) <= 4.2);
      if (i >= 0) return { action: 'harvest-farm-produce', label: 'E · COLHER PRODUÇÃO DA FAMÍLIA' };
    } else if (this.forestMissionStage === 'transport' && !this.forestTruckLoaded && dist(this.forestTruckLoadingPosition) <= 7) {
      return { action: 'load-farm-truck', label: 'E · CARREGAR A PRODUÇÃO NO CAMINHÃO' };
    } else if (this.forestMissionStage === 'process' && !this.forestTruckTraveling && dist(this.forestFactoryProcessPosition) <= 8.5) {
      return { action: 'process-food-products', label: 'E · PROCESSAR E EMBALAR OS ALIMENTOS' };
    } else if (this.forestMissionStage === 'market' && !this.forestTruckTraveling && dist(this.forestMarketStockPosition) <= 8.5) {
      return { action: 'stock-local-market', label: 'E · RECEBER E EXPOR NO MERCADO' };
    } else if (this.forestMissionStage === 'sorting') {
      const i = this.forestPackagingPositions.findIndex((site, index) => !this.forestPackagingSorted[index] && dist(site) <= 4.5);
      if (i >= 0) return { action: 'sort-consumer-packaging', label: 'E · SEPARAR ' + ['PAPEL / PAPELÃO', 'PLÁSTICO', 'VIDRO', 'METAL', 'ORGÂNICOS', 'REJEITO GERAL'][i] };
    } else if (this.forestMissionStage === 'cooperative' && !this.forestCooperativeDelivered && dist(this.forestCooperativeDeliveryPosition) <= 8.5) {
      return { action: 'deliver-forest-cooperative', label: 'E · ENTREGAR RECICLÁVEIS À COOPERATIVA' };
    } else if (this.forestMissionStage === 'restore') {
      if (!this.forestFirePreventionInspected && dist(this.forestFirePreventionPosition) <= 7.0) return { action: 'inspect-forest-fire-prevention', label: 'E · CONFERIR PREVENÇÃO DE INCÊNDIOS' };
      const seedling = this.forestSeedlingPositions.findIndex((site, index) => !this.forestSeedlingsPlanted[index] && dist(site) <= 4.8);
      if (seedling >= 0) return { action: 'plant-native-seedling', label: 'E · PLANTAR MUDA NATIVA' };
      if (!this.forestSpringProtected && dist(this.forestSpringPosition) <= 7.5) return { action: 'protect-forest-spring', label: 'E · PROTEGER A NASCENTE E A MATA CILIAR' };
      if (!this.forestWildlifeRecorded && dist(this.forestWildlifePosition) <= 7.5) return { action: 'record-forest-wildlife', label: 'E · REGISTRAR A FAUNA NO MONITORAMENTO' };
    }
    return null;
  }

  private buildForestSeedling(index: number): void {
    const site = this.forestSeedlingPositions[index]; if (!site) return;
    const start = this.scene.meshes.length;
    const trunk = MeshBuilder.CreateCylinder('forest-planted-seedling-trunk-' + index, { height: 1.35, diameterTop: 0.06, diameterBottom: 0.16, tessellation: 7 }, this.scene);
    trunk.position.set(site.x, 0.7, site.z); trunk.material = this.material('forest-planted-seedling-trunk-material-' + index, new Color3(0.34, 0.22, 0.12));
    const crown = MeshBuilder.CreateSphere('forest-planted-seedling-crown-' + index, { diameter: 1.15, segments: 7 }, this.scene);
    crown.position.set(site.x, 1.45, site.z); crown.material = this.material('forest-planted-seedling-crown-material-' + index, new Color3(0.18, 0.48, 0.22));
    this.phaseFourDynamicMeshes.push(...this.scene.meshes.slice(start) as Mesh[]);
  }

  private buildForestSpringRecovery(): void {
    const start = this.scene.meshes.length;
    for (let i = 0; i < 8; i++) {
      const angle = Math.PI * 2 * i / 8;
      const reed = MeshBuilder.CreateCylinder('forest-spring-recovery-reed-' + i, { height: 1.15, diameterTop: 0.05, diameterBottom: 0.13, tessellation: 6 }, this.scene);
      reed.position.set(2 + Math.cos(angle) * 4.2, 0.57, -8 + Math.sin(angle) * 3.2);
      reed.rotation.z = Math.cos(angle) * 0.12; reed.material = this.material('forest-spring-reed-material-' + i, new Color3(0.22, 0.48, 0.24));
    }
    this.phaseFourDynamicMeshes.push(...this.scene.meshes.slice(start) as Mesh[]);
  }

  private checkForestCompletion(): void {
    if (this.forestSeedlingsPlanted.every(Boolean) && this.forestSpringProtected && this.forestWildlifeRecorded && this.forestFirePreventionInspected) {
      this.forestMissionStage = 'complete'; this.cit += 60;
      this.message = 'Reserva Florestal recuperada no cenário educativo! Você conectou biodiversidade, agricultura familiar, indústria, consumo responsável, cooperativa e restauração ecológica.';
    }
  }

  private performForestAction(action: NearbyAction): void {
    if (action === 'inspect-forest-habitat') {
      const i = this.forestHabitatPositions.findIndex((site, index) => !this.forestHabitatsInspected[index] && Math.hypot(this.player.position.x - site.x, this.player.position.z - site.z) <= 6.5);
      if (i < 0) { this.message = 'Aproxime-se de um dos fragmentos de habitat sinalizados.'; this.emit(); return; }
      this.forestHabitatsInspected[i] = true;
      const marker = this.forestHabitatMarkers[i]; if (marker) (marker.material as StandardMaterial).emissiveColor = new Color3(0.12, 0.28, 0.11);
      if (this.forestHabitatsInspected.every(Boolean)) {
        this.forestMissionStage = 'harvest';
        this.message = 'Diagnóstico concluído. Você identificou três fragmentos de habitat. Agora conheça a agricultura familiar e colha os produtos da comunidade.';
      } else this.message = 'Habitat registrado (' + this.forestHabitatsInspected.filter(Boolean).length + '/3). Procure os outros fragmentos.';
      this.emit(); return;
    }
    if (action === 'harvest-farm-produce') {
      const i = this.forestProducePositions.findIndex((site, index) => !this.forestProduceHarvested[index] && Math.hypot(this.player.position.x - site.x, this.player.position.z - site.z) <= 4.2);
      if (i < 0) { this.message = 'Aproxime-se de uma caixa de colheita na propriedade familiar.'; this.emit(); return; }
      this.forestProduceHarvested[i] = true; this.forestProduceCrates[i]?.setEnabled(false);
      const count = this.forestProduceHarvested.filter(Boolean).length;
      if (count === 3) {
        this.forestMissionStage = 'transport';
        this.message = 'Colheita organizada! A família separou os produtos. O caminhoneiro vai coletar as caixas e levá-las à agroindústria.';
      } else this.message = 'Caixa de produção colhida (' + count + '/3). Continue pela área de cultivo.';
      this.emit(); return;
    }
    if (action === 'load-farm-truck') {
      if (this.forestProduceHarvested.some((value) => !value) || this.forestTruckLoaded) { this.message = 'Conclua a colheita antes de carregar o caminhão.'; this.emit(); return; }
      this.forestTruckLoaded = true; this.forestTruckTraveling = true;
      this.forestTruckTarget = this.forestFactoryDeliveryPosition.clone(); this.forestTruckDestination = 'factory';
      this.message = 'Carga conferida! O caminhoneiro saiu da propriedade e leva os alimentos à agroindústria. Acompanhe a chegada na doca.';
      this.emit(); return;
    }
    if (action === 'process-food-products') {
      this.forestProcessed = true; this.forestMissionStage = 'market';
      this.forestTruckTraveling = true; this.forestTruckTarget = this.forestMarketDeliveryPosition.clone(); this.forestTruckDestination = 'market';
      const start = this.scene.meshes.length;
      for (let i = 0; i < 5; i++) {
        const box = MeshBuilder.CreateBox('forest-packaged-food-' + i, { width: 0.9, height: 0.75, depth: 0.72 }, this.scene);
        box.position.set(22 + (i % 3) * 1.5, 0.42, -16 + Math.floor(i / 3) * 1.2);
        box.material = this.material('forest-packaged-food-material-' + i, i % 2 ? new Color3(0.88, 0.79, 0.56) : new Color3(0.82, 0.84, 0.74));
      }
      this.phaseFourDynamicMeshes.push(...this.scene.meshes.slice(start) as Mesh[]);
      this.message = 'A agroindústria processou e embalou os alimentos. Agora o caminhão leva os produtos ao mercado local.';
      this.emit(); return;
    }
    if (action === 'stock-local-market') {
      this.forestMarketStocked = true; this.forestMissionStage = 'sorting';
      this.message = 'Produtos recebidos e expostos. Após o consumo, embalagens limpas devem ser separadas; resíduos orgânicos seguem à compostagem, não à cooperativa de recicláveis.';
      this.emit(); return;
    }
    if (action === 'sort-consumer-packaging') {
      const i = this.forestPackagingPositions.findIndex((site, index) => !this.forestPackagingSorted[index] && Math.hypot(this.player.position.x - site.x, this.player.position.z - site.z) <= 4.5);
      if (i < 0) { this.message = 'Aproxime-se de uma baia do ponto pós-consumo.'; this.emit(); return; }
      this.forestPackagingSorted[i] = true;
      const bin = this.forestPackagingBins[i]; if (bin) bin.emissiveColor = new Color3(0.12, 0.2, 0.12);
      const count = this.forestPackagingSorted.filter(Boolean).length;
      if (count === this.forestPackagingSorted.length) {
        this.forestMissionStage = 'cooperative';
        this.message = 'Separação concluída! Papel, plástico, vidro e metal seguem à Cooperativa Raízes da Floresta para triagem; orgânicos vão à compostagem e rejeitos seguem à destinação municipal adequada. A cooperativa não faz a reciclagem industrial.';
      } else {
        const routeMessage = [
          'Papel e papelão limpos seguem à cooperativa para triagem.',
          'Plásticos identificados seguem à cooperativa para separação por tipo.',
          'Vidros seguem à triagem específica; não misture cerâmica, louça ou espelhos sem orientação local.',
          'Metais seguem à triagem e preparação para encaminhamento.',
          'Orgânicos ficam em recipiente próprio. Pode haver composteira doméstica ou balde exclusivo de um serviço de coleta de orgânicos; a frequência é definida pelo prestador conforme volume e rota. Nunca misture com os recicláveis secos.',
          'Rejeitos não recicláveis ou contaminados inseparáveis seguem à coleta de rejeitos, conforme o serviço local.',
        ][i];
        this.message = routeMessage + ' (' + count + '/' + this.forestPackagingSorted.length + ' categorias separadas).';
      }
      this.emit(); return;
    }
    if (action === 'deliver-forest-cooperative') {
      this.forestCooperativeDelivered = true; this.forestMissionStage = 'restore';
      this.message = 'A Cooperativa Raízes da Floresta recebeu papel, plástico, vidro e metal. Os cooperados conferem, separam, preparam e encaminham os materiais; a indústria recicladora faz a transformação em novos insumos/produtos. Orgânicos e rejeitos não entram nesta carga. Agora volte à reserva para restaurar habitats e proteger a nascente.';
      this.emit(); return;
    }
    if (action === 'plant-native-seedling') {
      const i = this.forestSeedlingPositions.findIndex((site, index) => !this.forestSeedlingsPlanted[index] && Math.hypot(this.player.position.x - site.x, this.player.position.z - site.z) <= 4.8);
      if (i < 0) { this.message = 'Aproxime-se de um local preparado para restauração.'; this.emit(); return; }
      this.forestSeedlingsPlanted[i] = true; this.forestSeedlingMarkers[i]?.setEnabled(false); this.buildForestSeedling(i);
      this.message = 'Muda nativa plantada (' + this.forestSeedlingsPlanted.filter(Boolean).length + '/3). Use espécies adequadas ao ecossistema local e acompanhe sua sobrevivência.';
      this.checkForestCompletion(); this.emit(); return;
    }
    if (action === 'protect-forest-spring') {
      this.forestSpringProtected = true; this.buildForestSpringRecovery();
      this.message = 'Nascente protegida no cenário. A vegetação ciliar ajuda a estabilizar margens, reter sedimentos e manter habitats.';
      this.checkForestCompletion(); this.emit(); return;
    }
    if (action === 'inspect-forest-fire-prevention') {
      this.forestFirePreventionInspected = true;
      this.message = 'Prevenção registrada: monitorar condições de risco, evitar queimadas, manter alerta e comunicar fumaça ou foco de incêndio às equipes responsáveis. O combate deve ser feito por brigadas capacitadas, com segurança.';
      this.checkForestCompletion(); this.emit(); return;
    }
    if (action === 'record-forest-wildlife') {
      this.forestWildlifeRecorded = true;
      this.message = 'Registro da fauna concluído sem perturbar os animais. O monitoramento repetido ajuda a avaliar a resposta do habitat.';
      this.checkForestCompletion(); this.emit(); return;
    }
  }

  private buildMatureCommunityCompost(): void {
    const pile = MeshBuilder.CreateSphere('periphery-mature-compost-pile', { diameter: 2.3, segments: 9 }, this.scene);
    pile.position.set(this.peripheryCompostPosition.x, 1.18, this.peripheryCompostPosition.z - 0.35);
    pile.scaling.set(1.75, 0.48, 0.95); pile.material = this.material('periphery-mature-compost-material', new Color3(0.15, 0.11, 0.07));
    this.peripheryDynamicMeshes.push(pile);
    for (let i = 0; i < 5; i++) {
      const x = -37.9 + i * 0.95; const z = 10 + (i % 2) * 0.72;
      const stem = MeshBuilder.CreateCylinder('periphery-compost-garden-stem-' + i, { height: 0.72, diameterTop: 0.05, diameterBottom: 0.10, tessellation: 6 }, this.scene);
      stem.position.set(x, 0.85, z); stem.material = this.material('periphery-compost-garden-stem-material-' + i, new Color3(0.18, 0.39, 0.17));
      this.peripheryDynamicMeshes.push(stem);
      for (let leaf = 0; leaf < 3; leaf++) {
        const foliage = MeshBuilder.CreateSphere('periphery-compost-garden-leaf-' + i + '-' + leaf, { diameter: 0.68, segments: 7 }, this.scene);
        foliage.position.set(x + (leaf - 1) * 0.22, 1.0 + (leaf % 2) * 0.12, z + 0.12);
        foliage.scaling.set(1, 0.24, 0.55); foliage.material = this.material('periphery-compost-garden-leaf-material-' + i, new Color3(0.18, 0.48, 0.20));
        this.peripheryDynamicMeshes.push(foliage);
      }
      const fruit = MeshBuilder.CreateSphere('periphery-compost-garden-tomato-' + i, { diameter: 0.28, segments: 7 }, this.scene);
      fruit.position.set(x + 0.1, 0.93, z + 0.34); fruit.material = this.material('periphery-compost-garden-tomato-material-' + i, new Color3(0.80, 0.22, 0.13));
      this.peripheryDynamicMeshes.push(fruit);
    }
    for (let i = 0; i < 4; i++) {
      const x = -23.9 + i * 1.25; const z = 9.4 + (i % 2) * 0.9;
      const stem = MeshBuilder.CreateCylinder('periphery-compost-flower-stem-' + i, { height: 0.9, diameter: 0.08, tessellation: 6 }, this.scene);
      stem.position.set(x, 0.95, z); stem.material = this.material('periphery-compost-flower-stem-material-' + i, new Color3(0.17, 0.43, 0.17));
      this.peripheryDynamicMeshes.push(stem);
      for (let petal = 0; petal < 5; petal++) {
        const angle = Math.PI * 2 * petal / 5;
        const bloom = MeshBuilder.CreateSphere('periphery-compost-flower-petal-' + i + '-' + petal, { diameter: 0.26, segments: 6 }, this.scene);
        bloom.position.set(x + Math.cos(angle) * 0.20, 1.45, z + Math.sin(angle) * 0.20);
        bloom.material = this.material('periphery-compost-flower-petal-material-' + i, i % 2 ? new Color3(0.89, 0.63, 0.19) : new Color3(0.78, 0.40, 0.67));
        this.peripheryDynamicMeshes.push(bloom);
      }
      const center = MeshBuilder.CreateSphere('periphery-compost-flower-center-' + i, { diameter: 0.22, segments: 6 }, this.scene);
      center.position.set(x, 1.46, z); center.material = this.material('periphery-compost-flower-center-material-' + i, new Color3(0.91, 0.75, 0.23));
      this.peripheryDynamicMeshes.push(center);
    }
  }

  private buildCommunitySewerConnection(index: number): void {
    const site = this.peripherySewerPositions[index]; if (!site) return;
    const pipe = MeshBuilder.CreateTube('periphery-house-sewer-connection-' + index, {
      path: [new Vector3(site.x, 0.34, site.z), new Vector3(14, 0.34, site.z), new Vector3(7, 0.34, site.z), new Vector3(7, 0.34, -20)],
      radius: 0.16, tessellation: 8,
    }, this.scene);
    pipe.material = this.material('periphery-house-sewer-connection-material-' + index, new Color3(0.58, 0.65, 0.53));
    this.peripheryDynamicMeshes.push(pipe);
  }

  private buildCommunityRainGarden(): void {
    const x = this.peripheryRainGardenPosition.x; const z = this.peripheryRainGardenPosition.z;
    const basin = MeshBuilder.CreateGround('periphery-rain-garden-basin', { width: 12.5, height: 8.5 }, this.scene);
    basin.position.set(x, 0.055, z); basin.material = this.material('periphery-rain-garden-soil', new Color3(0.31, 0.25, 0.16));
    this.peripheryDynamicMeshes.push(basin);
    for (let i = 0; i < 9; i++) {
      const angle = (Math.PI * 2 * i) / 9;
      const plant = MeshBuilder.CreateSphere('periphery-rain-garden-native-plant-' + i, { diameter: 0.95, segments: 7 }, this.scene);
      plant.position.set(x + Math.cos(angle) * 3.7, 0.56, z + Math.sin(angle) * 2.2);
      plant.scaling.set(0.65, 1.1, 0.65);
      plant.material = this.material('periphery-rain-garden-native-plant-material-' + i,
        i % 2 ? new Color3(0.20, 0.49, 0.24) : new Color3(0.34, 0.57, 0.26));
      this.peripheryDynamicMeshes.push(plant);
    }
  }

  private getNearbyPeripheryInteraction(): { action: NearbyAction; label: string } | null {
    if (this.learningNotice) return null;
    if (this.peripheryMissionStage === 'survey') {
      if (this.peripheryIssuePositions.some((site, index) => !this.peripheryIssueInspected.has(index)
        && Math.hypot(this.player.position.x - site.x, this.player.position.z - site.z) <= 6.2)) {
        return { action: 'inspect-neighborhood-issue', label: 'E · INVESTIGAR PONTO DO BAIRRO' };
      }
    }
    if (this.peripheryMissionStage === 'collect') {
      const index = this.peripheryWastePiles.findIndex((pile, itemIndex) => !this.peripheryWasteCollected[itemIndex]
        && pile.isEnabled() && Math.hypot(this.player.position.x - pile.position.x, this.player.position.z - pile.position.z) <= 3.8);
      if (index >= 0) return { action: 'collect-community-waste', label: 'E · RECOLHER ' + PERIPHERY_WASTE_CATALOG[index].name.toUpperCase() };
    }
    if (this.peripheryMissionStage === 'sorting') {
      const organicDistance = Math.hypot(this.player.position.x - this.peripheryCompostPosition.x, this.player.position.z - this.peripheryCompostPosition.z);
      const dryDistance = Math.hypot(this.player.position.x - this.peripheryRecyclingDropPosition.x, this.player.position.z - this.peripheryRecyclingDropPosition.z);
      const organicIndex = PERIPHERY_WASTE_CATALOG.findIndex((item, index) => item.kind === 'organic'
        && this.peripheryWasteCollected[index] && !this.peripheryOrganicDeposited[PERIPHERY_WASTE_CATALOG.slice(0, index).filter((entry) => entry.kind === 'organic').length]);
      const recyclableIndex = PERIPHERY_WASTE_CATALOG.findIndex((item, index) => item.kind === 'recyclable'
        && index < 2 + this.peripheryRecyclableTotal
        && this.peripheryWasteCollected[index] && !this.peripheryRecyclableDeposited[PERIPHERY_WASTE_CATALOG.slice(0, index).filter((entry) => entry.kind === 'recyclable').length]);
      if (organicIndex >= 0 && organicDistance <= 6.3) return { action: 'sort-community-organics', label: 'E · COLOCAR ' + PERIPHERY_WASTE_CATALOG[organicIndex].name.toUpperCase() + ' NA COMPOSTEIRA' };
      if (recyclableIndex >= 0 && dryDistance <= 6.3) return { action: 'sort-community-recyclables', label: 'E · COLOCAR ' + PERIPHERY_WASTE_CATALOG[recyclableIndex].name.toUpperCase() + ' NA COLETA SELETIVA' };
    }
    if (this.peripheryMissionStage === 'compost' && Math.hypot(this.player.position.x - this.peripheryCompostPosition.x, this.player.position.z - this.peripheryCompostPosition.z) <= 7) {
      return { action: 'turn-community-compost', label: 'E · AREJAR A COMPOSTEIRA E VER O COMPOSTO' };
    }
    if (this.peripheryMissionStage === 'sanitation' && this.peripherySewerPositions.some((site, index) => !this.peripherySewerConnected[index] && Math.hypot(this.player.position.x - site.x, this.player.position.z - site.z) <= 6.3)) {
      return { action: 'connect-community-sewer', label: 'E · CONECTAR ESGOTO À REDE' };
    }
    if (this.peripheryMissionStage === 'rain-garden' && Math.hypot(this.player.position.x - this.peripheryRainGardenPosition.x, this.player.position.z - this.peripheryRainGardenPosition.z) <= 7.2) {
      return { action: 'build-rain-garden', label: 'E · IMPLANTAR JARDIM DE CHUVA' };
    }
    return null;
  }
  private performPeripheryAction(action: NearbyAction): void {
    if (action === 'inspect-neighborhood-issue') {
      const index = this.peripheryIssuePositions.findIndex((site, itemIndex) => !this.peripheryIssueInspected.has(itemIndex) && Math.hypot(this.player.position.x - site.x, this.player.position.z - site.z) <= 6.2);
      if (index < 0) { this.message = 'Aproxime-se de um dos três pontos sinalizados para investigar o bairro.'; this.emit(); return; }
      this.peripheryIssueInspected.add(index);
      const marker = this.peripheryIssueMarkers[index];
      if (marker) marker.material = this.material('periphery-issue-inspected-' + index, new Color3(0.18, 0.61, 0.42));
      if (this.peripheryIssueInspected.size === this.peripheryIssuePositions.length) {
        this.peripheryMissionStage = 'collect';
        this.message = 'Diagnóstico concluído. Recolha cinco objetos: duas sobras de alimentos e três embalagens recicláveis. Cada item vai mostrar seu tipo e destino.';
      } else this.message = 'Ponto investigado (' + this.peripheryIssueInspected.size + '/3). Procure os outros marcadores amarelos.';
      this.emit(); return;
    }
    if (action === 'collect-community-waste') {
      const index = this.peripheryWastePiles.findIndex((pile, itemIndex) => !this.peripheryWasteCollected[itemIndex] && pile.isEnabled()
        && Math.hypot(this.player.position.x - pile.position.x, this.player.position.z - pile.position.z) <= 3.8);
      if (index < 0) { this.message = 'Aproxime-se de um dos objetos de resíduo para identificá-lo e recolhê-lo.'; this.emit(); return; }
      this.peripheryWasteCollected[index] = true; this.peripheryWastePiles[index].setEnabled(false);
      const item = PERIPHERY_WASTE_CATALOG[index]; const count = this.peripheryWasteCollected.filter(Boolean).length;
      this.message = item.name + ' recolhido. É ' + item.category.toLowerCase() + '. Confira a explicação e leve ao destino indicado.';
      this.showLearningNotice(item.category, item.icon + ' Você recolheu: ' + item.name, item.description, item.destination, item.afterwards);
      if (count === this.peripheryWasteTotal) {
        this.peripheryMissionStage = 'sorting';
        this.message = 'Os cinco objetos foram recolhidos. Agora coloque as duas sobras de alimento na composteira e os três recicláveis no recipiente azul, um por vez.';
      }
      this.emit(); return;
    }
    if (action === 'sort-community-organics') {
      const index = PERIPHERY_WASTE_CATALOG.findIndex((item, itemIndex) => item.kind === 'organic' && this.peripheryWasteCollected[itemIndex]
        && !this.peripheryOrganicDeposited[PERIPHERY_WASTE_CATALOG.slice(0, itemIndex).filter((entry) => entry.kind === 'organic').length]);
      if (index < 0) { this.message = 'Não há outro resíduo orgânico recolhido aguardando a composteira.'; this.emit(); return; }
      const slot = PERIPHERY_WASTE_CATALOG.slice(0, index).filter((item) => item.kind === 'organic').length;
      this.peripheryOrganicDeposited[slot] = true;
      const site = { x: this.peripheryCompostPosition.x - 1.55 + slot * 2.9, z: this.peripheryCompostPosition.z - 0.45 };
      const deposited = this.createPeripheryWasteModel(index, site, 'periphery-organic-deposited', 1.12);
      this.peripheryOrganicDepositMeshes.push(deposited); this.peripheryDynamicMeshes.push(deposited);
      this.peripheryOrganicsSorted = this.peripheryOrganicDeposited.every(Boolean);
      const item = PERIPHERY_WASTE_CATALOG[index];
      this.message = item.name + ' colocado na composteira. A mistura precisa de materiais secos, umidade, oxigênio e tempo para virar composto maturado.';
      this.showLearningNotice('DESTINO CORRETO · COMPOSTEIRA', item.icon + ' ' + item.name + ' entrou na composteira',
        'Você colocou um resíduo orgânico no local correto. Ele não deve ser jogado diretamente no canteiro nem misturado com plástico, metal ou vidro. Na composteira, restos de alimento são misturados com materiais secos, como folhas e podas.',
        'COMPOSTEIRA — a mistura recebe ar e umidade em quantidade adequada. Microrganismos e outros decompositores transformam a matéria orgânica gradualmente.',
        'Depois de um período de decomposição e maturação, o composto pode ser usado para melhorar o solo dos canteiros de hortaliças, flores e outras plantas. O composto precisa estar maturado antes de ir para o plantio.');
      if (this.peripheryOrganicsSorted && this.peripheryRecyclablesSorted) this.peripheryMissionStage = 'compost';
      this.emit(); return;
    }
    if (action === 'sort-community-recyclables') {
      const index = PERIPHERY_WASTE_CATALOG.findIndex((item, itemIndex) => item.kind === 'recyclable' && itemIndex < 2 + this.peripheryRecyclableTotal && this.peripheryWasteCollected[itemIndex]
        && !this.peripheryRecyclableDeposited[PERIPHERY_WASTE_CATALOG.slice(0, itemIndex).filter((entry) => entry.kind === 'recyclable').length]);
      if (index < 0) { this.message = 'Não há outro reciclável recolhido aguardando a coleta seletiva.'; this.emit(); return; }
      const slot = PERIPHERY_WASTE_CATALOG.slice(0, index).filter((item) => item.kind === 'recyclable').length;
      this.peripheryRecyclableDeposited[slot] = true;
      const site = { x: this.peripheryRecyclingDropPosition.x - 1.25 + slot * 1.2, z: this.peripheryRecyclingDropPosition.z - 0.35 };
      const deposited = this.createPeripheryWasteModel(index, site, 'periphery-recyclable-deposited', 0.45);
      deposited.scaling.setAll(0.72); this.peripheryRecyclableDepositMeshes.push(deposited); this.peripheryDynamicMeshes.push(deposited);
      this.peripheryRecyclablesSorted = this.peripheryRecyclableDeposited.every(Boolean);
      const item = PERIPHERY_WASTE_CATALOG[index];
      this.message = item.name + ' encaminhado à coleta seletiva. Recicláveis secos seguem para triagem e encaminhamento; não vão para a composteira.';
      this.showLearningNotice('DESTINO CORRETO · COLETA SELETIVA', item.icon + ' ' + item.name + ' foi separado',
        'Você identificou um material reciclável. Manter o item vazio, limpo e seco ajuda a evitar contaminação dos demais materiais. Vidro deve estar inteiro; não recolha nem manipule cacos.',
        'RECICLÁVEIS SECOS — o recipiente azul representa a coleta seletiva. Depois, o serviço local encaminha os materiais à triagem, onde plástico, metal e vidro são separados por tipo.',
        'A cooperativa pode receber e preparar materiais conforme sua estrutura e o sistema local. A reciclagem ainda depende do transporte, beneficiamento e da indústria que efetivamente transforma o material.');
      if (this.peripheryOrganicsSorted && this.peripheryRecyclablesSorted) this.peripheryMissionStage = 'compost';
      this.emit(); return;
    }
    if (action === 'turn-community-compost') {
      if (this.peripheryCompostTurned) { this.message = 'A etapa simulada de compostagem já foi acompanhada.'; this.emit(); return; }
      this.peripheryCompostTurned = true; this.buildMatureCommunityCompost();
      this.peripheryMissionStage = 'sanitation'; this.cit += 25;
      this.message = 'A composteira foi arejada e o cenário mostra o composto maturado sendo levado aos canteiros. No mundo real, a transformação leva tempo e exige acompanhamento.';
      this.showLearningNotice('COMPOSTAGEM · CICLO DO ORGÂNICO', 'O composto retorna ao solo e ajuda novas plantas',
        'Restos de frutas e cascas não viram adubo na mesma hora. Eles passam por decomposição dentro da composteira, com mistura de materiais úmidos e secos, oxigênio e umidade controlada.',
        'COMPOSTO MATURADO — quando o processo termina e o material está adequado, ele pode ser aplicado ao solo como composto orgânico. Não use resíduos frescos diretamente nas raízes das plantas.',
        'No canteiro ao lado, o composto ajuda a melhorar a estrutura do solo e devolver nutrientes. As plantas crescem, produzem folhas, flores e alimentos, e novos restos vegetais podem voltar ao ciclo.');
      this.emit(); return;
    }
    if (action === 'connect-community-sewer') {
      const index = this.peripherySewerPositions.findIndex((site, itemIndex) => !this.peripherySewerConnected[itemIndex]
        && Math.hypot(this.player.position.x - site.x, this.player.position.z - site.z) <= 6.3);
      if (index < 0) { this.message = 'Aproxime-se de uma moradia sinalizada para conectar o esgoto.'; this.emit(); return; }
      this.peripherySewerConnected[index] = true; this.buildCommunitySewerConnection(index);
      const count = this.peripherySewerConnected.filter(Boolean).length;
      if (count === this.peripherySewerConnected.length) {
        this.peripheryMissionStage = 'rain-garden';
        this.message = 'As duas moradias foram ligadas à rede de esgoto sanitário. Essa rede é diferente da drenagem da chuva. Agora implante um jardim de chuva no ponto de escoamento indicado.';
      } else this.message = 'Ligação sanitária ' + count + '/2 concluída. Verifique a outra moradia.';
      this.emit(); return;
    }
    if (action === 'build-rain-garden') {
      if (this.peripheryRainGardenBuilt) { this.message = 'O jardim de chuva já foi implantado.'; this.emit(); return; }
      this.peripheryRainGardenBuilt = true; this.buildCommunityRainGarden();
      this.peripheryWaterQuality = Math.min(100, this.peripheryWaterQuality + 26);
      this.peripheryMissionStage = 'complete'; this.cit += 25;
      this.message = 'Jardim de chuva implantado! A vegetação e o solo ajudam a reter e infiltrar parte do escoamento superficial quando o local é adequado. Fase 03 concluída no cenário simulado.';
      this.emit(); return;
    }
    this.message = 'Aproxime-se do próximo objetivo indicado na missão.'; this.emit();
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

  enterPortPhase(forceForDevelopment = false): void {
    if (this.activePhase === 2) { this.setMapOpen(false); return; }
    if (!forceForDevelopment && !this.isNextNeighborhoodUnlocked()) {
      this.message = 'Conclua todas as metas do Centro Industrial para liberar o Porto.';
      this.emit();
      return;
    }
    this.activePhase = 2;
    this.phaseOneMeshes.forEach((mesh) => mesh.setEnabled(false));
    // Hide dynamically generated Phase 1 solar hardware, which is not part of the initial scene snapshot.
    this.phaseOneDynamicMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.portMeshes.forEach((mesh) => mesh.setEnabled(true));
    this.portDynamicMeshes.forEach((mesh) => mesh.setEnabled(true));
    this.peripheryMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.peripheryDynamicMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.phaseFourMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.phaseFourDynamicMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.forestTruckRoot?.setEnabled(false);
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
    this.message = forceForDevelopment
      ? 'MODO DE TESTE: Porto aberto diretamente para validação da Fase 02.'
      : 'Bem-vindo ao Porto. Inspecione os três pontos de despejo antes de escolher a solução de tratamento.';
    this.emit();
  }

  /** Abre o bairro residencial e comunitário da Fase 03. */
  enterPeripheryPhase(forceForDevelopment = false): void {
    if (this.activePhase === 3) { this.setMapOpen(false); return; }
    if (!forceForDevelopment && (this.activePhase !== 2 || !this.isNextNeighborhoodUnlocked())) {
      this.message = 'Conclua o Porto para liberar a Periferia Verde.'; this.emit(); return;
    }
    this.activePhase = 3;
    this.phaseOneMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.phaseOneDynamicMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.portMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.portDynamicMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.phaseFourMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.phaseFourDynamicMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.forestTruckRoot?.setEnabled(false);
    this.peripheryMeshes.forEach((mesh) => mesh.setEnabled(true));
    this.peripheryDynamicMeshes.forEach((mesh) => mesh.setEnabled(true));
    this.phaseOneModelRoots.forEach((root) => root.setEnabled(false));
    this.portModelRoots.forEach((root) => root.setEnabled(false));
    this.player.position.set(-35, 1, 31); this.player.setEnabled(true);
    this.inVehicle = false; this.vehicleSpeed = 0; this.keys.clear();
    this.mapOpen = false; this.paused = false;
    this.camera.setTarget(new Vector3(-35, 1.2, 31));
    this.message = forceForDevelopment
      ? 'MODO DE TESTE: Periferia Verde aberta para validação da Fase 03.'
      : 'Bem-vindo à Periferia Verde. Observe os resíduos, a água da chuva e as ligações de esgoto do bairro.';
    this.emit();
  }


  /** Abre a Reserva Florestal para campanha e testes Master. */
  enterForestPhase(forceForDevelopment = false): void {
    if (this.activePhase === 4) { this.setMapOpen(false); return; }
    if (!forceForDevelopment && (this.activePhase !== 3 || !this.isNextNeighborhoodUnlocked())) {
      this.message = 'Conclua a Periferia Verde para liberar a Reserva Florestal.'; this.emit(); return;
    }
    this.activePhase = 4;
    this.phaseOneMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.phaseOneDynamicMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.portMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.portDynamicMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.peripheryMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.peripheryDynamicMeshes.forEach((mesh) => mesh.setEnabled(false));
    this.phaseFourMeshes.forEach((mesh) => mesh.setEnabled(true));
    this.phaseFourDynamicMeshes.forEach((mesh) => mesh.setEnabled(true));
    this.forestTruckRoot?.setEnabled(true);
    this.phaseOneModelRoots.forEach((root) => root.setEnabled(false));
    this.portModelRoots.forEach((root) => root.setEnabled(false));
    this.player.position.set(-37, 1, 31); this.player.setEnabled(true);
    this.inVehicle = false; this.vehicleSpeed = 0; this.keys.clear();
    this.mapOpen = false; this.paused = false;
    this.camera.setTarget(new Vector3(-34, 1.4, 31));
    this.message = forceForDevelopment
      ? 'MODO DE TESTE: Reserva Florestal aberta para validação da Fase 04.'
      : 'Bem-vindo à Reserva Florestal. Investigue a biodiversidade e conheça a cadeia da agricultura familiar.';
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


  private createPeripheryWasteModel(index: number, site: PortSite, prefix: string, baseY = 0): Mesh {
    const root = MeshBuilder.CreateBox(prefix + '-root-' + index, { width: 0.02, height: 0.02, depth: 0.02 }, this.scene);
    const invisible = this.material(prefix + '-root-material-' + index, new Color3(1, 1, 1));
    invisible.alpha = 0; root.material = invisible; root.position.set(site.x, 0, site.z); root.isPickable = false;
    const part = (name: string, mesh: Mesh, material: StandardMaterial): Mesh => {
      mesh.name = prefix + '-' + name + '-' + index; mesh.parent = root; mesh.material = material; return mesh;
    };
    const yellow = this.material(prefix + '-banana-yellow-' + index, new Color3(0.91, 0.72, 0.20));
    const flesh = this.material(prefix + '-fruit-flesh-' + index, new Color3(0.73, 0.31, 0.14));
    const green = this.material(prefix + '-leaf-green-' + index, new Color3(0.20, 0.45, 0.19));
    const brown = this.material(prefix + '-scrap-brown-' + index, new Color3(0.34, 0.22, 0.12));
    const plastic = this.material(prefix + '-pet-material-' + index, new Color3(0.16, 0.61, 0.75)); plastic.alpha = 0.72;
    const metal = this.material(prefix + '-aluminum-material-' + index, new Color3(0.70, 0.75, 0.76));
    const glass = this.material(prefix + '-glass-material-' + index, new Color3(0.20, 0.51, 0.38)); glass.alpha = 0.62;
    const cap = this.material(prefix + '-cap-material-' + index, new Color3(0.10, 0.31, 0.49));
    if (index === 0) {
      // Casca de banana formada por três tiras curvas.
      for (let piece = 0; piece < 3; piece++) {
        const strip = part('banana-peel-strip-' + piece, MeshBuilder.CreateSphere('banana-strip', { diameter: 0.78, segments: 8 }), yellow);
        strip.position.set(-0.26 + piece * 0.26, baseY + 0.22 + (piece === 1 ? 0.08 : 0), piece === 1 ? 0.08 : -0.05);
        strip.scaling.set(0.72, 0.13, 0.25); strip.rotation.z = piece === 0 ? -0.22 : piece === 2 ? 0.22 : 0;
      }
      const stem = part('banana-stem', MeshBuilder.CreateCylinder('banana-stem', { height: 0.24, diameter: 0.12, tessellation: 6 }), brown);
      stem.position.set(-0.55, baseY + 0.24, -0.02); stem.rotation.z = Math.PI / 2;
      for (const x of [-0.59, 0.52]) {
        const tip = part('banana-tip', MeshBuilder.CreateSphere('banana-tip', { diameter: 0.16, segments: 6 }), brown);
        tip.position.set(x, baseY + 0.22, 0);
      }
    } else if (index === 1) {
      // Restos de frutas e folhas, com peças de cores distintas.
      for (let piece = 0; piece < 3; piece++) {
        const scrap = part('fruit-scrap-' + piece, MeshBuilder.CreateSphere('fruit-scrap', { diameter: 0.58, segments: 8 }), piece === 1 ? green : flesh);
        scrap.position.set(-0.32 + piece * 0.31, baseY + 0.20 + (piece % 2) * 0.08, piece === 2 ? 0.16 : -0.10);
        scrap.scaling.set(0.82, 0.20, 0.55); scrap.rotation.z = (piece - 1) * 0.28;
      }
      const leaf = part('fruit-scrap-leaf', MeshBuilder.CreateSphere('fruit-leaf', { diameter: 0.38, segments: 7 }), green);
      leaf.position.set(0.32, baseY + 0.27, 0.18); leaf.scaling.set(1.2, 0.10, 0.45);
    } else if (index === 2) {
      // Garrafa PET com corpo, ombro, gargalo e tampa.
      const body = part('pet-bottle-body', MeshBuilder.CreateCylinder('pet-body', { height: 0.95, diameter: 0.42, tessellation: 12 }), plastic);
      body.position.set(0, baseY + 0.52, 0);
      const shoulder = part('pet-bottle-shoulder', MeshBuilder.CreateSphere('pet-shoulder', { diameter: 0.42, segments: 10 }), plastic);
      shoulder.position.set(0, baseY + 1.00, 0); shoulder.scaling.set(1, 0.42, 1);
      const neck = part('pet-bottle-neck', MeshBuilder.CreateCylinder('pet-neck', { height: 0.25, diameter: 0.18, tessellation: 10 }), plastic);
      neck.position.set(0, baseY + 1.13, 0);
      const lid = part('pet-bottle-cap', MeshBuilder.CreateCylinder('pet-cap', { height: 0.13, diameter: 0.22, tessellation: 10 }), cap);
      lid.position.set(0, baseY + 1.31, 0);
    } else if (index === 3) {
      // Lata de alumínio com borda superior visível.
      const body = part('aluminum-can-body', MeshBuilder.CreateCylinder('can-body', { height: 0.88, diameter: 0.58, tessellation: 14 }), metal);
      body.position.set(0, baseY + 0.46, 0);
      const top = part('aluminum-can-top', MeshBuilder.CreateCylinder('can-top', { height: 0.06, diameter: 0.56, tessellation: 14 }), this.material(prefix + '-can-top-' + index, new Color3(0.83, 0.85, 0.84)));
      top.position.set(0, baseY + 0.92, 0);
      const rim = part('aluminum-can-rim', MeshBuilder.CreateTorus('can-rim', { diameter: 0.5, thickness: 0.055, tessellation: 14 }), metal);
      rim.position.set(0, baseY + 0.94, 0);
    } else {
      // Garrafa de vidro inteira, sem representar cacos como item coletável.
      const body = part('glass-bottle-body', MeshBuilder.CreateCylinder('glass-body', { height: 0.78, diameter: 0.52, tessellation: 14 }), glass);
      body.position.set(0, baseY + 0.41, 0);
      const shoulder = part('glass-bottle-shoulder', MeshBuilder.CreateSphere('glass-shoulder', { diameter: 0.52, segments: 10 }), glass);
      shoulder.position.set(0, baseY + 0.80, 0); shoulder.scaling.set(1, 0.42, 1);
      const neck = part('glass-bottle-neck', MeshBuilder.CreateCylinder('glass-neck', { height: 0.31, diameter: 0.22, tessellation: 10 }), glass);
      neck.position.set(0, baseY + 1.03, 0);
      const lip = part('glass-bottle-lip', MeshBuilder.CreateCylinder('glass-lip', { height: 0.09, diameter: 0.27, tessellation: 10 }), glass);
      lip.position.set(0, baseY + 1.22, 0);
    }
    return root;
  }

  private showLearningNotice(eyebrow: string, title: string, description: string, destination: string, afterwards: string): void {
    this.learningNoticeSequence += 1;
    this.learningNotice = { id: this.learningNoticeSequence, eyebrow, title, description, destination, afterwards };
  }

  dismissLearningNotice(): void {
    if (!this.learningNotice) return;
    this.learningNotice = null;
    this.emit();
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
    const truckDistance = Math.hypot(this.player.position.x - this.portTruck.position.x, this.player.position.z - this.portTruck.position.z);
    if (truckDistance <= PORT_TRUCK_ENTRY_DISTANCE) return { action: 'enter-vehicle', label: 'F · ENTRAR NO CAMINHÃO DE COLETA' };
    return null;
  }

  private installPortTreatment(): void {
    if (this.portTreatmentInstalled) return;
    const dynamicStartIndex = this.scene.meshes.length;
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
    this.portDynamicMeshes.push(...this.scene.meshes.slice(dynamicStartIndex) as Mesh[]);
    this.message = 'ETE implantada! Os efluentes industriais agora passam por tratamento. Instale duas fossas sépticas nas instalações sanitárias isoladas do porto.';
    this.emit();
  }

  private installPortSeptic(): void {
    const dynamicStartIndex = this.scene.meshes.length;
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
    this.portDynamicMeshes.push(...this.scene.meshes.slice(dynamicStartIndex) as Mesh[]);
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
    const dynamicStartIndex = this.scene.meshes.length;
    const supportMaterial = this.material('ev-base-solar-canopy-support-material', new Color3(0.32, 0.39, 0.36));
    const baseMaterial = this.material('ev-base-solar-canopy-base-material', new Color3(0.19, 0.25, 0.22));

    // Steel columns, perimeter beams and cross-rails physically support the canopy panels.
    for (const x of [27.15, 35.0]) {
      for (const z of [19.5, 27.5]) {
        const post = MeshBuilder.CreateBox('ev-base-solar-canopy-post', { width: 0.18, height: 4.0, depth: 0.18 }, this.scene);
        post.position.set(x, 2.0, z);
        post.material = supportMaterial;
        const foot = MeshBuilder.CreateBox('ev-base-solar-canopy-foot', { width: 0.52, height: 0.12, depth: 0.52 }, this.scene);
        foot.position.set(x, 0.12, z);
        foot.material = baseMaterial;
      }
    }
    for (const z of [19.5, 27.5]) {
      const beam = MeshBuilder.CreateBox('ev-base-solar-canopy-perimeter-beam', { width: 8.0, height: 0.18, depth: 0.20 }, this.scene);
      beam.position.set(31.075, 4.02, z);
      beam.material = supportMaterial;
    }
    for (const x of [28.5, 31.0, 33.5]) {
      const rail = MeshBuilder.CreateBox('ev-base-solar-canopy-cross-rail', { width: 0.16, height: 0.16, depth: 7.7 }, this.scene);
      rail.position.set(x, 4.10, 23.5);
      rail.material = supportMaterial;
    }

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
    this.phaseOneDynamicMeshes.push(...this.scene.meshes.slice(dynamicStartIndex) as Mesh[]);
  }


  /** Carrega diretamente um arquivo GLB estático de /public/models. */
  private async loadModelBytes(assetName: string): Promise<ArrayBuffer> {
    const response = await fetch(`/models/${assetName}?v=0.4.13`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status} ao carregar o modelo ${assetName}.`);
    const bytes = await response.arrayBuffer();
    const signature = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
    // Vercel/CDN may transparently decompress .gz files. Detect gzip first.
    if (signature.length === 2 && signature[0] === 0x1f && signature[1] === 0x8b) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('Este navegador não oferece descompactação gzip para os modelos 3D.');
      }
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).arrayBuffer();
    }
    return bytes;
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
      const glbBytes = await this.loadModelBytes('personagem.glb.gz');
      const fallbackParts = this.player.getChildMeshes();
      objectUrl = URL.createObjectURL(new Blob([glbBytes], { type: 'model/gltf-binary' }));

      const imported = await ImportMeshAsync(objectUrl, this.scene, { pluginExtension: '.glb' });
      const modelRoot = imported.meshes.find((mesh) => mesh.name === '__root__') ?? imported.meshes[0];
      if (!modelRoot) throw new Error('O arquivo GLB não retornou uma malha principal.');

      // Keep the transform supplied by the glTF importer. It may contain the axis
      // conversion that defines which side of the imported model is its actual front.
      // A separate heading pivot lets gameplay rotate the character without erasing it.
      modelRoot.parent = null;
      modelRoot.computeWorldMatrix(true);
      const importedForward = Vector3.TransformNormal(
        new Vector3(0, 0, 1),
        modelRoot.getWorldMatrix(),
      );
      const horizontalImportedForward = new Vector3(importedForward.x, 0, importedForward.z);
      if (horizontalImportedForward.lengthSquared() > 1e-6) {
        horizontalImportedForward.normalize();
        this.playerModelHeadingOffset = Math.atan2(horizontalImportedForward.x, horizontalImportedForward.z);
      } else {
        this.playerModelHeadingOffset = 0;
      }

      const headingRoot = new TransformNode('player-model-heading-pivot', this.scene);
      headingRoot.position.set(this.player.position.x, this.player.position.y - 1, this.player.position.z);
      modelRoot.parent = headingRoot;
      modelRoot.scaling.scaleInPlace(0.82);
      modelRoot.isPickable = false;
      this.playerModelHeadingRoot = headingRoot;

      this.playerArms.length = 0;
      this.playerLegs.length = 0;
      for (const part of imported.meshes) {
        if (!(part instanceof Mesh) || part === modelRoot) continue;
        part.isPickable = false;
        part.checkCollisions = false;
        if (part.name === 'UpperArm_L' || part.name === 'UpperArm_R') {
          const side = part.name.endsWith('_L') ? -1 : 1;
          part.rotationQuaternion = null;
          part.setPivotPoint(new Vector3(side * 0.36, 1.55, 0));
          this.playerArms.push(part);
        } else if (part.name === 'Trouser_L_Thigh' || part.name === 'Trouser_R_Thigh') {
          const side = part.name.includes('_L_') ? -1 : 1;
          part.rotationQuaternion = null;
          part.setPivotPoint(new Vector3(side * 0.19, 1.01, 0));
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
  private async importModel(assetName: string): Promise<{ root: AbstractMesh; meshes: AbstractMesh[] }> {
    await import('@babylonjs/loaders/glTF/2.0');
    const bytes = await this.loadModelBytes(assetName);
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
      const tree = await this.importModel('arvore.glb.gz');
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
      const building = await this.importModel('edificio.glb.gz');
      building.root.position.set(-34, 0, -31);
      building.root.scaling.setAll(0.58);
      this.phaseOneModelRoots.push(building.root);
    } catch (error) {
      console.warn('[GREEN CITY] Modelo de edifício não carregado; mantendo os edifícios do cenário.', error);
    }

    try {
      const car = await this.importModel('carro_eletrico.glb.gz');
      this.vehicleVisualRoot?.setEnabled(false);
      this.vehicleModelHeadingOffset = this.getImportedModelHeadingOffset(car.root) + Math.PI;
      const carHeadingRoot = new TransformNode('municipal-car-heading-pivot', this.scene);
      carHeadingRoot.position.set(this.vehicle.position.x, 0, this.vehicle.position.z);
      car.root.parent = carHeadingRoot;
      car.root.scaling.setAll(0.90);
      this.vehicleModelRoot = carHeadingRoot;
      this.vehicleModelPaintMaterials.length = 0;
      for (const mesh of car.meshes) {
        if (mesh instanceof Mesh && mesh.material instanceof PBRMaterial && mesh.material.name === 'green'
          && !this.vehicleModelPaintMaterials.includes(mesh.material)) {
          this.vehicleModelPaintMaterials.push(mesh.material);
        }
      }
      this.phaseOneModelRoots.push(car.root);
    } catch (error) {
      console.warn('[GREEN CITY] Modelo de carro não carregado; mantendo o veículo reserva.', error);
    }

    try {
      const truck = await this.importModel('caminhao_coleta.glb.gz');
      this.portTruckVisualRoot?.setEnabled(false);
      this.portTruckModelHeadingOffset = this.getImportedModelHeadingOffset(truck.root) + Math.PI;
      const truckHeadingRoot = new TransformNode('port-truck-heading-pivot', this.scene);
      truckHeadingRoot.position.set(this.portTruck.position.x, 0.04, this.portTruck.position.z);
      truck.root.parent = truckHeadingRoot;
      truck.root.scaling.setAll(0.56);
      this.portTruckModelRoot = truckHeadingRoot;
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

  private getImportedModelHeadingOffset(root: AbstractMesh): number {
    // GLB roots can carry a quaternion from the glTF importer. Measure the model's
    // actual +Z front before attaching it to a separate gameplay heading pivot.
    root.parent = null;
    root.computeWorldMatrix(true);
    const importedForward = Vector3.TransformNormal(
      new Vector3(0, 0, 1),
      root.getWorldMatrix(),
    );
    const horizontalForward = new Vector3(importedForward.x, 0, importedForward.z);
    if (horizontalForward.lengthSquared() <= 1e-6) return 0;
    horizontalForward.normalize();
    return Math.atan2(horizontalForward.x, horizontalForward.z);
  }

  private getCameraHeading(): number {
    const cameraView = this.camera.getTarget().subtract(this.camera.position);
    cameraView.y = 0;
    if (cameraView.lengthSquared() <= 1e-6) return 0;
    cameraView.normalize();
    return Math.atan2(cameraView.x, cameraView.z);
  }

  private angleDelta(target: number, current: number): number {
    return Math.atan2(Math.sin(target - current), Math.cos(target - current));
  }

  private syncVehicleModel(
    root: TransformNode | undefined,
    collider: Mesh,
    groundOffset: number,
    importedHeadingOffset = 0,
  ): void {
    if (!root) return;
    root.position.set(collider.position.x, collider.position.y - groundOffset, collider.position.z);
    // Keep the imported GLB's native front aligned with the collision/steering body.
    root.rotation.y = collider.rotation.y - importedHeadingOffset;
  }

  private update(dt: number): void {
    if (this.learningNotice) {
      this.keys.clear(); this.mobileMoveX = 0; this.mobileMoveY = 0;
      return;
    }
    const step = Math.min(dt, 0.05);
    let playerMoving = false;
    if (this.inVehicle) {
      const activeVehicle = this.activeVehicle;
      // The orbit camera is the same directional reference used on foot. Rotating
      // the camera therefore rotates the vehicle's heading instead of making it slide
      // sideways across the road; A/D (or the joystick X axis) still provide steering.
      const cameraHeading = this.getCameraHeading();
      if (this.lastDriveCameraHeading !== undefined) {
        activeVehicle.rotation.y += this.angleDelta(cameraHeading, this.lastDriveCameraHeading);
      }
      this.lastDriveCameraHeading = cameraHeading;

      const driveInput = Math.max(-1, Math.min(1,
        (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0) - this.mobileMoveY,
      ));
      const maximumSpeed = this.activePhase === 2 ? 10 : 15;
      const targetSpeed = driveInput * maximumSpeed;
      const acceleration = driveInput === 0 ? 5.5 : 10.5;
      const speedDelta = targetSpeed - this.vehicleSpeed;
      const maxSpeedChange = acceleration * step;
      this.vehicleSpeed += Math.max(-maxSpeedChange, Math.min(maxSpeedChange, speedDelta));
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
      // Read the camera's real view direction instead of reconstructing it from alpha.
      // Forward always means "where the camera is looking", even after mouse orbit.
      const cameraView = this.camera.getTarget().subtract(this.camera.position);
      const forward = new Vector3(cameraView.x, 0, cameraView.z);
      if (forward.lengthSquared() > 1e-6) forward.normalize();
      else forward.set(0, 0, 1);
      const right = new Vector3(forward.z, 0, -forward.x).normalize();
      const forwardInput = (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0) - this.mobileMoveY;
      const strafeInput = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0) + this.mobileMoveX;
      const move = forward.scale(forwardInput).addInPlace(right.scale(strafeInput));
      const moveLength = move.length();
      if (moveLength > 0.08) {
        if (moveLength > 1) move.normalize();
        const speed = this.keys.has('shift') ? 8.2 : 5.0;
        this.player.moveWithCollisions(move.scale(speed * step));
        const desiredHeading = Math.atan2(move.x, move.z);
        const headingDelta = Math.atan2(
          Math.sin(desiredHeading - this.player.rotation.y),
          Math.cos(desiredHeading - this.player.rotation.y),
        );
        this.player.rotation.y += headingDelta * Math.min(1, step * 12);
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
    if (this.playerModelHeadingRoot) {
      this.playerModelHeadingRoot.position.set(
        this.player.position.x,
        this.player.position.y - 1,
        this.player.position.z,
      );
      // Compensate for the imported model's own forward-axis offset so its face,
      // not its back, points toward the direction chosen by the player.
      this.playerModelHeadingRoot.rotation.y = this.player.rotation.y - this.playerModelHeadingOffset;
    }
    this.syncVehicleModel(this.vehicleVisualRoot, this.vehicle, 0);
    this.syncVehicleModel(this.vehicleModelRoot, this.vehicle, 0.48, this.vehicleModelHeadingOffset);
    this.syncVehicleModel(this.portTruckVisualRoot, this.portTruck, 0);
    this.syncVehicleModel(this.portTruckModelRoot, this.portTruck, 0.48, this.portTruckModelHeadingOffset);
    if (this.activePhase === 4 && this.forestTruckTraveling && this.forestTruckRoot && this.forestTruckTarget) {
      const direction = this.forestTruckTarget.subtract(this.forestTruckRoot.position);
      const distance = direction.length();
      if (distance <= 0.45) {
        this.forestTruckRoot.position.copyFrom(this.forestTruckTarget);
        this.forestTruckTraveling = false; this.forestTruckTarget = null;
        const destination = this.forestTruckDestination; this.forestTruckDestination = null;
        if (destination === 'factory') {
          this.forestMissionStage = 'process';
          this.message = 'O caminhão chegou à doca da agroindústria. Aproxime-se da linha de produção para processar e embalar os alimentos.';
        } else if (destination === 'market') {
          this.forestMissionStage = 'market';
          this.message = 'O caminhão chegou ao mercado local. Ajude a receber e organizar os produtos nas prateleiras.';
        }
        this.emit();
      } else {
        direction.normalize(); this.forestTruckRoot.position.addInPlace(direction.scale(7.2 * step));
        this.forestTruckRoot.rotation.y = Math.atan2(direction.x, direction.z);
      }
    }
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
    car.rotation.y = 0;
    car.checkCollisions = true;
    car.visibility = 0;
    const visualRoot = new TransformNode('municipal-vehicle-visual-root', this.scene);
    visualRoot.position.copyFrom(car.position);
    visualRoot.rotation.copyFrom(car.rotation);
    this.vehicleVisualRoot = visualRoot;
    this.vehicleMaterial = this.material('vehicle-body', new Color3(0.18, 0.48, 0.36));
    const roundedHull = MeshBuilder.CreateSphere('municipal-service-vehicle-rounded-hull', { diameter: 1, segments: 28 }, this.scene);
    roundedHull.parent = visualRoot; roundedHull.position.set(0, 0.02, 0); roundedHull.scaling.set(1.08, 0.40, 1.96);
    roundedHull.material = this.vehicleMaterial;

    const cabin = MeshBuilder.CreateSphere('vehicle-cabin-shell', { diameter: 1, segments: 24 }, this.scene);
    cabin.parent = visualRoot; cabin.position.set(0, 0.68, -0.15); cabin.scaling.set(0.86, 0.60, 0.94);
    cabin.material = this.material('vehicle-cabin-frame', new Color3(0.88, 0.77, 0.47));
    const glass = this.material('vehicle-glass', new Color3(0.10, 0.24, 0.30));
    const windshield = MeshBuilder.CreatePlane('vehicle-windshield', { width: 1.42, height: 0.54 }, this.scene);
    windshield.parent = visualRoot; windshield.position.set(0, 0.84, 0.78); windshield.material = glass;
    const rearGlass = MeshBuilder.CreatePlane('vehicle-rear-window', { width: 1.38, height: 0.48 }, this.scene);
    rearGlass.parent = visualRoot; rearGlass.position.set(0, 0.84, -1.08); rearGlass.rotation.y = Math.PI; rearGlass.material = glass;
    for (const side of [-1, 1]) {
      const sideGlass = MeshBuilder.CreatePlane('vehicle-side-window', { width: 1.35, height: 0.48 }, this.scene);
      sideGlass.parent = visualRoot; sideGlass.position.set(side * 0.87, 0.84, -0.15);
      sideGlass.rotation.y = side * Math.PI / 2; sideGlass.material = glass;
      const mirror = MeshBuilder.CreateSphere('vehicle-side-mirror', { diameter: 0.24, segments: 18 }, this.scene);
      mirror.parent = visualRoot; mirror.position.set(side * 1.03, 0.58, 0.52);
      mirror.scaling.set(0.55, 0.8, 1.15);
      mirror.material = this.material('vehicle-mirror-material', new Color3(0.13, 0.17, 0.16));
    }
    const roofCap = MeshBuilder.CreateSphere('vehicle-rounded-roof', { diameter: 1.7, segments: 24 }, this.scene);
    roofCap.parent = visualRoot; roofCap.position.set(0, 1.04, -0.15); roofCap.scaling.set(0.92, 0.24, 0.88);
    roofCap.material = this.material('vehicle-roof-material', new Color3(0.23, 0.30, 0.28));
    const hood = MeshBuilder.CreateSphere('vehicle-rounded-hood', { diameter: 1.8, segments: 24 }, this.scene);
    hood.parent = visualRoot; hood.position.set(0, 0.22, 1.12); hood.scaling.set(0.92, 0.28, 0.70); hood.material = this.vehicleMaterial;
    const wheelMat = this.material('vehicle-tires', new Color3(0.045, 0.05, 0.05));
    const hubMat = this.material('vehicle-wheel-hubs', new Color3(0.62, 0.67, 0.63));
    const tailLightMat = this.material('vehicle-tail-light-material', new Color3(0.75, 0.14, 0.10));
    for (const side of [-1, 1]) {
      const tailLight = MeshBuilder.CreateSphere('vehicle-tail-light', { diameter: 0.26, segments: 18 }, this.scene);
      tailLight.parent = visualRoot; tailLight.position.set(side * 0.78, 0.12, -1.90);
      tailLight.scaling.set(0.55, 0.75, 0.35); tailLight.material = tailLightMat;
    }
    const grille = MeshBuilder.CreateBox('vehicle-front-grille', { width: 0.9, height: 0.25, depth: 0.06 }, this.scene);
    grille.parent = visualRoot;
    grille.position.set(0, -0.08, 1.93);
    grille.material = this.material('vehicle-grille-material', new Color3(0.09, 0.13, 0.13));
    const bumper = MeshBuilder.CreateBox('vehicle-front-bumper', { width: 2.0, height: 0.16, depth: 0.16 }, this.scene);
    bumper.parent = visualRoot;
    bumper.position.set(0, -0.31, 1.91);
    bumper.material = this.material('vehicle-bumper-material', new Color3(0.23, 0.26, 0.25));
    const headlightMaterial = this.material('vehicle-headlight-material', new Color3(0.92, 0.84, 0.56));
    for (const side of [-1, 1]) {
      const headlight = MeshBuilder.CreateBox('vehicle-headlight', { width: 0.38, height: 0.18, depth: 0.07 }, this.scene);
      headlight.parent = visualRoot;
      headlight.position.set(side * 0.72, 0.08, 1.94);
      headlight.material = headlightMaterial;
    }
    for (const x of [-1.08, 1.08]) for (const z of [-1.25, 1.25]) {
      const wheel = MeshBuilder.CreateCylinder('vehicle-wheel', { diameter: 0.72, height: 0.22, tessellation: 20 }, this.scene);
      wheel.parent = visualRoot;
      wheel.position.set(x, -0.12, z);
      wheel.rotation.z = Math.PI / 2; wheel.material = wheelMat;
      const hub = MeshBuilder.CreateCylinder('vehicle-wheel-hub', { diameter: 0.34, height: 0.24, tessellation: 20 }, this.scene);
      hub.parent = visualRoot; hub.position.set(x * 1.02, -0.12, z);
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
      this.lastDriveCameraHeading = undefined;
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
      const entryDistance = this.activePhase === 2 ? PORT_TRUCK_ENTRY_DISTANCE : 6.5;
      if (Math.hypot(dx, dz) > entryDistance) {
        this.message = this.activePhase === 2
          ? 'Chegue a até 9,5 metros do caminhão amarelo e pressione F ou toque em ENTRAR.'
          : 'Aproxime-se do veículo municipal e pressione F quando aparecer o aviso para entrar.';
        this.emit(); return;
      }
      // Line up the car/truck with the direction currently shown by the camera
      // as soon as the player enters. Subsequent camera orbit deltas keep it aligned.
      const cameraHeading = this.getCameraHeading();
      activeVehicle.rotation.y = cameraHeading;
      this.lastDriveCameraHeading = cameraHeading;
      this.inVehicle = true; this.player.setEnabled(false);
      this.message = this.activePhase === 2
        ? this.portMissionStage === 'collect'
          ? 'Dirija o caminhão amarelo até as três empresas. W acelera, S dá ré e A/D viram. Pare ao lado de cada carga e pressione E ou toque em COLETAR. Depois leve tudo à cooperativa e pressione E para descarregar.'
          : this.portMissionStage === 'deliver'
            ? 'As três cargas estão a bordo. Dirija até a COOPERATIVA, pare na área de descarga e pressione E ou toque em DESCARREGAR. Use F para descer quando estiver parado.'
            : 'Caminhão liberado para deslocamento. Continue a missão atual; a coleta nas empresas será habilitada depois das etapas de diagnóstico e saneamento.'
        : this.electricVehicle
          ? 'Veículo 100% elétrico. W acelera, S dá ré e A/D viram. Pare antes de sair.'
          : 'Missão: W acelera para frente, S dá ré e A/D viram. Dirija até a BASE DE ELETRIFICAÇÃO, estacione na vaga e pressione F para descer.';
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
    const dynamicStartIndex = this.scene.meshes.length;
    const panelMaterial = this.material(`building-solar-panel-material-${index}`, new Color3(0.035, 0.16, 0.34));
    panelMaterial.specularColor = new Color3(0.52, 0.68, 0.82);
    panelMaterial.specularPower = 96;
    const gridMaterial = this.material(`building-solar-grid-material-${index}`, new Color3(0.48, 0.76, 0.91));
    const frameMaterial = this.material(`building-solar-frame-material-${index}`, new Color3(0.48, 0.54, 0.52));
    const railMaterial = this.material(`building-solar-rail-material-${index}`, new Color3(0.25, 0.31, 0.30));
    const tilt = -0.075;

    // Four framed modules sit on visible mounting rails, with a slight realistic roof tilt.
    for (const dx of [-building.width * 0.22, building.width * 0.22]) {
      for (const dz of [-2.0, 2.0]) {
        const centerX = building.x + dx;
        const centerZ = building.z + dz;
        for (const railZ of [-1.02, 1.02]) {
          const rail = MeshBuilder.CreateBox('building-solar-mounting-rail', { width: 2.42, height: 0.055, depth: 0.085 }, this.scene);
          rail.position.set(centerX, building.height + 0.31, centerZ + railZ);
          rail.material = railMaterial;
        }
        const frame = MeshBuilder.CreateBox('building-solar-module-frame', { width: 2.43, height: 0.09, depth: 2.73 }, this.scene);
        frame.position.set(centerX, building.height + 0.385, centerZ);
        frame.rotation.x = tilt;
        frame.material = frameMaterial;

        const panel = MeshBuilder.CreateBox('building-rooftop-solar-panel', { width: 2.34, height: 0.055, depth: 2.64 }, this.scene);
        panel.position.set(centerX, building.height + 0.455, centerZ);
        panel.rotation.x = tilt;
        panel.material = panelMaterial;

        // Cell divisions run in both directions, so each module reads as photovoltaic glass.
        for (const offset of [-0.86, 0, 0.86]) {
          const crossCell = MeshBuilder.CreateBox('building-solar-grid-cross-cell', { width: 2.22, height: 0.012, depth: 0.022 }, this.scene);
          crossCell.position.set(centerX, building.height + 0.49, centerZ + offset);
          crossCell.rotation.x = tilt;
          crossCell.material = gridMaterial;
        }
        for (const offset of [-0.56, 0.0, 0.56]) {
          const lengthCell = MeshBuilder.CreateBox('building-solar-grid-length-cell', { width: 0.022, height: 0.012, depth: 2.54 }, this.scene);
          lengthCell.position.set(centerX + offset, building.height + 0.49, centerZ);
          lengthCell.rotation.x = tilt;
          lengthCell.material = gridMaterial;
        }
      }
    }

    // A visible side plaque identifies the building as solar-powered after installation.
    const side = building.x < 0 ? 1 : -1;
    const facadeX = building.x + side * (building.width / 2 + 0.16);
    const plaqueZ = building.z - 2.65;
    const plaqueBacking = MeshBuilder.CreateBox('building-solar-status-plaque-backing', { width: 0.20, height: 0.92, depth: 2.55 }, this.scene);
    plaqueBacking.position.set(facadeX + side * 0.12, 3.18, plaqueZ);
    plaqueBacking.material = this.material(`building-solar-status-plaque-material-${index}`, new Color3(0.045, 0.20, 0.14));

    const texture = new DynamicTexture('building-solar-status-texture', { width: 1024, height: 320 }, this.scene, false);
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    context.fillStyle = '#0A3325';
    context.fillRect(0, 0, 1024, 320);
    context.strokeStyle = '#B7EC91';
    context.lineWidth = 10;
    context.strokeRect(12, 12, 1000, 296);

    // Photovoltaic icon and clear status copy.
    context.fillStyle = '#123F6A';
    context.fillRect(42, 88, 176, 142);
    context.strokeStyle = '#A8D9EB';
    context.lineWidth = 7;
    context.strokeRect(42, 88, 176, 142);
    for (const x of [100, 158]) {
      context.beginPath(); context.moveTo(x, 91); context.lineTo(x, 227); context.stroke();
    }
    for (const y of [135, 181]) {
      context.beginPath(); context.moveTo(46, y); context.lineTo(214, y); context.stroke();
    }
    context.fillStyle = '#F6D36A';
    context.beginPath(); context.arc(195, 63, 25, 0, Math.PI * 2); context.fill();
    context.textAlign = 'left';
    context.fillStyle = '#F0FFD9';
    context.font = 'bold 61px Arial';
    context.fillText('SISTEMA SOLAR', 270, 142, 700);
    context.fillStyle = '#B9EF91';
    context.font = 'bold 48px Arial';
    context.fillText('INSTALADO  ✓', 270, 220, 700);
    texture.update();

    const face = MeshBuilder.CreatePlane('building-solar-status-face', { width: 2.43, height: 0.80 }, this.scene);
    face.position.set(facadeX + side * 0.235, 3.18, plaqueZ);
    face.rotation.y = side * Math.PI / 2;
    face.isPickable = false;
    const faceMaterial = this.material(`building-solar-status-face-material-${index}`, new Color3(1, 1, 1));
    faceMaterial.diffuseTexture = texture;
    faceMaterial.emissiveColor = new Color3(0.14, 0.20, 0.15);
    face.material = faceMaterial;

    // Wall-mounted inverter and its status screen complete the installation.
    const inverter = MeshBuilder.CreateBox('building-solar-inverter', { width: 0.26, height: 0.78, depth: 0.78 }, this.scene);
    inverter.position.set(facadeX + side * 0.17, 1.58, plaqueZ);
    inverter.material = this.material(`building-solar-inverter-material-${index}`, new Color3(0.70, 0.75, 0.72));

    const inverterTexture = new DynamicTexture('building-solar-inverter-screen-texture', { width: 256, height: 128 }, this.scene, false);
    const inverterContext = inverterTexture.getContext() as unknown as CanvasRenderingContext2D;
    inverterContext.fillStyle = '#10261E'; inverterContext.fillRect(0, 0, 256, 128);
    inverterContext.fillStyle = '#B9EF91'; inverterContext.font = 'bold 31px Arial'; inverterContext.textAlign = 'center';
    inverterContext.fillText('INVERSOR', 128, 48);
    inverterContext.fillStyle = '#F3FFE9'; inverterContext.font = 'bold 29px Arial';
    inverterContext.fillText('ATIVO', 128, 91);
    inverterTexture.update();
    const inverterFace = MeshBuilder.CreatePlane('building-solar-inverter-face', { width: 0.61, height: 0.31 }, this.scene);
    inverterFace.position.set(facadeX + side * 0.315, 1.62, plaqueZ);
    inverterFace.rotation.y = side * Math.PI / 2;
    const inverterFaceMaterial = this.material(`building-solar-inverter-face-material-${index}`, new Color3(1, 1, 1));
    inverterFaceMaterial.diffuseTexture = inverterTexture;
    inverterFaceMaterial.emissiveColor = new Color3(0.08, 0.12, 0.09);
    inverterFace.material = inverterFaceMaterial;

    const conduit = MeshBuilder.CreateTube('building-solar-conduit', {
      path: [
        new Vector3(facadeX + side * 0.20, 2.72, plaqueZ),
        new Vector3(facadeX + side * 0.20, 2.25, plaqueZ),
        new Vector3(facadeX + side * 0.20, 2.03, plaqueZ),
      ],
      radius: 0.035, tessellation: 8,
    }, this.scene);
    conduit.material = this.material(`building-solar-conduit-material-${index}`, new Color3(0.40, 0.47, 0.44));
    this.phaseOneDynamicMeshes.push(...this.scene.meshes.slice(dynamicStartIndex) as Mesh[]);
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
    if (this.missionStage === 'complete') {
      this.message = `Sistema solar instalado com sucesso em ${building.label} (${this.solarBuildingsInstalled}/${TOTAL_SOLAR_BUILDINGS})! Os oito prédios agora geram energia limpa. Centro Industrial recuperado; Porto liberado.`;
    } else if (this.solarBuildingsInstalled === SOLAR_BUILDINGS_REQUIRED_FOR_EV) {
      this.message = `Sistema solar instalado com sucesso em ${building.label} (${this.solarBuildingsInstalled}/${TOTAL_SOLAR_BUILDINGS})! A plaqueta lateral confirma a instalação. A BASE DE ELETRIFICAÇÃO está ativa: entre no carro, dirija pela via de serviço, estacione na vaga marcada, desça e pressione E ao lado do veículo.`;
    } else if (this.solarBuildingsInstalled >= TOTAL_SOLAR_BUILDINGS) {
      this.message = `Sistema solar instalado com sucesso em ${building.label} (${this.solarBuildingsInstalled}/${TOTAL_SOLAR_BUILDINGS})! Todos os prédios já receberam placas solares. Agora conclua a conversão do veículo municipal para elétrico.`;
    } else {
      this.message = `Sistema solar instalado com sucesso em ${building.label} (${this.solarBuildingsInstalled}/${TOTAL_SOLAR_BUILDINGS})! A plaqueta na lateral do prédio identifica o sistema ativo. Siga para o próximo prédio sem a identificação solar. Custo por instalação: ${SOLAR_BUILDING_COST} CIT.`;
    }
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
    this.vehicleModelPaintMaterials.forEach((paint) => {
      paint.albedoColor = new Color3(0.17, 0.78, 0.39);
      paint.emissiveColor = new Color3(0.012, 0.055, 0.025);
    });
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
    if (this.activePhase === 4) {
      const nearby = this.getNearbyInteraction();
      if (!nearby) { this.message = 'Aproxime-se de um ponto da reserva, da área de colheita, da agroindústria ou dos locais de destinação.'; this.emit(); return; }
      this.performForestAction(nearby.action); return;
    }
    if (this.activePhase === 3) {
      const nearby = this.getNearbyInteraction();
      if (!nearby) { this.message = 'Aproxime-se do ponto de investigação, coleta, compostagem, saneamento ou jardim de chuva.'; this.emit(); return; }
      this.performPeripheryAction(nearby.action); return;
    }
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
    if (this.activePhase === 4) return this.forestMissionStage === 'complete';
    if (this.activePhase === 2) return this.portMissionStage === 'complete';
    if (this.activePhase === 3) return this.peripheryMissionStage === 'complete';
    return this.solarBuildingsInstalled >= TOTAL_SOLAR_BUILDINGS && this.electricVehicle
      && this.recyclingRate >= 60 && this.renewableShare >= 30 && this.sustainableMobility >= 30;
  }

  /** Gira a câmera com o gesto de arraste do lado direito da tela. */
  rotateCameraBy(deltaX: number, deltaY: number): void {
    if (this.paused || this.mapOpen) return;
    this.camera.alpha -= deltaX * 0.008;
    this.camera.beta = Math.max(0.68, Math.min(1.42, this.camera.beta + deltaY * 0.006));
  }

  /** Vetor analógico do direcional; mantém a intensidade do arraste do dedo. */
  setMobileMovement(horizontal: number, vertical: number): void {
    this.mobileMoveX = Math.max(-1, Math.min(1, horizontal));
    this.mobileMoveY = Math.max(-1, Math.min(1, vertical));
  }

  /** Ajuste direto do zoom, usado pelos controles táteis de + e −. */
  zoomCameraBy(radiusDelta: number): void {
    if (this.paused || this.mapOpen || !Number.isFinite(radiusDelta)) return;
    this.camera.radius = Math.max(
      this.camera.lowerRadiusLimit ?? 7,
      Math.min(this.camera.upperRadiusLimit ?? 24, this.camera.radius + radiusDelta),
    );
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
    if (this.paused || this.mapOpen || this.learningNotice) return null;
    if (this.activePhase === 2) return this.getNearbyPortInteraction();
    if (this.activePhase === 3) return this.getNearbyPeripheryInteraction();
    if (this.activePhase === 4) return this.getNearbyForestInteraction();
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
    if (this.learningNotice) return;
    const nearby = this.getNearbyInteraction();
    if (!nearby) {
      this.message = this.activePhase === 2
        ? 'Aproxime-se do objetivo indicado na missão para interagir.'
        : 'Aproxime-se de um resíduo, de um prédio sem painéis ou da base do veículo para interagir.';
      this.emit();
      return;
    }
    if (this.activePhase === 2) { this.performPortAction(nearby.action); return; }
    if (this.activePhase === 3) { this.performPeripheryAction(nearby.action); return; }
    if (this.activePhase === 4) { this.performForestAction(nearby.action); return; }
    if (nearby.action === 'enter-vehicle' || nearby.action === 'exit-vehicle') { this.toggleVehicle(); return; }
    if (nearby.action === 'install-building-solar') { this.installNearbyBuildingSolar(); return; }
    if (nearby.action === 'convert-vehicle') { this.convertVehicleAtBase(); return; }
    this.interact();
  }


  /** Pontos da etapa atual. O mapa orienta o deslocamento sem revelar a solução ambiental. */
  private getMapObjectives(): MapObjective[] {
    const entries: Array<{ id: string; label: string; x: number; z: number; done: boolean }> = [];

    if (this.activePhase === 1) {
      if (this.missionStage === 'collect') {
        this.trash.forEach((item, index) => entries.push({
          id: `trash-${index}`, label: `Resíduo ${index + 1}`,
          x: item.position.x, z: item.position.z, done: !item.isEnabled(),
        }));
      } else if (this.missionStage === 'deliver') {
        entries.push({ id: 'eco-center', label: 'EcoCentro · entrega', x: this.ecoCenterPosition.x, z: this.ecoCenterPosition.z, done: false });
      } else if (this.missionStage === 'solar') {
        this.buildings.forEach((building, index) => entries.push({
          id: `solar-building-${index}`, label: building.label,
          x: building.x, z: building.z, done: building.solarInstalled,
        }));
      } else if (this.missionStage === 'vehicle') {
        entries.push({ id: 'ev-base', label: 'Base de eletrificação', x: this.vehicleBasePosition.x, z: this.vehicleBasePosition.z, done: false });
      }
    } else if (this.activePhase === 2) {
      if (this.portMissionStage === 'inspect') {
        this.portOutfallPositions.forEach((site, index) => entries.push({
          id: `outfall-${index}`, label: `Ponto de despejo ${index + 1}`,
          x: site.x, z: site.z, done: this.portOutfallInspected.has(index),
        }));
      } else if (this.portMissionStage === 'treatment') {
        entries.push({ id: 'port-ete', label: 'Área da estação de tratamento (ETE)', x: 14, z: 0, done: false });
      } else if (this.portMissionStage === 'septic') {
        this.portSepticPositions.forEach((site, index) => entries.push({
          id: `septic-${index}`, label: `Instalação sanitária ${index + 1}`,
          x: site.x, z: site.z, done: this.portSepticInstalled[index],
        }));
      } else if (this.portMissionStage === 'collect') {
        this.portCompanyPositions.forEach((site, index) => entries.push({
          id: `company-${index}`, label: this.portCompanyNames[index],
          x: site.x, z: site.z, done: !this.portWastePiles[index]?.isEnabled(),
        }));
      } else if (this.portMissionStage === 'deliver') {
        entries.push({ id: 'port-cooperative', label: 'Cooperativa · descarga', x: this.portCooperativePosition.x, z: this.portCooperativePosition.z, done: false });
      } else if (this.portMissionStage === 'sorting') {
        this.portCooperativeBinPositions.forEach((site, index) => entries.push({
          id: `sorting-${index}`, label: `Baia: ${this.portCooperativeMaterialNames[index]}`,
          x: site.x, z: site.z, done: this.portCooperativeSorted[index],
        }));
      }
    } else if (this.activePhase === 3) {
      if (this.peripheryMissionStage === 'survey') {
        this.peripheryIssuePositions.forEach((site, index) => entries.push({ id: 'community-issue-' + index, label: ['Descarte irregular', 'Bueiro pluvial', 'Ligação sanitária'][index], x: site.x, z: site.z, done: this.peripheryIssueInspected.has(index) }));
      } else if (this.peripheryMissionStage === 'collect') {
        this.peripheryWastePositions.slice(0, this.peripheryWasteTotal).forEach((site, index) => entries.push({ id: 'community-waste-' + index, label: PERIPHERY_WASTE_CATALOG[index].name, x: site.x, z: site.z, done: this.peripheryWasteCollected[index] }));
      } else if (this.peripheryMissionStage === 'sorting') {
        entries.push({ id: 'community-organics', label: 'Composteira · ' + this.peripheryOrganicDeposited.filter(Boolean).length + '/2 resíduos orgânicos', x: this.peripheryOrganicDropPosition.x, z: this.peripheryOrganicDropPosition.z, done: this.peripheryOrganicsSorted });
        entries.push({ id: 'community-recycling', label: 'Coleta seletiva · ' + this.peripheryRecyclableDeposited.filter(Boolean).length + '/' + this.peripheryRecyclableTotal + ' recicláveis', x: this.peripheryRecyclingDropPosition.x, z: this.peripheryRecyclingDropPosition.z, done: this.peripheryRecyclablesSorted });
      } else if (this.peripheryMissionStage === 'compost') {
        entries.push({ id: 'community-compost', label: 'Composteira comunitária', x: this.peripheryCompostPosition.x, z: this.peripheryCompostPosition.z, done: this.peripheryCompostTurned });
      } else if (this.peripheryMissionStage === 'sanitation') {
        this.peripherySewerPositions.forEach((site, index) => entries.push({ id: 'community-sewer-' + index, label: 'Ligação de esgoto da moradia ' + (index + 1), x: site.x, z: site.z, done: this.peripherySewerConnected[index] }));
      } else if (this.peripheryMissionStage === 'rain-garden') {
        entries.push({ id: 'community-rain-garden', label: 'Área para jardim de chuva', x: this.peripheryRainGardenPosition.x, z: this.peripheryRainGardenPosition.z, done: this.peripheryRainGardenBuilt });
      }
    } else {
      const add = (id: string, label: string, site: PortSite | Vector3, done: boolean): void => { entries.push({ id, label, x: site.x, z: site.z, done }); };
      if (this.forestMissionStage === 'survey') {
        this.forestHabitatPositions.forEach((site, i) => add('forest-habitat-' + i, 'Fragmento de habitat ' + (i + 1), site, this.forestHabitatsInspected[i]));
      } else if (this.forestMissionStage === 'harvest') {
        this.forestProducePositions.forEach((site, i) => add('farm-produce-' + i, 'Colheita da agricultura familiar ' + (i + 1), site, this.forestProduceHarvested[i]));
      } else if (this.forestMissionStage === 'transport') {
        add('farm-truck', this.forestTruckLoaded ? 'Caminhão a caminho da agroindústria' : 'Pátio de carga do produtor', this.forestTruckLoaded ? this.forestFactoryDeliveryPosition : this.forestTruckLoadingPosition, this.forestTruckLoaded && !this.forestTruckTraveling);
      } else if (this.forestMissionStage === 'process') {
        add('food-industry', 'Agroindústria · processamento e embalagem', this.forestFactoryProcessPosition, this.forestProcessed);
      } else if (this.forestMissionStage === 'market') {
        add('local-market', 'Mercado local · recebimento', this.forestMarketStockPosition, this.forestMarketStocked);
      } else if (this.forestMissionStage === 'sorting') {
        this.forestPackagingPositions.forEach((site, i) => add('consumer-sorting-' + i, ['Papel/papelão · AZUL','Plástico · VERMELHO','Vidro · VERDE','Metal · AMARELO','Orgânicos · MARROM','Rejeito geral · CINZA'][i], site, this.forestPackagingSorted[i]));
      } else if (this.forestMissionStage === 'cooperative') {
        add('forest-cooperative', 'Cooperativa · recebimento de recicláveis', this.forestCooperativeDeliveryPosition, this.forestCooperativeDelivered);
      } else if (this.forestMissionStage === 'restore') {
        this.forestSeedlingPositions.forEach((site, i) => add('forest-seedling-' + i, 'Plantio de muda nativa ' + (i + 1), site, this.forestSeedlingsPlanted[i]));
        add('forest-spring', 'Proteção da nascente', this.forestSpringPosition, this.forestSpringProtected);
        add('forest-wildlife', 'Monitoramento da fauna', this.forestWildlifePosition, this.forestWildlifeRecorded);
        add('forest-fire-prevention', 'Posto de prevenção de incêndios', this.forestFirePreventionPosition, this.forestFirePreventionInspected);
      }
    }

    const nextIndex = entries.findIndex((entry) => !entry.done);
    return entries.map((entry, index) => ({
      id: entry.id, label: entry.label, x: entry.x, z: entry.z,
      status: entry.done ? 'done' : index === nextIndex ? 'next' : 'upcoming',
    }));
  }


  /** Restore the authenticated player's saved mission state. */
  restoreProgress(data: Partial<import('./types').GameProgressData>): void {
    if (data.phase === 2 && this.activePhase !== 2) this.enterPortPhase(true);
    if (data.phase === 3 && this.activePhase !== 3) this.enterPeripheryPhase(true);
    if (data.phase === 4 && this.activePhase !== 4) this.enterForestPhase(true);
    this.cit = Math.max(0, Number(data.cit ?? this.cit));

    if (this.activePhase === 1) {
      const collected = Array.isArray(data.collectedWaste) ? data.collectedWaste : [];
      this.collected = Math.min(TOTAL_TRASH, collected.filter(Boolean).length);
      this.trash.forEach((item, index) => item.setEnabled(!collected[index]));
      this.delivered = data.deliveredWaste === true;

      const solar = Array.isArray(data.solarBuildings) ? data.solarBuildings : [];
      this.solarBuildingsInstalled = 0;
      this.buildings.forEach((building, index) => {
        if (solar[index] && !building.solarInstalled) {
          building.solarInstalled = true;
          this.solarBuildingsInstalled += 1;
          this.createBuildingSolarPanels(building, index);
        }
      });
      this.renewableShare = Math.min(100, 5 + this.solarBuildingsInstalled * 9);
      this.recyclingRate = this.delivered ? 63 : 18;
      if (this.solarBuildingsInstalled >= SOLAR_BUILDINGS_REQUIRED_FOR_EV) this.activateVehicleStation();
      this.electricVehicle = data.electricVehicle === true;
      if (this.electricVehicle) {
        this.vehicleMaterial.diffuseColor = new Color3(0.08, 0.52, 0.34);
        this.vehicleModelPaintMaterials.forEach((paint) => {
          paint.albedoColor = new Color3(0.17, 0.78, 0.39);
          paint.emissiveColor = new Color3(0.012, 0.055, 0.025);
        });
        this.sustainableMobility = 72;
      }
      this.refreshMissionStage();
      if (data.missionStage) this.missionStage = data.missionStage;
      this.message = 'Seu progresso do Centro Industrial foi restaurado.';
    } else if (this.activePhase === 2) {
      const inspected = Array.isArray(data.outfallsInspected) ? data.outfallsInspected : [];
      this.portOutfallInspected.clear();
      inspected.forEach((index) => {
        if (!Number.isInteger(index) || index < 0 || index >= this.portOutfallMarkers.length) return;
        this.portOutfallInspected.add(index);
        const marker = this.portOutfallMarkers[index];
        if (marker) marker.material = this.material('port-outfall-inspected-' + index, new Color3(0.18, 0.62, 0.52));
      });
      this.portOutfallsInspected = this.portOutfallInspected.size;

      if (data.treatmentInstalled && !this.portTreatmentInstalled) this.installPortTreatment();

      const septic = Array.isArray(data.septicInstalled) ? data.septicInstalled : [];
      this.portSepticInstalled.forEach((installed, index) => {
        if (!septic[index] || installed) return;
        const site = this.portSepticPositions[index];
        this.player.position.set(site.x, 1, site.z);
        this.installPortSeptic();
      });

      const collected = Array.isArray(data.companyWasteCollected) ? data.companyWasteCollected : [];
      this.portWasteCollected = 0;
      this.portWastePiles.forEach((pile, index) => {
        const wasCollected = collected[index] === true;
        pile.setEnabled(!wasCollected);
        if (wasCollected) this.portWasteCollected += 1;
      });

      const sorted = Array.isArray(data.cooperativeSorted) ? data.cooperativeSorted : [];
      this.portCooperativeSorted.forEach((_, index) => {
        this.portCooperativeSorted[index] = sorted[index] === true;
        if (this.portCooperativeSorted[index] && this.portCooperativeBinMaterials[index]) {
          this.portCooperativeBinMaterials[index].emissiveColor = new Color3(0.10, 0.22, 0.10);
        }
      });
      this.portMissionStage = data.portMissionStage ?? this.portMissionStage;
      this.portWaterQuality = Math.max(0, Math.min(100, Number(data.portWaterQuality ?? this.portWaterQuality)));
      this.player.position.set(-25, 1, 30.5);
      this.message = 'Seu progresso do Porto foi restaurado.';
    } else if (this.activePhase === 3) {
      this.peripheryIssueInspected.clear();
      (Array.isArray(data.communityIssuesInspected) ? data.communityIssuesInspected : []).forEach((index) => {
        if (!Number.isInteger(index) || index < 0 || index >= this.peripheryIssueMarkers.length) return;
        this.peripheryIssueInspected.add(index);
        const marker = this.peripheryIssueMarkers[index];
        if (marker) marker.material = this.material('periphery-issue-restored-' + index, new Color3(0.18, 0.61, 0.42));
      });
      const savedWaste = Array.isArray(data.communityWasteCollected) ? data.communityWasteCollected : [];
      // Older saves had four generic piles (two organic and two recyclable).
      this.peripheryWasteTotal = savedWaste.length === 4 ? 4 : PERIPHERY_WASTE_CATALOG.length;
      this.peripheryRecyclableTotal = this.peripheryWasteTotal === 4 ? 2 : 3;
      this.peripheryWasteCollected.forEach((_, index) => {
        const isAvailableInSavedVersion = index < this.peripheryWasteTotal;
        this.peripheryWasteCollected[index] = isAvailableInSavedVersion && savedWaste[index] === true;
        this.peripheryWastePiles[index]?.setEnabled(isAvailableInSavedVersion && !this.peripheryWasteCollected[index]);
      });
      this.peripheryOrganicDeposited.forEach((_, index) => {
        this.peripheryOrganicDeposited[index] = Array.isArray(data.communityOrganicDeposited)
          ? data.communityOrganicDeposited[index] === true : data.communityOrganicsSorted === true;
      });
      this.peripheryRecyclableDeposited.forEach((_, index) => {
        this.peripheryRecyclableDeposited[index] = Array.isArray(data.communityRecyclableDeposited)
          ? data.communityRecyclableDeposited[index] === true
          : index < this.peripheryRecyclableTotal && data.communityRecyclablesSorted === true;
      });
      this.peripheryOrganicsSorted = this.peripheryOrganicDeposited.every(Boolean);
      this.peripheryRecyclablesSorted = this.peripheryRecyclableDeposited.slice(0, this.peripheryRecyclableTotal).every(Boolean);
      this.peripheryOrganicDeposited.forEach((done, slot) => {
        if (!done) return;
        const wasteIndex = PERIPHERY_WASTE_CATALOG.findIndex((item, index) => item.kind === 'organic'
          && PERIPHERY_WASTE_CATALOG.slice(0, index).filter((entry) => entry.kind === 'organic').length === slot);
        if (wasteIndex >= 0) {
          const site = { x: this.peripheryCompostPosition.x - 1.55 + slot * 2.9, z: this.peripheryCompostPosition.z - 0.45 };
          const model = this.createPeripheryWasteModel(wasteIndex, site, 'periphery-organic-restored', 1.12);
          this.peripheryOrganicDepositMeshes.push(model); this.peripheryDynamicMeshes.push(model);
        }
      });
      this.peripheryRecyclableDeposited.forEach((done, slot) => {
        if (!done) return;
        const wasteIndex = PERIPHERY_WASTE_CATALOG.findIndex((item, index) => item.kind === 'recyclable'
          && PERIPHERY_WASTE_CATALOG.slice(0, index).filter((entry) => entry.kind === 'recyclable').length === slot);
        if (wasteIndex >= 0) {
          const site = { x: this.peripheryRecyclingDropPosition.x - 1.25 + slot * 1.2, z: this.peripheryRecyclingDropPosition.z - 0.35 };
          const model = this.createPeripheryWasteModel(wasteIndex, site, 'periphery-recyclable-restored', 0.45);
          model.scaling.setAll(0.72); this.peripheryRecyclableDepositMeshes.push(model); this.peripheryDynamicMeshes.push(model);
        }
      });
      this.peripheryCompostTurned = data.communityCompostTurned === true;
      if (this.peripheryCompostTurned) this.buildMatureCommunityCompost();
      this.peripherySewerConnected.forEach((_, index) => {
        this.peripherySewerConnected[index] = data.communitySewerConnected?.[index] === true;
        if (this.peripherySewerConnected[index]) this.buildCommunitySewerConnection(index);
      });
      this.peripheryRainGardenBuilt = data.communityRainGardenBuilt === true;
      if (this.peripheryRainGardenBuilt) this.buildCommunityRainGarden();
      this.peripheryMissionStage = data.peripheryMissionStage ?? this.peripheryMissionStage;
      this.peripheryWaterQuality = this.peripheryRainGardenBuilt ? 54 : 28;
      this.player.position.set(-35, 1, 31);
      this.message = 'Seu progresso da Periferia Verde foi restaurado.';
    } else {
      this.forestMissionStage = data.forestMissionStage ?? 'survey';
      (data.forestHabitatsInspected ?? []).forEach((done, index) => {
        this.forestHabitatsInspected[index] = done === true;
        if (done && this.forestHabitatMarkers[index]) (this.forestHabitatMarkers[index].material as StandardMaterial).emissiveColor = new Color3(0.12, 0.28, 0.11);
      });
      (data.forestProduceHarvested ?? []).forEach((done, index) => {
        this.forestProduceHarvested[index] = done === true;
        if (done) this.forestProduceCrates[index]?.setEnabled(false);
      });
      this.forestTruckLoaded = data.forestTruckLoaded === true;
      this.forestProcessed = data.forestProcessed === true;
      this.forestMarketStocked = data.forestMarketStocked === true;
      (data.forestPackagingSorted ?? []).forEach((done, index) => {
        this.forestPackagingSorted[index] = done === true;
        if (done && this.forestPackagingBins[index]) this.forestPackagingBins[index].emissiveColor = new Color3(0.12, 0.2, 0.12);
      });
      this.forestCooperativeDelivered = data.forestCooperativeDelivered === true;
      (data.forestSeedlingsPlanted ?? []).forEach((done, index) => {
        this.forestSeedlingsPlanted[index] = done === true;
        if (done) { this.forestSeedlingMarkers[index]?.setEnabled(false); this.buildForestSeedling(index); }
      });
      this.forestSpringProtected = data.forestSpringProtected === true;
      if (this.forestSpringProtected) this.buildForestSpringRecovery();
      this.forestWildlifeRecorded = data.forestWildlifeRecorded === true;
      this.forestFirePreventionInspected = data.forestFirePreventionInspected === true;
      if (this.forestTruckRoot) this.forestTruckRoot.position.copyFrom(
        this.forestProcessed || this.forestMarketStocked ? this.forestMarketDeliveryPosition
          : this.forestTruckLoaded ? this.forestFactoryDeliveryPosition : this.forestTruckLoadingPosition,
      );
      this.forestTruckTraveling = false; this.forestTruckTarget = null; this.forestTruckDestination = null;
      if (this.forestProcessed && !this.forestMarketStocked) this.forestMissionStage = 'market';
      else if (this.forestTruckLoaded && !this.forestProcessed && this.forestMissionStage === 'transport') this.forestMissionStage = 'process';
      this.player.position.set(-37, 1, 31);
      this.message = 'Seu progresso da Reserva Florestal foi restaurado.';
    }
    this.emit();
  }

  getSnapshot(): GameSnapshot {
    const nearby = this.getNearbyInteraction();
    const mapObjectives = this.getMapObjectives();
    const nextObjective = mapObjectives.find((objective) => objective.status === 'next');
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
      completedNeighborhoods: this.activePhase === 1
        ? (this.missionStage === 'complete' ? 1 : 0)
        : this.activePhase === 2
          ? (this.portMissionStage === 'complete' ? 2 : 1)
          : this.activePhase === 3
            ? (this.peripheryMissionStage === 'complete' ? 3 : 2)
            : (this.forestMissionStage === 'complete' ? 4 : 3),
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
      peripheryMissionStage: this.peripheryMissionStage,
      communityIssuesInspected: this.peripheryIssueInspected.size,
      communityIssuesTotal: this.peripheryIssuePositions.length,
      communityWasteCollected: this.peripheryWasteCollected.filter(Boolean).length,
      communityWasteTotal: this.peripheryWasteTotal,
      communityOrganicDeposited: this.peripheryOrganicDeposited.filter(Boolean).length,
      communityOrganicTotal: this.peripheryOrganicDeposited.length,
      communityRecyclableDeposited: this.peripheryRecyclableDeposited.filter(Boolean).length,
      communityRecyclableTotal: this.peripheryRecyclableTotal,
      learningNotice: this.learningNotice,
      communityOrganicsSorted: this.peripheryOrganicsSorted,
      communityRecyclablesSorted: this.peripheryRecyclablesSorted,
      communityCompostTurned: this.peripheryCompostTurned,
      communitySewerConnections: this.peripherySewerConnected.filter(Boolean).length,
      communitySewerTotal: this.peripherySewerConnected.length,
      communityRainGardenBuilt: this.peripheryRainGardenBuilt,
      communityWaterQuality: this.peripheryWaterQuality,
      forestMissionStage: this.forestMissionStage,
      forestHabitatsInspected: this.forestHabitatsInspected.filter(Boolean).length,
      forestHabitatsTotal: this.forestHabitatsInspected.length,
      forestProduceHarvested: this.forestProduceHarvested.filter(Boolean).length,
      forestProduceTotal: this.forestProduceHarvested.length,
      forestTruckLoaded: this.forestTruckLoaded,
      forestProcessed: this.forestProcessed,
      forestMarketStocked: this.forestMarketStocked,
      forestPackagingSorted: this.forestPackagingSorted.filter(Boolean).length,
      forestPackagingTotal: this.forestPackagingSorted.length,
      forestCooperativeDelivered: this.forestCooperativeDelivered,
      forestSeedlingsPlanted: this.forestSeedlingsPlanted.filter(Boolean).length,
      forestSeedlingsTotal: this.forestSeedlingsPlanted.length,
      forestSpringProtected: this.forestSpringProtected,
      forestWildlifeRecorded: this.forestWildlifeRecorded,
      forestFirePreventionInspected: this.forestFirePreventionInspected,
      missionStage: this.missionStage,
      nextNeighborhoodUnlocked: this.isNextNeighborhoodUnlocked(),
      paused: this.paused,
      mapOpen: this.mapOpen,
      mapObjectives,
      nextObjectiveLabel: nextObjective?.label ?? 'Etapa concluída',
      inVehicle: this.inVehicle,
      vehicleSpeed: Math.round(Math.abs(this.vehicleSpeed) * 3.6),
      nearbyAction: nearby?.action ?? null,
      nearbyLabel: nearby?.label ?? '',
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      vehicleX: this.activeVehicle.position.x,
      vehicleZ: this.activeVehicle.position.z,
      message: this.message,
      progressData: {
        phase: this.activePhase,
        cit: this.cit,
        collectedWaste: this.trash.map((item) => !item.isEnabled()),
        deliveredWaste: this.delivered,
        solarBuildings: this.buildings.map((building) => building.solarInstalled),
        electricVehicle: this.electricVehicle,
        missionStage: this.missionStage,
        outfallsInspected: [...this.portOutfallInspected],
        treatmentInstalled: this.portTreatmentInstalled,
        septicInstalled: [...this.portSepticInstalled],
        companyWasteCollected: this.portWastePiles.map((pile) => !pile.isEnabled()),
        cooperativeSorted: [...this.portCooperativeSorted],
        portMissionStage: this.portMissionStage,
        portWaterQuality: this.portWaterQuality,
        peripheryMissionStage: this.peripheryMissionStage,
        communityIssuesInspected: [...this.peripheryIssueInspected],
        communityWasteCollected: this.peripheryWasteCollected.slice(0, this.peripheryWasteTotal),
        communityOrganicDeposited: [...this.peripheryOrganicDeposited],
        communityRecyclableDeposited: [...this.peripheryRecyclableDeposited],
        communityOrganicsSorted: this.peripheryOrganicsSorted,
        communityRecyclablesSorted: this.peripheryRecyclablesSorted,
        communityCompostTurned: this.peripheryCompostTurned,
        communitySewerConnected: [...this.peripherySewerConnected],
        communityRainGardenBuilt: this.peripheryRainGardenBuilt,
        forestMissionStage: this.forestMissionStage,
        forestHabitatsInspected: [...this.forestHabitatsInspected],
        forestProduceHarvested: [...this.forestProduceHarvested],
        forestTruckLoaded: this.forestTruckLoaded,
        forestProcessed: this.forestProcessed,
        forestMarketStocked: this.forestMarketStocked,
        forestPackagingSorted: [...this.forestPackagingSorted],
        forestCooperativeDelivered: this.forestCooperativeDelivered,
        forestSeedlingsPlanted: [...this.forestSeedlingsPlanted],
        forestSpringProtected: this.forestSpringProtected,
        forestWildlifeRecorded: this.forestWildlifeRecorded,
        forestFirePreventionInspected: this.forestFirePreventionInspected,
      },
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
