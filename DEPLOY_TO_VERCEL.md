# 🚀 Deploy to Vercel - Quick Guide

## ✅ Code已经在 GitHub: 
`https://github.com/erica0501-wng/user_management_dashboard`

---

## 📦 1. Deploy Backend

**Vercel Settings:**
- **Root Directory:** `backend` ⚠️
- **Framework:** Other
- **Build Command:** (empty)
- **Output Directory:** (empty)
- **Install Command:** `npm install`

**Environment Variables 需要添加:**
```
DATABASE_URL=postgresql://...your-postgres-url...
JWT_SECRET=your-super-secret-key-here
NODE_ENV=production
```

**完成后会得到:** `https://user-management-dashboard-backend.vercel.app`

---

## 🎨 2. Deploy Frontend

**Vercel Settings:**
- **Root Directory:** `frontend` ⚠️
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

**Environment Variables 需要添加:**
```
VITE_API_URL=https://user-management-dashboard-backend.vercel.app
```
(用你刚才 backend 的 URL)

**完成后会得到:** `https://your-frontend.vercel.app`

---

## 🌐 3. 配置自定义域名: stocks.quadrawebs.com

在 **Frontend Project** 的 Vercel Dashboard:
1. 去 **Settings** → **Domains**
2. 添加 `stocks.quadrawebs.com`
3. Vercel 会显示需要的 DNS records
4. 去你的域名提供商 (Quadrawebs) 添加这些 DNS records

**DNS Records (大概是这样):**
- Type: `CNAME`
- Name: `stocks`
- Value: `cname.vercel-dns.com`

---

## 🔄 以后更新只需要:

```bash
git add .
git commit -m "update"
git push
```

✨ Vercel 会自动重新 deploy！

---

## 📊 Database Setup

如果还没有 PostgreSQL database:

**Option 1: Vercel Postgres (推荐)**
- Vercel Dashboard → Storage → Create Database
- Copy connection string 去 Backend Environment Variables

**Option 2: Supabase (Free)**
- https://supabase.com
- Create Project → Copy Postgres URL

**Option 3: Neon (Free)**
- https://neon.tech
- Create Project → Copy connection string

---

## 🎯 Current Status:

- ✅ Code on GitHub
- ⏳ Backend deployment (in progress)
- ⏳ Frontend deployment (待定)
- ⏳ Custom domain (待定)

---

## 🔗 Useful Links:

- Vercel Dashboard: https://vercel.com/dashboard
- New Project: https://vercel.com/new
- Your GitHub Repo: https://github.com/erica0501-wng/user_management_dashboard
