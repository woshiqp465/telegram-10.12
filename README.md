# Telegram 客服系统

一个完整的网页客服系统，使用 Telegram 作为后端。用户通过网页聊天组件与客服沟通，客服在 Telegram 群组中回复，消息实时双向同步。

## ✨ 主要功能

### 1. **网页聊天组件**
- 悬浮聊天按钮，可嵌入任何网页
- WebSocket 实时通信
- 自动重连机制
- 支持用户身份识别（登录用户 ID / 匿名用户）
- **🎨 Emoji选择器（800+个emoji，9大分类）**
- **📷 富媒体支持（贴纸、GIF动图、图片）**
- **💬 聊天历史记录**
- **⌨️ 输入状态指示器**
- **🔔 未读消息数量显示**

### 2. **Telegram 集成**
- 自动为每个用户创建独立话题（Forum Topic）
- 客服在 Telegram 群组中回复，消息自动同步到网页
- 用户信息展示（ID、剩余天数、消息数）
- 支持 SOCKS5 代理访问 Telegram API
- **🎬 Telegram贴纸和GIF完美显示（动画效果）**
- **📁 智能文件缓存机制（避免重复下载）**
- **⏱️ 超时保护（防止服务器崩溃）**

### 3. **用户时长管理**
- 新用户自动赠送 7 天试用
- 每日自动扣费（北京时间 00:00）
- 到期自动禁用，剩余 3 天时提醒
- 充值/延期功能

### 4. **管理后台**
- 用户列表、搜索、筛选
- 统计数据：总用户、活跃用户、今日新增、即将到期
- 用户充值/延期
- 充值记录查询

### 5. **数据存储**
- SQLite 数据库（WAL 模式）
- 5 张表：用户、话题映射、充值记录、管理员、系统配置
- 自动初始化和迁移

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

依赖包括：
- `telegraf` - Telegram Bot 框架
- `express` - Web 服务器
- `ws` - WebSocket 服务器
- `better-sqlite3` - SQLite 数据库
- `node-cron` - 定时任务
- `socks-proxy-agent` - SOCKS5 代理支持
- `sharp` - 图片处理（用于媒体文件优化）
- `https-proxy-agent` - HTTPS代理支持

### 2. 配置

复制 `config.example.json` 为 `config.json`：

```bash
cp config.example.json config.json
```

编辑 `config.json`：

```json
{
  "BOT_TOKEN": "你的Bot Token",
  "GROUP_ID": "你的群组ID（带负号）"
}
```

**获取 Bot Token**：
1. 在 Telegram 中找 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 创建新 Bot
3. 获取 Token（格式：`123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`）

**获取群组 ID**：
1. 创建一个超级群组（Supergroup）
2. 在群组设置中启用 "Topics"（话题功能）
3. 将 Bot 添加为管理员（需要管理话题权限）
4. 运行 `node scripts/get-group-id.js` 获取群组 ID

### 3. 初始化数据库

```bash
node scripts/init-db.js
```

这会创建：
- `data/database.db` - 数据库文件
- `data/logs/` - 日志目录
- 默认管理员账号：`admin` / `admin`

### 4. 启动服务

#### 方式 1：前台运行（调试）
```bash
node server/app.js
```

#### 方式 2：后台运行（推荐）
```bash
# 无代理
./start.sh

# 使用 SOCKS5 代理（中国大陆环境）
./start-with-proxy.sh
```

#### 方式 3：使用 PM2（生产环境）
```bash
npm install -g pm2
pm2 start server/app.js --name telegram-chat
pm2 save
pm2 startup
```

### 5. 访问系统

- 测试页面：http://localhost:3000/test.html
- 管理后台：http://localhost:3001
- 默认账号：`admin` / `admin`

## 🌐 代理配置

如果服务器无法直接访问 Telegram API（如中国大陆），需要配置 SOCKS5 代理。

### 自动代理（推荐）

使用 `start-with-proxy.sh` 启动脚本，会自动配置代理环境变量：

```bash
export http_proxy="socks5://127.0.0.1:1080"
export https_proxy="socks5://127.0.0.1:1080"
./start-with-proxy.sh
```

### 手动代理配置

系统已内置 SOCKS5 代理支持，会在初始化时自动使用环境变量中的代理设置。

修改 `start-with-proxy.sh` 中的代理地址：

```bash
export http_proxy="socks5://your-proxy-host:port"
export https_proxy="socks5://your-proxy-host:port"
```

### 验证代理

```bash
# 测试代理连通性
curl -x socks5://127.0.0.1:1080 https://api.telegram.org/bot<TOKEN>/getMe
```

## 💻 嵌入到网页

### 最简单方式

在网页 `</body>` 标签前添加：

```html
<script src="http://your-server:3000/chat-widget.js"></script>
```

### 自定义配置

