import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const ADMIN_KEY = process.env.REACT_APP_ADMIN_KEY;

const DIFFICULTIES = [1, 2, 3, 4, 5];
const DIFFICULTY_LABELS = { 1: 'קל מאוד', 2: 'קל', 3: 'בינוני', 4: 'קשה', 5: 'קשה מאוד' };

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_KEY) {
      setAuthed(true);
    } else {
      setAuthError('סיסמה שגויה');
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center" dir="rtl">
        <div className="bg-slate-800 rounded-2xl p-8 w-80 shadow-2xl border border-slate-700">
          <h1 className="text-white text-2xl font-black mb-6 text-center">ממשק ניהול</h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="סיסמה"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-slate-700 text-white rounded-xl px-4 py-3 border border-slate-600 focus:outline-none focus:border-indigo-500 placeholder-slate-400"
              autoFocus
            />
            {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-3 font-bold transition-all">
              כניסה
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminDashboard supabase={supabase} />;
}

function AdminDashboard({ supabase }) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef(null);

  // Form state
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [wrongAnswers, setWrongAnswers] = useState(['', '', '']);
  const [difficulty, setDifficulty] = useState(3);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Existing entries
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});

  const loadEntries = async () => {
    if (!supabase) return;
    setEntriesLoading(true);
    const { data } = await supabase
      .from('game_personalities')
      .select('*')
      .order('created_at', { ascending: false });
    setEntries(data || []);
    setEntriesLoading(false);
  };

  useEffect(() => { loadEntries(); }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (!searchQuery.trim() || !supabase) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from('persons')
        .select('id, full_name, wikidata_id, birth_place_raw, birth_place_by_wikidata')
        .ilike('full_name', `%${searchQuery}%`)
        .limit(10);
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 300);
  }, [searchQuery]);

  const handleSelectPerson = (person) => {
    setSelectedPerson(person);
    setSearchQuery(person.full_name);
    setSearchResults([]);
    if (entries.some(e => e.person_id === person.id)) {
      setSaveMsg(`${person.full_name} כבר קיים/ת ברשימה`);
      return;
    }
    setSaveMsg('');
    // Auto-fill correct answer
    const bp = person.birth_place_by_wikidata || person.birth_place_raw || '';
    setCorrectAnswer(bp.replace(/,.*/, '').trim());
  };

  const handleWrongAnswer = (i, val) => {
    const updated = [...wrongAnswers];
    updated[i] = val;
    setWrongAnswers(updated);
  };

  const handleSave = async () => {
    if (!selectedPerson) { setSaveMsg('בחר אישיות תחילה'); return; }
    if (!correctAnswer.trim()) { setSaveMsg('חסרה תשובה נכונה'); return; }
    if (wrongAnswers.some(w => !w.trim())) { setSaveMsg('יש למלא 3 תשובות שגויות'); return; }
    if (entries.some(e => e.person_id === selectedPerson.id)) {
      setSaveMsg(`${selectedPerson.full_name} כבר קיים/ת ברשימה`);
      return;
    }

    setSaving(true);
    setSaveMsg('');
    const { error } = await supabase.from('game_personalities').insert({
      person_id: selectedPerson.id,
      full_name: selectedPerson.full_name,
      wikidata_id: selectedPerson.wikidata_id,
      correct_answer: correctAnswer.trim(),
      wrong_answer_1: wrongAnswers[0].trim(),
      wrong_answer_2: wrongAnswers[1].trim(),
      wrong_answer_3: wrongAnswers[2].trim(),
      difficulty,
    });

    if (error) {
      setSaveMsg(`שגיאה: ${error.message}`);
    } else {
      setSaveMsg('נשמר בהצלחה!');
      setSelectedPerson(null);
      setSearchQuery('');
      setCorrectAnswer('');
      setWrongAnswers(['', '', '']);
      setDifficulty(3);
      loadEntries();
    }
    setSaving(false);
  };

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditFields({
      correct_answer: e.correct_answer,
      wrong_answer_1: e.wrong_answer_1,
      wrong_answer_2: e.wrong_answer_2,
      wrong_answer_3: e.wrong_answer_3,
      difficulty: e.difficulty,
    });
  };

  const handleUpdate = async (id) => {
    if (!editFields.correct_answer.trim() ||
        !editFields.wrong_answer_1.trim() ||
        !editFields.wrong_answer_2.trim() ||
        !editFields.wrong_answer_3.trim()) {
      return;
    }
    await supabase.from('game_personalities').update(editFields).eq('id', id);
    setEditingId(null);
    loadEntries();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק את הרשומה?')) return;
    await supabase.from('game_personalities').delete().eq('id', id);
    loadEntries();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-3xl font-black">ממשק ניהול — שאלון יומי</h1>
          <span className="bg-indigo-600 text-xs font-bold px-2 py-1 rounded-lg">ADMIN</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Left: Add entry ── */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold mb-5">הוספת אישיות</h2>

            {/* Person search */}
            <div className="relative mb-4">
              <label className="block text-sm text-slate-400 mb-1">חיפוש אישיות</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSelectedPerson(null); }}
                placeholder="הקלד שם..."
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 border border-slate-600 focus:outline-none focus:border-indigo-500 placeholder-slate-400"
              />
              {searchLoading && (
                <div className="absolute left-3 top-9 text-slate-400 text-xs">טוען...</div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full bg-slate-700 border border-slate-600 rounded-xl mt-1 shadow-xl max-h-52 overflow-y-auto">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPerson(p)}
                      className="w-full text-right px-4 py-2.5 hover:bg-indigo-600 transition-colors border-b border-slate-600 last:border-0"
                    >
                      <div className="font-medium">{p.full_name}</div>
                      <div className="text-xs text-slate-400 truncate">
                        {p.birth_place_by_wikidata || p.birth_place_raw || 'לא ידוע'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedPerson && (
              <div className="bg-indigo-900/40 border border-indigo-700 rounded-xl px-4 py-2 mb-4 text-sm">
                <span className="text-indigo-300 font-bold">{selectedPerson.full_name}</span>
                <span className="text-slate-400 mr-2">#{selectedPerson.id}</span>
              </div>
            )}

            {/* Correct answer */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-1">תשובה נכונה (יישוב לידה)</label>
              <input
                type="text"
                value={correctAnswer}
                onChange={e => setCorrectAnswer(e.target.value)}
                placeholder="שם היישוב..."
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 border border-slate-600 focus:outline-none focus:border-green-500 placeholder-slate-400"
              />
            </div>

            {/* Wrong answers */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-1">תשובות שגויות</label>
              <div className="flex flex-col gap-2">
                {wrongAnswers.map((w, i) => (
                  <input
                    key={i}
                    type="text"
                    value={w}
                    onChange={e => handleWrongAnswer(i, e.target.value)}
                    placeholder={`תשובה שגויה ${i + 1}...`}
                    className="w-full bg-red-950/40 text-white rounded-xl px-4 py-2.5 border border-red-800/50 focus:outline-none focus:border-red-500 placeholder-slate-500"
                  />
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="mb-5">
              <label className="block text-sm text-slate-400 mb-2">רמת קושי</label>
              <div className="flex gap-2">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    title={DIFFICULTY_LABELS[d]}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all border ${
                      difficulty === d
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-indigo-500'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1 text-center">{DIFFICULTY_LABELS[difficulty]}</p>
            </div>

            {saveMsg && (
              <p className={`text-sm text-center mb-3 ${saveMsg.startsWith('שגיאה') ? 'text-red-400' : 'text-green-400'}`}>
                {saveMsg}
              </p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded-xl py-3 font-bold text-base transition-all"
            >
              {saving ? 'שומר...' : 'שמור אישיות'}
            </button>
          </div>

          {/* ── Right: Existing entries ── */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">רשומות קיימות</h2>
              <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                {entries.length} אישיות
              </span>
            </div>

            {entriesLoading ? (
              <div className="text-slate-400 text-center py-8">טוען...</div>
            ) : entries.length === 0 ? (
              <div className="text-slate-500 text-center py-8">אין רשומות עדיין</div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto">
                {entries.map(e => (
                  <div
                    key={e.id}
                    className={`rounded-xl border transition-colors ${editingId === e.id ? 'bg-slate-700 border-indigo-500 px-4 py-3' : 'bg-slate-700/60 border-slate-600/50 px-4 py-3'}`}
                  >
                    {editingId === e.id ? (
                      <div className="flex flex-col gap-2">
                        <div className="font-bold text-sm mb-1">{e.full_name}</div>
                        <input
                          value={editFields.correct_answer}
                          onChange={ev => setEditFields(f => ({ ...f, correct_answer: ev.target.value }))}
                          placeholder="תשובה נכונה"
                          className="w-full bg-slate-800 text-green-300 rounded-lg px-3 py-1.5 text-sm border border-green-800/50 focus:outline-none focus:border-green-500"
                        />
                        {['wrong_answer_1', 'wrong_answer_2', 'wrong_answer_3'].map((key, i) => (
                          <input
                            key={key}
                            value={editFields[key]}
                            onChange={ev => setEditFields(f => ({ ...f, [key]: ev.target.value }))}
                            placeholder={`תשובה שגויה ${i + 1}`}
                            className="w-full bg-slate-800 text-red-300 rounded-lg px-3 py-1.5 text-sm border border-red-900/50 focus:outline-none focus:border-red-500"
                          />
                        ))}
                        <div className="flex gap-1.5 mt-1">
                          {DIFFICULTIES.map(d => (
                            <button
                              key={d}
                              onClick={() => setEditFields(f => ({ ...f, difficulty: d }))}
                              className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-all ${editFields.difficulty === d ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-indigo-500'}`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => handleUpdate(e.id)}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 text-sm font-bold transition-all"
                          >
                            שמור
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 bg-slate-600 hover:bg-slate-500 text-white rounded-lg py-1.5 text-sm font-bold transition-all"
                          >
                            ביטול
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">{e.full_name}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-green-400 text-xs">{e.correct_answer}</span>
                            <span className="text-slate-500 text-xs">|</span>
                            <span className="text-red-400 text-xs">{e.wrong_answer_1}</span>
                            <span className="text-red-400 text-xs">{e.wrong_answer_2}</span>
                            <span className="text-red-400 text-xs">{e.wrong_answer_3}</span>
                          </div>
                          <div className="text-slate-500 text-xs mt-0.5">
                            קושי: {e.difficulty} · {DIFFICULTY_LABELS[e.difficulty]}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0 mt-0.5">
                          <button
                            onClick={() => startEdit(e)}
                            className="text-slate-400 hover:text-indigo-400 transition-colors text-sm leading-none px-1"
                            title="ערוך"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="text-slate-500 hover:text-red-400 transition-colors text-lg leading-none"
                            title="מחק"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
