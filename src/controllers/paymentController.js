const asyncHandler = require('express-async-handler');
const Subscription = require('../models/Subscription');
const {
  createCheckoutSession,
  constructWebhookEvent,
} = require('../services/paymentService');

const createCheckout = asyncHandler(async (req, res) => {
  const session = await createCheckoutSession({
    userId: req.user._id.toString(),
    customerEmail: req.user.email,
    successUrl: `${process.env.CLIENT_URL}/premium?success=true`,
    cancelUrl: `${process.env.CLIENT_URL}/premium?canceled=true`,
  });

  res.json({ url: session.url });
});

const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const event = constructWebhookEvent(req.body, signature);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      await Subscription.findOneAndUpdate(
        { user: session.metadata.userId },
        { plan: 'premium', status: 'active', stripeCustomerId: session.customer },
        { upsert: true }
      );
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await Subscription.findOneAndUpdate(
        { stripeCustomerId: sub.customer },
        { plan: 'free', status: 'canceled' }
      );
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
});

module.exports = { createCheckout, handleWebhook };
