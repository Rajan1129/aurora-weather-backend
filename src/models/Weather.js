import mongoose from 'mongoose';

const weatherSchema = new mongoose.Schema(
  {
    locationKey: {
      type: String,
      required: true,
      index: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      city: String,
      country: String,
      timezone: String,
    },
    source: {
      type: String,
      enum: ['openweather', 'tomorrow', 'weatherapi', 'openmeteo', 'combined'],
      required: true,
    },
    capturedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    current: {
      temperature: Number,
      feelsLike: Number,
      humidity: Number,
      pressure: Number,
      windSpeed: Number,
      windDirection: Number,
      uvIndex: Number,
      visibility: Number,
      clouds: Number,
      condition: {
        id: Number,
        main: String,
        description: String,
      },
      icon: String,
    },
    hourly: [
      {
        time: Date,
        temperature: Number,
        condition: {
          id: Number,
          main: String,
          description: String,
        },
        icon: String,
        rainProbability: Number,
        windSpeed: Number,
        humidity: Number,
        pressure: Number,
      },
    ],
    daily: [
      {
        date: Date,
        tempMin: Number,
        tempMax: Number,
        condition: {
          id: Number,
          main: String,
          description: String,
        },
        icon: String,
        rainProbability: Number,
        windSpeed: Number,
        humidity: Number,
        sunrise: Date,
        sunset: Date,
        moonPhase: Number,
        uvIndex: Number,
        pressure: Number,
      },
    ],
    airQuality: {
      aqi: Number,
      pm25: Number,
      pm10: Number,
      o3: Number,
      no2: Number,
      so2: Number,
      co: Number,
      index: {
        value: Number,
        category: {
          type: String,
          enum: ['good', 'moderate', 'unhealthy_sensitive', 'unhealthy', 'very_unhealthy', 'hazardous'],
        },
        color: String,
      },
    },
    alerts: [
      {
        type: {
          type: String,
          enum: [
            'storm', 'hurricane', 'tornado', 'flood', 'fire',
            'earthquake', 'tsunami', 'heatwave', 'coldwave',
            'thunderstorm', 'heavy_rain', 'heavy_snow', 'wind',
          ],
        },
        severity: {
          type: String,
          enum: ['minor', 'moderate', 'severe', 'extreme'],
        },
        title: String,
        description: String,
        startTime: Date,
        endTime: Date,
        source: String,
      },
    ],
    ttlExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      index: { expires: '15m' },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
weatherSchema.index({ locationKey: 1, capturedAt: -1 });

// Static method to get latest weather
weatherSchema.statics.getLatest = async function (locationKey) {
  return this.findOne({ locationKey })
    .sort({ capturedAt: -1 })
    .limit(1);
};

// Static method to get weather history
weatherSchema.statics.getHistory = async function (locationKey, days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({
    locationKey,
    capturedAt: { $gte: cutoff },
  })
    .sort({ capturedAt: 1 })
    .limit(1000);
};

const Weather = mongoose.model('Weather', weatherSchema);

export default Weather;