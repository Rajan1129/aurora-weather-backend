import { catchAsync, AppError } from '../middleware/errorHandler.js';
import { getWeatherService } from '../services/weatherService.js';
import { setCache, getCache } from '../config/redis.js';
import { logger } from '../utils/logger.js';

// @desc    Get current weather
// @route   GET /api/weather/current
export const getCurrentWeather = catchAsync(async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const locationKey = `${lat},${lng}`;
  
  // Check cache first
  const cacheKey = `weather:current:${locationKey}`;
  const cachedData = await getCache(cacheKey);
  
  if (cachedData) {
    return res.status(200).json({
      success: true,
      data: cachedData,
      source: 'cache',
    });
  }

  // Get weather data
  const weatherData = await getWeatherService().getCurrentWeather(
    parseFloat(lat),
    parseFloat(lng)
  );

  // Cache for 5 minutes
  await setCache(cacheKey, weatherData, 300);

  res.status(200).json({
    success: true,
    data: weatherData,
    source: 'api',
  });
});

// @desc    Get hourly forecast
// @route   GET /api/weather/hourly
export const getHourlyForecast = catchAsync(async (req, res) => {
  const { lat, lng, hours = 48 } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const locationKey = `${lat},${lng}`;
  const cacheKey = `weather:hourly:${locationKey}:${hours}`;
  
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.status(200).json({
      success: true,
      data: cachedData,
      source: 'cache',
    });
  }

  const forecastData = await getWeatherService().getHourlyForecast(
    parseFloat(lat),
    parseFloat(lng),
    parseInt(hours)
  );

  await setCache(cacheKey, forecastData, 900); // 15 minutes

  res.status(200).json({
    success: true,
    data: forecastData,
    source: 'api',
  });
});

// @desc    Get daily forecast
// @route   GET /api/weather/daily
export const getDailyForecast = catchAsync(async (req, res) => {
  const { lat, lng, days = 7 } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const locationKey = `${lat},${lng}`;
  const cacheKey = `weather:daily:${locationKey}:${days}`;
  
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.status(200).json({
      success: true,
      data: cachedData,
      source: 'cache',
    });
  }

  const forecastData = await getWeatherService().getDailyForecast(
    parseFloat(lat),
    parseFloat(lng),
    parseInt(days)
  );

  await setCache(cacheKey, forecastData, 3600); // 1 hour

  res.status(200).json({
    success: true,
    data: forecastData,
    source: 'api',
  });
});

// @desc    Get minutely forecast
// @route   GET /api/weather/minutely
export const getMinutelyForecast = catchAsync(async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const minutelyData = await getWeatherService().getMinutelyForecast(
    parseFloat(lat),
    parseFloat(lng)
  );

  res.status(200).json({
    success: true,
    data: minutelyData,
  });
});

// @desc    Get air quality
// @route   GET /api/weather/air-quality
export const getAirQuality = catchAsync(async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const locationKey = `${lat},${lng}`;
  const cacheKey = `weather:airquality:${locationKey}`;
  
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.status(200).json({
      success: true,
      data: cachedData,
      source: 'cache',
    });
  }

  const airQualityData = await getWeatherService().getAirQuality(
    parseFloat(lat),
    parseFloat(lng)
  );

  await setCache(cacheKey, airQualityData, 1800); // 30 minutes

  res.status(200).json({
    success: true,
    data: airQualityData,
    source: 'api',
  });
});

// @desc    Get weather alerts
// @route   GET /api/weather/alerts
export const getWeatherAlerts = catchAsync(async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const alerts = await getWeatherService().getAlerts(
    parseFloat(lat),
    parseFloat(lng)
  );

  res.status(200).json({
    success: true,
    data: alerts,
  });
});

// @desc    Get astronomy data
// @route   GET /api/weather/astronomy
export const getAstronomyData = catchAsync(async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const locationKey = `${lat},${lng}`;
  const cacheKey = `weather:astronomy:${locationKey}`;
  
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.status(200).json({
      success: true,
      data: cachedData,
      source: 'cache',
    });
  }

  const astronomyData = await getWeatherService().getAstronomy(
    parseFloat(lat),
    parseFloat(lng)
  );

  await setCache(cacheKey, astronomyData, 86400); // 24 hours

  res.status(200).json({
    success: true,
    data: astronomyData,
    source: 'api',
  });
});

// @desc    Get weather history
// @route   GET /api/weather/history
export const getWeatherHistory = catchAsync(async (req, res) => {
  const { lat, lng, days = 7 } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const historyData = await getWeatherService().getHistory(
    parseFloat(lat),
    parseFloat(lng),
    parseInt(days)
  );

  res.status(200).json({
    success: true,
    data: historyData,
  });
});

// @desc    Get weather maps
// @route   GET /api/weather/maps
export const getWeatherMaps = catchAsync(async (req, res) => {
  const { lat, lng, zoom = 5, layer = 'precipitation' } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const mapData = await getWeatherService().getMaps(
    parseFloat(lat),
    parseFloat(lng),
    parseInt(zoom),
    layer
  );

  res.status(200).json({
    success: true,
    data: mapData,
  });
});

// @desc    Get saved locations weather
// @route   GET /api/weather/saved
export const getSavedLocationsWeather = catchAsync(async (req, res) => {
  const userId = req.userId;
  
  // Get user's saved locations
  const locations = await getWeatherService().getSavedLocations(userId);
  
  // Get weather for each location
  const weatherData = await Promise.all(
    locations.map(async (location) => {
      const weather = await getWeatherService().getCurrentWeather(
        location.lat,
        location.lng
      );
      return {
        location,
        weather,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: weatherData,
  });
});