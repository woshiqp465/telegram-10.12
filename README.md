# Telegram 双向客服系统

一个简单易用的 Telegram Bot,实现用户私聊与群组话题的双向转发,让客服团队高效管理用户对话。

## ✨ 功能特点

- 🤖 **自动创建话题**: 用户私聊 Bot 时自动在群组中创建专属话题
- 💬 **双向转发**: 用户私聊 ↔ 群组话题 ↔ 客服,实时同步消息
- 🚫 **防重复创建**: 每个用户永远只有一个话题,不会重复创建
- 📝 **多种消息类型**: 支持文本、图片、文件、语音、视频、音频、贴纸
- 🎯 **简洁易用**: 只需要配置 Bot Token 和群组 ID 即可使用
- 💾 **无需数据库**: 纯内存运行,不需要配置数据库

## 📋 使用场景

- 客服系统
- 用户反馈收集
- 技术支持
- 咨询服务

## 🚀 快速开始

### 1. 创建 Telegram Bot

1. 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 创建新的 Bot
3. 按照提示设置 Bot 名称和用户名
4. 保存 Bot Token (类似: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### 2. 创建并配置群组

1. 创建一个新的 Telegram 群组
2. 将群组升级为**超级群组**:
   - 群组设置 → 群组类型 → 公开群组 (升级后可以改回私密)
3. 开启**话题功能**:
   - 群组设置 → 话题 → 开启
4. 将 Bot 加入群组
5. 给 Bot **管理员权限**:
   - 群组设置 → 管理员 → 添加管理员
   - 选择你的 Bot
   - **重要**: 勾选 "管理话题" 权限

### 3. 安装项目

```bash
# 克隆项目
git clone https://github.com/woshiqp465/telegram-10.12.git
cd telegram-10.12

# 安装依赖
npm install
```

### 4. 配置 Bot

```bash
# 复制配置文件
cp config.example.json config.json
```

编辑 `config.json` 文件,填写你的 Bot Token:

```json
{
  "botToken": "你的Bot Token",
  "groupId": -1001234567890
}
```

### 5. 获取群组 ID

运行群组 ID 检测工具:

```bash
npm run get-group-id
```

或者:

```bash
node get-group-id.js
```

然后在群组中发送一条消息(比如: "hello"),控制台会显示群组 ID。

将获取到的群组 ID 填写到 `config.json` 中。

### 6. 启动 Bot

```bash
npm start
```

或者:

```bash
node bot.js
```

看到以下输出表示启动成功:

```
🤖 Telegram 双向客服系统已启动!

💬 工作模式:
  📍 群组 ID: -1001234567890
  🎯 用户私聊 → 自动创建话题并转发到群组
  💬 群组话题 → 客服回复自动转发给用户
  👥 话题命名: "用户 - 名字"
  🔔 支持: 文本/图片/文件/语音/视频/音频/贴纸

✅ Bot 运行中...
```

## 💡 使用方法

### 对于用户:
1. 在 Telegram 中搜索并打开你的 Bot
2. 发送任意消息
3. Bot 会自动在客服群组中创建一个专属话题
4. 等待客服回复

### 对于客服:
1. 在群组中会自动创建新的话题 (名称: "用户 - 用户名")
2. 在话题中回复用户消息
3. 你的回复会自动发送给用户
4. 支持发送文本、图片、文件等多种类型

## 📁 项目结构

```
telegram-customer-service/
├── bot.js                 # 主程序
├── get-group-id.js        # 群组 ID 检测工具
├── config.json            # 配置文件 (需要自己创建)
├── config.example.json    # 配置文件示例
├── package.json           # 项目依赖
├── .gitignore            # Git 忽略文件
└── README.md             # 说明文档
```

## ⚙️ 配置说明

`config.json` 文件结构:

```json
{
  "botToken": "你的Bot Token",
  "groupId": -1001234567890
}
```

- `botToken`: 从 @BotFather 获取的 Bot Token
- `groupId`: 客服群组的 ID (负数,通过 get-group-id.js 获取)

## ❓ 常见问题

### 1. Bot 无法创建话题?

**原因**: Bot 没有管理话题权限

**解决**:
- 群组设置 → 管理员 → 找到你的 Bot
- 确保勾选了 "管理话题" 权限

### 2. 群组 ID 是负数正常吗?

**正常**! 所有超级群组的 ID 都是负数,这是 Telegram 的设计。

### 3. 为同一个用户创建了多个话题?

**重启 Bot 后会丢失数据**: 因为使用内存存储,重启后会为同一用户创建新话题。

**解决方法**: 保持 Bot 持续运行,或者手动删除多余的话题。

### 4. 用户看不到客服回复?

**原因**: 用户可能屏蔽了 Bot

**解决**: 在话题中会显示错误提示,提醒客服用户已屏蔽 Bot。

## 🔧 进阶配置

### 修改话题命名格式

编辑 `bot.js` 文件,找到这一行:

```javascript
const topicName = `用户 - ${firstName || '新用户'}`;
```

修改为你想要的格式,比如:

```javascript
const topicName = `${firstName} 的咨询`;
```

### 后台运行

使用 PM2 让 Bot 后台运行:

```bash
# 安装 PM2
npm install -g pm2

# 启动 Bot
pm2 start bot.js --name telegram-customer-service

# 查看状态
pm2 status

# 查看日志
pm2 logs telegram-customer-service

# 停止 Bot
pm2 stop telegram-customer-service
```

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📞 支持

如有问题,请在 GitHub 上提交 Issue。
