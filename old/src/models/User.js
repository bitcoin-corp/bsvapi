const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'premium'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true
  },
  bsvAddress: {
    type: String,
    unique: true,
    sparse: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  micropaymentChannels: [{
    channelId: String,
    balance: Number,
    status: {
      type: String,
      enum: ['active', 'closed', 'pending'],
      default: 'active'
    },
    createdAt: Date,
    lastActivity: Date
  }],
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: false }
    },
    privacy: {
      shareUsageData: { type: Boolean, default: false }
    }
  },
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  verificationToken: String,
  verificationExpires: Date
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ apiKey: 1 });
userSchema.index({ bsvAddress: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to generate API key
userSchema.pre('save', function(next) {
  if (!this.apiKey) {
    this.apiKey = this.generateApiKey();
  }
  next();
});

// Instance methods
userSchema.methods = {
  // Compare password
  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  },

  // Generate JWT token
  generateAuthToken() {
    return jwt.sign(
      { 
        userId: this._id, 
        email: this.email, 
        role: this.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  },

  // Generate API key
  generateApiKey() {
    return 'bsv_' + this._id.toString().slice(-8) + '_' + Math.random().toString(36).substr(2, 15);
  },

  // Increment login attempts
  async incrementLoginAttempts() {
    // If we have a previous lock that has expired, restart at 1
    if (this.lockUntil && this.lockUntil < Date.now()) {
      return await this.updateOne({
        $unset: { lockUntil: 1 },
        $set: { loginAttempts: 1 }
      });
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    
    // Lock account after 5 failed attempts
    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
      updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
    }
    
    return await this.updateOne(updates);
  },

  // Reset login attempts
  async resetLoginAttempts() {
    return await this.updateOne({
      $unset: { loginAttempts: 1, lockUntil: 1 }
    });
  },

  // Add balance
  async addBalance(amount) {
    if (amount <= 0) throw new Error('Amount must be positive');
    this.balance += amount;
    return await this.save();
  },

  // Deduct balance
  async deductBalance(amount) {
    if (amount <= 0) throw new Error('Amount must be positive');
    if (this.balance < amount) throw new Error('Insufficient balance');
    this.balance -= amount;
    return await this.save();
  },

  // Create micropayment channel
  async createMicropaymentChannel(initialBalance) {
    const channelId = 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    this.micropaymentChannels.push({
      channelId,
      balance: initialBalance,
      status: 'active',
      createdAt: new Date(),
      lastActivity: new Date()
    });
    
    return await this.save();
  },

  // Get active micropayment channels
  getActiveChannels() {
    return this.micropaymentChannels.filter(channel => channel.status === 'active');
  },

  // To JSON (exclude sensitive data)
  toJSON() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.resetPasswordToken;
    delete userObject.resetPasswordExpires;
    delete userObject.verificationToken;
    delete userObject.verificationExpires;
    return userObject;
  }
};

// Static methods
userSchema.statics.findByApiKey = async function(apiKey) {
  return this.findOne({ apiKey, isActive: true });
};

userSchema.statics.findByBsvAddress = async function(bsvAddress) {
  return this.findOne({ bsvAddress, isActive: true });
};

userSchema.statics.emailExists = async function(email) {
  const user = await this.findOne({ email });
  return !!user;
};

userSchema.statics.usernameExists = async function(username) {
  const user = await this.findOne({ username });
  return !!user;
};

module.exports = mongoose.model('User', userSchema); 