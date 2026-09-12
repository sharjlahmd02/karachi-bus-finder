const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  aliases: {
    type: [String],
    default: [],
    set: (arr) => Array.isArray(arr)
      ? [...new Set(arr.map(a => String(a).trim()).filter(Boolean))]
      : []
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function (coords) {
          if (!Array.isArray(coords) || coords.length !== 2) return false;
          const [lng, lat] = coords;
          return (
            typeof lng === 'number' && typeof lat === 'number' &&
            Number.isFinite(lng) && Number.isFinite(lat) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
          );
        },
        message: 'location.coordinates must be a valid [longitude, latitude] pair'
      }
    }
  },
  serviceType: {
    type: String,
    enum: ['pbs', 'local'],
    required: true,
    index: true
  },
  // NOTE: real-world data-source labels vary quite a bit (e.g. new labels
  // get appended over time, such as "geocoded_verified_added"). A hard
  // enum here previously caused the seed script to crash whenever an
  // unrecognized label appeared in the source CSV. We keep the field as a
  // free-form string so provenance information is never silently dropped
  // or allowed to crash the import; unknown values are simply preserved.
  coordinateConfidence: {
    type: String,
    trim: true,
    default: 'original'
  }
}, {
  timestamps: true
});

stopSchema.index({ location: '2dsphere' });
stopSchema.index({ name: 'text', aliases: 'text' });
// Prevent exact duplicate stops (same name + same service type) from being
// created twice, e.g. if the seed script is accidentally run twice without
// clearing first.
stopSchema.index({ name: 1, serviceType: 1 }, { unique: true });

module.exports = mongoose.model('Stop', stopSchema);
