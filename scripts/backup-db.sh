#!/bin/zsh
# Backs up the Supabase database to ~/Backups/bamakor/<date>/
#   schema.sql         - structure only (tables, functions, security rules)
#   bamakor-full.dump  - everything, for restoring with pg_restore
#   <table>.csv        - one spreadsheet-friendly file per table
# Usage: zsh scripts/backup-db.sh

set -e
PG_BIN=/opt/homebrew/opt/postgresql@17/bin
HOST=aws-1-ap-south-1.pooler.supabase.com
DB_USER=postgres.jbbyzzybclrpxpdledic

read -s "PASSWORD?Supabase database password: "
echo
# Percent-encode the password so special characters can't break the URL
ENCODED=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$PASSWORD")
DB_URL="postgresql://$DB_USER:$ENCODED@$HOST:5432/postgres"

OUT=~/Backups/bamakor/$(date +%Y-%m-%d)
mkdir -p "$OUT"
cd "$OUT"

echo "1/3 Exporting structure..."
$PG_BIN/pg_dump "$DB_URL" --schema=public --schema-only --no-owner -f schema.sql
echo "2/3 Exporting full backup..."
$PG_BIN/pg_dump "$DB_URL" --schema=public --no-owner -Fc -f bamakor-full.dump
echo "3/3 Exporting CSVs..."
for t in persons game_personalities user_stats; do
  $PG_BIN/psql "$DB_URL" -q -c "\copy public.$t TO '$t.csv' CSV HEADER"
done

echo
echo "Done. Saved to: $OUT"
ls -lh
echo "Tables:    $(grep -c 'CREATE TABLE' schema.sql)  (expect 3+)"
echo "Functions: $(grep -cE 'CREATE (OR REPLACE )?FUNCTION' schema.sql)  (expect 3+)"
wc -l *.csv
