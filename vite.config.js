import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// a fingerprint of everything that decides how a room looks. Baked rooms cached in visitors' browsers
// (src/roomCache.js) are only reused while it stays the same, so any change to these files re-bakes them.
const ROOM_FILES = ['src/recipe.js', 'src/decor.js', 'src/kit.js', 'src/kitList.js', 'src/three-helpers.js', 'src/farView.js', 'node_modules/three/package.json'];
const roomBuild = createHash('sha256').update(ROOM_FILES.map(f => readFileSync(f, 'utf8')).join('\n')).digest('hex').slice(0, 12);

export default defineConfig({
  define: { __ROOM_BUILD__: JSON.stringify(roomBuild) },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 }
});
