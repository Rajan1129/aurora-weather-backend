const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    plan: { type: String, enum: ['free', 'premium'], default: 'free' },
    status: {
      type: String,
      enum: ['active', 'trialing', 'past_due', 'canceled', 'incomplete'],
      default: 'active',
    },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
