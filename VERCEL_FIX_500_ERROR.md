# 🔧 修复 Vercel 500 错误

## 问题原因
Backend部署后返回500错误，因为**环境变量未配置**，导致：
- ❌ 无法连接数据库 (DATABASE_URL 缺失)
- ❌ JWT认证失败 (JWT_SECRET 缺失)
- ❌ Prisma无法运行migrations

## ✅ 解决步骤

### 步骤 1: 在Vercel设置环境变量

#### 打开Backend项目环境变量页面：
🔗 https://vercel.com/ericas-projects-fa24d81a/backend/settings/environment-variables

#### 添加以下环境变量（每个都要点击"Add"按钮）：

---

#### 1️⃣ DATABASE_URL (必需)
- **Name**: `DATABASE_URL`
- **Value**: 
  ```
  postgresql://neondb_owner:npg_UQ7uqTIKnfB6@ep-solitary-moon-a1iyv6k3-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
  ```
- **Environments**: ✅ Production ✅ Preview ✅ Development
- 点击 **Save**

---

#### 2️⃣ JWT_SECRET (必需)
- **Name**: `JWT_SECRET`
- **Value**: (从本地 `backend/.env` 文件复制你的JWT_SECRET)
  ```
  your-secret-key-here
  ```
- **Environments**: ✅ Production ✅ Preview ✅ Development
- 点击 **Save**

---

#### 3️⃣ NODE_ENV (推荐)
- **Name**: `NODE_ENV`
- **Value**: `production`
- **Environments**: ✅ Production only
- 点击 **Save**

---

### 可选的SMTP环境变量（用于Email通知）

如果你想要email notifications功能工作，添加以下变量：

#### 4️⃣ SMTP_HOST
- **Name**: `SMTP_HOST`
- **Value**: `smtp.gmail.com`
- **Environments**: ✅ Production ✅ Preview ✅ Development

#### 5️⃣ SMTP_PORT
- **Name**: `SMTP_PORT`
- **Value**: `587`
- **Environments**: ✅ Production ✅ Preview ✅ Development

#### 6️⃣ SMTP_SECURE
- **Name**: `SMTP_SECURE`
- **Value**: `false`
- **Environments**: ✅ Production ✅ Preview ✅ Development

#### 7️⃣ SMTP_USER
- **Name**: `SMTP_USER`
- **Value**: `ericaaawonggg0501@gmail.com`
- **Environments**: ✅ Production ✅ Preview ✅ Development

#### 8️⃣ SMTP_PASS
- **Name**: `SMTP_PASS`
- **Value**: (从本地 `backend/.env` 文件复制你的SMTP_PASS)
- **Environments**: ✅ Production ✅ Preview ✅ Development

#### 9️⃣ SMTP_FROM
- **Name**: `SMTP_FROM`
- **Value**: `Polymarket Alerts <ericaaawonggg0501@gmail.com>`
- **Environments**: ✅ Production ✅ Preview ✅ Development

---

### 步骤 2: 重新部署Backend

配置完所有环境变量后，在终端运行：

```powershell
cd backend
vercel --prod
```

或者在Vercel Dashboard点击 **Redeploy** 按钮。

---

### 步骤 3: 验证部署成功

部署完成后，测试API是否正常：

```powershell
# 测试基本API
Invoke-RestMethod "https://backend-mauve-one-19.vercel.app/polymarket/markets?limit=1"

# 测试登录 (应该返回错误信息而不是500)
Invoke-RestMethod -Method Post -Uri "https://backend-mauve-one-19.vercel.app/auth/login" -ContentType "application/json" -Body '{"email":"test@test.com","password":"test"}'
```

如果API返回正常的JSON响应（不是500错误），说明部署成功！

---

### 步骤 4: 更新Frontend的API URL（如果需要）

如果你的frontend还在用localhost，更新frontend环境变量：

🔗 https://vercel.com/ericas-projects-fa24d81a/frontend/settings/environment-variables

添加：
- **Name**: `VITE_API_URL`
- **Value**: `https://backend-mauve-one-19.vercel.app`
- **Environments**: ✅ Production ✅ Preview ✅ Development

然后重新部署frontend：
```powershell
cd frontend
vercel --prod
```

---

## 🎯 快速检查清单

- [ ] DATABASE_URL 已添加到Vercel
- [ ] JWT_SECRET 已添加到Vercel
- [ ] Backend已重新部署
- [ ] Backend API测试通过（无500错误）
- [ ] Frontend已更新VITE_API_URL（如果需要）
- [ ] Frontend已重新部署
- [ ] 可以正常登录和使用功能

---

## 🆘 如果还是有问题

查看Vercel部署日志：
🔗 https://vercel.com/ericas-projects-fa24d81a/backend/deployments

点击最新的deployment，查看 **Build Logs** 和 **Function Logs**。

---

**完成以上步骤后，你的应用应该可以正常工作了！** ✅
