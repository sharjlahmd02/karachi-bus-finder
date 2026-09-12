const express = require('express');
const Fuse = require('fuse.js');
const Stop = require('../models/Stop');
const { checkServiceType, parseAndValidateCoords } = require('../middleware/validators');

const router = express.Router();

const MAX_QUERY_LENGTH = 100;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 25;
const MAX_NEARBY_LIMIT = 20;

/**
 * GET /api/stops/search?q=<text>&serviceType=<pbs|local>&limit=<n>
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q, serviceType } = req.query;

    const serviceTypeError = checkServiceType(serviceType);
    if (serviceTypeError) {
      return res.status(400).json({ error: serviceTypeError });
    }

    if (typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const query = q.trim();
    if (query.length > MAX_QUERY_LENGTH) {
      return res.status(400).json({ error: `Query parameter "q" must be at most ${MAX_QUERY_LENGTH} characters` });
    }

    let limit = DEFAULT_SEARCH_LIMIT;
    if (req.query.limit !== undefined) {
      const parsedLimit = parseInt(req.query.limit, 10);
      if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_SEARCH_LIMIT) {
        return res.status(400).json({ error: `limit must be an integer between 1 and ${MAX_SEARCH_LIMIT}` });
      }
      limit = parsedLimit;
    }

    const stops = await Stop.find({ serviceType }).lean();

    const fuse = new Fuse(stops, {
      keys: ['name', 'aliases'],
      threshold: 0.35,
      includeScore: true
    });

    const results = fuse.search(query).slice(0, limit).map(r => ({
      _id: r.item._id,
      name: r.item.name,
      location: r.item.location,
      matchScore: r.score
    }));

    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stops/nearest?lat=<n>&lng=<n>&serviceType=<pbs|local>&limit=<n>
 *
 * Both the given point and the returned stop(s) are guaranteed to be
 * within Karachi city bounds.
 *
 * Backwards compatible: without `limit`, behaves exactly as before and
 * returns a single nearest-stop object (or 404 if none found). Passing
 * `limit` returns the top N nearest stops as an array instead.
 */
router.get('/nearest', async (req, res, next) => {
  try {
    const { lat, lng, serviceType } = req.query;

    const serviceTypeError = checkServiceType(serviceType);
    if (serviceTypeError) {
      return res.status(400).json({ error: serviceTypeError });
    }

    const coordResult = parseAndValidateCoords(lat, lng, 'location');
    if (coordResult.error) {
      return res.status(400).json({ error: coordResult.error });
    }
    const { lat: latitude, lng: longitude } = coordResult;

    let maxDistanceMeters;
    if (req.query.maxDistanceMeters !== undefined) {
      const parsedMax = parseFloat(req.query.maxDistanceMeters);
      if (Number.isNaN(parsedMax) || parsedMax <= 0) {
        return res.status(400).json({ error: 'maxDistanceMeters must be a positive number' });
      }
      maxDistanceMeters = parsedMax;
    }

    let wantsMultiple = false;
    let limit = 1;
    if (req.query.limit !== undefined) {
      wantsMultiple = true;
      const parsedLimit = parseInt(req.query.limit, 10);
      if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_NEARBY_LIMIT) {
        return res.status(400).json({ error: `limit must be an integer between 1 and ${MAX_NEARBY_LIMIT}` });
      }
      limit = parsedLimit;
    }

    const geoNearStage = {
      near: { type: 'Point', coordinates: [longitude, latitude] },
      distanceField: 'distance',
      query: { serviceType },
      spherical: true
    };
    if (maxDistanceMeters !== undefined) {
      geoNearStage.maxDistance = maxDistanceMeters;
    }

    const nearestStops = await Stop.aggregate([
      { $geoNear: geoNearStage },
      { $limit: limit }
    ]);

    if (!nearestStops || nearestStops.length === 0) {
      return res.status(404).json({ error: 'No stops found for this service type within the given range' });
    }

    if (wantsMultiple) {
      return res.json(nearestStops);
    }
    res.json(nearestStops[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
