const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Analytics = require('../models/Analytics');

const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json({ users });
});

const getStats = asyncHandler(async (req, res) => {
  const [totalUsers, premiumUsers, eventsLast7Days] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ plan: 'premium' }),
    Analytics.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
  ]);

  res.json({ totalUsers, premiumUsers, eventsLast7Days });
});

module.exports = { listUsers, getStats };
