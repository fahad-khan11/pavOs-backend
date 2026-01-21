import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types/index.js';

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
      required: false, // Make password optional for OAuth users
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['creator', 'manager', 'admin'],
      default: 'creator',
    },
    subscriptionPlan: {
      type: String,
      enum: ['Starter', 'Pro', 'Agency'],
      default: 'Starter',
    },
    whopId: {
      type: String,
      sparse: true,
      unique: true,
    },
    whopUserId: {
      type: String,
      required: [true, 'Whop User ID is required'],  // ✅ REFACTORED: Strictly required (Whop-only app)
      index: true,
    },
    whopCompanyId: {
      type: String,
      required: [true, 'Whop Company ID is required'],  // ✅ REFACTORED: Strictly required (Whop-only app)
      index: true,
    },
    whopAuthorizedUserId: {
      type: String,
      sparse: true,
    },
    whopRole: {
      type: String,
      enum: ['owner', 'admin', 'sales_manager', 'moderator', 'app_manager', 'support', 'manager'],
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    avatar: {
      type: String,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: any) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Virtual for id field
userSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ whopId: 1 });
userSchema.index({ whopUserId: 1 });
userSchema.index({ whopCompanyId: 1 });
userSchema.index({ googleId: 1 });
// ✅ REFACTORED: Compound unique index for whopUserId + whopCompanyId (same user can exist in multiple companies)
userSchema.index({ whopUserId: 1, whopCompanyId: 1 }, { unique: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// ✅ REFACTORED: Static method to find user by Whop identifiers (primary method)
userSchema.statics.findByWhopIdentifiers = async function (
  whopUserId: string,
  whopCompanyId: string
): Promise<IUser | null> {
  return this.findOne({ whopUserId, whopCompanyId });
};

// ✅ REFACTORED: Static method to ensure user exists or create one
userSchema.statics.findOrCreateWhopUser = async function (data: {
  whopUserId: string;
  whopCompanyId: string;
  email?: string;
  name?: string;
  whopRole?: string;
  whopAuthorizedUserId?: string;
}): Promise<IUser> {
  let user = await this.findOne({ 
    whopUserId: data.whopUserId, 
    whopCompanyId: data.whopCompanyId 
  });

  if (!user) {
    const finalEmail = data.email || `whop_${data.whopUserId}_${data.whopCompanyId.slice(-6)}@paveos.app`;
    const finalName = data.name || data.email?.split('@')[0] || 'Whop User';

    user = await this.create({
      name: finalName,
      email: finalEmail,
      password: Math.random().toString(36).slice(-12), // Random password (won't be used)
      role: 'creator',  // Default internal role (not used for authorization)
      subscriptionPlan: 'Pro', // Whop users get Pro plan
      whopUserId: data.whopUserId,
      whopCompanyId: data.whopCompanyId,
      whopAuthorizedUserId: data.whopAuthorizedUserId,
      whopRole: data.whopRole,
    });
  }

  return user;
};

export const User = mongoose.model<IUser>('User', userSchema);
export default User;
