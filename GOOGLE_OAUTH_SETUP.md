# Google OAuth Setup Guide

## Setting Up Google OAuth for Chat Eval Application

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it: `chat-eval` (or your preferred name)
4. Click "Create"

### Step 2: Enable Google+ API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

### Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - User Type: External
   - App name: AI Chat Evaluator
   - User support email: Your email
   - Developer contact: Your email
   - Add scopes: `email`, `profile`, `openid`
   - Add test users if in development

4. Create OAuth client ID:
   - Application type: Web application
   - Name: Chat Eval Web Client
   - Authorized JavaScript origins:
     - `http://localhost:5001` (for local development)
     - `https://chat-eval.onrender.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:5001/auth/google/callback`
     - `https://chat-eval.onrender.com/auth/google/callback`
   - Click "Create"

5. Save your credentials:
   - Copy the **Client ID**
   - Copy the **Client Secret**

### Step 4: Configure Environment Variables

Add to your `.env` file (local development):
```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
ENCRYPTION_KEY=<generate_with_command_below>
```

Generate encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Step 5: Configure on Render

In Render dashboard, add environment variables:
- `GOOGLE_CLIENT_ID`: Your OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your OAuth client secret
- `ENCRYPTION_KEY`: Generated encryption key
- `SECRET_KEY`: A random secret for Flask sessions

### Important URLs to Configure

Make sure these URLs are added to your OAuth client:

**Development:**
- Origin: `http://localhost:5001`
- Redirect: `http://localhost:5001/auth/google/callback`

**Production (Render):**
- Origin: `https://chat-eval.onrender.com`
- Redirect: `https://chat-eval.onrender.com/auth/google/callback`

### Testing OAuth Flow

1. Start the application:
```bash
python app_with_auth.py
```

2. Visit `http://localhost:5001`
3. Click "Sign in with Google"
4. Authorize the application
5. You'll be redirected to setup your Anthropic API key
6. Enter your API key and start using the app

### Troubleshooting

**"redirect_uri_mismatch" error:**
- Check that your redirect URI exactly matches what's in Google Console
- Include the full path including `/auth/google/callback`
- Make sure to add both http (dev) and https (prod) versions

**"access_blocked" error:**
- Make sure the OAuth consent screen is configured
- Add test users if the app is in testing mode
- Consider publishing the app for production use

**"invalid_client" error:**
- Double-check your client ID and secret
- Ensure no extra spaces in environment variables
- Verify the credentials are from the correct project

### Security Notes

1. **Never commit credentials**: Keep them in `.env` and use environment variables
2. **Use HTTPS in production**: OAuth requires secure connections
3. **Limit redirect URIs**: Only add the specific URLs you need
4. **Rotate secrets regularly**: Change client secret if compromised
5. **Encrypt API keys**: User API keys are encrypted before storage

### Publishing Your App

For production use:
1. Go to OAuth consent screen
2. Click "Publish App"
3. Complete verification if required
4. Your app will be available to all Google users

### Rate Limits

- Development: Limited to 100 test users
- Production: No user limit after publishing
- API calls: Subject to Google's quotas (typically generous)

### Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)