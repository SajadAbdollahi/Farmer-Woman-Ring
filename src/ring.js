import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// This file only builds the boxing-ring environment. It does not create,
// sculpt, recolor, deform, rig, animate, or replace any part of the character.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (color, roughness = .8, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function object(geometry, material, parent, location, shadows = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...location);
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function tube(parent, from, to, radius, material, segments = 12) {
  const direction = V(...to).sub(V(...from));
  const mesh = object(new THREE.CylinderGeometry(radius, radius, direction.length(), segments), material, parent, [0, 0, 0]);
  mesh.position.copy(V(...from).add(V(...to)).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), direction.normalize());
  return mesh;
}
function ringCanvasTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6c7884';
  ctx.fillRect(0, 0, 512, 512);
  // Subtle canvas weave and wear on the ring floor, not on the GLB.
  for (let i = 0; i < 512; i += 3) {
    ctx.fillStyle = 'rgba(244,248,249,.042)'; ctx.fillRect(i, 0, 1, 512);
    ctx.fillStyle = 'rgba(9,18,25,.055)'; ctx.fillRect(0, i, 512, 1);
  }
  let seed = 33088;
  const next = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
  for (let i = 0; i < 12000; i++) {
    const a = .015 + next() * .045;
    ctx.fillStyle = `rgba(24,33,42,${a})`;
    ctx.fillRect(next() * 512, next() * 512, 1 + next() * 2, 1 + next() * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 8;
  return texture;
}

export class BoxingRing {
  constructor(container, updateCharacter) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b121b);
    this.scene.fog = new THREE.FogExp2(0x0b121b, .019);

    this.camera = new THREE.PerspectiveCamera(50, 1, .05, 70);
    this.camera.position.set(1.67, 1.87, 2.31);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.00;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.00, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .07;
    this.controls.minDistance = .8;
    this.controls.maxDistance = 12;
    this.controls.maxPolarAngle = Math.PI * .53;
    this.controls.minPolarAngle = .08;
    this.controls.screenSpacePanning = false;
    this.controls.update();

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .05);
    this.scene.environment = environment.texture;
    this.environment = environment;
    pmrem.dispose(); room.dispose();

    this.createLighting();
    this.createRing();
    this.createBackground();
    this.cameraTarget = null;

    this.resize = () => {
      const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    };
    this.resize();
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(container);

    this.renderer.setAnimationLoop(() => {
      updateCharacter?.(performance.now());
      if (this.cameraTarget) {
        this.camera.position.lerp(this.cameraTarget.position, .10);
        this.controls.target.lerp(this.cameraTarget.lookAt, .10);
        if (this.camera.position.distanceTo(this.cameraTarget.position) < .01 &&
            this.controls.target.distanceTo(this.cameraTarget.lookAt) < .01) {
          this.cameraTarget = null;
        }
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  createLighting() {
    this.scene.add(new THREE.HemisphereLight(0xc9d6e9, 0x3d3b37, .76));
    const key = new THREE.DirectionalLight(0xffecdc, 1.85);
    key.position.set(-2.8, 5.0, 3.3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.normalBias = .018;
    key.shadow.bias = -.0001;
    key.shadow.radius = 4;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xb6d3ff, .46);
    fill.position.set(3.5, 2.8, 2.8);
    this.scene.add(fill);
    const back = new THREE.DirectionalLight(0xffd4a4, .72);
    back.position.set(.5, 4.3, -4);
    this.scene.add(back);
  }

  createRing() {
    const ring = new THREE.Group();
    this.scene.add(ring);
    const platform = mat(0x212931, .93);
    const canvas = new THREE.MeshStandardMaterial({ map: ringCanvasTexture(), color: 0xd0d8df, roughness: .93 });
    const vinyl = mat(0x18202b, .69);
    const steel = mat(0x2f3a46, .35, .74);
    const dark = mat(0x17202a, .85);
    const ropeMats = [mat(0xa22c2a, .64), mat(0xe4dcd2, .65), mat(0x354a61, .72)];
    const cornerMats = [mat(0xb63632, .65), mat(0xe9e8e1, .68), mat(0x315576, .65), mat(0xebe8e1, .68)];

    object(new THREE.BoxGeometry(5.96, .23, 5.96), platform, ring, [0, -.22, 0]);
    // The top surface is at y=0.01. Character feet are placed at y=0.015.
    object(new THREE.BoxGeometry(5.8, .025, 5.8), canvas, ring, [0, -.0025, 0], false);
    for (const z of [-2.94, 2.94]) {
      object(new THREE.BoxGeometry(5.94, .13, .085), vinyl, ring, [0, -.13, z]);
    }
    for (const x of [-2.94, 2.94]) {
      object(new THREE.BoxGeometry(.085, .13, 5.94), vinyl, ring, [x, -.13, 0]);
    }
    for (const [i, x] of [-2.78, 2.78].entries()) {
      for (const [j, z] of [-2.78, 2.78].entries()) {
        const corner = cornerMats[i * 2 + j];
        object(new THREE.CylinderGeometry(.058, .067, 1.55, 20), steel, ring, [x, .72, z]);
        object(new THREE.BoxGeometry(.22, .22, .22), corner, ring, [x, 1.14, z]);
        for (const y of [.44, .77]) {
          object(new THREE.BoxGeometry(.19, .18, .19), corner, ring, [x, y, z]);
        }
        object(new THREE.CylinderGeometry(.086, .086, .09, 16), dark, ring, [x, 1.50, z]);
      }
    }
    for (let n = 0; n < 3; n++) {
      const y = .45 + n * .33;
      const rope = ropeMats[n];
      for (const side of [-1, 1]) {
        tube(ring, [-2.76, y, side * 2.76], [2.76, y, side * 2.76], .016, rope);
        tube(ring, [side * 2.76, y, -2.76], [side * 2.76, y, 2.76], .016, rope);
      }
    }
    const ground = object(new THREE.PlaneGeometry(80, 80), mat(0x171c24, .96), this.scene, [0, -.34, 0], false);
    ground.rotation.x = -Math.PI / 2;
    const edge = object(new THREE.BoxGeometry(6.2, .12, 6.2), dark, ring, [0, -.36, 0]);
    edge.castShadow = false;
    // Subtle geometric lines on the ring canvas.
    const thin = mat(0x4b5866, .95);
    for (const p of [-2.42, 2.42]) {
      object(new THREE.BoxGeometry(4.85, .002, .009), thin, ring, [0, .012, p], false);
      object(new THREE.BoxGeometry(.009, .002, 4.85), thin, ring, [p, .012, 0], false);
    }
  }

  createBackground() {
    const group = new THREE.Group();
    this.scene.add(group);
    const wall = object(new THREE.PlaneGeometry(25, 10), mat(0x18212b, 1), group, [0, 3.5, -7.4], false);
    wall.receiveShadow = false;
    const columnMat = mat(0x26303c, .8, .25);
    for (const x of [-6, -3, 0, 3, 6]) {
      object(new THREE.BoxGeometry(.09, 5.4, .09), columnMat, group, [x, 2.7, -7.32], false);
    }
    const white = new THREE.MeshBasicMaterial({ color: 0xd7e2e7, toneMapped: false });
    for (const x of [-3.5, 0, 3.5]) {
      const light = object(new THREE.BoxGeometry(1.5, .03, .08), white, group, [x, 4.65, -5.5], false);
      light.receiveShadow = false;
    }
  }

  view(name) {
    const configurations = {
      person: { position: [1.67, 1.87, 2.31], lookAt: [0, 1.00, 0] },
      ring: { position: [5.9, 3.25, 6.4], lookAt: [0, .75, 0] },
    };
    const selected = configurations[name] || configurations.person;
    this.cameraTarget = { position: V(...selected.position), lookAt: V(...selected.lookAt) };
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.controls.dispose();
    this.environment.dispose();
    this.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.geometry?.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of materials) m?.dispose();
    });
    this.renderer.dispose();
  }
}
