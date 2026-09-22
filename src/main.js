import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MODEL_INFO = {
  truck1: {
    name: "Food Truck 01",
    description: "Cocina abierta y barra de servicio, lista para street food.",
    price: "$92,000 USD",
  },
  truck2: {
    name: "Food Truck 02",
    description: "Unidad compacta de dos tonos, pensada para eventos y food parks.",
    price: "$64,500 USD",
  },
};

const CARTOON_MATERIALS = {
  body: { color: 0xb4232c, metalness: 0.18, roughness: 0.38 },
  glass: {
    color: 0x9ec9e6,
    metalness: 0.05,
    roughness: 0.06,
    transparent: true,
    opacity: 0.42,
  },
  fglass: {
    color: 0xb7d7ee,
    metalness: 0.05,
    roughness: 0.05,
    transparent: true,
    opacity: 0.5,
  },
  light: {
    color: 0xfff4d4,
    emissive: 0xffe7a8,
    emissiveIntensity: 1.4,
    metalness: 0.1,
    roughness: 0.25,
  },
  grill_inside: { color: 0x141414, metalness: 0.2, roughness: 0.82 },
  grill: { color: 0x2c2c2c, metalness: 0.72, roughness: 0.28 },
  f_bumper: { color: 0xe7e2d8, metalness: 0.55, roughness: 0.28 },
  side_arch: { color: 0x1d1d1d, metalness: 0.35, roughness: 0.48 },
  box: { color: 0xf0eadc, metalness: 0.08, roughness: 0.62 },
  tyre: { color: 0x161616, metalness: 0.05, roughness: 0.92 },
  wheels_1: { color: 0xd7d3cc, metalness: 0.82, roughness: 0.22 },
  wheel_2: { color: 0xc9c4bb, metalness: 0.78, roughness: 0.24 },
  wheel_3: { color: 0xb7b2aa, metalness: 0.7, roughness: 0.3 },
};

const canvas = document.querySelector("#view");
const loaderEl = document.querySelector("#loader");
const barFill = document.querySelector("#bar-fill");
const loaderCopy = document.querySelector("#loader-copy");
const nameEl = document.querySelector("#model-name");
const descEl = document.querySelector("#model-desc");
const priceEl = document.querySelector("#model-price");
const resetBtn = document.querySelector("#reset");
const modelButtons = document.querySelectorAll("[data-model]");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101214);

const camera = new THREE.PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  0.05,
  200,
);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.085;
controls.rotateSpeed = 0.68;
controls.zoomSpeed = 0.7;
controls.panSpeed = 0.55;
controls.screenSpacePanning = true;
controls.enablePan = true;
controls.zoomToCursor = false;
controls.minPolarAngle = 0.85;
controls.maxPolarAngle = 1.22;
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
};

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

scene.add(new THREE.HemisphereLight(0xb7c0cc, 0x17181b, 0.55));

const keyLight = new THREE.DirectionalLight(0xfff3e4, 2.15);
keyLight.position.set(5.5, 8.5, 4.5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xc9d7ea, 0.55);
fillLight.position.set(-6.5, 2.8, -1.5);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xe9f1ff, 1.05);
rimLight.position.set(-3, 6, -8);
scene.add(rimLight);

const models = {};
let activeId = "truck1";
let currentLimits = { radius: 4, maxPan: 1.2 };
let focusAnim = null;

const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => {
  const pct = total ? Math.round((loaded / total) * 100) : 0;
  barFill.style.width = `${pct}%`;
  loaderCopy.textContent = `Cargando assets ${pct}%`;
};

const textureLoader = new THREE.TextureLoader(manager);
const objLoader = new OBJLoader(manager);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

async function loadTexture(url, colorMap = false) {
  const texture = await textureLoader.loadAsync(url);
  texture.anisotropy = maxAniso;
  texture.colorSpace = colorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.flipY = true;
  return texture;
}

async function pbrMaterial(folder, prefix) {
  const [map, normalMap, roughnessMap, metalnessMap, emissiveMap] =
    await Promise.all([
      loadTexture(`/${folder}/${prefix}_BaseColor.png`, true),
      loadTexture(`/${folder}/${prefix}_Normal.png`),
      loadTexture(`/${folder}/${prefix}_Roughness.png`),
      loadTexture(`/${folder}/${prefix}_Metallic.png`),
      loadTexture(`/${folder}/${prefix}_Emissive.png`, true),
    ]);

  return new THREE.MeshStandardMaterial({
    map,
    normalMap,
    roughnessMap,
    metalnessMap,
    emissiveMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.85,
    envMapIntensity: 0.85,
    metalness: 1,
    roughness: 1,
  });
}

function centerModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.position.sub(center);
  return {
    object,
    radius: Math.max(size.length() * 0.5, 1),
  };
}

