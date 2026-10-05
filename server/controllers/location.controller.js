const axios = require('axios');
const TaskLocation = require('../models/TaskLocation');

const searchLocation = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return sendError(res, 'Query parameter is required', 400);
    }
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q, format: 'json', addressdetails: 1, limit: 5 },
      headers: { 'User-Agent': 'SevaSetu-App' },
    });
    const locations = response.data.map((item) => ({
      display_name: item.display_name,
      lat: item.lat,
      lon: item.lon,
    }));
    return sendSuccess(res, locations);
  } catch (error) {
    return next(error);
  }
};

const saveLocation = async (req, res) => {
    try {
        const { name, address, latitude, longitude, radius } = req.body;
        const userId = req.userId;

        const loc = await TaskLocation.create({
            name,
            address,
            latitude: Number(latitude),
            longitude: Number(longitude),
            radius: radius != null ? Number(radius) : 200,
            createdBy: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Location saved successfully',
            data: { id: loc._id.toString() }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getLocations = async (req, res) => {
    try {
        const locations = await TaskLocation.find({ isDeleted: false }).sort({ createdAt: -1 });
        res.json({ success: true, data: locations });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { searchLocation, saveLocation, getLocations };
