const express = require('express');
const { listNotifications, readNotification } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', listNotifications);
router.patch('/:id/read', readNotification);

module.exports = router;
