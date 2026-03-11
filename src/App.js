import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { customLocations } from './locations';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const PROJECT_NAME = "במקור.פרוג׳קט";

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchError, setSearchError] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [settlementSummary, setSettlementSummary] = useState('');
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [highlightedPersonId, setHighlightedPersonId] = useState(null);
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);
  const personRefs = useRef({});

  // Initialize Supabase client once using the installed npm package (no CDN needed)
  const supabaseClient = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }, []);


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
        const map = L.map(mapRef.current, { zoomControl: false, scrollWheelZoom: true }).setView([31.7, 35.0], 9);
        leafletMapRef.current = map;

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

      const marker = L.circleMarker([s.lat, s.lng], {
        radius: isSelected ? 9 : 7,
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

      marker.bindTooltip(s.name, {
        direction: 'auto',
        sticky: true,
        className: 'custom-tooltip',
        opacity: 1
      });

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
      const query = searchQuery.trim();
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
    const query = forcedItem ? forcedItem.name : searchQuery.trim();
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

        const birthCity = customLocations.find(s =>
          person.birth_place_raw?.includes(s.name) || person.birth_place_by_wikidata?.includes(s.name)
        );

        if (birthCity) {
          handleSettlementSelection(birthCity);
          setSearchQuery('');
          return;
        } else if (person.wikidata_id) {
          const coords = await findLocationByWikidataId(person.wikidata_id);
          if (coords && leafletMapRef.current) {
            leafletMapRef.current.flyTo([coords.lat, coords.lng], 13);
            const birthLabel = person.birth_place_raw || person.birth_place_by_wikidata || "מיקום לידה";
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


  const fetchPeople = async (settlement) => {
    if (!supabaseClient) return;
    setIsLoading(true);

    try {
      const searchTerms = [settlement.name];

      if (settlement.name.includes('-')) {
        searchTerms.push(settlement.name.split('-')[0]);
      }

      if (settlement.name.startsWith('קריית ') || settlement.name.startsWith('קרית ')) {
        const baseName = settlement.name.replace(/^קרית\s|^קריית\s/, '');
        searchTerms.push(baseName);
      }

      const orConditions = searchTerms.flatMap(term => [
        `birth_place_raw.ilike.%${term}%`,
        `and(birth_place_raw.is.null,birth_place_by_wikidata.ilike.%${term}%)`
      ]).join(',');

      const { data: dbData } = await supabaseClient
        .from('persons')
        .select('*')
        .or(orConditions);

      if (!dbData || dbData.length === 0) {
        setPeople([]);
        setIsLoading(false);
        return;
      }

      const calcScore = p => Math.round(((p.num_wiki_languages || 0) * 0.3) + (((p.wikipage_wordcount || 0) / 100) * 0.7));

      let workingList = [...dbData].sort((a, b) => {
        if (a.id === highlightedPersonId) return -1;
        if (b.id === highlightedPersonId) return 1;
        return calcScore(b) - calcScore(a);
      });

      const top50 = workingList.slice(0, 50);
      const others = workingList.slice(50);

      const qids = top50.map(p => p.wikidata_id).filter(id => id?.startsWith('Q'));
      let enrichedTop50 = top50;

      if (qids.length > 0) {
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

        const wikiRes = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`);
        const wikiData = await wikiRes.json();

        const wikiMap = {};
        wikiData.results.bindings.forEach(row => {
          wikiMap[row.item.value.split('/').pop()] = {
            popularity: parseInt(row.sitelinks.value),
            image: row.image ? row.image.value : null,
            description: row.itemDescription ? row.itemDescription.value : null,
            birthYear: row.birthYear ? row.birthYear.value : null,
            coord: row.coord ? row.coord.value : null
          };
        });

        // Enrichment + geographic filtering
        enrichedTop50 = top50.map(p => {
          const score = calcScore(p);
          return {
            ...p,
            ...wikiMap[p.wikidata_id],
            score
          };
        }).filter(p => {
          if (p.coord) {
            const match = p.coord.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
            if (match) {
              const lng = parseFloat(match[1]);
              const lat = parseFloat(match[2]);
              const isInsideIsrael = (lat >= 29.5 && lat <= 33.5) && (lng >= 34.2 && lng <= 35.9);
              if (!isInsideIsrael) return false;
            }
          }
          return true;
        }).sort((a, b) => {
          if (a.id === highlightedPersonId) return -1;
          if (b.id === highlightedPersonId) return 1;
          return (b.score || 0) - (a.score || 0);
        });
      }

      setPeople([...enrichedTop50, ...others]);
    } catch (e) {
      console.error("fetchPeople failed:", e);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    if (selectedSettlement) fetchPeople(selectedSettlement);
  }, [selectedSettlement]);


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


  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden" dir="rtl">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap justify-between items-center z-30 shadow-sm gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-indigo-600 text-white p-2 rounded-lg font-black text-sm">{PROJECT_NAME}</div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-slate-800 leading-none">מפת האישים</h1>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
              {customLocations.length} יישובים
            </span>
          </div>
        </div>

        <div className="flex-1 max-w-md relative">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="חפש יישוב או אדם..."
              className={`w-full bg-slate-100 border-2 rounded-full py-2 px-10 text-sm transition-all outline-none text-right ${searchError ? 'border-red-500 shake' : 'border-transparent focus:ring-2 focus:ring-indigo-500 bg-white shadow-inner'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="absolute left-4 top-2.5 text-slate-400">🔍</span>

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
      </header>

      <div className="flex-1 relative flex">
        <div ref={mapRef} className="flex-1 z-0" />

        <aside className={`absolute right-0 top-0 bottom-0 w-80 md:w-96 bg-white shadow-2xl z-20 transition-all duration-500 border-l border-slate-200 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="h-full flex flex-col">
            <div className="p-5 border-b border-slate-100 flex flex-col justify-center bg-indigo-700 text-white shadow-lg shrink-0 relative">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-bold leading-tight truncate pl-8">{selectedSettlement?.name}</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 left-4 hover:bg-white/20 p-2 rounded-full leading-none transition-all">✕</button>
              </div>
              <div className="text-[11px] opacity-90 leading-relaxed bg-white/10 p-2 rounded-lg border border-white/10 italic">
                {settlementSummary || 'טוען נתונים...'}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-100">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-bold animate-pulse">טוען אישים...</p>
                </div>
              ) : people.length > 0 ? (
                <div className="space-y-3">
                  {people.map((p) => {
                    const isHighlighted = p.id === highlightedPersonId;
                    return (
                      <div
                        key={p.id}
                        ref={el => personRefs.current[p.id] = el}
                        className={`p-3 rounded-2xl transition-all cursor-pointer group flex items-center gap-4 border relative ${isHighlighted ? 'bg-indigo-50 border-indigo-400 ring-4 ring-indigo-100 spotlight-pulse' : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md'}`}
                        onClick={() => p.wiki_url && window.open(p.wiki_url, '_blank')}
                      >
                        {p.birthYear && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md shadow-sm z-10 bg-indigo-600 text-white text-[10px] font-bold border border-white/20 pointer-events-none">
                            שנת לידה: {p.birthYear}
                          </div>
                        )}

                        <div className="relative shrink-0">
                          {p.image ? (
                            <img src={`${p.image}?width=150`} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" alt={p.full_name} />
                          ) : (
                            <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl bg-slate-200 text-slate-400">{p.full_name?.[0]}</div>
                          )}
                          <div className="absolute -bottom-1 -right-1 bg-amber-400 text-white text-[9px] px-1.5 py-0.5 rounded-lg border-2 border-white font-black shadow-sm" title="ציון פופולריות מבוסס ויקיפדיה">
                            {p.score || 0}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 pl-2">
                          <h3 className={`font-bold text-sm leading-tight transition-colors ${isHighlighted ? 'text-indigo-900 text-base' : 'text-slate-800'}`}>
                            {p.full_name}
                          </h3>
                          {p.description && (
                            <p className={`text-[11px] line-clamp-2 mt-1 leading-snug ${isHighlighted ? 'text-indigo-600' : 'text-slate-500'}`}>
                              {p.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
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

      <style>{`
        .custom-tooltip { background: #1e293b; color: white; border-radius: 4px; padding: 2px 8px; font-weight: bold; border: none; }
        @keyframes spotlightPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
        .spotlight-pulse { animation: spotlightPulse 1.5s infinite ease-in-out; }
        .custom-scrollbar { scrollbar-width: thin; }
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
