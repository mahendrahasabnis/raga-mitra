# Local Development with Online Databases

This guide explains how to set up your local frontend and backend to connect to online (production/staging) databases for testing before deployment.

## Quick Answer: Yes, it's possible! ✅

**Yes, you can absolutely set up local frontend and backend pointing to online databases and test the app locally before deploying online.**

This is a common and recommended development workflow that allows you to:
- Test against real database schemas and data
- Debug issues locally with full control
- Avoid deploying untested code
- Work with the same data structure as production

## Overview

This setup allows you to:
- ✅ Run frontend locally (Vite dev server on `http://localhost:5173`)
- ✅ Run backend locally (Express server on `http://localhost:5000`)
- ✅ Connect to online PostgreSQL databases (Cloud SQL or remote PostgreSQL)
- ✅ Test the full application locally before deploying
- ✅ Avoid affecting production data (if using staging/test databases)

## Prerequisites

1. **Database Access**: You need credentials for the online databases:
   - Shared database (`platforms_99`) - for users and platform privileges
   - App database (`aarogya_mitra`) - for application data

2. **Network Access**: Your local machine must be able to connect to the online databases:
   - If using Cloud SQL, you may need to:
     - Use Cloud SQL Proxy (recommended for secure connections)
     - Whitelist your IP address in Cloud SQL settings
     - Or use a VPN if required by your organization

3. **Environment Variables**: You'll need:
   - Database host, port, username, password
   - SSL configuration (usually required for cloud databases)
   - JWT secret and other API keys

## Quick Setup (Automated)

For a quick setup, run the automated script:

```bash
./setup-local-dev.sh
```

This will create the necessary environment files from examples. Then edit them with your actual credentials.

## Manual Setup Steps

### Step 1: Create Environment Configuration File

Create a `.env.integrated` file in the project root (or copy from `env.integrated.local.example`):

```bash
cp env.integrated.local.example .env.integrated
```

### Step 2: Configure Database Connection

Edit `.env.integrated` with your online database credentials:

```env
# Database Configuration - Online Databases
NODE_ENV=development
PORT=5000

# Shared Database (platforms_99) - Users and Platform Privileges
SHARED_DB_HOST=your-cloud-sql-host-or-ip
SHARED_DB_PORT=5432
SHARED_DB_NAME=platforms_99
SHARED_DB_USER=your-db-user
SHARED_DB_PASSWORD=your-db-password

# App Database (aarogya_mitra) - Application Data
DB_HOST=your-cloud-sql-host-or-ip
DB_PORT=5432
DB_NAME=aarogya_mitra
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# SSL Configuration (usually required for cloud databases)
DB_SSL=true

# Connection Pool Settings
DB_POOL_MAX=10
DB_POOL_MIN=2

# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d

# Azure Communication Services (for OTP)
AZURE_COMMUNICATION_CONNECTION_STRING=your-azure-connection-string
AZURE_COMMUNICATION_PHONE_NUMBER=your-azure-phone-number

# Gemini AI (for document scanning)
GEMINI_API_KEY=your-gemini-api-key

# User Service (99Platforms backend)
USER_SERVICE_URL=https://platforms-99-backend-839584127235.asia-south1.run.app/api
USER_SERVICE_PHONE=+919999999999
USER_SERVICE_PIN=9999
USER_SERVICE_PLATFORM=aarogya-mitra

# CORS Configuration
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:5000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### Step 3: Configure Frontend Environment

Create a `.env.local` file in the `frontend/` directory (or copy from `env.local.example`):

```bash
cd frontend
cp env.local.example .env.local
```

Then edit `.env.local` with your configuration:

```env
# Frontend Configuration - Local Development
VITE_API_BASE_URL=http://localhost:5000/api
VITE_APP_NAME=Aarogya-Mitra
VITE_APP_VERSION=1.0.0

