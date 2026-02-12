# Prisma Schema 文件说明

## 当前文件结构

### ✅ 活动文件

**schema.prisma** - 主要schema文件（生产环境）
- 数据库: PostgreSQL
- 位置: 通过环境变量 `DATABASE_URL` 配置
- 用于: Vercel生产部署

### 📦 归档文件（已重命名为 .bak 避免冲突）

1. **schema.local.prisma.bak** - 本地开发使用
   - 数据库: SQLite
   - 已重命名为 .bak 避免 Prisma 扩展检测
   - 用于: 本地开发和测试（可选）

2. **archive/schema.vercel.prisma.bak** - 旧的Vercel schema
   - 已归档并重命名

3. **archive/schema.prisma.backup** - 旧的备份文件
   - 已归档

## ✨ 为什么这样组织？

将多余的schema文件移到`archive`目录可以：
- ✅ 避免Prisma扩展检测到重复定义错误
- ✅ 保持主目录整洁
- ✅ 保留备份文件供参考
- ✅ Vercel部署时可以从archive复制所需的schema

## 使用方法

### 生产环境（默认）
```bash
# 生成 Prisma Client
cd backend
npx prisma generate

# 运行迁移
npx prisma migrate deploy

# 打开 Prisma Studio
npx prisma studio
```

### 本地开发（SQLite - 可选）
```bash
# 如需使用本地SQLite数据库，先恢复文件名
cd backend/prisma
Move-Item schema.local.prisma.bak schema.local.prisma
npx prisma generate --schema=./prisma/schema.local.prisma
npx prisma studio --schema=./prisma/schema.local.prisma
```

### Vercel 部署
部署会自动使用 `schema.prisma`：
```bash
# 构建时会使用 package.json 中配置的命令
npm run build  # 自动使用 schema.prisma
```

## VS Code 配置

`.vscode/settings.json` 已配置为：
- 默认使用 `schema.prisma`
- 排除归档的schema文件避免混淆
- 配置Prisma格式化器

## 故障排除

如果仍然看到Prisma错误：
1. 按 `Ctrl+Shift+P`
2. 输入 `Developer: Reload Window`
3. 等待 VS Code 重新加载

所有Prisma重复定义错误应该已经消失！✨

## 环境变量

确保设置了正确的 `DATABASE_URL`：
- **生产环境**: Vercel自动配置PostgreSQL连接
- **本地开发**: 在 `.env` 文件中设置PostgreSQL URL或使用SQLite schema
