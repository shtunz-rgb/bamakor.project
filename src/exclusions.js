// Maps settlement names to substrings that disqualify a birth_place_raw or
// birth_place_by_wikidata match. Add entries here when a city name is shared
// with non-Israeli locations and causes false positives.
export const BIRTH_PLACE_EXCLUSIONS = {
  'בית לחם': ['ארצות הברית', '(פנסילבניה)', '(מיסיסיפי)', '(מרילנד)', '(ניו יורק)'],
  'ערד': ['תל ערד'],
};