# Firebase Configuration (if needed)
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-firebase-auth-domain
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-firebase-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-firebase-messaging-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
```

**Note**: Vite requires the `VITE_` prefix for environment variables to be exposed to the frontend.

### Step 4: Using Cloud SQL Proxy (Recommended for Cloud SQL)

If you're using Google Cloud SQL, the Cloud SQL Proxy provides secure connections:

1. **Download Cloud SQL Proxy** (if not already available):
   ```bash
   # macOS
   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
   chmod +x cloud-sql-proxy
   
   # Or use the one in your project if available
   ```

2. **Start Cloud SQL Proxy** in a separate terminal:
   ```bash
   ./cloud-sql-proxy \
     --port=5432 \
     PROJECT_ID:REGION:INSTANCE_NAME
   ```

3. **Update `.env.integrated`** to use localhost:
   ```env
   DB_HOST=127.0.0.1
   SHARED_DB_HOST=127.0.0.1
   DB_PORT=5432
   SHARED_DB_PORT=5432
   DB_SSL=false  # Proxy handles SSL
   ```

### Step 5: Install Dependencies

```bash
# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

### Step 6: Start Development Servers

**Option A: Start both frontend and backend together** (recommended):
```bash
npm run dev
```

**Option B: Start separately** (in different terminals):

Terminal 1 - Backend:
```bash
cd backend
npm run dev:integrated
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### Step 7: Verify Connection

1. **Check Backend Logs**: You should see:
   ```
   ✅ DB connections established
   📊 Shared DB: platforms_99 @ your-host:5432
   📊 App DB: aarogya_mitra @ your-host:5432
   🚀 Server running on port 5000
   ```

2. **Check Frontend**: Open `http://localhost:5173` and check browser console for:
   ```
   🔗 [API] Using backend URL: http://localhost:5000/api
   ```

3. **Test API Connection**: Try logging in or accessing any API endpoint.

## Troubleshooting

### Database Connection Issues

**Error: "Connection refused" or "ECONNREFUSED"**
- Check if database host and port are correct
- Verify your IP is whitelisted (for direct connections)
- Ensure Cloud SQL Proxy is running (if using proxy)
- Check firewall settings

**Error: "SSL required" or "SSL connection error"**
- Set `DB_SSL=true` in `.env.integrated`
- For Cloud SQL Proxy, set `DB_SSL=false` (proxy handles SSL)

**Error: "Authentication failed"**
- Verify database username and password
- Check if user has proper permissions
- Ensure database name is correct

### Frontend Not Connecting to Backend

**Error: "Network Error" or CORS errors**
- Verify `VITE_API_BASE_URL` in frontend `.env.local`
- Check backend CORS configuration in `.env.integrated`
- Ensure backend is running on the correct port
- Check browser console for detailed error messages

### Port Already in Use

**Error: "Port 5000 already in use"**
- Change `PORT` in `.env.integrated` to a different port (e.g., `5001`)
- Update `VITE_API_BASE_URL` in frontend `.env.local` accordingly

## Switching Between Local and Online Databases

### For Local Databases
1. Update `.env.integrated`:
   ```env
   DB_HOST=localhost
   SHARED_DB_HOST=localhost
   DB_SSL=false
   ```

### For Online Databases
1. Update `.env.integrated` with online credentials (as shown above)
2. Set `DB_SSL=true` if required

## Switching Between Local and Online Backend

### Frontend Pointing to Local Backend (Current Setup)
```env
# frontend/.env.local
VITE_API_BASE_URL=http://localhost:5000/api
```

### Frontend Pointing to Online Backend
```env
# frontend/.env.local
VITE_API_BASE_URL=https://your-backend-url.run.app/api
```

## Security Notes

⚠️ **Important Security Considerations**:

1. **Never commit `.env.integrated` or `.env.local`** to version control
2. **Use staging/test databases** for local development when possible
3. **Rotate credentials** if accidentally exposed
4. **Use Cloud SQL Proxy** for secure connections to Cloud SQL
5. **Limit database user permissions** - use read/write only, not admin

## File Structure

```
aarogya-mitra-separate/
├── .env.integrated              # Backend environment (database, API keys) - NOT in git
├── env.integrated.local.example  # Example backend config - in git
├── frontend/
│   ├── .env.local              # Frontend environment (API URLs) - NOT in git
│   └── env.local.example       # Example frontend config - in git
└── backend/
    └── src/
        └── config/
            └── database-integrated.ts  # Database configuration
```

## Next Steps

After setting up local development:
1. ✅ Test all features locally
2. ✅ Verify database connections
3. ✅ Test authentication and authorization
4. ✅ Test all API endpoints
5. ✅ Once everything works, deploy to production

## Additional Resources

- [Cloud SQL Proxy Documentation](https://cloud.google.com/sql/docs/postgres/sql-proxy)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Sequelize Configuration](https://sequelize.org/docs/v6/getting-started/)
