// Single switch for the whole interactive layer.
// Set to false and the album turns back into a plain portfolio:
// nothing is locked, no challenges, no chains, every bookmark open.
export const INTERACTIVE_MODE = true;

// While testing: progress lives only until the page reloads.
// Set to true and achievements survive restarts again.
export const PERSIST_PROGRESS = false;

const STORAGE_KEY = 'ruz-portfolio-progress';

// Главы, у которых есть собственное испытание. Остальные открываются
// просто тем, что их пролистали целиком — иначе получился бы тупик.
export const CHAPTERS_WITH_TRIAL = ['chapter-1', 'chapter-2', 'chapter-3'];

// Временно: эти главы считаются пройденными сразу, без чтения и испытания.
// Пустой список — всё по-честному.
export const PRECLEARED_CHAPTERS = ['chapter-1', 'chapter-2'];
const CHEAT_KEY = 'ruz-portfolio-cheat';

// Отладочный ключ: пока включён, всё открыто и испытания не требуются.
// Включается в консоли браузера или сочетанием клавиш, см. ниже.
export function cheatEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CHEAT_KEY) === 'on';
  } catch (err) {
    return false;
  }
}

export function setCheat(on) {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.setItem(CHEAT_KEY, 'on');
    else window.localStorage.removeItem(CHEAT_KEY);
  } catch (err) {
    // storage unavailable
  }
}

const emptyProgress = () => ({ seen: {}, done: {} });

export function loadProgress() {
  if (typeof window === 'undefined' || !PERSIST_PROGRESS) return emptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    return {
      seen: parsed.seen && typeof parsed.seen === 'object' ? parsed.seen : {},
      done: parsed.done && typeof parsed.done === 'object' ? parsed.done : {}
    };
  } catch (err) {
    return emptyProgress();
  }
}

export function saveProgress(progress) {
  if (typeof window === 'undefined' || !PERSIST_PROGRESS) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    // storage unavailable: progress simply does not survive a reload
  }
}

export function resetProgress() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    // nothing to do
  }
}

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
  if (cheatEnabled()) return true;
  if (PRECLEARED_CHAPTERS.includes(chapterId)) return true;
  return chapterFullySeen(drawings, chapterId, progress.seen)
    && chapterChallengeDone(chapterId, progress.done);
}

// Chapters unlock in order: the first is always open, the rest wait for the previous one
export function buildUnlockMap(drawings, progress) {
  const chapters = drawings.filter((d) => d.type === 'chapter');
  const unlocked = {};

  if (cheatEnabled()) {
    chapters.forEach((chapter) => { unlocked[chapter.id] = true; });
    return unlocked;
  }

  let previousCleared = true;

  chapters.forEach((chapter, index) => {
    unlocked[chapter.id] = index === 0 ? true : previousCleared;
    previousCleared = previousCleared && chapterCleared(drawings, chapter.id, progress);
  });

  return unlocked;
}
