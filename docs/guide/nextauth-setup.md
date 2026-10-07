# NextAuth SSO with Google Setup Guide

This guide explains how to set up Google Single Sign-On (SSO) authentication for the DeepTutor application using NextAuth and MongoDB.

## Overview

The implementation includes:
- **NextAuth v5** for authentication management
- **Google OAuth 2.0** for single sign-on
- **MongoDB** for storing user sessions and account data
- **Prisma ORM** for database operations
- **Protected Routes** using NextAuth middleware

## Prerequisites

- Google Cloud Console account
- MongoDB Atlas account (or existing MongoDB instance)
- Node.js 18+ installed
- Environment variables configured

## Step 1: Set Up Google OAuth Credentials

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "DeepTutor")
3. Enable the **Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click it and select "Enable"

### 1.2 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Select "Web application"
4. Add authorized redirect URIs:
   ```
   http://localhost:3782/api/auth/callback/google
   http://localhost:3782/api/auth/callback/google/
   ```
   For production, add your domain:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```
5. Copy the **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

### 2.1 Update `.env.local` in the web folder

```dotenv
# Database
DATABASE_URL=mongodb+srv://your-db-user:your-db-password@cluster0.example.mongodb.net/novusorbit

# NextAuth
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3782

# Google OAuth (from Step 1.2)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2.2 Generate a New NEXTAUTH_SECRET (Optional)

For production, generate a new secret:
```bash
openssl rand -base64 32
```

## Step 3: Install Dependencies

```bash
cd web
npm install
```

This installs:
- `next-auth@5.0.0-beta.20` - Authentication library
- `@prisma/client` - Database ORM client
- `prisma` - ORM toolkit
- `bcryptjs` - Password hashing utility

## Step 4: Set Up the Database

### 4.1 Initialize Prisma and Create Database Schema

```bash
cd web
npx prisma migrate dev --name init
```

This:
- Creates the MongoDB collections (User, Account, Session, VerificationToken)
- Generates Prisma client

### 4.2 Verify Collections in MongoDB

The following collections are created:
- `User` - Stores user accounts
- `Account` - Stores OAuth provider accounts linked to users
- `Session` - Stores user sessions
- `VerificationToken` - For email verification (if needed)

## Step 5: Start the Application

```bash
# Install all dependencies
npm install

# Development server
npm run dev
```

The application will start:
- Frontend: http://localhost:3782
- Backend API: http://localhost:8001

## Step 6: Test the Authentication

1. Navigate to http://localhost:3782
2. You should be redirected to http://localhost:3782/auth/signin
3. Click "Sign in with Google"
4. Authenticate with your Google account
5. You'll be redirected back to the application

## File Structure

```
web/
├── app/
│   ├── api/auth/[...nextauth]/route.ts  # NextAuth route handler
│   ├── auth/
│   │   ├── signin/page.tsx              # Sign-in page
│   │   └── error/page.tsx               # Auth error page
│   ├── layout.tsx                       # Root layout (with Providers)
│   └── providers.tsx                    # SessionProvider wrapper
├── lib/
│   ├── auth.ts                          # NextAuth configuration
│   └── prisma.ts                        # Prisma client singleton
├── components/
│   └── UserSessionButton.tsx            # User profile & logout button
├── middleware.ts                         # Route protection middleware
├── prisma/
│   └── schema.prisma                    # Database schema
└── .env.local                           # Environment variables

root/
└── .env                                 # Shared environment variables
```

## API Routes

### Authentication Routes

- `GET/POST /api/auth/callback/google` - Google OAuth callback
- `GET /api/auth/signin` - Sign-in page
- `POST /api/auth/signin` - Sign-in submission
- `POST /api/auth/signout` - Sign-out endpoint
- `GET /api/auth/session` - Get current session
- `GET /api/auth/csrf` - CSRF token

## Protected Routes

The following routes are protected by middleware:

