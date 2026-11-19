import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BoxingRing } from './ring.js';
import { createPunch } from './punch.js';

const MODEL_URL = `${import.meta.env.BASE_URL}models/farmer-woman-rigged.glb`;
const $ = (selector) => document.querySelector(selector);
const punchButton = $('#punch');
const studio = new BoxingRing($('#viewport'), (now) => punch?.update(now));
const loader = new GLTFLoader();
let character = null;
let punch = null;
let requestNumber = 0;
let toastTimeout;

function setStatus(text) { $('#asset-status').textContent = text; }
function setProgress(percent) { $('#progress-bar').style.width = `${Math.min(100, Math.max(0, percent))}%`; }
function notify(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('visible'), 3000);
}
function showError(error, isMissing) {
  $('#loading-panel').hidden = false;
  $('#load-actions').hidden = false;
  $('#loading-title').textContent = isMissing ? 'فایل اصلی مدل هنوز موجود نیست' : 'بارگذاری مدل ناموفق بود';
  $('#loading-detail').textContent = isMissing
    ? 'فایل GLB مدل Rigged را از Grab3D بگیر و با دکمهٔ «انتخاب فایل GLB» وارد کن.'
    : `${error.message || error}. فایل GLB را بررسی کن یا دوباره تلاش کن.`;
  setProgress(0);
  setStatus('CHARACTER NOT LOADED');
}
function removeCharacter() {
  if (!character) return;
  character.parent?.remove(character);
  // Skinned meshes may share materials/textures; dispose only when no longer in use.
  character.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
      material.dispose();
    }
  });
  character = null;
  punch = null;
  punchButton.disabled = true;
}

function prepareOriginalCharacter(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  root.updateMatrixWorld(true);
  const a = new THREE.Box3().setFromObject(root);
  if (a.isEmpty()) throw new Error('The selected GLB contains no visible geometry.');
  const originalSize = a.getSize(new THREE.Vector3());
  if (!Number.isFinite(originalSize.y) || originalSize.y <= .001) throw new Error('The model has invalid dimensions.');

  // Keep the model's native ~1.72 m size when already authored in metres.
  // Correct only obvious unit mismatches (centimetres, etc.).
  if (originalSize.y < .5 || originalSize.y > 3.5) {
    root.scale.multiplyScalar(1.72 / originalSize.y);
    root.updateMatrixWorld(true);
  }
  const b = new THREE.Box3().setFromObject(root);
  const center = b.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y += .016 - b.min.y;
  root.updateMatrixWorld(true);
  return root;
}

async function loadCharacter(url, label = 'GRAB3D · RIGGED', isBlob = false) {
  const id = ++requestNumber;
  punchButton.disabled = true;
  $('#loading-panel').hidden = false;
  $('#load-actions').hidden = true;
  $('#loading-title').textContent = 'در حال بارگذاری شخصیت اصلی...';
  $('#loading-detail').textContent = 'نسخهٔ Rigged شخصیت Farmer Woman با لباس‌ها و بافت‌های خودش بارگذاری می‌شود.';
  setProgress(5);
  setStatus('LOADING ORIGINAL ASSET');

  try {
    const data = await new Promise((resolve, reject) => {
      loader.load(url, resolve, (progress) => {
        if (id !== requestNumber) return;
        if (progress.total > 0) setProgress(8 + 84 * progress.loaded / progress.total);
        else setProgress(40);
      }, reject);
    });
    if (id !== requestNumber) return;
    const root = prepareOriginalCharacter(data.scene);
    const nextPunch = createPunch(root);
    removeCharacter();
    character = root;
    punch = nextPunch;
    punchButton.disabled = !punch;
    studio.scene.add(character);
    studio.view('person');
    setProgress(100);
    $('#loading-panel').hidden = true;
    setStatus(punch ? 'ORIGINAL MODEL · READY' : 'MODEL LOADED');
    console.info('Character loaded', { label, punchAvailable: Boolean(punch) });
    notify('شخصیت داخل رینگ آماده است');
  } catch (error) {
    if (id !== requestNumber) return;
    const message = String(error?.message || error);
    console.error('Failed to load Farmer Woman GLB', error);
    punchButton.disabled = !punch;
    showError(error, !isBlob && /404|not found|failed to fetch|unexpected token|failed to load|network/i.test(message));
  }
}

$('#view-person').addEventListener('click', () => studio.view('person'));
$('#view-ring').addEventListener('click', () => studio.view('ring'));
$('#reset-view').addEventListener('click', () => studio.view('person'));
punchButton.addEventListener('click', () => punch?.start());
const input = $('#file-input');
function openPicker() { input.click(); }
$('#import-glb').addEventListener('click', openPicker);
$('#import-recovery').addEventListener('click', openPicker);
$('#retry-load').addEventListener('click', () => loadCharacter(MODEL_URL));
input.addEventListener('change', async () => {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.glb')) { notify('فقط فایل GLB انتخاب کن'); input.value = ''; return; }
  const url = URL.createObjectURL(file);
  try { await loadCharacter(url, `LOCAL · ${file.name}`, true); }
  finally {
    URL.revokeObjectURL(url);
    input.value = '';
  }
});
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.repeat) return;
  if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement) && !punchButton.disabled) {
    event.preventDefault();
    punch.start();
  }
  if (event.key.toLowerCase() === 'r') studio.view('person');
});
window.addEventListener('beforeunload', () => { requestNumber++; removeCharacter(); studio.dispose(); });

loadCharacter(MODEL_URL);
