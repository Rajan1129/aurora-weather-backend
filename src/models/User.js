import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: function() {
        return this.authProviders.length === 0 || 
               this.authProviders.some(p => p.provider === 'email');
      },
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: 500,
      default: '',
    },
    location: {
      type: String,
      default: '',
    },
    website: {
      type: String,
      default: '',
    },
    socialLinks: {
      twitter: { type: String, default: '' },
      github: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      instagram: { type: String, default: '' },
      facebook: { type: String, default: '' },
    },
    role: {
      type: String,
      enum: ['guest', 'user', 'premium', 'admin'],
      default: 'user',
    },
    authProviders: [
      {
        provider: {
          type: String,
          enum: ['google', 'apple', 'github', 'email', 'guest'],
        },
        providerId: String,
        email: String,
      },
    ],
    preferences: {
      units: {
        type: String,
        enum: ['metric', 'imperial'],
        default: 'metric',
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto', 'weather-based'],
        default: 'auto',
      },
      language: {
        type: String,
        default: 'en',
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
      dateFormat: {
        type: String,
        enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
        default: 'MM/DD/YYYY',
      },
      notifications: {
        weatherAlerts: { type: Boolean, default: true },
        dailySummary: { type: Boolean, default: true },
        aiRecommendations: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        pushNotifications: { type: Boolean, default: true },
        emailDigest: { type: Boolean, default: true },
      },
      dashboard: {
        showAlerts: { type: Boolean, default: true },
        showForecast: { type: Boolean, default: true },
        showAI: { type: Boolean, default: true },
        showWidgets: { type: Boolean, default: true },
        showMap: { type: Boolean, default: true },
      },
    },
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'premium_monthly', 'premium_yearly', 'enterprise'],
        default: 'free',
      },
      stripeCustomerId: String,
      stripeSubscriptionId: String,
      startDate: Date,
      endDate: Date,
      status: {
        type: String,
        enum: ['active', 'expired', 'cancelled', 'past_due'],
        default: 'active',
      },
    },
    savedLocations: [
      {
        name: {
          type: String,
          required: true,
        },
        lat: {
          type: Number,
          required: true,
        },
        lng: {
          type: Number,
          required: true,
        },
        city: String,
        country: String,
        state: String,
        isPrimary: { type: Boolean, default: false },
        label: {
          type: String,
          enum: ['home', 'work', 'favorite', 'custom'],
          default: 'custom',
        },
      },
    ],
    familyGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FamilyGroup',
    },
    aiUsage: {
      totalRequests: { type: Number, default: 0 },
      monthlyRequests: { type: Number, default: 0 },
      lastReset: { type: Date, default: Date.now },
      savedStories: [
        {
          title: String,
          content: String,
          type: String,
          emoji: String,
          weather: mongoose.Schema.Types.Mixed,
          savedAt: { type: Date, default: Date.now },
        },
      ],
    },
    gameStats: {
      predictionScore: { type: Number, default: 0 },
      predictionStreak: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
      gamesPlayed: { type: Number, default: 0 },
      correctPredictions: { type: Number, default: 0 },
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: String,
    resetPasswordExpiry: Date,
    emailVerificationToken: String,
    emailVerificationExpiry: Date,
    deviceTokens: [
      {
        token: String,
        platform: {
          type: String,
          enum: ['web', 'ios', 'android'],
        },
        lastUsed: { type: Date, default: Date.now },
      },
    ],
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
userSchema.index({ 'authProviders.providerId': 1 });
userSchema.index({ 'subscription.stripeCustomerId': 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'savedLocations.city': 1 });
userSchema.index({ 'savedLocations.country': 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update last login timestamp
userSchema.pre('save', function (next) {
  if (this.isModified('lastLoginAt')) {
    // Reset monthly AI usage if last reset was more than 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (this.aiUsage.lastReset < thirtyDaysAgo) {
      this.aiUsage.monthlyRequests = 0;
      this.aiUsage.lastReset = new Date();
    }
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user is premium
userSchema.methods.isPremium = function() {
  return this.subscription.status === 'active' && 
         this.subscription.plan !== 'free';
};

// Check if user has reached AI usage limit (free tier: 50 requests/month)
userSchema.methods.hasReachedAILimit = function() {
  if (this.isPremium()) return false;
  return this.aiUsage.monthlyRequests >= 50;
};

// Increment AI usage
userSchema.methods.incrementAIUsage = async function() {
  this.aiUsage.totalRequests += 1;
  this.aiUsage.monthlyRequests += 1;
  await this.save();
};

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Virtual for initials
userSchema.virtual('initials').get(function () {
  if (!this.firstName || !this.lastName) return 'U';
  return `${this.firstName[0]}${this.lastName[0]}`.toUpperCase();
});

// Virtual for display name
userSchema.virtual('displayName').get(function () {
  return this.firstName || this.email || 'User';
});

// Virtual for primary location
userSchema.virtual('primaryLocation').get(function () {
  if (!this.savedLocations || !Array.isArray(this.savedLocations)) return null;
  return this.savedLocations.find(loc => loc.isPrimary) || this.savedLocations[0] || null;
});

// Transform response
userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpiry;
    delete ret.emailVerificationToken;
    delete ret.emailVerificationExpiry;
    delete ret.deviceTokens;
    delete ret.deletedAt;
    return ret;
  },
});

// Static method to find or create user by email
userSchema.statics.findOrCreate = async function({ email, firstName, lastName, provider }) {
  let user = await this.findOne({ email });
  
  if (!user) {
    user = await this.create({
      email,
      firstName,
      lastName,
      authProviders: [{ provider, providerId: email }],
      isEmailVerified: true,
    });
  } else {
    // Add provider if not already added
    const hasProvider = user.authProviders.some(p => p.provider === provider);
    if (!hasProvider) {
      user.authProviders.push({ provider, providerId: email });
      await user.save();
    }
  }
  
  return user;
};

// Static method to get user stats
userSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $facet: {
        total: [{ $count: 'count' }],
        roles: [
          { $group: { _id: '$role', count: { $sum: 1 } } },
        ],
        active: [
          { $match: { isActive: true } },
          { $count: 'count' },
        ],
        premium: [
          { $match: { 'subscription.status': 'active', 'subscription.plan': { $ne: 'free' } } },
          { $count: 'count' },
        ],
        newUsers: [
          { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
          { $count: 'count' },
        ],
      },
    },
  ]);
  
  return {
    total: stats[0]?.total?.[0]?.count || 0,
    roles: stats[0]?.roles || [],
    active: stats[0]?.active?.[0]?.count || 0,
    premium: stats[0]?.premium?.[0]?.count || 0,
    newUsers: stats[0]?.newUsers?.[0]?.count || 0,
  };
};

const User = mongoose.model('User', userSchema);

export default User;