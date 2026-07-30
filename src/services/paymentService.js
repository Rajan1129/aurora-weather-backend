const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const createCheckoutSession = async ({ userId, customerEmail, successUrl, cancelUrl }) =>
  stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: customerEmail,
    line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID, quantity: 1 }],
    metadata: { userId },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

const constructWebhookEvent = (payload, signature) =>
  stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);

module.exports = { stripe, createCheckoutSession, constructWebhookEvent };
