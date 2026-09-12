// Minimal in-memory stand-ins for the Mongoose Stop/Route models, used only
// for local end-to-end testing where a real MongoDB server isn't available.
// They implement just the subset of the Mongoose API that our route
// handlers actually call: find().lean(), find().populate().lean(),
// aggregate() (for $geoNear + $limit), and exists().

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

function makeFakeStopModel(stops) {
  return {
    __stops: stops,
    find(filter = {}) {
      const matched = stops.filter(s => (filter.serviceType ? s.serviceType === filter.serviceType : true));
      return {
        lean: async () => matched.map(s => ({ ...s }))
      };
    },
    async aggregate(pipeline) {
      const geoStage = pipeline.find(p => p.$geoNear);
      const limitStage = pipeline.find(p => p.$limit !== undefined);
      if (!geoStage) return [];
      const { near, query = {}, maxDistance } = geoStage.$geoNear;
      const [lng, lat] = near.coordinates;

      let candidates = stops.filter(s => (query.serviceType ? s.serviceType === query.serviceType : true));
      candidates = candidates.map(s => {
        const [sLng, sLat] = s.location.coordinates;
        return { ...s, distance: haversineMeters(lat, lng, sLat, sLng) };
      });
      if (maxDistance !== undefined) {
        candidates = candidates.filter(s => s.distance <= maxDistance);
      }
      candidates.sort((a, b) => a.distance - b.distance);
      if (limitStage) candidates = candidates.slice(0, limitStage.$limit);
      return candidates;
    },
    async exists(filter) {
      const found = stops.find(s =>
        String(s._id) === String(filter._id) &&
        (filter.serviceType ? s.serviceType === filter.serviceType : true)
      );
      return found ? { _id: found._id } : null;
    }
  };
}

function makeFakeRouteModel(routes, stopsById) {
  return {
    __routes: routes,
    find(filter = {}) {
      let matched = routes.filter(r => (filter.serviceType ? r.serviceType === filter.serviceType : true));
      if (filter.orderedStops && filter.orderedStops.$all) {
        const need = filter.orderedStops.$all.map(String);
        matched = matched.filter(r => {
          const ids = r.orderedStops.map(String);
          return need.every(id => ids.includes(id));
        });
      }
      let populateSelect = null;
      const chain = {
        populate(path, select) {
          populateSelect = select;
          return chain;
        },
        lean: async () => matched.map(r => {
          const populated = r.orderedStops.map(id => {
            const stop = stopsById.get(String(id));
            if (!populateSelect) return stop;
            const picked = { _id: stop._id };
            populateSelect.split(' ').forEach(field => { picked[field] = stop[field]; });
            return picked;
          });
          return { ...r, orderedStops: populated };
        })
      };
      return chain;
    }
  };
}

module.exports = { makeFakeStopModel, makeFakeRouteModel, haversineMeters };
