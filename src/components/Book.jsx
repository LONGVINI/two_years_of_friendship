import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, RefreshCw, Play, Pause, Clock, ChevronDown, Music } from 'lucide-react';
import ScratchGame from './ScratchGame';
import PolaroidGame from './PolaroidGame';
import ChapterOrnament from './ChapterOrnament';
import CornerConstellations from './CornerConstellations';
import CornerCrystals from './CornerCrystals';
import RenaissanceEyes from './RenaissanceEyes';
import EyeTrial from './EyeTrial';
import PaintingEyes, { EYE_MAPS, FINAL_WORK } from './PaintingEyes';
import GlyphText from './GlyphText';
import PentagramLayer from './PentagramLayer';
import ScreenVeins from './ScreenVeins';
import GardenLayer from './GardenLayer';
import BeyondLayer from './BeyondLayer';
import CornerShards from './CornerShards';
import BrokenSheet from './BrokenSheet';
import BeyondGate from './BeyondGate';
import { createChapterMusic } from './chapterMusic';
import CornerEyes from './CornerEyes';
import TrialOverlay from './TrialOverlay';
import GenesisTrial, { SEAM_STAGES } from './GenesisTrial';
import {
  INTERACTIVE_MODE,
  CHAPTERS_WITH_TRIAL,
  buildUnlockMap,
  chapterCleared,
  chapterFullySeen,
  chapterChallengeDone
} from '../gameState';
import './Book.css';

const ENABLE_PHOTO_FLIP = false;

// Chapters whose pages hold their artwork with stars instead of paper corners
const COSMIC_CHAPTERS = ['Тёмная тропа'];
const CRYSTAL_CHAPTERS = ['Генезис'];
const EYE_HOLD_CHAPTERS = ['Ренессанс'];
const SHARD_CHAPTERS = ['За гранью'];

// Небо идёт шагами по одной шестидесятой секунды, и всё в нём двигается на шаг.
// Этими множителями задаётся, во сколько раз быстрее прежнего идут те, кому
// медлительность не к лицу: блуждание и вращение чёрной дыры, пролёт звезды,
// разлёт осколков и ударная волна от квазара
const HOLE_SPEED = 1.7;
const METEOR_SPEED = 1.6;
const BLAST_SPEED = 1.6;

