const express = require('express');
const { chat, getConversations } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(protect);

router.post('/chat', aiLimiter, chat);
router.get('/conversations', getConversations);

module.exports = router;
