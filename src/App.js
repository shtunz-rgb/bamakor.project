import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { customLocations } from './locations';
import { BIRTH_PLACE_EXCLUSIONS } from './exclusions';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const PROJECT_NAME = "במקור.פרוג׳קט";

// Replace apostrophe variants with SQL single-char wildcard (_) for ilike queries,
// so the search matches regardless of which apostrophe character the DB stores.
const normalizeQuery = (q) => q.replace(/['\u2019\u02BC\u05F3]/g, '_');

const ONBOARDING_KEY = 'bamakor_onboarding_done';

const ONBOARDING_SLIDES = [
  {
    title: 'ברוכים הבאים לבמקור.פרוג׳קט',
    body: 'מאגר האישים הגדול ביותר על המפה בעברית — גלו היכן נולדו אישים ידועים מישראל ומהעולם. כל אישיות מדורגת לפי מדד עוצמה כשלחיצה על כל אישיות תפנה ישירות לדף הוויקיפדיה שלה.',
  },
  {
    title: 'איך מחפשים?',
    body: 'הקלידו שם של אישיות או שם יישוב בתיבת החיפוש שבראש המסך. בחרו מהתוצאות המוצעות — אם חיפשתם אישיות, המפה תנווט ישירות אל עיר הלידה שלה ותציג אותה בראש הרשימה. אם חיפשתם יישוב, תיפתח רשימת האישים שנולדו בו.',
  },
  {
    title: 'שימוש במפה',
    body: 'כל נקודה על המפה מייצגת יישוב הכלול במאגר. לחצו על כל נקודה כדי לפתוח את רשימת האישים שנולדו בה, מדורגים מהפופולרי ביותר לפחות פופולרי לפי מדד העוצמה הוויקיפדי.',
  },
];

const calcScore = p => {
  const base = Math.round(((p.num_wiki_languages || 0) * 0.3) + (((p.wikipage_wordcount || 0) / 100) * 0.7));
  return (p.num_wiki_languages || 0) >= 80 ? base * 2 : base;
};

const BATCH_SIZE = 20;

// ── Anonymous user ID ─────────────────────────────────────────────────────────

const getOrCreateUid = () => {
  try {
    let uid = localStorage.getItem('bamakor_uid');
    if (!uid) {
      uid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('bamakor_uid', uid);
    }
    return uid;
  } catch { return null; }
};

// ── Streak helpers ────────────────────────────────────────────────────────────

const STREAK_KEY = 'bamakor_streak_v1';

const readStreak = () => {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || { streak: 0, lastDate: null, lastCorrect: false }; }
  catch { return { streak: 0, lastDate: null, lastCorrect: false }; }
};

const getActiveStreak = (data, todayStr) => {
  if (!data.lastDate) return 0;
  if (data.lastDate === todayStr) return data.streak;
  const prev = new Date(todayStr);
  prev.setDate(prev.getDate() - 1);
  if (data.lastDate === prev.toISOString().slice(0, 10) && data.lastCorrect) return data.streak;
  return 0;
};

// ── Daily game helpers ───────────────────────────────────────────────────────

const getDailySeed = (dateStr) => {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (Math.imul(31, h) + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

const seededPick = (arr, n, seed) => {
  const out = [], used = new Set();
  let s = seed;
  while (out.length < n && out.length < arr.length) {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    const idx = Math.abs(s) % arr.length;
    if (!used.has(idx)) { used.add(idx); out.push(arr[idx]); }
  }
  return out;
};

const seededShuffle = (arr, seed) => {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchError, setSearchError] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_KEY));
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [settlementSummary, setSettlementSummary] = useState('');
  const [people, setPeople] = useState([]);
  const [remainingPeople, setRemainingPeople] = useState([]);
  const [previewPerson, setPreviewPerson] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [mapZoom, setMapZoom] = useState(7);
  const [locationCounts, setLocationCounts] = useState(new Map());
  const [showContactModal, setShowContactModal] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkDone, setBookmarkDone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [gameData, setGameData] = useState(null);
  const [gameLoading, setGameLoading] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [contactMessage, setContactMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactStatus, setContactStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [highlightedPersonId, setHighlightedPersonId] = useState(null);
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);
  const onboardingMarkersRef = useRef([]);
  const personRefs = useRef({});
  const peopleCache = useRef(new Map());
  const fetchTokenRef = useRef(0);

  // Initialize Supabase client once using the installed npm package (no CDN needed)
  const supabaseClient = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }, []);

  // Track site visit (fire-and-forget)
  useEffect(() => {
    if (!supabaseClient) return;
    const uid = getOrCreateUid();
    if (uid) supabaseClient.rpc('upsert_user_visit', { p_uid: uid });
  }, [supabaseClient]);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const loadLeaflet = async () => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        const L = window.L;
        const map = L.map(mapRef.current, { zoomControl: false, scrollWheelZoom: true, tap: false, bounceAtZoomLimits: false }).setView([31.5, 35.0], window.innerWidth >= 640 ? 8 : 7);
        leafletMapRef.current = map;
        map.on('zoomend', () => setMapZoom(map.getZoom()));

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        renderMarkers();
      };
      document.body.appendChild(script);
    };

    loadLeaflet();
  }, []);


  useEffect(() => {
    if (leafletMapRef.current) {
      renderMarkers();
    }
  }, [selectedSettlement]);


  const renderMarkers = () => {
    if (!leafletMapRef.current) return;
    const L = window.L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Dynamic location marker (not in customLocations, e.g. Buenos Aires)
    const isDynamicSelected = selectedSettlement && !customLocations.find(s => s.id === selectedSettlement.id);
    if (isDynamicSelected) {
      const rippleIcon = L.divIcon({
        className: 'ripple-wrapper',
        html: '<div class="ripple-effect"></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      markersRef.current.push(
        L.marker([selectedSettlement.lat, selectedSettlement.lng], { icon: rippleIcon, interactive: false }).addTo(leafletMapRef.current)
      );
      markersRef.current.push(
        L.circleMarker([selectedSettlement.lat, selectedSettlement.lng], {
          radius: 9, fillColor: '#4f46e5', color: '#fff', weight: 2, fillOpacity: 0.9, interactive: false, zIndexOffset: 1000
        }).addTo(leafletMapRef.current)
      );
    }

    customLocations.forEach(s => {
      const isSelected = selectedSettlement && s.id === selectedSettlement.id;

      if (isSelected) {
        const rippleIcon = L.divIcon({
          className: 'ripple-wrapper',
          html: '<div class="ripple-effect"></div>',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        const rippleMarker = L.marker([s.lat, s.lng], { icon: rippleIcon, interactive: false }).addTo(leafletMapRef.current);
        markersRef.current.push(rippleMarker);
      }

      const isMobile = L.Browser.mobile;
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: isSelected ? (isMobile ? 9 : 9) : (isMobile ? 6 : 7),
        fillColor: '#4f46e5',
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9,
        interactive: true,
        zIndexOffset: isSelected ? 1000 : 0
      }).addTo(leafletMapRef.current);

      marker.on('click', () => {
        setHighlightedPersonId(null);
        handleSettlementSelection(s);
      });

      if (!L.Browser.mobile) {
        marker.bindTooltip(s.name, {
          direction: 'auto',
          sticky: true,
          className: 'custom-tooltip',
          opacity: 1
        });
      }

      markersRef.current.push(marker);
    });
  };


  const handleSettlementSelection = (s) => {
    setSelectedSettlement(s);
    setSettlementSummary('');
    setIsSidebarOpen(true);
    fetchWikipediaSummary(s.name);
    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([s.lat, s.lng], 13);
    }
  };


  const fetchWikipediaSummary = async (settlementName) => {
    setSettlementSummary('טוען תיאור יישוב...');
    try {
      const endpoint = `https://he.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(settlementName)}`;
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        const fullText = data.extract || '';
        const sentences = fullText.split('. ');
        const shortText = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : '');
        setSettlementSummary(shortText || 'מידע ביוגרפי משולב');
      } else {
        setSettlementSummary('מידע ביוגרפי משולב');
      }
    } catch (e) {
      setSettlementSummary('מידע ביוגרפי משולב');
    }
  };


  useEffect(() => {
    const fetchSuggestions = async () => {
      const query = normalizeQuery(searchQuery.trim());
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      const matchedSettlements = customLocations
        .filter(s => s.name.includes(query))
        .map(s => ({ ...s, type: 'settlement' }))
        .slice(0, 5);

      let matchedPersons = [];
      if (supabaseClient) {
        const { data } = await supabaseClient
          .from('persons')
          .select('id, full_name, wikidata_id, birth_place_raw, birth_place_by_wikidata, num_wiki_languages, wikipage_wordcount')
          .ilike('full_name', `%${query}%`)
          .limit(5);

        if (data) {
          matchedPersons = data.map(p => ({ ...p, name: p.full_name, type: 'person' }));
        }
      }

      setSuggestions([...matchedSettlements, ...matchedPersons]);
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, supabaseClient]);


  const findLocationByWikidataId = async (qid) => {
    const sparql = `
      SELECT ?coord WHERE {
        wd:${qid} wdt:P19 ?birthPlace .
        ?birthPlace wdt:P625 ?coord .
      } LIMIT 1
    `;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.results.bindings.length > 0) {
        const point = data.results.bindings[0].coord.value;
        const match = point.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
        if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
      }
    } catch (e) {
      console.error("Wikidata fallback failed", e);
    }
    return null;
  };


  const handleSearchSubmit = async (e, forcedItem = null) => {
    if (e) e.preventDefault();
    const query = normalizeQuery(forcedItem ? forcedItem.name : searchQuery.trim());
    if (!query) return;

    setSuggestions([]);

    const settlement = customLocations.find(s => s.name === query);
    if (settlement) {
      setHighlightedPersonId(null);
      handleSettlementSelection(settlement);
      setSearchError(false);
      setSearchQuery('');
      return;
    }

    if (supabaseClient) {
      const { data } = await supabaseClient
        .from('persons')
        .select('*')
        .ilike('full_name', query)
        .limit(1);

      if (data && data.length > 0) {
        const person = data[0];
        setSearchError(false);
        setHighlightedPersonId(person.id);

        const effectiveBirthPlaceRaw = (person.birth_place_raw && person.birth_place_raw !== 'no_bp_in_infobox')
          ? person.birth_place_raw : null;

        const birthCity = customLocations.find(s =>
          effectiveBirthPlaceRaw?.includes(s.name) || person.birth_place_by_wikidata?.includes(s.name)
        );

        if (birthCity) {
          handleSettlementSelection(birthCity);
          setSearchQuery('');
          return;
        } else if (person.wikidata_id) {
          const coords = await findLocationByWikidataId(person.wikidata_id);
          if (coords && leafletMapRef.current) {
            leafletMapRef.current.flyTo([coords.lat, coords.lng], 13);
            const birthLabel = effectiveBirthPlaceRaw || person.birth_place_by_wikidata || "מיקום לידה";
            setSelectedSettlement({ name: birthLabel, ...coords });
            setIsSidebarOpen(true);
            setSettlementSummary(birthLabel);
            setSearchQuery('');
            return;
          }
        }

        setSearchError('השם קיים במאגר, אך לא ניתן לשייך לו מיקום לידה');
        setTimeout(() => setSearchError(false), 5000);
        return;
      }
    }

    setSearchError(`השם "${query}" לא נמצא במאגר האישים או הערים שלנו`);
    setTimeout(() => setSearchError(false), 3000);
  };


  const enrichBatch = async (batch) => {
    const qids = batch.map(p => p.wikidata_id).filter(id => id?.startsWith('Q'));
    if (qids.length === 0) return batch.map(p => ({ ...p, score: calcScore(p) }));
    const sparql = `
      SELECT ?item ?sitelinks ?image ?itemDescription ?coord (YEAR(?birth) AS ?birthYear) WHERE {
        VALUES ?item { ${qids.map(id => `wd:${id}`).join(' ')} }
        ?item wikibase:sitelinks ?sitelinks .
        OPTIONAL { ?item wdt:P18 ?image . }
        OPTIONAL { ?item wdt:P569 ?birth . }
        OPTIONAL {
          ?item wdt:P19 ?birthPlace .
          ?birthPlace wdt:P625 ?coord .
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en". }
      }
    `;
    const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`);
    const wikiData = await res.json();
    const wikiMap = {};
    wikiData.results.bindings.forEach(row => {
      wikiMap[row.item.value.split('/').pop()] = {
        popularity: parseInt(row.sitelinks.value),
        image: row.image ? row.image.value : null,
        description: row.itemDescription ? row.itemDescription.value : null,
        birthYear: row.birthYear ? row.birthYear.value : null,
        coord: row.coord ? row.coord.value : null,
      };
    });
    return batch.map(p => ({ ...p, ...wikiMap[p.wikidata_id], score: calcScore(p) }));
  };

  const loadDailyGame = async () => {
    if (!supabaseClient) return;
    const dateStr = new Date().toISOString().slice(0, 10);

    // Try to restore today's cached game
    try {
      const cached = localStorage.getItem(`bamakor-game-v1-${dateStr}`);
      if (cached) { setGameData(JSON.parse(cached)); return; }
    } catch {}

    setGameLoading(true);
    try {
      const seed = getDailySeed(dateStr);

      // ── Try curated game_personalities table first ─────────────────────────
      // Only pick entries where all 3 wrong answers have been manually filled
      const { data: curated } = await supabaseClient
        .from('game_personalities')
        .select('*')
        .not('wrong_answer_1', 'is', null)
        .not('wrong_answer_2', 'is', null)
        .not('wrong_answer_3', 'is', null)
        .order('id', { ascending: true });

      if (curated && curated.length > 0) {
        // Pick today's entry deterministically
        const entry = curated[seed % curated.length];

        // Fetch person record for enrichment
        const { data: personRows } = await supabaseClient
          .from('persons')
          .select('*')
          .eq('id', entry.person_id)
          .limit(1);

        const basePersonRow = personRows?.[0];
        let person = basePersonRow ? (await enrichBatch([basePersonRow]))[0] : null;

        if (!person?.image && basePersonRow) {
          person = { ...basePersonRow, score: calcScore(basePersonRow) };
        }

        if (person) {
          // Use curated wrong answers if filled; otherwise auto-generate from pool
          let wrongThree;
          if (entry.wrong_answer_1 && entry.wrong_answer_2 && entry.wrong_answer_3) {
            wrongThree = [entry.wrong_answer_1, entry.wrong_answer_2, entry.wrong_answer_3];
          } else {
            const withCounts = customLocations.filter(loc => (locationCounts.get(loc.name) || 0) >= 5);
            const pool = withCounts.length >= 20 ? withCounts : customLocations.filter(loc => loc.id);
            const wrongPool = pool.filter(loc => loc.name !== entry.correct_answer);
            wrongThree = seededPick(wrongPool, 3, seed + 999).map(l => l.name);
          }
          const options = seededShuffle([entry.correct_answer, ...wrongThree], seed + 777);

          const data = {
            date: dateStr,
            person,
            correctAnswer: entry.correct_answer,
            options,
            answered: false,
            selectedAnswer: null,
            isCorrect: null,
          };

          try { localStorage.setItem(`bamakor-game-v1-${dateStr}`, JSON.stringify(data)); } catch {}
          setGameData(data);
          // Record the real shown date (fire-and-forget)
          supabaseClient.from('game_personalities').update({ last_shown_date: dateStr }).eq('id', entry.id);
          return;
        }
      }

      // ── Fallback: auto-select from locations pool ──────────────────────────
      const withCounts = customLocations.filter(loc => (locationCounts.get(loc.name) || 0) >= 5);
      const pool = withCounts.length >= 20 ? withCounts : customLocations.filter(loc => loc.id);
      const settlement = pool[seed % pool.length];

      const base = { ascending: false };
      const { data: rawPersons } = await supabaseClient
        .from('persons')
        .select('*')
        .or(`birth_place_raw.ilike.%${settlement.name}%,birth_place_by_wikidata.ilike.%${settlement.name}%`)
        .not('wikidata_id', 'is', null)
        .order('num_wiki_languages', base)
        .order('wikipage_wordcount', base)
        .limit(15);

      if (!rawPersons || rawPersons.length === 0) { setGameLoading(false); return; }

      const enriched = await enrichBatch(rawPersons.slice(0, 10));
      const withImage = enriched.filter(p => p.image);
      if (withImage.length === 0) { setGameLoading(false); return; }

      const person = withImage[seed % withImage.length];
      const wrongPool = pool.filter(loc => loc.name !== settlement.name);
      const wrongPicks = seededPick(wrongPool, 3, seed + 999);
      const options = seededShuffle([settlement.name, ...wrongPicks.map(l => l.name)], seed + 777);

      const data = {
        date: dateStr,
        person: { ...person },
        correctAnswer: settlement.name,
        options,
        answered: false,
        selectedAnswer: null,
        isCorrect: null,
      };

      try { localStorage.setItem(`bamakor-game-v1-${dateStr}`, JSON.stringify(data)); } catch {}
      setGameData(data);
    } catch (e) {
      console.error('Game load failed:', e);
    } finally {
      setGameLoading(false);
    }
  };

  const handleGameAnswer = (answer) => {
    if (!gameData || gameData.answered) return;
    const isCorrect = answer === gameData.correctAnswer;
    const updated = { ...gameData, answered: true, selectedAnswer: answer, isCorrect };
    const dateStr = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem(`bamakor-game-v1-${dateStr}`, JSON.stringify(updated)); } catch {}

    // Update streak
    const prev = readStreak();
    const active = getActiveStreak(prev, dateStr);
    const newStreak = isCorrect ? active + 1 : 0;
    const longestStreak = Math.max(prev.longestStreak || 0, newStreak);
    try { localStorage.setItem(STREAK_KEY, JSON.stringify({ streak: newStreak, longestStreak, lastDate: dateStr, lastCorrect: isCorrect })); } catch {}
    setCurrentStreak(newStreak);

    // Track to server (fire-and-forget)
    const uid = getOrCreateUid();
    if (uid && supabaseClient) {
      supabaseClient.rpc('record_game_result', {
        p_uid: uid,
        p_correct: isCorrect,
        p_new_streak: newStreak,
        p_longest_streak: longestStreak,
      });
    }

    setGameData({ ...updated, prevStreak: active });
  };


  const fetchPeople = async (settlement) => {
    if (!supabaseClient) return;
    setSheetExpanded(false);

    // ── Cache hit: show instantly, skip all network calls ────────────────────
    const cacheKey = `${settlement.id ?? settlement.name}::${highlightedPersonId ?? ''}`;
    const cached = peopleCache.current.get(cacheKey);
    if (cached) {
      setPeople(cached.people);
      setRemainingPeople(cached.remaining);
      setPreviewPerson(cached.previewPerson ?? null);
      return;
    }

    // ── Cache miss: fetch from Supabase ──────────────────────────────────────
    const myToken = ++fetchTokenRef.current;
    setIsLoading(true);

    try {
      const isDynamic = !settlement.id;
      const base = { ascending: false };
      let rawData, wikidataData;

      if (isDynamic) {
        // Dynamic location: use exact match on both columns in parallel
        [{ data: rawData }, { data: wikidataData }] = await Promise.all([
          supabaseClient.from('persons').select('*')
            .eq('birth_place_raw', settlement.name)
            .order('num_wiki_languages', base).order('wikipage_wordcount', base).limit(5000),
          supabaseClient.from('persons').select('*')
            .or('birth_place_raw.is.null,birth_place_raw.eq.no_bp_in_infobox')
            .eq('birth_place_by_wikidata', settlement.name)
            .order('num_wiki_languages', base).order('wikipage_wordcount', base).limit(5000),
        ]);
      } else {
        // Hardcoded location: ilike with word-boundary filtering, both queries in parallel
        const searchTerms = [settlement.name];
        if (settlement.name.includes('-')) searchTerms.push(settlement.name.split('-')[0]);
        if (settlement.name.startsWith('קריית ') || settlement.name.startsWith('קרית ')) {
          const stripped = settlement.name.replace(/^קרית\s|^קריית\s/, '');
          if (stripped.length >= 3) searchTerms.push(stripped);
        }

        const wordBoundary = (value, term) => {
          if (!value) return false;
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`(^|[\\s,])${escaped}([\\s,]|$)`).test(value);
        };

        const rawConditions = searchTerms.map(t => `birth_place_raw.ilike.%${t}%`).join(',');
        const wikidataConditions = searchTerms.map(t => `birth_place_by_wikidata.ilike.%${t}%`).join(',');

        [{ data: rawData }, { data: wikidataData }] = await Promise.all([
          supabaseClient.from('persons').select('*')
            .or(rawConditions)
            .order('num_wiki_languages', base).order('wikipage_wordcount', base).limit(5000),
          supabaseClient.from('persons').select('*')
            .or('birth_place_raw.is.null,birth_place_raw.eq.no_bp_in_infobox')
            .or(wikidataConditions)
            .order('num_wiki_languages', base).order('wikipage_wordcount', base).limit(5000),
        ]);

        const exclusions = BIRTH_PLACE_EXCLUSIONS[settlement.name] || [];
        const notExcluded = (value) => !exclusions.some(ex => (value || '').includes(ex));
        const moreSpecific = customLocations.filter(s =>
          s.id !== settlement.id &&
          s.name.includes(settlement.name) &&
          !s.name.startsWith(settlement.name + '-')
        );
        const notMoreSpecific = (value) => !moreSpecific.some(s => wordBoundary(value, s.name));

        rawData = (rawData || []).filter(p => searchTerms.some(t => wordBoundary(p.birth_place_raw, t)) && notExcluded(p.birth_place_raw) && notMoreSpecific(p.birth_place_raw));
        wikidataData = (wikidataData || []).filter(p => searchTerms.some(t => wordBoundary(p.birth_place_by_wikidata, t)) && notExcluded(p.birth_place_by_wikidata) && notMoreSpecific(p.birth_place_by_wikidata));
      }

      const seenIds = new Set((rawData || []).map(p => p.id));
      const dbData = [
        ...(rawData || []),
        ...(wikidataData || []).filter(p => !seenIds.has(p.id))
      ];

      if (!dbData || dbData.length === 0) {
        if (highlightedPersonId) {
          const { data: solo } = await supabaseClient
            .from('persons').select('*').eq('id', highlightedPersonId).limit(1);
          if (solo && solo.length > 0) {
            if (fetchTokenRef.current !== myToken) return;
            const enriched = await enrichBatch(solo);
            if (fetchTokenRef.current !== myToken) return;
            setPeople(enriched);
            setRemainingPeople([]);
            setPreviewPerson(null);
            setIsLoading(false);
            peopleCache.current.set(cacheKey, { people: enriched, remaining: [], previewPerson: null });
            return;
          }
        }
        if (fetchTokenRef.current !== myToken) return;
        setPeople([]);
        setRemainingPeople([]);
        setIsLoading(false);
        return;
      }

      const workingList = [...dbData].sort((a, b) => calcScore(b) - calcScore(a));
      const firstBatch = workingList.slice(0, BATCH_SIZE);
      const rest = workingList.slice(BATCH_SIZE);

      // ── Show DB-only cards immediately (no images/descriptions yet) ─────
      if (fetchTokenRef.current !== myToken) return;
      setPeople(firstBatch.map(p => ({ ...p, score: calcScore(p) })));
      setRemainingPeople(rest);
      setPreviewPerson(null);
      setIsLoading(false);

      // ── Enrich with Wikidata in the background ───────────────────────────
      const enriched = await enrichBatch(firstBatch);
      if (fetchTokenRef.current !== myToken) return;
      enriched.sort((a, b) => (b.score || 0) - (a.score || 0));

      const highlightedIdx = highlightedPersonId
        ? workingList.findIndex(p => p.id === highlightedPersonId)
        : -1;

      let previewPerson = null;
      if (highlightedIdx >= BATCH_SIZE) {
        try {
          const [enrichedPreview] = await enrichBatch([workingList[highlightedIdx]]);
          if (fetchTokenRef.current !== myToken) return;
          previewPerson = { ...enrichedPreview, trueRank: highlightedIdx + 1 };
        } catch {
          previewPerson = { ...workingList[highlightedIdx], score: calcScore(workingList[highlightedIdx]), trueRank: highlightedIdx + 1 };
        }
      }

      if (fetchTokenRef.current !== myToken) return;
      setPeople(enriched);
      setPreviewPerson(previewPerson);
      peopleCache.current.set(cacheKey, { people: enriched, remaining: rest, previewPerson });

    } catch (e) {
      console.error("fetchPeople failed:", e);
      if (fetchTokenRef.current === myToken) setIsLoading(false);
    }
  };


  useEffect(() => {
    if (selectedSettlement) fetchPeople(selectedSettlement);
  }, [selectedSettlement, highlightedPersonId]);


  // PWA: register service worker + capture beforeinstallprompt (Android)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);


  // Track game open
  useEffect(() => {
    if (!showGameModal || !supabaseClient) return;
    const uid = getOrCreateUid();
    if (uid) supabaseClient.rpc('record_game_open', { p_uid: uid });
  }, [showGameModal]);

  // Background: count persons per settlement for zoom-based marker filtering (mobile)
  useEffect(() => {
    if (!supabaseClient) return;
    const fetchCounts = async () => {
      try {
        const { data } = await supabaseClient
          .from('persons')
          .select('birth_place_raw, birth_place_by_wikidata');
        if (!data) return;
        const locNames = customLocations.map(loc => loc.name);
        const counts = new Map();
        data.forEach(p => {
          const place = (p.birth_place_raw && p.birth_place_raw !== 'no_bp_in_infobox')
            ? p.birth_place_raw
            : (p.birth_place_by_wikidata || null);
          if (!place) return;
          for (const name of locNames) {
            if (place === name || place.startsWith(name + ',') || place.startsWith(name + ' ,') || place.endsWith(', ' + name)) {
              counts.set(name, (counts.get(name) || 0) + 1);
              break;
            }
          }
        });
        setLocationCounts(counts);
      } catch {
        // silent fail — all markers remain visible as fallback
      }
    };
    fetchCounts();
  }, [supabaseClient]);


  useEffect(() => {
    if (!isLoading && highlightedPersonId && personRefs.current[highlightedPersonId]) {
      setTimeout(() => {
        personRefs.current[highlightedPersonId].scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 500);
    }
  }, [isLoading, highlightedPersonId, people]);


  const closeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

  const openOnboarding = () => {
    setOnboardingStep(0);
    setShowOnboarding(true);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!contactMessage.trim()) return;
    setContactStatus('sending');
    try {
      const res = await fetch(`https://formspree.io/f/${process.env.REACT_APP_FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ ...(contactEmail ? { email: contactEmail } : {}), message: contactMessage }),
      });
      if (res.ok) {
        setContactStatus('success');
        setTimeout(() => {
          setShowContactModal(false);
          setContactStatus(null);
          setContactMessage('');
          setContactEmail('');
        }, 2500);
      } else {
        setContactStatus('error');
      }
    } catch {
      setContactStatus('error');
    }
  };

  const loadMore = async () => {
    if (isLoadingMore || remainingPeople.length === 0) return;
    setIsLoadingMore(true);
    try {
      const nextBatch = remainingPeople.slice(0, BATCH_SIZE);
      const rest = remainingPeople.slice(BATCH_SIZE);
      const enriched = await enrichBatch(nextBatch);
      enriched.sort((a, b) => (b.score || 0) - (a.score || 0));
      setPeople(prev => [...prev, ...enriched]);
      setRemainingPeople(rest);
      // If the preview person's batch just loaded, they're now in the main list
      if (previewPerson && enriched.some(p => p.id === previewPerson.id)) {
        setPreviewPerson(null);
      }
    } catch (e) {
      console.error("loadMore failed:", e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Fly to Tel Aviv and show ripple on slide 3; clean up when leaving
  useEffect(() => {
    if (!leafletMapRef.current || !window.L) return;
    const L = window.L;
    onboardingMarkersRef.current.forEach(m => m.remove());
    onboardingMarkersRef.current = [];

    if (showOnboarding && onboardingStep === 2) {
      const telAviv = customLocations.find(s => s.name.includes('תל אביב'));
      if (telAviv) {
        leafletMapRef.current.flyTo([telAviv.lat, telAviv.lng], 12, { duration: 1.5 });
        const rippleIcon = L.divIcon({ className: 'ripple-wrapper', html: '<div class="ripple-effect"></div>', iconSize: [40, 40], iconAnchor: [20, 20] });
        onboardingMarkersRef.current.push(
          L.marker([telAviv.lat, telAviv.lng], { icon: rippleIcon, interactive: false }).addTo(leafletMapRef.current)
        );
        onboardingMarkersRef.current.push(
          L.circleMarker([telAviv.lat, telAviv.lng], {
            radius: 9, fillColor: '#4f46e5', color: '#fff', weight: 2, fillOpacity: 0.9, interactive: false, zIndexOffset: 1000
          }).addTo(leafletMapRef.current)
        );
      }
    } else if (!showOnboarding && !selectedSettlement) {
      leafletMapRef.current.setView([31.5, 35.0], window.innerWidth >= 640 ? 8 : 7);
    }
  }, [showOnboarding, onboardingStep]);

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden" dir="rtl">

      {/* ── Onboarding ────────────────────────────────────────────────────── */}
      {showOnboarding && (() => {
        const navButtons = (
          <div className="flex justify-between items-center mt-4">
            {onboardingStep > 0 ? (
              <button onClick={() => setOnboardingStep(s => s - 1)} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">→ הקודם</button>
            ) : null}
            {onboardingStep < ONBOARDING_SLIDES.length - 1 ? (
              <button onClick={() => setOnboardingStep(s => s + 1)} className="bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-indigo-700 transition-all">הבא ←</button>
            ) : (
              <button onClick={closeOnboarding} className="bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-indigo-700 transition-all">יאללה נתחיל !</button>
            )}
          </div>
        );

        const dots = (
          <div className="flex justify-center gap-2">
            {ONBOARDING_SLIDES.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === onboardingStep ? 'w-6 bg-indigo-600' : 'w-2 bg-slate-200'}`} />
            ))}
          </div>
        );

        const cardContent = (
          <>
            <button onClick={closeOnboarding} className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-all">✕</button>
            {dots}
            <div className="flex flex-col gap-2 mt-1">
              <h2 className="text-lg font-black text-slate-800 leading-snug">{ONBOARDING_SLIDES[onboardingStep].title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{ONBOARDING_SLIDES[onboardingStep].body}</p>
            </div>
            {navButtons}
          </>
        );

        // Slide 1 — centered with dark overlay
        if (onboardingStep === 0) return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4" onClick={closeOnboarding}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-4 relative" onClick={e => e.stopPropagation()}>
              {cardContent}
            </div>
          </div>
        );

        // Slide 2 — anchored below search bar (centered on desktop, left on mobile)
        if (onboardingStep === 1) return (
          <div className="fixed z-50 top-[62px] sm:top-[72px] left-2 sm:left-1/2 sm:-translate-x-1/2 w-[calc(100%-1rem)] sm:w-96 bg-white rounded-2xl shadow-2xl border-2 border-indigo-300 p-5 flex flex-col gap-3">
            {/* Caret pointing up toward search bar */}
            <div className="absolute -top-[9px] left-8 sm:left-1/2 sm:-translate-x-1/2 w-4 h-4 bg-white border-r-2 border-t-2 border-indigo-300 rotate-[-45deg]" />
            {cardContent}
          </div>
        );

        // Slide 3 — left side of map (over Mediterranean), no overlay
        if (onboardingStep === 2) return (
          <div className="fixed z-50 left-3 sm:left-6 top-1/2 -translate-y-1/2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border-2 border-indigo-300 p-5 flex flex-col gap-3">
            {cardContent}
          </div>
        );
      })()}

      <header className="bg-white border-b border-slate-200 px-3 py-2 sm:px-6 sm:py-4 z-30 shadow-sm flex flex-wrap justify-between items-center gap-2 sm:grid sm:grid-cols-[auto_1fr_auto] sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => {
              setSelectedSettlement(null);
              setIsSidebarOpen(false);
              setSearchQuery('');
              setSuggestions([]);
              setPreviewPerson(null);
              if (leafletMapRef.current) leafletMapRef.current.setView([31.5, 35.0], window.innerWidth >= 640 ? 8 : 7);
            }}
            className="bg-indigo-600 text-white p-1.5 sm:p-2 rounded-lg font-black text-xs sm:text-sm hover:bg-indigo-700 transition-colors cursor-pointer"
          >{PROJECT_NAME}</button>
          <div className="hidden sm:flex flex-col">
            <h1 className="text-base sm:text-xl font-bold text-slate-800 leading-none">מפת האישים</h1>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">
              {customLocations.length} יישובים
            </span>
          </div>
        </div>

        <div className="flex-1 max-w-md sm:max-w-none sm:flex sm:justify-center relative">
          <div className="w-full sm:w-[420px]">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="חפש יישוב או אדם..."
              className={`w-full bg-slate-100 border-2 rounded-full py-2 px-10 text-[16px] sm:text-sm transition-all outline-none text-right ${searchError ? 'border-red-500 shake' : (showOnboarding && onboardingStep === 1) ? 'border-indigo-400 ring-4 ring-indigo-200 bg-white shadow-inner animate-pulse' : 'border-transparent focus:ring-2 focus:ring-indigo-500 bg-white shadow-inner'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="absolute left-4 top-2.5 text-slate-400 hover:text-indigo-500 transition-colors bg-transparent border-none p-0 cursor-pointer flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>

            {suggestions.length > 0 && (
              <div className="absolute top-full right-0 left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50">
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-none"
                    onClick={() => {
                      setSearchQuery(item.name);
                      setSuggestions([]);
                      if (item.type === 'settlement') {
                        handleSettlementSelection(item);
                        setSearchQuery('');
                      } else {
                        handleSearchSubmit(null, item);
                      }
                    }}
                  >
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                    <span className="text-xs text-slate-400">{item.type === 'settlement' ? '📍 יישוב' : '👤 אדם'}</span>
                  </div>
                ))}
              </div>
            )}

            {searchError && (
              <div className={`absolute top-full right-4 mt-2 px-3 py-1.5 border font-bold rounded-lg shadow-sm animate-pulse z-50 whitespace-nowrap text-xs ${
                searchError.includes('קיים במאגר')
                  ? 'bg-orange-50 border-orange-200 text-orange-600'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}>
                {searchError}
              </div>
            )}
          </form>
          </div>
        </div>

        {/* Desktop toolbar — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button onClick={openOnboarding} title="מה זה במקור.פרוג׳קט?" className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all text-sm font-black">?</button>
          <div className="relative">
            <button
              onClick={() => setShowShareMenu(v => !v)}
              title="שתף"
              className={`w-9 h-9 flex items-center justify-center rounded-full border transition-all ${showShareMenu ? 'border-indigo-400 text-indigo-500 bg-indigo-50' : 'border-slate-200 text-slate-500 hover:text-indigo-500 hover:border-indigo-300'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            {showShareMenu && (
              <>
                {/* Backdrop to close on outside click */}
                <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                <div className="absolute top-11 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-2">
                  {/* Copy link */}
                  <button
                    onClick={() => { navigator.clipboard.writeText(window.location.href); setShareCopied(true); setTimeout(() => { setShareCopied(false); setShowShareMenu(false); }, 1500); }}
                    title="העתק קישור"
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all"
                  >
                    {shareCopied
                      ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-green-500"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    }
                  </button>
                  {/* WhatsApp */}
                  <button
                    onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(window.location.href)}`, '_blank'); setShowShareMenu(false); }}
                    title="שתף ב-WhatsApp"
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-green-500 hover:border-green-300 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.118 1.524 5.847L.057 23.428a.75.75 0 0 0 .921.921l5.562-1.461A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.5-5.24-1.375l-.374-.217-3.873 1.017 1.034-3.78-.235-.386A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  </button>
                  {/* Twitter/X */}
                  <button
                    onClick={() => { window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('במקור.פרוג׳קט - מפת האישים של ישראל')}`, '_blank'); setShowShareMenu(false); }}
                    title="שתף ב-X"
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </button>
                  {/* Facebook */}
                  <button
                    onClick={() => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank'); setShowShareMenu(false); }}
                    title="שתף בפייסבוק"
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </button>
                  {/* Email */}
                  <button
                    onClick={() => { window.open(`mailto:?subject=${encodeURIComponent('במקור.פרוג׳קט - מפת האישים של ישראל')}&body=${encodeURIComponent(window.location.href)}`, '_self'); setShowShareMenu(false); }}
                    title="שתף במייל"
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
                  </button>
                </div>
              </>
            )}
          </div>
          <button onClick={() => { setBookmarkDone(false); setShowBookmarkModal(true); }} title="שמור" className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button onClick={() => { const d = new Date().toISOString().slice(0,10); setCurrentStreak(getActiveStreak(readStreak(), d)); setShowGameModal(true); setGameData(null); loadDailyGame(); }} title="משחקים" className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>
          </button>
          <button onClick={() => setShowContactModal(true)} title="כתבו לנו" className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </div>
      </header>

      <div className="flex-1 relative flex">
        <div ref={mapRef} className="flex-1 z-0" />

        <aside className={`fixed bottom-0 left-0 right-0 z-20 bg-white shadow-2xl transition-all duration-500 rounded-t-2xl border-t border-slate-200 sm:absolute sm:right-0 sm:top-0 sm:bottom-0 sm:left-auto sm:w-80 md:w-96 sm:rounded-none sm:border-t-0 sm:border-l sm:h-auto ${isSidebarOpen ? 'translate-y-0 sm:translate-x-0 sm:translate-y-0' : 'translate-y-full sm:translate-x-full sm:translate-y-0'} ${sheetExpanded ? 'h-[85vh]' : 'h-[270px]'}`}>
          <div className="h-full flex flex-col">

            {/* Mobile: floating expand/collapse button, centred on sheet's top edge */}
            <button
              onClick={() => setSheetExpanded(v => !v)}
              className="sm:hidden absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center z-10 focus:outline-none"
              aria-label={sheetExpanded ? 'כווץ' : 'הרחב'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-slate-500">
                {sheetExpanded ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
              </svg>
            </button>

            {/* Mobile: indigo header — name + description in one block, same as desktop */}
            <div className="sm:hidden shrink-0 bg-indigo-700 text-white shadow-lg pt-5 px-4 pb-3 relative">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-lg font-bold leading-tight truncate pl-8">{selectedSettlement?.name}</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="absolute top-3 left-3 hover:bg-white/20 w-10 h-10 flex items-center justify-center rounded-full leading-none transition-all">✕</button>
              </div>
              <div className="text-[11px] opacity-90 leading-relaxed bg-white/10 p-2 rounded-lg border border-white/10 italic">
                {settlementSummary || 'טוען נתונים...'}
              </div>
            </div>

            {/* Desktop: full indigo header */}
            <div className="hidden sm:flex flex-col p-5 border-b border-slate-100 justify-center bg-indigo-700 text-white shadow-lg shrink-0 relative">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-bold leading-tight truncate pl-8">{selectedSettlement?.name}</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="absolute top-3 left-3 hover:bg-white/20 w-11 h-11 flex items-center justify-center rounded-full leading-none transition-all text-lg">✕</button>
              </div>
              <div className="text-[11px] opacity-90 leading-relaxed bg-white/10 p-2 rounded-lg border border-white/10 italic">
                {settlementSummary || 'טוען נתונים...'}
              </div>
            </div>

            <div className={`flex-1 p-4 custom-scrollbar bg-slate-100 overscroll-contain ${sheetExpanded ? 'overflow-y-auto' : 'overflow-hidden'} sm:overflow-y-auto`}>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-bold animate-pulse">טוען אישים...</p>
                </div>
              ) : people.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    const rankMap = {};
                    [...people].sort((a, b) => (b.score || 0) - (a.score || 0)).forEach((p, i) => { rankMap[p.id] = i + 1; });
                    const renderCard = (p, rank, highlighted) => (
                      <div
                        key={p.id}
                        ref={el => personRefs.current[p.id] = el}
                        className={`p-3 rounded-2xl transition-all cursor-pointer group flex items-center gap-4 border relative ${highlighted ? 'bg-indigo-50 border-indigo-400 ring-4 ring-indigo-100 spotlight-pulse' : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md'}`}
                        onClick={() => p.wiki_url && window.open(p.wiki_url, '_blank')}
                      >
                        {p.birthYear && (
                          <div className="absolute top-2 left-2 z-10 text-purple-500 text-[10px] font-bold pointer-events-none">
                            שנת לידה: {p.birthYear}
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md shadow-sm z-10 bg-gradient-to-r from-amber-500 to-amber-400 text-white text-[9px] font-black tracking-wide border border-white/20 pointer-events-none" title="ציון פופולריות מבוסס ויקיפדיה">
                          {p.score || 0}
                        </div>
                        <div className="relative shrink-0">
                          {p.image ? (
                            <img src={`${p.image}?width=150`} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" alt={p.full_name} />
                          ) : (
                            <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl bg-slate-200 text-slate-400">{p.full_name?.[0]}</div>
                          )}
                          <div className="absolute -bottom-1 -right-1 bg-slate-500 text-white text-[9px] px-1.5 py-0.5 rounded-lg border-2 border-white font-black shadow-sm pointer-events-none" title="דירוג לפי מדד עוצמה">
                            #{rank}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 pl-2">
                          <h3 className={`font-bold text-sm leading-tight transition-colors ${highlighted ? 'text-indigo-900 text-base' : 'text-slate-800'}`}>
                            {p.full_name}
                          </h3>
                          {p.description && (
                            <p className={`text-[11px] line-clamp-2 mt-1 leading-snug ${highlighted ? 'text-indigo-600' : 'text-slate-500'}`}>
                              {p.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                    return [
                      ...people.map(p => renderCard(p, rankMap[p.id], p.id === highlightedPersonId)),
                      previewPerson && (
                        <div key="preview-divider" className="text-[10px] text-slate-400 text-center py-1 tracking-wide">· · ·</div>
                      ),
                      previewPerson && renderCard(previewPerson, previewPerson.trueRank, true),
                    ];
                  })()}

                  {remainingPeople.length > 0 && (
                    <button
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="w-full mt-1 py-3 rounded-2xl font-bold text-sm text-indigo-600 border-2 border-indigo-200 bg-white hover:bg-indigo-50 hover:border-indigo-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isLoadingMore ? (
                        <>
                          <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          טוען...
                        </>
                      ) : (
                        `טען עוד ${Math.min(remainingPeople.length, BATCH_SIZE)} אישים`
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center opacity-60">
                  <div className="bg-slate-200 p-6 rounded-full mb-4">
                    <span className="text-4xl">📭</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 mb-2">אין תוצאות במאגר</h3>
                  <p className="text-sm text-slate-500 max-w-[200px]">
                    לא נמצאו אישים המשויכים ליישוב זה בבסיס הנתונים שלנו.
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Zoom controls — desktop only ────────────────────────────── */}
      <div className={`flex-col fixed bottom-4 right-4 z-40 rounded-xl overflow-hidden shadow-lg border border-slate-200 ${isSidebarOpen ? 'hidden' : 'hidden sm:flex'}`} role="group" aria-label="פקדי זום">
        <button
          onClick={() => leafletMapRef.current?.zoomIn()}
          disabled={mapZoom >= 18}
          aria-label="התקרב"
          title="התקרב"
          className="w-9 h-9 flex items-center justify-center bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-lg font-light disabled:opacity-30 disabled:cursor-not-allowed border-b border-slate-200"
        >+</button>
        <button
          onClick={() => leafletMapRef.current?.zoomOut()}
          disabled={mapZoom <= 3}
          aria-label="התרחק"
          title="התרחק"
          className="w-9 h-9 flex items-center justify-center bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-lg font-light disabled:opacity-30 disabled:cursor-not-allowed"
        >−</button>
      </div>

      {/* ── Bookmark modal — desktop only ───────────────────────────── */}
      {showBookmarkModal && (
        <div className="fixed inset-0 z-50 hidden sm:flex items-center justify-center bg-slate-900/60 px-4" onClick={() => setShowBookmarkModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-800">שמירת סימניה</h2>
              <button onClick={() => setShowBookmarkModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
            </div>
            {bookmarkDone ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="text-3xl">🔖</div>
                <p className="text-sm text-slate-700 text-center leading-relaxed">
                  לחצו על{' '}
                  <kbd className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono">
                    {/Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘ Cmd+D' : 'Ctrl+D'}
                  </kbd>
                  {' '}כדי לשמור את האתר כסימניה בדפדפן שלכם.
                </p>
                <button onClick={() => setShowBookmarkModal(false)} className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all">
                  סגור
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500 leading-relaxed">
                  לחיצה על "המשך" תציג לכם הוראות קצרות לשמירת האתר כסימניה בדפדפן שלכם.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setShowBookmarkModal(false)} className="flex-1 py-2 rounded-xl font-bold text-sm border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all">
                    ביטול
                  </button>
                  <button onClick={() => setBookmarkDone(true)} className="flex-1 py-2 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-all">
                    המשך
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Daily game modal ─────────────────────────────────────────── */}
      {showGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={() => setShowGameModal(false)}>
          <div className="bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()} dir="rtl">

            {/* Header */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-700 shrink-0">
              <h2 className="text-white font-black text-base tracking-wide">🎯 שאלון יומי</h2>
              <button onClick={() => setShowGameModal(false)} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">✕</button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 flex flex-col">
              {gameLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400 text-sm">טוען שאלון...</p>
                </div>
              ) : gameData ? (
                <>
                  {/* ── Person display ── */}
                  <div className="flex flex-col items-center px-5 pt-6 pb-4 gap-2">
                    <div className="w-44 h-44 rounded-full overflow-hidden border-4 border-indigo-500 shadow-2xl shadow-indigo-900/60 shrink-0">
                      <img src={`${gameData.person.image}?width=350`} alt={gameData.person.full_name} className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-white font-black text-xl mt-2 text-center">{gameData.person.full_name}</h3>
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {gameData.person.birthYear && (
                        <span className="text-purple-400 text-sm font-bold">שנת לידה: {gameData.person.birthYear}</span>
                      )}
                      <span className="bg-gradient-to-r from-amber-500 to-amber-400 text-white text-xs font-black px-2 py-0.5 rounded-md shadow">
                        {gameData.person.score || 0}
                      </span>
                    </div>
                    {gameData.person.description && (
                      <p className="text-slate-400 text-xs text-center leading-relaxed italic px-2">
                        {gameData.person.description}
                      </p>
                    )}
                  </div>

                  {/* ── Active streak badge ── */}
                  {currentStreak > 0 && !gameData.answered && (
                    <div className="mx-5 mb-3 bg-amber-900/30 border border-amber-700/50 rounded-xl px-3 py-1.5 text-center">
                      <span className="text-amber-300 text-xs font-bold">רצף: {currentStreak} {currentStreak === 1 ? 'יום' : 'ימים'} רצופים</span>
                    </div>
                  )}

                  {/* ── Question ── */}
                  <div className="px-5 pb-4 text-center">
                    <p className="text-white font-bold text-sm leading-snug">
                      מהו יישוב הלידה של {gameData.person.full_name}?
                    </p>
                  </div>

                  {/* ── Answer grid (WWTBAM style) ── */}
                  <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                    {gameData.options.map((opt, i) => {
                      const letters = ['א', 'ב', 'ג', 'ד'];
                      let cls = 'bg-indigo-700 border border-indigo-500 hover:bg-indigo-600 text-white cursor-pointer';
                      if (gameData.answered) {
                        if (opt === gameData.correctAnswer) cls = 'bg-green-600 border border-green-500 text-white cursor-default';
                        else if (opt === gameData.selectedAnswer) cls = 'bg-red-600 border border-red-500 text-white cursor-default';
                        else cls = 'bg-slate-700 border border-slate-600 text-slate-500 cursor-default';
                      }
                      return (
                        <button
                          key={opt}
                          onClick={() => handleGameAnswer(opt)}
                          disabled={gameData.answered}
                          className={`${cls} rounded-xl px-3 py-3 text-sm font-bold transition-all flex items-center gap-2`}
                        >
                          <span className="shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-black">{letters[i]}</span>
                          <span className="flex-1 text-right leading-tight">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Result ── */}
                  {gameData.answered && (
                    <div className={`mx-4 mb-5 p-4 rounded-xl text-center border ${gameData.isCorrect ? 'bg-green-900/40 border-green-700' : 'bg-red-900/40 border-red-700'}`}>
                      <p className="text-white font-bold text-sm">
                        {gameData.isCorrect ? '🎉 כל הכבוד! ענית נכון' : `😔 לא הפעם... התשובה: ${gameData.correctAnswer}`}
                      </p>
                      {gameData.isCorrect && currentStreak >= 1 && (
                        <p className="text-amber-300 font-black text-base mt-1">
                          {currentStreak === 1 ? 'יום ראשון! חזרו מחר להמשיך את הרצף' : `${currentStreak} ימים רצופים!`}
                        </p>
                      )}
                      {!gameData.isCorrect && (gameData.prevStreak || 0) > 0 && (
                        <p className="text-slate-400 text-xs mt-1">הרצף של {gameData.prevStreak} ימים נשבר</p>
                      )}
                      <p className="text-slate-400 text-xs mt-1 mb-3">חזרו מחר לשאלה הבאה</p>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `🎯 שאלון יומי | במקור.פרוג׳קט\n` +
                          (gameData.isCorrect ? `ניחשתי נכון! 🎉` : `לא ניחשתי הפעם 😔`) +
                          `\nהאם אתם יודעים באיזה יישוב נולד/ה ${gameData.person.full_name}?\nשחקו גם אתם: https://bamakor-proj.vercel.app`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-bold px-4 py-2 rounded-xl transition-all"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        שתפו עם חברים
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <p className="text-slate-400 text-sm">לא ניתן לטעון את השאלון כרגע</p>
                  <button onClick={loadDailyGame} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all">
                    נסה שוב
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PWA install modal — mobile only (iOS instructions) ─────── */}
      {showPwaModal && (
        <div className="fixed inset-0 z-50 sm:hidden flex items-end justify-center bg-slate-900/60 px-4 pb-6" onClick={() => setShowPwaModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-800">הוסף למסך הבית</h2>
              <button onClick={() => setShowPwaModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              כדי להוסיף את האפליקציה למסך הבית שלכם:
            </p>
            <ol className="flex flex-col gap-3 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">1</span>
                <span>לחצו על כפתור <strong>השיתוף</strong> בתחתית הדפדפן
                  <span className="inline-block mr-1 text-base">⬆️</span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">2</span>
                <span>גללו מטה ובחרו <strong>"הוסף למסך הבית"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">3</span>
                <span>לחצו <strong>"הוסף"</strong> לאישור</span>
              </li>
            </ol>
            <button onClick={() => setShowPwaModal(false)} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all">
              הבנתי
            </button>
          </div>
        </div>
      )}

      {/* ── Contact modal ────────────────────────────────────────────── */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4" onClick={() => setShowContactModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()} dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-start gap-2">
              <div>
                <h2 className="text-xl font-black text-slate-800">כתבו לנו</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">נפלה טעות? חסרה אישיות? תרצו לשתף איתנו משהו? כתבו לנו ממש כאן</p>
              </div>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none shrink-0">✕</button>
            </div>

            {contactStatus === 'success' ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-slate-700 font-bold">תודה! ההודעה נשלחה בהצלחה.</p>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
                <div className="relative">
                  <textarea
                    value={contactMessage}
                    onChange={e => setContactMessage(e.target.value.slice(0, 150))}
                    placeholder="ההודעה שלכם..."
                    rows={5}
                    maxLength={150}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  />
                  <span className="absolute bottom-2 left-2 text-[10px] text-slate-400">{contactMessage.length}/150</span>
                </div>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="כתובת מייל לתגובה (אופציונלי)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
                {contactStatus === 'error' && (
                  <p className="text-xs text-red-500 text-center">שגיאה בשליחה, נסו שוב.</p>
                )}
                <button
                  type="submit"
                  disabled={!contactMessage.trim() || contactStatus === 'sending'}
                  className="bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {contactStatus === 'sending' ? 'שולח...' : 'שלח'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom toolbar — mobile only ─────────────────────────────── */}
      <div className={`sm:hidden fixed bottom-4 left-4 z-40 items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 shadow-lg rounded-2xl px-3 py-2 transition-all duration-300 ${isSidebarOpen ? 'hidden' : 'flex'}`}>
        <button
          onClick={openOnboarding}
          title="מה זה במקור.פרוג׳קט?"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all text-sm font-black"
        >?</button>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: 'במקור.פרוג׳קט - מפת האישים של ישראל',
                text: 'גלה אישים מפורסמים לפי עיר הולדתם',
                url: window.location.href,
              }).catch(() => {});
            }
          }}
          title="שתף"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
        <button
          onClick={() => {
            if (installPrompt) {
              installPrompt.prompt();
              installPrompt.userChoice.then(() => setInstallPrompt(null));
            } else {
              setShowPwaModal(true);
            }
          }}
          title="שמור"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button
          onClick={() => { const d = new Date().toISOString().slice(0,10); setCurrentStreak(getActiveStreak(readStreak(), d)); setShowGameModal(true); setGameData(null); loadDailyGame(); }}
          title="משחקים"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none"/>
            <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none"/>
            <circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none"/>
            <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        <button
          onClick={() => setShowContactModal(true)}
          title="כתבו לנו"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>
      </div>

      <style>{`
        .custom-tooltip { background: #1e293b; color: white; border-radius: 4px; padding: 2px 8px; font-weight: bold; border: none; }
        @keyframes spotlightPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
        .spotlight-pulse { animation: spotlightPulse 1.5s infinite ease-in-out; }
        .custom-scrollbar { scrollbar-width: thin; -webkit-overflow-scrolling: touch; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 0, 0); } 40%, 60% { transform: translate3d(4px, 0, 0); } }
        .ripple-wrapper { display: flex; justify-content: center; align-items: center; }
        .ripple-effect {
          width: 14px; height: 14px;
          background-color: rgba(79, 70, 229, 0.4);
          border: 2px solid #4f46e5;
          border-radius: 50%;
          animation: ripple 2s infinite ease-out;
          pointer-events: none;
        }
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(4); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default App;
