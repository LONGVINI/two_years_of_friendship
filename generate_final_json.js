import fs from 'fs';
import path from 'path';

const dir = './public/ai_selection';
if (!fs.existsSync(dir)) {
  console.error("Directory not found:", dir);
  process.exit(1);
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));

// Natural sort function to sort 2 before 10
const naturalSort = (a, b) => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

files.sort(naturalSort);

const themes = {
  '2019': { bgStart: '#061f22', bgEnd: '#020b0c', primary: '#2dd4bf', primaryRgb: '45, 212, 191', glass: 'rgba(6, 31, 34, 0.7)' },
  '2020': { bgStart: '#221506', bgEnd: '#0c0802', primary: '#fbbf24', primaryRgb: '251, 191, 36', glass: 'rgba(34, 21, 6, 0.7)' },
  '2021': { bgStart: '#220613', bgEnd: '#0c0207', primary: '#f43f5e', primaryRgb: '244, 63, 94', glass: 'rgba(34, 6, 19, 0.7)' },
  '2022': { bgStart: '#0f0622', bgEnd: '#05020c', primary: '#818cf8', primaryRgb: '129, 140, 248', glass: 'rgba(15, 6, 34, 0.7)' },
  '2023': { bgStart: '#061822', bgEnd: '#02090c', primary: '#22d3ee', primaryRgb: '34, 211, 238', glass: 'rgba(6, 24, 34, 0.7)' },
  '2024': { bgStart: '#180622', bgEnd: '#09020c', primary: '#d946ef', primaryRgb: '217, 70, 239', glass: 'rgba(24, 6, 34, 0.7)' },
  '2025': { bgStart: '#060e22', bgEnd: '#02050c', primary: '#60a5fa', primaryRgb: '96, 165, 250', glass: 'rgba(6, 14, 34, 0.7)' },
  '2026': { bgStart: '#062212', bgEnd: '#020c06', primary: '#34d399', primaryRgb: '52, 211, 153', glass: 'rgba(6, 34, 18, 0.7)' }
};

const album = files.map((file, idx) => {
  const match = file.match(/^(\d{4})_/);
  const year = match ? match[1] : '2024';
  
  const theme = themes[year] || { bgStart: '#0c0d14', bgEnd: '#050508', primary: '#a78bfa', primaryRgb: '167, 139, 250', glass: 'rgba(17, 19, 31, 0.65)' };

  // Generate prettier titles (e.g. "2024_14" -> "2024 #14")
  const titleParts = file.replace('.jpg', '').split('_');
  const numberStr = titleParts[1] ? ` #${titleParts[1]}` : '';
  const title = `Рисунок ${year}${numberStr}`;

  return {
    id: idx + 1,
    image: `ai_selection/${file}`,
    title: title,
    year: year,
    date: `${year} г.`,
    description: `Один из прекрасных рисунков этого периода, выбранный для альбома нашей дружбы.`,
    story: `Здесь будет твоя история об этой работе, чувствах или воспоминаниях. Вырази свои мысли здесь.`,
    eraTheme: theme
  };
});

fs.writeFileSync('./public/album.json', JSON.stringify(album, null, 2), 'utf-8');
console.log(`Generated album.json with ${album.length} items!`);
