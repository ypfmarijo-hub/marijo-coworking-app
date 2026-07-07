import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// SVG content for the M icon - #0057a5 blue background, white M letter
const createSvg = (size) => {
  const cornerRadius = Math.round(size * 0.2); // iOS style ~20% corner radius
  const fontSize = Math.round(size * 0.625);
  const textY = Math.round(size * 0.68);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#0057a5"/>
  <text x="${size/2}" y="${textY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white">M</text>
</svg>`;
};

async function generateIcons() {
  const sizes = [192, 512];
  
  for (const size of sizes) {
    const svg = createSvg(size);
    const outputPath = join(publicDir, `pwa-icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);
    
    console.log(`Generated: pwa-icon-${size}.png`);
  }
  
  console.log('PWA icons generated successfully!');
}

generateIcons().catch(console.error);
