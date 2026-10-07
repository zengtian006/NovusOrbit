# Google OAuth: Setting Up Authorized Origins and Redirect URIs

This guide walks you through configuring the Authorized JavaScript origins and Authorized redirect URIs in Google Cloud Console for your NextAuth Google SSO setup.

---

## 📋 Overview

For Google OAuth to work, you need to:
1. **Authorized JavaScript Origins** - Domains where your app is hosted (for CORS requests)
2. **Authorized redirect URIs** - URLs where Google can send users after authentication

---

## 🔧 Step-by-Step Setup

### Step 1: Open Google Cloud Console

1. Go to: https://console.cloud.google.com/
2. Select your project (or create one)
3. In the sidebar, click **APIs & Services** → **Credentials**

### Step 2: Find Your OAuth Client

1. Under "Credentials" tab, look for your **OAuth 2.0 Client ID**
2. It should be labeled "Web application"
3. Click on it to edit
   - Alternatively, click the **Edit** button (pencil icon)

### Step 3: Configure for Local Development

#### Authorized JavaScript Origins

For **localhost development**, add:

```
http://localhost:3782
```

Click **Add URI** button for each one.

**Note**: 
- Use `http://` for localhost (HTTPS not required)
- Include the port number (3782)
- Do NOT include `/api/auth/...` path here - just the domain

#### Authorized redirect URIs

For **localhost development**, add:

```
http://localhost:3782/api/auth/callback/google
```

Click **Add URI** button.

**Format**:
- Protocol: `http://` (localhost) or `https://` (production)
- Domain: `localhost` or your domain
- Port: `:3782` (your frontend port)
- Path: `/api/auth/callback/google` (exactly this)

---

## 🌍 Configuration Examples

### Local Development

**Authorized JavaScript Origins:**
```
http://localhost:3782
```

**Authorized redirect URIs:**
```
http://localhost:3782/api/auth/callback/google
```

### Staging Environment

**Authorized JavaScript Origins:**
```
https://staging.yourdomain.com
```

**Authorized redirect URIs:**
```
https://staging.yourdomain.com/api/auth/callback/google
```

### Production Environment

**Authorized JavaScript Origins:**
```
https://yourdomain.com
```

**Authorized redirect URIs:**
```
https://yourdomain.com/api/auth/callback/google
```

### Multiple Environments (Keep All)

You can have multiple origins and URIs for different environments. Google Console allows you to add multiple:

**Authorized JavaScript Origins:**
```
http://localhost:3782
https://staging.yourdomain.com
https://yourdomain.com
```

**Authorized redirect URIs:**
```
http://localhost:3782/api/auth/callback/google
https://staging.yourdomain.com/api/auth/callback/google
https://yourdomain.com/api/auth/callback/google
```

---

## ✅ Common Issues & Solutions

### Issue 1: "redirect_uri_mismatch"

**Error message:**
```
The redirect_uri does not match the registered Redirect URI.
```

**Causes:**
- Typo in the URI
- Missing port number (e.g., forgot `:3782`)
- Using `https://` when should be `http://` (or vice versa)
- Case mismatch (should be lowercase)
- Extra trailing slash

**Solution:**
- Check your `.env` file:
  ```env
  NEXTAUTH_URL=http://localhost:3782
  ```
- Make sure it matches EXACTLY what's in Google Console
- No trailing slashes!

### Issue 2: CORS Error

**Error message:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Cause:**
- JavaScript origin not configured

**Solution:**
- Add the JavaScript origin:
  ```
  http://localhost:3782
  ```
- Wait 1-2 minutes for changes to propagate

### Issue 3: "localhost" vs "127.0.0.1"

**Error:** Works with `localhost:3782` but not `127.0.0.1:3782`

**Solution:**
- Add both if you need to support both:
  ```
  http://localhost:3782
  http://127.0.0.1:3782
  ```

### Issue 4: www vs non-www Domain

**Support both:**
```
https://yourdomain.com
https://www.yourdomain.com
```

---

## 🔍 Verification Checklist

After configuring, verify:

- [x] JavaScript Origins include your domain
- [x] Redirect URIs include `/api/auth/callback/google`
- [x] NEXTAUTH_URL matches JavaScript origin
- [x] No typos or case mismatches
- [x] Port number included (if applicable)
- [x] Protocol is correct (http vs https)
- [x] No trailing slashes
- [x] Settings saved (click Save button)

---

## 📍 Exact Path to Settings