```html
<script>
  window.ChatWidgetConfig = {
    // 用户身份（推荐从登录系统获取）
    userId: 'user_12345',      // 必填：唯一用户ID
    userName: '张三',          // 可选：显示名称
    userEmail: 'user@example.com', // 可选：邮箱

    // 外观配置
    position: 'right',         // 'right' 或 'left'
    primaryColor: '#0088cc',   // 主题色

    // 服务器地址
    wsUrl: 'ws://your-server:8080'  // WebSocket 地址
  };
</script>
<script src="http://your-server:3000/chat-widget.js"></script>
```

## 📊 管理后台

访问 `http://your-server:3001`，使用 `admin` / `admin` 登录。

### 功能

1. **仪表盘**
   - 总用户数
   - 活跃用户数
   - 今日新增用户
   - 即将到期用户

2. **用户管理**
   - 用户列表（分页、搜索）
   - 查看用户详情
   - 用户充值/延期
   - 启用/禁用用户

3. **充值功能**
   - 点击用户操作栏的"充值"按钮
   - 输入天数
   - 自动记录充值日志

## 🗄️ 数据库

使用 SQLite 数据库，位于 `data/database.db`。

### 表结构

1. **users** - 用户信息
   ```sql
   user_id VARCHAR(255) PRIMARY KEY
   username VARCHAR(255)
   email VARCHAR(255)
   remaining_days INTEGER       -- 剩余天数
   total_days INTEGER           -- 总购买天数
   is_active BOOLEAN            -- 是否启用
   total_messages INTEGER       -- 总消息数
   created_at DATETIME
   ```

2. **user_topics** - 用户话题映射
   ```sql
   user_id VARCHAR(255) PRIMARY KEY
   topic_id INTEGER             -- Telegram 话题 ID
   topic_name VARCHAR(255)
   ```

3. **recharge_logs** - 充值记录
   ```sql
   user_id VARCHAR(255)
   days INTEGER                 -- 充值天数
   operator VARCHAR(255)        -- 操作员
   note TEXT                    -- 备注
   created_at DATETIME
   ```

4. **admins** - 管理员
   ```sql
   username VARCHAR(255) PRIMARY KEY
   password VARCHAR(255)        -- bcrypt 加密
   role VARCHAR(50)
   ```

5. **system_config** - 系统配置
   ```sql
   key VARCHAR(255) PRIMARY KEY
   value TEXT
   ```

### 数据库操作

```bash
# 进入数据库
sqlite3 data/database.db

# 查看所有用户
SELECT * FROM users;

# 查看今日新增
SELECT * FROM users WHERE DATE(created_at) = DATE('now');

# 查看充值记录
SELECT * FROM recharge_logs ORDER BY created_at DESC;

# 备份数据库
cp data/database.db data/database.db.backup
```

## 🔧 系统架构

```
┌─────────────┐         WebSocket         ┌─────────────┐
│  网页用户    │ ←──────────────────────→ │  Node.js    │
│  (浏览器)    │                           │  服务器      │
└─────────────┘                           └─────────────┘
                                                  ↕
                                          Telegram Bot API
                                                  ↕
                                          ┌─────────────┐
                                          │  Telegram   │
                                          │   群组      │
                                          │  (客服端)    │
                                          └─────────────┘
```

### 端口说明

- **8080** - WebSocket 服务器（用户聊天）
- **3000** - HTTP 服务器（聊天组件、测试页面）
- **3001** - 管理后台（用户管理、统计）

### 消息流程

1. **用户发送消息**
   - 浏览器 WebSocket → Node.js 服务器
   - 服务器检查用户权限（剩余天数）
   - 创建/获取用户对应的 Telegram 话题
   - 转发消息到 Telegram 群组话题

2. **客服回复消息**
   - 客服在 Telegram 群组话题中回复
   - Telegram Bot 接收消息
   - 查找话题对应的用户 ID
   - 通过 WebSocket 发送给用户浏览器

## 🛠️ 故障排查

### 1. 无法连接 Telegram API

**错误**：`ETIMEDOUT` 或 `ECONNREFUSED`

**解决**：
- 确认服务器可以访问 `api.telegram.org`
- 如果在中国大陆，需要配置代理
- 使用 `start-with-proxy.sh` 启动
- 验证代理可用：`curl -x socks5://127.0.0.1:1080 https://api.telegram.org`

### 2. 聊天组件不显示

**检查**：
1. 浏览器控制台是否有错误
2. WebSocket 连接是否成功（开发者工具 → Network → WS）
3. 服务器日志：`tail -f data/logs/app.log`

### 3. 无法创建话题

**原因**：
- 群组未启用 Topics 功能
- Bot 不是管理员
- Bot 没有管理话题权限

**解决**：
1. 群组设置 → 启用 "Topics"
2. 添加 Bot 为管理员
3. 给 Bot 分配 "管理话题" 权限

### 4. 数据库锁定

**错误**：`SQLITE_BUSY`

**解决**：
```bash
# 停止服务
kill $(cat data/app.pid)

# 删除 WAL 文件
rm data/database.db-wal
rm data/database.db-shm

# 重启
./start.sh
```

