const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Location = require('../models/Location');

const updateProfile = asyncHandler(async (req, res) => {
  const { name, preferences } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { ...(name && { name }), ...(preferences && { preferences }) },
    { new: true, runValidators: true }
  );

  res.json({ user });
});

const addLocation = asyncHandler(async (req, res) => {
  const { name, lat, lon, country } = req.body;

  const location = await Location.create({ user: req.user._id, name, lat, lon, country });

  await User.findByIdAndUpdate(req.user._id, { $push: { savedLocations: location._id } });

  res.status(201).json({ location });
});

const getLocations = asyncHandler(async (req, res) => {
  const locations = await Location.find({ user: req.user._id });
  res.json({ locations });
});

const deleteLocation = asyncHandler(async (req, res) => {
  await Location.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  await User.findByIdAndUpdate(req.user._id, { $pull: { savedLocations: req.params.id } });
  res.json({ message: 'Location removed' });
});

module.exports = { updateProfile, addLocation, getLocations, deleteLocation };
