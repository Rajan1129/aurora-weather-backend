const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');
const { markAsRead } = require('../services/notificationService');

const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ notifications });
});

const readNotification = asyncHandler(async (req, res) => {
  const notification = await markAsRead(req.params.id, req.user._id);
  res.json({ notification });
});

module.exports = { listNotifications, readNotification };
