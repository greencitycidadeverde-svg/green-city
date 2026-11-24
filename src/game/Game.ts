import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, DynamicTexture, Engine, HemisphericLight,
  Mesh, MeshBuilder, Scene, StandardMaterial, Vector3,
} from '@babylonjs/core';
import type { GameSnapshot, MissionStage, NearbyAction, SnapshotListener } from './types';

const TOTAL_TRASH = 5;
const SOLAR_COST = 35;
const ELECTRIC_VEHICLE_COST = 45;

export class GreenCityGame {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly player: Mesh;
  private readonly vehicle: Mesh;
  private vehicleMaterial!: StandardMaterial;
  private readonly ecoCenterPosition = new Vector3(-25, 0, 8);
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
  private solarInstalled = false;
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

  constructor(canvas: HTMLCanvasElement, listener: SnapshotListener) {
    this.listener = listener;
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.62, 0.73, 0.70, 1);
    this.scene.collisionsEnabled = true;
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0022;
    this.scene.fogColor = new Color3(0.62, 0.73, 0.70);
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;

    const sky = new HemisphericLight('sky-light', new Vector3(0, 1, 0), this.scene);
    sky.intensity = 0.92;
    const sun = new DirectionalLight('sun-light', new Vector3(-0.45, -1, 0.35), this.scene);
    sun.position = new Vector3(25, 45, -20);
    sun.intensity = 0.9;

    this.buildDistrict();
    this.buildEcoCenter();
    this.player = this.createPlayer();
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
    this.camera.setTarget(new Vector3(0, 1.2, 25));

