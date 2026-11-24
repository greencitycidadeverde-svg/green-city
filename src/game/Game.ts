import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight,
  Mesh, MeshBuilder, Scene, StandardMaterial, Vector3,
} from '@babylonjs/core';
import type { GameSnapshot, SnapshotListener } from './types';

const TOTAL_TRASH = 5;

export class GreenCityGame {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly player: Mesh;
  private readonly vehicle: Mesh;
  private inVehicle = false;
  private vehicleSpeed = 0;
  private readonly trash: Mesh[] = [];
  private readonly keys = new Set<string>();
  private readonly listener: SnapshotListener;
  private velocityY = 0;
  private onGround = true;
  private cit = 0;
  private collected = 0;
  private paused = false;
  private mapOpen = false;
  private restored = false;
  private message = 'Encontre os resíduos e pressione E para recolher.';
  private lastInteract = 0;
  private lastSnapshotAt = 0;
  private readonly riverMaterial: StandardMaterial;
  private readonly parkTrees: Mesh[] = [];

  constructor(canvas: HTMLCanvasElement, listener: SnapshotListener) {
    this.listener = listener;
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.48, 0.68, 0.70, 1);
    this.scene.collisionsEnabled = true;

    const sky = new HemisphericLight('sky-light', new Vector3(0, 1, 0), this.scene);
    sky.intensity = 0.82;
    const sun = new DirectionalLight('sun-light', new Vector3(-0.45, -1, 0.35), this.scene);
    sun.position = new Vector3(25, 45, -20);
    sun.intensity = 0.72;

    this.buildDistrict();
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
    road.position.y = 0.01; road.material = roadMat; road.checkCollisions = true;
    for (const x of [-9.3, 9.3]) {
      const walk = MeshBuilder.CreateBox('sidewalk', { width: 2.6, depth: 82, height: 0.22 }, this.scene);
      walk.position.set(x, 0.09, 0); walk.material = sidewalkMat; walk.checkCollisions = true;
    }
    for (let z = -36; z <= 36; z += 9) {
      const stripe = MeshBuilder.CreateBox('road-dash', { width: 0.18, depth: 3.5, height: 0.02 }, this.scene);
      stripe.position.set(0, 0.085, z); stripe.material = lineMat;
    }

    const buildingColors = [new Color3(0.55, 0.48, 0.38), new Color3(0.42, 0.50, 0.48), new Color3(0.62, 0.58, 0.48)];
    const positions = [
      [-19, -27, 10, 15], [-28, -8, 12, 18], [-19, 18, 10, 13], [-31, 34, 12, 11],
      [20, -30, 12, 17], [30, -10, 10, 14], [20, 15, 13, 16], [31, 34, 11, 12],
    ];
    positions.forEach(([x, z, w, h], i) => {
      const building = MeshBuilder.CreateBox(`building-${i}`, { width: w, depth: 10, height: h }, this.scene);
      building.position.set(x, h / 2, z); building.material = this.material(`building-mat-${i}`, buildingColors[i % buildingColors.length]);
      building.checkCollisions = true;
      const roof = MeshBuilder.CreateBox(`roof-${i}`, { width: w + 0.5, depth: 10.5, height: 0.35 }, this.scene);
      roof.position.set(x, h + 0.17, z); roof.material = this.material(`roof-mat-${i}`, new Color3(0.22, 0.28, 0.25));
    });

    const treeMat = this.material('tree-leaves', new Color3(0.12, 0.34, 0.20));
    const trunkMat = this.material('tree-trunk', new Color3(0.27, 0.17, 0.10));
    for (const [x, z] of [[-11, -29], [-11, -14], [-11, 4], [-11, 24], [11, -25], [11, -6], [11, 13], [11, 30], [-35, 5], [35, -20]]) {
      const trunk = MeshBuilder.CreateCylinder('tree-trunk', { height: 2.2, diameter: 0.35 }, this.scene);
      trunk.position.set(x, 1.1, z); trunk.material = trunkMat; trunk.checkCollisions = true;
      const crown = MeshBuilder.CreateSphere('tree-crown', { diameter: 2.4, segments: 6 }, this.scene);
      crown.position.set(x, 2.7, z); crown.material = treeMat; this.parkTrees.push(crown);
    }

