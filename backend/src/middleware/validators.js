const mongoose = require('mongoose');
const { isWithinKarachi, KARACHI_BOUNDS } = require('../config/karachiBounds');

const VALID_SERVICE_TYPES = ['pbs', 'local'];

/**
 * Validates a serviceType value. Returns an error string, or null if valid.
 */
function checkServiceType(serviceType) {
  if (!serviceType || typeof serviceType !== 'string' || !VALID_SERVICE_TYPES.includes(serviceType)) {
    return `serviceType is required and must be one of: ${VALID_SERVICE_TYPES.join(', ')}`;
  }
  return null;
}

/**
 * Parses and validates a single lat/lng pair.
 * Returns { error } or { lat, lng } on success.
 * `label` is used to make error messages identify which point failed
 * (e.g. "pickup", "destination") when validating more than one point.
 */
function parseAndValidateCoords(rawLat, rawLng, label = 'location') {
  if (rawLat === undefined || rawLat === null || rawLat === '' ||
      rawLng === undefined || rawLng === null || rawLng === '') {
    return { error: `${label} latitude and longitude are required` };
  }

  const lat = typeof rawLat === 'number' ? rawLat : parseFloat(rawLat);
  const lng = typeof rawLng === 'number' ? rawLng : parseFloat(rawLng);

  if (typeof rawLat !== 'number' && !/^-?\d+(\.\d+)?$/.test(String(rawLat).trim())) {
    return { error: `${label} latitude must be a valid number` };
  }
  if (typeof rawLng !== 'number' && !/^-?\d+(\.\d+)?$/.test(String(rawLng).trim())) {
    return { error: `${label} longitude must be a valid number` };
  }

  if (Number.isNaN(lat) || Number.isNaN(lng) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: `${label} latitude and longitude must be valid numbers` };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: `${label} coordinates are out of range` };
  }

  if (!isWithinKarachi(lat, lng)) {
    return {
      error: `${label} coordinates must be within Karachi city ` +
        `(lat ${KARACHI_BOUNDS.minLat} to ${KARACHI_BOUNDS.maxLat}, ` +
        `lng ${KARACHI_BOUNDS.minLng} to ${KARACHI_BOUNDS.maxLng})`
    };
  }

  return { lat, lng };
}

/**
 * Express middleware: validates `serviceType` on req.query, attaches
 * nothing but rejects the request early with 400 if invalid.
 */
function requireServiceType(req, res, next) {
  const serviceType = req.query.serviceType || req.body?.serviceType;
  const error = checkServiceType(serviceType);
  if (error) {
    return res.status(400).json({ error });
  }
  next();
}

function isValidObjectId(id) {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

module.exports = {
  VALID_SERVICE_TYPES,
  checkServiceType,
  parseAndValidateCoords,
  requireServiceType,
  isValidObjectId
};