    this.riverMaterial = new StandardMaterial('river-material', this.scene);
    this.riverMaterial.diffuseColor = new Color3(0.30, 0.34, 0.28);
    this.riverMaterial.alpha = 0.92;
    this.buildRiver();
    this.buildTrash();
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
    material.specularColor = new Color3(0.08, 0.08, 0.08);
    return material;
  }

  private buildDistrict(): void {
    const ground = MeshBuilder.CreateGround('district-ground', { width: 90, height: 90 }, this.scene);
    ground.position.y = -0.08;
    ground.checkCollisions = true;
    ground.material = this.material('ground', new Color3(0.34, 0.43, 0.31));

    const roadMat = this.material('asphalt', new Color3(0.13, 0.16, 0.17));
    const sidewalkMat = this.material('sidewalk', new Color3(0.55, 0.57, 0.52));
    const lineMat = this.material('road-lines', new Color3(0.88, 0.82, 0.57));
    const road = MeshBuilder.CreateBox('main-road', { width: 16, depth: 82, height: 0.12 }, this.scene);
    road.position.y = 0.01;
    road.material = roadMat;
    road.checkCollisions = true;
    for (const x of [-9.3, 9.3]) {
      const walk = MeshBuilder.CreateBox('sidewalk', { width: 2.6, depth: 82, height: 0.22 }, this.scene);
      walk.position.set(x, 0.09, 0);
      walk.material = sidewalkMat;
      walk.checkCollisions = true;
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
      const curb = MeshBuilder.CreateBox('street-curb', { width: 0.18, height: 0.28, depth: 82 }, this.scene);
      curb.position.set(x, 0.15, 0);
      curb.material = curbMat;
    }

    const buildingColors = [new Color3(0.55, 0.48, 0.38), new Color3(0.42, 0.50, 0.48), new Color3(0.62, 0.58, 0.48)];
    const positions = [
      [-19, -27, 10, 15], [-28, -8, 12, 18], [-19, 18, 10, 13], [-31, 34, 12, 11],
      [20, -30, 12, 17], [30, -10, 10, 14], [20, 15, 13, 16], [31, 34, 11, 12],
    ];
    positions.forEach(([x, z, w, h], i) => {
      const building = MeshBuilder.CreateBox(`building-${i}`, { width: w, depth: 10, height: h }, this.scene);
      building.position.set(x, h / 2, z);
      building.material = this.material(`building-mat-${i}`, buildingColors[i % buildingColors.length]);
      building.checkCollisions = true;
      const roof = MeshBuilder.CreateBox(`roof-${i}`, { width: w + 0.5, depth: 10.5, height: 0.35 }, this.scene);
      roof.position.set(x, h + 0.17, z);
      roof.material = this.material(`roof-mat-${i}`, new Color3(0.22, 0.28, 0.25));

      // Low-poly facade kit: recessed storefront, framed glazing and readable entrances.
      const facadeSide = x < 0 ? 1 : -1;
      const facadeX = x + facadeSide * (w / 2 + 0.08);
      const glassMat = this.material(`window-glass-${i}`, new Color3(0.16, 0.29, 0.30));
      const frameMat = this.material(`window-frame-${i}`, new Color3(0.77, 0.74, 0.63));
      const windowRows = Math.max(1, Math.floor((h - 3) / 4));
      for (let row = 0; row < windowRows; row++) {
        for (const offset of [-3, 0, 3]) {
          const frame = MeshBuilder.CreateBox('facade-window-frame', { width: 0.16, height: 1.6, depth: 1.75 }, this.scene);
          frame.position.set(facadeX, 3.5 + row * 3.5, z + offset);
          frame.material = frameMat;
          const glass = MeshBuilder.CreateBox('facade-window-glass', { width: 0.18, height: 1.28, depth: 1.42 }, this.scene);
          glass.position.set(facadeX + facadeSide * 0.025, 3.5 + row * 3.5, z + offset);
          glass.material = glassMat;
        }
      }
      const entrance = MeshBuilder.CreateBox('facade-entry', { width: 0.18, height: 2.2, depth: 1.35 }, this.scene);
      entrance.position.set(facadeX + facadeSide * 0.03, 1.16, z - 2.9);
      entrance.material = glassMat;
      const storefront = MeshBuilder.CreateBox('storefront-sign-panel', { width: 0.18, height: 0.62, depth: 4.1 }, this.scene);
      storefront.position.set(facadeX + facadeSide * 0.03, 2.65, z + 1.25);
      storefront.material = this.material(`storefront-sign-${i}`, new Color3(0.12, 0.35, 0.24));
      const awning = MeshBuilder.CreateBox('storefront-awning', { width: 0.48, height: 0.12, depth: 4.35 }, this.scene);
      awning.position.set(facadeX + facadeSide * 0.22, 2.34, z + 1.25);
      awning.material = frameMat;
    });

    const treeMat = this.material('tree-leaves', new Color3(0.12, 0.34, 0.20));
    const trunkMat = this.material('tree-trunk', new Color3(0.27, 0.17, 0.10));
    for (const [x, z] of [[-11, -29], [-11, -14], [-11, 4], [-11, 24], [11, -25], [11, -6], [11, 13], [11, 30], [-35, 5], [35, -20]]) {
      const trunk = MeshBuilder.CreateCylinder('tree-trunk', { height: 2.2, diameter: 0.35 }, this.scene);
      trunk.position.set(x, 1.1, z);
      trunk.material = trunkMat;
      trunk.checkCollisions = true;
      const crown = MeshBuilder.CreateSphere('tree-crown', { diameter: 2.4, segments: 6 }, this.scene);
      crown.position.set(x, 2.7, z);
      crown.material = treeMat;
      this.parkTrees.push(crown);
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
    const binColors = [
      new Color3(0.14, 0.40, 0.57), new Color3(0.20, 0.49, 0.30),
      new Color3(0.77, 0.63, 0.18), new Color3(0.67, 0.26, 0.20),
    ];
    binColors.forEach((color, index) => {
      const bin = MeshBuilder.CreateBox('selective-collection-bin', { width: 0.7, height: 1.05, depth: 0.7 }, this.scene);
      bin.position.set(-31 + index * 1.05, 0.55, -4.8);
      bin.material = this.material(`selective-bin-${index}`, color);
    });
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
    const containers: Array<{ x: number; color: Color3 }> = [
      { x: -29.5, color: new Color3(0.12, 0.34, 0.66) }, // paper
      { x: -27.2, color: new Color3(0.72, 0.18, 0.18) }, // plastic
      { x: -24.9, color: new Color3(0.12, 0.48, 0.29) }, // glass
      { x: -22.6, color: new Color3(0.82, 0.64, 0.10) }, // metal
      { x: -20.3, color: new Color3(0.43, 0.27, 0.16) }, // organic
    ];
    containers.forEach(({ x, color }, index) => {
      const body = MeshBuilder.CreateBox('eco-center-recycling-container', { width: 1.55, height: 1.45, depth: 1.25 }, this.scene);
      body.position.set(x, 0.78, 12.0);
      body.material = this.material('eco-center-container-' + index, color);

      const lid = MeshBuilder.CreateBox('eco-center-container-lid', { width: 1.65, height: 0.16, depth: 1.35 }, this.scene);
      lid.position.set(x, 1.56, 12.0);
      lid.material = this.material('eco-center-container-lid-' + index, new Color3(0.09, 0.13, 0.11));

      const labelPanel = MeshBuilder.CreateBox('eco-center-container-label', { width: 1.25, height: 0.36, depth: 0.06 }, this.scene);
      labelPanel.position.set(x, 1.05, 12.66);
      labelPanel.material = this.material('eco-center-container-label-' + index, new Color3(0.91, 0.94, 0.86));

      const categoryMark = MeshBuilder.CreateBox('eco-center-container-category', { width: 0.42, height: 0.08, depth: 0.08 }, this.scene);
      categoryMark.position.set(x, 1.05, 12.72);
      categoryMark.material = this.material('eco-center-container-category-' + index, color);
    });

    const instructionPost = MeshBuilder.CreateCylinder('eco-center-instruction-post', { height: 2.6, diameter: 0.16, tessellation: 10 }, this.scene);
    instructionPost.position.set(-32.2, 1.3, 8.6);
    instructionPost.material = this.material('eco-center-post-material', new Color3(0.18, 0.22, 0.18));
    const instructionBoard = MeshBuilder.CreateBox('eco-center-instruction-board', { width: 1.6, height: 1.1, depth: 0.12 }, this.scene);
    instructionBoard.position.set(-32.2, 2.6, 8.6);
    instructionBoard.material = this.material('eco-center-instruction-board-material', new Color3(0.12, 0.39, 0.23));
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

  private createPlayer(): Mesh {
    // Invisible capsule maintains collision logic; attached meshes provide the visible field-agent silhouette.
    const root = MeshBuilder.CreateCapsule('player-collider', { height: 1.8, radius: 0.38, tessellation: 10 }, this.scene);
    root.position.set(0, 1.0, 25);
    root.ellipsoid = new Vector3(0.40, 0.9, 0.40);
    root.ellipsoidOffset = Vector3.Zero();
    root.checkCollisions = true;
    root.visibility = 0;
    root.isPickable = false;

    const jacket = this.material('agent-jacket', new Color3(0.09, 0.40, 0.28));
    const pants = this.material('agent-trousers', new Color3(0.15, 0.22, 0.19));
    const skin = this.material('agent-skin', new Color3(0.70, 0.49, 0.34));
    const helmet = this.material('agent-helmet', new Color3(0.83, 0.68, 0.24));
    const boots = this.material('agent-boots', new Color3(0.09, 0.12, 0.11));
    const reflective = this.material('agent-reflective-strip', new Color3(0.89, 0.78, 0.40));

    const torso = MeshBuilder.CreateCapsule('agent-torso', { height: 0.86, radius: 0.29, tessellation: 10 }, this.scene);
    torso.parent = root;
    torso.position.set(0, 0.10, 0);
    torso.material = jacket;
    const head = MeshBuilder.CreateSphere('agent-head', { diameter: 0.42, segments: 10 }, this.scene);
    head.parent = root;
    head.position.set(0, 0.78, 0.02);
    head.material = skin;
    const hat = MeshBuilder.CreateCylinder('agent-safety-helmet', { height: 0.18, diameterTop: 0.38, diameterBottom: 0.50, tessellation: 10 }, this.scene);
    hat.parent = root;
    hat.position.set(0, 1.0, 0);
    hat.material = helmet;
    const brim = MeshBuilder.CreateCylinder('agent-helmet-brim', { height: 0.055, diameter: 0.57, tessellation: 12 }, this.scene);
    brim.parent = root;
    brim.position.set(0, 0.94, 0);
    brim.material = helmet;

    for (const side of [-1, 1]) {
      const arm = MeshBuilder.CreateCapsule('agent-arm', { height: 0.72, radius: 0.13, tessellation: 8 }, this.scene);
      arm.parent = root;
      arm.position.set(side * 0.36, 0.12, 0);
      arm.rotation.z = side * -0.12;
      arm.material = jacket;
      const hand = MeshBuilder.CreateSphere('agent-hand', { diameter: 0.18, segments: 8 }, this.scene);
      hand.parent = root;
      hand.position.set(side * 0.38, -0.25, 0.02);
      hand.material = skin;
      const leg = MeshBuilder.CreateCapsule('agent-leg', { height: 0.68, radius: 0.14, tessellation: 8 }, this.scene);
      leg.parent = root;
      leg.position.set(side * 0.15, -0.53, 0);
      leg.material = pants;
      const boot = MeshBuilder.CreateBox('agent-boot', { width: 0.28, height: 0.18, depth: 0.40 }, this.scene);
      boot.parent = root;
      boot.position.set(side * 0.15, -0.88, 0.06);
      boot.material = boots;
    }

    const chestStrip = MeshBuilder.CreateBox('agent-reflective-strip', { width: 0.48, height: 0.10, depth: 0.34 }, this.scene);
    chestStrip.parent = root;
    chestStrip.position.set(0, 0.17, 0.25);
    chestStrip.material = reflective;
    const backpack = MeshBuilder.CreateBox('agent-field-backpack', { width: 0.40, height: 0.48, depth: 0.19 }, this.scene);
    backpack.parent = root;
    backpack.position.set(0, 0.12, -0.27);
    backpack.material = this.material('agent-backpack', new Color3(0.22, 0.30, 0.24));
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
    if (key === 'e' && !event.repeat && !this.inVehicle) this.interact();
    if (key === 'f' && !event.repeat && !this.mapOpen && !this.paused) this.toggleVehicle();
    if (key === 'm' && !event.repeat && !this.paused) this.setMapOpen(!this.mapOpen);
    if (key === 'escape' && !event.repeat) {
      if (this.mapOpen) this.setMapOpen(false);
      else this.setPaused(!this.paused);
    }
  };
  private readonly keyUp = (event: KeyboardEvent) => this.keys.delete(event.key.toLowerCase());

  private update(dt: number): void {
    const step = Math.min(dt, 0.05);
    if (this.inVehicle) {
      const accelerating = this.keys.has('w');
      const braking = this.keys.has('s');
      if (accelerating) this.vehicleSpeed = Math.min(15, this.vehicleSpeed + 10 * step);
      else if (braking) this.vehicleSpeed = Math.max(-5, this.vehicleSpeed - 16 * step);
      else this.vehicleSpeed *= Math.max(0, 1 - 1.8 * step);
      const steering = (this.keys.has('a') ? -1 : 0) + (this.keys.has('d') ? 1 : 0);
      if (Math.abs(this.vehicleSpeed) > 0.25) {
        this.vehicle.rotation.y += steering * 1.65 * step * Math.sign(this.vehicleSpeed);
        const direction = new Vector3(Math.sin(this.vehicle.rotation.y), 0, Math.cos(this.vehicle.rotation.y));
        this.vehicle.moveWithCollisions(direction.scale(this.vehicleSpeed * step));
      }
      this.player.position.copyFrom(this.vehicle.position).addInPlace(new Vector3(0, 0.2, 0));
    } else {
      const forward = this.camera.target.subtract(this.camera.position);
      forward.y = 0;
      forward.normalize();
      const right = Vector3.Cross(Vector3.Up(), forward).normalize();
      const move = Vector3.Zero();
      if (this.keys.has('w')) move.addInPlace(forward);
      if (this.keys.has('s')) move.subtractInPlace(forward);
      if (this.keys.has('d')) move.addInPlace(right);
      if (this.keys.has('a')) move.subtractInPlace(right);
      if (move.lengthSquared() > 0.001) {
        move.normalize();
        const speed = this.keys.has('shift') ? 8.2 : 5.0;
        this.player.moveWithCollisions(move.scale(speed * step));
        this.player.rotation.y = Math.atan2(move.x, move.z);
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
    const focus = this.inVehicle
      ? this.vehicle.position.add(new Vector3(0, 1.15, 0))
      : this.player.position.add(new Vector3(0, 0.8, 0));
    this.camera.target = Vector3.Lerp(this.camera.target, focus, 0.18);
    const now = performance.now();
    if (now - this.lastSnapshotAt >= 100) {
      this.lastSnapshotAt = now;
      this.emit();
    }
  }

  private createVehicle(): Mesh {
    const car = MeshBuilder.CreateBox('municipal-service-vehicle', { width: 2.1, height: 0.72, depth: 3.8 }, this.scene);
    car.position.set(3, 0.48, 25);
    car.checkCollisions = true;
    this.vehicleMaterial = this.material('vehicle-body', new Color3(0.34, 0.37, 0.36));
    car.material = this.vehicleMaterial;

    const cabin = MeshBuilder.CreateBox('vehicle-cabin', { width: 1.65, height: 0.75, depth: 1.75 }, this.scene);
    cabin.parent = car;
    cabin.position.set(0, 0.68, -0.15);
    cabin.material = this.material('vehicle-glass', new Color3(0.18, 0.29, 0.30));
    const wheelMat = this.material('vehicle-tires', new Color3(0.045, 0.05, 0.05));
    for (const x of [-1.08, 1.08]) for (const z of [-1.25, 1.25]) {
      const wheel = MeshBuilder.CreateCylinder('vehicle-wheel', { diameter: 0.72, height: 0.22, tessellation: 12 }, this.scene);
      wheel.parent = car;
      wheel.position.set(x, -0.12, z);
      wheel.rotation.z = Math.PI / 2;
      wheel.material = wheelMat;
    }
    return car;
  }

  private toggleVehicle(): void {
    if (this.inVehicle) {
      this.inVehicle = false;
      this.vehicleSpeed = 0;
      this.player.position.copyFrom(this.vehicle.position).addInPlace(new Vector3(2.8, 0.55, 0));
      this.player.setEnabled(true);
      this.message = 'Você saiu do veículo. Aproxime-se novamente e pressione F para entrar.';
    } else {
      const dx = this.player.position.x - this.vehicle.position.x;
      const dz = this.player.position.z - this.vehicle.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 6.5) {
        this.message = 'Aproxime-se do veículo municipal. Quando o aviso ENTRAR NO VEÍCULO aparecer, pressione F.';
        this.emit();
        return;
      }
      this.inVehicle = true;
      this.player.setEnabled(false);
      this.message = this.electricVehicle
        ? 'Veículo elétrico: use WASD para dirigir e F para sair. A recarga local é apoiada pela energia solar.'
        : 'Veículo a diesel: use WASD para dirigir e F para sair. A frota ainda gera emissões locais.';
    }
    this.keys.clear();
    this.emit();
  }

  private readonly focusCanvas = () => this.scene.getEngine().getRenderingCanvas()?.focus();
  private readonly clearKeys = () => this.keys.clear();

  private interact(): void {
    const now = performance.now();
    if (now - this.lastInteract < 180) return;
    this.lastInteract = now;

    if (this.missionStage === 'deliver') {
      const distance = Math.hypot(
        this.player.position.x - this.ecoCenterPosition.x,
        this.player.position.z - this.ecoCenterPosition.z,
      );
      if (distance <= 8.5) this.deliverWaste();
      else {
        this.message = 'Siga a sinalização verde até o ECOCENTRO. O ponto de entrega fica ao lado dos cinco contêineres coloridos.';
        this.emit();
      }
      return;
    }

    if (this.missionStage === 'improve' || this.missionStage === 'complete') {
      this.message = 'Abra PLANO URBANO para investir nas melhorias do bairro.';
      this.emit();
      return;
    }

    let nearest: Mesh | undefined;
    let nearestDistance = 3.3;
    for (const item of this.trash) {
      if (!item.isEnabled()) continue;
      const distance = Vector3.Distance(this.player.position, item.position);
      if (distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    }
    if (!nearest) {
      this.message = 'Aproxime-se de um resíduo para recolhê-lo.';
      this.emit();
      return;
    }

    nearest.setEnabled(false);
    this.collected += 1;
    if (this.collected === TOTAL_TRASH) {
      this.missionStage = 'deliver';
      this.message = 'Carga completa! Procure a placa ECOCENTRO e a área verde com cinco contêineres coloridos. Aproxime-se e pressione E para descarregar.';
    } else {
      this.message = `Resíduo recolhido (${this.collected}/${TOTAL_TRASH}). Continue a coleta.`;
    }
    this.emit();
  }

  private deliverWaste(): void {
    if (this.delivered || this.collected < TOTAL_TRASH) return;
    this.delivered = true;
    this.cit += 100;
    this.recyclingRate = 63;
    this.missionStage = 'improve';
    this.message = 'Resíduos recebidos no EcoCentro e encaminhados à triagem. +100 CIT simulados. Abra PLANO URBANO.';
    this.emit();
  }

  installSolarEnergy(): void {
    if (this.solarInstalled) {
      this.message = 'A estrutura solar deste bairro já foi instalada.';
      this.emit();
      return;
    }
    if (!this.delivered) {
      this.message = 'Primeiro conclua a coleta e entregue os resíduos no EcoCentro.';
      this.emit();
      return;
    }
    if (this.cit < SOLAR_COST) {
      this.message = `CIT insuficiente. A instalação solar custa ${SOLAR_COST} CIT.`;
      this.emit();
      return;
    }

    this.cit -= SOLAR_COST;
    this.solarInstalled = true;
    this.renewableShare = 35;
    this.airQuality = Math.min(100, this.airQuality + 7);

    const solarMat = this.material('solar-panel-material', new Color3(0.10, 0.23, 0.42));
    for (let i = 0; i < 3; i += 1) {
      const panel = MeshBuilder.CreateBox(`eco-center-solar-panel-${i}`, { width: 1.9, height: 0.12, depth: 1.15 }, this.scene);
      panel.position.set(-27 + i * 2, 3.48, -1.2);
      panel.material = solarMat;
    }
    const charger = MeshBuilder.CreateBox('solar-ev-charger', { width: 0.65, height: 1.45, depth: 0.48 }, this.scene);
    charger.position.set(-20.5, 0.73, 3);
    charger.material = this.material('charger-material', new Color3(0.13, 0.43, 0.52));
    this.message = 'Energia solar instalada no EcoCentro. A geração renovável agora pode sustentar a recarga elétrica local.';
    this.emit();
  }

  electrifyMunicipalVehicle(): void {
    if (this.electricVehicle) {
      this.message = 'O veículo municipal já foi convertido para elétrico.';
      this.emit();
      return;
    }
    if (!this.solarInstalled) {
      this.message = 'Instale primeiro a energia solar e a estrutura de recarga para apoiar o veículo elétrico.';
      this.emit();
      return;
    }
    if (this.cit < ELECTRIC_VEHICLE_COST) {
      this.message = `CIT insuficiente. A conversão do veículo custa ${ELECTRIC_VEHICLE_COST} CIT.`;
      this.emit();
      return;
    }

    this.cit -= ELECTRIC_VEHICLE_COST;
    this.electricVehicle = true;
    this.vehicleMaterial.diffuseColor = new Color3(0.08, 0.48, 0.33);
    this.sustainableMobility = 43;
    this.airQuality = Math.min(100, this.airQuality + 15);
    // Water and vegetation restoration require their own interventions;
    // changing the fleet alone only improves the local mobility indicators.
    this.missionStage = this.isNextNeighborhoodUnlocked() ? 'complete' : 'improve';
    this.message = this.isNextNeighborhoodUnlocked()
      ? 'Bairro recuperado! O Porto foi liberado no mapa da cidade. Você concluiu a primeira fase!'
      : 'Veículo municipal eletrificado. Continue acompanhando os indicadores do bairro.';
    this.emit();
  }

  private isNextNeighborhoodUnlocked(): boolean {
    return this.recyclingRate >= 60 && this.renewableShare >= 30 && this.sustainableMobility >= 30;
  }

  setPaused(value: boolean): void {
    this.paused = value;
    if (value) this.mapOpen = false;
    this.keys.clear();
    this.message = value ? 'Jogo pausado.' : 'De volta à cidade. Continue o plano de recuperação!';
    this.emit();
  }

  setMapOpen(value: boolean): void {
    if (this.paused) return;
    this.mapOpen = value;
    this.keys.clear();
    this.message = value ? 'Mapa geral da cidade aberto.' : 'Mapa fechado. Continue a transformação do bairro.';
    this.emit();
  }

  private getNearbyInteraction(): { action: NearbyAction; label: string } | null {
    if (this.paused || this.mapOpen) return null;
    if (this.inVehicle) return { action: 'exit-vehicle', label: 'F · SAIR DO VEÍCULO' };

    if (this.missionStage === 'deliver') {
      const distanceToEco = Math.hypot(
        this.player.position.x - this.ecoCenterPosition.x,
        this.player.position.z - this.ecoCenterPosition.z,
      );
      if (distanceToEco <= 8.5) {
        return { action: 'deliver-waste', label: 'E · ENTREGAR RESÍDUOS NO ECOCENTRO' };
      }
    }

    if (this.missionStage === 'collect') {
      let closestWaste = Number.POSITIVE_INFINITY;
      for (const item of this.trash) {
        if (!item.isEnabled()) continue;
        const distance = Math.hypot(
          this.player.position.x - item.position.x,
          this.player.position.z - item.position.z,
        );
        closestWaste = Math.min(closestWaste, distance);
      }
      if (closestWaste <= 3.3) return { action: 'collect-waste', label: 'E · RECOLHER RESÍDUO' };
    }

    const vehicleDistance = Math.hypot(
      this.player.position.x - this.vehicle.position.x,
      this.player.position.z - this.vehicle.position.z,
    );
    if (vehicleDistance <= 6.5) return { action: 'enter-vehicle', label: 'F · ENTRAR NO VEÍCULO' };
    return null;
  }

  performNearbyAction(): void {
    const nearby = this.getNearbyInteraction();
    if (!nearby) {
      this.message = 'Aproxime-se de um resíduo, do EcoCentro ou do veículo para interagir.';
      this.emit();
      return;
    }
    if (nearby.action === 'enter-vehicle' || nearby.action === 'exit-vehicle') {
      this.toggleVehicle();
      return;
    }
    this.interact();
  }

  getSnapshot(): GameSnapshot {
    const nearby = this.getNearbyInteraction();
    return {
      cit: this.cit,
      collected: this.collected,
      total: TOTAL_TRASH,
      delivered: this.delivered,
      solarInstalled: this.solarInstalled,
      electricVehicle: this.electricVehicle,
      recyclingRate: this.recyclingRate,
      renewableShare: this.renewableShare,
      sustainableMobility: this.sustainableMobility,
      airQuality: this.airQuality,
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
