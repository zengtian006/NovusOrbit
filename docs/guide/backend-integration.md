# Backend Integration Guide

This guide shows how to integrate the NextAuth authentication with your Python backend API (port 8001).

## Overview

The NextAuth frontend handles authentication with Google. The backend can:
1. Verify user identity
2. Load user-specific data from MongoDB
3. Manage user files, settings, and preferences
4. Authenticate API requests using the session

## Architecture

```
Browser (authenticated with NextAuth)
    ↓
Next.js Frontend (3782)
    - Has access to session.user data
    - Stores sessionToken in httpOnly cookie
    ↓
Python Backend (8001)
    - Receives authenticated requests
    - Verifies user identity
    - Returns user-specific data
    ↓
MongoDB
    - User profiles (created by NextAuth)
    - User data (created by backend)
    - Shared data source
```

## Method 1: User ID in Request Header

### Frontend (Next.js/React)

```typescript
'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    const fetchUserData = async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/api/user-profile`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': session.user.id,
            'X-User-Email': session.user.email || '',
          },
        }
      );

      if (response.ok) {
        const userData = await response.json();
        setData(userData);
      }

      setLoading(false);
    };

    fetchUserData();
  }, [session]);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Welcome {session?.user?.name}!</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

### Backend (Python/FastAPI)

```python
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pymongo import MongoClient

app = FastAPI()

# MongoDB connection
client = MongoClient(os.getenv("DATABASE_URL"))
db = client["novusorbit"]
users_collection = db["User"]

@app.get("/api/user-profile")
async def get_user_profile(
    x_user_id: str = Header(None),
    x_user_email: str = Header(None)
):
    """
    Get user profile from MongoDB using ID from NextAuth session
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")

    # Find user in MongoDB
    user = users_collection.find_one({"_id": ObjectId(x_user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Remove MongoDB internal field
    user['_id'] = str(user['_id'])

    return JSONResponse({
        "id": user['_id'],
        "name": user.get("name"),
        "email": user.get("email"),
        "image": user.get("image"),
        "emailVerified": str(user.get("emailVerified")) if user.get("emailVerified") else None,
    })
```

## Method 2: Session Cookie

The browser automatically sends the session cookie. The backend can verify it by querying MongoDB.

### Backend (Python/FastAPI)

```python
from fastapi import FastAPI, Request
from mysql.bson import ObjectId

@app.get("/api/current-user")
async def get_current_user(request: Request):
    """
    Extract user from session cookie
    """
    # Get session token from cookies
    session_token = request.cookies.get("sessionToken")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Query MongoDB Session collection
    db = client["novusorbit"]
    sessions_collection = db["Session"]
    sessions_collection.sessions = db["Session"]

    session = sessions_collection.find_one({
        "sessionToken": session_token
    })

    if not session or session["expires"] < datetime.datetime.utcnow():
        raise HTTPException(status_code=401, detail="Session expired")

    # Get user from User collection
    user = db["User"].find_one({"_id": session["userId"]})

    return {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "image": user.get("image"),
    }
```

## Method 3: Backend Validation (Recommended for Security)

Verify the session exists and is valid before processing requests.

### Frontend

```typescript
'use client';

import { useSession } from 'next-auth/react';

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const { data: session } = useSession();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE}${endpoint}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': session?.user?.id || '',
        'X-Requested-At': new Date().toISOString(),
        ...options.headers,
      },
    }
  );

  if (response.status === 401) {
    // Session expired, redirect to login
    window.location.href = '/auth/signin';
  }

  return response;
}

// Usage
export async function getChat(chatId: string) {
  const response = await apiCall(`/api/chats/${chatId}`);
  return response.json();
}
```

### Backend

```python
from fastapi import FastAPI, Header, HTTPException
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

app = FastAPI()

@app.get("/api/chats/{chat_id}")
async def get_chat(
    chat_id: str,
    x_user_id: str = Header(None),
    x_requested_at: str = Header(None)
):
    """
    Get user's chat with validation
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    db = MongoClient(os.getenv("DATABASE_URL"))["novusorbit"]

    # Verify user exists in NextAuth User collection
    user = db["User"].find_one({"_id": ObjectId(x_user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Now load user-specific chat data
    # (assuming you have a separate Chats collection)
    chat = db["chats"].find_one({
        "_id": ObjectId(chat_id),
        "user_id": ObjectId(x_user_id)
    })

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    chat["_id"] = str(chat["_id"])
    chat["user_id"] = str(chat["user_id"])

    return chat
```

## Storing Additional User Data

### Extend User Model in MongoDB

