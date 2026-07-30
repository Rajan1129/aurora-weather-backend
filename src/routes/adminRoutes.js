const express = require('express');
const { listUsers, getStats } = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/users', listUsers);
router.get('/stats', getStats);

module.exports = router;
