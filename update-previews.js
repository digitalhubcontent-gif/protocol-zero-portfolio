/**
 * update-previews.js
 * Automatically fetches high-resolution desktop landing page previews
 * for all 8 projects and saves them directly to the screenshots/ folder.
 *
 * Usage:
 *   node update-previews.js
 */

const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const projects = [
  { id: 'cashbackpro', name: 'cashbackpro-1.png', url: 'https://cashbackpro.in', skipIfExists: true },
  { id: 'premium-saas', name: 'premium-saas-1.png', url: 'https://premium-saa-s-templates.vercel.app/' },
  { id: 'pz-crm', name: 'pz-crm-1.png', url: 'https://protocol-zero-crm-templates.vercel.app/' },
  { id: 'urbanwash', name: 'urbanwash-1.png', url: 'https://urbanwash-af14c.web.app/' },
  { id: 'linkro', name: 'linkro-1.png', url: 'https://linkro-flax.vercel.app/' },
  { id: 'vidown', name: 'vidown-1.png', url: 'https://vidown-frontend.vercel.app/' },
  { id: 'pvccards', name: 'pvccards-1.png', url: 'https://pvccards.vercel.app/' },
  { id: 'siplocal', name: 'siplocal-1.png', url: 'https://siplocal.vercel.app/' },
];

async function fetchScreenshot(targetUrl) {
  // Primary: Microlink API (High resolution PNG)
  const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
  try {
    const res = await fetch(microlinkUrl, { signal: AbortSignal.timeout(25000) });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > 5000) return buffer;
    }
  } catch (err) {
    console.warn(`[Warning] Microlink fetch failed for ${targetUrl}: ${err.message}. Trying fallback...`);
  }

  // Fallback: WordPress mShots API
  const mshotsUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(targetUrl)}?w=1280&h=800`;
  const resFallback = await fetch(mshotsUrl, { signal: AbortSignal.timeout(15000) });
  if (!resFallback.ok) throw new Error(`HTTP error ${resFallback.status}`);
  return Buffer.from(await resFallback.arrayBuffer());
}

async function updateAll() {
  console.log('🚀 Starting automated screenshot generation for 8 projects...\n');

  for (const proj of projects) {
    const filePath = path.join(SCREENSHOTS_DIR, proj.name);
    if (proj.skipIfExists && fs.existsSync(filePath)) {
      console.log(`✓ [Skipping existing] ${proj.name} (${proj.url})`);
      continue;
    }

    console.log(`📸 Capturing preview: ${proj.name} from ${proj.url}...`);
    try {
      const imgBuffer = await fetchScreenshot(proj.url);
      fs.writeFileSync(filePath, imgBuffer);
      console.log(`✅ Saved ${proj.name} (${(imgBuffer.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`❌ Failed to capture ${proj.name}: ${err.message}`);
    }
  }

  console.log('\n✨ All project previews processed! Portfolio assets are up-to-date.');
}

updateAll();
