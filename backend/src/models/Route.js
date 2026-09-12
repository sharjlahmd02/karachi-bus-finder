const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  serviceType: {
    type: String,
    enum: ['pbs', 'local'],
    required: true,
    index: true
  },
  // Optional descriptive category from the source data (e.g. "Pink Bus",
  // "BRT", "EV Bus", "regular"). Purely informational.
  routeType: {
    type: String,
    trim: true,
    default: null
  },
  orderedStops: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stop'
    }],
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length > 0,
      message: 'A route must contain at least one stop'
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Route', routeSchema);
