# Authentication Documentation

## Overview

Tokyo Apartment Finder uses NextAuth.js with a credential provider for authentication. This implementation provides email/password authentication with email verification and password reset functionality.

## Authentication Flow

### 1. Registration Flow
1. User fills out registration form with email, password, and optional name
2. Password is validated against strength requirements
3. Password is hashed using bcrypt (10 salt rounds)
4. User account is created in the database
5. 6-digit verification code is generated and stored
6. User is redirected to verification page
7. After entering the correct code, email is marked as verified

### 2. Sign In Flow
1. User enters email and password
2. Credentials are validated
3. Password is compared against stored hash
4. If email is not verified, user is redirected to verification page
5. JWT session is created upon successful authentication

### 3. Password Reset Flow
1. User requests password reset with email
2. 6-digit reset code is generated with 1-hour expiry
3. User enters reset code and new password
4. New password is validated and hashed
5. Password is updated in database

## Technical Implementation

### Database Schema

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String?   // For credential-based authentication
  image         String?
  emailVerified DateTime?
  role          UserRole  @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations...
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Security Features

1. **Password Hashing**: bcryptjs with 10 salt rounds
2. **Session Strategy**: JWT tokens for stateless authentication
3. **Email Verification**: Required before first sign-in
4. **Rate Limiting**: Can be enabled via environment variables
5. **Secure Tokens**: 6-digit codes for verification and reset

## API Endpoints

### tRPC Procedures

#### `auth.register`
- **Input**: email, password, name (optional)
- **Output**: success, message, userId, email
- **Description**: Creates new user account and sends verification code

#### `auth.verifyEmail`
- **Input**: email, code
- **Output**: success, message
- **Description**: Verifies user email with 6-digit code

#### `auth.requestPasswordReset`
- **Input**: email
- **Output**: success, message
- **Description**: Generates password reset token

#### `auth.resetPassword`
- **Input**: email, token, newPassword
- **Output**: success, message
- **Description**: Resets user password with valid token

#### `auth.checkEmail`
- **Input**: email
- **Output**: available (boolean)
- **Description**: Checks if email is already registered

## Environment Variables

```env
# Required
AUTH_SECRET=""              # NextAuth secret for JWT signing
NEXTAUTH_URL=""            # Application URL for callbacks

# Optional (for production email sending)
EMAIL_SERVER_HOST=""       # SMTP host
EMAIL_SERVER_PORT=""       # SMTP port
EMAIL_SERVER_USER=""       # SMTP username
EMAIL_SERVER_PASSWORD=""   # SMTP password
EMAIL_FROM=""             # From email address
```

## Pages

### `/auth/signin`
- Email/password sign-in form
- Link to sign up and forgot password
- Redirects to home on success

### `/auth/signup`
- Registration form with password requirements
- Email validation
- Redirects to verification page

### `/auth/verify-email`
- 6-digit code input
- Resend code functionality (TODO)
- Redirects to sign-in on success

### `/auth/forgot-password`
- Email input for reset request
- Shows success message
- Link to enter reset code

### `/auth/reset-password`
- Reset code and new password input
- Password validation
- Redirects to sign-in on success

## Migration Guide from OAuth

### For Existing Users

1. **No Existing Password Users**:
   - Users who signed up with Google OAuth won't have passwords
   - They need to use "Forgot Password" to set an initial password
   - Their email is already verified from OAuth

2. **Database Migration**:
   ```bash
   # The password field has been added to User model
   npx prisma db push
   ```

3. **Environment Variables**:
   - Remove: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
   - Add: `NEXTAUTH_URL`
   - Keep: `AUTH_SECRET`

### For New Deployments

1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. (Optional) Set up SMTP for email sending

## Development Notes

### Current Limitations

1. **Email Sending**: Currently returns verification codes in response (remove in production)
2. **Resend Functionality**: Not yet implemented
3. **Rate Limiting**: Basic implementation, enhance for production
4. **Session Management**: No "remember me" functionality yet

### Security Considerations

1. **Production Checklist**:
   - [ ] Remove verification code from API responses
   - [ ] Implement proper email sending
   - [ ] Add rate limiting to auth endpoints
   - [ ] Enable CSRF protection
   - [ ] Add account lockout after failed attempts
   - [ ] Implement 2FA (optional)

2. **OWASP Compliance**:
   - Passwords are hashed with bcrypt
   - Secure random tokens for verification
   - Session tokens expire after 30 days
   - Email verification required

### Testing Authentication

```typescript
// Example: Testing registration
const result = await trpc.auth.register.mutate({
  email: "test@example.com",
  password: "SecurePass123!",
  name: "Test User"
});

// Example: Testing sign in
const session = await signIn("credentials", {
  email: "test@example.com",
  password: "SecurePass123!",
  redirect: false
});
```

## Troubleshooting

### Common Issues

1. **"Invalid email or password"**
   - Check email exists in database
   - Verify password meets requirements
   - Ensure email is verified

2. **"Email not verified"**
   - Check VerificationToken table
   - Ensure token hasn't expired
   - Try resending verification code

3. **Session issues**
   - Clear browser cookies
   - Check AUTH_SECRET is set
   - Verify NEXTAUTH_URL matches current URL

### Debug Mode

Enable debug mode in development:
```typescript
// src/server/auth/config.ts
debug: process.env.NODE_ENV === "development",
```

## Future Enhancements

1. **OAuth Integration**: Re-add Google/GitHub OAuth alongside credentials
2. **Magic Links**: Passwordless authentication option
3. **2FA Support**: TOTP/SMS verification
4. **Account Management**: Profile updates, email changes
5. **Admin Panel**: User management interface

---

Last Updated: 2025-01-18