# Prisma Schema 文件说明

## 当前文件结构

### ✅ 活动文件

**schema.local.prisma** - 本地开发使用（唯一活动文件）
- 数据库: SQLite
- 位置: `./prisma/dev.db`
- 用于: 本地开发和测试

### 📦 归档文件（archive目录）

1. **schema.prisma.backup** - 旧的schema文件
   - 已归档以避免冲突

2. **schema.vercel.prisma** - Vercel生产环境使用
   - 数据库: PostgreSQL
   - 位置: 通过环境变量配置
   - 用于: Vercel部署时复制使用

## ✨ 为什么这样组织？

将多余的schema文件移到`archive`目录可以：
- ✅ 避免Prisma扩展检测到重复定义错误
- ✅ 保持主目录整洁
- ✅ 保留备份文件供参考
- ✅ Vercel部署时可以从archive复制所需的schema

## 使用方法

### 本地开发
```bash
# 生成 Prisma Client
cd backend
npx prisma generate --schema=./prisma/schema.local.prisma

# 运行迁移
npx prisma migrate dev --schema=./prisma/schema.local.prisma

# 打开 Prisma Studio
npx prisma studio --schema=./prisma/schema.local.prisma
```

### Vercel 部署
Vercel部署使用`schema.vercel.prisma`：
```bash
# 构建时会使用 package.json 中配置的命令
npm run build  # 自动使用 schema.vercel.prisma
```

## VS Code 配置

`.vscode/settings.json` 已配置为：
- 默认使用 `schema.local.prisma`
- 排除 `.backup` 文件避免混淆
- 配置Prisma格式化器

## 故障排除

如果仍然看到错误：
1. 按 `Ctrl+Shift+P`
2. 输入 `Developer: Reload Window`
3. 等待 VS Code 重新加载

所有Prisma重复定义错误应该已经消失！✨
