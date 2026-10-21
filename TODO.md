# To-do list

Open issues and improvements, most urgent first. Tick a box when it's done, and move a short note to the **Change log** in [README.md](README.md).

---

## 🔴 High priority

### 1. Make the admin page actually secure
- [ ] Replace the admin password check with real login through Supabase Auth
- [ ] Restrict `game_personalities` so that only a logged-in admin can add, edit or delete
- [ ] Restrict `user_stats` so visitors can't read or edit it directly; the existing database functions keep working
- [ ] Remove `REACT_APP_ADMIN_KEY` from Vercel and `.env`, and stop reusing that password anywhere

**Why:** The `/admin` password (`REACT_APP_ADMIN_KEY`) is compiled into the public JavaScript, so anyone can read it in their browser. Even without it, the `anon_all` rules on `game_personalities` and `user_stats` let anyone holding the public key read, change or delete those tables.

**How:** Create an admin user in Supabase Auth and add an email/password login to `AdminPage.js`. Then replace the `anon_all` rules with rules that allow writes only for that user. Take a backup first (`zsh scripts/backup-db.sh`).

### 2. Stop Supabase from pausing the project
- [ ] Pick a fix: upgrade the Supabase plan, or set up a scheduled "keep-alive" request (e.g. a daily Vercel Cron or GitHub Action that reads one row)
- [ ] Set it up and confirm it runs

**Why:** Free-tier projects pause after about a week without traffic. The site then shows no data, which is what happened in October 2026.

---

## 🟡 Medium priority

### 3. Stop tracking `.env` in git
- [ ] Run `git rm --cached .env` and commit; it's already in `.gitignore`
- [ ] Make sure every value is set in Vercel's Environment Variables
- [ ] Add a `.env.example` with the variable names and empty values

**Why:** `.env` was committed before the ignore rule existed, so it's public in the repo. Its current values aren't secret, but any secret added to it later would leak.

### 4. Keep backups up to date
- [ ] Copy `~/Backups/bamakor/` to a second place (iCloud, Google Drive or a USB stick)
- [ ] Save the Supabase **database password** in a password manager
- [ ] Run `zsh scripts/backup-db.sh` regularly (e.g. monthly) and always before database changes
- [ ] When the database structure changes, copy the new `schema.sql` into `supabase/schema.sql` and commit it

---

## 🟢 Low priority

### 5. Daily game counts only 1,000 of ~120,000 people
- [ ] In `fetchCounts` (`src/App.js`), page through all rows or count in the database (e.g. with a database function)

**Why:** Supabase returns at most 1,000 rows per request, so the per-town counts used to pick the game's wrong answers are partial. Nothing else uses them.

### 6. Install Tailwind properly instead of loading it from the CDN
- [ ] Install Tailwind as a build dependency and remove the `<script src="https://cdn.tailwindcss.com">` tag from `public/index.html`

**Why:** The Tailwind team says not to use the CDN version in production (it prints a console warning). It's slower and adds another outside service the site depends on.

### 7. Hebrew place names on the map (optional)
- [ ] Decide whether the map labels should be in Hebrew. If so, try OpenStreetMap's standard tiles, which use local names, and compare the look.

**Why:** The Esri map tiles show labels in English.
