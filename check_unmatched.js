import fs from 'fs';
import path from 'path';

const publicDir = path.join(import.meta.dirname, 'public');
const dirsToScan = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026', 'Общее'];
const sizeToName = new Map();

for (const dir of dirsToScan) {
    const fullPath = path.join(publicDir, dir);
    if (fs.existsSync(fullPath)) {
        for (const file of fs.readdirSync(fullPath)) {
            if (file.endsWith('.jpg')) {
                sizeToName.set(fs.statSync(path.join(fullPath, file)).size, file);
            }
        }
    }
}

const publicFiles = fs.readdirSync(publicDir);
const numToOriginalName = new Map();

publicFiles.forEach(file => {
    const match = file.match(/^photo_(\d+)_2026-07-16_19-06-41\.jpg$/);
    if (match) {
        const num = match[1];
        const sz = fs.statSync(path.join(publicDir, file)).size;
        if (sizeToName.has(sz)) {
            numToOriginalName.set(num, sizeToName.get(sz));
        } else {
            console.log(`Unmatched 19-06-41 file: photo_${num} (size: ${sz})`);
        }
    }
});

publicFiles.forEach(file => {
    const match = file.match(/^photo_(\d+)_2026-07-16_19-07-48\.jpg$/);
    if (match) {
        const num = match[1];
        if (!numToOriginalName.has(num)) {
            console.log(`Uncopied 19-07-48 file: photo_${num}`);
        }
    }
});
