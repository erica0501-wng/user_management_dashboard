# Vercel 环境变量配置

## 🔧 快速配置步骤

### 1. 打开 Vercel 后端设置页面
```
https://vercel.com/ericas-projects-fa24d81a/backend/settings/environment-variables
```

### 2. 添加以下环境变量（点击 "Add" 按钮）

#### 变量 1: DATABASE_URL
- **Name**: `DATABASE_URL`
- **Value**: 
```
postgresql://neondb_owner:npg_UQ7uqTIKnfB6@ep-solitary-moon-a1iyv6k3-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```
- **Environment**: ✅ Production ✅ Preview ✅ Development (全选)
- 点击 **Save**

#### 变量 2: JWT_SECRET
- **Name**: `JWT_SECRET`
- **Value**: `your-secret-key-here`
- **Environment**: ✅ Production ✅ Preview ✅ Development (全选)
- 点击 **Save**

#### 变量 3: NODE_ENV
- **Name**: `NODE_ENV`
- **Value**: `production`
- **Environment**: ✅ Production (只选这个)
- 点击 **Save**

### 3. 重新部署
配置完成后，在终端运行：
```powershell
.\deploy-backend.bat
```

## ✅ 验证部署成功
部署成功后，测试 API：
```powershell
Invoke-WebRequest -UseBasicParsing "https://user-management-dashboard-backend.vercel.app/polymarket/markets?limit=1"
```

## 当前问题
- ❌ 没有环境变量配置
- ❌ Prisma migration 失败 (需要 DATABASE_URL)
- ❌ Alert 表未创建

配置环境变量后这些问题都会解决！
