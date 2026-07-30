import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import bcryptjs from 'bcryptjs';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import User from './src/models/User.js';
import Weather from './src/models/Weather.js';
import AIConversation from './src/models/AIConversation.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI', 'OPENWEATHER_API_KEY'];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
  console.error('❌ CRITICAL ERROR: Missing required environment variables:');
  missingVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('Please configure them in your .env file before starting the server.');
  process.exit(1);
}
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;

// ==================== MONGODB CONNECTION ====================

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aurora-weather';
    console.log(`🔗 Connecting to MongoDB: ${mongoURI}`);
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    console.log('⚠️ Server will run in offline mode (using in-memory storage)');
    return null;
  }
};

// Connect to MongoDB
const mongoConnection = await connectDB();
const isMongoConnected = mongoConnection !== null;

// ==================== JWT MIDDLEWARE ====================

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token, allow as guest
    if (!token) {
      req.userId = null;
      req.user = { role: 'guest' };
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mock-secret');
      req.userId = decoded.id;
      
      let userRole = decoded.role || 'user';
      
      // Look up user in DB if connected to get the most up-to-date role
      // We use the imported 'User' model instead of 'UserModel' to avoid initialization order issues
      if (isMongoConnected) {
        const user = await User.findById(decoded.id);
        if (user && user.role) {
          userRole = user.role;
        }
      }
      
      req.user = { id: decoded.id, role: userRole };
      next();
    } catch (error) {
      req.userId = null;
      req.user = { role: 'guest' };
      next();
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    req.userId = null;
    req.user = { role: 'guest' };
    next();
  }
};

const generateToken = (userId, role = 'user') => {
  return jwt.sign(
    { id: userId, role: role },
    process.env.JWT_SECRET || 'mock-secret',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// ==================== EXPRESS MIDDLEWARE ====================

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// ==================== MONGODB MODELS (if connected) ====================

let UserModel;
let WeatherModel;
let AIConversationModel;
let userIdCounter = 1;
let weatherIdCounter = 1;
let convIdCounter = 1;
const users = [];
const weathers = [];
const conversations = [];

if (isMongoConnected) {
  // Use MongoDB models
  UserModel = User;
  WeatherModel = Weather;
  AIConversationModel = AIConversation;
} else {
  // Use in-memory storage
  UserModel = {
    findOne: async (query) => {
      const user = users.find(u => {
        if (query.email) return u.email === query.email;
        if (query._id) return u._id === query._id;
        return false;
      });
      return user || null;
    },
    findById: async (id) => {
      const user = users.find(u => u._id === id);
      return user || null;
    },
    create: async (data) => {
      const user = {
        _id: userIdCounter++,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(user);
      return user;
    },
    findByIdAndUpdate: async (id, update, options) => {
      const index = users.findIndex(u => u._id === id);
      if (index === -1) return null;
      const user = { ...users[index], ...update.$set, updatedAt: new Date() };
      users[index] = user;
      return user;
    },
    find: async (query) => {
      return users;
    },
    countDocuments: async (query) => {
      return users.length;
    },
    aggregate: async (pipeline) => {
      return [];
    }
  };

  AIConversationModel = {
    create: async (data) => {
      const conv = {
        ...data,
        _id: convIdCounter++,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      conversations.push(conv);
      return conv;
    },
    countDocuments: async () => {
      return conversations.length;
    }
  };

  WeatherModel = {
    countDocuments: async () => {
      return weathers.length;
    }
  };
}

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    


    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required',
      });
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists',
      });
    }

    const salt = await bcryptjs.genSalt(12);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const user = await UserModel.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: 'user',
      isActive: true,
      isEmailVerified: false,
      authProviders: [{ provider: 'email' }],
    });



    const token = generateToken(user._id || user.id, user.role || 'user');
    const userResponse = user.toJSON ? user.toJSON() : { ...user };
    delete userResponse.password;

    res.status(201).json({
      success: true,
      data: { user: userResponse, token },
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    


    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    const user = await UserModel.findOne({ email }).select('+password');
    
    if (!user) {

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }



    
    let isMatch = false;
    if (isMongoConnected && user.comparePassword) {
      isMatch = await user.comparePassword(password);
    } else {
      isMatch = await bcryptjs.compare(password, user.password);
    }

    if (!isMatch) {

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }



    const token = generateToken(user._id || user.id, user.role || 'user');
    const userResponse = user.toJSON ? user.toJSON() : { ...user };
    delete userResponse.password;

    res.json({
      success: true,
      data: { user: userResponse, token },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.',
    });
  }
});