While NextAuth creates the User collection, you can store additional user data:

```python
# Backend - Create user preferences
@app.post("/api/user-preferences")
async def save_preferences(
    preferences: dict,
    x_user_id: str = Header(None)
):
    db = MongoClient(os.getenv("DATABASE_URL"))["novusorbit"]
    
    # Update or create user preferences
    db["user_preferences"].update_one(
        {"user_id": ObjectId(x_user_id)},
        {
            "$set": {
                "user_id": ObjectId(x_user_id),
                "preferences": preferences,
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )

    return {"status": "saved"}
```

### Frontend - Load Preferences

```typescript
'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [preferences, setPreferences] = useState(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/user-preferences`, {
      headers: {
        'X-User-ID': session.user.id,
      },
    })
      .then(r => r.json())
      .then(setPreferences);
  }, [session]);

  return <div>{JSON.stringify(preferences)}</div>;
}
```

## Common User Data to Store

```python
# Suggested collections and schemas

# NextAuth creates (don't modify directly):
# - User (id, name, email, image, emailVerified)
# - Account (OAuth tokens)
# - Session (sessionToken, expires)

# Your backend can create:
# - UserProfile (tier, credits, preferences)
# - UserStats (chats created, research performed)
# - UserFiles (uploaded documents, notebooks)
# - UserSessions (chat history, research history)
# - UserNotebookS (created notebooks)

# Example UserProfile document:
{
  "_id": ObjectId,
  "user_id": ObjectId,  # Reference to User._id
  "subscription_tier": "free",  # free, pro, enterprise
  "credits": 100,
  "api_calls_made": 42,
  "last_active": ISODate,
  "language_preference": "en",
  "theme": "light",
  "created_at": ISODate
}
```

## Protected API Endpoint Pattern

```python
from fastapi import FastAPI, Depends, HTTPException, Header
from functools import lru_cache
from pymongo import MongoClient
from bson import ObjectId

class AuthException(HTTPException):
    def __init__(self):
        super().__init__(status_code=401, detail="Unauthorized")

async def verify_user(x_user_id: str = Header(None)) -> str:
    """Dependency for protected endpoints"""
    if not x_user_id:
        raise AuthException()
    
    db = MongoClient(os.getenv("DATABASE_URL"))["novusorbit"]
    user = db["User"].find_one({"_id": ObjectId(x_user_id)})
    
    if not user:
        raise AuthException()
    
    return x_user_id

@app.get("/api/protected-endpoint")
async def protected_endpoint(user_id: str = Depends(verify_user)):
    """This endpoint requires valid NextAuth session"""
    db = MongoClient(os.getenv("DATABASE_URL"))["novusorbit"]
    
    # Load user data
    user = db["User"].find_one({"_id": ObjectId(user_id)})
    
    # Load user-specific data
    user_data = db["UserProfile"].find_one({"user_id": ObjectId(user_id)})
    
    return {
        "user": user,
        "profile": user_data
    }
```

## CORS Configuration

If frontend and backend are on different ports, configure CORS:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3782",      # Development
        "https://yourdomain.com",     # Production
    ],
    allow_credentials=True,  # Important for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Logging User Actions

```python
@app.post("/api/log-action")
async def log_action(
    action: str,
    details: dict = None,
    x_user_id: str = Header(None)
):
    """Log user actions to database"""
    db = MongoClient(os.getenv("DATABASE_URL"))["novusorbit"]
    
    db["user_logs"].insert_one({
        "user_id": ObjectId(x_user_id),
        "action": action,
        "details": details,
        "timestamp": datetime.utcnow(),
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent")
    })

    return {"logged": True}
```

## Testing

```python
# Test with curl
curl -H "X-User-ID: 507f1f77bcf86cd799439011" \
     http://localhost:8001/api/user-profile

# Test with Python
import requests

headers = {
    "X-User-ID": "507f1f77bcf86cd799439011",
    "X-User-Email": "user@example.com"
}

response = requests.get(
    "http://localhost:8001/api/user-profile",
    headers=headers
)
print(response.json())
```

## Summary

1. **Frontend passes user ID**: Use `session.user.id` from NextAuth
2. **Backend verifies user**: Query MongoDB User collection
3. **Backend loads user data**: Create custom collections for extended data
4. **Maintain separation**: Don't modify NextAuth collections directly
5. **Security first**: Always verify user identity server-side

This approach ensures:
- ✅ Strong authentication (Google OAuth)
- ✅ Secure session management (MongoDB)
- ✅ Custom user data (backend collections)
- ✅ Scalability (can migrate to microservices)
