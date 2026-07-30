import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      enum: ['home', 'work', 'favorite', 'custom'],
      default: 'custom',
    },
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    timezone: {
      type: String,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
locationSchema.index({ userId: 1, isPrimary: 1 });
locationSchema.index({ userId: 1, order: 1 });
locationSchema.index({ lat: 1, lng: 1 });

// Ensure only one primary location per user
locationSchema.pre('save', async function (next) {
  if (this.isPrimary) {
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isPrimary: false }
    );
  }
  next();
});

// Static method to set primary location
locationSchema.statics.setPrimary = async function(userId, locationId) {
  await this.updateMany(
    { userId },
    { isPrimary: false }
  );
  await this.findByIdAndUpdate(locationId, { isPrimary: true });
};

const Location = mongoose.model('Location', locationSchema);

export default Location;