import fs from 'fs';
import path from 'path';
import { Jimp } from 'jimp';

const srcDir = './public/ai_selection';
const destDir = './public/ai_selection_clean';
const albumPath = './public/album.json';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// 1. Load and filter album.json
if (!fs.existsSync(albumPath)) {
  console.error("album.json not found!");
  process.exit(1);
}

const album = JSON.parse(fs.readFileSync(albumPath, 'utf-8'));
const filteredAlbum = album.filter(item => !item.image.includes('2020_12.jpg'));

// Re-index IDs and update paths
filteredAlbum.forEach((item, idx) => {
  item.id = idx + 1;
  const filename = path.basename(item.image);
  item.image = `ai_selection_clean/${filename}`;
});

fs.writeFileSync(albumPath, JSON.stringify(filteredAlbum, null, 2), 'utf-8');

// 2. Noise-resistant intelligent cropping algorithm
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.jpg') && f !== '2020_12.jpg');
console.log(`Intelligently cropping ${files.length} images...`);

async function cropImage(file) {
  const srcPath = path.join(srcDir, file);
  const destPath = path.join(destDir, file);
  
  try {
    const image = await Jimp.read(srcPath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    
    // Step A: Find min and max brightness to set dynamic threshold
    let minBrightness = 255;
    let maxBrightness = 0;
    
    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 8) {
        const idx = (y * w + x) * 4;
        const r = image.bitmap.data[idx];
        const g = image.bitmap.data[idx + 1];
        const b = image.bitmap.data[idx + 2];
        const brightness = (r + g + b) / 3;
        
        if (brightness < minBrightness) minBrightness = brightness;
        if (brightness > maxBrightness) maxBrightness = brightness;
      }
    }
    
    const range = maxBrightness - minBrightness;
    let threshold = 150;
    if (range > 40) {
      threshold = minBrightness + (range * 0.75); // 75% bias to isolate bright paper
    }
    
    // Step B: Calculate row and column densities
    const colCounts = new Array(w).fill(0);
    const rowCounts = new Array(h).fill(0);
    const step = 4;
    
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const idx = (y * w + x) * 4;
        const r = image.bitmap.data[idx];
        const g = image.bitmap.data[idx + 1];
        const b = image.bitmap.data[idx + 2];
        const brightness = (r + g + b) / 3;
        
        if (brightness > threshold) {
          colCounts[x]++;
          rowCounts[y]++;
        }
      }
    }
    
    // Step C: Noise-resistant boundary detection (threshold is 6% of max possible density)
    const minColDensity = (h / step) * 0.06;
    const minRowDensity = (w / step) * 0.06;
    
    let minX = 0;
    for (let x = 0; x < w; x++) {
      if (colCounts[x] > minColDensity) {
        minX = x;
        break;
      }
    }
    
    let maxX = w - 1;
    for (let x = w - 1; x >= 0; x--) {
      if (colCounts[x] > minColDensity) {
        maxX = x;
        break;
      }
    }
    
    let minY = 0;
    for (let y = 0; y < h; y++) {
      if (rowCounts[y] > minRowDensity) {
        minY = y;
        break;
      }
    }
    
    let maxY = h - 1;
    for (let y = h - 1; y >= 0; y--) {
      if (rowCounts[y] > minRowDensity) {
        maxY = y;
        break;
      }
    }
    
    const detectedW = maxX - minX;
    const detectedH = maxY - minY;
    
    if (detectedW < w * 0.4 || detectedH < h * 0.4 || minX >= maxX || minY >= maxY) {
      // Fallback crop: 11% left/right, 2% top/bottom
      const cropX = Math.round(w * 0.11);
      const cropY = Math.round(h * 0.02);
      const cropW = w - (cropX * 2);
      const cropH = h - (cropY * 2);
      image.crop({ x: cropX, y: cropY, w: cropW, h: cropH });
      console.log(`[Fallback Crop] ${file} (Thresh: ${Math.round(threshold)})`);
    } else {
      // Add a 10px margin
      const margin = 10;
      let cropX = Math.max(0, minX - margin);
      let cropY = Math.max(0, minY - margin);
      let cropW = Math.min(w - cropX, detectedW + margin * 2);
      let cropH = Math.min(h - cropY, detectedH + margin * 2);
      
      image.crop({ x: cropX, y: cropY, w: cropW, h: cropH });
      console.log(`[Intelligent Crop] ${file}: X=${cropX}, Y=${cropY}, W=${cropW}, H=${cropH} (Thresh: ${Math.round(threshold)})`);
    }
    
    await image.write(destPath);
  } catch (err) {
    console.error(`Error processing ${file}:`, err);
  }
}

async function processAll() {
  for (const file of files) {
    await cropImage(file);
  }
  console.log("All images processed successfully!");
}

processAll();