export default function Book() {
  const [drawings, setDrawings] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0); // Index of the active spread/drawing
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState(null); // 'next' or 'prev'
  
  // New Drag state
  const [dragState, setDragState] = useState({
    isDragging: false,
    angle: 0,
    direction: null,
    isReleasing: false,
    releaseDuration: 800
  });
  
  // Autoplay
  const [isPlaying, setIsPlaying] = useState(false);
  const [playInterval, setPlayInterval] = useState(15000); // 15 seconds by default
  const dragRef = useRef({
    startX: 0,
    R: 0,
    centerX: 0,
    samples: [],
    rafId: null,
    pendingAngle: null,
    pendingDirection: null
  });
  const bgRef = useRef({
    start: [5, 5, 8],
    end: [10, 10, 15]
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  // Музыка глав выключается отдельной кнопкой: страницы и сцены при этом
  // остаются со своими звуками
  const [musicEnabled, setMusicEnabled] = useState(true);
  // Громкость музыки в сотых долях. Ползунок выезжает из-под кнопки при
  // наведении и живёт вне язычка: тот прячет всё, что вылезает за его края
  const [musicVolume, setMusicVolume] = useState(50);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [volumeBox, setVolumeBox] = useState({ top: 0, right: 0 });
  const musicBtnRef = useRef(null);
  const volumeHideRef = useRef(null);
  const chapterMusicRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [soundIndex, setSoundIndex] = useState(1);
  const canvasRef = useRef(null);
  const bookRef = useRef(null);
  const particlesRef = useRef(null);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2, vx: 0, vy: 0, isDown: false, canPaint: false });
  const eraRef = useRef({
    era: 'constellation',
    primaryRgb: [45, 212, 191],
    bgStart: [5, 5, 8],
    bgEnd: [10, 10, 15],
    pageStamp: -1
  });
  const [photoFlipped, setPhotoFlipped] = useState(false);
  // Прогресс держится только в памяти вкладки: перезагрузка возвращает
  // альбом к обложке, а главы приходится открывать заново
  const [progress, setProgress] = useState({ seen: {}, done: {} });
  const challengeRef = useRef({ fed: 0, lastFedAt: 0, chapterId: null, solved: false, complete: null, trialActive: false });
  const handleNextRef = useRef(null);

  // Which chapter a page belongs to; chapter dividers carry their own id
  const chapterIdOf = (drawing) => {
    if (!drawing) return null;
    return drawing.type === 'chapter' ? drawing.id : drawing.chapterId || null;
  };

  const unlockMap = useMemo(
    () => (INTERACTIVE_MODE ? buildUnlockMap(drawings, progress) : {}),
    [drawings, progress]
  );

  const prevUnlockRef = useRef({});
  const [justUnlocked, setJustUnlocked] = useState(null);

  useEffect(() => {
    const prev = prevUnlockRef.current;
    const opened = Object.keys(unlockMap).find((id) => unlockMap[id] && prev[id] === false);
    prevUnlockRef.current = { ...unlockMap };
    if (!opened) return undefined;
    // даём догореть вспышке испытания, потом показываем разрыв цепи целиком
    const show = setTimeout(() => setJustUnlocked(opened), 420);
    const hide = setTimeout(() => setJustUnlocked(null), 420 + 2200);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [unlockMap]);

  // The last artwork of every chapter is where its trial waits
  const lastPageOfChapter = useMemo(() => {
    const map = {};
    drawings.forEach((d, i) => {
      if (d.chapterId) map[d.chapterId] = i;
    });
    return map;
  }, [drawings]);

  const currentChapterId = chapterIdOf(drawings[currentIndex]);
  const nextChapterId = chapterIdOf(drawings[currentIndex + 1]);
  const crossesChapterBorder = Boolean(currentChapterId && nextChapterId && nextChapterId !== currentChapterId);
  const forwardLocked =
    INTERACTIVE_MODE && crossesChapterBorder && !chapterCleared(drawings, currentChapterId, progress);

  const isTrialIndex = (index) => {
    const cid = chapterIdOf(drawings[index]);
    return (
      INTERACTIVE_MODE &&
      Boolean(cid) &&
      CHAPTERS_WITH_TRIAL.includes(cid) &&
      index === lastPageOfChapter[cid] &&
      !progress.done[cid]
    );
  };

  const trialActive = isTrialIndex(currentIndex);

  const missPoolRef = useRef(null);
  const [seamAspect, setSeamAspect] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [rush, setRush] = useState(null);
  const rushTimers = useRef([]);
  const [eyeEscapes, setEyeEscapes] = useState(0);
  const [eyesClosed, setEyesClosed] = useState({});
  const [eyeScatter, setEyeScatter] = useState(false);
  // Сад распускается целиком, когда цепи главы пали
  const [gardenBloom, setGardenBloom] = useState(false);
  // Граница глав: сцена с огоньком, стеной и чистой книгой
  const [beyondScene, setBeyondScene] = useState(false);
  // Белизна финала живёт дольше самой сцены: книга меняется под ней
  const [whiteVeil, setWhiteVeil] = useState(0);
  const [bookDrift, setBookDrift] = useState(0);
  const [blackout, setBlackout] = useState(false);
  // Прощание знака: слой держится ещё несколько секунд после начертанного глаза,
  // разгорается, проворачивается и гаснет, отпуская работу
  const [unveil, setUnveil] = useState(false);
  const unveilTimers = useRef([]);
  const [beaconCry, setBeaconCry] = useState(null);
  const hurledRef = useRef(false);
  const playPaperSoundRef = useRef(null);
  const [seamStage, setSeamStage] = useState(0);
  const [seamHits, setSeamHits] = useState(0);
  const seamRef = useRef(null);
  // «Слепое предчувствие» — маяк главы. Впервые дойдя до неё, книгу
  // отшвыривает в конец Ренессанса: дальше идти можно только назад.
  const BEACON_TITLE = 'Слепое предчувствие';

  // Переброс живёт вне эффекта: смена страницы перезапускала бы его и
  // сбрасывала собственные таймеры, оставляя экран чёрным навсегда
  const hurlTimers = useRef([]);
  // Пока сцена идёт, ввод книги мёртв: иначе успевшее уйти перетаскивание
  // доводит страницу до конца уже под темнотой, и человек оказывается не там
  const sceneLockRef = useRef(false);
  const [sceneLocked, setSceneLocked] = useState(false);
  const lockScene = useCallback((on) => {
    sceneLockRef.current = on;
    setSceneLocked(on);
  }, []);

  const hurlTo = useCallback((index) => {
    hurlTimers.current.forEach(clearTimeout);
    lockScene(true);
    setBlackout(true);
    hurlTimers.current = [
      // страница шелестит в самой глубине темноты, когда смотреть уже не на что
      setTimeout(() => playPaperSoundRef.current && playPaperSoundRef.current(), 1500),
      setTimeout(() => setCurrentIndex(index), 2100),
      setTimeout(() => setBlackout(false), 2600),
      setTimeout(() => lockScene(false), 3400)
    ];
  }, [lockScene]);

  useEffect(() => () => hurlTimers.current.forEach(clearTimeout), []);
  useEffect(() => () => unveilTimers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!INTERACTIVE_MODE) return;
    const here = drawings[currentIndex];
    if (!here || here.title !== BEACON_TITLE) return;
    if (progress.done['chapter-3'] || hurledRef.current) return;
    const last = lastPageOfChapter['chapter-3'];
    if (last === undefined) return;
    hurledRef.current = true;

    // Первый заход: тьма съедает разворот целиком, из неё кричит «ВЕРНИСЬ!»,
    // шелестит страница — и человек уже у жрицы. Задника он не увидит.
    hurlTimers.current.forEach(clearTimeout);
    lockScene(true);
    setBlackout(true);
    hurlTimers.current = [
      setTimeout(() => setBeaconCry('ВЕРНИСЬ!'), 1800),
      setTimeout(() => playPaperSoundRef.current && playPaperSoundRef.current(), 4600),
      setTimeout(() => setBeaconCry(null), 4900),
      setTimeout(() => setCurrentIndex(last), 5200),
      setTimeout(() => setBlackout(false), 6000),
      setTimeout(() => lockScene(false), 6800)
    ];
  }, [currentIndex, drawings, progress, lastPageOfChapter, hurlTo, lockScene]);

  // Вернувшись к маяку и замерев, слышишь второе: чего от тебя хотят
  useEffect(() => {
    if (!INTERACTIVE_MODE) return undefined;
    const here = drawings[currentIndex];
    const atBeacon = Boolean(here && here.title === BEACON_TITLE && hurledRef.current);
    if (!atBeacon || progress.done['chapter-3']) return undefined;
    // пока идёт сама сцена, второй крик молчит: иначе он успевает мигнуть
    // поверх первого, пока темнота ещё не разошлась
    if (sceneLocked || blackout) return undefined;

    let idle = null;
    const wake = () => {
      clearTimeout(idle);
      setBeaconCry((prev) => (prev === 'ОТДАЙ СВОЙ ГЛАЗ' ? null : prev));
      idle = setTimeout(() => setBeaconCry('ОТДАЙ СВОЙ ГЛАЗ'), 3200);
    };
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    return () => {
      clearTimeout(idle);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      setBeaconCry(null);
    };
  }, [currentIndex, drawings, progress, sceneLocked, blackout]);

  // У маяка глаза отводят взгляд от работы: зрачки уходят прочь от середины
  useEffect(() => {
    if (!INTERACTIVE_MODE) { setEyeScatter(false); return undefined; }
    const here = drawings[currentIndex];
    setEyeScatter(Boolean(here && here.title === BEACON_TITLE && hurledRef.current));
    return undefined;
  }, [currentIndex, drawings]);

  // Пока на странице остались открытые глаза, назад не уйти: ни стрелкой,
  // ни перетаскиванием. Вперёд — пожалуйста.
  const eyesHere = drawings[currentIndex] ? EYE_MAPS[drawings[currentIndex].title] : null;
  const backLocked = Boolean(
    INTERACTIVE_MODE && eyesHere && !progress.done['chapter-3'] &&
    (eyesClosed[drawings[currentIndex].title] || []).length < eyesHere.length
  );

  // Замок стоит на последнем развороте Переосмысления, у самой границы глав
  const chainGateHere = Boolean(
    INTERACTIVE_MODE &&
    currentChapterId === 'chapter-4' &&
    !progress.done['chapter-4'] &&
    currentIndex === lastPageOfChapter['chapter-4']
  );
  const chainGateRef = useRef(chainGateHere);
  useEffect(() => { chainGateRef.current = chainGateHere; }, [chainGateHere]);

  // Сцена запускается один раз: с этого мига книга больше не слушается рук
  const startedBeyondRef = useRef(false);
  const startBeyondRef = useRef(() => {});
  const startBeyond = useCallback((fromAngle) => {
    if (startedBeyondRef.current || !chainGateRef.current) return;
    startedBeyondRef.current = true;
    // рука больше не ведёт лист: дальше он идёт сам
    dragRef.current.pendingAngle = null;
    dragRef.current.pendingDirection = null;
    lockScene(true);

    // сколько ещё осталось поднять: подхваченный рукой лист идёт вверх меньше
    const from = Math.abs(fromAngle || 0);
    const lift = Math.round(Math.max(500, (52 - from) * 27));

    // Лист сперва встаёт туда, где он сейчас, и только следующим кадром идёт
    // вверх: иначе при нажатии он появляется уже поднятым, без всякого хода
    setDragState({
      isDragging: false,
      angle: -from,
      direction: 'next',
      isReleasing: true,
      releaseDuration: lift,
      releaseEase: 'cubic-bezier(0.22, 0.55, 0.25, 1)'
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setDragState((prev) => (prev.direction === 'next' ? { ...prev, angle: -52 } : prev));
    }));

    // из-под приподнятого края выбирается огонёк
    const sparkAt = lift + 120;
    setTimeout(() => setBeyondScene(true), sparkAt);

    // лист стоит открытым, пока свет выползает, и лишь потом ложится обратно
    const closeAt = sparkAt + 1200;
    setTimeout(() => setDragState({
      isDragging: false,
      angle: 0,
      direction: 'next',
      isReleasing: true,
      releaseDuration: 1700,
      releaseEase: 'cubic-bezier(0.34, 0.02, 0.26, 1)'
    }), closeAt);
    setTimeout(() => setDragState({
      isDragging: false, angle: 0, direction: null, isReleasing: false, releaseDuration: 800
    }), closeAt + 1750);
  }, [lockScene]);
  useEffect(() => { startBeyondRef.current = startBeyond; }, [startBeyond]);

  const [tamed, setTamed] = useState(false);
  const [decor, setDecor] = useState(null);
  const [holdingGem, setHoldingGem] = useState(false);

  useEffect(() => {
    if (!INTERACTIVE_MODE) return;
    fetch(`${import.meta.env.BASE_URL}decor/manifest.json`)
      .then((res) => res.json())
      .then(setDecor)
      .catch(() => setDecor(null));
  }, []);
  const [lockNudge, setLockNudge] = useState(0);
  const [straining, setStraining] = useState(false);
  const refuseForward = useCallback(() => {
    setLockNudge((n) => n + 1);
    setStraining(true);
  }, []);

  useEffect(() => {
    if (!straining) return undefined;
    const id = setTimeout(() => setStraining(false), 430);
    return () => clearTimeout(id);
  }, [straining, lockNudge]);


  // Fetch drawings list
  const isCoverClosed = currentIndex === 0 && !isFlipping && !dragState.isDragging && !dragState.isReleasing;

  // Theme switches at flip start so colors morph while the page is in flight.
  // A released drag settles on 180 degrees only when the turn completes, so the
  // same morph starts there instead of jumping after the page has landed.
  let themeIndex = currentIndex;
  if (isFlipping && flipDirection === 'next') themeIndex = Math.min(currentIndex + 1, drawings.length - 1);
  else if (isFlipping && flipDirection === 'prev') themeIndex = Math.max(currentIndex - 1, 0);
  else if (dragState.isReleasing && dragState.angle === -180) themeIndex = Math.min(currentIndex + 1, drawings.length - 1);
  else if (dragState.isReleasing && dragState.angle === 180) themeIndex = Math.max(currentIndex - 1, 0);

  // Балка стыка встаёт на место уже в полёте страницы, а не после её посадки.
  // Ручное перетаскивание тоже считается: разворот виден задолго до отпускания.
  let seamIndex = themeIndex;
  if (dragState.isDragging && dragState.direction === 'next') {
    seamIndex = Math.min(currentIndex + 1, drawings.length - 1);
  } else if (dragState.isDragging && dragState.direction === 'prev') {
    seamIndex = Math.max(currentIndex - 1, 0);
  }
  // Пока задание висит, балка не снимается: листание назад её не убирает,
  // страница испытания остаётся с тем же отступом текста
  if (!isTrialIndex(seamIndex) && isTrialIndex(currentIndex)) seamIndex = currentIndex;


  const seamVisible = isTrialIndex(seamIndex) && chapterIdOf(drawings[seamIndex]) === 'chapter-2';

  // Какая музыка положена развороту. Голос меняется на том же индексе, что и
  // цвет, поэтому новая глава начинает звучать уже в полёте страницы. Музыки
  // нет только на обложке; последний надорванный лист остаётся с музыкой
  // своей главы
  const musicPage = drawings[themeIndex];
  const musicKey = !musicPage || musicPage.isCover ? null : chapterIdOf(musicPage);

  useEffect(() => {
    const music = createChapterMusic();
    chapterMusicRef.current = music;
    // браузер не отдаёт звук до первого действия человека, поэтому музыка
    // просыпается на первом касании или нажатии клавиши
    const wake = () => {
      music.start();
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
      music.stop(0.6);
      chapterMusicRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (chapterMusicRef.current) chapterMusicRef.current.setChapter(musicKey);
  }, [musicKey]);

  useEffect(() => {
    if (chapterMusicRef.current) chapterMusicRef.current.setMuted(!musicEnabled || !soundEnabled);
  }, [musicEnabled, soundEnabled]);

  useEffect(() => {
    if (chapterMusicRef.current) chapterMusicRef.current.setVolume(musicVolume / 100);
  }, [musicVolume]);

  // Ползунок держится, пока мышь идёт от кнопки к нему, и убирается с задержкой
  const showVolume = useCallback(() => {
    if (volumeHideRef.current) {
      clearTimeout(volumeHideRef.current);
      volumeHideRef.current = null;
    }
    const btn = musicBtnRef.current;
    if (btn) {
      const box = btn.getBoundingClientRect();
      setVolumeBox({
        top: box.top + box.height / 2,
        right: Math.max(12, window.innerWidth - box.left + 12)
      });
    }
    setVolumeOpen(true);
  }, []);

  const hideVolume = useCallback(() => {
    if (volumeHideRef.current) clearTimeout(volumeHideRef.current);
    volumeHideRef.current = setTimeout(() => setVolumeOpen(false), 280);
  }, []);

  useEffect(() => () => {
    if (volumeHideRef.current) clearTimeout(volumeHideRef.current);
  }, []);

  useEffect(() => {
    if (!panelOpen) setVolumeOpen(false);
  }, [panelOpen]);

  // За гранью играет свой рояль, и под темнотой главы книге положено молчать
  useEffect(() => {
    if (chapterMusicRef.current) chapterMusicRef.current.setDucked(beyondScene || blackout);
  }, [beyondScene, blackout]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}album.json`)
      .then((res) => res.json())
      .then((data) => {
        const coverDrawing = {
          id: 'cover',
          isCover: true,
          year: '2016',
          eraTheme: { bg: ['#111111', '#1a1a2e'], primary: '#2dd4bf' }
        };
        setDrawings([coverDrawing, ...data]);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Ошибка загрузки манифеста альбома:', err);
        setLoading(false);
      });
  }, []);

  // Helper for colors
  const hexToRgb = (hex) => {
    if (!hex) return [0,0,0];
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0,0,0];
  };

  // Era theme target for the persistent background loop (no loop restart on page change)
  useEffect(() => {
    if (drawings.length === 0 || !drawings[themeIndex]) return;
    const activeDrawing = drawings[themeIndex];
    let refDrawing = activeDrawing;
    if (!refDrawing.year) {
      for (let i = themeIndex + 1; i < drawings.length; i++) {
        if (drawings[i]?.year) {
          refDrawing = drawings[i];
          break;
        }
      }
    }
    const chapterEraMap = {
      'Тёмная тропа': 'constellation',
      'Генезис': 'cave',
      'Ренессанс': 'gloom',
      'Переосмысление': 'garden',
      'За гранью': 'watercolor'
    };

    let era = chapterEraMap[refDrawing?.chapterTitle] || chapterEraMap[activeDrawing?.chapterTitle];
    if (!era) {
      const currentYear = parseInt(refDrawing?.year || 2016);
      era = 'watercolor';
      if (currentYear <= 2018) era = 'constellation';
      else if (currentYear <= 2020) era = 'fog';
      else if (currentYear <= 2022) era = 'sparks';
      else if (currentYear <= 2024) era = 'orbit';
    }

    const theme = activeDrawing?.eraTheme || {};
    const bgStartHex = theme.bgStart || (theme.bg && theme.bg[0]) || '#050508';
    const bgEndHex = theme.bgEnd || (theme.bg && theme.bg[1]) || '#0a0a0f';
    eraRef.current = {
      era,
      primaryRgb: hexToRgb(theme.primary || '#2dd4bf'),
      bgStart: hexToRgb(bgStartHex),
      bgEnd: hexToRgb(bgEndHex),
      pageStamp: themeIndex
    };
  }, [themeIndex, drawings]);

  // Every opened drawing is remembered: a chapter only clears once all of it was read
  useEffect(() => {
    if (!INTERACTIVE_MODE) return;
    const drawing = drawings[currentIndex];
    if (!drawing || !drawing.chapterId || drawing.type === 'chapter') return;
    setProgress((prev) => {
      if (prev.seen[drawing.id]) return prev;
      const next = { seen: { ...prev.seen, [drawing.id]: true }, done: prev.done };
      return next;
    });
  }, [currentIndex, drawings]);

  // Challenges report their success through this
  const completeChallenge = useCallback((chapterId) => {
    if (!INTERACTIVE_MODE || !chapterId) return;
    setProgress((prev) => {
      if (prev.done[chapterId]) return prev;
      const next = { seen: prev.seen, done: { ...prev.done, [chapterId]: true } };
      return next;
    });
  }, []);

  // The canvas loop lives in its own closure, so it reads the challenge state through a ref
  useEffect(() => {
    challengeRef.current.chapterId = currentChapterId;
    challengeRef.current.complete = completeChallenge;
    challengeRef.current.solved = Boolean(currentChapterId && progress.done[currentChapterId]);
    challengeRef.current.trialActive = trialActive;
    challengeRef.current.tamed = tamed;
    challengeRef.current.onTamed = () => setTamed(true);
  }, [currentChapterId, completeChallenge, progress, trialActive, tamed]);

  // Leaving the trial page puts the darkness back out of reach
  useEffect(() => {
    if (!trialActive) setTamed(false);
  }, [trialActive, currentChapterId]);

  // Preload and decode neighbor images so flips do not jank on synchronous decode
  useEffect(() => {
    if (drawings.length === 0) return;
    [currentIndex + 1, currentIndex + 2, currentIndex - 1].forEach((i) => {
      const d = drawings[i];
      if (d && d.image) {
        const img = new Image();
        img.src = `${import.meta.env.BASE_URL}${d.image}`;
        if (img.decode) img.decode().catch(() => {});
      }
    });
  }, [currentIndex, drawings]);

  // Background particle animation system (Dynamic Eras)
  useEffect(() => {
    if (loading || drawings.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationId;
    let width = window.innerWidth;
    let height = window.innerHeight;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    // Half-resolution ink layer for the Renaissance drawing effect
    // Star sprite cache: redrawing a radial gradient per star per frame is what
    // used to force a low star ceiling, so the glow is baked once and blitted
    const starSprite = document.createElement('canvas');
    starSprite.width = 64;
    starSprite.height = 64;
    const starSpriteCtx = starSprite.getContext('2d');
    const spriteState = { color: null };

    const refreshStarSprite = (rgba) => {
      if (spriteState.color === rgba) return;
      spriteState.color = rgba;
      starSpriteCtx.clearRect(0, 0, 64, 64);
      const g = starSpriteCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, `${rgba}, 1)`);
      g.addColorStop(0.3, `${rgba}, 0.3)`);
      g.addColorStop(1, 'transparent');
      starSpriteCtx.fillStyle = g;
      starSpriteCtx.fillRect(0, 0, 64, 64);
    };

    const paintCanvas = document.createElement('canvas');
    paintCanvas.width = Math.max(1, Math.ceil(width / 2));
    paintCanvas.height = Math.max(1, Math.ceil(height / 2));
    const paintCtx = paintCanvas.getContext('2d');
    const paintState = { lastX: null, lastY: null, nextDropAt: 0, frame: 0 };

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const pw = Math.max(1, Math.ceil(width / 2));
      const ph = Math.max(1, Math.ceil(height / 2));
      if (paintCanvas.width !== pw || paintCanvas.height !== ph) {
        const snapshot = document.createElement('canvas');
        snapshot.width = paintCanvas.width;
        snapshot.height = paintCanvas.height;
        snapshot.getContext('2d').drawImage(paintCanvas, 0, 0);
        paintCanvas.width = pw;
        paintCanvas.height = ph;
        paintCtx.drawImage(snapshot, 0, 0, pw, ph);
      }
      if (particlesRef.current) particlesRef.current.dust = null;
    };
    
    const handlePointerMove = (e) => {
      const m = mouseRef.current;
      m.vx = e.clientX - m.x;
      m.vy = e.clientY - m.y;
      m.x = e.clientX;
      m.y = e.clientY;
      // Update global CSS variables for ambient lights in index.css
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };

    const handleGlobalPointerDown = (e) => {
      mouseRef.current.isDown = true;
      mouseRef.current.canPaint = !(e.target && e.target.closest && e.target.closest('.book, .controls-panel, .side-nav-container, .book-bookmarks, .album-header'));
    };
    const handleGlobalPointerUp = () => {
      mouseRef.current.isDown = false;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerdown', handleGlobalPointerDown);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    let fastClear = 0;
    let prevStamp = eraRef.current.pageStamp;
    let nextShootAt = 0;
    let nextEmberAt = 0;
    let nextHoleAt = 0;
    let nextQuasarAt = 0;
    let nextNovaAt = 0;
    let nextBirthAt = 0;
    let trial_nextForcedHole = 0;

    // Initialize unified particles on mount or if physics state is missing
    if (!particlesRef.current || !particlesRef.current.particles || !particlesRef.current.physics) {
      const particles = [];
      for (let i = 0; i < 70; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: Math.random() * 2 + 1,
          alpha: Math.random() * 0.5 + 0.1,
          angle: Math.random() * Math.PI * 2, // for orbit
          orbitRadius: Math.random() * 200 + 50
        });
      }
      particlesRef.current = {
        particles,
        cosmic: [],
        dust: null,
        sky: { driftX: 0.04, driftY: 0.012, phase: Math.random() * Math.PI * 2, dustAlpha: 0 },
        physics: {
          upwardForce: 0,
          centerGravity: 0,
          orbitSpeed: 0,
          randomJitter: 0.1,
          targetSize: 2,
          lineOpacity: 0,
          glowMultiplier: 4,
          primaryColor: [45, 212, 191], // rgb array
          friction: 0.95
        }
      };
    }

    // Genesis sky: helpers that seed permanent stars and rare cosmic events
    const STAR_LIMIT = 2000;
    const STAR_HARD_CAP = 2600;
    let starSeq = 1;

    const ensureCosmic = () => {
      if (!particlesRef.current.cosmic) particlesRef.current.cosmic = [];
      if (!particlesRef.current.sky) {
        particlesRef.current.sky = { driftX: 0.04, driftY: 0.012, phase: Math.random() * Math.PI * 2 };
      }
      return particlesRef.current.cosmic;
    };

    const spawnStar = (x, y, extra = {}) => {
      particlesRef.current.particles.push({
        sid: starSeq++,
        links: null,
        x, y,
        bx: x,
        by: y,
        wamp: 0.5 + Math.random() * 1.3,
        wsp: 0.0003 + Math.random() * 0.0005,
        wph: Math.random() * Math.PI * 2,
        vx: 0,
        vy: 0,
        size: 0.4,
        birthSize: 1.2 + Math.random() * 1.6,
        alpha: 0,
        targetAlpha: 0.35 + Math.random() * 0.45,
        fadeIn: 0.03 + Math.random() * 0.03,
        star: true,
        angle: Math.random() * Math.PI * 2,
        orbitRadius: Math.random() * 200 + 50,
        ...extra
      });
      return particlesRef.current.particles[particlesRef.current.particles.length - 1];
    };

    const spawnBurst = (x, y, count, power, tint) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = power * (0.4 + Math.random() * 0.9) * BLAST_SPEED;
        particlesRef.current.particles.push({
          x, y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          size: 1 + Math.random() * 2.5,
          alpha: 1,
          decay: 0.012 + Math.random() * 0.02,
          hot: tint,
          angle: 0, orbitRadius: 0
        });
      }
    };

    const spawnShock = (x, y, maxR, tint) => {
      ensureCosmic().push({ type: 'shock', x, y, r: 2, maxR, tint, alpha: 1 });
    };

    const spawnQuasar = (x, y) => {
      const now = performance.now();
      ensureCosmic().push({
        type: 'quasar',
        x, y,
        bornAt: now,
        explodeAt: now + 2000 + Math.random() * 2600,
        angle: Math.random() * Math.PI
      });
    };

    const spawnBlackHole = () => {
      const cosmic = ensureCosmic();
      if (cosmic.filter((ev) => ev.type === 'blackhole').length >= 3) return;
      const fromLeft = Math.random() < 0.5;
      cosmic.push({
        type: 'blackhole',
        x: fromLeft ? -60 : width + 60,
        y: Math.random() * height * 0.8 + height * 0.1,
        vx: (fromLeft ? 1 : -1) * (0.7 + Math.random() * 0.6) * HOLE_SPEED,
        vy: (Math.random() - 0.5) * 0.25 * HOLE_SPEED,
        r: 13 + Math.random() * 9,
        eaten: 0,
        spin: 0
      });
    };

    const spawnConstellation = (x, y, headingOverride) => {
      const count = 3 + Math.floor(Math.random() * 4);
      const born = [];

      // Each figure sails its own way at its own pace
      const heading = headingOverride === undefined ? Math.random() * Math.PI * 2 : headingOverride;
      const speed = 0.03 + Math.random() * 0.14;
      const gvx = Math.cos(heading) * speed;
      const gvy = Math.sin(heading) * speed;

      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 30 + Math.random() * 80;
        born.push(spawnStar(x + Math.cos(a) * r, y + Math.sin(a) * r, { gvx, gvy }));
      }

      // Fixed skeleton: a walk through the group plus at most one branch,
      // so the figure keeps its shape instead of meshing with the whole sky
      born.sort((a, b) => (a.x - b.x) + (a.y - b.y) * 0.4);
      const link = (from, to) => {
        const len = Math.hypot(from.x - to.x, from.y - to.y);
        from.links = [...(from.links || []), { sid: to.sid, len }];
      };
      for (let i = 0; i < born.length - 1; i++) link(born[i], born[i + 1]);
      if (born.length > 3 && Math.random() < 0.65) {
        const from = Math.floor(Math.random() * (born.length - 2));
        const to = from + 2 + Math.floor(Math.random() * (born.length - from - 2));
        if (born[to]) link(born[from], born[to]);
      }

      const roll = Math.random();
      if (roll < 0.05) {
        spawnQuasar(x, y);
      } else if (roll < 0.24 && born.length) {
        // Supernova: one of the fresh stars is already doomed
        const doomed = born[Math.floor(Math.random() * born.length)];
        doomed.novaAt = performance.now() + 1500 + Math.random() * 3500;
      }
    };

    const handleWindowClick = (e) => {
      if (!particlesRef.current?.particles) return;

      if (eraRef.current.era === 'constellation') {
        const onChrome = e.target && e.target.closest &&
          e.target.closest('.book, .controls-panel, .book-bookmarks, .album-header, .splash-overlay');
        if (onChrome) return;

        const cosmic = ensureCosmic();
        const challenge = challengeRef.current;
        const onTrial = Boolean(challenge.trialActive);

        // A click thrown into a hole feeds it instead of seeding a constellation
        for (let i = 0; i < cosmic.length; i++) {
          const ev = cosmic[i];
          if (ev.type !== 'blackhole') continue;
          const dx = e.clientX - ev.x;
          const dy = e.clientY - ev.y;
          if (dx * dx + dy * dy > 72 * 72) continue;

          // Trial: five feedings tame the darkness and the cursor becomes the hole
          if (onTrial && !challenge.tamed) {
            const now = performance.now();
            if (challenge.lastFedAt && now - challenge.lastFedAt > 6000) challenge.fed = 0;
            challenge.lastFedAt = now;
            challenge.fed += 1;
            ev.fedAt = now;
            ev.r = Math.min(ev.r + 3.2, 44);
            spawnBurst(ev.x, ev.y, 16, 3.4, true);

            if (challenge.fed >= 5) {
              challenge.fed = 0;
              spawnShock(ev.x, ev.y, 340, true);
              spawnBurst(ev.x, ev.y, 46, 7, true);
              ev.collapsing = now;
              if (challenge.onTamed) challenge.onTamed();
            }
            return;
          }

          const now = performance.now();
          // Feeding has to be deliberate: a long pause resets the streak
          if (challenge.lastFedAt && now - challenge.lastFedAt > 6000) challenge.fed = 0;
          challenge.lastFedAt = now;

          ev.fedAt = now;
          ev.r = Math.min(ev.r + 2.4, 40);
          spawnBurst(ev.x, ev.y, 14, 3.2, true);

          // Feeding is just play now: the chapter is cleared only by the trial
          if (ev.r > 34) {
            spawnShock(ev.x, ev.y, 260, true);
            spawnBurst(ev.x, ev.y, 40, 6, true);
            ev.collapsing = performance.now();
          }
          return;
        }

        // Пустой космос отзывается одинаково: и когда рождается созвездие,
        // и когда во время испытания клик уходит мимо дыры
        if (playMissRef.current) playMissRef.current();
        if (onTrial) return;

        spawnConstellation(e.clientX, e.clientY);
        return;
      }

      // В саду нажатие ничего не делает: глава про то, что делать не надо
      if (eraRef.current.era === 'garden') return;

      for (let i = 0; i < 15; i++) {
        particlesRef.current.particles.push({
          x: e.clientX + (Math.random() - 0.5) * 10,
          y: e.clientY + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          size: Math.random() * 5 + 2,
          alpha: 1,
          decay: Math.random() * 0.02 + 0.01,
          angle: 0, orbitRadius: 0
        });
      }
    };
    window.addEventListener('click', handleWindowClick);

    // Небо отсчитывает шаги само: ровно шестьдесят в секунду, каким бы ни был
    // монитор. Звёзды, дыры и созвездия сдвигаются на кадр, а не на прошедшее
    // время, поэтому на быстром экране лишние кадры пропускаются, а не гонят
    // небо вперёд. При свёрнутом окне небо замирает вовсе
    const SKY_STEP = 1000 / 60;
    let skyClock = 0;
    let skyLast = 0;

    const animate = () => {
      const nowSky = performance.now();
      if (document.hidden) {
        skyLast = nowSky;
        animationId = requestAnimationFrame(animate);
        return;
      }
      const elapsed = skyLast ? nowSky - skyLast : SKY_STEP;
      skyLast = nowSky;
      // после простоя долг не копится: небо продолжает с текущего мгновения
      skyClock += Math.min(elapsed, SKY_STEP * 3);
      if (skyClock < SKY_STEP) { animationId = requestAnimationFrame(animate); return; }
      skyClock = Math.min(skyClock - SKY_STEP, SKY_STEP);

      // Smooth Lerping Utility
      const lerpColor = (current, target, factor = 0.015) => {
        return [
          current[0] + (target[0] - current[0]) * factor,
          current[1] + (target[1] - current[1]) * factor,
          current[2] + (target[2] - current[2]) * factor
        ];
      };

      // 1. Update Background Gradient from the persistent era target
      const { era, primaryRgb, bgStart: targetStart, bgEnd: targetEnd } = eraRef.current;

      bgRef.current.start = lerpColor(bgRef.current.start, targetStart);
      bgRef.current.end = lerpColor(bgRef.current.end, targetEnd);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, `rgb(${Math.round(bgRef.current.start[0])}, ${Math.round(bgRef.current.start[1])}, ${Math.round(bgRef.current.start[2])})`);
      bgGrad.addColorStop(1, `rgb(${Math.round(bgRef.current.end[0])}, ${Math.round(bgRef.current.end[1])}, ${Math.round(bgRef.current.end[2])})`);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Ренессанс тонет в темноте: поверх фона ложится глухая вуаль,
      // на которой глаза читаются, а всё прочее гаснет
      if (era === 'gloom') {
        const veil = ctx.createRadialGradient(
          width / 2, height / 2, Math.min(width, height) * 0.18,
          width / 2, height / 2, Math.max(width, height) * 0.78
        );
        veil.addColorStop(0, 'rgba(2, 2, 3, 0.42)');
        veil.addColorStop(1, 'rgba(0, 0, 0, 0.86)');
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Determine Target Physics for current Era
      const physicsByEra = {
        gloom: { upwardForce: 0.01, centerGravity: 0, orbitSpeed: 0, randomJitter: 0.04, targetSize: 2.4, lineOpacity: 0, glowMultiplier: 2.4, friction: 0.985 },
        constellation: { upwardForce: 0, centerGravity: 0, orbitSpeed: 0, randomJitter: 0.15, targetSize: 2, lineOpacity: 0.4, glowMultiplier: 4, friction: 0.93 },
        fog: { upwardForce: 0.3, centerGravity: 0, orbitSpeed: 0, randomJitter: 0.15, targetSize: 28, lineOpacity: 0, glowMultiplier: 2, friction: 0.93 },
        sparks: { upwardForce: 1.5, centerGravity: 0, orbitSpeed: 0, randomJitter: 0.8, targetSize: 1.5, lineOpacity: 0, glowMultiplier: 4, friction: 0.93 },
        ink: { upwardForce: 0, centerGravity: 0, orbitSpeed: 0, randomJitter: 0.05, targetSize: 2, lineOpacity: 0, glowMultiplier: 3, friction: 0.95 },
        orbit: { upwardForce: 0, centerGravity: 0.005, orbitSpeed: 0.003, randomJitter: 0.02, targetSize: 3, lineOpacity: 0, glowMultiplier: 4, friction: 0.99 },
        watercolor: { upwardForce: 0.02, centerGravity: 0, orbitSpeed: 0, randomJitter: 0.05, targetSize: 40, lineOpacity: 0, glowMultiplier: 2, friction: 0.93 },
        cave: { upwardForce: 0, centerGravity: 0, orbitSpeed: 0, randomJitter: 0.02, targetSize: 2, lineOpacity: 0, glowMultiplier: 2, friction: 0.96 }
      };
      const targetPhysics = physicsByEra[era] || physicsByEra.constellation;

      // 3. Smoothly Interpolate Global Physics State
      const pState = particlesRef.current.physics;
      
      // Hot-reload recovery: if state was infected by NaN, reset it
      if (!isFinite(pState.friction)) pState.friction = targetPhysics.friction;
      if (!isFinite(pState.upwardForce)) pState.upwardForce = targetPhysics.upwardForce;

      const lerpSpeed = 0.015;
      pState.upwardForce += (targetPhysics.upwardForce - pState.upwardForce) * lerpSpeed;
      pState.centerGravity += (targetPhysics.centerGravity - pState.centerGravity) * lerpSpeed;
      pState.orbitSpeed += (targetPhysics.orbitSpeed - pState.orbitSpeed) * lerpSpeed;
      pState.randomJitter += (targetPhysics.randomJitter - pState.randomJitter) * lerpSpeed;
      pState.targetSize += (targetPhysics.targetSize - pState.targetSize) * lerpSpeed;
      pState.lineOpacity += (targetPhysics.lineOpacity - pState.lineOpacity) * lerpSpeed;
      pState.glowMultiplier += (targetPhysics.glowMultiplier - pState.glowMultiplier) * lerpSpeed;
      pState.friction += (targetPhysics.friction - pState.friction) * lerpSpeed;
      
      pState.primaryColor = lerpColor(pState.primaryColor, primaryRgb, lerpSpeed);
      const pColorRgba = `rgba(${Math.round(pState.primaryColor[0])}, ${Math.round(pState.primaryColor[1])}, ${Math.round(pState.primaryColor[2])}`;

      // Renaissance canvas: paint while the pointer is pressed, ink bleeds and dissolves
      paintState.frame++;
      const tNow = performance.now();
      const inkR = Math.round(pState.primaryColor[0]);
      const inkG = Math.round(pState.primaryColor[1]);
      const inkB = Math.round(pState.primaryColor[2]);
      if (era === 'ink' && mouseRef.current.isDown && mouseRef.current.canPaint) {
        const px = mouseRef.current.x / 2;
        const py = mouseRef.current.y / 2;
        if (paintState.lastX === null) {
          const pressGrad = paintCtx.createRadialGradient(px, py, 0, px, py, 6);
          pressGrad.addColorStop(0, `rgba(${inkR}, ${inkG}, ${inkB}, 0.45)`);
          pressGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          paintCtx.fillStyle = pressGrad;
          paintCtx.beginPath();
          paintCtx.arc(px, py, 6, 0, Math.PI * 2);
          paintCtx.fill();
        } else {
          const moved = Math.hypot(px - paintState.lastX, py - paintState.lastY);
          if (moved < 200) {
            paintCtx.strokeStyle = `rgba(${inkR}, ${inkG}, ${inkB}, 0.38)`;
            paintCtx.lineWidth = Math.min(16, 4 + moved * 0.35);
            paintCtx.lineCap = 'round';
            paintCtx.lineJoin = 'round';
            paintCtx.beginPath();
            paintCtx.moveTo(paintState.lastX, paintState.lastY);
            paintCtx.lineTo(px, py);
            paintCtx.stroke();
          }
        }
        paintState.lastX = px;
        paintState.lastY = py;
      } else {
        paintState.lastX = null;
        paintState.lastY = null;
      }

      if (era === 'ink' && tNow > paintState.nextDropAt) {
        paintState.nextDropAt = tNow + 4000 + Math.random() * 5000;
        const dropX = Math.random() * paintCanvas.width;
        const dropY = Math.random() * paintCanvas.height;
        const dropR = 5 + Math.random() * 12;
        const dropGrad = paintCtx.createRadialGradient(dropX, dropY, 0, dropX, dropY, dropR);
        dropGrad.addColorStop(0, `rgba(${inkR}, ${inkG}, ${inkB}, 0.35)`);
        dropGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        paintCtx.fillStyle = dropGrad;
        paintCtx.beginPath();
        paintCtx.arc(dropX, dropY, dropR, 0, Math.PI * 2);
        paintCtx.fill();
      }

      if (eraRef.current.pageStamp !== prevStamp) {
        prevStamp = eraRef.current.pageStamp;
        if (paintState.frame > 1) fastClear = 70;
      }

      if (fastClear > 0) {
        fastClear--;
        if (fastClear === 0) {
          paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
        } else {
          paintCtx.save();
          paintCtx.globalCompositeOperation = 'copy';
          paintCtx.filter = 'blur(2px)';
          paintCtx.globalAlpha = 0.86;
          paintCtx.drawImage(paintCanvas, 0, 0);
          paintCtx.restore();
          paintCtx.filter = 'none';
          paintCtx.save();
          paintCtx.globalCompositeOperation = 'destination-out';
          paintCtx.globalAlpha = 0.08;
          paintCtx.fillStyle = '#000';
          paintCtx.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
          paintCtx.restore();
        }
      } else if (paintState.frame % 3 === 0) {
        paintCtx.save();
        paintCtx.globalCompositeOperation = 'copy';
        paintCtx.filter = 'blur(1px)';
        paintCtx.globalAlpha = 0.992;
        paintCtx.drawImage(paintCanvas, 0, 0);
        paintCtx.restore();
        paintCtx.filter = 'none';
        paintCtx.save();
        paintCtx.globalCompositeOperation = 'destination-out';
        paintCtx.globalAlpha = 0.012;
        paintCtx.fillStyle = '#000';
        paintCtx.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
        paintCtx.restore();
      }

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.85;
      ctx.drawImage(paintCanvas, 0, 0, width, height);
      ctx.restore();

      ctx.globalCompositeOperation = (era === 'fog' || era === 'watercolor') ? 'source-over' : 'screen';

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;
      const particles = particlesRef.current.particles;

      // Era ambient events: shooting stars in Genesis, warm embers in the fog
      if (era === 'constellation' && tNow > nextShootAt) {
        nextShootAt = tNow + 5000 + Math.random() * 9000;
        const fromLeft = Math.random() < 0.7;
        const speed = (26 + Math.random() * 14) * METEOR_SPEED;
        const slope = 0.25 + Math.random() * 0.5;
        particles.push({
          x: fromLeft ? -40 : width + 40,
          y: Math.random() * height * 0.55,
          vx: (fromLeft ? 1 : -1) * speed,
          vy: speed * slope * 0.35,
          size: 1.6,
          alpha: 1,
          decay: 0.012,
          meteor: true,
          angle: 0,
          orbitRadius: 0
        });
      }
      if (era === 'fog' && tNow > nextEmberAt) {
        nextEmberAt = tNow + 2000 + Math.random() * 4000;
        particles.push({
          x: Math.random() * width,
          y: height + 20,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -(0.8 + Math.random() * 0.8),
          size: 2.5,
          alpha: 0.9,
          decay: 0.003,
          warm: true,
          angle: 0,
          orbitRadius: 0
        });
      }

      // 3a. Distant star dust: the far, almost invisible background
      if (!particlesRef.current.dust) {
        const dust = [];
        const dustCount = Math.round((width * height) / 3400);
        for (let i = 0; i < dustCount; i++) {
          const dAngle = Math.random() * Math.PI * 2;
          const dSpeed = 0.008 + Math.random() * 0.05;
          dust.push({
            x: Math.random() * width,
            y: Math.random() * height,
            dvx: Math.cos(dAngle) * dSpeed,
            dvy: Math.sin(dAngle) * dSpeed,
            r: 0.35 + Math.random() * 0.6,
            a: 0.05 + Math.random() * 0.22,
            tw: Math.random() < 0.35 ? 0.0005 + Math.random() * 0.0014 : 0,
            ph: Math.random() * Math.PI * 2
          });
        }
        particlesRef.current.dust = dust;
      }

      const skyState = particlesRef.current.sky ||
        (particlesRef.current.sky = { driftX: 0.04, driftY: 0.012, phase: 0, dustAlpha: 0 });
      skyState.dustAlpha += ((era === 'constellation' ? 1 : 0) - (skyState.dustAlpha || 0)) * 0.014;

      if (skyState.dustAlpha > 0.01) {
        const dust = particlesRef.current.dust;
        const dustDriftX = skyState.driftX * Math.cos(skyState.phase) * 0.22;
        const dustDriftY = skyState.driftY * Math.sin(skyState.phase * 0.7) * 0.22;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = '#dde2ff';
        for (let i = 0; i < dust.length; i++) {
          const d = dust[i];
          d.x += d.dvx + dustDriftX;
          d.y += d.dvy + dustDriftY;
          if (d.x < -2) d.x = width + 2;
          else if (d.x > width + 2) d.x = -2;
          if (d.y < -2) d.y = height + 2;
          else if (d.y > height + 2) d.y = -2;
          const twinkle = d.tw ? 0.6 + 0.4 * Math.sin(tNow * d.tw + d.ph) : 1;
          ctx.globalAlpha = d.a * twinkle * skyState.dustAlpha;
          ctx.fillRect(d.x, d.y, d.r * 2, d.r * 2);
        }
        ctx.globalAlpha = 1;
      }

      // 3b. Genesis sky: drift, doomed stars, quasars and black holes
      const cosmic = particlesRef.current.cosmic || (particlesRef.current.cosmic = []);
      const sky = particlesRef.current.sky ||
        (particlesRef.current.sky = { driftX: 0.04, driftY: 0.012, phase: 0 });

      // Небо гаснет не рывком: звёзды тускнеют, дыры успевают уйти за край
      const skyAlive = era === 'constellation';
      if (sky.fade === undefined) sky.fade = skyAlive ? 1 : 0;
      sky.fade = Math.max(0, Math.min(1, sky.fade + (skyAlive ? 0.02 : -0.011)));
      const skyFade = sky.fade;
      if (!skyAlive && skyFade <= 0.01 && cosmic.length) cosmic.length = 0;

      if (skyAlive || skyFade > 0.01) {
        // The sky lives on its own: holes wander in, quasars ignite, stars die
        if (skyAlive) {
        if (!nextHoleAt) nextHoleAt = tNow + 7000 + Math.random() * 9000;
        if (!nextQuasarAt) nextQuasarAt = tNow + 20000 + Math.random() * 25000;
        if (!nextNovaAt) nextNovaAt = tNow + 6000 + Math.random() * 10000;

        if (!nextBirthAt) nextBirthAt = tNow + 1500 + Math.random() * 2000;

        if (tNow > nextBirthAt) {
          const sparse = sky.visible < 150;
          nextBirthAt = tNow + (sparse ? 900 + Math.random() * 1600 : 5000 + Math.random() * 8000);
          if (Math.random() < 0.65) {
            // Drifts in from beyond the frame, heading inward
            const side = Math.floor(Math.random() * 4);
            const inward = [0, Math.PI / 2, Math.PI, -Math.PI / 2][side];
            const spread = (Math.random() - 0.5) * 1.1;
            const pos = [
              [-160, Math.random() * height],
              [Math.random() * width, -160],
              [width + 160, Math.random() * height],
              [Math.random() * width, height + 160]
            ][side];
            spawnConstellation(pos[0], pos[1], inward + spread);
          } else {
            spawnConstellation(width * (0.1 + Math.random() * 0.8), height * (0.1 + Math.random() * 0.8));
          }
        }

        // The trial needs its prey: keep a hole around until it is tamed
        const trialState = challengeRef.current;
        if (trialState.trialActive && !trialState.tamed) {
          const holes = cosmic.filter((ev) => ev.type === 'blackhole' && !ev.collapsing);
          if (holes.length === 0 && tNow > (trial_nextForcedHole || 0)) {
            trial_nextForcedHole = tNow + 2500;
            spawnBlackHole();
          }
        }

        if (tNow > nextHoleAt) {
          nextHoleAt = tNow + 18000 + Math.random() * 26000;
          spawnBlackHole();
        }
        if (tNow > nextQuasarAt) {
          nextQuasarAt = tNow + 35000 + Math.random() * 45000;
          spawnQuasar(width * (0.15 + Math.random() * 0.7), height * (0.15 + Math.random() * 0.7));
        }
        if (tNow > nextNovaAt) {
          nextNovaAt = tNow + 10000 + Math.random() * 18000;
          const candidates = particles.filter((p) => p.star && !p.decay && !p.novaAt && !p.fadingOut);
          if (candidates.length) {
            candidates[Math.floor(Math.random() * candidates.length)].novaAt = tNow + 800 + Math.random() * 2500;
          }
        }

        if (!sky.seeded) {
          sky.seeded = true;
          const cols = 9;
          const rows = 5;
          for (let cx = 0; cx < cols; cx++) {
            for (let cy = 0; cy < rows; cy++) {
              if (Math.random() < 0.12) continue;
              const gx = ((cx + 0.5) / cols + (Math.random() - 0.5) * 0.1) * width;
              const gy = ((cy + 0.5) / rows + (Math.random() - 0.5) * 0.16) * height;
              spawnConstellation(gx, gy);
            }
          }
        }
        }

        sky.phase += 0.0008;
        const driftX = sky.driftX * Math.cos(sky.phase);
        const driftY = sky.driftY * Math.sin(sky.phase * 0.7);

        let starCount = 0;
        let visibleStars = 0;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          if (p.decay) continue;
          starCount++;

          if (p.star) {
            if (p.bx > 0 && p.bx < width && p.by > 0 && p.by < height) visibleStars++;
            // Anchored: the figure sails as one along its own heading, stars only breathe
            p.bx += (p.gvx || 0) + driftX * 0.25;
            p.by += (p.gvy || 0) + driftY * 0.25;
            p.x = p.bx + Math.sin(tNow * p.wsp + p.wph) * p.wamp;
            p.y = p.by + Math.cos(tNow * p.wsp * 0.8 + p.wph) * p.wamp;

            // Fade out only well past the edge, so captured stars keep flying
            const margin = 260;
            if (p.bx < -margin || p.bx > width + margin || p.by < -margin || p.by > height + margin) {
              p.leaving = true;
            }
            if (p.leaving) {
              p.alpha -= 0.004;
              if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
              }
            }
          } else {
            p.x += driftX;
            p.y += driftY;
          }

          if (p.novaAt && tNow > p.novaAt) {
            spawnBurst(p.x, p.y, 26, 4.5, true);
            spawnShock(p.x, p.y, 130, true);
            particles.splice(i, 1);
            continue;
          }
        }

        sky.visible = visibleStars;

        // Oldest stars quietly fade out once the sky gets crowded,
        // and are dropped outright if births keep outrunning the fade
        if (starCount > STAR_LIMIT) {
          let toFade = starCount - STAR_LIMIT;
          for (let i = 0; i < particles.length && toFade > 0; i++) {
            const p = particles[i];
            if (p.decay || p.fadingOut) continue;
            p.fadingOut = true;
            toFade--;
          }
        }
        if (starCount > STAR_HARD_CAP) {
          let toDrop = starCount - STAR_HARD_CAP;
          for (let i = 0; i < particles.length && toDrop > 0; i++) {
            if (particles[i].decay) continue;
            particles.splice(i, 1);
            i--;
            toDrop--;
          }
        }

        for (let i = cosmic.length - 1; i >= 0; i--) {
          const ev = cosmic[i];

          if (ev.type === 'shock') {
            ev.r += ((ev.maxR - ev.r) * 0.08 + 1.2) * BLAST_SPEED;
            ev.alpha -= 0.02;
            if (ev.alpha <= 0) cosmic.splice(i, 1);
            continue;
          }

          if (ev.type === 'quasar') {
            if (tNow > ev.explodeAt) {
              spawnBurst(ev.x, ev.y, 44, 7, true);
              spawnShock(ev.x, ev.y, 260, true);
              spawnShock(ev.x, ev.y, 150, false);
              for (let k = 0; k < 3; k++) {
                const a = Math.random() * Math.PI * 2;
                const r = 60 + Math.random() * 60;
                spawnStar(ev.x + Math.cos(a) * r, ev.y + Math.sin(a) * r);
              }
              cosmic.splice(i, 1);
            }
            continue;
          }

          if (ev.type === 'blackhole') {
            if (ev.collapsing) {
              const age = tNow - ev.collapsing;
              ev.r = Math.max(0, ev.r - 0.6);
              ev.spin += 0.22;
              if (age > 900 || ev.r <= 0.5) {
                cosmic.splice(i, 1);
                continue;
              }
            }

            if (!skyAlive) {
              // глава сменилась: дыра доигрывает свой путь и уходит за край
              const ox = ev.x - width / 2, oy = ev.y - height / 2;
              const od = Math.hypot(ox, oy) || 1;
              ev.vx += (ox / od) * 0.06;
              ev.vy += (oy / od) * 0.06;
            }
            ev.x += ev.vx;
            ev.y += ev.vy;
            ev.spin += 0.04 * HOLE_SPEED;

            for (let j = particles.length - 1; j >= 0; j--) {
              const p = particles[j];
              const dx = ev.x - p.x;
              const dy = ev.y - p.y;
              const d2 = dx * dx + dy * dy;
              if (d2 > 122500) continue; // 350px reach
              const d = Math.sqrt(d2) || 0.001;
              const pull = (350 - d) / 350;
              if (p.star) {
                p.bx += (dx / d) * pull * pull * 2.4;
                p.by += (dy / d) * pull * pull * 2.4;
                // Close enough: the star is caught and travels along with the hole
                if (d < 150) {
                  p.bx += ev.vx * 0.85;
                  p.by += ev.vy * 0.85;
                }
              } else {
                p.vx += (dx / d) * pull * 0.55;
                p.vy += (dy / d) * pull * 0.55;
              }
            }

            // The hole keeps hauling its catch long after leaving the screen
            if (ev.x < -900 || ev.x > width + 900 || ev.y < -900 || ev.y > height + 900) {
              cosmic.splice(i, 1);
            }
            continue;
          }
        }
      }

      refreshStarSprite(pColorRgba);

      // Lookup so constellation edges survive stars being eaten or exploding
      let starById = null;
      if (skyFade > 0.01) {
        starById = new Map();
        for (let i = 0; i < particles.length; i++) {
          if (particles[i].sid) starById.set(particles[i].sid, particles[i]);
        }
      }

      // 4. Update and Draw Particles
      // В саду фоновых точек нет вовсе: за фон отвечает слой с цветами
      if (era === 'garden') { particles.length = 0; }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Apply Forces
        if (!p.meteor && !p.star) {
          p.vy -= pState.upwardForce * 0.1;
          p.vx += (Math.random() - 0.5) * pState.randomJitter;
          p.vy += (Math.random() - 0.5) * pState.randomJitter;
        }

        // Apply Orbit
        if (pState.centerGravity > 0.0001) {
          p.angle += pState.orbitSpeed;
          const targetX = width/2 + Math.cos(p.angle) * p.orbitRadius * 2.6;
          const targetY = height/2 + Math.sin(p.angle) * p.orbitRadius * 2.6;
          p.vx += (targetX - p.x) * pState.centerGravity;
          p.vy += (targetY - p.y) * pState.centerGravity;
        }

        // Mutual Repulsion (The "Explosion" / Pushing apart logic)
        if (!p.meteor && !p.star) for (let j = i - 1; j >= 0; j--) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx*dx + dy*dy;
          if (distSq < 2500 && distSq > 0.1) { // 50px radius
            const dist = Math.sqrt(distSq);
            const force = (50 - dist) / 50;
            const fx = (dx / dist) * force * 0.3; // Repulsion strength
            const fy = (dy / dist) * force * 0.3;
            p.vx += fx;
            p.vy += fy;
            // Also push the other particle
            if (!p2.decay) {
              p2.vx -= fx;
              p2.vy -= fy;
            }
          }
        }

        // Mouse Interaction
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const distSqM = dx*dx + dy*dy;
        if (!p.meteor && !p.star && distSqM < 22500 && distSqM > 0.1) { // 150px radius
          const distM = Math.sqrt(distSqM);
          const forceM = (150 - distM) / 150;
          p.vx += (dx / distM) * forceM * 2;
          p.vy += (dy / distM) * forceM * 2;
          // Wake effect: particles are dragged along the cursor movement direction
          p.vx += mouseRef.current.vx * forceM * 0.06;
          p.vy += mouseRef.current.vy * forceM * 0.06;
        }

        // Apply Velocity & Friction
        if (!p.star) {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (!p.meteor && !p.star) {
          p.vx *= pState.friction;
          p.vy *= pState.friction;
        }

        // Newborn stars brighten into place, crowded-out ones quietly leave
        if (p.fadeIn && !p.leaving && p.alpha < p.targetAlpha) {
          p.alpha = Math.min(p.targetAlpha, p.alpha + p.fadeIn);
        }
        if (p.fadingOut) {
          p.alpha -= 0.02;
          if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }
        }

        // Decay logic for click sparks
        if (p.decay) {
          p.alpha -= p.decay;
          if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }
        } else {
          // Smoothly adapt size to current era
          const targetSize = (p.birthSize && era === 'constellation') ? p.birthSize : pState.targetSize;
          p.size += (targetSize - p.size) * 0.05;
          // Screen wrap (anchored stars must not teleport, it would tear the figure)
          if (!p.star) {
            if (p.x < -p.size*2) p.x = width + p.size*2;
            if (p.x > width + p.size*2) p.x = -p.size*2;
            if (p.y < -p.size*2) p.y = height + p.size*2;
            if (p.y > height + p.size*2) p.y = -p.size*2;
          }
        }

        // Meteors keep a bright tail behind the head
        if (p.meteor) {
          const tailX = p.x - p.vx * 2.4;
          const tailY = p.y - p.vy * 2.4;
          const tailGrad = ctx.createLinearGradient(p.x, p.y, tailX, tailY);
          tailGrad.addColorStop(0, `${pColorRgba}, ${Math.max(0, Math.min(1, p.alpha))})`);
          tailGrad.addColorStop(1, 'transparent');
          ctx.strokeStyle = tailGrad;
          ctx.lineWidth = 1.8;
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();
        }

        // В Генезисе и Ренессансе фон чистый: никаких летающих искр,
        // только камни на своём слое и глаза в темноте
        const bgFade = era === 'cave' ? skyFade : 1;
        if (era === 'gloom' && !p.decay) continue;
        if (era === 'cave' && !p.decay && !p.meteor && bgFade <= 0.01) continue;

        // Draw Particle
        const gradRadius = Math.max(0.1, p.size * pState.glowMultiplier);

        if (p.star) {
          const twinkle = 0.7 + 0.3 * Math.sin(tNow * 0.002 + p.sid * 1.7);
          ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * twinkle * bgFade));
          ctx.drawImage(starSprite, p.x - gradRadius, p.y - gradRadius, gradRadius * 2, gradRadius * 2);

          if (starById && p.links && pState.lineOpacity > 0.01) {
            for (let l = p.links.length - 1; l >= 0; l--) {
              const edge = p.links[l];
              const other = starById.get(edge.sid);
              if (!other) continue;
              const lx = p.x - other.x;
              const ly = p.y - other.y;
              const dist2 = Math.sqrt(lx * lx + ly * ly);
              if (dist2 > edge.len * 2.4 + 40) {
                p.links.splice(l, 1);
                continue;
              }
              ctx.beginPath();
              ctx.strokeStyle = `${pColorRgba}, 1)`;
              ctx.lineWidth = 0.6;
              ctx.globalAlpha = Math.max(0, Math.min(1,
                Math.min(p.alpha, other.alpha) * 2.2 * pState.lineOpacity * bgFade));
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(other.x, other.y);
              ctx.stroke();
            }
          }
          continue;
        }

        ctx.beginPath();
        if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(gradRadius)) {
          console.error("NAN DETECTED!", {x: p.x, y: p.y, size: p.size, glow: pState.glowMultiplier, vx: p.vx, vy: p.vy, pState});
        }
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gradRadius);

        const pBase = p.warm ? 'rgba(255, 150, 70' : pColorRgba;
        grad.addColorStop(0, `${pBase}, 1)`);
        if (era === 'fog' || era === 'watercolor') {
          grad.addColorStop(0.5, `${pBase}, 0.1)`);
          grad.addColorStop(1, 'transparent');
        } else {
          grad.addColorStop(0.3, `${pBase}, 0.3)`);
          grad.addColorStop(1, 'transparent');
        }

        ctx.fillStyle = grad;
        const alphaMultiplier = era === 'watercolor' ? 0.3
          : (era === 'constellation' && !p.decay) ? 0.7 + 0.3 * Math.sin(tNow * 0.002 + i * 1.7)
          : 1;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * alphaMultiplier * bgFade));
        ctx.arc(p.x, p.y, gradRadius, 0, Math.PI * 2);
        ctx.fill();


      }

      // Draw Genesis cosmic events above the star field
      if (skyFade > 0.01 && cosmic.length) {
        for (let i = 0; i < cosmic.length; i++) {
          const ev = cosmic[i];

          if (ev.type === 'shock') {
            ctx.globalCompositeOperation = 'screen';
            ctx.beginPath();
            ctx.strokeStyle = ev.tint ? 'rgba(255, 232, 196, 1)' : `${pColorRgba}, 1)`;
            ctx.lineWidth = 2;
            ctx.globalAlpha = Math.max(0, ev.alpha) * 0.7 * skyFade;
            ctx.arc(ev.x, ev.y, ev.r, 0, Math.PI * 2);
            ctx.stroke();
            continue;
          }

          if (ev.type === 'quasar') {
            const span = Math.max(1, ev.explodeAt - ev.bornAt);
            const life = Math.max(0, Math.min(1, (tNow - ev.bornAt) / span));
            const pulse = 0.7 + 0.3 * Math.sin(tNow * 0.02);
            const coreR = (5 + life * 9) * pulse;

            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = skyFade;
            const coreGrad = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, coreR * 3);
            coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            coreGrad.addColorStop(0.25, 'rgba(198, 218, 255, 0.55)');
            coreGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(ev.x, ev.y, coreR * 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.translate(ev.x, ev.y);
            ctx.rotate(ev.angle);
            const jetLen = 36 + life * 95;
            const jetGrad = ctx.createLinearGradient(0, -jetLen, 0, jetLen);
            jetGrad.addColorStop(0, 'transparent');
            jetGrad.addColorStop(0.5, `rgba(190, 220, 255, ${0.45 * pulse})`);
            jetGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = jetGrad;
            ctx.fillRect(-1.6, -jetLen, 3.2, jetLen * 2);
            ctx.restore();
            continue;
          }

          if (ev.type === 'blackhole') {
            const diskR = ev.r * 2.8;
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = skyFade;
            const fedGlow = ev.fedAt ? Math.max(0, 1 - (tNow - ev.fedAt) / 600) : 0;
            const diskGrad = ctx.createRadialGradient(ev.x, ev.y, ev.r * 0.9, ev.x, ev.y, diskR);
            diskGrad.addColorStop(0, `rgba(255, ${176 + Math.round(60 * fedGlow)}, 96, ${0.7 + 0.3 * fedGlow})`);
            diskGrad.addColorStop(0.5, 'rgba(150, 120, 255, 0.28)');
            diskGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = diskGrad;
            ctx.beginPath();
            ctx.arc(ev.x, ev.y, diskR, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(ev.x, ev.y, ev.r, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalCompositeOperation = 'screen';
            ctx.strokeStyle = 'rgba(255, 222, 184, 0.85)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.ellipse(ev.x, ev.y, ev.r * 1.9, ev.r * 0.55, ev.spin, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Cursor wake decays between frames
      mouseRef.current.vx *= 0.8;
      mouseRef.current.vy *= 0.8;

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', handleWindowClick);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handleGlobalPointerDown);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      cancelAnimationFrame(animationId);
    };
  }, [loading]);

  // Dynamically update document CSS variables when active theme changes
  useEffect(() => {
    if (drawings.length === 0 || !drawings[themeIndex]) return;

    const theme = drawings[themeIndex]?.eraTheme || {};
    const bgStart = theme.bgStart || (theme.bg && theme.bg[0]) || '#0c0d14';
    const bgEnd = theme.bgEnd || (theme.bg && theme.bg[1]) || '#050508';
    const primary = theme.primary || '#2dd4bf';
    const primaryRgb = theme.primaryRgb || '45, 212, 191';
    const glass = theme.glass || 'rgba(17, 19, 31, 0.65)';

    // Convert rgba background color to 100% solid rgb (no transparency)
    const solidBg = glass.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgb($1, $2, $3)');

    const root = document.documentElement;
    root.style.setProperty('--bg-gradient-start', bgStart);
    root.style.setProperty('--bg-gradient-end', bgEnd);
    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-primary-rgb', primaryRgb);
    root.style.setProperty('--glass-bg', solidBg);

    bgRef.current.target = [hexToRgb(bgStart), hexToRgb(bgEnd)];
  }, [themeIndex, drawings]);

  // Play recorded mp3 paper sounds in sequence
  const playPaperSound = () => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio(`${import.meta.env.BASE_URL}mp3/${soundIndex}.mp3`);
      audio.play().catch(e => console.warn('Audio play failed:', e));
      setSoundIndex(prev => prev % 7 + 1);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  };

  useEffect(() => { playPaperSoundRef.current = playPaperSound; });

  const handleNext = useCallback((isAuto = false) => {
    if (holdingGem || sceneLockRef.current) return;
    if (isAuto !== true && isPlaying) setIsPlaying(false);
    if (forwardLocked) {
      // у границы Переосмысления страница не упирается: она честно идёт вверх
      if (chainGateRef.current && !startedBeyondRef.current) {
        playPaperSound();
        startBeyondRef.current(0);
        return;
      }
      refuseForward();
      return;
    }
    if (currentIndex < drawings.length - 1 && !isFlipping) {
      playPaperSound();
      setPhotoFlipped(false);
      setFlipDirection('next');
      setIsFlipping(true);
      setTimeout(() => {
        if (!sceneLockRef.current) setCurrentIndex(prev => prev + 1);
        setIsFlipping(false);
        setFlipDirection(null);
      }, 800); // SLOW FLIP
    } else if (currentIndex >= drawings.length - 1 && isPlaying) {
      setIsPlaying(false); // Stop autoplay at the end
    }
  }, [currentIndex, drawings.length, isFlipping, isPlaying, forwardLocked, refuseForward, holdingGem]);

  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const handlePrev = useCallback((isAuto = false) => {
    if (holdingGem || sceneLockRef.current) return;
    if (backLocked) { refuseForward(); return; }
    if (isAuto !== true && isPlaying) setIsPlaying(false);
    if (currentIndex > 0 && !isFlipping) {
      playPaperSound();
      setPhotoFlipped(false);
      setFlipDirection('prev');
      setIsFlipping(true);
      setTimeout(() => {
        if (!sceneLockRef.current) setCurrentIndex(prev => prev - 1);
        setIsFlipping(false);
        setFlipDirection(null);
      }, 800); // SLOW FLIP
    }
  }, [currentIndex, isFlipping, backLocked, refuseForward, holdingGem, isPlaying]);

  // Autoplay Effect
  useEffect(() => {
    let timer;
    if (isPlaying && !isCoverClosed) {
      timer = setInterval(() => {
        handleNext(true); // Pass true to indicate it's an auto-flip
      }, playInterval);
    }
    return () => clearInterval(timer);
  }, [isPlaying, playInterval, isCoverClosed, handleNext]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  // Прыжок по закладке: под пачкой сразу лежит нужный разворот, а поверх него
  // веером улетают несколько листов — дорога до главы становится видимой
  const RUSH_MAX = 5;
  const RUSH_STEP = 120;
  const RUSH_TIME = 620;

  const jumpTo = (target) => {
    // Пачка должна долететь: иначе второе нажатие рвёт анимацию на середине
    if (isFlipping || rush || dragState.isDragging || dragState.isReleasing) return;
    if (sceneLockRef.current) return;
    if (target === currentIndex) return;
    const dir = target > currentIndex ? 'next' : 'prev';
    const distance = Math.abs(target - currentIndex);
    const count = Math.min(RUSH_MAX, distance);
    const from = currentIndex;

    const sheets = [];
    for (let i = 0; i < count; i++) {
      const step = Math.round(((i + 1) * distance) / count);
      const idx = dir === 'next'
        ? Math.min(from + step - 1, drawings.length - 1)
        : Math.max(from - step + 1, 0);
      const partner = dir === 'next'
        ? Math.min(idx + 1, drawings.length - 1)
        : Math.max(idx - 1, 0);
      sheets.push({ front: drawings[idx], back: drawings[partner] });
    }

    setCurrentIndex(target);
    setRush({ dir, sheets });

    rushTimers.current.forEach(clearTimeout);
    rushTimers.current = sheets.map((_, i) =>
      setTimeout(() => playPaperSound(), i * RUSH_STEP)
    );
    rushTimers.current.push(
      setTimeout(() => setRush(null), (count - 1) * RUSH_STEP + RUSH_TIME + 120)
    );
  };

  useEffect(() => () => rushTimers.current.forEach(clearTimeout), []);

  // Двойное нажатие на закладку: к самой дальней работе главы, куда уже дошли.
  // Одиночное по-прежнему открывает главу с начала, поэтому его придерживаем.
  const bookmarkTapRef = useRef({ id: null, timer: null });

  const deepestSeenOfChapter = (chapterId, fallbackIndex) => {
    let deepest = -1;
    drawings.forEach((d, i) => {
      if (d.chapterId !== chapterId) return;
      if (progress.seen[d.id]) deepest = i;
    });
    return deepest >= 0 ? deepest : fallbackIndex;
  };

  const onBookmarkTap = (chap) => {
    const tap = bookmarkTapRef.current;
    if (tap.id === chap.id && tap.timer) {
      clearTimeout(tap.timer);
      bookmarkTapRef.current = { id: null, timer: null };
      jumpTo(deepestSeenOfChapter(chap.id, chap.index));
      return;
    }
    if (tap.timer) clearTimeout(tap.timer);
    const timer = setTimeout(() => {
      bookmarkTapRef.current = { id: null, timer: null };
      jumpTo(chap.index);
    }, 260);
    bookmarkTapRef.current = { id: chap.id, timer };
  };

  useEffect(() => () => {
    if (bookmarkTapRef.current.timer) clearTimeout(bookmarkTapRef.current.timer);
  }, []);

  // Промах по пустому космосу отзывается своим звуком
  useEffect(() => {
    const list = decor && decor.sfx ? decor.sfx.missDark : null;
    if (!list || !list.length) { missPoolRef.current = null; return; }
    const base = import.meta.env.BASE_URL;
    missPoolRef.current = list.map((path) => {
      const copies = Array.from({ length: 2 }, () => {
        const audio = new Audio(base + path.split('/').map(encodeURIComponent).join('/'));
        audio.volume = 0.45;
        audio.preload = 'auto';
        return audio;
      });
      return { copies, i: 0 };
    });
  }, [decor]);

  const playMissRef = useRef(() => {});
  useEffect(() => {
    playMissRef.current = () => {
      const pool = missPoolRef.current;
      if (!pool || !pool.length || !soundEnabled) return;
      const group = pool[Math.floor(Math.random() * pool.length)];
      const audio = group.copies[group.i];
      group.i = (group.i + 1) % group.copies.length;
      try { audio.currentTime = 0; audio.play().catch(() => {}); } catch (err) { /* тишина */ }
    };
  }, [soundEnabled]);

  // Габарит балки задаёт первая стадия: следующие шире на десяток пикселей,
  // и без этого камень толстел бы прямо от удара
  useEffect(() => {
    if (!decor || !decor.seam || !decor.seam.length) return;
    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalWidth && probe.naturalHeight) {
        setSeamAspect(probe.naturalWidth / probe.naturalHeight);
      }
    };
    probe.src = `${import.meta.env.BASE_URL}${decor.seam[0]}`;

    // остальные стадии подгружаем заранее: иначе первый удар ждёт картинку
    decor.seam.slice(1).forEach((path) => {
      const img = new Image();
      img.src = `${import.meta.env.BASE_URL}${path}`;
    });
  }, [decor]);

  const resetDragState = () => {
    setDragState({ isDragging: false, angle: 0, direction: null, isReleasing: false, releaseDuration: 800 });
  };

  const handlePointerDown = (e) => {
    if (holdingGem || rush || sceneLockRef.current) return;
    // Пока пентаграмма не собрана, страница листается как обычно.
    // Черчение перехватывает ввод только когда все глаза на месте.
    if (trialActive && currentChapterId === 'chapter-3' && eyesTaken >= eyesTotal) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (isFlipping || dragState.isReleasing) return;

    if (isPlaying) setIsPlaying(false);

    const clientX = e.clientX;
    if (clientX === undefined) return;

    const rect = bookRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const R = clientX - centerX;

    // Возле корешка радиус R крошечный, и вращение (acos от d/R) становится
    // нестабильным. Такую центральную полосу обрабатываем как клик для
    // перелистывания, а не как перетаскивание с поворотом страницы.
    const clickZone = Math.max(45, rect.width * 0.11);
    const clickOnly = Math.abs(R) < clickZone;

    dragRef.current = {
      startX: clientX,
      R,
      centerX,
      clickOnly,
      samples: [{ x: clientX, t: performance.now() }],
      rafId: null,
      pendingAngle: null,
      pendingDirection: null,
      onPhoto: !!(e.target.closest && e.target.closest('.photo-wrapper'))
    };
    setDragState({ isDragging: true, angle: 0, direction: null, isReleasing: false, releaseDuration: 800 });

    if (e.currentTarget.setPointerCapture && e.pointerId !== undefined) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {
        console.warn('Pointer capture failed:', err);
      }
    }
  };

  const handlePointerMove = (e) => {
    if (!dragState.isDragging || dragState.isReleasing) return;
    if (dragRef.current.clickOnly) return;
    const { centerX, R, startX } = dragRef.current;

    const clientX = e.clientX;
    if (clientX === undefined) return;

    const now = performance.now();
    const samples = dragRef.current.samples;
    samples.push({ x: clientX, t: now });
    while (samples.length > 2 && now - samples[0].t > 100) {
      samples.shift();
    }

    let direction = dragRef.current.pendingDirection || dragState.direction;
    if (!direction) {
      const deltaX = clientX - startX;
      if (Math.abs(deltaX) > 8) {
        if (R > 0 && deltaX > 0) return;
        if (R < 0 && deltaX < 0) return;

        direction = R > 0 ? 'next' : 'prev';
        // Пока глаза открыты, назад страницу не увести
        if (direction === 'prev' && backLocked) {
          refuseForward();
          resetDragState();
          return;
        }
        // Запертая глава не показывает даже краешка: страницу не поднять вовсе.
        // Но там, где стоит замок из цепей, поднять её можно — до упора
        if (direction === 'next' && forwardLocked && !chainGateRef.current) {
          refuseForward();
          resetDragState();
          return;
        }
        if (direction === 'next' && currentIndex >= drawings.length - 1) {
          resetDragState();
          return;
        }
        if (direction === 'prev' && currentIndex === 0) {
          resetDragState();
          return;
        }
      } else {
        return;
      }
    }

    const d = clientX - centerX;
    const ratio = Math.max(-1, Math.min(1, d / R));
    const naturalAngle = Math.acos(ratio) * (180 / Math.PI);
    let angle = direction === 'next' ? -naturalAngle : naturalAngle;

    // У границы глав лист идёт свободно, как любой другой: в него ничего не
    // упирается. Сцена начинается сама, когда его подняли достаточно высоко
    if (direction === 'next' && chainGateRef.current && angle < -36 && startBeyondRef.current) {
      startBeyondRef.current(angle);
    }

    dragRef.current.pendingAngle = angle;
    dragRef.current.pendingDirection = direction;

    if (dragRef.current.rafId === null) {
      dragRef.current.rafId = requestAnimationFrame(() => {
        dragRef.current.rafId = null;
        setDragState(prev => {
          if (!prev.isDragging || prev.isReleasing) return prev;
          return {
            ...prev,
            direction: dragRef.current.pendingDirection,
            angle: dragRef.current.pendingAngle
          };
        });
      });
    }
  };

  const handlePointerUp = (e) => {
    if (!dragState.isDragging || dragState.isReleasing) return;

    if (dragRef.current.rafId !== null) {
      cancelAnimationFrame(dragRef.current.rafId);
      dragRef.current.rafId = null;
    }

    if (e.currentTarget.hasPointerCapture && e.pointerId !== undefined && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const clientX = e.clientX !== undefined ? e.clientX : dragRef.current.startX;
    const direction = dragRef.current.pendingDirection || dragState.direction;
    const angle = dragRef.current.pendingAngle !== null ? dragRef.current.pendingAngle : dragState.angle;

    if (!direction) {
      resetDragState();
      if (ENABLE_PHOTO_FLIP && dragRef.current.onPhoto) {
        setPhotoFlipped(prev => !prev);
      } else if (clientX > dragRef.current.centerX) {
        handleNext();
      } else {
        handlePrev();
      }
      return;
    }

    const samples = dragRef.current.samples;
    let velocity = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) velocity = (last.x - first.x) / dt;
    }

    const flickThreshold = 0.4;
    let complete;
    if (direction === 'next') {
      if (velocity <= -flickThreshold) complete = true;
      else if (velocity >= flickThreshold) complete = false;
      else complete = angle <= -90;
    } else {
      if (velocity >= flickThreshold) complete = true;
      else if (velocity <= -flickThreshold) complete = false;
      else complete = angle >= 90;
    }

    if (direction === 'next' && forwardLocked) {
      complete = false;
      if (!chainGateRef.current) refuseForward();
    }
    if (direction === 'prev' && backLocked) {
      complete = false;
      refuseForward();
    }

    const currentAbs = Math.abs(angle);
    const remaining = complete ? 180 - currentAbs : currentAbs;
    const duration = Math.round(Math.max(250, Math.min(700, remaining * 5)));
    const targetAngle = complete ? (direction === 'next' ? -180 : 180) : 0;

    setDragState(prev => ({
      ...prev,
      direction,
      isReleasing: true,
      releaseDuration: duration,
      angle: targetAngle
    }));

    if (complete) playPaperSound();

    setTimeout(() => {
      if (complete && !sceneLockRef.current) {
        setPhotoFlipped(false);
        if (direction === 'next') {
          setCurrentIndex(prev => Math.min(prev + 1, drawings.length - 1));
        } else {
          setCurrentIndex(prev => Math.max(prev - 1, 0));
        }
      }
      resetDragState();
    }, duration);
  };

  const handlePointerCancel = () => {
    if (!dragState.isDragging || dragState.isReleasing) return;

    if (dragRef.current.rafId !== null) {
      cancelAnimationFrame(dragRef.current.rafId);
      dragRef.current.rafId = null;
    }

    const direction = dragRef.current.pendingDirection || dragState.direction;
    if (!direction) {
      resetDragState();
      return;
    }

    setDragState(prev => ({ ...prev, direction, isReleasing: true, releaseDuration: 300, angle: 0 }));
    setTimeout(() => {
      resetDragState();
    }, 300);
  };

  if (loading) {
    return (
      <div className={`book-container ${trialActive && tamed ? 'hunting' : ''}`}>
        <RefreshCw className="animate-spin" size={32} />
        <span style={{ marginTop: '15px', color: 'var(--color-text-muted)' }}>Загрузка галереи...</span>
      </div>
    );
  }

  if (drawings.length === 0) {
    return (
      <div className="book-container">
        <span style={{ color: 'var(--color-text-muted)' }}>Альбом пуст. Пожалуйста, добавьте рисунки в манифест.</span>
      </div>
    );
  }

  const current = drawings[currentIndex];
  const nextDrawing = drawings[currentIndex + 1];
  const prevDrawing = drawings[currentIndex - 1];

  const showNextDrag = dragState.direction === 'next' && (dragState.isDragging || dragState.isReleasing);
  const showPrevDrag = dragState.direction === 'prev' && (dragState.isDragging || dragState.isReleasing);

  const isNextFlip = showNextDrag || (isFlipping && flipDirection === 'next');
  const isPrevFlip = showPrevDrag || (isFlipping && flipDirection === 'prev');

  const staticLeftDrawing = (isPrevFlip && prevDrawing) ? prevDrawing : current;
  const staticRightDrawing = (isNextFlip && nextDrawing) ? nextDrawing : current;

  // Extract chapters for bookmarks
  const chaptersList = [];
  drawings.forEach((d, i) => {
    if (d.type === 'chapter') {
      chaptersList.push({ title: d.chapterTitle || d.title, index: i, id: d.id });
    }
  });

  // Per-page theme variables: every page carries the colors of its own chapter,
  // so the landing page is already painted correctly during the flight
  const themeVarsFor = (drawing) => {
    const theme = drawing?.eraTheme || {};
    const bgStart = theme.bgStart || (theme.bg && theme.bg[0]) || '#0c0d14';
    const primary = theme.primary || '#2dd4bf';
    const primaryRgb = theme.primaryRgb || '45, 212, 191';
    const glass = theme.glass || 'rgba(17, 19, 31, 0.65)';
    const solidBg = glass.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgb($1, $2, $3)');
    return {
      '--color-primary': primary,
      '--color-primary-rgb': primaryRgb,
      '--bg-gradient-start': bgStart,
      '--glass-bg': solidBg
    };
  };

  const renderLeftFace = (drawing, isBack = false, isStatic = false) => {
    if (!drawing) return null;
    const faceClass = isBack ? 'back' : 'front';

    if (drawing.isCover) {
      return null;
    }

    if (drawing.type === 'chapter') {
      return (
        <div className={`page-face ${faceClass} chapter-page-left`} style={themeVarsFor(drawing)}>
          <div className="chapter-overlay" key="chapter-overlay"></div>
          <ChapterOrnament chapterId={drawing.id} variant="mark" key="chapter-ornament" />
          <h2 key="chapter-title">{drawing.title}</h2>
        </div>
      );
    }
    // Последний лист: пустая надорванная бумага, без работы и подписи
    if (drawing.type === 'broken') {
      return (
        <div className={`page-face ${faceClass} broken-page`} style={themeVarsFor(drawing)}>
          <BrokenSheet seed={drawing.id} side="left" />
          <p className="broken-words">{drawing.leftWords}</p>
        </div>
      );
    }
    // Mini-games placeholders
    if (drawing.type === 'scratch') {
      return (
        <div className="page-face image-page" style={{ ...themeVarsFor(drawing), padding: 0 }}>
          <ScratchGame imageSrc={drawing.image} />
        </div>
      );
    }
    if (drawing.type === 'polaroids') {
      return (
        <div className="page-face image-page" style={{ ...themeVarsFor(drawing), padding: 0 }}>
          <PolaroidGame />
        </div>
      );
    }
    // Normal Image Page
    const isFlippedPhoto = photoFlipped && drawings[currentIndex] && drawing.id === drawings[currentIndex].id;
    return (
      <div className={`page-face ${faceClass} image-page`} style={themeVarsFor(drawing)}>
        <div
          className={`photo-wrapper ${ENABLE_PHOTO_FLIP ? 'flippable' : ''} ${COSMIC_CHAPTERS.includes(drawing.chapterTitle) ? 'cosmic' : ''}`}
          key="photo-wrapper"
          style={drawing.w && drawing.h ? { aspectRatio: `${drawing.w} / ${drawing.h}` } : undefined}
        >
          {drawing.title === FINAL_WORK && (!progress.done['chapter-3'] || unveil) && INTERACTIVE_MODE && (
            <PentagramLayer taken={takenEyes} total={eyesTotal} finale={unveil} />
          )}

          {drawing.chapterId === 'chapter-3' && !progress.done['chapter-3'] && (
            <PaintingEyes
              key={`eyes-${drawing.id}-${isStatic ? 'flat' : 'flip'}`}
              title={drawing.title}
              live={isStatic}
              closed={eyesClosed[drawing.title] || []}
              manifest={decor}
              soundEnabled={soundEnabled}
              onEscape={(from, index) => {
                setEyeEscapes((v) => v + 1);
                setEyesClosed((prev) => {
                  const list = prev[from] || [];
                  if (list.includes(index)) return prev;
                  return { ...prev, [from]: [...list, index] };
                });
              }}
            />
          )}

          {COSMIC_CHAPTERS.includes(drawing.chapterTitle) ? (
            <CornerConstellations seed={drawing.id} />
          ) : CRYSTAL_CHAPTERS.includes(drawing.chapterTitle) ? (
            <CornerCrystals seed={drawing.id} />
          ) : EYE_HOLD_CHAPTERS.includes(drawing.chapterTitle) ? (
            <CornerEyes seed={drawing.id} avert={eyeScatter && drawing.title === BEACON_TITLE} />
          ) : SHARD_CHAPTERS.includes(drawing.chapterTitle) ? (
            <CornerShards seed={drawing.id} />
          ) : (
            <>
              <div className="photo-corner tl"></div>
              <div className="photo-corner tr"></div>
              <div className="photo-corner bl"></div>
              <div className="photo-corner br"></div>
            </>
          )}
          <div className={`photo-flipper ${isFlippedPhoto ? 'flipped' : ''}`}>
            <img
              src={`${import.meta.env.BASE_URL}${drawing.image}`}
              alt={drawing.title}
              className="drawing-image"
              draggable={false}
              onLoad={(e) => {
                if (drawing.w && drawing.h) return;
                const wrapper = e.target.closest('.photo-wrapper');
                if (wrapper && e.target.naturalWidth && e.target.naturalHeight) {
                  wrapper.style.aspectRatio = `${e.target.naturalWidth} / ${e.target.naturalHeight}`;
                }
              }}
              onError={(e) => {
                e.target.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%25%22 height=%22100%25%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23111%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23555%22 font-family=%22sans-serif%22>Ошибка загрузки...</text></svg>';
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', display: 'block' }}
            />
            <div className="photo-back-side">
              <div className="photo-note">
                <span className="photo-note-year">{drawing.year}</span>
                <h3>{drawing.title}</h3>
                <p>{(drawing.story || drawing.description || '').replace(/\.\s*$/, '')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRightFace = (drawing, isBack = false, isStatic = false) => {
    if (!drawing) return null;
    const faceClass = isBack ? 'back' : 'front';

    if (drawing.isCover) {
      return (
        <div
          className={`page-face ${faceClass} book-cover`}
          style={themeVarsFor(drawing)}
          onClick={() => { if (currentIndex === 0) handleNext(); }}
        >
          <div className="cover-content">
            <h1>Искусство длиною в жизнь</h1>
            <p>Личное портфолио Рузанны Манвелян</p>
          </div>
        </div>
      );
    }

    if (drawing.type === 'chapter') {
      return (
        <div className={`page-face ${faceClass} chapter-page-right`} style={themeVarsFor(drawing)}>
          <div className="chapter-overlay" key="chapter-overlay"></div>
          <ChapterOrnament chapterId={drawing.id} variant="none" key="chapter-ornament" />
          <p className="chapter-subtitle" key="chapter-subtitle">{drawing.description}</p>
        </div>
      );
    }
    if (drawing.type === 'broken') {
      return (
        <div className={`page-face ${faceClass} broken-page`} style={themeVarsFor(drawing)}>
          <BrokenSheet seed={drawing.id} side="right" />
          <p className="broken-words">{drawing.description}</p>
        </div>
      );
    }
    // Mini-games placeholders right side
    if (drawing.type === 'scratch' || drawing.type === 'polaroids') {
      return (
        <div className={`page-face ${faceClass} content-page`} style={{ ...themeVarsFor(drawing), justifyContent: 'center', alignItems: 'center' }}>
           <p className="page-description" style={{textAlign: 'center'}}>{drawing.description}</p>
        </div>
      );
    }
    // Normal Content Page
    const guardSeam = seamVisible && drawings[seamIndex] && drawing.id === drawings[seamIndex].id;
    // Пока испытание не пройдено, у безликой жрицы не разобрать ни слова
    const veiled = INTERACTIVE_MODE &&
      drawing.title === FINAL_WORK && !progress.done['chapter-3'];
    return (
      <div
        className={`page-face ${faceClass} content-page ${guardSeam ? 'seam-guard' : ''}`}
        style={themeVarsFor(drawing)}
      >
        <div className="page-header">
          <h2>
            {veiled
              ? <GlyphText text={drawing.title} revealed={false} />
              : drawing.title}
          </h2>
          {(drawing.date || drawing.year) && (
            <p className="page-year">{drawing.date || `${drawing.year} год`}</p>
          )}
        </div>
        <div className="page-body">
          <p className="page-description">
            {veiled
              ? <GlyphText text={drawing.description || ''} revealed={false} />
              : drawing.description}
          </p>
          {drawing.story && (
            <p className="page-story">
              {veiled
                ? <GlyphText text={drawing.story.replace(/\.\s*$/, '')} revealed={false} speed={2} />
                : drawing.story.replace(/\.\s*$/, '')}
            </p>
          )}
        </div>

        {guardSeam && decor && seamStage < SEAM_STAGES && (
          <img
            ref={isStatic ? seamRef : null}
            className={`page-seam ${seamHits ? (seamHits % 2 ? 'struck-a' : 'struck-b') : ''}`}
            style={seamAspect ? { aspectRatio: String(seamAspect) } : undefined}
            src={`${import.meta.env.BASE_URL}${decor.seam[Math.min(seamStage, decor.seam.length - 1)]}`}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        )}
      </div>
    );
  };

  // Сад считает открытые работы главы: каждая пускает свой стебель
  const GARDEN_CHAPTER = 'chapter-4';
  const gardenActive = INTERACTIVE_MODE &&
    (currentChapterId === GARDEN_CHAPTER || chapterIdOf(drawings[seamIndex]) === GARDEN_CHAPTER);
  const gardenGrown = drawings.reduce(
    (n, d) => (d.chapterId === GARDEN_CHAPTER && progress.seen[d.id] ? n + 1 : n), 0
  );

  const eyesTotal = Object.values(EYE_MAPS).reduce((n, list) => n + list.length, 0);
  const eyesTaken = Object.entries(eyesClosed).reduce(
    (n, [work, list]) => n + Math.min(list.length, (EYE_MAPS[work] || []).length), 0
  );

  // В пентаграмму встают ровно те глаза, что были сняты с работ
  const takenEyes = Object.entries(eyesClosed).flatMap(([work, list]) =>
    (list || [])
      .map((i) => (EYE_MAPS[work] || [])[i])
      .filter(Boolean)
      .map((spec) => ({
        style: spec.style || 'plain',
        exit: spec.exit,
        flat: spec.flat || 0.55,
        big: (spec.r || 0.05) > 0.07,
        twin: spec.exit === 'split'
      }))
  );

  const renaissanceSeen = INTERACTIVE_MODE
    ? drawings.reduce((n, d) => n + (d.chapterId === 'chapter-3' && progress.seen[d.id] ? 1 : 0), 0)
    : 0;

  return (
    <div className={`book-container ${beyondScene ? 'beyond-scene' : ''}`}>
      <canvas ref={canvasRef} className="background-canvas" />

      <div className={`chapter-blackout ${blackout ? 'on' : ''}`} aria-hidden="true"></div>

      {beaconCry && <div className="beacon-cry" key={beaconCry}>{beaconCry}</div>}

      <BeyondLayer
        active={INTERACTIVE_MODE && !beyondScene && currentChapterId === 'chapter-interactive'}
        soundEnabled={soundEnabled}
      />

      <GardenLayer
        bookRef={bookRef}
        soundEnabled={soundEnabled}
        active={gardenActive && !beyondScene}
        grown={progress.done[GARDEN_CHAPTER] ? Math.max(gardenGrown, 26) : gardenGrown}
        bloom={gardenBloom || Boolean(progress.done[GARDEN_CHAPTER])}
      />

      <BeyondGate
        active={beyondScene}
        bookRef={bookRef}
        soundEnabled={soundEnabled}
        onDrift={(part) => setBookDrift(part)}
        onFail={() => {
          // свет погас: книга возвращается, и дорогу можно пройти заново
          setBookDrift(0);
          setBeyondScene(false);
          lockScene(false);
          startedBeyondRef.current = false;
        }}
        onComplete={() => {
          // сцена дошла до белизны: глава взята, и открывается уже другая книга.
          // Белизна остаётся поверх всего, и книга меняется скрытно под ней
          setWhiteVeil(1);
          completeChallenge(GARDEN_CHAPTER);
          setGardenBloom(true);
          // нужен разделитель главы — тот самый лист с надписью, а не первая работа
          const beyond = drawings.findIndex((d) => d.chapterTitle === 'За гранью');
          if (beyond >= 0) setCurrentIndex(beyond);
          setBookDrift(0);
          setBeyondScene(false);
          lockScene(false);
          // за белым слышно, как переворачивают лист, и лишь потом она тает
          setTimeout(() => { if (playPaperSoundRef.current) playPaperSoundRef.current(); }, 420);
          setTimeout(() => setWhiteVeil(2), 1500);
          setTimeout(() => setWhiteVeil(0), 4200);
        }}
      />

      {whiteVeil > 0 && (
        <div className={`beyond-veil ${whiteVeil === 2 ? 'gone' : ''}`} aria-hidden="true" />
      )}

      <ScreenVeins
        active={INTERACTIVE_MODE && (currentChapterId === 'chapter-3' || chapterIdOf(drawings[seamIndex]) === 'chapter-3')}
        grown={eyesTaken}
        bookRef={bookRef}
      />

      <RenaissanceEyes
        active={INTERACTIVE_MODE && (currentChapterId === 'chapter-3' || chapterIdOf(drawings[seamIndex]) === 'chapter-3')}
        groups={eyeEscapes}
        manifest={decor}
        soundEnabled={soundEnabled}
        scatter={eyeScatter}
      />

      <GenesisTrial
        active={INTERACTIVE_MODE && (currentChapterId === 'chapter-2' || chapterIdOf(drawings[seamIndex]) === 'chapter-2') && Boolean(decor)}
        trialPage={seamVisible}
        bookRef={bookRef}
        seamRef={seamRef}
        seamStage={seamStage}
        manifest={decor}
        soundEnabled={soundEnabled}
        onHoldChange={setHoldingGem}
        onSeamHit={() => { setSeamStage((v) => v + 1); setSeamHits((v) => v + 1); }}
        onComplete={() => completeChallenge(currentChapterId)}
      />

      <EyeTrial
        active={trialActive && currentChapterId === 'chapter-3'}
        bookRef={bookRef}
        collected={eyesTaken}
        total={eyesTotal}
        taken={takenEyes}
        onComplete={() => {
          // сперва знак прощается, и лишь когда работа проступит целиком,
          // глава считается пройденной
          setUnveil(true);
          unveilTimers.current.forEach(clearTimeout);
          unveilTimers.current = [
            setTimeout(() => completeChallenge('chapter-3'), 3400),
            setTimeout(() => setUnveil(false), 4200)
          ];
        }}
        onMiss={() => {
          // промах отбрасывает к маяку главы: там всё уже сказано.
          // Но если испытание уже взято, назад не тянем ни при каких щелчках
          if (unveil || progress.done['chapter-3']) return;
          const beacon = drawings.findIndex((d) => d.title === BEACON_TITLE);
          if (beacon >= 0) hurlTo(beacon);
        }}
      />

      <TrialOverlay
        active={trialActive && currentChapterId === 'chapter-1'}
        armed={tamed}
        bookRef={bookRef}
        primaryRgb={drawings[themeIndex]?.eraTheme?.primaryRgb || '139, 157, 250'}
        onComplete={() => {
          completeChallenge(currentChapterId);
          setTimeout(() => {
            if (handleNextRef.current) handleNextRef.current();
          }, 300);
        }}
      />

      {/* 3D Book */}
      <div className="book-wrapper" ref={bookRef}>
        {/* Bookmarks */}
        <div className="book-bookmarks" style={{ opacity: isCoverClosed ? 0 : 1, pointerEvents: isCoverClosed ? 'none' : 'auto', transition: isCoverClosed ? 'opacity 0.2s ease 0s' : 'opacity 0.6s ease 0.8s' }}>
          {chaptersList.map((chap, i) => {
            const isActive = currentIndex >= chap.index && (i === chaptersList.length - 1 || currentIndex < chaptersList[i+1].index);
            const locked = INTERACTIVE_MODE && unlockMap[chap.id] === false;
            if (locked && justUnlocked !== chap.id) return null;
            return (
              <div
                key={i}
                className={`bookmark ${isActive ? 'active' : ''} ${locked ? 'locked' : ''} ${justUnlocked === chap.id ? 'snapping' : ''}`}
                onClick={() => {
                  if (locked) {
                    refuseForward();
                    return;
                  }
                  onBookmarkTap(chap);
                }}
                title={`${chap.title} — двойное нажатие уводит к дальнему краю прочитанного`}
              >
                {chap.title}
                {(locked || justUnlocked === chap.id) && (
                  <span className="bookmark-chain" aria-hidden="true">
                    <span className="chain-link"></span>
                    <span className="chain-link"></span>
                    <span className="chain-link"></span>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div 
          className={`book ${isFlipping ? 'flipping' : ''} ${(dragState.isDragging || dragState.isReleasing) ? 'dragging' : ''} ${isCoverClosed ? 'closed' : ''} ${forwardLocked ? 'forward-locked' : ''} ${straining ? 'straining' : ''}`}
          data-lock-nudge={lockNudge}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{
            touchAction: 'none',
            // пока идёт сцена, книга отъезжает влево вслед за огоньком
            transform: beyondScene || bookDrift
              ? `translateX(${-bookDrift * 46}vw) scale(${1 - bookDrift * 0.12})`
              : undefined,
            opacity: beyondScene || bookDrift ? Math.max(0, 1 - bookDrift * 1.25) : undefined,
            transition: beyondScene || bookDrift
              ? 'transform 1.1s ease-out, opacity 1.1s ease-out'
              : undefined
          }}
        >
          
            {/* Static Left Page (Shows underneath drawing during prev flip) */}
            {staticLeftDrawing && !staticLeftDrawing.isCover && (
              <div className="page left-page" key={`left-${staticLeftDrawing.id}`} style={{ 
                opacity: isCoverClosed ? 0 : 1, 
                visibility: isCoverClosed ? 'hidden' : 'visible',
                transition: isCoverClosed ? 'opacity 0.2s ease 0s, visibility 0s linear 0.2s' : 'opacity 0.6s ease 0.3s, visibility 0s linear 0s' 
              }}>
                {renderLeftFace(staticLeftDrawing, false, true)}
              </div>
            )}

          {/* Static Right Page (Shows underneath description during next flip) */}
          <div className="page right-page" key={`right-${staticRightDrawing.id}`}>
            {renderRightFace(staticRightDrawing, false, true)}
          </div>

          {/* Dynamic Drag/Flipping Page (Next) */}
          {(showNextDrag || (isFlipping && flipDirection === 'next')) && nextDrawing && (
            <div
              className={`page right-page flip-page ${showNextDrag ? (dragState.isReleasing ? 'flip-releasing' : '') : 'flip-anim'}`}
              style={
                showNextDrag
                  ? {
                      transform: `rotateY(${dragState.angle}deg)`,
                      transition: dragState.isReleasing ? `transform ${dragState.releaseDuration}ms ${dragState.releaseEase || 'cubic-bezier(0.645, 0.045, 0.355, 1)'}` : 'none',
                      zIndex: 10,
                      '--shade': dragState.isReleasing ? 0 : Math.round(Math.sin(Math.abs(dragState.angle) * Math.PI / 180) * 55) / 100,
                      '--shade-dur': `${dragState.releaseDuration}ms`
                    }
                  : {
                      transform: 'rotateY(0deg)',
                      animation: 'flipToLeft 0.8s forwards cubic-bezier(0.645, 0.045, 0.355, 1)',
                      zIndex: 10
                    }
              }
            >
              {/* Front of the flipping page: shows current description during flip */}
              {renderRightFace(current, false)}

              {/* Back of the flipping page: shows next drawing during flip */}
              {renderLeftFace(nextDrawing, true)}
            </div>
          )}

          {/* Dynamic Drag/Flipping Page (Prev) */}
          {(showPrevDrag || (isFlipping && flipDirection === 'prev')) && prevDrawing && (
            <div
              className={`page left-page flip-page ${showPrevDrag ? (dragState.isReleasing ? 'flip-releasing' : '') : 'flip-anim'}`}
              style={
                showPrevDrag
                  ? {
                      transform: `rotateY(${dragState.angle}deg)`,
                      transition: dragState.isReleasing ? `transform ${dragState.releaseDuration}ms ${dragState.releaseEase || 'cubic-bezier(0.645, 0.045, 0.355, 1)'}` : 'none',
                      zIndex: 10,
                      '--shade': dragState.isReleasing ? 0 : Math.round(Math.sin(Math.abs(dragState.angle) * Math.PI / 180) * 55) / 100,
                      '--shade-dur': `${dragState.releaseDuration}ms`
                    }
                  : {
                      transform: 'rotateY(180deg)',
                      animation: 'flipToRight 0.8s forwards cubic-bezier(0.645, 0.045, 0.355, 1)',
                      zIndex: 10
                    }
              }
            >
              {/* Front of the flipping page: shows current drawing */}
              {renderLeftFace(current, false)}

              {/* Back of the flipping page: shows previous description */}
              {renderRightFace(prevDrawing, true)}
            </div>
          )}

          {/* Пачка листов, улетающая при переходе по закладке */}
          {rush && rush.sheets.map((sheet, i) => (
            <div
              key={`rush-${i}`}
              className={`page ${rush.dir === 'next' ? 'right-page' : 'left-page'} flip-page flip-anim rush-page`}
              style={{
                transform: rush.dir === 'next' ? 'rotateY(0deg)' : 'rotateY(180deg)',
                animation: `${rush.dir === 'next' ? 'flipToLeft' : 'flipToRight'} ${RUSH_TIME}ms forwards cubic-bezier(0.42, 0.02, 0.35, 1), rushVanish ${RUSH_TIME}ms forwards linear`,
                animationDelay: `${i * RUSH_STEP}ms`,
                zIndex: 40 + (rush.sheets.length - i)
              }}
            >
              {rush.dir === 'next' ? (
                <>
                  {renderRightFace(sheet.front, false)}
                  {renderLeftFace(sheet.back, true)}
                </>
              ) : (
                <>
                  {renderLeftFace(sheet.front, false)}
                  {renderRightFace(sheet.back, true)}
                </>
              )}
            </div>
          ))}

        </div>
      </div>

      {/* Control Buttons */}
      <div
        className={`panel-dock ${panelOpen ? 'open' : ''}`}
        style={{ opacity: isCoverClosed ? 0 : 1, pointerEvents: isCoverClosed ? 'none' : 'auto' }}
      >
        <div className="controls-panel">
        <button 
          className="control-btn nav-btn" 
          onClick={handlePrev} 
          disabled={currentIndex === 0 || isFlipping || backLocked || sceneLocked}
          title="Предыдущая страница"
        >
          <ChevronLeft size={24} />
        </button>

        <button 
          className="control-btn" 
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? "Остановить авто-пролистывание" : "Начать авто-пролистывание"}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button 
          className="control-btn nav-btn" 
          onClick={handleNext} 
          disabled={currentIndex === drawings.length - 1 || isFlipping || sceneLocked}
          title="Следующая страница"
        >
          <ChevronRight size={24} />
        </button>

        <button 
          className="control-btn" 
          onClick={() => setPlayInterval(prev => prev === 10000 ? 15000 : prev === 15000 ? 5000 : 10000)}
          title={`Интервал: ${playInterval / 1000}с`}
        >
          <Clock size={20} />
          <span style={{marginLeft: 5, fontSize: '0.8rem'}}>{playInterval / 1000}s</span>
        </button>

        <button
          className="control-btn"
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? "Выключить звук" : "Включить звук"}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>

        <button
          ref={musicBtnRef}
          className={`control-btn music-btn ${musicEnabled ? '' : 'music-off'}`}
          onClick={() => setMusicEnabled(!musicEnabled)}
          onPointerEnter={showVolume}
          onPointerLeave={hideVolume}
          onFocus={showVolume}
          onBlur={hideVolume}
          title={musicEnabled ? "Выключить музыку главы" : "Включить музыку главы"}
        >
          <Music size={20} />
        </button>
        </div>

        <button
          className="panel-toggle"
          onClick={() => setPanelOpen((v) => !v)}
          title={panelOpen ? 'Убрать управление' : 'Выдвинуть управление'}
        >
          <ChevronDown size={20} />
        </button>
      </div>

      {/* Громкость музыки. Стоит вне язычка: у того обрезаются края,
          и выехавший ползунок был бы срезан вместе с ними */}
      <div
        className={`music-volume ${volumeOpen && panelOpen && !isCoverClosed ? 'open' : ''}`}
        style={{ top: volumeBox.top, right: volumeBox.right }}
        onPointerEnter={showVolume}
        onPointerLeave={hideVolume}
      >
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={musicVolume}
          style={{ '--fill': musicVolume }}
          onChange={(e) => setMusicVolume(Number(e.target.value))}
          title={`Громкость музыки: ${musicVolume}%`}
          aria-label="Громкость музыки"
        />
        <span className="music-volume-value">{musicVolume}</span>
      </div>

      {/* CSS flip animations */}
      <style>{`
        @keyframes flipToLeft {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(-180deg); }
        }
        @keyframes flipToRight {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(180deg); }
        }
      `}</style>
    </div>
  );
}
