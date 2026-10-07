# Login Flow Diagram

## User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser/User                              │
│                                                                   │
│  Step 1: Visit http://localhost:3782                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              Next.js Middleware (middleware.ts)                  │
│                                                                   │
│  Check: Is sessionToken in cookies? Is it valid?               │
│  No → Redirect to /auth/signin                                  │
│  Yes → Allow access to page                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│            Sign-In Page (app/auth/signin/page.tsx)              │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Welcome to NovusOrbit                                  │   │
│  │  [Sign in with Google] ← Click here                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│       NextAuth Route Handler                                     │
│       (/api/auth/signin/google)                                 │
│                                                                   │
│  signIn("google") → Redirects to Google Login                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Google OAuth 2.0                              │
│                                                                   │
│  1. User authenticates with Google                              │
│  2. Google returns authorization code                           │
│  3. NextAuth exchanges code for tokens at backend               │
│  4. NextAuth fetches user profile from Google                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│               MongoDB (NextAuth Collections)                     │
│                                                                   │
│  Check if user exists by email:                                 │
│  - No user → Create new User                                    │
│  - User exists → Link Google Account                            │
│                                                                   │
│  Insert into Account collection:                                │
│  {                                                               │
│    userId: ObjectId,                                            │
│    provider: "google",                                          │
│    providerAccountId: "google123",                              │
│    access_token: "ya29.a0...",                                 │
│    ...                                                           │
│  }                                                               │
│                                                                   │
│  Create Session:                                                │
│  {                                                               │
│    sessionToken: "abc123...",                                   │
│    userId: ObjectId,                                            │
│    expires: Date (30 days)                                      │
│  }                                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              NextAuth Callback Route                             │
│         (/api/auth/callback/google)                             │
│                                                                   │
│  Set sessionToken cookie (httpOnly, Secure)                     │
│  Redirect to callbackUrl (default: /chat)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              Browser Receives Cookie                             │
│                                                                   │
│  Cookie stored: sessionToken=abc123...                          │
│  (httpOnly - JavaScript cannot access)                          │
│                                                                   │
│  Redirect to /chat                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                 Authenticated Session                            │
│                                                                   │
│  useSession() returns:                                          │
│  {                                                               │
│    user: {                                                       │
│      id: "507f1f77bcf86cd799439011",                           │
│      name: "John Doe",                                          │
│      email: "john@gmail.com",                                   │
│      image: "https://..."                                       │
│    },                                                            │
│    expires: "2026-03-11T..."                                    │
│  }                                                               │
│                                                                   │
│  User can now access protected pages ✅                         │
└─────────────────────────────────────────────────────────────────┘
```

## Database State After Login

```
MongoDB Collections
├── User
│   └── {
│       _id: ObjectId("507f1f77bcf86cd799439011"),
│       name: "John Doe",
│       email: "john@gmail.com", ← Unique, used to prevent duplicates
│       image: "https://lh3.GoogleUserContent.com/...",
│       emailVerified: null,
│       createdAt: ISODate("2026-02-09T..."),
│       updatedAt: ISODate("2026-02-09T...")
│     }
│
├── Account
│   └── {
│       _id: ObjectId("507f1f77bcf86cd799439012"),
│       userId: ObjectId("507f1f77bcf86cd799439011"), ← Links to User
│       type: "oauth",
│       provider: "google",
│       providerAccountId: "118067246...", ← Google user ID
│       access_token: "ya29.a0AfH6SMBx...", ← For API calls
│       token_type: "Bearer",
│       expires_at: 1644379200,
│       refresh_token: "1//0gw...", ← To refresh access token
│       scope: "openid profile email",
│       session_state: "..."
│     }
│
└── Session
    └── {
        _id: ObjectId("507f1f77bcf86cd799439013"),
        sessionToken: "c2ca0dcb2b63e0b3ae...", ← Sent to browser
        userId: ObjectId("507f1f77bcf86cd799439011"), ← Links to User
        expires: ISODate("2026-03-11T..."), ← 30 days from now
        createdAt: ISODate("2026-02-09T...")
      }
```

## On Each Page Load (After Login)

```
Browser sends request
         ↓
Cookie includes: sessionToken=c2ca0dcb2b63e0b3ae...
         ↓
Middleware intercepts:
  - Reads sessionToken from cookies
  - Queries MongoDB Session collection
  - Validates token not expired
         ↓
If valid:
  - NextAuth loads User data from database
  - useSession() returns user info
  - Page renders ✅
         ↓
If invalid/expired:
  - Delete Session from MongoDB
  - Clear cookie
  - Redirect to /auth/signin
```

## Sign Out Flow

```
User clicks "Sign Out"
         ↓
signOut({ callbackUrl: '/auth/signin' })
         ↓
POST /api/auth/signout
         ↓
NextAuth:
  1. Deletes Session from MongoDB
  2. Clears sessionToken cookie
  3. Redirects to /auth/signin
         ↓
Browser:
  - Session cookie removed
  - No longer has valid sessionToken
  - Cannot access protected routes
         ↓
Trying to access /chat:
  - Middleware finds no valid session
  - Redirects to /auth/signin