### 5. 管理后台登录失败

**检查**：
1. 确认数据库已初始化：`ls data/database.db`
2. 重新初始化：`node scripts/init-db.js`
3. 默认账号：`admin` / `admin`

## 🔒 安全建议

1. **修改默认密码**
   - 登录管理后台后立即修改 `admin` 密码

2. **生产环境配置**
   - 修改 `JWT_SECRET` 环境变量
   - 使用 HTTPS（配置 Nginx 反向代理）
   - 管理后台限制 IP 访问

3. **数据备份**
   ```bash
   # 定期备份数据库
   0 2 * * * cp ~/telegram-chat-system/data/database.db ~/backups/db-$(date +\%Y\%m\%d).db
   ```

4. **防火墙配置**
   ```bash
   # 只开放必要端口
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw deny 3001/tcp  # 管理后台仅内网访问
   ```

## 📝 文件结构

```
telegram-chat-system/
├── server/
│   └── app.js              # 核心服务器（900+ 行）
├── public/
│   ├── chat-widget.js      # 前端聊天组件（1000+ 行）
│   ├── test.html           # 测试页面
│   └── uploads/            # 媒体文件缓存目录
├── admin-panel/
│   └── index.html          # 管理后台单页应用
├── scripts/
│   └── init-db.js          # 数据库初始化脚本
├── data/                   # 数据目录（自动创建）
│   ├── database.db         # SQLite 数据库
│   └── logs/               # 日志文件
├── config.json             # 配置文件（需创建）
├── config.example.json     # 配置示例
├── package.json            # 依赖配置
├── start.sh                # 启动脚本（无代理）
├── start-with-proxy.sh     # 启动脚本（使用代理）
├── CURRENT_STATUS.md       # 系统当前状态报告
├── PHASE3_UPDATE.md        # Phase 3 更新详情
├── TESTING_GUIDE.md        # 测试指南
└── STICKER_FIX_GUIDE.md    # 贴纸修复技术文档
```

## 🌟 高级功能

### 环境变量配置

除了 `config.json`，也可以使用环境变量：

```bash
export BOT_TOKEN="your-bot-token"
export GROUP_ID="-1001234567890"
export JWT_SECRET="your-secret-key"
export DEFAULT_TRIAL_DAYS="7"

node server/app.js
```

### 多公司支持

每个公司部署独立实例：
1. 创建独立的 Bot
2. 创建独立的群组
3. 部署独立的服务器实例（不同端口）

或者修改代码支持多租户（需要自行开发）。

### 定时任务

系统使用 `node-cron` 实现每日扣费：

```javascript
// 每天 00:00 北京时间
cron.schedule('0 0 * * *', () => {
  // 扣除所有用户 1 天
}, { timezone: 'Asia/Shanghai' });
```

### 性能监控

建议使用 PM2 监控：

```bash
pm2 start server/app.js --name telegram-chat
pm2 monit
```

## 🎯 Phase 3 新功能 (2025-10-14)

### Emoji选择器升级
- ✅ 从 127 个扩展到 **800+ 个emoji**
- ✅ **9大分类导航**: 全部、笑脸、手势、心形、动物、食物、旅行、物品、符号、旗帜
- ✅ 分类按钮hover效果和active状态高亮
- ✅ Emoji悬停放大效果（scale 1.15）
- ✅ 平滑滚动动画

### Telegram媒体显示修复
- ✅ **贴纸显示** - WebM动画贴纸使用`<video>`标签，保留完整动画效果
- ✅ **GIF播放** - MP4格式GIF自动循环播放
- ✅ **图片显示** - JPG/PNG图片正常显示
- ✅ **智能缓存** - MD5哈希去重，避免重复下载
- ✅ **超时保护** - 30s获取链接超时，60s下载超时，防止服务器崩溃
- ✅ **格式兼容** - 自动检测文件格式，使用正确的HTML标签
- ✅ **代理支持** - 通过SOCKS5代理下载Telegram文件
- ✅ **降级策略** - 下载失败时显示文本占位符

### 技术亮点
- 文件缓存到 `public/uploads/` 目录，解决CORS跨域问题
- 保留原始文件格式（WebM/WebP/MP4/JPG），确保最佳显示效果
- 使用 `<video autoplay loop muted playsinline>` 播放动画
- Promise.race() 实现超时控制，确保服务器稳定性
- 完整的错误处理和日志记录

### 详细文档
- 📊 [CURRENT_STATUS.md](./CURRENT_STATUS.md) - 系统当前状态和技术架构
- 📝 [PHASE3_UPDATE.md](./PHASE3_UPDATE.md) - Phase 3 完整更新报告
- 🧪 [TESTING_GUIDE.md](./TESTING_GUIDE.md) - 详细测试指南（6个测试用例）
- 🔧 [STICKER_FIX_GUIDE.md](./STICKER_FIX_GUIDE.md) - 贴纸修复技术方案

## 📄 许可

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系

如有问题，请创建 GitHub Issue。
