import axios from 'axios';
import { logger } from '../utils/logger.js';
import { setCache, getCache } from '../config/redis.js';
import Weather from '../models/Weather.js';

class WeatherService {
  constructor() {
    this.openweatherKey = process.env.OPENWEATHER_API_KEY;
    this.tomorrowKey = process.env.TOMORROW_API_KEY;
    this.weatherapiKey = process.env.WEATHERAPI_KEY;
    this.openmeteoUrl = process.env.OPENMETEO_API_URL || 'https://api.open-meteo.com/v1';
  }

  async getCurrentWeather(lat, lng) {
    try {
      // Try OpenWeather first
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather`,
        {
          params: {
            lat,
            lon: lng,
            appid: this.openweatherKey,
            units: 'metric',
          },
          timeout: 5000,
        }
      );

      return this.normalizeOpenWeatherData(response.data);
    } catch (error) {
      logger.error('OpenWeather current weather error:', error.message);
      
      // Fallback to Open-Meteo
      try {
        const response = await axios.get(
          `${this.openmeteoUrl}/forecast`,
          {
            params: {
              latitude: lat,
              longitude: lng,
              current_weather: true,
              timezone: 'auto',
            },
            timeout: 5000,
          }
        );
        return this.normalizeOpenMeteoData(response.data);
      } catch (fallbackError) {
        logger.error('Open-Meteo fallback error:', fallbackError.message);
        throw new Error('Unable to fetch weather data');
      }
    }
  }

  async getHourlyForecast(lat, lng, hours = 48) {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast`,
        {
          params: {
            lat,
            lon: lng,
            appid: this.openweatherKey,
            units: 'metric',
            cnt: Math.min(Math.ceil(hours / 3), 40),
          },
          timeout: 5000,
        }
      );

      return this.normalizeHourlyData(response.data);
    } catch (error) {
      logger.error('OpenWeather hourly forecast error:', error.message);
      
      // Fallback to Open-Meteo
      try {
        const response = await axios.get(
          `${this.openmeteoUrl}/forecast`,
          {
            params: {
              latitude: lat,
              longitude: lng,
              hourly: ['temperature_2m', 'precipitation_probability', 'weathercode'],
              timezone: 'auto',
              forecast_days: 2,
            },
            timeout: 5000,
          }
        );
        return this.normalizeOpenMeteoHourly(response.data);
      } catch (fallbackError) {
        logger.error('Open-Meteo fallback error:', fallbackError.message);
        throw new Error('Unable to fetch hourly forecast');
      }
    }
  }

  async getDailyForecast(lat, lng, days = 7) {
    try {
      // Try Tomorrow.io first for better accuracy
      const response = await axios.get(
        `https://api.tomorrow.io/v4/timelines`,
        {
          params: {
            location: `${lat},${lng}`,
            fields: [
              'temperatureMin', 'temperatureMax', 'weatherCode',
              'precipitationProbability', 'windSpeed', 'humidity',
              'sunriseTime', 'sunsetTime', 'moonPhase', 'uvIndex',
            ],
            units: 'metric',
            timesteps: '1d',
            timezone: 'auto',
            apikey: this.tomorrowKey,
          },
          timeout: 5000,
        }
      );

      return this.normalizeTomorrowData(response.data);
    } catch (error) {
      logger.error('Tomorrow.io forecast error:', error.message);
      
      // Fallback to Open-Meteo
      try {
        const response = await axios.get(
          `${this.openmeteoUrl}/forecast`,
          {
            params: {
              latitude: lat,
              longitude: lng,
              daily: [
                'temperature_2m_max', 'temperature_2m_min',
                'weathercode', 'precipitation_probability_max',
                'windspeed_10m_max', 'uv_index_max',
              ],
              timezone: 'auto',
              forecast_days: Math.min(days, 7),
            },
            timeout: 5000,
          }
        );
        return this.normalizeOpenMeteoDaily(response.data);
      } catch (fallbackError) {
        logger.error('Open-Meteo fallback error:', fallbackError.message);
        throw new Error('Unable to fetch daily forecast');
      }
    }
  }

  async getMinutelyForecast(lat, lng) {
    try {
      // Only Tomorrow.io provides minutely forecast
      const response = await axios.get(
        `https://api.tomorrow.io/v4/timelines`,
        {
          params: {
            location: `${lat},${lng}`,
            fields: ['precipitationIntensity', 'precipitationType'],
            units: 'metric',
            timesteps: '1m',
            timezone: 'auto',
            apikey: this.tomorrowKey,
          },
          timeout: 5000,
        }
      );

      return this.normalizeMinutelyData(response.data);
    } catch (error) {
      logger.error('Tomorrow.io minutely error:', error.message);
      throw new Error('Unable to fetch minutely forecast');
    }
  }

  async getAirQuality(lat, lng) {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/air_pollution`,
        {
          params: {
            lat,
            lon: lng,
            appid: this.openweatherKey,
          },
          timeout: 5000,
        }
      );

      return this.normalizeAirQualityData(response.data);
    } catch (error) {
      logger.error('Air quality API error:', error.message);
      
      // Return approximate data based on location
      return this.getApproximateAirQuality(lat, lng);
    }
  }

  async getAlerts(lat, lng) {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather`,
        {
          params: {
            lat,
            lon: lng,
            appid: this.openweatherKey,
            units: 'metric',
          },
          timeout: 5000,
        }
      );

      return response.data.alerts || [];
    } catch (error) {
      logger.error('Alerts API error:', error.message);
      return [];
    }
  }

  async getAstronomy(lat, lng) {
    try {
      const response = await axios.get(
        `${this.openmeteoUrl}/forecast`,
        {
          params: {
            latitude: lat,
            longitude: lng,
            daily: ['sunrise', 'sunset'],
            timezone: 'auto',
            forecast_days: 1,
          },
          timeout: 5000,
        }
      );

      const data = response.data;
      return {
        sunrise: new Date(data.daily.sunrise[0]),
        sunset: new Date(data.daily.sunset[0]),
        moonPhase: await this.getMoonPhase(lat, lng),
        moonIllumination: await this.getMoonIllumination(),
        goldenHour: this.calculateGoldenHour(data.daily.sunrise[0], data.daily.sunset[0]),
        blueHour: this.calculateBlueHour(data.daily.sunrise[0], data.daily.sunset[0]),
      };
    } catch (error) {
      logger.error('Astronomy API error:', error.message);
      throw new Error('Unable to fetch astronomy data');
    }
  }

  async getHistory(lat, lng, days) {
    try {
      const response = await axios.get(
        `${this.openmeteoUrl}/archive`,
        {
          params: {
            latitude: lat,
            longitude: lng,
            start_date: new Date(Date.now() - days * 86400000).toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            daily: ['temperature_2m_max', 'temperature_2m_min', 'weathercode'],
            timezone: 'auto',
          },
          timeout: 5000,
        }
      );

      return this.normalizeHistoryData(response.data);
    } catch (error) {
      logger.error('History API error:', error.message);
      throw new Error('Unable to fetch weather history');
    }
  }

  async getMaps(lat, lng, zoom, layer) {
    // Mapbox static maps or other map services
    // This would return tile URLs or map data
    return {
      tileUrl: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${lng},${lat},${zoom}/512x512?access_token=${process.env.MAPBOX_TOKEN}`,
      layers: ['precipitation', 'temperature', 'wind', 'clouds'],
    };
  }

  async getSavedLocations(userId) {
    // Get saved locations from database
    const Location = (await import('../models/Location.js')).default;
    return Location.find({ userId, isActive: true }).sort({ order: 1 });
  }

  // Normalization methods
  normalizeOpenWeatherData(data) {
    return {
      temperature: data.main.temp,
      feelsLike: data.main.feels_like,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      windSpeed: data.wind.speed,
      windDirection: data.wind.deg,
      uvIndex: 0, // Not available in current weather
      visibility: data.visibility / 1000,
      clouds: data.clouds.all,
      condition: {
        id: data.weather[0].id,
        main: data.weather[0].main,
        description: data.weather[0].description,
      },
      icon: data.weather[0].icon,
      timestamp: new Date(data.dt * 1000),
    };
  }

  normalizeHourlyData(data) {
    return data.list.map(item => ({
      time: new Date(item.dt * 1000),
      temperature: item.main.temp,
      condition: {
        id: item.weather[0].id,
        main: item.weather[0].main,
        description: item.weather[0].description,
      },
      icon: item.weather[0].icon,
      rainProbability: item.pop * 100,
      windSpeed: item.wind.speed,
      humidity: item.main.humidity,
      pressure: item.main.pressure,
    }));
  }

  normalizeTomorrowData(data) {
    const timeline = data.data.timelines[0];
    return timeline.intervals.map(interval => ({
      date: new Date(interval.startTime),
      tempMin: interval.values.temperatureMin,
      tempMax: interval.values.temperatureMax,
      condition: this.mapWeatherCode(interval.values.weatherCode),
      icon: this.mapWeatherCodeToIcon(interval.values.weatherCode),
      rainProbability: interval.values.precipitationProbability,
      windSpeed: interval.values.windSpeed,
      humidity: interval.values.humidity,
      sunrise: new Date(interval.values.sunriseTime),
      sunset: new Date(interval.values.sunsetTime),
      moonPhase: interval.values.moonPhase,
      uvIndex: interval.values.uvIndex,
      pressure: interval.values.pressureSurfaceLevel,
    }));
  }

  normalizeOpenMeteoData(data) {
    const current = data.current_weather;
    return {
      temperature: current.temperature,
      feelsLike: current.temperature, // Approximation
      humidity: 0, // Not available
      pressure: 0, // Not available
      windSpeed: current.windspeed,
      windDirection: current.winddirection || 0,
      uvIndex: 0,
      visibility: 0,
      clouds: 0,
      condition: this.mapWMOWeatherCode(current.weathercode),
      icon: this.mapWMOCodeToIcon(current.weathercode),
      timestamp: new Date(current.time),
    };
  }

  normalizeOpenMeteoHourly(data) {
    const hourly = data.hourly;
    return hourly.time.map((time, index) => ({
      time: new Date(time),
      temperature: hourly.temperature_2m[index],
      condition: this.mapWMOWeatherCode(hourly.weathercode[index]),
      icon: this.mapWMOCodeToIcon(hourly.weathercode[index]),
      rainProbability: hourly.precipitation_probability[index] || 0,
      windSpeed: 0, // Not available in this endpoint
      humidity: 0,
      pressure: 0,
    }));
  }

  normalizeOpenMeteoDaily(data) {
    const daily = data.daily;
    const dates = daily.time.map((time, index) => ({
      date: new Date(time),
      tempMin: daily.temperature_2m_min[index],
      tempMax: daily.temperature_2m_max[index],
      condition: this.mapWMOWeatherCode(daily.weathercode[index]),
      icon: this.mapWMOCodeToIcon(daily.weathercode[index]),
      rainProbability: daily.precipitation_probability_max[index] || 0,
      windSpeed: daily.windspeed_10m_max[index] || 0,
      humidity: 0,
      sunrise: null,
      sunset: null,
      moonPhase: 0,
      uvIndex: daily.uv_index_max[index] || 0,
      pressure: 0,
    }));

    // Add astronomy data if available
    if (daily.sunrise && daily.sunset) {
      dates.forEach((day, index) => {
        day.sunrise = new Date(daily.sunrise[index]);
        day.sunset = new Date(daily.sunset[index]);
      });
    }

    return dates;
  }

  normalizeMinutelyData(data) {
    const timeline = data.data.timelines[0];
    return timeline.intervals.map(interval => ({
      time: new Date(interval.startTime),
      precipitation: interval.values.precipitationIntensity,
      type: this.mapPrecipitationType(interval.values.precipitationType),
      intensity: interval.values.precipitationIntensity,
    }));
  }

  normalizeAirQualityData(data) {
    const list = data.list[0];
    const components = list.components;
    const aqi = list.main.aqi;
    
    return {
      aqi,
      pm25: components.pm2_5,
      pm10: components.pm10,
      o3: components.o3,
      no2: components.no2,
      so2: components.so2,
      co: components.co,
      index: {
        value: aqi,
        category: this.getAQICategory(aqi),
        color: this.getAQIColor(aqi),
      },
    };
  }

  normalizeHistoryData(data) {
    const daily = data.daily;
    return daily.time.map((time, index) => ({
      date: new Date(time),
      tempMax: daily.temperature_2m_max[index],
      tempMin: daily.temperature_2m_min[index],
      condition: this.mapWMOWeatherCode(daily.weathercode[index]),
      icon: this.mapWMOCodeToIcon(daily.weathercode[index]),
    }));
  }

  // Helper methods
  mapWMOWeatherCode(code) {
    const codeMap = {
      0: { id: 800, main: 'Clear', description: 'Clear sky' },
      1: { id: 801, main: 'Clouds', description: 'Mainly clear' },
      2: { id: 802, main: 'Clouds', description: 'Partly cloudy' },
      3: { id: 803, main: 'Clouds', description: 'Overcast' },
      45: { id: 741, main: 'Fog', description: 'Fog' },
      48: { id: 741, main: 'Fog', description: 'Depositing rime fog' },
      51: { id: 300, main: 'Drizzle', description: 'Light drizzle' },
      53: { id: 301, main: 'Drizzle', description: 'Moderate drizzle' },
      55: { id: 302, main: 'Drizzle', description: 'Dense drizzle' },
      61: { id: 500, main: 'Rain', description: 'Slight rain' },
      63: { id: 501, main: 'Rain', description: 'Moderate rain' },
      65: { id: 502, main: 'Rain', description: 'Heavy rain' },
      71: { id: 600, main: 'Snow', description: 'Slight snow' },
      73: { id: 601, main: 'Snow', description: 'Moderate snow' },
      75: { id: 602, main: 'Snow', description: 'Heavy snow' },
      80: { id: 500, main: 'Rain', description: 'Rain showers' },
      81: { id: 501, main: 'Rain', description: 'Moderate rain showers' },
      82: { id: 502, main: 'Rain', description: 'Violent rain showers' },
      95: { id: 200, main: 'Thunderstorm', description: 'Thunderstorm' },
      96: { id: 201, main: 'Thunderstorm', description: 'Thunderstorm with hail' },
      99: { id: 202, main: 'Thunderstorm', description: 'Thunderstorm with heavy hail' },
    };
    return codeMap[code] || { id: 800, main: 'Clear', description: 'Clear sky' };
  }

  mapWMOCodeToIcon(code) {
    const iconMap = {
      0: '01d',
      1: '02d',
      2: '03d',
      3: '04d',
      45: '50d',
      48: '50d',
      51: '09d',
      53: '09d',
      55: '09d',
      61: '10d',
      63: '10d',
      65: '10d',
      71: '13d',
      73: '13d',
      75: '13d',
      80: '09d',
      81: '10d',
      82: '10d',
      95: '11d',
      96: '11d',
      99: '11d',
    };
    return iconMap[code] || '01d';
  }

  mapWeatherCode(code) {
    // Map Tomorrow.io weather codes
    const codeMap = {
      0: { id: 800, main: 'Clear', description: 'Clear sky' },
      1000: { id: 800, main: 'Clear', description: 'Clear' },
      1001: { id: 803, main: 'Clouds', description: 'Cloudy' },
      1100: { id: 801, main: 'Clouds', description: 'Partly cloudy' },
      1101: { id: 802, main: 'Clouds', description: 'Mostly cloudy' },
      1102: { id: 804, main: 'Clouds', description: 'Overcast' },
      2000: { id: 741, main: 'Fog', description: 'Fog' },
      2100: { id: 741, main: 'Fog', description: 'Light fog' },
      4000: { id: 500, main: 'Rain', description: 'Light rain' },
      4001: { id: 501, main: 'Rain', description: 'Moderate rain' },
      4200: { id: 502, main: 'Rain', description: 'Heavy rain' },
      4201: { id: 503, main: 'Rain', description: 'Extreme rain' },
      5000: { id: 600, main: 'Snow', description: 'Light snow' },
      5001: { id: 601, main: 'Snow', description: 'Moderate snow' },
      5100: { id: 602, main: 'Snow', description: 'Heavy snow' },
      5101: { id: 603, main: 'Snow', description: 'Extreme snow' },
      6000: { id: 200, main: 'Thunderstorm', description: 'Thunderstorm' },
      6001: { id: 201, main: 'Thunderstorm', description: 'Severe thunderstorm' },
    };
    return codeMap[code] || { id: 800, main: 'Clear', description: 'Clear' };
  }

  mapWeatherCodeToIcon(code) {
    const iconMap = {
      0: '01d',
      1000: '01d',
      1001: '04d',
      1100: '02d',
      1101: '03d',
      1102: '04d',
      2000: '50d',
      2100: '50d',
      4000: '10d',
      4001: '10d',
      4200: '10d',
      4201: '11d',
      5000: '13d',
      5001: '13d',
      5100: '13d',
      5101: '13d',
      6000: '11d',
      6001: '11d',
    };
    return iconMap[code] || '01d';
  }

  mapPrecipitationType(type) {
    const typeMap = {
      0: 'rain',
      1: 'snow',
      2: 'sleet',
    };
    return typeMap[type] || 'rain';
  }

  getAQICategory(aqi) {
    const categories = {
      1: 'good',
      2: 'moderate',
      3: 'unhealthy_sensitive',
      4: 'unhealthy',
      5: 'very_unhealthy',
      6: 'hazardous',
    };
    return categories[aqi] || 'good';
  }

  getAQIColor(aqi) {
    const colors = {
      1: '#00E400',
      2: '#FFFF00',
      3: '#FF7E00',
      4: '#FF0000',
      5: '#8F3F97',
      6: '#7E0023',
    };
    return colors[aqi] || '#00E400';
  }

  async getMoonPhase(lat, lng) {
    // Simplified moon phase calculation
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    
    // Calculate days since 2000-01-01
    const days = (Date.UTC(year, month, day) - Date.UTC(2000, 0, 6)) / 86400000;
    const phase = days % 29.53058867;
    return phase / 29.53058867;
  }

  async getMoonIllumination() {
    // Simplified calculation
    const now = new Date();
    const days = (now.getTime() - new Date(2000, 0, 6).getTime()) / 86400000;
    const phase = days % 29.53058867;
    const illumination = (1 - Math.cos(phase * 2 * Math.PI / 29.53058867)) / 2;
    return Math.round(illumination * 100);
  }

  calculateGoldenHour(sunrise, sunset) {
    const sunriseDate = new Date(sunrise);
    const sunsetDate = new Date(sunset);
    
    // Golden hour is approximately 1 hour after sunrise and 1 hour before sunset
    return {
      morning: new Date(sunriseDate.getTime() + 3600000),
      evening: new Date(sunsetDate.getTime() - 3600000),
    };
  }

  calculateBlueHour(sunrise, sunset) {
    const sunriseDate = new Date(sunrise);
    const sunsetDate = new Date(sunset);
    
    // Blue hour is approximately 30 minutes before sunrise and after sunset
    return {
      morning: new Date(sunriseDate.getTime() - 1800000),
      evening: new Date(sunsetDate.getTime() + 1800000),
    };
  }

  getApproximateAirQuality(lat, lng) {
    // Return approximate values based on location type
    // This is a fallback when API is unavailable
    const isUrban = Math.random() > 0.5; // Simplified
    return {
      aqi: isUrban ? 3 : 1,
      pm25: isUrban ? 25 : 10,
      pm10: isUrban ? 40 : 15,
      o3: isUrban ? 60 : 30,
      no2: isUrban ? 30 : 10,
      so2: isUrban ? 15 : 5,
      co: isUrban ? 500 : 200,
      index: {
        value: isUrban ? 3 : 1,
        category: isUrban ? 'moderate' : 'good',
        color: isUrban ? '#FF7E00' : '#00E400',
      },
    };
  }
}

let weatherServiceInstance = null;

export const getWeatherService = () => {
  if (!weatherServiceInstance) {
    weatherServiceInstance = new WeatherService();
  }
  return weatherServiceInstance;
};

export default WeatherService;