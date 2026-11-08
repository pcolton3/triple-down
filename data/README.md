# Course Seed Data

The canonical Arizona seed package is:

- `all-arizona-course-targets.csv`: the single active verification backlog used by the scheduled seed task.
- `all-arizona-course-seed.csv`: verified course identities, hole pars, and hole handicap indexes.
- `all-arizona-course-tee-seed.csv`: tee-specific ratings, slopes, yardages, and source URLs.
- `all-arizona-course-seed-safe.sql`: rerunnable combined SQL updater for courses, holes, and tees.

The Phoenix, Northern Arizona, Northwest Valley, and Rest of Arizona files remain as regional source partitions. Update the appropriate regional CSV first, then regenerate the statewide CSV and SQL outputs. This preserves research provenance while giving deployment and application code one canonical seed package.

Current Arizona totals are 266 course/layout rows and 1,177 tee rows.

The Arizona target file contains the original 73-course/layout backlog and retains completed rows for history. Current status is 43 verified, 16 partial, 14 unavailable, and 0 pending. Future Arizona work should process rows whose status is `partial` or `unavailable` and leave verified rows unchanged.

The national public-course seed package is:

- `top-public-us-course-targets.csv`: non-Arizona public-course verification queue.
- `top-public-us-course-seed.csv`: verified non-Arizona course identities, hole pars, and hole handicap indexes.
- `top-public-us-course-tee-seed.csv`: verified non-Arizona tee ratings, slopes, yardages, and source URLs.

The national queue starts as a curated starter-composite list because major publications publish different public-access rankings. Record the source used for each target in `ranking_source` and `source_rank`, then only move a row to `verified` after hole pars, hole handicap indexes, tee ratings, slopes, and total yardages are verified from public scorecard sources.

Data requirements:

- Course rating and slope should come from the USGA Course Rating Database, an official/current scorecard, or another reliable structured scorecard.
- Hole pars and handicap indexes should come from an official scorecard, PDF, or verified structured scorecard source.
- `pcc_default` stays `0`; PCC is a daily playing-conditions adjustment, not a fixed course value.
- `verification_status` should be `pending`, `partial`, or `verified`.
- `source_url` should identify the page or PDF used for verification.
- `verified_date` uses `YYYY-MM-DD`.
- Tee rows use `tee_name` for the playable label, `tee_color` for the marker color, and `gender` to distinguish otherwise identical tee names.

Supabase storage:

- Course identity and holes go into `saved_courses` and `saved_course_holes`.
- Tee rating/slope rows go into `saved_course_tees`.
- The combined safe SQL merges duplicate saved courses and upserts all three datasets.

The migration in `supabase-multi-foursome.sql` creates the relevant tables and policies.


## Sand Valley resort (Wisconsin)

Verified against the resort's official course pages and linked PDF scorecards on 2026-09-19.

- `sand-valley-course-seed.csv`: all six course identities and 101 actual holes.
- `sand-valley-course-tee-seed.csv`: 73 tee rows, including 68 men's/women's rated rows and five unrated tee layouts.
- `sand-valley-course-seed.sql`: transactional, rerunnable Supabase seed for all six courses, their holes, and the 68 rated tee rows.
- `build-sand-valley-seed.py`: validate the resort CSVs and regenerate SQL with `python data/build-sand-valley-seed.py` from the project root.

The same course and tee records are included in the national CSV package. Sand Valley and Mammoth Dunes replace the previous simulator-based records with official tee names, ratings, slopes, and yardages. The national verification queue also includes Sedge Valley, The Lido, Sandbox, and Commons. Resort additions use `resort-trip`, not an invented ranking.

| Course | Holes | Par | CSV tee rows | Verification |
| --- | ---: | ---: | ---: | --- |
| Sand Valley | 18 | 72 | 20 | Verified |
| Mammoth Dunes | 18 | 73 | 20 | Verified |
| Sedge Valley | 18 | 68 | 10 | Verified |
| The Lido | 18 | 72 | 18 | Partial: 12 gender-specific rows have no verified total yardage |
| Sand Valley (Sandbox) | 17 | 51 | 2 | Partial: no published rating, slope, or hole handicap indexes |
| Sand Valley (Commons) | 12 | 45 | 3 | Partial: explicitly not USGA rated |

### Apply the seed

Run `data/sand-valley-course-seed.sql` in the Supabase SQL editor after applying the saved-course schema in `supabase-multi-foursome.sql`. This seed requires the existing unique keys on course identity, course/hole, and course/tee/gender. The file updates existing seeded identities without replacing their IDs. Course insertion and hole insertion use separate statements so a first execution also populates holes. Only the old simulator-sourced Blue/White men's tees for Sand Valley and Mammoth Dunes are removed; other saved tees remain. No application deployment is needed for the database-backed course search to read these rows.

The SQL has been checked with PostgreSQL (PGlite) for a fresh schema, repeated execution with stable IDs, correction of existing values, selective simulator-tee cleanup, and preservation of user-added tees. Preparing these files does not apply them to the live database.

### Source and application limitations

Each CSV row records its official source URL. Published scorecard totals take precedence over inconsistent course-page headline lengths. Lido's linked May 2024 card provides Navy, White, and Green yardages; its current course page also lists forward-tee ratings. Missing combo/forward totals remain blank (SQL NULL), and the Lido row remains partial. Tee positions/equipment labels have blank `tee_color` where an actual marker color is not verified.

Sandbox publishes Shovels (1,531 yards) and Mats (1,508 yards), all par 3, with no handicap indexes. Its SQL hole indexes remain NULL. Commons publishes Back (3,417), Middle (3,027), and Forward (2,584) yardages and recommended hole handicap indexes; its card suggests 65% of handicap index for casual games and explicitly says the course is not USGA rated. Neither course receives fabricated rating/slope values. Their five unrated tee rows are retained in CSV but omitted from `saved_course_tees`, whose rating and slope columns are NOT NULL.

The application currently creates 18-hole rounds and falls back to a default 18-hole layout for shorter course records. It also substitutes hole number when a saved handicap index is NULL. This data-only seed does not add support for playing Sandbox or Commons with their true hole counts or for unrated handicap calculations. Use the four 18-hole courses for the current round workflow; short-course play needs a separate application change. Trailing CSV holes remain blank and SQL never pads a short course to 18 holes.

The Sand Valley SQL uses a statement-local VALUES CTE for each course operation and verification query, with no temporary tables. It has also passed checks executing statements independently, without a surrounding transaction. Run the complete file in a new SQL Editor query; selecting only the final verification query will report existing data without applying the seed.