// Guest Login
app.post('/api/auth/guest', async (req, res) => {
  try {
    const guestId = `guest_${Date.now()}`;
    const guestEmail = `${guestId}@guest.aurora.com`;
    const guestPassword = Math.random().toString(36).substr(2, 20);
    
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(guestPassword, salt);
    
    const user = await UserModel.create({
      email: guestEmail,
      firstName: 'Guest',
      lastName: 'User',
      password: hashedPassword,
      role: 'guest',
      isActive: true,
      isEmailVerified: true,
      authProviders: [{ provider: 'guest' }],
    });



    const token = generateToken(user._id || user.id, user.role || 'guest');
    const userResponse = user.toJSON ? user.toJSON() : { ...user };
    delete userResponse.password;

    res.json({
      success: true,
      data: { 
        user: userResponse, 
        token,
        isGuest: true,
      },
    });
  } catch (error) {
    console.error('❌ Guest login error:', error);
    res.status(500).json({
      success: false,
      error: 'Guest login failed. Please try again.',
    });
  }
});

// ==================== RAZORPAY ROUTES ====================

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

// Create Razorpay Order
app.post('/api/payments/razorpay/order', protect, async (req, res) => {
  try {
    if (!req.userId || req.user?.role === 'guest') {
      return res.status(401).json({ success: false, error: 'Unauthorized to create order' });
    }

    const options = {
      amount: 1000 * 100, // $10.00 equivalent (Razorpay amounts are in the smallest currency unit) e.g. 1000 INR
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Razorpay Order error:', error);
    res.status(500).json({ success: false, error: 'Failed to create payment order' });
  }
});

// Verify Razorpay Payment
app.post('/api/payments/razorpay/verify', protect, async (req, res) => {
  try {
    if (!req.userId || req.user?.role === 'guest') {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dummy_secret')
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Payment successful, upgrade user
      const user = await UserModel.findByIdAndUpdate(
        req.userId,
        { 
          $set: { 
            role: 'premium',
            'subscription.plan': 'premium_monthly',
            'subscription.status': 'active',
            'subscription.startDate': new Date(),
          } 
        },
        { new: true }
      );

      return res.json({
        success: true,
        message: 'Payment verified successfully. You are now a premium user.',
        data: user,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature. Payment verification failed.',
      });
    }
  } catch (error) {
    console.error('Razorpay Verify error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

// Get User Profile
app.get('/api/users/me', protect, async (req, res) => {
  try {
    if (!req.userId) {
      return res.json({
        success: true,
        data: { role: 'guest', isGuest: true },
      });
    }
    
    const user = await UserModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update User Profile
app.patch('/api/users/me', protect, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: 'Guest users cannot update profile',
      });
    }
    
    const user = await UserModel.findByIdAndUpdate(
      req.userId,
      { $set: req.body },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Upload Avatar
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.post('/api/users/upload-avatar', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const uploadStream = cloudinary.uploader.upload_stream({
      folder: 'aurora-weather/avatars',
      width: 300,
      height: 300,
      crop: 'fill',
      transformation: [
        { gravity: 'face', height: 300, width: 300, crop: 'thumb' },
        { radius: 'max' },
      ],
    }, async (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        return res.status(500).json({ success: false, error: 'Failed to upload image to cloud' });
      }

      if (!req.userId || req.user?.role === 'guest') {
        return res.json({
          success: true,
          data: { url: result.secure_url, isGuest: true }
        });
      }

      const user = await UserModel.findByIdAndUpdate(
        req.userId,
        { $set: { avatar: result.secure_url } },
        { new: true }
      );

      res.json({
        success: true,
        data: { url: result.secure_url, isGuest: false }
      });
    });

    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);
    bufferStream.pipe(uploadStream);

  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CITY SEARCH ====================

// City Search - Uses OpenWeatherMap Geocoding API only
app.get('/api/cities/search', async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.json({
      success: true,
      data: [],
    });
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      console.error('❌ OPENWEATHER_API_KEY not found in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Weather API key not configured',
      });
    }

    // Call OpenWeatherMap Geocoding API
    const response = await axios.get(
      `http://api.openweathermap.org/geo/1.0/direct`,
      {
        params: {
          q: q,
          limit: 10,
          appid: apiKey,
        },
        timeout: 5000,
      }
    );

    if (response.data && response.data.length > 0) {
      const cities = response.data.map(city => ({
        name: city.name,
        country: city.country,
        state: city.state || '',
        lat: city.lat,
        lng: city.lon,
        displayName: city.state 
          ? `${city.name}, ${city.state}, ${city.country}`
          : `${city.name}, ${city.country}`,
      }));

      return res.json({
        success: true,
        data: cities,
        source: 'openweather',
      });
    }

    // No results found
    return res.json({
      success: true,
      data: [],
      message: 'No cities found',
    });
  } catch (error) {
    console.error('❌ City search error:', error.message);
    
    // Return empty array instead of error
    return res.json({
      success: true,
      data: [],
      error: error.message,
      message: 'Unable to search cities at this time',
    });
  }
});

// ==================== WEATHER ROUTES ====================

// Current Weather - Public (No Auth Required)
app.get('/api/weather/current', async (req, res) => {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required',
      });
    }

    if (!apiKey) {
      // Return mock data if no API key
      return res.json({
        success: true,
        data: getMockWeather(),
        source: 'mock',
      });
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          lat: parseFloat(lat),
          lon: parseFloat(lng),
          appid: apiKey,
          units: 'metric',
        },
        timeout: 10000,
      }
    );

    const data = response.data;
    const weatherData = {
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      windSpeed: Math.round(data.wind.speed * 3.6),
      windDirection: data.wind.deg || 0,
      uvIndex: 0,
      visibility: data.visibility ? Math.round(data.visibility / 1000) : 10,
      clouds: data.clouds.all,
      condition: {
        id: data.weather[0].id,
        main: data.weather[0].main,
        description: data.weather[0].description,
      },
      icon: data.weather[0].icon,
      timestamp: new Date(data.dt * 1000),
    };

    res.json({
      success: true,
      data: weatherData,
      source: 'api',
    });
  } catch (error) {
    console.error('Weather API error:', error.message);
    res.json({
      success: true,
      data: getMockWeather(),
      source: 'mock',
      error: error.message,
    });
  }
});

