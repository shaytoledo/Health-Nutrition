/**
 * Post-build step for web: generate PNG icons from the SVG and patch
 * dist/index.html with proper PWA / iOS home-screen metadata.
 *
 * Run automatically after `expo export` (see package.json scripts).
 */

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

const root    = path.resolve(__dirname, '..');
const dist    = path.join(root, 'dist');
const src     = path.join(root, 'web-assets');
const svgPath = path.join(src, 'icon.svg');
const manifestPath = path.join(src, 'manifest.json');

async function main() {
  if (!fs.existsSync(dist)) {
    console.error('dist/ not found — run `npx expo export` first');
    process.exit(1);
  }
  const svg = fs.readFileSync(svgPath);

  // Generate PNG sizes required for iOS home screen, Android home screen,
  // and the PWA manifest.
  const sizes = [
    { name: 'icon-192.png',          size: 192, density: 400 },
    { name: 'icon-512.png',          size: 512, density: 1200 },
    { name: 'icon-maskable-512.png', size: 512, density: 1200 },
    { name: 'apple-touch-icon.png',  size: 180, density: 400 },
    { name: 'favicon-32.png',        size: 32,  density: 96 },
  ];

  for (const { name, size, density } of sizes) {
    await sharp(svg, { density })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(dist, name));
    console.log(`  ✓ ${name}`);
  }

  // Copy SVG + manifest
  fs.copyFileSync(svgPath, path.join(dist, 'icon.svg'));
  fs.copyFileSync(manifestPath, path.join(dist, 'manifest.json'));
  console.log('  ✓ icon.svg, manifest.json');

  // Patch index.html with all the head metadata browsers need
  const indexPath = path.join(dist, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  const HEAD = `
    <meta name="theme-color" content="#00C9A7" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="NutriTrack" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
    <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />`;

  // Update <title>
  html = html.replace(/<title>[^<]*<\/title>/, '<title>NutriTrack</title>');

  // Inject head metadata once (idempotent)
  if (!html.includes('manifest.json')) {
    html = html.replace('</head>', `${HEAD}\n  </head>`);
  }

  fs.writeFileSync(indexPath, html);
  console.log('  ✓ index.html patched');
  console.log('\nDone. Upload dist/ to Vercel.');
}

main().catch((e) => { console.error(e); process.exit(1); });
