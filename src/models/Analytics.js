const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    event: { type: String, required: true },
    properties: { type: mongoose.Schema.Types.Mixed },
    sessionId: { type: String },
  },
  { timestamps: true }
);

analyticsSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
