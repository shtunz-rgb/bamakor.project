# במקור.פרוג׳קט — Bamakor Project

A Hebrew map of where notable people were born. Pick a town or city in Israel and see the people born there, ranked by how prominent they are on Wikipedia. Each person links to their Hebrew Wikipedia page.

**Live site:** https://bamakor-proj.vercel.app/

## Features

- **Map** of 239 Israeli settlements. Click one to see its Wikipedia summary and the people born there, ranked and loaded 20 at a time.
- **Search** by settlement or by person.
- **Daily game:** "where was this person born?", with four options. Streaks and results are tracked per browser.
- **Share** links (WhatsApp, Facebook, X), **bookmark / install** prompt (the site works as an installable app), and a **contact form**.
- **Admin page** at `/admin` for managing the daily game's question pool and viewing user stats.

## Tech stack

- React 18 (Create React App), plain JavaScript
- Tailwind CSS, loaded from its CDN in `public/index.html`
- Leaflet 1.9.4, loaded from unpkg at runtime (not an npm dependency)
- Supabase for the database
- Hosted on Vercel, which deploys automatically on every push to `main`

## Project structure

| Path | What it is |
|---|---|
| `src/index.js` | Entry point. Shows `AdminPage` on `/admin`, otherwise `App` plus Vercel Analytics. |
| `src/App.js` | The whole public site: map, search, settlement panel, daily game, sharing, contact form. |
| `src/AdminPage.js` | The admin interface: game question pool and user stats. |
| `src/locations.js` | The 239 settlements shown on the map, each with its Wikidata ID and coordinates. |
| `src/exclusions.js` | Settlement names that also match places outside Israel (e.g. Bethlehem, Pennsylvania), and the text that rules those matches out. |
| `public/` | `index.html`, PWA manifest, service worker (`sw.js`), icons, and the social-preview image. |
| `vercel.json` | Sends every route to `index.html` so that `/admin` works. |

## Running locally

```bash
npm install
npm start        # dev server on http://localhost:3000
npm run build    # production build into build/
```

You need a `.env` file in the project root (see below). Two things behave differently outside Vercel:
- Vercel Analytics logs an `Unexpected token '<'` error in the console. Its script only exists on Vercel, so this is harmless.
- The service worker caches the page, so after a change you may need a hard reload.

## Environment variables

Create React App copies every `REACT_APP_*` value into the public JavaScript at build time. **That means anyone can read them, so they must never hold secrets.** They are also fixed at build time: after changing one in Vercel you must redeploy.

| Variable | Used for |
|---|---|
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase public (anon) key |
| `REACT_APP_FORMSPREE_ID` | Formspree form ID for the contact form |
| `REACT_APP_ADMIN_KEY` | Password for `/admin`. See [Known issues](#known-issues). |

Set these in Vercel under **Project → Settings → Environment Variables**, and in a local `.env` for development.

## Data

All data lives in a single Supabase project (`jbbyzzybclrpxpdledic`). **The table definitions, database functions and data exist only in Supabase**: the repo has no schema file and Supabase has no backups configured.

### Tables

**`persons`**: the main dataset, about 120,000 people.
`id`, `full_name`, `wikidata_id`, `wiki_url`, `birth_place_raw`, `birth_place_by_wikidata`, `QID_of_birth_place`, `wikipage_wordcount`, `num_wiki_languages`, `created_at`

- The app takes the birthplace from `birth_place_raw`. If that is empty or `no_bp_in_infobox`, it uses `birth_place_by_wikidata` instead.
- A person's ranking score is `round(languages × 0.3 + wordcount / 100 × 0.7)`, and it is doubled for people with Wikipedia pages in 80 or more languages. This formula is in both `App.js` and `AdminPage.js`.

**`game_personalities`**: the daily game's question pool.
`id`, `person_id`, `full_name`, `wikidata_id`, `correct_answer`, `wrong_answer_1..3`, `difficulty` (1–5), `last_shown_date`, `created_at`

**`user_stats`**: one row per anonymous browser ID (`bamakor_uid` in localStorage).
`uid`, `first_seen_at`, `last_seen_at`, `first_game_at`, `last_game_at`, `current_streak`, `longest_streak`, `total_games`, `total_correct`

### Database functions (RPC)

- `upsert_user_visit(p_uid)`: runs on every page load
- `record_game_open(p_uid)`: runs when the daily game opens
- `record_game_result(p_uid, p_correct, p_new_streak, p_longest_streak)`: runs when a daily-game answer is submitted

## External services

If the site breaks and the code hasn't changed, start here.

| Service | Used for | If it fails |
|---|---|---|
| Supabase | All people data, the game, user stats | The map shows but every settlement says "no results" (אין תוצאות במאגר) |
| Esri ArcGIS (`server.arcgisonline.com`) | Map tiles: Light Gray Base plus labels | The map background is blank |
| Hebrew Wikipedia REST API | Settlement summaries | Settlement summaries are missing |
| Wikidata SPARQL | Person images and birthplace coordinates | Images and some details are missing |
| unpkg | Loads Leaflet | No map at all |
| Tailwind CDN | All styling | The page is unstyled |
| Formspree | Contact form | The form shows an error |
| Vercel | Hosting, analytics | The site is down |

## Known issues

- **Supabase free tier pauses after about a week without traffic.** The project's domain then stops resolving and the site shows no data. To fix it, restore the project in the Supabase dashboard; no redeploy is needed. To prevent it, upgrade the plan or ping the API on a schedule. *(This happened in October 2026.)*
- **The admin password is not secret.** `REACT_APP_ADMIN_KEY` is compiled into the public JavaScript and checked in the browser, so anyone can read it. Admin writes also go through the public anon key, so the database itself has no admin-only protection.
- **`.env` is committed** despite being listed in `.gitignore`, because it was added before the ignore rule. The repo is public.
- **The daily game's wrong-answer pool is built from only 1,000 `persons` rows.** The query that counts people per settlement (`fetchCounts` in `App.js`) doesn't page past Supabase's 1,000-row limit, so those counts are partial. Only the choice of wrong answers is affected.
- **Tailwind is loaded from its CDN**, which the Tailwind team says not to do in production (it prints a console warning).

## Change log

Notable changes that aren't obvious from the code. For everything else, see `git log`.

- **2026-10-20:** The map tiles were switched from CARTO to Esri Light Gray, because CARTO basemaps now require an API key and every tile showed "API KEY REQUIRED". Esri tiles stop at zoom 16, so `maxNativeZoom: 16` enlarges them beyond that.
- **2026-10-20:** The Supabase project was found paused (its domain didn't resolve) and was restored.
