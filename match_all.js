import fs from 'fs';
import path from 'path';

const publicDir = path.join(import.meta.dirname, 'public');
const dirsToScan = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026', 'Общее'];

const sizeToName = new Map();

// Scan all original directories
for (const dir of dirsToScan) {
    const fullPath = path.join(publicDir, dir);
    if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath);
        for (const file of files) {
            if (file.endsWith('.jpg')) {
                const stats = fs.statSync(path.join(fullPath, file));
                sizeToName.set(stats.size, file);
            }
        }
    }
}

// Now match photo_X_19-06-41
const publicFiles = fs.readdirSync(publicDir);
const numToOriginalName = new Map();
let matched = 0;
let total = 0;

publicFiles.forEach(file => {
    const match = file.match(/^photo_(\d+)_2026-07-16_19-06-41\.jpg$/);
    if (match) {
        total++;
        const num = match[1];
        const stats = fs.statSync(path.join(publicDir, file));
        if (sizeToName.has(stats.size)) {
            numToOriginalName.set(num, sizeToName.get(stats.size));
            matched++;
        }
    }
});

console.log(`Matched ${matched} out of ${total} original files by size.`);

const cleanDir = path.join(publicDir, 'ai_selection_clean');
if (!fs.existsSync(cleanDir)) fs.mkdirSync(cleanDir);

// Copy the new files
let copiedCount = 0;
publicFiles.forEach(file => {
    const match = file.match(/^photo_(\d+)_2026-07-16_19-07-48\.jpg$/);
    if (match) {
        const num = match[1];
        if (numToOriginalName.has(num)) {
            const originalName = numToOriginalName.get(num);
            const srcPath = path.join(publicDir, file);
            const destPath = path.join(cleanDir, originalName);
            fs.copyFileSync(srcPath, destPath);
            copiedCount++;
        }
    }
});

console.log(`Copied ${copiedCount} redone photos to ai_selection_clean.`);
