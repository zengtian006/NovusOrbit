# Google OAuth SSO Architecture

This document explains the architecture and data flow of the NextAuth Google OAuth implementation.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  - Stores session cookie (sessionToken)                         │
│  - SessionProvider in React Context                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Next.js Frontend (3782)                         │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Middleware (middleware.ts)                              │  │
│  │  - Protects routes: /chat, /research, /solve, etc       │  │
│  │  - Redirects to /auth/signin if not authenticated       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SessionProvider (providers.tsx)                         │  │
│  │  - Wraps entire app                                     │  │
│  │  - Provides useSession() hook                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Components                                              │  │
│  │  - Page.tsx (protected pages)                           │  │
│  │  - UserSessionButton (show user, logout)                │  │
│  │  - Special pages: /auth/signin, /auth/error             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│       NextAuth API Routes (api/auth/[...nextauth])               │
│                                                                    │
│  Configuration: lib/auth.ts                                       │
│  - Providers: GoogleProvider                                      │
│  - Adapter: PrismaAdapter (MongoDB)                              │
│  - Callbacks: signin, session, jwt                                │
│  - Session Strategy: database (not JWT)                          │
└──────────────────────────────────────────────────────────────────┘
           ↙                                        ↘
    ┌──────────────────┐              ┌──────────────────┐
    │  Google OAuth    │              │   MongoDB Atlas   │
    │                  │              │                  │
    │ - Sign In        │              │  Collections:    │
    │ - Tokens         │              │  - User          │
    │ - User Profile   │              │  - Account       │
    │                  │              │  - Session       │
    └──────────────────┘              └──────────────────┘
```

## Authentication Flow

### 1. User Clicks "Sign in with Google"

```
User clicks sign-in button
         ↓
POST /api/auth/signin/google
         ↓
Redirects to Google login page
```

### 2. Google OAuth Exchange

```
User authenticates with Google
         ↓
Google returns authorization code
         ↓
NextAuth exchanges code for tokens (at backend)
         ↓
NextAuth fetches user profile from Google
```

### 3. User Creation/Association

```
User profile received from Google
         ↓
Check if user exists in MongoDB
         ↓
If NO: Create new User and Account records
If YES: Update Account with latest tokens
         ↓
Create Session in MongoDB
         ↓
Return sessionToken to browser
```

### 4. Session Management

```
Browser stores sessionToken in httpOnly cookie
         ↓
On page navigation:
  - Middleware checks for valid session
  - Validates sessionToken against MongoDB Sessions table
         ↓
useSession() hook returns user data from Session
```

### 5. Sign Out

```
User clicks "Sign Out" button
         ↓
POST /api/auth/signout
         ↓
Delete Session from MongoDB
         ↓
Clear sessionToken cookie
         ↓
Redirect to /auth/signin
```

## Data Models

### User Collection

```javascript
{
  _id: ObjectId,
  name: "John Doe",              // From Google profile
  email: "john@gmail.com",        // From Google profile
  emailVerified: ISODate,         // When email was verified
  image: "https://...",           // Google profile picture
  createdAt: ISODate,
  updatedAt: ISODate
}
```

### Account Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,               // Reference to User
  type: "oauth",                  // Type of provider
  provider: "google",             // Provider name
  providerAccountId: "google123", // Google user ID
  access_token: "ya29.a0...",    // OAuth access token
  token_type: "Bearer",
  expires_at: 1234567890,         // Token expiry timestamp
  refresh_token: "1//0...",       // Google refresh token
  id_token: "eyJhbGc...",        // JWT from Google
  scope: "openid profile email",  // OAuth scopes
  session_state: "hash123"        // OAuth state parameter
}
```

### Session Collection

```javascript
{
  _id: ObjectId,
  sessionToken: "abc123...",      // Unique token sent to browser
  userId: ObjectId,               // Reference to User
  expires: ISODate,               // When session expires (30 days)
  createdAt: ISODate              // When session was created
}
```

## Protected Routes

When a user tries to access a protected route:

```
Browser requests /chat
         ↓
Middleware intercepts request
         ↓
Reads sessionToken from cookie
         ↓
Database lookup: SELECT * FROM Session WHERE sessionToken = ?
         ↓
If valid and not expired:
  - Middleware allows request
  - Component receives useSession() data
  
If invalid or expired:
  - Middleware redirects to /auth/signin
```

## Key Features

| Feature | Implementation |
|---------|-----------------|
| **OAuth Provider** | Google (GoogleProvider from next-auth) |
| **Session Storage** | MongoDB (Prisma Adapter) |
| **Session Strategy** | Database (not JWT) |
| **User Identity** | Email address is unique identifier |
| **Token Management** | Auto-refresh via OAuth tokens |
| **CSRF Protection** | Built-in NextAuth CSRF tokens |
| **Secure Cookies** | httpOnly, Secure, SameSite=Lax |

## Environment Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=123...
GOOGLE_CLIENT_SECRET=abc...

# NextAuth
NEXTAUTH_URL=http://localhost:3782
NEXTAUTH_SECRET=random-secret-key

# Database
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/db
```

## Security Considerations

1. **NEXTAUTH_SECRET**: Critical for token signing. Must be different per environment.
2. **MongoDB**: User accounts and sessions stored securely.
3. **OAuth Tokens**: Stored hashed in database (Google handles token security).
4. **httpOnly Cookies**: Session tokens cannot be accessed via JavaScript (CSRF protection).
5. **Token Refresh**: Google tokens auto-refresh when expired.
6. **Logout**: Sessions permanently deleted from database on sign-out.

## Integration with Backend

To integrate with Python backend (port 8001):

```typescript
// In a client component
const { data: session } = useSession();

// Add Authorization header
const response = await fetch('http://localhost:8001/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${session?.user?.id}`,
    // Or pass entire session
    'X-User-Email': session?.user?.email
  }
});
```

The backend can:
1. Verify user ID/email against MongoDB
2. Make calls back to NextAuth API to validate sessions
3. Load user-specific data from MongoDB

## Session Lifecycle

1. **Login**: User signs in → Session created (30 days TTL)
2. **Active**: Each request validates sessionToken
3. **Idle**: Session persists unless explicitly signed out
4. **Expired**: Database cleanup removes expired sessions
5. **Logout**: User signed out → Session immediately deleted

## File Structure Summary

```
web/
├── lib/
│   ├── auth.ts              # NextAuth configuration
│   ├── prisma.ts            # Prisma singleton
├── prisma/
│   └── schema.prisma        # Database schema (User, Account, Session)
├── app/
│   ├── providers.tsx        # SessionProvider wrapper
│   ├── api/auth/[...nextauth]/route.ts  # NextAuth routes
│   └── auth/
│       ├── signin/page.tsx  # Sign-in UI
│       └── error/page.tsx   # Error handling
├── middleware.ts            # Route protection
└── components/
    └── UserSessionButton.tsx # User profile dropdown
```

## Troubleshooting Data Flow

### Issue: Session not persisting

Check:
1. ✓ Browser cookies enabled
2. ✓ NEXTAUTH_SECRET set in env
3. ✓ MongoDB connection working
4. ✓ Providers wraps Layout
5. ✓ SessionProvider configured

### Issue: User profile not loading

Check:
1. ✓ Google OAuth tokens stored in Account
2. ✓ User record exists in MongoDB
3. ✓ useSession() hook used in client component
4. ✓ SessionProvider available in component tree

### Issue: Token refresh failing

Check:
1. ✓ Google refresh_token stored in Account
2. ✓ Token not expired (compare expires_at with current timestamp)
3. ✓ Google OAuth scopes include offline access

