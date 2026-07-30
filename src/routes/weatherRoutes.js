import express from 'express';
import {
  getCurrentWeather,
  getHourlyForecast,
  getDailyForecast,
  getMinutelyForecast,
  getAirQuality,
  getWeatherAlerts,
  getAstronomyData,
  getWeatherHistory,
  getWeatherMaps,
} from '../controllers/weatherController.js';
import { protect } from '../middleware/auth.js';
import { apiRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public weather routes (with rate limiting)
router.get('/current', apiRateLimiter, getCurrentWeather);
router.get('/hourly', apiRateLimiter, getHourlyForecast);
router.get('/daily', apiRateLimiter, getDailyForecast);
router.get('/minutely', apiRateLimiter, getMinutelyForecast);
router.get('/air-quality', apiRateLimiter, getAirQuality);
router.get('/alerts', apiRateLimiter, getWeatherAlerts);
router.get('/astronomy', apiRateLimiter, getAstronomyData);
router.get('/history', apiRateLimiter, getWeatherHistory);
router.get('/maps', apiRateLimiter, getWeatherMaps);

// Protected routes (with user-specific data)
router.get('/saved', protect, getSavedLocationsWeather);

export default router;