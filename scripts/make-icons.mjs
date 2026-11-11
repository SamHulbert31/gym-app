// Renders every icon size from public/icon.svg. Run with `npm run icons`.
//
// The mark in icon.svg sits inside the centre 60%, so the same drawing serves as the
// regular icon, the Android maskable icon (which crops to a safe zone) and the iOS icon
// (which rounds the corners). The favicon is the same mark enlarged, since a browser tab
// neither crops nor rounds and the mark would otherwise be tiny.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const source = await readFile(join(pub, 'icon.svg'), 'utf8');

const render = (name, size) =>
  sharp(Buffer.from(source)).resize(size, size).png().toFile(join(pub, name));

await Promise.all([
  render('pwa-192x192.png', 192),
  render('pwa-512x512.png', 512),
  render('maskable-512x512.png', 512),
  render('apple-touch-icon.png', 180),
]);

const favicon = source
  .replace('<rect width="512" height="512" fill="#0E0F11"/>', '<rect width="512" height="512" rx="96" fill="#0E0F11"/>')
  .replace('<g id="mark"', '<g id="mark" transform="translate(256 256) scale(1.45) translate(-256 -256)"')
  .replace(/\s*<!--.*?-->/s, '');
await writeFile(join(pub, 'favicon.svg'), favicon);

console.log('icons written to public/');