function framingFor(radius) {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = (radius / Math.tan(Math.min(vFov, hFov) * 0.5)) * 1.22;
  const isometric = new THREE.Vector3(1, 0.62, 1).normalize().multiplyScalar(distance);
  const polar = Math.acos(THREE.MathUtils.clamp(isometric.clone().normalize().y, -1, 1));
  return { distance, isometric, polar };
}

function applyTruck1Materials(root, materials) {
  const { body, utensils, soseg } = materials;

  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = false;
    const key = `${child.name} ${child.material?.name || ""}`.toLowerCase();
    if (key.includes("utensil") || key.includes("lambert3")) {
      child.material = utensils;
    } else if (key.includes("soseg") || key.includes("lambert2")) {
      child.material = soseg;
    } else {
      child.material = body;
    }
  });
}

function applyCartoonMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    const names = [];
    if (child.name) names.push(child.name);
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      if (mat?.name) names.push(mat.name);
    });
    const blob = names.join(" ").toLowerCase();
    const found = Object.keys(CARTOON_MATERIALS).find((key) => blob.includes(key));
    const preset = CARTOON_MATERIALS[found] || {
      color: 0x9a9a9a,
      metalness: 0.2,
      roughness: 0.5,
    };
    child.material = new THREE.MeshStandardMaterial({
      ...preset,
      envMapIntensity: 0.9,
    });
  });
}

function setCameraLimits(radius, distance, polar) {
  currentLimits = {
    radius,
    maxPan: radius * 0.22,
  };
  controls.minDistance = distance * 0.72;
  controls.maxDistance = distance * 1.7;
  controls.minPolarAngle = Math.max(0.55, polar - 0.2);
  controls.maxPolarAngle = Math.min(Math.PI / 2 - 0.08, polar + 0.16);
}

function applyView(entry, instant = true) {
  const { distance, isometric, polar } = framingFor(entry.radius);
  entry.isometric = isometric;
  setCameraLimits(entry.radius, distance, polar);
  if (instant) {
    camera.position.copy(isometric);
    controls.target.set(0, 0, 0);
    controls.update();
    return;
  }
  focusAnim = {
    fromPos: camera.position.clone(),
    toPos: isometric.clone(),
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(0, 0, 0),
    t: 0,
  };
}

function showModel(id, { focus = true } = {}) {
  activeId = id;
  Object.entries(models).forEach(([key, entry]) => {
    entry.object.visible = key === id;
  });
  const info = MODEL_INFO[id];
  nameEl.textContent = info.name;
  descEl.textContent = info.description;
  priceEl.textContent = info.price;
  modelButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.model === id);
  });
  if (focus) applyView(models[id], false);
}

function clampPan() {
  const { maxPan } = currentLimits;
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -maxPan, maxPan);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, -maxPan * 0.35, maxPan * 0.45);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -maxPan, maxPan);
}

async function loadModels() {
  const [truck1Root, truck2Root, body, utensils, soseg] = await Promise.all([
    objLoader.loadAsync("/Foodtruck1/FOODTRUCKOBJ.obj"),
    objLoader.loadAsync("/Foodtruck2/cartoon+truck.obj"),
    pbrMaterial("Foodtruck1", "FOODTRUCK_BODY"),
    pbrMaterial("Foodtruck1", "FOODTRUCK_UTESILS"),
    pbrMaterial("Foodtruck1", "FOODTRUCK_SOSEG"),
  ]);

  applyTruck1Materials(truck1Root, { body, utensils, soseg });
  applyCartoonMaterials(truck2Root);

  models.truck1 = centerModel(truck1Root);
  models.truck2 = centerModel(truck2Root);
  scene.add(truck1Root, truck2Root);
  truck2Root.visible = false;

  applyView(models.truck1, true);
  showModel("truck1", { focus: false });
}

function animate() {
  requestAnimationFrame(animate);
  if (focusAnim) {
    focusAnim.t = Math.min(1, focusAnim.t + 0.045);
    const ease = 1 - Math.pow(1 - focusAnim.t, 3);
    camera.position.lerpVectors(focusAnim.fromPos, focusAnim.toPos, ease);
    controls.target.lerpVectors(focusAnim.fromTarget, focusAnim.toTarget, ease);
    if (focusAnim.t >= 1) focusAnim = null;
  }
  clampPan();
  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

modelButtons.forEach((btn) => {
  btn.addEventListener("click", () => showModel(btn.dataset.model));
});

resetBtn.addEventListener("click", () => applyView(models[activeId], false));

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyF") {
    event.preventDefault();
    applyView(models[activeId], false);
  }
  if (event.code === "Digit1") showModel("truck1");
  if (event.code === "Digit2") showModel("truck2");
});

canvas.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("resize", onResize);

animate();

loadModels()
  .then(() => {
    loaderCopy.textContent = "Listo";
    barFill.style.width = "100%";
    window.setTimeout(() => loaderEl.classList.add("hidden"), 280);
  })
  .catch((error) => {
    console.error(error);
    loaderCopy.textContent = "No se pudieron cargar los modelos.";
  });
