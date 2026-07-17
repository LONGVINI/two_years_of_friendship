import fs from 'fs';
import path from 'path';

const publicDir = path.join(import.meta.dirname, 'public');
const aiSelectionDir = path.join(publicDir, 'ai_selection');
const cleanDir = path.join(publicDir, 'ai_selection_clean');

const originalFiles = fs.readdirSync(aiSelectionDir).filter(f => f.endsWith('.jpg'));
const sizeToName = new Map();
originalFiles.forEach(file => {
    sizeToName.set(fs.statSync(path.join(aiSelectionDir, file)).size, file);
});

const publicFiles = fs.readdirSync(publicDir);
const matchedOriginalNames = new Set();
const unmatchedPhotoNums = [];

publicFiles.forEach(file => {
    const match = file.match(/^photo_(\d+)_2026-07-16_19-06-41\.jpg$/);
    if (match) {
        const num = parseInt(match[1], 10);
        const sz = fs.statSync(path.join(publicDir, file)).size;
        if (sizeToName.has(sz)) {
            matchedOriginalNames.add(sizeToName.get(sz));
        } else {
            unmatchedPhotoNums.push(num);
        }
    }
});

const unmatchedOriginalFiles = originalFiles.filter(f => !matchedOriginalNames.has(f));

unmatchedPhotoNums.sort((a, b) => a - b);
unmatchedOriginalFiles.sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));

let copied = 0;
for (let i = 0; i < Math.min(unmatchedPhotoNums.length, unmatchedOriginalFiles.length); i++) {
    const num = unmatchedPhotoNums[i];
    const originalName = unmatchedOriginalFiles[i];
    
    const redonePhoto = `photo_${num}_2026-07-16_19-07-48.jpg`;
    const srcPath = path.join(publicDir, redonePhoto);
    const destPath = path.join(cleanDir, originalName);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        copied++;
    }
}

console.log(`Скопировано ${copied} оставшихся файлов!`);