```

## Component Interaction

```
┌──────────────────────────────────────────────────────────────┐
│            Web App Layout (app/layout.tsx)                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  <Providers> (app/providers.tsx)                     │   │
│  │                                                        │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  <SessionProvider>                             │  │   │
│  │  │  (from 'next-auth/react')                      │  │   │
│  │  │                                                  │  │   │
│  │  │  ┌──────────────────────────────────────────┐  │  │   │
│  │  │  │ <GlobalProvider>                          │  │  │   │
│  │  │  │ <I18nClientBridge>                        │  │  │   │
│  │  │  │ <LayoutWrapper>                           │  │  │   │
│  │  │  │                                            │  │  │   │
│  │  │  │ ┌────────────────────────────────────┐   │  │  │   │
│  │  │  │ │ <Sidebar>                          │   │  │  │   │
│  │  │  │ │ └─ <UserSessionButton> (logout)    │   │  │  │   │
│  │  │  │ └────────────────────────────────────┘   │  │  │   │
│  │  │  │                                            │  │  │   │
│  │  │  │ ┌────────────────────────────────────┐   │  │  │   │
│  │  │  │ │ <main>                             │   │  │  │   │
│  │  │  │ │ └─ {children}                      │   │  │  │   │
│  │  │  │ │    - /chat                         │   │  │  │   │
│  │  │  │ │    - /research                     │   │  │  │   │
│  │  │  │ │    - /solve                        │   │  │  │   │
│  │  │  │ │    - etc (all protected)           │   │  │  │   │
│  │  │  │ └────────────────────────────────────┘   │  │  │   │
│  │  │  └──────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  Key Point: SessionProvider must be outermost                │
│  so useSession() works in all child components               │
└──────────────────────────────────────────────────────────────┘
```

## API Data Flow (Frontend to Backend)

```
Frontend Component
         ↓
const { data: session } = useSession()
         ↓
Fetch with Auth Header:
  fetch('http://localhost:8001/api/endpoint', {
    headers: {
      'X-User-ID': session.user.id,
      'X-User-Email': session.user.email
    }
  })
         ↓
Backend (Python):
  @app.get("/api/endpoint")
  async def endpoint(x_user_id: str = Header(None)):
    # 1. Verify user exists in MongoDB
    user = db.User.find_one({"_id": ObjectId(x_user_id)})
    
    # 2. Load user-specific data
    data = db.UserData.find_one({"user_id": ObjectId(x_user_id)})
    
    # 3. Return user-specific response
    return data
```

## Session Lifecycle

```
Timeline:

T0: User signs in
  - Session created in MongoDB with expires = T0 + 30 days

T1: User navigates pages (within 30 days)
  - sessionToken cookie sent with every request
  - Middleware validates session
  - Session is valid, page loads ✅

T30: 30 days pass
  - Next request with sessionToken
  - Middleware checks: is expired?
  - Session deleted from MongoDB
  - Cookie cleared
  - Redirected to /auth/signin
  - User must sign in again

OR

T5: User clicks Sign Out (within 30 days)
  - POST /api/auth/signout
  - Session immediately deleted from MongoDB
  - Cookie cleared
  - Redirected to /auth/signin
```

## Failed Authentication Examples

```
Scenario 1: Invalid Session Token
  Request: GET /chat?sessionToken=invalid123
  Middleware: Query Session where sessionToken = 'invalid123'
  Result: No document found
  Action: Redirect to /auth/signin ❌

Scenario 2: Expired Session
  Request: GET /chat (sessionToken=abc123)
  Middleware: Find Session, check expires date
  Result: current_time > session.expires
  Action: Delete Session, clear cookie, redirect to /auth/signin ❌

Scenario 3: No Session Token
  Request: GET /chat (no sessionToken cookie)
  Middleware: Check for sessionToken in cookie
  Result: Not found
  Action: Redirect to /auth/signin ❌

Scenario 4: User Deleted
  Request: GET /chat (sessionToken=abc123)
  Middleware: Find Session, load User
  Result: User doesn't exist in MongoDB
  Action: Delete Session, redirect to /auth/signin ❌
```

## Network Requests (Inspector View)

```
1st request (not signed in):
  GET http://localhost:3782/chat
  
  Response Headers:
    location: http://localhost:3782/auth/signin

2nd request (click sign in):
  GET http://localhost:3782/auth/signin/google
  
  Response Headers:
    location: https://accounts.google.com/o/oauth2/v2/auth?...

3rd request (auth callback):
  GET http://localhost:3782/api/auth/callback/google?code=...&state=...
  
  Response Headers:
    set-cookie: sessionToken=...; HttpOnly; Secure; SameSite=Lax
    location: http://localhost:3782/chat

4th request (after sign in):
  GET http://localhost:3782/chat
  
  Request Cookies:
    sessionToken=abc123...
  
  Response Status: 200 OK
  Page Content: Renders successfully ✅
```

---

## Quick Summary

1. **Sign In**: User clicks Google → Redirected to Google → Returns to app with sessionToken cookie
2. **Session Stored**: sessionToken + userId + expiry stored in MongoDB Session collection
3. **Protected Routes**: Middleware checks if sessionToken is valid before allowing access
4. **useSession()**: Returns user data from database (name, email, image, id)
5. **Sign Out**: Deletes Session from MongoDB, clears cookie
6. **Integration**: Pass user.id in headers to Python backend for authorization

