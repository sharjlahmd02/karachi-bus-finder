const express = require('express');
const Route = require('../models/Route');
const Stop = require('../models/Stop');
const { checkServiceType, parseAndValidateCoords, isValidObjectId } = require('../middleware/validators');

const router = express.Router();

/**
 * POST /api/routes/match
 * Body: { pickupStopId, destinationStopId, serviceType }
 */
router.post('/match', async (req, res, next) => {
  try {
    const { pickupStopId, destinationStopId, serviceType } = req.body || {};

    const serviceTypeError = checkServiceType(serviceType);
    if (serviceTypeError) {
      return res.status(400).json({ error: serviceTypeError });
    }

    if (!pickupStopId || !destinationStopId) {
      return res.status(400).json({ error: 'pickupStopId and destinationStopId are required' });
    }

    if (!isValidObjectId(pickupStopId) || !isValidObjectId(destinationStopId)) {
      return res.status(400).json({ error: 'pickupStopId and destinationStopId must be valid stop identifiers' });
    }

    if (pickupStopId === destinationStopId) {
      return res.status(400).json({ error: 'Pickup and destination must be different stops' });
    }

    const [pickupExists, destinationExists] = await Promise.all([
      Stop.exists({ _id: pickupStopId, serviceType }),
      Stop.exists({ _id: destinationStopId, serviceType })
    ]);
    if (!pickupExists || !destinationExists) {
      return res.status(404).json({ error: 'One or both stops were not found for this service type' });
    }

    const routes = await Route.find({
      serviceType,
      orderedStops: { $all: [pickupStopId, destinationStopId] }
    }).populate('orderedStops', 'name location').lean();

    const results = routes.map(route => {
      const pickupIndex = route.orderedStops.findIndex(
        s => s._id.toString() === pickupStopId
      );
      const destinationIndex = route.orderedStops.findIndex(
        s => s._id.toString() === destinationStopId
      );

      return {
        code: route.code,
        displayName: route.displayName,
        serviceType: route.serviceType,
        direction: pickupIndex < destinationIndex ? 'forward' : 'reverse',
        nearestStop: route.orderedStops[pickupIndex],
        destinationStop: route.orderedStops[destinationIndex],
        orderedStops: route.orderedStops.map(stop => ({
          _id: stop._id,
          name: stop.name
        }))
      };
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * Finds the single true-nearest stop of a given serviceType to a point,
 * searching the *entire* Stop collection (not just stops referenced by
 * some route). This is what /api/stops/nearest already does correctly;
 * match-by-coords previously reimplemented this by only scanning stops
 * attached to routes, which could return a stop that was NOT actually
 * the closest one (e.g. when a genuinely nearer stop wasn't part of any
 * route, or when route data didn't cover every stop in the dataset).
 */
async function findTrueNearestStop(serviceType, lat, lng) {
  const [nearest] = await Stop.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distance',
        query: { serviceType },
        spherical: true
      }
    },
    { $limit: 1 }
  ]);
  return nearest || null;
}

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

/**
 * POST /api/routes/match-by-coords
 * Body: { pickupLat, pickupLng, destinationLat, destinationLng, serviceType }
 *
 * Both pickup and destination must fall within Karachi city bounds.
 */
router.post('/match-by-coords', async (req, res, next) => {
  try {
    const { pickupLat, pickupLng, destinationLat, destinationLng, serviceType } = req.body || {};

    const serviceTypeError = checkServiceType(serviceType);
    if (serviceTypeError) {
      return res.status(400).json({ error: serviceTypeError });
    }

    const pickup = parseAndValidateCoords(pickupLat, pickupLng, 'pickup');
    if (pickup.error) {
      return res.status(400).json({ error: pickup.error });
    }
    const destination = parseAndValidateCoords(destinationLat, destinationLng, 'destination');
    if (destination.error) {
      return res.status(400).json({ error: destination.error });
    }

    // FIX: compute the true globally-nearest stop for each point directly
    // from the Stop collection via $geoNear, instead of only considering
    // stops that happen to be referenced inside a Route document. This is
    // the source of the "wrong nearest stop" bug.
    const [pickupStop, destinationStop] = await Promise.all([
      findTrueNearestStop(serviceType, pickup.lat, pickup.lng),
      findTrueNearestStop(serviceType, destination.lat, destination.lng)
    ]);

    if (!pickupStop || !destinationStop) {
      return res.status(404).json({ error: 'No stops found for this service type' });
    }

    const routes = await Route.find({ serviceType })
      .populate('orderedStops', 'name location')
      .lean();

    const results = routes.map(route => {
      if (!route.orderedStops || route.orderedStops.length === 0) return null;

      let bestPickup = null;
      let bestPickupDistance = Infinity;
      let bestDest = null;
      let bestDestDistance = Infinity;

      for (const stop of route.orderedStops) {
        if (!stop.location || !Array.isArray(stop.location.coordinates) || stop.location.coordinates.length !== 2) continue;
        const [stopLng, stopLat] = stop.location.coordinates;

        const pickupDist = haversineMeters(pickup.lat, pickup.lng, stopLat, stopLng);
        if (pickupDist < bestPickupDistance) {
          bestPickup = stop;
          bestPickupDistance = pickupDist;
        }

        const destDist = haversineMeters(destination.lat, destination.lng, stopLat, stopLng);
        if (destDist < bestDestDistance) {
          bestDest = stop;
          bestDestDistance = destDist;
        }
      }

      if (!bestPickup || !bestDest) return null;
      if (bestPickup._id.toString() === bestDest._id.toString()) return null;

      return {
        code: route.code,
        displayName: route.displayName,
        serviceType: route.serviceType,
        nearestStop: {
          _id: bestPickup._id,
          name: bestPickup.name,
          location: bestPickup.location
        },
        nearestStopDistance: bestPickupDistance,
        destinationStop: {
          _id: bestDest._id,
          name: bestDest.name,
          location: bestDest.location
        },
        destinationStopDistance: bestDestDistance,
        orderedStops: route.orderedStops.map(stop => ({
          _id: stop._id,
          name: stop.name
        }))
      };
    }).filter(Boolean);

    results.sort((a, b) =>
      (a.nearestStopDistance + a.destinationStopDistance) -
      (b.nearestStopDistance + b.destinationStopDistance)
    );

    res.json({
      routes: results,
      pickupStop: {
        _id: pickupStop._id,
        name: pickupStop.name,
        location: pickupStop.location,
        distance: pickupStop.distance
      },
      destinationStop: {
        _id: destinationStop._id,
        name: destinationStop.name,
        location: destinationStop.location,
        distance: destinationStop.distance
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
