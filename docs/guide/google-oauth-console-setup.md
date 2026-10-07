# Google OAuth Configuration - Visual Guide

## 🎯 What You Need to Configure

```
Google Cloud Console
    ↓
Your Project
    ↓
APIs & Services → Credentials
    ↓
OAuth 2.0 Client ID (Web application)
    ↓
Edit button (pencil icon)
    ↓
Two sections to configure:
├── Authorized JavaScript Origins
└── Authorized redirect URIs
```

---

## 📍 Exact Location in Google Cloud Console

### Navigation Path:

```
1. https://console.cloud.google.com/
   ↓
2. Select your project (top left dropdown)
   ↓
3. Click "APIs & Services" (left sidebar)
   ↓
4. Click "Credentials" (left sidebar)
   ↓
5. Under "OAuth 2.0 Client IDs", find "Web application"
   ↓
6. Click the entry OR click Edit (pencil icon)
```

---

## ⚙️ Configuration Settings

### For Local Development (http://localhost:3782)

#### Section 1: Authorized JavaScript Origins

```
┌─────────────────────────────────────┐
│ Authorized JavaScript origins       │
├─────────────────────────────────────┤
│ [Add URI button]                    │
│                                     │
│ URI entries:                        │
│ ✓ http://localhost:3782             │
│  [Remove]                           │
│                                     │
│ [Add URI] ← Click to add more      │
└─────────────────────────────────────┘
```

**Click [Add URI]** and enter:
```
http://localhost:3782
```

---

#### Section 2: Authorized redirect URIs

```
┌──────────────────────────────────────────┐
│ Authorized redirect URIs                 │
├──────────────────────────────────────────┤
│ [Add URI button]                         │
│                                          │
│ URI entries:                             │
│ ✓ http://localhost:3782/api/auth/...    │
│  [Remove]                                │
│                                          │
│ [Add URI] ← Click to add more           │
└──────────────────────────────────────────┘
```

**Click [Add URI]** and enter:
```
http://localhost:3782/api/auth/callback/google
```

---

## ✅ Checklist

Before saving, verify:

- [ ] JavaScript Origin = `http://localhost:3782` (no trailing slash)
- [ ] Redirect URI = `http://localhost:3782/api/auth/callback/google` (exact)
- [ ] Using `http://` for localhost (not https)
- [ ] Port 3782 is included
- [ ] No typos

---

## 💾 After Configuration

1. **Click SAVE** button (blue button at bottom)
2. **Wait 1-2 minutes** for changes to propagate
3. **Clear browser cache** (important!)
4. **Test** at http://localhost:3782

---

## 🔄 Side-by-Side Comparison

### ✅ CORRECT

```
JavaScript Origin:
  http://localhost:3782

Redirect URI:
  http://localhost:3782/api/auth/callback/google
```

### ❌ WRONG (Common Mistakes)

```
❌ http://localhost:3782/   (trailing slash)
❌ http://localhost         (missing port)
❌ https://localhost:3782   (https on localhost)
❌ http://127.0.0.1:3782    (use localhost, not IP)
❌ http://localhost:3000    (wrong port)
❌ http://localhost:3782/   (trailing slash)
❌ http://localhost:3782/auth/signin (wrong path)
```

---

## 💻 Your Configuration File

Your app is configured to use:

```env
# web/.env
NEXTAUTH_URL=http://localhost:3782
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

**These must match your Google Console settings!**

---

## 🧪 How to Test

1. **Start dev server:**
   ```bash
   cd /Users/tzeng/Development/DeepTutor/web
   npm run dev -- -p 3782
   ```

2. **Open browser:**
   ```
   http://localhost:3782
   ```
   Should redirect to `/auth/signin`

3. **Click "Sign in with Google"**
   Should redirect to Google login page

4. **Sign in with your Google account**
   Should redirect back to your app

5. **Verify success:**
   - Profile image shows
   - User name displays
   - You can access `/chat` route
   - Session persists on refresh

---

## 🚨 Common Errors & How to Fix

### Error 1: "redirect_uri_mismatch"

```
Error: invalid_request
Error description: redirect_uri_mismatch
```

**Cause:** URI in Google Console doesn't match NEXTAUTH_URL

**Fix:**
1. Check Google Console has: `http://localhost:3782/api/auth/callback/google`
2. Check `.env` has: `NEXTAUTH_URL=http://localhost:3782`
3. Make sure they match exactly (case-sensitive, no trailing slash)
4. Clear browser cache
5. Restart dev server

### Error 2: "CORS error"

```
Access to XMLHttpRequest blocked by CORS policy
```

**Cause:** JavaScript origin not configured

**Fix:**
1. Add Javascript Origin: `http://localhost:3782`
2. Click Save
3. Wait 1-2 minutes
4. Clear browser cache
5. Try again

### Error 3: Stuck on sign-in page

```
Click sign-in button but nothing happens
```

**Cause:** Usually Client ID/Secret issue

**Fix:**
1. Verify Client ID in `.env` is correct (copy from Google Console)
2. Verify Client Secret in `.env` is correct
3. Verify both are in `web/.env` (not just root `.env`)
4. Restart dev server
5. Clear browser cache

---

## 📱 Configuration for Different Environments

### Local Development

```
JavaScript Origin: http://localhost:3782
Redirect URI: http://localhost:3782/api/auth/callback/google
```

### Staging (example)

```
JavaScript Origin: https://staging.example.com
Redirect URI: https://staging.example.com/api/auth/callback/google
```

### Production

```
JavaScript Origin: https://yourdomain.com
Redirect URI: https://yourdomain.com/api/auth/callback/google
```

You can add ALL of them to Google Console:

```
JavaScript Origins:
  http://localhost:3782
  https://staging.example.com
  https://yourdomain.com

Redirect URIs:
  http://localhost:3782/api/auth/callback/google
  https://staging.example.com/api/auth/callback/google
  https://yourdomain.com/api/auth/callback/google
```

---

## 🎯 Verify Your Setup

After configuration, run this to verify:

```bash
# Check .env file has the values
cd /Users/tzeng/Development/DeepTutor/web
grep NEXTAUTH_URL .env
grep GOOGLE_CLIENT_ID .env
grep GOOGLE_CLIENT_SECRET .env

# Start dev server
npm run dev -- -p 3782

# In another terminal, test the URL
curl http://localhost:3782

# Should respond with HTML (not errors)
```

---

## ✨ Summary

**You must do TWO things in Google Cloud Console:**

1. **Authorized JavaScript Origins** → `http://localhost:3782`
2. **Authorized redirect URIs** → `http://localhost:3782/api/auth/callback/google`

That's it! Everything else is already configured. 🎉