// Hourly Forecast - Public (No Auth Required)
app.get('/api/weather/hourly', async (req, res) => {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const { lat, lng, hours = 24 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required',
      });
    }

    if (!apiKey) {
      return res.json({
        success: true,
        data: getMockHourly(),
        source: 'mock',
      });
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast`,
      {
        params: {
          lat: parseFloat(lat),
          lon: parseFloat(lng),
          appid: apiKey,
          units: 'metric',
          cnt: Math.min(Math.ceil(parseInt(hours) / 3), 40),
        },
        timeout: 10000,
      }
    );

    const hourlyData = response.data.list.map(item => ({
      time: new Date(item.dt * 1000),
      temperature: Math.round(item.main.temp),
      condition: {
        id: item.weather[0].id,
        main: item.weather[0].main,
        description: item.weather[0].description,
      },
      icon: item.weather[0].icon,
      rainProbability: Math.round(item.pop * 100),
      windSpeed: Math.round(item.wind.speed * 3.6),
      humidity: item.main.humidity,
      pressure: item.main.pressure,
    }));

    res.json({
      success: true,
      data: hourlyData,
      source: 'api',
    });
  } catch (error) {
    console.error('Hourly forecast error:', error.message);
    res.json({
      success: true,
      data: getMockHourly(),
      source: 'mock',
    });
  }
});

// Daily Forecast - Public (No Auth Required)
app.get('/api/weather/daily', async (req, res) => {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const { lat, lng, days = 7 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required',
      });
    }

    if (!apiKey) {
      return res.json({
        success: true,
        data: getMockDaily(),
        source: 'mock',
      });
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast`,
      {
        params: {
          lat: parseFloat(lat),
          lon: parseFloat(lng),
          appid: apiKey,
          units: 'metric',
          cnt: Math.min(parseInt(days) * 8, 40),
        },
        timeout: 10000,
      }
    );

    // Group by day
    const dailyMap = {};
    response.data.list.forEach(item => {
      const date = new Date(item.dt * 1000).toDateString();
      if (!dailyMap[date]) {
        dailyMap[date] = {
          temps: [],
          conditions: [],
          icons: [],
          rainProbabilities: [],
          windSpeeds: [],
          humidities: [],
          pressures: [],
          date: new Date(item.dt * 1000),
        };
      }
      dailyMap[date].temps.push(item.main.temp);
      dailyMap[date].conditions.push(item.weather[0]);
      dailyMap[date].icons.push(item.weather[0].icon);
      dailyMap[date].rainProbabilities.push(item.pop * 100);
      dailyMap[date].windSpeeds.push(item.wind.speed * 3.6);
      dailyMap[date].humidities.push(item.main.humidity);
      dailyMap[date].pressures.push(item.main.pressure);
    });

    const dailyData = Object.values(dailyMap).slice(0, parseInt(days)).map(day => ({
      date: day.date,
      tempMin: Math.round(Math.min(...day.temps)),
      tempMax: Math.round(Math.max(...day.temps)),
      condition: day.conditions[0],
      icon: day.icons[Math.floor(day.icons.length / 2)],
      rainProbability: Math.round(Math.max(...day.rainProbabilities)),
      windSpeed: Math.round(Math.max(...day.windSpeeds)),
      humidity: Math.round(Math.max(...day.humidities)),
      pressure: Math.round(Math.max(...day.pressures)),
      sunrise: null,
      sunset: null,
      moonPhase: 0,
      uvIndex: 0,
    }));

    res.json({
      success: true,
      data: dailyData,
      source: 'api',
    });
  } catch (error) {
    console.error('Daily forecast error:', error.message);
    res.json({
      success: true,
      data: getMockDaily(),
      source: 'mock',
    });
  }
});

