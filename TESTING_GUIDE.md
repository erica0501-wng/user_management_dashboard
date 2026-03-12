# 🧪 测试 Polymarket 和 Auto-Trader 功能

## 快速测试指南

### 方法 1: 运行测试脚本（推荐）

#### 测试 Polymarket 功能：
```powershell
cd backend
node test-polymarket-function.js
```

这会检查：
- ✅ 数据库中的持仓数据
- ✅ 持仓统计信息
- ✅ Close功能测试提示

#### 测试 Auto-Trader 功能：
```powershell
cd backend
node test-autotrader-function.js
```

这会检查：
- ✅ 所有Auto-Trader规则
- ✅ 规则执行状态
- ✅ 通知配置
- ✅ 执行历史

---

## 详细测试步骤

### 📊 测试 Polymarket 功能

#### Test 1: 查看持仓
1. **启动应用**：
   ```powershell
   # Terminal 1: 启动backend
   cd backend
   npm start
   
   # Terminal 2: 启动frontend
   cd frontend
   npm run dev
   ```

2. **访问页面**：
   - 打开 http://localhost:5173
   - 登录账户
   - 进入 Portfolio 页面
   - 切换到 **Polymarket** tab

3. **验证显示**：
   - ✅ 能看到 Total Positions 统计
   - ✅ 能看到 Total Invested
   - ✅ 能看到 Current Value
   - ✅ 能看到 Total P&L
   - ✅ 持仓列表显示正确

#### Test 2: 测试 Close 功能
1. **找到 Open 状态的持仓**
2. **点击 "Close" 按钮**
3. **确认弹窗**
4. **验证结果**：
   - ✅ 持仓状态变为 "Closed"
   - ✅ Available Cash 增加（顶部余额）
   - ✅ Total Invested 减少
   - ✅ 无需刷新页面，自动更新

#### Test 3: 验证计算准确性
```powershell
# 在backend目录运行
node test-polymarket-function.js
```
检查：
- ✅ 持仓数量是否正确
- ✅ P&L计算是否准确
- ✅ 统计数据是否一致

---

### 🤖 测试 Auto-Trader 功能

#### Test 1: 创建规则
1. **进入 Auto-Trader 页面**：
   - Portfolio → Auto-Trader tab

2. **点击 "+ Create Rule"**

3. **填写测试规则**：
   ```
   Market ID: 531202
   Question: Test Market
   Outcome: Yes
   Strategy Type: Price Target
   Condition: Above
   Target Price: 0.50
   Action: Buy
   Quantity: 1
   Max Executions: 1
   Notifications: ✅ Email
   ```

4. **保存并验证**：
   - ✅ 规则出现在列表中
   - ✅ 状态显示为 "Active"
   - ✅ Execution Count 为 0/1

#### Test 2: 验证规则监控
```powershell
# 在backend目录
node test-autotrader-function.js
```

检查：
- ✅ 规则已保存到数据库
- ✅ 配置信息正确
- ✅ 状态为 Active

#### Test 3: 测试自动执行

**方法 A - 快速测试（推荐）**：
1. 创建规则时设置 target price = 当前市场价格
2. 等待60秒（监控周期）
3. 检查规则的 Execution Count 是否增加
4. 检查是否收到通知（如果配置了）

**方法 B - 实时监控**：
```powershell
# 在backend目录启动server
npm start

# 观察控制台日志：
# 应该看到类似：
🤖 Auto-trader monitoring service started
🔍 Checking 1 active auto-traders...
✅ Auto-Trader Rule 5 triggered!
```

#### Test 4: 验证订单创建
1. **等待规则执行后**，检查：
   - Portfolio → Orders tab
   - 应该能看到新的订单
   - 订单名称包含 "Auto-Trade Execution"

2. **检查余额变化**：
   - Available Cash 应该减少（如果是Buy）
   - Total Invested 应该增加

#### Test 5: 测试 Pause/Resume
1. **点击 "Pause" 按钮**
2. **等待60秒**
3. **验证**：规则不应该执行
4. **点击 "Resume"**
5. **验证**：规则恢复监控

#### Test 6: 测试通知
如果配置了Email或Discord：
1. **确保在 Settings 页面配置了通知**
2. **手动触发规则执行**
3. **检查邮箱/Discord是否收到通知**

---

## 🔍 调试技巧

### 查看数据库实时数据
```powershell
cd backend
node view-data.js
```

### 查看 Auto-Trader 规则详情
```powershell
cd backend
node -e "const prisma = require('./src/prisma'); prisma.autoTrader.findMany().then(console.log).finally(() => prisma.$disconnect())"
```

### 查看最近的订单
```powershell
cd backend
node -e "const prisma = require('./src/prisma'); prisma.order.findMany({ take: 5, orderBy: { createdAt: 'desc' } }).then(console.log).finally(() => prisma.$disconnect())"
```

### 手动触发 Auto-Trader 检查
```powershell
cd backend
node test-autotrader.js
```

---

## ✅ 测试检查清单

### Polymarket 功能
- [ ] 能看到持仓列表
- [ ] 统计信息显示正确
- [ ] P&L计算准确
- [ ] Close按钮可用（对Open状态持仓）
- [ ] Close后余额自动更新
- [ ] 持仓状态正确更新为Closed

### Auto-Trader 功能
- [ ] 能创建新规则
- [ ] 规则显示在列表中
- [ ] 状态可以切换（Active/Paused）
- [ ] 监控服务正常运行（查看backend日志）
- [ ] 规则在条件满足时自动执行
- [ ] Execution Count正确增加
- [ ] 订单正确创建
- [ ] 余额正确更新
- [ ] 通知成功发送（如果配置）
- [ ] Max Executions限制生效
- [ ] Pause功能正常
- [ ] Reset功能正常
- [ ] Delete功能正常

---

## 🆘 常见问题

### Q: Polymarket持仓列表是空的？
**A:** 需要先在 Polymarket 页面买入股票，才会有持仓显示。

### Q: Auto-Trader规则不执行？
**A:** 检查：
1. Backend server是否运行
2. 规则状态是否为Active
3. 是否达到Max Executions限制
4. 查看backend日志是否有错误

### Q: Close后余额没更新？
**A:** 刷新页面，如果还是没更新，检查浏览器控制台是否有错误。

### Q: 没收到通知？
**A:** 检查 Settings 页面的通知设置是否正确配置。

---

## 💡 提示

1. **测试前确保backend server运行**：
   ```powershell
   cd backend
   npm start
   ```

2. **查看实时日志**可以帮助理解Auto-Trader的工作流程

3. **创建测试规则时**，可以设置很容易触发的条件（如当前价格）来快速验证功能

4. **测试完成后**可以删除测试规则和持仓

---

运行测试脚本获取当前状态！ 🚀
