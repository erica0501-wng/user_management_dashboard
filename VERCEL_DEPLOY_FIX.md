## ⚠️ Vercel部署失败 - 环境变量未配置

### 当前问题：
```
Error: Command "npm run vercel-build" exited with 1
```

这是因为 **Prisma migrations** 需要 `DATABASE_URL` 环境变量才能运行，但Vercel上还没有配置。

---

## ✅ 解决方法（3个步骤）

### 📝 步骤 1: 在Vercel配置环境变量

1. **打开Backend环境变量页面**：  
   👉 https://vercel.com/ericas-projects-fa24d81a/backend/settings/environment-variables

2. **点击 "Add New" 按钮** 添加以下变量：

#### A. DATABASE_URL (必需)
```
Name: DATABASE_URL

Value: 
postgresql://neondb_owner:npg_UQ7uqTIKnfB6@ep-solitary-moon-a1iyv6k3-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

Environments: 
✅ Production
✅ Preview  
✅ Development

点击 Save
```

#### B. JWT_SECRET (必需)
```
Name: JWT_SECRET

Value: (从你的本地 backend/.env 文件复制)

Environments:
✅ Production
✅ Preview
✅ Development

点击 Save
```

---

### 🔄 步骤 2: 重新部署

配置完环境变量后，在终端运行：

```powershell
cd backend
vercel --prod
```

或者在Vercel Dashboard点击 **"Redeploy"** 按钮。

---

### ✅ 步骤 3: 验证部署成功

部署成功后，测试API：

```powershell
# 测试Polymarket API
Invoke-RestMethod "https://backend-mauve-one-19.vercel.app/polymarket/markets?limit=1"

# 应该返回JSON数据，而不是500错误
```

---

## 📋 快速检查清单

- [ ] 打开Vercel Backend设置页面
- [ ] 添加 `DATABASE_URL` 环境变量
- [ ] 添加 `JWT_SECRET` 环境变量
- [ ] 保存环境变量
- [ ] 重新部署Backend (`vercel --prod`)
- [ ] 等待部署完成（约1-2分钟）
- [ ] 测试API是否返回200（不是500）
- [ ] 刷新Frontend页面，确认500错误消失

---

## 🆘 如果还是失败

查看详细的构建日志：

1. 打开部署页面：  
   👉 https://vercel.com/ericas-projects-fa24d81a/backend/deployments

2. 点击最新的deployment

3. 查看 **Build Logs** 标签

4. 找到错误信息并复制给我

---

## 💡 提示

配置环境变量后，Vercel会自动：
1. ✅ 运行 `prisma generate` 生成Prisma Client
2. ✅ 运行 `prisma migrate deploy` 应用数据库migrations
3. ✅ 部署你的API到生产环境

这样你的后端就能连接到Neon数据库了！

---

**完成以上步骤后告诉我，我会帮你验证部署是否成功！** 🚀
