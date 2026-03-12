# 配置 Gmail 邮件通知 - 详细步骤

## 问题
你的邮箱 **ericaaawonggg0501@gmail.com** 没有收到通知，因为 SMTP 还没有配置完成。

## ✅ 我已经帮你做了什么
1. ✅ 在 `backend/.env` 文件中添加了 SMTP 配置模板
2. ✅ 已经填入你的邮箱地址

## 🔑 你需要做的事情（获取 Gmail App Password）

### 步骤 1: 启用 Gmail 两步验证 (2FA)

1. 打开浏览器，访问: https://myaccount.google.com/security
2. 登录你的 Gmail 账号 **ericaaawonggg0501@gmail.com**
3. 找到 "两步验证" (2-Step Verification) 并点击
4. 如果还没开启，按照提示开启两步验证

### 步骤 2: 生成 App Password（应用专用密码）

1. 开启两步验证后，访问: https://myaccount.google.com/apppasswords
   或者：Google Account → Security → 2-Step Verification → App passwords

2. 点击 "Generate" 或 "生成"
   - 如果提示选择应用：选择 "Mail" 或 "邮件"
   - 如果提示选择设备：选择 "Windows Computer" 或 "其他"

3. Google 会显示一个 **16 位的密码**（格式类似: `abcd efgh ijkl mnop`）
   - ⚠️ **重要**: 复制这个密码！它只会显示一次！

### 步骤 3: 配置到 .env 文件

1. 打开 `backend/.env` 文件
2. 找到这一行:
   ```
   SMTP_PASS="YOUR_APP_PASSWORD_HERE"
   ```
3. 替换为你刚才复制的 App Password:
   ```
   SMTP_PASS="abcd efgh ijkl mnop"
   ```
   或者（去掉空格）:
   ```
   SMTP_PASS="abcdefghijklmnop"
   ```

### 步骤 4: 重启后端服务器

**重要**: 修改 .env 文件后必须重启后端！

在 PowerShell 中：
1. 找到运行后端的终端窗口
2. 按 `Ctrl + C` 停止后端
3. 然后重新启动:
   ```powershell
   cd backend
   npm start
   ```

### 步骤 5: 测试邮件通知

重启后端后，有两种测试方法：

**方法 A: 使用网页界面**
1. 打开浏览器: http://localhost:5173
2. 登录你的账号
3. 进入 **Settings** 页面
4. 确保 **Email Notifications** 开关是开启的
5. 点击 **"Send Test Notification"** 按钮
6. 查收邮箱 ericaaawonggg0501@gmail.com（包括垃圾邮件文件夹）

**方法 B: 使用命令行**
```powershell
.\quick-test.ps1
```
输入你的用户名和密码

---

## 📋 完整配置示例

你的 `backend/.env` 文件应该包含：
```env
# ... 其他配置 ...

# Email Notifications - Gmail SMTP Settings
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="ericaaawonggg0501@gmail.com"
SMTP_PASS="abcdefghijklmnop"  # ← 替换成你的 App Password
SMTP_FROM="Polymarket Alerts <ericaaawonggg0501@gmail.com>"
```

---

## ❓ 常见问题

### Q: 找不到 App Passwords 选项？
A: 确保你已经开启了两步验证。只有开启两步验证后才能看到 App Passwords。

### Q: 还是收不到邮件？
A: 
1. 检查垃圾邮件文件夹
2. 确认 App Password 没有输入错误（没有多余空格）
3. 确认已经重启后端服务器
4. 查看后端日志，看是否有错误信息

### Q: 显示 "Invalid login" 错误？
A: 
- 确认 App Password 输入正确
- 不要使用你的 Gmail 账户密码，必须使用 App Password
- 确认 SMTP_USER 是正确的邮箱地址

---

## 🚀 快速检查清单

- [ ] 开启 Gmail 两步验证
- [ ] 生成 App Password
- [ ] 复制 App Password 到 backend/.env 的 SMTP_PASS
- [ ] 重启后端服务器（重要！）
- [ ] 用网页或命令行测试邮件通知
- [ ] 检查邮箱收件箱和垃圾邮件文件夹

---

完成以上步骤后，你就能收到邮件通知了！🎉
