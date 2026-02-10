# Vercel Deployment Guide

## ✅ Files Prepared for Vercel

### Backend
- ✅ `vercel.json` - Serverless configuration
- ✅ `api/index.js` - Vercel serverless entry point
- ✅ `.vercelignore` - Exclude unnecessary files
- ✅ Prisma schema updated to PostgreSQL
- ✅ Favicon handler added

### Frontend
- ✅ `vercel.json` - SPA routing configuration
- ✅ Chart.js LineController registered (fixes the error)
- ✅ Environment variables configured
- ✅ Production build completed

---

## 📋 Deployment Steps (Using Vercel Website)

### 1. Deploy Backend First

1. Go to [vercel.com](https://vercel.com) and login
2. Click **"Add New"** → **"Project"**
3. Import your Git repository (GitHub/GitLab/Bitbucket)
4. **Important Settings:**
   - **Root Directory**: Set to `backend`
   - **Framework Preset**: Other
   - **Build Command**: Leave empty or use `echo "No build needed"`
   - **Output Directory**: Leave empty
   - **Install Command**: `npm install`

5. Click **"Deploy"**
6. **Copy your backend URL** (e.g., `https://your-backend.vercel.app`)

### 2. Set Backend Environment Variables in Vercel

1. Go to your backend project in Vercel dashboard
2. Click **Settings** → **Environment Variables**
3. Add these variables:

```
DATABASE_URL=postgresql://user:password@host:port/database?schema=public
JWT_SECRET=your-super-secret-key-here
NODE_ENV=production
```

4. Click **"Save"**
5. Go to **Deployments** → Click **"..."** on latest deployment → **"Redeploy"**

**Get PostgreSQL Database:**
- **Vercel Postgres**: In Vercel dashboard → **Storage** → **Create Database** → Copy connection string
- **Supabase**: Free at [supabase.com](https://supabase.com) → Create project → Copy Postgres URL
- **Neon**: Free at [neon.tech](https://neon.tech) → Create project → Copy connection string

### 3. Run Database Migration

After setting DATABASE_URL and redeploying, run this command **locally** to set up your Vercel database:

```bash
cd backend
DATABASE_URL="your-vercel-postgres-url-here" npx prisma migrate deploy --schema=./prisma/schema.vercel.prisma
```

Replace `your-vercel-postgres-url-here` with your actual PostgreSQL connection string from Vercel.

**Note:** Your local development uses SQLite (`schema.prisma`), while Vercel uses PostgreSQL (`schema.vercel.prisma`). They are separate databases.

### 4. Update Frontend Environment Variable

1. Create `frontend/.env.production` file:

```
VITE_API_URL=https://your-backend.vercel.app
```

Replace with your actual backend URL from step 1.

### 5. Deploy Frontend

1. In Vercel dashboard, click **"Add New"** → **"Project"**
2. Select the same repository
3. **Important Settings:**
   - **Root Directory**: Set to `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. Go to **Environment Variables** → Add:
   ```
   VITE_API_URL=https://your-backend.vercel.app
   ```
   (Use your actual backend URL)

5. Click **"Deploy"**

---

## 🔧 Environment Variables Summary

### Backend (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
NODE_ENV=production
TWELVE_API_KEY=demo
```

### Frontend (.env.production)
```
VITE_API_URL=https://your-backend.vercel.app
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: "500: FUNCTION_INVOCATION_FAILED" (Backend crashes)
**Causes:**
- ❌ Missing environment variables (DATABASE_URL, JWT_SECRET)
- ❌ Prisma client not generated during build
- ❌ Database connection failed

**Solutions:**
1. **Check Environment Variables** in Vercel:
   - Go to backend project → **Settings** → **Environment Variables**
   - Ensure `DATABASE_URL` and `JWT_SECRET` are set
   - Click **Save** then **Redeploy**

2. **Check Build Logs** in Vercel:
   - Go to **Deployments** → Click on latest deployment
   - Check **Build Logs** for errors
   - Look for "prisma generate" in logs (should see "✔ Generated Prisma Client")

3. **Test Database Connection:**
   - Make sure your DATABASE_URL is correct
   - Verify the database is accessible from internet (not localhost)
   - For Vercel Postgres: Make sure you copied the connection string from Storage tab

4. **Force Redeploy:**
   - Go to **Deployments** → **...** → **Redeploy**
   - Check "Use existing Build Cache" is **OFF**

### Issue 2: "line is not a registered controller"
**Cause**: Chart.js LineController not imported
**Status**: ✅ FIXED - LineController now registered

### Issue 2: Backend 500 error on /favicon.ico
**Cause**: No favicon handler
**Status**: ✅ FIXED - Returns 204 No Content

### Issue 3: Frontend can't connect to backend
**Cause**: VITE_API_URL not set or wrong
**Solution**: Update `.env.production` with your Vercel backend URL

### Issue 4: Database connection fails
**Cause**: Wrong DATABASE_URL or using SQLite
**Solution**: Use PostgreSQL connection string from your database provider

---

## 🎯 Quick Test After Deployment

1. Open your frontend URL
2. Try to register a new account
3. Check if you see the market analytics page
4. Verify no console errors

---

## 📝 Notes

- Backend and Frontend are **separate Vercel projects**
- Always deploy backend first, then frontend
- Update `VITE_API_URL` whenever backend URL changes
- SQLite doesn't work on Vercel - must use PostgreSQL
