import mongoose from 'mongoose';

const aiConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['chat', 'daily_summary', 'advisor', 'trip_planner'],
      required: true,
    },
    advisorType: {
      type: String,
      enum: [
        'outfit', 'mood', 'pet', 'skin_hair', 'workout',
        'impact_score', 'photographer', 'farmer', 'trip_planner',
        'home_tasks', 'specialty_scores', 'asthma_risk',
      ],
    },
    messages: [
      {
        role: {
          type: String,
          enum: ['user', 'assistant', 'system'],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    structuredOutput: {
      type: mongoose.Schema.Types.Mixed,
    },
    context: {
      location: {
        lat: Number,
        lng: Number,
        city: String,
        country: String,
      },
      weatherData: mongoose.Schema.Types.Mixed,
      userPreferences: mongoose.Schema.Types.Mixed,
    },
    model: {
      type: String,
      enum: ['gpt-4', 'gpt-3.5-turbo', 'gemini-pro'],
      default: 'gpt-4',
    },
    tokensUsed: {
      type: Number,
      default: 0,
    },
    cost: {
      type: Number,
      default: 0,
    },
    latency: {
      type: Number,
      default: 0,
    },
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: String,
      helpful: Boolean,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
aiConversationSchema.index({ userId: 1, createdAt: -1 });
aiConversationSchema.index({ userId: 1, type: 1 });

// Static method to get user's AI usage
aiConversationSchema.statics.getUserUsage = async function (userId, days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId.createFromHexString(userId),
        createdAt: { $gte: cutoff },
      },
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalTokens: { $sum: '$tokensUsed' },
        totalCost: { $sum: '$cost' },
      },
    },
  ]);
};

const AIConversation = mongoose.model('AIConversation', aiConversationSchema);

export default AIConversation;