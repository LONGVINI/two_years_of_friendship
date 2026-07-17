import fs from 'fs';
import path from 'path';

const publicDir = path.join(import.meta.dirname, 'public');
const cleanDir = path.join(publicDir, 'ai_selection_clean');
const albumPath = path.join(publicDir, 'album.json');

const files = fs.readdirSync(cleanDir).filter(f => f.endsWith('.jpg'));

// Natural sort for files
files.sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));

const themes = {
  '2019': { bgStart: "#061f22", bgEnd: "#020b0c", primary: "#2dd4bf", primaryRgb: "45, 212, 191", glass: "rgba(6, 31, 34, 0.7)" },
  '2020': { bgStart: "#220615", bgEnd: "#0c0207", primary: "#f43f5e", primaryRgb: "244, 63, 94", glass: "rgba(34, 6, 21, 0.7)" },
  '2021': { bgStart: "#1e2206", bgEnd: "#0a0c02", primary: "#eab308", primaryRgb: "234, 179, 8", glass: "rgba(30, 34, 6, 0.7)" },
  '2022': { bgStart: "#0f0622", bgEnd: "#05020c", primary: "#818cf8", primaryRgb: "129, 140, 248", glass: "rgba(15, 6, 34, 0.7)" },
  '2023': { bgStart: "#061822", bgEnd: "#02090c", primary: "#22d3ee", primaryRgb: "34, 211, 238", glass: "rgba(6, 24, 34, 0.7)" },
  '2024': { bgStart: "#221106", bgEnd: "#0c0602", primary: "#f97316", primaryRgb: "249, 115, 22", glass: "rgba(34, 17, 6, 0.7)" },
  '2025': { bgStart: "#062211", bgEnd: "#020c06", primary: "#22c55e", primaryRgb: "34, 197, 94", glass: "rgba(6, 34, 17, 0.7)" },
  '2026': { bgStart: "#1a0622", bgEnd: "#09020c", primary: "#d946ef", primaryRgb: "217, 70, 239", glass: "rgba(26, 6, 34, 0.7)" }
};

const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const filesPerYear = Math.ceil(files.length / years.length);

const album = files.map((file, i) => {
    // Distribute files evenly across the 8 years
    const yearIndex = Math.floor(i / filesPerYear);
    const year = years[yearIndex] || '2026';

    return {
        id: i + 1,
        image: `ai_selection_clean/${file}`,
        title: `Рисунок ${year} #${(i % filesPerYear) + 1}`,
        year: year,
        date: `${year} г.`,
        description: "Один из прекрасных рисунков этого периода, выбранный для альбома нашей дружбы.",
        story: "Здесь будет твоя история об этой работе, чувствах или воспоминаниях. Вырази свои мысли здесь.",
        eraTheme: themes[year]
    };
});

fs.writeFileSync(albumPath, JSON.stringify(album, null, 2), 'utf-8');
console.log(`Successfully generated album.json with ${album.length} items across all years.`);
