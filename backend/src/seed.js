const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ quiet: true });

const Stop = require('./models/Stop');
const Route = require('./models/Route');
const { isWithinKarachi } = require('./config/karachiBounds');

// The CSV filename can change between data drops - make it configurable
// instead of hardcoding a name that silently goes stale.
const CSV_PATH = process.env.CSV_PATH ||
  path.join(__dirname, '..', 'data', 'karachi_bus_stops_coordinates_final.csv');

// If two rows share the same stop name but their coordinates are within
// this distance, they're treated as the same physical stop and their
// coordinates are averaged. Beyond this distance they're treated as
// genuinely different stops that happen to share a name, and are split
// apart instead of silently overwriting one another (this is what caused
// "nearest stop" to sometimes return a stop ~150m from where it should,
// e.g. "RCD Ground" appearing on two different routes with two different
// coordinate pairs).
const MERGE_TOLERANCE_METERS = 300;

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Create a .env file (see .env.example).');
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('MongoDB connected for seeding');
};

const parseCSV = (csvPath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(csvPath)) {
      return reject(new Error(`CSV file not found at ${csvPath}`));
    }
    const rows = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
};

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

function groupKey(name) {
  return normalizeName(name).toLowerCase();
}

/**
 * Splits an "also_known_as" style cell into individual alias strings.
 * Data may separate multiple aliases with commas, slashes, or semicolons.
 */
function parseAliases(cell, primaryName) {
  if (!cell) return [];
  const primaryLower = primaryName.toLowerCase();
  return cell
    .split(/[,/;|]/)
    .map(a => a.trim())
    .filter(a => a.length > 0 && a.toLowerCase() !== primaryLower);
}

/**
 * Clusters a set of {lat, lng} points such that points within
 * MERGE_TOLERANCE_METERS of a cluster's running centroid join that
 * cluster, otherwise a new cluster is started. Returns an array of
 * clusters, each with its member point indices and centroid.
 */
function clusterPoints(points) {
  const clusters = [];
  points.forEach((point, idx) => {
    let bestCluster = null;
    let bestDist = Infinity;
    for (const cluster of clusters) {
      const dist = haversineMeters(point.lat, point.lng, cluster.centroidLat, cluster.centroidLng);
      if (dist < bestDist) {
        bestDist = dist;
        bestCluster = cluster;
      }
    }
    if (bestCluster && bestDist <= MERGE_TOLERANCE_METERS) {
      bestCluster.indices.push(idx);
      // Recompute centroid as running average.
      const n = bestCluster.indices.length;
      bestCluster.centroidLat = ((bestCluster.centroidLat * (n - 1)) + point.lat) / n;
      bestCluster.centroidLng = ((bestCluster.centroidLng * (n - 1)) + point.lng) / n;
    } else {
      clusters.push({ indices: [idx], centroidLat: point.lat, centroidLng: point.lng });
    }
  });
  return clusters;
}

