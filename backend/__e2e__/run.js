const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const http = require('http');

const { normalizeName, groupKey, parseAliases, clusterPoints } = require('../src/seed');
const { makeFakeStopModel, makeFakeRouteModel, haversineMeters } = require('./fakeModels');

const CSV_PATH = path.join(__dirname, '..', 'data', 'karachi_bus_stops_coordinates_v2.csv');

function parseCSV(csvPath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  \u2713 ${msg}`);
  } else {
    failed++;
    console.error(`  \u2717 FAILED: ${msg}`);
  }
}

async function buildFixtures() {
  const rawRows = await parseCSV(CSV_PATH);
  const validRows = rawRows.map(row => ({
    routeCode: row.route_code.trim(),
    routeName: row.route_name.trim(),
    stopName: normalizeName(row.stop_name),
    lat: parseFloat(row.latitude),
    lng: parseFloat(row.longitude),
    aliasesRaw: row.also_known_as || '',
    source: row.source,
    stopOrder: parseInt(row.stop_order, 10)
  }));

  const byName = new Map();
  for (const row of validRows) {
    const key = groupKey(row.stopName);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  }

  const rowStopKey = new Map();
  const resolvedStops = new Map();
  for (const [, rows] of byName) {
    const points = rows.map(r => ({ lat: r.lat, lng: r.lng }));
    const clusters = clusterPoints(points);
    clusters.forEach((cluster) => {
      const clusterRows = cluster.indices.map(i => rows[i]);
      const baseName = rows[0].stopName;
      const routeCodesInCluster = [...new Set(clusterRows.map(r => r.routeCode))];
      const finalName = clusters.length > 1 ? `${baseName} (${routeCodesInCluster.join('/')})` : baseName;
      const resolvedKey = `${finalName}::pbs`;
      if (!resolvedStops.has(resolvedKey)) {
        resolvedStops.set(resolvedKey, {
          name: finalName, lat: cluster.centroidLat, lng: cluster.centroidLng, aliases: new Set()
        });
      }
      const entry = resolvedStops.get(resolvedKey);
      for (const r of clusterRows) {
        rowStopKey.set(r, resolvedKey);
        for (const alias of parseAliases(r.aliasesRaw, baseName)) entry.aliases.add(alias);
      }
    });
  }

  const stops = [];
  const stopIdByKey = new Map();
  for (const [key, data] of resolvedStops) {
    const id = new mongoose.Types.ObjectId();
    stopIdByKey.set(key, id);
    stops.push({
      _id: id,
      name: data.name,
      aliases: [...data.aliases],
      location: { type: 'Point', coordinates: [data.lng, data.lat] },
      serviceType: 'pbs'
    });
  }

  const routeMap = new Map();
  for (const row of validRows) {
    const resolvedKey = rowStopKey.get(row);
    if (!routeMap.has(row.routeCode)) {
      routeMap.set(row.routeCode, { displayName: `${row.routeCode} (${row.routeName})`, stops: [] });
    }
    routeMap.get(row.routeCode).stops.push({ id: stopIdByKey.get(resolvedKey), order: row.stopOrder });
  }

  const routes = [];
  for (const [code, data] of routeMap) {
    const orderedStops = data.stops.sort((a, b) => a.order - b.order).map(s => s.id);
    routes.push({
      _id: new mongoose.Types.ObjectId(),
      code: `pbs-${code}`,
      displayName: data.displayName,
      serviceType: 'pbs',
      orderedStops
    });
  }

  const stopsById = new Map(stops.map(s => [String(s._id), s]));
  return { stops, routes, stopsById };
}

function findByName(stops, name) {
  return stops.find(s => s.name.toLowerCase() === name.toLowerCase());
}

function bruteForceNearest(stops, lat, lng, serviceType = 'pbs') {
  let best = null, bestDist = Infinity;
  for (const s of stops) {
    if (s.serviceType !== serviceType) continue;
    const [sLng, sLat] = s.location.coordinates;
    const d = haversineMeters(lat, lng, sLat, sLng);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return { stop: best, distance: bestDist };
}

async function main() {
  console.log('Building fixtures from real CSV via production parsing logic...');
  const { stops, routes, stopsById } = await buildFixtures();
  console.log(`Fixtures ready: ${stops.length} stops, ${routes.length} routes\n`);

  // Inject fake models into the require cache BEFORE the route modules
  // require them, so the real, unmodified route handler code runs against
  // this in-memory dataset.
  const stopModelPath = require.resolve('../src/models/Stop');
  const routeModelPath = require.resolve('../src/models/Route');
  require.cache[stopModelPath] = { id: stopModelPath, filename: stopModelPath, loaded: true, exports: makeFakeStopModel(stops) };
  require.cache[routeModelPath] = { id: routeModelPath, filename: routeModelPath, loaded: true, exports: makeFakeRouteModel(routes, stopsById) };

  const express = require('express');
  const stopsRouter = require('../src/routes/stops');
  const routesRouter = require('../src/routes/routes');
  const { notFoundHandler, globalErrorHandler } = require('../src/middleware/errorHandler');

  const app = express();
  app.use(express.json({ limit: '50kb' }));
  app.use('/api/stops', stopsRouter);
  app.use('/api/routes', routesRouter);
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  const getJSON = async (p) => {
    const r = await fetch(base + p);
    return { status: r.status, body: await r.json() };
  };
  const postJSON = async (p, data, rawBody) => {
    const r = await fetch(base + p, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody !== undefined ? rawBody : JSON.stringify(data)
    });
    let body;
    try { body = await r.json(); } catch { body = null; }
    return { status: r.status, body };
  };

  console.log('--- /api/stops/search ---');
  {
    const { status, body } = await getJSON('/api/stops/search?q=Saudabd&serviceType=pbs');
    assert(status === 200, 'search by typo alias returns 200');
    assert(Array.isArray(body) && body.some(r => r.name.toLowerCase().includes('saudabad')), 'typo alias "Saudabd" resolves to "Saudabad" via aliases');
  }
  {
    const { status, body } = await getJSON('/api/stops/search?q=&serviceType=pbs');
    assert(status === 400, 'empty query q is rejected with 400');
  }
  {
    const { status } = await getJSON('/api/stops/search?q=Khokhrapar&serviceType=bogus');
    assert(status === 400, 'invalid serviceType rejected with 400');
  }
  {
    const longQ = 'a'.repeat(200);
    const { status } = await getJSON(`/api/stops/search?q=${longQ}&serviceType=pbs`);
    assert(status === 400, 'overlong query string rejected with 400 (no crash)');
  }

  console.log('\n--- /api/stops/nearest ---');
  {
    const khokhrapar = findByName(stops, 'Khokhrapar');
    const [lng, lat] = khokhrapar.location.coordinates;
    // Nudge slightly off the exact point.
    const testLat = lat + 0.0005, testLng = lng + 0.0005;
    const brute = bruteForceNearest(stops, testLat, testLng);

    const { status, body } = await getJSON(`/api/stops/nearest?lat=${testLat}&lng=${testLng}&serviceType=pbs`);
    assert(status === 200, 'nearest returns 200 for valid Karachi coords');
    assert(body.name === brute.stop.name, `nearest stop matches brute-force nearest (got "${body.name}", expected "${brute.stop.name}")`);
  }
  {
    // London coordinates - well outside Karachi.
    const { status, body } = await getJSON('/api/stops/nearest?lat=51.5074&lng=-0.1278&serviceType=pbs');
    assert(status === 400, 'nearest rejects out-of-Karachi coordinates (bounding works)');
    assert(/Karachi/i.test(body.error || ''), 'error message mentions Karachi bound violation');
  }
  {
    const { status } = await getJSON('/api/stops/nearest?lat=notanumber&lng=67.01&serviceType=pbs');
    assert(status === 400, 'nearest rejects non-numeric lat with 400 instead of crashing');
  }
  {
    const { status } = await getJSON('/api/stops/nearest?lat=24.86&lng=67.01&serviceType=pbs&limit=3');
    assert(status === 200, 'nearest with limit=3 returns 200');
  }

  console.log('\n--- RCD Ground bug-fix regression ---');
  {
    // This specific point was chosen to sit almost exactly on the R1 cut of
    // "RCD Ground" (24.8994019, 67.1974687). Before the fix, this stop name
    // collision silently overwrote coordinates depending on CSV row order;
    // now it must resolve to a merged/centroid stop very close to both
    // original points.
    const testLat = 24.8994019, testLng = 67.1974687;
    const brute = bruteForceNearest(stops, testLat, testLng);
    const { status, body } = await getJSON(`/api/stops/nearest?lat=${testLat}&lng=${testLng}&serviceType=pbs`);
    assert(status === 200, 'RCD Ground area nearest lookup returns 200');
    assert(body.name.toLowerCase().includes('rcd ground'), `nearest stop near RCD Ground resolves to an RCD Ground stop (got "${body.name}")`);
    assert(body.name === brute.stop.name, 'API nearest result matches brute-force ground truth for RCD Ground area');
  }

  console.log('\n--- /api/routes/match-by-coords (core bug: wrong nearest stop) ---');
  {
    const khokhrapar = findByName(stops, 'Khokhrapar');
    const [pLng, pLat] = khokhrapar.location.coordinates;
    // Pick some destination stop far away, e.g. anything near the end of route data.
    const dest = stops[Math.floor(stops.length / 2)];
    const [dLng, dLat] = dest.location.coordinates;

    const bruteP = bruteForceNearest(stops, pLat + 0.001, pLng + 0.001);
    const bruteD = bruteForceNearest(stops, dLat + 0.001, dLng + 0.001);

    const { status, body } = await postJSON('/api/routes/match-by-coords', {
      pickupLat: pLat + 0.001, pickupLng: pLng + 0.001,
      destinationLat: dLat + 0.001, destinationLng: dLng + 0.001,
      serviceType: 'pbs'
    });
    assert(status === 200, 'match-by-coords returns 200 for valid input');
    assert(body.pickupStop.name === bruteP.stop.name, `match-by-coords pickupStop is the TRUE nearest stop (got "${body.pickupStop.name}", expected "${bruteP.stop.name}")`);
    assert(body.destinationStop.name === bruteD.stop.name, `match-by-coords destinationStop is the TRUE nearest stop (got "${body.destinationStop.name}", expected "${bruteD.stop.name}")`);
    assert(Array.isArray(body.routes), 'match-by-coords returns a routes array');
  }
  {
    // Destination outside Karachi should be rejected.
    const { status, body } = await postJSON('/api/routes/match-by-coords', {
      pickupLat: 24.86, pickupLng: 67.01,
      destinationLat: 40.7128, destinationLng: -74.0060, // New York
      serviceType: 'pbs'
    });
    assert(status === 400, 'match-by-coords rejects destination outside Karachi');
    assert(/destination/i.test(body.error || ''), 'error correctly identifies destination as the invalid point');
  }
  {
    const { status } = await postJSON('/api/routes/match-by-coords', {
      pickupLat: 'DROP TABLE stops', pickupLng: 67.01,
      destinationLat: 24.9, destinationLng: 67.1,
      serviceType: 'pbs'
    });
    assert(status === 400, 'match-by-coords rejects garbage non-numeric input with 400, not a crash');
  }

  console.log('\n--- /api/routes/match ---');
  {
    const { status } = await postJSON('/api/routes/match', {
      pickupStopId: 'not-a-valid-object-id',
      destinationStopId: 'also-not-valid',
      serviceType: 'pbs'
    });
    assert(status === 400, 'match rejects malformed stop IDs with 400 instead of a 500 crash');
  }
  {
    const a = stops[0]._id.toString();
    const b = stops[1]._id.toString();
    const { status, body } = await postJSON('/api/routes/match', { pickupStopId: a, destinationStopId: b, serviceType: 'pbs' });
    assert(status === 200, 'match with two valid, distinct, existing stop IDs returns 200');
    assert(Array.isArray(body), 'match returns an array');
  }
  {
    const a = stops[0]._id.toString();
    const { status } = await postJSON('/api/routes/match', { pickupStopId: a, destinationStopId: a, serviceType: 'pbs' });
    assert(status === 400, 'match rejects identical pickup and destination stop IDs');
  }

  console.log('\n--- robustness / crash-safety ---');
  {
    const { status } = await postJSON('/api/routes/match-by-coords', undefined, '{not valid json');
    assert(status === 400, 'malformed JSON body returns 400 via error handler instead of crashing the server');
  }
  {
    const { status } = await getJSON('/api/totally/unknown/route');
    assert(status === 404, 'unknown route returns 404 via notFoundHandler');
  }
  {
    // Server should still be alive and responsive after the malformed-JSON hit above.
    const { status } = await getJSON('/api/stops/search?q=Khokhrapar&serviceType=pbs');
    assert(status === 200, 'server survives malformed input and continues serving requests (no crash)');
  }

  server.close();

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('E2E test crashed:', err);
  process.exit(1);
});
