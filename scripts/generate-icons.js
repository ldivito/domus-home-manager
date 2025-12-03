const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../public/icons');

// Purple theme color
const PRIMARY_COLOR = '#7c3aed';
const BACKGROUND_DARK = '#0a0a1a';

// Icon sizes needed
const sizes = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512];
const maskableSizes = [192, 512];

// Create SVG for the icon
function createIconSVG(size, isMaskable = false) {
  const padding = isMaskable ? size * 0.2 : size * 0.1;
  const innerSize = size - padding * 2;
  const fontSize = innerSize * 0.7;
  const centerX = size / 2;
  const centerY = size / 2;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${BACKGROUND_DARK}" rx="${isMaskable ? 0 : size * 0.15}"/>
      <text
        x="${centerX}"
        y="${centerY + fontSize * 0.35}"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="${PRIMARY_COLOR}"
        text-anchor="middle"
      >D</text>
    </svg>
  `;
}

async function generateIcons() {
  // Ensure directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  console.log('Generating PWA icons...\n');

  // Generate standard icons
  for (const size of sizes) {
    const svg = createIconSVG(size);
    const filename = size === 180 ? 'apple-touch-icon.png' :
                     size <= 32 ? `favicon-${size}x${size}.png` :
                     `icon-${size}x${size}.png`;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(ICONS_DIR, filename));

    console.log(`  Created: ${filename}`);
  }

  // Generate maskable icons (with extra safe zone padding)
  for (const size of maskableSizes) {
    const svg = createIconSVG(size, true);
    const filename = `icon-maskable-${size}x${size}.png`;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(ICONS_DIR, filename));

    console.log(`  Created: ${filename} (maskable)`);
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
