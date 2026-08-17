// Single switch for the whole interactive layer.
// Set to false and the album turns back into a plain portfolio:
// nothing is locked, no challenges, no chains, every bookmark open.
export const INTERACTIVE_MODE = true;

// Прогресс живёт только в памяти вкладки: ни хранилища, ни ключей, ни отмычек.
// Каждый заход начинается с обложки и Тёмной тропы, а главы открываются
// одна за другой, честным чтением и пройденным испытанием.

// Главы, у которых есть собственное испытание. Остальные открываются
// просто тем, что их пролистали целиком — иначе получился бы тупик.
export const CHAPTERS_WITH_TRIAL = ['chapter-1', 'chapter-2', 'chapter-3', 'chapter-4'];

// Every drawing of a chapter must have been opened at least once
export function chapterFullySeen(drawings, chapterId, seen) {
  const pages = drawings.filter((d) => d.chapterId === chapterId);
  if (pages.length === 0) return true;
  return pages.every((d) => seen[d.id]);
}

export function chapterChallengeDone(chapterId, done) {
  if (!CHAPTERS_WITH_TRIAL.includes(chapterId)) return true;
  return Boolean(done[chapterId]);
}

// A chapter is cleared when it has been read through and its challenge is solved
export function chapterCleared(drawings, chapterId, progress) {
  return chapterFullySeen(drawings, chapterId, progress.seen)
    && chapterChallengeDone(chapterId, progress.done);
}

// Chapters unlock in order: the first is always open, the rest wait for the previous one
export function buildUnlockMap(drawings, progress) {
  const chapters = drawings.filter((d) => d.type === 'chapter');
  const unlocked = {};

  let previousCleared = true;

  chapters.forEach((chapter, index) => {
    unlocked[chapter.id] = index === 0 ? true : previousCleared;
    previousCleared = previousCleared && chapterCleared(drawings, chapter.id, progress);
  });

  return unlocked;
}
