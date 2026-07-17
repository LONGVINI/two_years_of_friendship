import fs from 'fs';

const albumPath = './public/album.json';
if (fs.existsSync(albumPath)) {
  const album = JSON.parse(fs.readFileSync(albumPath, 'utf-8'));
  const filteredAlbum = album.filter(item => !item.image.includes('2020_12.jpg'));
  
  // Re-index IDs to be sequential
  filteredAlbum.forEach((item, idx) => {
    item.id = idx + 1;
  });
  
  fs.writeFileSync(albumPath, JSON.stringify(filteredAlbum, null, 2), 'utf-8');
  console.log(`Removed 2020_12.jpg. Current count: ${filteredAlbum.length}`);
} else {
  console.error("album.json not found!");
}
