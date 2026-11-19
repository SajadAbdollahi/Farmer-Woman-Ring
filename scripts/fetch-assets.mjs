/**
 * Fetch the EXACT static, full-resolution Farmer Woman GLB from Grab3D.
 * Model page: https://grab3d.com/models/characters/farmer-woman/
 * Direct official download: https://grab3d.com/dl/farmer-woman/farmer-woman.glb
 * CC0 1.0, no alterations. The 23 MB GLB has embedded 4K textures.
 *
 * `node scripts/fetch-assets.mjs --soft`: log download failures but allow Vite
 * to start, so the user can import the GLB manually in the browser.
 */
import https from 'node:https';
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, openSync, readSync, closeSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const download = 'https://grab3d.com/dl/farmer-woman/farmer-woman.glb';
const targetDir = join(process.cwd(), 'public', 'models');
const target = join(targetDir, 'farmer-woman.glb');
const soft = process.argv.includes('--soft');
const force = process.argv.includes('--force');
mkdirSync(targetDir, { recursive: true });

function validGLB(path) {
  if (!existsSync(path) || statSync(path).size < 100000) return false;
  const fd = openSync(path, 'r');
  try {
    const h = Buffer.alloc(12);
    if (readSync(fd, h, 0, h.length, 0) !== 12) return false;
    return h.toString('ascii', 0, 4) === 'glTF' && h.readUInt32LE(4) === 2 && h.readUInt32LE(8) === statSync(path).size;
  } finally { closeSync(fd); }
}

async function getStream(url, redirects = 0) {
  if (redirects > 7) throw new Error('Too many redirects from Grab3D.');
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Farmer-Woman-Ring/1.0',
        'Accept': 'model/gltf-binary,application/octet-stream,*/*',
        'Referer': 'https://grab3d.com/models/characters/farmer-woman/'
      }, timeout: 45000
    }, (response) => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const newLocation = response.headers.location;
        response.resume();
        if (!newLocation) { reject(new Error('Redirect without Location.')); return; }
        getStream(new URL(newLocation, url).toString(), redirects + 1).then(resolve, reject);
        return;
      }
      if (status !== 200) { response.resume(); reject(new Error(`Grab3D returned HTTP ${status}.`)); return; }
      const size = Number(response.headers['content-length'] || 0);
      if (size > 120 * 1024 * 1024) { response.resume(); reject(new Error('Unexpected asset size.')); return; }
      resolve(response);
    });
    req.on('timeout', () => req.destroy(new Error('Download timeout after 45 s.')));
    req.on('error', reject);
  });
}

if (validGLB(target) && !force) {
  console.log(`Original Farmer Woman GLB already exists (${(statSync(target).size / 1e6).toFixed(1)} MB).`);
} else {
  const partial = `${target}.partial`;
  console.log('Downloading original Farmer Woman (Static / Full quality, ~23 MB, CC0)...');
  try {
    const source = await getStream(download);
    await pipeline(source, createWriteStream(partial));
    if (!validGLB(partial)) throw new Error('Download was not a complete, valid GLB file.');
    renameSync(partial, target);
    console.log(`Saved ${target} (${(statSync(target).size / 1e6).toFixed(1)} MB).`);
  } catch (error) {
    rmSync(partial, { force: true });
    console.error(`Asset download failed: ${error.message}`);
    console.error('Manual alternative: download Static / Full quality / GLB from');
    console.error('https://grab3d.com/models/characters/farmer-woman/');
    console.error('Save as public/models/farmer-woman.glb or use the Import GLB button in the viewer.');
    if (!soft) process.exitCode = 1;
  }
}
