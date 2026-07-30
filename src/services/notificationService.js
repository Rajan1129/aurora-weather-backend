const Notification = require('../models/Notification');

const createNotification = async ({ userId, type, title, body, metadata }) =>
  Notification.create({ user: userId, type, title, body, metadata });

const getUnreadCount = async (userId) => Notification.countDocuments({ user: userId, read: false });

const markAsRead = async (notificationId, userId) =>
  Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { read: true },
    { new: true }
  );

module.exports = { createNotification, getUnreadCount, markAsRead };
