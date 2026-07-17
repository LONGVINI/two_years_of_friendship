import fs from 'fs';
import path from 'path';

const publicDir = path.join(import.meta.dirname, 'public');
const aiSelectionDir = path.join(publicDir, 'ai_selection');
const cleanDir = path.join(publicDir, 'ai_selection_clean');

// 1. Map size -> original filename in ai_selection
const originalFiles = fs.readdirSync(aiSelectionDir);
const sizeToName = new Map();
originalFiles.forEach(file => {
    if (!file.endsWith('.jpg')) return;
    const stats = fs.statSync(path.join(aiSelectionDir, file));
    sizeToName.set(stats.size, file);
});

// 2. Find photo_X_19-06-41.jpg and map X to original filename
const publicFiles = fs.readdirSync(publicDir);
const numToOriginalName = new Map();

publicFiles.forEach(file => {
    const match = file.match(/^photo_(\d+)_2026-07-16_19-06-41\.jpg$/);
    if (match) {
        const num = match[1];
        const stats = fs.statSync(path.join(publicDir, file));
        if (sizeToName.has(stats.size)) {
            numToOriginalName.set(num, sizeToName.get(stats.size));
        }
    }
});

// 3. For each photo_X_19-07-48.jpg, copy it to ai_selection_clean/OriginalName
let copiedCount = 0;
publicFiles.forEach(file => {
    // 19-07-48 are the newer "redone" ones
    const match = file.match(/^photo_(\d+)_2026-07-16_19-07-48\.jpg$/);
    if (match) {
        const num = match[1];
        if (numToOriginalName.has(num)) {
            const originalName = numToOriginalName.get(num);
            const srcPath = path.join(publicDir, file);
            const destPath = path.join(cleanDir, originalName);
            // Overwrite in cleanDir, leaving photo_* untouched
            fs.copyFileSync(srcPath, destPath);
            copiedCount++;
        }
    }
});

console.log(`Успешно сопоставлено и скопировано ${copiedCount} файлов!`);
