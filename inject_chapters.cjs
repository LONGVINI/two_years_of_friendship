const fs = require('fs');

try {
  const album = JSON.parse(fs.readFileSync('public/album.json', 'utf8'));

  // Remove existing chapters if any (idempotency)
  const cleanAlbum = album.filter(item => !item.type);

  const chapters = [
    { title: 'Генезис', subtitle: 'Начало пути и первые эксперименты с формой.', theme: { bgStart: '#0c0d14', bgEnd: '#050508', primary: '#a78bfa', primaryRgb: '167, 139, 250', glass: 'rgba(17, 19, 31, 0.65)' } },
    { title: 'Мрак и Поиск', subtitle: 'Период внутренних сомнений и глубоких теней.', theme: { bgStart: '#140c0c', bgEnd: '#080505', primary: '#fa8b8b', primaryRgb: '250, 139, 139', glass: 'rgba(31, 17, 17, 0.65)' } },
    { title: 'Ренессанс', subtitle: 'Возрождение, яркие краски и новые горизонты.', theme: { bgStart: '#0c140d', bgEnd: '#050805', primary: '#8bfa9a', primaryRgb: '139, 250, 154', glass: 'rgba(17, 31, 19, 0.65)' } },
    { title: 'Современность', subtitle: 'Текущий этап: уверенность и мастерство.', theme: { bgStart: '#0c1014', bgEnd: '#050608', primary: '#8bc4fa', primaryRgb: '139, 196, 250', glass: 'rgba(17, 23, 31, 0.65)' } }
  ];

  const newAlbum = [];
  let chapterIndex = 0;
  
  // Distribute items roughly evenly
  const itemsPerChapter = Math.ceil(cleanAlbum.length / chapters.length);

  for (let i = 0; i < cleanAlbum.length; i++) {
    if (i % itemsPerChapter === 0 && chapterIndex < chapters.length) {
      // Insert a chapter divider
      newAlbum.push({
        id: `chapter-${chapterIndex + 1}`,
        type: 'chapter',
        title: chapters[chapterIndex].title,
        description: chapters[chapterIndex].subtitle,
        eraTheme: chapters[chapterIndex].theme,
        chapterTitle: chapters[chapterIndex].title // for bookmarks
      });
      chapterIndex++;
    }
    // modify the item to belong to the chapter
    const item = cleanAlbum[i];
    item.chapterId = `chapter-${chapterIndex}`;
    item.chapterTitle = chapters[chapterIndex - 1].title;
    // ensure item uses the chapter's theme
    item.eraTheme = chapters[chapterIndex - 1].theme;
    newAlbum.push(item);
  }

  // Add the interactive chapter at the end
  const interactiveTheme = { bgStart: '#140c14', bgEnd: '#080508', primary: '#fa8bfa', primaryRgb: '250, 139, 250', glass: 'rgba(31, 17, 31, 0.65)' };
  
  newAlbum.push({
    id: 'chapter-interactive',
    type: 'chapter',
    title: 'За гранью',
    description: 'Интерактивные эксперименты',
    eraTheme: interactiveTheme,
    chapterTitle: 'За гранью'
  });

  newAlbum.push({
    id: 'interactive-scratch',
    type: 'scratch',
    title: 'Скрытое искусство',
    description: 'Сотрите тьму, чтобы увидеть свет',
    chapterId: 'chapter-interactive',
    chapterTitle: 'За гранью',
    image: cleanAlbum[0]?.image || '/ai_selection_clean/2019_1.jpg',
    eraTheme: interactiveTheme
  });

  newAlbum.push({
    id: 'interactive-polaroids',
    type: 'polaroids',
    title: 'Воспоминания',
    description: 'Разбросанные мгновения. Поиграйте с гравитацией.',
    chapterId: 'chapter-interactive',
    chapterTitle: 'За гранью',
    eraTheme: interactiveTheme
  });

  fs.writeFileSync('public/album.json', JSON.stringify(newAlbum, null, 2));
  console.log(`Successfully injected chapters. Total items: ${newAlbum.length}`);
} catch (e) {
  console.error("Error:", e);
}
