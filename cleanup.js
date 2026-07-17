import fs from 'fs';
import path from 'path';

// 1. Delete all jpg files directly in ./public (the unsorted telegram files)
const publicDir = './public';
const files = fs.readdirSync(publicDir);
for (const file of files) {
  if (file.endsWith('.jpg')) {
    fs.unlinkSync(path.join(publicDir, file));
    console.log(`Deleted raw file: ${file}`);
  }
}

// 2. Delete helper scripts
const scripts = ['restore.js', 'generate_final_json.js'];
for (const script of scripts) {
  if (fs.existsSync(script)) {
    fs.unlinkSync(script);
    console.log(`Deleted helper script: ${script}`);
  }
}

console.log('Cleanup finished!');
