// Renders the PWA icons into public/. Run with `npm run icons`.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = '#0E0F11';
const ACCENT = '#C8F03C';
// Same dumbbell glyph as the Train tab icon, drawn in a 24 unit box.
const GLYPH = 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12';

// `glyphWidth` is the glyph's share of the canvas; maskable icons keep it inside the safe zone.
const svg = (size, glyphWidth) => {
  const scale = (size * glyphWidth) / 18;
  const offset = size / 2 - 12 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="${BG}"/>
<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${ACCENT}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${GLYPH}"/></g>
</svg>`;
};

const render = (name, size, glyphWidth) =>
  sharp(Buffer.from(svg(size, glyphWidth))).png().toFile(join(out, name));

await Promise.all([
  render('pwa-192x192.png', 192, 0.6),
  render('pwa-512x512.png', 512, 0.6),
  render('maskable-512x512.png', 512, 0.46),
  render('apple-touch-icon.png', 180, 0.6),
]);
console.log('icons written to public/');