    const plaza = MeshBuilder.CreateGround('plaza', { width: 14, height: 12 }, this.scene);
    plaza.position.set(-25, 0.03, 0); plaza.material = sidewalkMat;
    const sign = MeshBuilder.CreateBox('district-sign', { width: 4.5, height: 2.2, depth: 0.25 }, this.scene);
    sign.position.set(-24, 2.4, 7); sign.material = this.material('sign-green', new Color3(0.07, 0.25, 0.16));
  }

  private buildRiver(): void {
    const river = MeshBuilder.CreateGround('polluted-river', { width: 18, height: 84, subdivisions: 1 }, this.scene);
    river.position.set(48, -0.015, 0); river.material = this.riverMaterial;
    const bankMat = this.material('river-bank', new Color3(0.39, 0.35, 0.26));
    for (const x of [38.5, 57.5]) {
      const bank = MeshBuilder.CreateBox('river-bank', { width: 1.2, height: 0.55, depth: 84 }, this.scene);
      bank.position.set(x, 0.16, 0); bank.material = bankMat; bank.checkCollisions = true;
    }
  }

  private createPlayer(): Mesh {
    const body = MeshBuilder.CreateCapsule('player-avatar', { height: 1.8, radius: 0.42, tessellation: 8 }, this.scene);
    body.position.set(0, 1.0, 25);
    body.ellipsoid = new Vector3(0.42, 0.9, 0.42);
    body.ellipsoidOffset = Vector3.Zero();
    body.checkCollisions = true;
    body.material = this.material('avatar-material', new Color3(0.08, 0.42, 0.28));
    return body;
  }

  private buildTrash(): void {
    const trashMat = this.material('trash-material', new Color3(0.24, 0.25, 0.22));
    const canMat = this.material('can-material', new Color3(0.72, 0.48, 0.15));
    const positions = [[-4, 17], [4, 8], [-5, -4], [5, -18], [-3, -30]];
    positions.forEach(([x, z], i) => {
      const item = MeshBuilder.CreateBox(`waste-${i}`, { width: 0.65, height: 0.55, depth: 0.55 }, this.scene);
      item.position.set(x, 0.34, z); item.material = i % 2 ? canMat : trashMat;
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
      forward.y = 0; forward.normalize();
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
      if (this.keys.has(' ') && this.onGround) { this.velocityY = 7.2; this.onGround = false; }
      this.velocityY -= 19 * step;
      this.player.moveWithCollisions(new Vector3(0, this.velocityY * step, 0));
      if (this.player.position.y <= 1) {
        this.player.position.y = 1; this.velocityY = 0; this.onGround = true;
      }
    }
    const focus = this.inVehicle ? this.vehicle.position.add(new Vector3(0, 1.15, 0)) : this.player.position.add(new Vector3(0, 0.8, 0));
    this.camera.target = Vector3.Lerp(this.camera.target, focus, 0.18);
    const now = performance.now();
    if (now - this.lastSnapshotAt >= 100) {
      this.lastSnapshotAt = now;
      this.emit();
    }
  }

  private createVehicle(): Mesh {
    const car = MeshBuilder.CreateBox('electric-utility-car', { width: 2.1, height: 0.72, depth: 3.8 }, this.scene);
    car.position.set(4, 0.48, 25);
    car.checkCollisions = true;
    car.material = this.material('vehicle-body', new Color3(0.12, 0.36, 0.29));
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
      this.player.position.copyFrom(this.vehicle.position).addInPlace(new Vector3(2.2, 0.55, 0));
      this.player.setEnabled(true);
      this.message = 'Você saiu do veículo.';
    } else {
      const distance = Vector3.Distance(this.player.position, this.vehicle.position);
      if (distance > 3.4) {
        this.message = 'Aproxime-se do carro para entrar.';
        this.emit();
        return;
      }
      this.inVehicle = true;
      this.player.setEnabled(false);
      this.message = 'Veículo elétrico: WASD dirige, F sai do veículo.';
    }
    this.emit();
  }

  private readonly focusCanvas = () => this.scene.getEngine().getRenderingCanvas()?.focus();
  private readonly clearKeys = () => this.keys.clear();

  private interact(): void {
    const now = performance.now();
    if (now - this.lastInteract < 180) return;
    this.lastInteract = now;
    let nearest: Mesh | undefined;
    let nearestDistance = 2.8;
    for (const item of this.trash) {
      if (!item.isEnabled()) continue;
      const distance = Vector3.Distance(this.player.position, item.position);
      if (distance < nearestDistance) { nearest = item; nearestDistance = distance; }
    }
    if (!nearest) { this.message = 'Aproxime-se de um resíduo para recolhê-lo.'; this.emit(); return; }
    nearest.setEnabled(false);
    this.collected += 1;
    this.message = `Resíduo recolhido (${this.collected}/${TOTAL_TRASH}).`;
    if (this.collected === TOTAL_TRASH) this.completeMission();
    this.emit();
  }

  private completeMission(): void {
    this.cit += 80;
    this.message = 'Missão concluída! +80 CIT simulados. O trecho do rio foi recuperado.';
    this.restored = true;
    this.riverMaterial.diffuseColor = new Color3(0.12, 0.46, 0.38);
    this.parkTrees.forEach((tree, index) => {
      if (index % 2 === 0) tree.scaling.scaleInPlace(1.12);
    });
    const cleanup = MeshBuilder.CreateGround('restored-green-bank', { width: 13, height: 25 }, this.scene);
    cleanup.position.set(48, 0.025, 0); cleanup.material = this.material('restored-bank-material', new Color3(0.22, 0.43, 0.25));
  }

  setPaused(value: boolean): void {
    this.paused = value;
    if (value) this.mapOpen = false;
    this.keys.clear();
    this.message = value ? 'Jogo pausado.' : 'De volta à cidade. Continue a missão!';
    this.emit();
  }

  setMapOpen(value: boolean): void {
    if (this.paused) return;
    this.mapOpen = value;
    this.keys.clear();
    this.message = value ? 'Mapa do Distrito Central aberto.' : 'Mapa fechado. Continue a exploração.';
    this.emit();
  }
  getSnapshot(): GameSnapshot { return { cit: this.cit, collected: this.collected, total: TOTAL_TRASH, missionComplete: this.collected >= TOTAL_TRASH, restored: this.restored, paused: this.paused, mapOpen: this.mapOpen, inVehicle: this.inVehicle, vehicleSpeed: Math.round(Math.abs(this.vehicleSpeed) * 3.6), playerX: this.player.position.x, playerZ: this.player.position.z, message: this.message }; }
  private emit(): void { this.listener(this.getSnapshot()); }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.clearKeys);
    this.scene.getEngine().getRenderingCanvas()?.removeEventListener('pointerdown', this.focusCanvas);
    this.camera.detachControl();
    this.scene.dispose(); this.engine.dispose();
  }
}