1. **Google Cloud Console**: https://console.cloud.google.com/
2. **Select Project** → Your DeepTutor project
3. **Left Sidebar** → APIs & Services
4. **Click** → Credentials
5. **Under "OAuth 2.0 Client IDs"** → Click your "Web application" entry
6. **Edit dialog opens** → Scroll down to:
   - "Authorized JavaScript origins"
   - "Authorized redirect URIs"
7. **Add/Edit URIs** → Click "Add URI"
8. **Save** → Click the blue "SAVE" button at bottom

---

## 🎯 Your Current Setup

Based on your configuration:

**Environment File** (`web/.env`):
```env
NEXTAUTH_URL=http://localhost:3782
GOOGLE_CLIENT_ID=388257661210-...
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

**Required in Google Console:**

✅ **Authorized JavaScript Origins:**
```
http://localhost:3782
```

✅ **Authorized redirect URIs:**
```
http://localhost:3782/api/auth/callback/google
```

---

## 📱 For Mobile Testing

If you want to test on mobile connected to your dev machine:

1. Find your machine's IP: `ipconfig getifaddr en0` (macOS)
2. Add to Google Console:
   - **JavaScript Origin**: `http://YOUR_IP:3782`
   - **Redirect URI**: `http://YOUR_IP:3782/api/auth/callback/google`
3. Open on mobile: `http://YOUR_IP:3782`

---

## 🚀 Production Deployment

When deploying to production:

1. **Update Google Console** with production domain:
   ```
   https://yourdomain.com
   https://yourdomain.com/api/auth/callback/google
   ```

2. **Update environment variables**:
   ```env
   NEXTAUTH_URL=https://yourdomain.com
   GOOGLE_CLIENT_ID=your-production-id (may differ)
   GOOGLE_CLIENT_SECRET=your-production-secret
   ```

3. **Keep localhost** for continued local development:
   ```
   http://localhost:3782
   http://localhost:3782/api/auth/callback/google
   ```

4. **Wait for propagation** - Changes take 5-10 minutes to apply

---

## 🔐 Security Notes

1. **Never commit secrets** - Keep `GOOGLE_CLIENT_SECRET` in `.env`, not in git
2. **HTTPS only in production** - Always use `https://` for production domains
3. **Whitelist specific domains** - Don't use wildcards or broad patterns
4. **Review periodically** - Check Google Console to ensure only needed URIs are configured
5. **Separate credentials** - Consider having different Client ID/Secret for dev vs production

---

## 📝 Quick Reference

| Environment | JavaScript Origin | Redirect URI |
|---|---|---|
| **Local Dev** | `http://localhost:3782` | `http://localhost:3782/api/auth/callback/google` |
| **Staging** | `https://staging.example.com` | `https://staging.example.com/api/auth/callback/google` |
| **Production** | `https://example.com` | `https://example.com/api/auth/callback/google` |

---

## 🧪 Testing After Configuration

1. **Save changes** in Google Console
2. **Wait 1-2 minutes** for propagation
3. **Clear browser cache** (Ctrl+Shift+Delete or Cmd+Shift+Delete)
4. **Visit** http://localhost:3782
5. **Click "Sign in with Google"**
6. **You should be redirected to Google login** ✅
7. **After authenticating, redirected back to your app** ✅

---

## 🆘 Still Having Issues?

### Check 1: Environment Variables
```bash
cd /Users/tzeng/Development/DeepTutor/web
cat .env | grep NEXTAUTH_URL
cat .env | grep GOOGLE_CLIENT
```

Verify values match Google Console exactly.

### Check 2: Browser Console
Open DevTools → Console tab, look for:
```
- Any OAuth error messages
- CORS warnings
- Network errors in Network tab
```

### Check 3: Server Logs
When dev server runs:
```bash
npm run dev -- -p 3782
```

Check terminal for error messages about auth.

### Check 4: Verify Port
Ensure app is running on port 3782:
```bash
lsof -i :3782
```

If different port, update Google Console and `.env`.

---

## 📞 Need Help?

- **Google OAuth Docs**: https://developers.google.com/identity/protocols/oauth2
- **NextAuth Docs**: https://next-auth.js.org/
- **Google Cloud Console Help**: https://cloud.google.com/docs/authentication

---

## ✨ Summary

To enable Google SSO:

1. ✅ Open Google Cloud Console
2. ✅ Find your OAuth 2.0 Client ID
3. ✅ Add **JavaScript Origin**: `http://localhost:3782`
4. ✅ Add **Redirect URI**: `http://localhost:3782/api/auth/callback/google`
5. ✅ Save changes
6. ✅ Wait 1-2 minutes
7. ✅ Test at http://localhost:3782
8. ✅ Click "Sign in with Google"

You're all set! 🎉

