import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { CONSTANTS } from './constants.js';
import { User } from '../models/index.js';

// Only configure Google OAuth if credentials are provided
if (CONSTANTS.GOOGLE_CLIENT_ID && CONSTANTS.GOOGLE_CLIENT_SECRET && CONSTANTS.GOOGLE_CALLBACK_URL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: CONSTANTS.GOOGLE_CLIENT_ID,
        clientSecret: CONSTANTS.GOOGLE_CLIENT_SECRET,
        callbackURL: CONSTANTS.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: VerifyCallback
    ) => {
      try {
        console.log('Google OAuth - Profile received:', {
          id: profile.id,
          displayName: profile.displayName,
          emails: profile.emails,
          name: profile.name,
        });

        // Extract user information from Google profile
        const email = profile.emails?.[0]?.value;
        const displayName = profile.displayName;
        const givenName = profile.name?.givenName;
        const familyName = profile.name?.familyName;

        // Build full name from available data
        let name = displayName ||
                   (givenName && familyName ? `${givenName} ${familyName}` : givenName) ||
                   'Google User';

        console.log('Google OAuth - Extracted data:', { email, name });

        if (!email) {
          console.error('Google OAuth - No email in profile');
          return done(new Error('No email found in Google profile'), undefined);
        }

        if (!name || name.trim().length < 2) {
          console.error('Google OAuth - Invalid name:', name);
          return done(new Error('Invalid name from Google profile'), undefined);
        }

        // Check if user already exists
        let user = await User.findOne({ email });

        if (user) {
          console.log('Google OAuth - Existing user found:', user.email);

          // Update existing user with proper data
          const needsUpdate = !user.googleId || !user.name || !user.role;

          if (needsUpdate) {
            console.log('Google OAuth - Updating existing user with correct data');

            // Update with proper values
            if (!user.googleId) user.googleId = profile.id;
            if (!user.name || user.name.length < 2) user.name = name.trim();
            if (!user.role || !['creator', 'manager', 'admin'].includes(user.role as string)) {
              user.role = 'creator';
            }
            if (!user.subscriptionPlan) {
              user.subscriptionPlan = 'Starter';
            }

            await user.save({ validateBeforeSave: true });
            console.log('Google OAuth - User updated successfully');
          }

          return done(null, user);
        }

        console.log('Google OAuth - Creating new user');

        // Create new user if doesn't exist
        const userData = {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          googleId: profile.id,
          role: 'creator' as const,
          subscriptionPlan: 'Starter' as const,
          isEmailVerified: true,
        };

        console.log('Google OAuth - User data to create:', userData);

        user = await User.create(userData);

        console.log('Google OAuth - User created successfully:', user._id);

        return done(null, user);
      } catch (error: any) {
        console.error('Google OAuth error:', error.message || error);
        console.error('Error details:', error);
        return done(error, undefined);
      }
    }
    )
  );
  console.log('✅ Google OAuth strategy configured');
} else {
  console.warn('⚠️  Google OAuth not configured - missing credentials (this is fine for Whop-only auth)');
}

// Serialize user for session (not used in JWT auth, but required by passport)
passport.serializeUser((user: any, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
