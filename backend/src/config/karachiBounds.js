/**
 * Approximate bounding box for Karachi city (with a safety buffer so
 * legitimate stops/searches near the city edge are not rejected).
 * Verified against the seeded stop dataset:
 *   latitude  range in data: 24.7975 - 25.0317
 *   longitude range in data: 66.8480 - 67.4613
 */
const KARACHI_BOUNDS = {
  minLat: 24.70,
  maxLat: 25.15,
  minLng: 66.60,
  maxLng: 67.60
};

/**
 * Returns true if the given lat/lng pair falls inside the Karachi
 * bounding box. Assumes lat/lng have already been checked for NaN.
 */
function isWithinKarachi(lat, lng) {
  return (
    lat >= KARACHI_BOUNDS.minLat &&
    lat <= KARACHI_BOUNDS.maxLat &&
    lng >= KARACHI_BOUNDS.minLng &&
    lng <= KARACHI_BOUNDS.maxLng
  );
}

module.exports = { KARACHI_BOUNDS, isWithinKarachi };
