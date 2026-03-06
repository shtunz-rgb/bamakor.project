/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { customLocations } from './locations';

const SUPABASE_URL = 'https://jbbyzzybclrpxpdledic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiYnl6enliY2xycHhwZGxlZGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDQ4NjYsImV4cCI6MjA4NDY4MDg2Nn0.ntsDu_3t4cw135XUVrw_dwqBAbsKr1Rp0U6UaqvM7iU';

const PROJECT_NAME = "במקור.פרוג׳קט";

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchError, setSearchError] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [settlementSummary, setSettlementSummary] = useState('');
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [supabaseClient, setSupabaseClient] = useState(null);
  const [highlightedPersonId, setHighlightedPersonId] = useState(null);
  
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);
  const personRefs = useRef({});

  // טעינת Supabase Client
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = () => {
      if (window.supabase) {
        setSupabaseClient(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
      }
    };
    document.body.appendChild(script);
  }, []);

  // אתחול המפה (Leaflet)
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
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
        renderMarkers();
      };
      document.body.appendChild(script);
    };
    loadLeaflet();
  }, []);

  useEffect(() => {
    if (leafletMapRef.current) renderMarkers();
  }, [selectedSettlement]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderMarkers = () => {
    if (!leafletMapRef.current) return;
    const L = window.L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    customLocations.forEach(s => {
      const isSelected = selectedSettlement && s.id === selectedSettlement.id;
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: isSelected ? 9 : 7,
        fillColor: '#4f46e5',
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9,
        interactive: true
      }).addTo(leafletMapRef.current);

      marker.on('click', () => handleSettlementSelection(s));
      marker.bindTooltip(s.name, { sticky: true });
      markersRef.current.push(marker);
    });
  };

  const handleSettlementSelection = (s) => {
    setSelectedSettlement(s);
    setIsSidebarOpen(true);
    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([s.lat, s.lng], 13);
    }
  };

  // מנגנון חיפוש מבוסס הקובץ המופרד
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const matched = customLocations
      .filter(s => s.name.includes(query))
      .slice(0, 5);
    setSuggestions(matched);
  }, [searchQuery]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900" dir="rtl">
      <header className="bg-white border-b border-slate-200 p-4 shadow-sm z-30 flex items-center justify-between">
        <h1 className="text-2xl font-black text-indigo-600 tracking-tight">{PROJECT_NAME}</h1>
        <div className="relative w-64 md:w-96">
          <input 
            type="text" 
            placeholder="חפש יישוב או אישיות..." 
            className="w-full px-4 py-2 rounded-full border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white border rounded-xl shadow-xl z-50">
              {suggestions.map((s, idx) => (
                <div key={idx} className="p-3 hover:bg-slate-50 cursor-pointer text-sm" onClick={() => { handleSettlementSelection(s); setSuggestions([]); setSearchQuery(''); }}>
                  📍 {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 relative flex overflow-hidden">
        <div ref={mapRef} className="flex-1 z-0" />
        <aside className={`absolute right-0 top-0 bottom-0 w-80 md:w-96 bg-white shadow-2xl z-20 transition-transform duration-500 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-5 bg-indigo-700 text-white flex justify-between items-center">
            <h2 className="text-xl font-bold">{selectedSettlement?.name}</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="text-2xl">✕</button>
