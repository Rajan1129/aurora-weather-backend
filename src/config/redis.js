import Redis from 'redis';
import { logger } from '../utils/logger.js';

let redisClient = null;
let isRedisConnected = false;

const connectRedis = async () => {
  try {
    if (redisClient) {
      return redisClient;
    }

    redisClient = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis max retries reached');
            return new Error('Redis max retries reached');
          }
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 10000,
      },
    });

    redisClient.on('error', (err) => {
      logger.error('❌ Redis Client Error:', err);
      isRedisConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('🔄 Redis Client Connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis Client Ready');
      isRedisConnected = true;
    });

    redisClient.on('end', () => {
      logger.warn('⚠️ Redis Client Disconnected');
      isRedisConnected = false;
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('❌ Redis connection error:', error);
    // Don't exit, Redis is not critical for app startup
    return null;
  }
};

const getRedis = () => redisClient;

const isRedisAvailable = () => isRedisConnected && redisClient?.isReady;

const setCache = async (key, value, ttl = 300) => {
  try {
    if (!isRedisAvailable()) return false;
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Redis set cache error:', error);
    return false;
  }
};

const getCache = async (key) => {
  try {
    if (!isRedisAvailable()) return null;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Redis get cache error:', error);
    return null;
  }
};

const deleteCache = async (key) => {
  try {
    if (!isRedisAvailable()) return false;
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error('Redis delete cache error:', error);
    return false;
  }
};

const clearCachePattern = async (pattern) => {
  try {
    if (!isRedisAvailable()) return false;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    return true;
  } catch (error) {
    logger.error('Redis clear cache pattern error:', error);
    return false;
  }
};

export { 
  connectRedis, 
  getRedis, 
  isRedisAvailable,
  setCache, 
  getCache, 
  deleteCache, 
  clearCachePattern 
};