const express = require('express');
const { createCheckout, handleWebhook } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// NOTE: webhook must receive the raw body; that's configured in app.js before json parsing
router.post('/webhook', handleWebhook);
router.post('/checkout', protect, createCheckout);

module.exports = router;