// Air Quality - Public (No Auth Required)
app.get('/api/weather/air-quality', async (req, res) => {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required',
      });
    }

    if (!apiKey) {
      return res.json({
        success: true,
        data: getMockAirQuality(),
        source: 'mock',
      });
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/air_pollution`,
      {
        params: {
          lat: parseFloat(lat),
          lon: parseFloat(lng),
          appid: apiKey,
        },
        timeout: 10000,
      }
    );

    const data = response.data.list[0];
    const components = data.components;
    const aqi = data.main.aqi;
    
    const categories = ['good', 'moderate', 'unhealthy_sensitive', 'unhealthy', 'very_unhealthy', 'hazardous'];
    const colors = ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#8F3F97', '#7E0023'];

    res.json({
      success: true,
      data: {
        aqi,
        pm25: components.pm2_5,
        pm10: components.pm10,
        o3: components.o3,
        no2: components.no2,
        so2: components.so2,
        co: components.co,
        index: {
          value: aqi,
          category: categories[aqi - 1] || 'good',
          color: colors[aqi - 1] || '#00E400',
        },
      },
      source: 'api',
    });
  } catch (error) {
    console.error('Air quality error:', error.message);
    res.json({
      success: true,
      data: getMockAirQuality(),
      source: 'mock',
    });
  }
});

// ==================== AI ROUTES ====================

// AI Daily Summary - Public (No Auth Required)
app.get('/api/ai/daily-summary', async (req, res) => {
  const summaries = [
    {
      message: '☀️ Good morning! Today is perfect for outdoor activities. Clear skies with a high of 22°C.',
      recommendations: ['🏃 Go for a morning jog', '☕ Enjoy your coffee outdoors', '🌿 Perfect day for gardening'],
    },
    {
      message: '🌤️ Pleasant weather today with some clouds. A great day to be outside!',
      recommendations: ['🚶 Take a walk in the park', '📚 Read a book outside', '🧘 Practice yoga outdoors'],
    },
    {
      message: '🌧️ Rain expected this afternoon. Plan your indoor activities accordingly.',
      recommendations: ['☂️ Carry an umbrella', '🎬 Watch a movie', '📖 Read a book indoors'],
    },
    {
      message: '❄️ Cold day ahead! Bundle up and stay warm.',
      recommendations: ['🧣 Wear warm clothes', '☕ Enjoy hot drinks', '🏠 Stay indoors if possible'],
    },
  ];
  
  res.json({
    success: true,
    data: summaries[Math.floor(Math.random() * summaries.length)],
  });
});

// AI Outfit Recommendation - Public (No Auth Required)
app.get('/api/ai/outfit', async (req, res) => {
  const occasion = req.query.occasion || 'casual';
  
  const outfits = {
    casual: {
      recommended: [
        { type: 'top', name: 'T-shirt', reason: 'Comfortable and versatile' },
        { type: 'bottom', name: 'Jeans', reason: 'Classic and comfortable' },
        { type: 'shoes', name: 'Sneakers', reason: 'Perfect for walking' },
      ],
      alternative: [
        { type: 'top', name: 'Polo Shirt', reason: 'Slightly dressier' },
      ],
      weatherImpact: 'Clear skies with comfortable temperatures',
      occasion: occasion,
    },
    formal: {
      recommended: [
        { type: 'top', name: 'Dress Shirt', reason: 'Professional look' },
        { type: 'bottom', name: 'Dress Pants', reason: 'Formal attire' },
        { type: 'shoes', name: 'Oxford Shoes', reason: 'Classic formal' },
      ],
      alternative: [
        { type: 'top', name: 'Blazer', reason: 'Adds sophistication' },
      ],
      weatherImpact: 'Comfortable for formal wear',
      occasion: occasion,
    },
    sporty: {
      recommended: [
        { type: 'top', name: 'Athletic Shirt', reason: 'Breathable fabric' },
        { type: 'bottom', name: 'Gym Shorts', reason: 'Maximum mobility' },
        { type: 'shoes', name: 'Running Shoes', reason: 'Great support' },
      ],
      alternative: [
        { type: 'top', name: 'Tank Top', reason: 'Cooler option' },
      ],
      weatherImpact: 'Perfect for outdoor activities',
      occasion: occasion,
    },
  };
  
  res.json({
    success: true,
    data: outfits[occasion] || outfits.casual,
  });
});

// AI Mood Forecast - Public (No Auth Required)
app.get('/api/ai/mood', async (req, res) => {
  const moods = [
    { mood: 'happy', emoji: '😊', score: 85, energy: 80, productivity: 82 },
    { mood: 'calm', emoji: '😌', score: 75, energy: 70, productivity: 78 },
    { mood: 'energetic', emoji: '⚡', score: 90, energy: 90, productivity: 85 },
    { mood: 'focused', emoji: '🎯', score: 80, energy: 75, productivity: 90 },
    { mood: 'cozy', emoji: '🛋️', score: 70, energy: 65, productivity: 72 },
  ];
  
  const mood = moods[Math.floor(Math.random() * moods.length)];
  res.json({
    success: true,
    data: {
      mood: mood.mood,
      score: mood.score,
      energyLevel: mood.energy,
      productivityScore: mood.productivity,
      recommendations: {
        activities: ['🧘 Morning meditation', '🚶 Walk in the park', '📚 Read a book'],
        music: ['🎵 Upbeat pop', '🎶 Chill vibes'],
        meditation: 'Start your day with 10 minutes of mindfulness',
      },
    },
  });
});

// AI Impact Score - Public (No Auth Required)
app.get('/api/ai/impact-score', async (req, res) => {
  res.json({
    success: true,
    data: {
      productivity: 82,
      travel: 75,
      photography: 90,
      sports: 85,
      dating: 70,
      shopping: 80,
      driving: 75,
      kids: 85,
      seniorCitizens: 72,
      overall: 80,
    },
  });
});

// AI Conversation - Protected (Requires Auth)
app.post('/api/ai/conversation', protect, async (req, res) => {
  try {
    const { message, type = 'chat' } = req.body;
    
    const responses = {
      'hello': 'Hello! How can I help you with the weather today?',
      'weather': 'Based on the current weather, it\'s a beautiful day with clear skies!',
      'rain': 'There\'s a chance of rain today. Don\'t forget to bring an umbrella!',
      'wear': 'I recommend wearing comfortable clothes today. A light jacket might be good.',
      'run': 'The weather is perfect for running today! Clear skies and comfortable temperatures.',
      'default': 'That\'s a great question! Based on the weather, I would recommend spending some time outdoors today.',
    };
    
    let response = responses.default;
    const msg = message.toLowerCase();
    if (msg.includes('hello') || msg.includes('hi')) response = responses.hello;
    else if (msg.includes('weather')) response = responses.weather;
    else if (msg.includes('rain')) response = responses.rain;
    else if (msg.includes('wear') || msg.includes('clothes')) response = responses.wear;
    else if (msg.includes('run') || msg.includes('jog')) response = responses.run;
    
    // Save conversation to database if connected
    if (isMongoConnected) {
      const conversation = await AIConversationModel.create({
        userId: req.userId,
        type: type,
        messages: [
          { role: 'user', content: message, createdAt: new Date() },
          { role: 'assistant', content: response, createdAt: new Date() },
        ],
        context: {
          location: req.body.location || {},
          weatherData: req.body.weatherData || {},
        },
        createdAt: new Date(),
      });
    }
    
    res.json({
      success: true,
      data: {
        response: response,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('AI Conversation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== ADMIN ROUTES ====================

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {





  
  // Check if user exists and has admin role
  if (!req.user) {


    return res.status(403).json({
      success: false,
      error: 'Access denied. No user found.',
    });
  }
  
  if (req.user.role !== 'admin') {


    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin only.',
    });
  }
  


  next();
};

// Get Admin Dashboard Stats
app.get('/api/admin/stats', protect, isAdmin, async (req, res) => {
  try {


    // Get real data from database
    const totalUsers = await UserModel.countDocuments();
    const activeUsers = await UserModel.countDocuments({ isActive: true });
    const premiumUsers = await UserModel.countDocuments({ 
      'subscription.status': 'active',
      'subscription.plan': { $ne: 'free' }
    });
    const guestUsers = await UserModel.countDocuments({ role: 'guest' });

    // Get recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsers = await UserModel.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Get user growth data (last 30 days)
    const growthData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await UserModel.countDocuments({
        createdAt: { $gte: date, $lt: nextDate }
      });
      
      growthData.push({
        date: date.toISOString().split('T')[0],
        count: count
      });
    }

    // Get role distribution
    const roleDistribution = await UserModel.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent users (last 10)
    let recentUsers = [];
    if (isMongoConnected) {
      recentUsers = await UserModel.find()
        .sort({ lastLoginAt: -1, createdAt: -1 })
        .limit(10)
        .select('email firstName lastName role lastLoginAt createdAt isActive');
    }

    // Get weather data stats
    let totalWeatherRecords = 0;
    if (WeatherModel) {
      totalWeatherRecords = await WeatherModel.countDocuments();
    }

    // Get AI conversation stats
    let totalAIConversations = 0;
    if (AIConversationModel) {
      totalAIConversations = await AIConversationModel.countDocuments();
    }

    // System health
    const systemHealth = {
      database: isMongoConnected ? 'Connected' : 'Disconnected',
      weatherApi: process.env.OPENWEATHER_API_KEY ? 'Configured' : 'Not Configured',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    };

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          premium: premiumUsers,
          guests: guestUsers,
          newUsers: newUsers,
          growth: Math.round(((newUsers / (totalUsers || 1)) * 100))
        },
        weather: {
          totalRecords: totalWeatherRecords,
        },
        ai: {
          totalConversations: totalAIConversations,
        },
        system: {
          activeSessions: Math.floor(Math.random() * 100) + 20,
        },
        growth: growthData,
        roles: roleDistribution,
        recentUsers: recentUsers,
        systemHealth: systemHealth,
        timestamp: new Date(),
      }
    });
  } catch (error) {
    console.error('❌ Admin stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get All Users (Admin Only)
app.get('/api/admin/users', protect, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      query = {
        $or: [
          { email: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
        ]
      };
    }

    const users = await UserModel.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpiry')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await UserModel.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('❌ Admin users error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update User (Admin Only)
app.put('/api/admin/users/:userId', protect, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Don't allow changing password through this endpoint
    delete updates.password;

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('❌ Admin update user error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete User (Admin Only)
app.delete('/api/admin/users/:userId', protect, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account',
      });
    }

    const user = await UserModel.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('❌ Admin delete user error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get System Logs (Admin Only)
app.get('/api/admin/logs', protect, isAdmin, async (req, res) => {
  try {
    // Get recent user activity
    const recentActivity = await UserModel.find()
      .sort({ lastLoginAt: -1 })
      .limit(20)
      .select('email firstName lastName lastLoginAt createdAt');

    // Get system stats
    const systemStats = {
      totalUsers: await UserModel.countDocuments(),
      activeUsers: await UserModel.countDocuments({ isActive: true }),
      databaseSize: isMongoConnected ? 'Connected' : 'Disconnected',
      serverUptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };

    res.json({
      success: true,
      data: {
        activity: recentActivity,
        stats: systemStats,
        timestamp: new Date(),
      }
    });
  } catch (error) {
    console.error('❌ Admin logs error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get Weather Analytics (Admin Only)
app.get('/api/admin/weather-analytics', protect, isAdmin, async (req, res) => {
  try {
    let weatherStats = {
      totalRequests: 0,
    };

    if (WeatherModel) {
      weatherStats.totalRequests = await WeatherModel.countDocuments();
    }

    res.json({
      success: true,
      data: weatherStats,
    });
  } catch (error) {
    console.error('❌ Weather analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get AI Analytics (Admin Only)
app.get('/api/admin/ai-analytics', protect, isAdmin, async (req, res) => {
  try {
    let aiStats = {
      totalConversations: 0,
    };

    if (AIConversationModel) {
      aiStats.totalConversations = await AIConversationModel.countDocuments();
    }

    res.json({
      success: true,
      data: aiStats,
    });
  } catch (error) {
    console.error('❌ AI analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// System Settings (Admin Only)
app.get('/api/admin/settings', protect, isAdmin, async (req, res) => {
  try {
    const settings = {
      appName: 'Aurora Weather',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      features: {
        aiAssistant: true,
        weatherMap: true,
        premiumSubscriptions: true,
        socialLogin: true,
      },
      limits: {
        freeUsers: {
          aiRequests: 50,
          savedLocations: 3,
        },
        premiumUsers: {
          aiRequests: 1000,
          savedLocations: 10,
        }
      }
    };

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('❌ Admin settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update System Settings (Admin Only)
app.put('/api/admin/settings', protect, isAdmin, async (req, res) => {
  try {
    const settings = req.body;
    
    res.json({
      success: true,
      data: settings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('❌ Admin update settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Generate Report (Admin Only)
app.post('/api/admin/reports/generate', protect, isAdmin, async (req, res) => {
  try {
    const { type = 'users', format = 'json' } = req.body;
    
    let reportData = {};
    let filename = `report-${type}-${Date.now()}`;

    switch (type) {
      case 'users':
        const users = await UserModel.find().select('-password');
        reportData = {
          type: 'users',
          generatedAt: new Date(),
          total: users.length,
          data: users,
        };
        break;
      case 'system':
        reportData = {
          type: 'system',
          generatedAt: new Date(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          database: isMongoConnected ? 'Connected' : 'Disconnected',
        };
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid report type',
        });
    }

    res.json({
      success: true,
      data: {
        report: reportData,
        filename: `${filename}.${format}`,
        format: format,
      },
    });
  } catch (error) {
    console.error('❌ Admin report generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== MOCK DATA GENERATORS ====================

const getMockWeather = () => {
  const conditions = [
    { main: 'Clear', description: 'Clear sky', icon: '01d' },
    { main: 'Clouds', description: 'Scattered clouds', icon: '03d' },
    { main: 'Clouds', description: 'Broken clouds', icon: '04d' },
    { main: 'Rain', description: 'Light rain', icon: '10d' },
    { main: 'Rain', description: 'Moderate rain', icon: '09d' },
  ];
  const cond = conditions[Math.floor(Math.random() * conditions.length)];
  const temp = 15 + Math.random() * 20;
  return {
    temperature: Math.round(temp),
    feelsLike: Math.round(temp - 2 + Math.random() * 4),
    humidity: Math.round(40 + Math.random() * 40),
    pressure: Math.round(1000 + Math.random() * 30),
    windSpeed: Math.round(2 + Math.random() * 15),
    windDirection: Math.round(Math.random() * 360),
    uvIndex: Math.round(Math.random() * 10),
    visibility: Math.round(8 + Math.random() * 4),
    clouds: Math.round(Math.random() * 100),
    condition: cond,
    icon: cond.icon,
    timestamp: new Date(),
  };
};

const getMockHourly = () => {
  const hours = [];
  for (let i = 0; i < 24; i++) {
    hours.push({
      time: new Date(Date.now() + i * 3600000),
      temperature: 18 + Math.random() * 10,
      condition: { main: 'Clear', description: 'Clear sky' },
      icon: '01d',
      rainProbability: Math.random() * 20,
      windSpeed: 3 + Math.random() * 8,
      humidity: 50 + Math.random() * 30,
      pressure: 1010 + Math.random() * 10,
    });
  }
  return hours;
};

const getMockDaily = () => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push({
      date: new Date(Date.now() + i * 86400000),
      tempMin: 15 + Math.random() * 5,
      tempMax: 22 + Math.random() * 8,
      condition: { main: 'Clear', description: 'Clear sky' },
      icon: '01d',
      rainProbability: Math.random() * 20,
      windSpeed: 3 + Math.random() * 8,
      humidity: 50 + Math.random() * 30,
      pressure: 1010 + Math.random() * 10,
    });
  }
  return days;
};

const getMockAirQuality = () => {
  const aqi = Math.floor(Math.random() * 5) + 1;
  const categories = ['good', 'moderate', 'unhealthy_sensitive', 'unhealthy', 'very_unhealthy', 'hazardous'];
  const colors = ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#8F3F97', '#7E0023'];
  return {
    aqi,
    pm25: Math.round(10 + Math.random() * 40),
    pm10: Math.round(15 + Math.random() * 50),
    o3: Math.round(20 + Math.random() * 60),
    no2: Math.round(10 + Math.random() * 30),
    so2: Math.round(5 + Math.random() * 15),
    co: Math.round(100 + Math.random() * 400),
    index: {
      value: aqi,
      category: categories[aqi - 1] || 'good',
      color: colors[aqi - 1] || '#00E400',
    },
  };
};

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
  const dbStatus = isMongoConnected ? 'connected' : 'in-memory';
  const apiKey = process.env.OPENWEATHER_API_KEY;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    weatherApi: apiKey ? 'configured' : 'missing',
    environment: process.env.NODE_ENV || 'development',
  });
});

// ==================== 404 & ERROR HANDLING ====================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.url} not found`,
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// ==================== SOCKET.IO ====================

io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  socket.on('subscribe-weather', (locationId) => {
    socket.join(`weather-${locationId}`);
    console.log(`📡 Socket ${socket.id} subscribed to weather-${locationId}`);
  });

  socket.on('unsubscribe-weather', (locationId) => {
    socket.leave(`weather-${locationId}`);
    console.log(`📡 Socket ${socket.id} unsubscribed from weather-${locationId}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ==================== START SERVER ====================

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Aurora Weather Server`);
  console.log(`📡 Running on: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Database: ${isMongoConnected ? '✅ MongoDB Connected' : '⚠️ In-Memory Mode'}`);
  console.log(`🌤️  Weather API: ${process.env.OPENWEATHER_API_KEY ? '✅ Connected' : '❌ Mock Mode'}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`  🔓 Public Routes:`);
  console.log(`    GET  /health`);
  console.log(`    GET  /api/cities/search?q=cityname`);
  console.log(`    GET  /api/weather/current?lat=&lng=`);
  console.log(`    GET  /api/weather/hourly?lat=&lng=`);
  console.log(`    GET  /api/weather/daily?lat=&lng=`);
  console.log(`    GET  /api/weather/air-quality?lat=&lng=`);
  console.log(`    GET  /api/ai/daily-summary`);
  console.log(`    GET  /api/ai/outfit?occasion=casual`);
  console.log(`    GET  /api/ai/mood`);
  console.log(`    GET  /api/ai/impact-score`);
  console.log(`    POST /api/auth/register`);
  console.log(`    POST /api/auth/login`);
  console.log(`    POST /api/auth/guest`);
  console.log(`\n  🔒 Protected Routes (Requires Auth):`);
  console.log(`    GET    /api/users/me`);
  console.log(`    PATCH  /api/users/me`);
  console.log(`    POST   /api/ai/conversation`);
  console.log(`\n  👑 Admin Routes (Requires Admin Role):`);
  console.log(`    GET    /api/admin/stats`);
  console.log(`    GET    /api/admin/users`);
  console.log(`    PUT    /api/admin/users/:userId`);
  console.log(`    DELETE /api/admin/users/:userId`);
  console.log(`    GET    /api/admin/logs`);
  console.log(`    GET    /api/admin/weather-analytics`);
  console.log(`    GET    /api/admin/ai-analytics`);
  console.log(`    GET    /api/admin/settings`);
  console.log(`    PUT    /api/admin/settings`);
  console.log(`    POST   /api/admin/reports/generate`);
  console.log(`\n💡 WebSocket ready for real-time updates\n`);
});

export { io };