- `/chat`
- `/research`
- `/solve`
- `/interview`
- `/guide`
- `/question`
- `/settings`
- `/notebook`
- `/portfolio`
- `/co-writer`
- `/history`
- `/jobs`
- `/job-suggest`
- `/ideagen`

Unauthenticated users trying to access these routes will be redirected to `/auth/signin`.

## Components

### UserSessionButton Component

Use this component in your sidebar or header to display user information and logout button:

```tsx
import UserSessionButton from '@/components/UserSessionButton';

<UserSessionButton />
```

Features:
- Shows user avatar and name
- Dropdown menu with Settings and Sign Out options
- Shows user email in dropdown
- Responsive design

## Usage Examples

### Get Current Session in Client Component

```tsx
'use client';

import { useSession } from 'next-auth/react';

export default function MyComponent() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <p>Loading...</p>;
  if (!session) return <p>Not authenticated</p>;

  return <p>Hello {session.user?.name}!</p>;
}
```

### Get Session in Server Component

```tsx
import { auth } from '@/lib/auth';

export default async function MyServerComponent() {
  const session = await auth();

  if (!session) {
    return <p>Not authenticated</p>;
  }

  return <p>Hello {session.user?.name}!</p>;
}
```

### Add Custom User Fields

To add custom fields to the User model, update `prisma/schema.prisma`:

```prisma
model User {
  // ... existing fields ...
  subscription  String?       // "free", "pro", "enterprise"
  credits       Int?          @default(0)
}
```

Then run:
```bash
npx prisma migrate dev --name add_custom_fields
```

## Troubleshooting

### Issue: "Invalid client id or secret"

**Solution:**
- Verify Google Client ID and Secret are correct in `.env.local`
- Make sure the redirect URI in Google Console matches exactly (including trailing slash)
- Check that Google+ API is enabled in Google Cloud Console

### Issue: "Invalid callback URL"

**Solution:**
- Ensure `NEXTAUTH_URL` is set correctly in `.env.local`
- For localhost: `http://localhost:3782`
- For production: Use your actual domain (without trailing slash)

### Issue: "Database connection failed"

**Solution:**
- Verify MongoDB connection string is correct
- Ensure your IP is whitelisted in MongoDB Atlas Network Access
- Check database name in connection string

### Issue: Prisma client not found

**Solution:**
```bash
cd web
npx prisma generate
npm install
```

### Issue: NextAuth session not persisting

**Solution:**
- Make sure `Providers` component wraps the entire Layout
- Verify `NEXTAUTH_SECRET` is set
- Check browser cookies are not blocked

## Production Deployment

### Environment Variables for Production

```dotenv
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<production-secret>
GOOGLE_CLIENT_ID=<production-client-id>
GOOGLE_CLIENT_SECRET=<production-client-secret>
DATABASE_URL=<production-mongodb-uri>
```

### Update Google OAuth Credentials

1. Go to Google Cloud Console
2. Update Authorized redirect URIs to include production domain:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```

### Deploy to Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Security Considerations

1. **NEXTAUTH_SECRET**: Generate a strong random secret for production
2. **MongoDB Security**: Use strong passwords and IP whitelisting
3. **Google OAuth**: Keep Client Secret secure, never commit to version control
4. **HTTPS**: Always use HTTPS in production
5. **Session Security**: Sessions are stored in MongoDB, secure by default

## Backend Integration

To integrate with the Python backend (port 8001):

1. Update `NEXT_PUBLIC_API_BASE` in `.env.local`:
   ```
   NEXT_PUBLIC_API_BASE=http://localhost:8001
   ```

2. Include session token in API requests:
   ```tsx
   const { data: session } = useSession();
   
   const response = await fetch('http://localhost:8001/api/endpoint', {
     headers: {
       'Authorization': `Bearer ${session?.user?.id}`
     }
   });
   ```

3. Backend can validate user via NextAuth session/database

## Support & Resources

- [NextAuth Documentation](https://next-auth.js.org/)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)