const seed = async () => {
  const stats = {
    totalRows: 0,
    skippedRows: 0,
    warnings: [],
    stopsCreated: 0,
    routesCreated: 0,
    routesSkipped: 0
  };

  try {
    await connectDB();

    console.log('Clearing existing PBS data...');
    await Stop.deleteMany({ serviceType: 'pbs' });
    await Route.deleteMany({ serviceType: 'pbs' });

    console.log(`Reading CSV from ${CSV_PATH} ...`);
    const rawRows = await parseCSV(CSV_PATH);
    stats.totalRows = rawRows.length;
    console.log(`Read ${rawRows.length} rows from CSV`);

    // ---- Pass 1: parse + validate every row -------------------------------
    const validRows = [];
    rawRows.forEach((row, i) => {
      const lineNo = i + 2; // +1 for 0-index, +1 for header row
      const routeCodeRaw = (row.route_code || '').trim();
      const stopNameRaw = (row.stop_name || '').trim();
      const stopOrderRaw = (row.stop_order || '').trim();
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      const stopOrder = parseInt(stopOrderRaw, 10);

      if (!routeCodeRaw || !stopNameRaw) {
        stats.skippedRows++;
        stats.warnings.push(`Line ${lineNo}: missing route_code or stop_name - skipped`);
        return;
      }
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        stats.skippedRows++;
        stats.warnings.push(`Line ${lineNo}: invalid latitude/longitude for "${stopNameRaw}" - skipped`);
        return;
      }
      if (!isWithinKarachi(lat, lng)) {
        stats.skippedRows++;
        stats.warnings.push(`Line ${lineNo}: coordinates for "${stopNameRaw}" (${lat}, ${lng}) fall outside Karachi bounds - skipped`);
        return;
      }
      if (Number.isNaN(stopOrder)) {
        stats.skippedRows++;
        stats.warnings.push(`Line ${lineNo}: invalid stop_order for "${stopNameRaw}" - skipped`);
        return;
      }

      validRows.push({
        routeCode: routeCodeRaw,
        routeName: (row.route_name || '').trim(),
        routeType: (row.route_type || '').trim() || null,
        stopName: normalizeName(stopNameRaw),
        lat,
        lng,
        source: (row.source || '').trim() || 'original',
        aliasesRaw: row.also_known_as || '',
        stopOrder
      });
    });

    // ---- Pass 2: group rows by stop name, cluster by proximity ------------
    const byName = new Map(); // groupKey -> rows[]
    for (const row of validRows) {
      const key = groupKey(row.stopName);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(row);
    }

    // rowStopKey: assign each row a resolved, collision-free stop identity.
    const rowStopKey = new Map(); // row (by reference) -> resolved stop key
    const resolvedStops = new Map(); // resolved stop key -> { name, lat, lng, sources:Set, aliases:Set }

    for (const [, rows] of byName) {
      const points = rows.map(r => ({ lat: r.lat, lng: r.lng }));
      const clusters = clusterPoints(points);

      if (clusters.length > 1) {
        const distinctCoordPairs = new Set(points.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)).size;
        stats.warnings.push(
          `Stop name "${rows[0].stopName}" maps to ${clusters.length} distinct locations ` +
          `(${distinctCoordPairs} unique coordinate pairs seen, spread beyond ${MERGE_TOLERANCE_METERS}m) - ` +
          `split into separate stops instead of being silently merged.`
        );
      }

      clusters.forEach((cluster, clusterIdx) => {
        const clusterRows = cluster.indices.map(i => rows[i]);
        const baseName = rows[0].stopName;
        // Disambiguate only when there's more than one cluster for this name.
        const routeCodesInCluster = [...new Set(clusterRows.map(r => r.routeCode))];
        const finalName = clusters.length > 1
          ? `${baseName} (${routeCodesInCluster.join('/')})`
          : baseName;
        const resolvedKey = `${finalName}::pbs`;

        if (!resolvedStops.has(resolvedKey)) {
          resolvedStops.set(resolvedKey, {
            name: finalName,
            lat: cluster.centroidLat,
            lng: cluster.centroidLng,
            sources: new Set(),
            aliases: new Set()
          });
        }
        const entry = resolvedStops.get(resolvedKey);

        for (const r of clusterRows) {
          rowStopKey.set(r, resolvedKey);
          entry.sources.add(r.source);
          for (const alias of parseAliases(r.aliasesRaw, baseName)) {
            entry.aliases.add(alias);
          }
        }
      });
    }

    // ---- Create Stop documents ---------------------------------------------
    console.log(`Creating ${resolvedStops.size} unique stops...`);
    const createdStopIds = new Map(); // resolvedKey -> ObjectId

    for (const [resolvedKey, stopData] of resolvedStops) {
      const sourcesArr = [...stopData.sources];
      const coordinateConfidence = sourcesArr.length === 1 ? sourcesArr[0] : sourcesArr.join('+');

      try {
        const stop = await Stop.create({
          name: stopData.name,
          aliases: [...stopData.aliases],
          location: { type: 'Point', coordinates: [stopData.lng, stopData.lat] },
          serviceType: 'pbs',
          coordinateConfidence
        });
        createdStopIds.set(resolvedKey, stop._id);
        stats.stopsCreated++;
      } catch (err) {
        stats.warnings.push(`Failed to create stop "${stopData.name}": ${err.message}`);
      }
    }

    // ---- Build routes --------------------------------------------------------
    const routeMap = new Map(); // routeCode -> { displayName, routeType, stops: [{key, order}] }
    for (const row of validRows) {
      const resolvedKey = rowStopKey.get(row);
      if (!resolvedKey || !createdStopIds.has(resolvedKey)) continue; // stop failed to create

      if (!routeMap.has(row.routeCode)) {
        routeMap.set(row.routeCode, {
          displayName: `${row.routeCode} (${row.routeName})`,
          routeType: row.routeType,
          stops: []
        });
      }
      routeMap.get(row.routeCode).stops.push({ key: resolvedKey, order: row.stopOrder });
    }

    console.log(`Creating ${routeMap.size} routes...`);
    for (const [code, routeData] of routeMap) {
      // Stable-sort by stop_order; warn (but don't fail) on duplicate orders.
      const orders = routeData.stops.map(s => s.order);
      const duplicateOrders = orders.filter((o, i) => orders.indexOf(o) !== i);
      if (duplicateOrders.length > 0) {
        stats.warnings.push(`Route ${code}: duplicate stop_order value(s) [${[...new Set(duplicateOrders)].join(', ')}] - order preserved as-listed in CSV.`);
      }

      const orderedStopIds = routeData.stops
        .map((s, originalIndex) => ({ ...s, originalIndex }))
        .sort((a, b) => a.order - b.order || a.originalIndex - b.originalIndex)
        .map(s => createdStopIds.get(s.key))
        .filter(Boolean);

      if (orderedStopIds.length === 0) {
        stats.routesSkipped++;
        stats.warnings.push(`Route ${code}: no valid stops resolved - route skipped`);
        continue;
      }

      try {
        await Route.create({
          code: `pbs-${code}`,
          displayName: routeData.displayName,
          serviceType: 'pbs',
          routeType: routeData.routeType,
          orderedStops: orderedStopIds
        });
        stats.routesCreated++;
      } catch (err) {
        stats.routesSkipped++;
        stats.warnings.push(`Failed to create route "${code}": ${err.message}`);
      }
    }

    console.log('\n=== Seeding summary ===');
    console.log(`CSV rows read:      ${stats.totalRows}`);
    console.log(`CSV rows skipped:   ${stats.skippedRows}`);
    console.log(`Stops created:      ${stats.stopsCreated}`);
    console.log(`Routes created:     ${stats.routesCreated}`);
    console.log(`Routes skipped:     ${stats.routesSkipped}`);
    if (stats.warnings.length > 0) {
      console.log(`\nWarnings (${stats.warnings.length}):`);
      stats.warnings.forEach(w => console.log(`  - ${w}`));
    }
    console.log('\nSeeding complete!');
  } catch (error) {
    console.error('Seeding error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
};

if (require.main === module) {
  seed();
}

module.exports = { seed, haversineMeters, normalizeName, groupKey, parseAliases, clusterPoints };
