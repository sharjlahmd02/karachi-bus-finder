# Backend Fixes — Summary

This backend was reviewed end-to-end against `karachi_bus_stops_coordinates_v2.csv`.
Below is every bug found and what changed. A full automated test suite
(`npm test`) is included and passes 28/28 checks, run against the real route
handlers using the actual CSV data (no live MongoDB needed for the tests —
see "Testing" below).

## Critical bugs (would crash or silently corrupt data)

1. **Seeding would crash on real data.**
   `Stop.coordinateConfidence` had a strict Mongoose `enum` that only allowed
   5 values, but the actual CSV contains values like
   `geocoded_verified_added` and `geocoded_approximate_added` that aren't in
   that list. Mongoose throws a validation error the moment such a row is
   inserted, which — combined with `process.exit(1)` in the old seed script
   — would kill the import partway through.
   **Fix:** `coordinateConfidence` is now a free-form trimmed string; no data
   is dropped or crashes the process.

2. **Wrong "nearest stop" — the main bug you reported.**
   `POST /api/routes/match-by-coords` computed its own "nearest stop"
   by only scanning stops that happened to be attached to a `Route` document,
   instead of querying the full `Stop` collection. This is inconsistent with
   `GET /api/stops/nearest` (which is correct) and can silently return a
   stop that is *not* actually the closest one.
   **Fix:** `match-by-coords` now calls the same `$geoNear`-based lookup
   against the whole `Stop` collection for both the pickup and destination
   points, so the reported nearest stop is always genuinely nearest.

3. **Duplicate stop name with two different real-world coordinates.**
   "RCD Ground" appears on two different routes (R1 and R12) in the CSV with
   coordinates ~158m apart. The old seed script kept whichever row it saw
   first and silently discarded the other, meaning one route's nearest-stop
   distance was calculated from the wrong physical point.
   **Fix:** the new seed script clusters same-named stops by real-world
   distance. Points within 300m are treated as the same stop and averaged;
   points farther apart are split into distinct, disambiguated stops (e.g.
   `"Name (R1)"` / `"Name (R12)"`) instead of one overwriting the other.
   Verified against this exact case with a regression test.

4. **CSV filename mismatch.**
   `seed.js` pointed at `karachi_bus_stops_coordinates_final.csv`, which
   doesn't exist — seeding would fail immediately.
   **Fix:** points at `data/karachi_bus_stops_coordinates_v2.csv` (included),
   configurable via `CSV_PATH` in `.env`.

## Validation & security gaps

5. **No Karachi bounding on coordinates.** Both `/api/stops/nearest` and
   `/api/routes/match-by-coords` only validated that lat/lng were
   *globally* valid (-90..90 / -180..180), so someone could search using
   coordinates anywhere on Earth. Added a Karachi bounding box
   (`src/config/karachiBounds.js`) and now every coordinate-taking endpoint
   requires both points to fall inside it.
6. **No `ObjectId` validation.** `/api/routes/match` passed
   `pickupStopId`/`destinationStopId` straight into a Mongo query. A
   malformed ID caused an unhandled cast error → 500. Now validated up front
   and returns a clean 400, plus checks the stops actually exist.
7. **No rate limiting, no security headers, no body-size limit.** Added
   `helmet`, `express-rate-limit` (120 req/min/IP), and a 50kb JSON body cap.
8. **No global error handling.** Any thrown/rejected error not explicitly
   caught (e.g. malformed JSON body) had undefined behavior. Added a 404
   handler and a centralized error-handling middleware so the server never
   crashes on bad input — it always responds with a clean error instead.
9. **No process-level crash safety.** Added handlers for
   `unhandledRejection`/`uncaughtException` and graceful shutdown on
   SIGTERM/SIGINT.
10. **Unwanted third-party output.** The installed `dotenv` version prints a
    randomized promotional "tip" (including a link to an unrelated site) to
    the console on every load. Suppressed via `{ quiet: true }`.

## Data-quality improvements

11. **`also_known_as` column was read but never used.** Aliases like
    "Saudabd" (a typo for "Saudabad") are now parsed into each stop's
    `aliases` array, so fuzzy search actually benefits from them (verified
    by test).
12. Added a unique index on `(name, serviceType)` so re-running the seed
    without clearing first can't create duplicate stops.
13. `/api/stops/nearest` and `/api/stops/search` now accept optional,
    bounded `limit` params, and `/nearest` accepts an optional
    `maxDistanceMeters`, while staying 100% backwards compatible with no
    params passed.

## Testing

Run `npm install && npm test`. The test suite (`__e2e__/run.js`) builds an
in-memory dataset from the real CSV using the exact same parsing/merging
logic as `seed.js`, boots the real Express app and route handlers, and
exercises them over actual HTTP — no MongoDB installation required. It
specifically regression-tests the RCD Ground collision and the
match-by-coords nearest-stop bug against a brute-force ground truth.

To run against a real database:
1. `cp .env.example .env` and set `MONGODB_URI`.
2. `npm run seed` — reads `data/karachi_bus_stops_coordinates_v2.csv`,
   prints a summary of stops/routes created and any warnings.
3. `npm start`.
