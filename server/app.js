/**
 * Telegram 客服系统 - 主服务器
 * 功能：WebSocket + Telegram Bot + 用户时长管理
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Telegraf } = require('telegraf');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { SocksProxyAgent } = require('socks-proxy-agent');
const https = require('https');
const crypto = require('crypto');

// ==================== 配置 ====================

// 读取环境变量（如果有.env文件）
let BOT_TOKEN = process.env.BOT_TOKEN || '';
let GROUP_ID = process.env.GROUP_ID || '';
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-key';
const DEFAULT_TRIAL_DAYS = parseInt(process.env.DEFAULT_TRIAL_DAYS || '7');

// 如果没有环境变量，读取配置文件
if (!BOT_TOKEN) {
  const configPath = path.join(__dirname, '..', 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    BOT_TOKEN = config.BOT_TOKEN || '';
    GROUP_ID = config.GROUP_ID || '';
  }
}

const WS_PORT = 8080;
const HTTP_PORT = 3000;
const ADMIN_PORT = 3001;

// ==================== 数据库初始化 ====================

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // 性能优化

console.log('📦 数据库连接成功:', dbPath);

// 创建聊天历史表
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    content TEXT,
    content_type VARCHAR(50) DEFAULT 'text',
    from_staff BOOLEAN DEFAULT 0,
    staff_name VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    UNIQUE(user_id, message_id)
  );

  CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
`);

console.log('✅ 聊天历史表已就绪');

// ==================== Express 应用 ====================

const app = express();
const adminApp = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

adminApp.use(cors());
adminApp.use(express.json());
adminApp.use(express.static(path.join(__dirname, '..', 'admin-panel')));

// ==================== WebSocket 服务器 ====================

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 存储 WebSocket 连接 (userId -> ws)
const userConnections = new Map();

// 存储用户话题映射 (userId -> topicId)
const userTopics = new Map();
// 反向映射 (topicId -> userId)
const topicUsers = new Map();
// 正在创建话题的用户 (防并发)
const creatingTopics = new Set();
// 消息ID映射 (clientMsgId -> {telegramMsgId, userId, topicId})
const messageIdMap = new Map();
// Telegram消息ID反向映射 (telegramMsgId -> clientMsgId)
const telegramMessageMap = new Map();
// 正在输入状态追踪 (userId -> {timer, timestamp})
const typingStatus = new Map();
// 客服在线状态 (默认在线)
const staffOnlineStatus = { online: true, count: 0 };
// 未读消息计数 (userId -> count)
const unreadCounts = new Map();

// 从数据库加载现有映射
function loadTopicMappings() {
  const mappings = db.prepare('SELECT user_id, topic_id FROM user_topics').all();
  mappings.forEach(({ user_id, topic_id }) => {
    userTopics.set(user_id, topic_id);
    topicUsers.set(topic_id, user_id);
  });
  console.log(`✅ 加载了 ${mappings.length} 个话题映射`);
}

loadTopicMappings();

// WebSocket 连接处理
wss.on('connection', (ws) => {
  let userId = null;
  
  console.log('🔌 新的 WebSocket 连接');
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // 认证消息
      if (message.type === 'auth') {
        userId = message.userId || `anon_${uuidv4().substring(0, 16)}`;
        userConnections.set(userId, ws);
        
        console.log(`✅ 用户认证: ${userId}`);
        
        // 检查用户是否存在，不存在则创建
        await getOrCreateUser(userId, message.username, message.email);
        
        // 获取用户信息
        const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
        
        // 发送用户信息
        ws.send(JSON.stringify({
          type: 'user_info',
          user: {
            userId: user.user_id,
            remainingDays: user.remaining_days,
            isActive: user.is_active === 1,
          }
        }));

        // 发送未读消息计数
        const unreadCount = unreadCounts.get(userId) || 0;
        if (unreadCount > 0) {
          ws.send(JSON.stringify({
            type: 'unread_count',
            count: unreadCount
          }));
        }

        // 加载历史消息（从 Telegram 获取）
        const topicId = userTopics.get(userId);
        if (topicId && BOT_TOKEN) {
          // TODO: 从 Telegram 获取历史消息
        }

        return;
      }
      
      // 聊天消息
      if (message.type === 'chat' && userId) {
        const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);

        // 检查用户权限
        if (user.remaining_days <= 0 && user.remaining_days !== -1) {
          ws.send(JSON.stringify({
            type: 'error',
            message: '您的服务已到期，请联系管理员续费'
          }));
          return;
        }

        // 更新最后访问时间和消息数
        db.prepare('UPDATE users SET last_visit = CURRENT_TIMESTAMP, total_messages = total_messages + 1 WHERE user_id = ?').run(userId);

        // 转发到 Telegram
        if (BOT_TOKEN && GROUP_ID) {
          await forwardToTelegram(userId, message, user);
        }
      }

      // 删除消息
      if (message.type === 'delete_message' && userId) {
        const mapping = messageIdMap.get(message.msgId);
        if (mapping) {
          try {
            await bot.telegram.deleteMessage(GROUP_ID, mapping.telegramMsgId);
            messageIdMap.delete(message.msgId);
            telegramMessageMap.delete(mapping.telegramMsgId);
            console.log(`✅ 删除消息: ${message.msgId} -> Telegram ${mapping.telegramMsgId}`);
          } catch (err) {
            console.error('删除消息失败:', err);
          }
        }
      }

      // 编辑消息
      if (message.type === 'edit_message' && userId) {
        const mapping = messageIdMap.get(message.msgId);
        if (mapping) {
          try {
            const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
            const displayName = user.username || user.user_id.substring(0, 16);

            await bot.telegram.editMessageText(
              GROUP_ID,
              mapping.telegramMsgId,
              null,
              `👤 ${displayName}:\n💬 ${message.newText}\n\n✏️ 已编辑`
            );
            console.log(`✅ 编辑消息: ${message.msgId} -> Telegram ${mapping.telegramMsgId}`);
          } catch (err) {
            console.error('编辑消息失败:', err);
          }
        }
      }

      // 用户正在输入
      if (message.type === 'typing_start' && userId) {
        const topicId = userTopics.get(userId);
        if (topicId && BOT_TOKEN) {
          try {
            // 向Telegram发送"正在输入"动作
            await bot.telegram.sendChatAction(GROUP_ID, 'typing', {
              message_thread_id: topicId
            });

            // 记录typing状态
            if (typingStatus.has(userId)) {
              clearTimeout(typingStatus.get(userId).timer);
            }

            // 设置自动清除定时器
            const timer = setTimeout(() => {
              typingStatus.delete(userId);
            }, 10000); // 10秒后自动清除

            typingStatus.set(userId, {
              timer,
              timestamp: Date.now()
            });

            console.log(`⌨️ 用户 ${userId} 正在输入`);
          } catch (err) {
            console.error('发送typing动作失败:', err);
          }
        }
      }

      // 用户停止输入
      if (message.type === 'typing_stop' && userId) {
        if (typingStatus.has(userId)) {
          clearTimeout(typingStatus.get(userId).timer);
          typingStatus.delete(userId);
          console.log(`⏸️ 用户 ${userId} 停止输入`);
        }
      }

      // 标记已读
      if (message.type === 'mark_read' && userId) {
        // 清除未读计数
        unreadCounts.delete(userId);
        console.log(`✓ 用户 ${userId} 标记消息为已读`);
      }

    } catch (err) {
      console.error('WebSocket 消息处理错误:', err);
    }
  });
  
  ws.on('close', () => {
    if (userId) {
      userConnections.delete(userId);
      console.log(`❌ 用户断开连接: ${userId}`);
    }
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket 错误:', err);
  });
});

// ==================== 用户管理函数 ====================

async function getOrCreateUser(userId, username = null, email = null) {
  let user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  
  if (!user) {
    // 新用户，赠送试用天数
    db.prepare(`
      INSERT INTO users (user_id, username, email, remaining_days, total_days, is_anonymous)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, username, email, DEFAULT_TRIAL_DAYS, DEFAULT_TRIAL_DAYS, username ? 0 : 1);
    
    console.log(`✅ 新用户注册: ${userId} (赠送 ${DEFAULT_TRIAL_DAYS} 天)`);
    user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  }
  
  return user;
}

async function forwardToTelegram(userId, message, user) {
  try {
    // 获取或创建话题
    let topicId = userTopics.get(userId);

    if (!topicId && !creatingTopics.has(userId)) {
      topicId = await createUserTopic(userId, user);
    } else if (creatingTopics.has(userId)) {
      // 等待创建完成
      await new Promise(resolve => setTimeout(resolve, 200));
      topicId = userTopics.get(userId);
    }

    if (!topicId) {
      console.error('❌ 无法获取话题ID');
      return;
    }

    const displayName = user.username || user.user_id.substring(0, 16);
    const contentType = message.contentType || 'text';

    let result;

    // 根据内容类型发送不同消息
    if (contentType === 'image') {
      // 发送图片
      // Base64 转 Buffer
      const base64Data = message.data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // 使用用户提供的 caption 或默认文本
      const caption = message.caption
        ? `👤 ${displayName}:\n💬 ${message.caption}`
        : `👤 ${displayName} 发送了图片`;

      result = await bot.telegram.sendPhoto(GROUP_ID, {
        source: buffer,
        filename: message.filename || 'image.jpg'
      }, {
        caption: caption,
        message_thread_id: topicId
      });

      console.log(`✅ 转发图片到 Telegram (用户: ${userId})`);
    } else if (contentType === 'sticker') {
      // 发送贴纸
      result = await bot.telegram.sendSticker(GROUP_ID, message.data, {
        message_thread_id: topicId
      });

      console.log(`✅ 转发贴纸到 Telegram (用户: ${userId})`);
    } else if (contentType === 'animation') {
      // 发送 GIF/动画
      const base64Data = message.data.replace(/^data:image\/gif;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      result = await bot.telegram.sendAnimation(GROUP_ID, {
        source: buffer,
        filename: 'animation.gif'
      }, {
        message_thread_id: topicId
      });

      console.log(`✅ 转发 GIF 到 Telegram (用户: ${userId})`);
    } else {
      // 发送文本消息
      result = await bot.telegram.sendMessage(GROUP_ID, `👤 ${displayName}:\n💬 ${message.text}`, {
        message_thread_id: topicId
      });

      console.log(`✅ 转发消息到 Telegram (用户: ${userId})`);
    }

    // 存储消息ID映射
    if (message.msgId && result && result.message_id) {
      messageIdMap.set(message.msgId, {
        telegramMsgId: result.message_id,
        userId: userId,
        topicId: topicId
      });
      telegramMessageMap.set(result.message_id, message.msgId);
      console.log(`📝 存储消息映射: ${message.msgId} -> ${result.message_id}`);
    }

    // 保存到历史记录
    if (message.msgId) {
      const content = contentType === 'text' ? message.text :
                     contentType === 'image' ? (message.caption || '[图片]') :
                     contentType === 'sticker' ? '[贴纸]' :
                     contentType === 'animation' ? '[动画]' : '';
      saveMessageToHistory(userId, message.msgId, contentType, content, false, null);
    }

  } catch (err) {
    console.error('转发到 Telegram 失败:', err);
  }
}

async function createUserTopic(userId, user) {
  if (!BOT_TOKEN || !GROUP_ID) return null;

  creatingTopics.add(userId);

  try {
    const displayName = user.username || `用户${userId.substring(0, 8)}`;
    const topicName = `用户 - ${displayName}`;

    console.log(`📝 创建话题: ${topicName}`);

    const topic = await bot.telegram.createForumTopic(GROUP_ID, topicName);
    const topicId = topic.message_thread_id;

    // 保存映射
    userTopics.set(userId, topicId);
    topicUsers.set(topicId, userId);

    db.prepare('INSERT OR REPLACE INTO user_topics (user_id, topic_id, topic_name) VALUES (?, ?, ?)').run(userId, topicId, topicName);

    // 发送欢迎消息
    await bot.telegram.sendMessage(GROUP_ID,
      `👋 新用户咨询\n\n` +
      `👤 用户: ${displayName}\n` +
      `🆔 ID: ${userId}\n` +
      `📅 剩余天数: ${user.remaining_days} 天\n` +
      `💬 客服在此回复，消息将自动发送给用户`,
      { message_thread_id: topicId }
    );

    console.log(`✅ 话题创建成功: ${topicId}`);
    return topicId;

  } catch (err) {
    console.error('创建话题失败:', err);
    return null;
  } finally {
    creatingTopics.delete(userId);
  }
}

// 保存消息到历史记录
function saveMessageToHistory(userId, msgId, contentType, content, fromStaff = false, staffName = null) {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO chat_messages (user_id, message_id, message_type, content_type, content, from_staff, staff_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, msgId, 'chat', contentType, content, fromStaff ? 1 : 0, staffName);
  } catch (err) {
    console.error('保存消息历史失败:', err);
  }
}

// 获取聊天历史
function getChatHistory(userId, limit = 50) {
  try {
    const messages = db.prepare(`
      SELECT * FROM chat_messages
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit);

    return messages.reverse(); // 返回从旧到新的顺序
  } catch (err) {
    console.error('获取聊天历史失败:', err);
    return [];
  }
}

// ==================== Telegram Bot ====================

let bot;

if (BOT_TOKEN) {
  // 配置代理（用于访问 Telegram API）
  const proxyAgent = new SocksProxyAgent('socks5://127.0.0.1:1080');

  bot = new Telegraf(BOT_TOKEN, {
    telegram: {
      agent: proxyAgent
    }
  });

  console.log('🌐 已配置代理: socks5://127.0.0.1:1080');

  // 创建uploads目录
  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ 创建uploads目录:', uploadsDir);
  }

  // 辅助函数：将WebM/WebP转换为PNG
  async function convertToPNG(inputPath, outputPath) {
    try {
      const sharp = require('sharp');

      // 读取文件的第一帧并转换为PNG
      await sharp(inputPath, { animated: false })
        .png()
        .toFile(outputPath);

      const fileSize = fs.statSync(outputPath).size;
      console.log(`✅ 已转换为PNG: ${path.basename(outputPath)} (${(fileSize / 1024).toFixed(1)}KB)`);

      // 删除原始文件
      fs.unlinkSync(inputPath);

      return outputPath;
    } catch (err) {
      console.error('转换图片格式失败:', err);
      throw err;
    }
  }

  // 辅助函数：下载Telegram文件并保存到本地，返回HTTP URL
  async function downloadAndSaveTelegramFile(fileId, fileType = 'file') {
    try {
      // 获取文件链接（设置30秒超时）
      const fileLink = await Promise.race([
        bot.telegram.getFileLink(fileId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('获取文件链接超时')), 30000)
        )
      ]);

      // 生成唯一文件名
      const hash = crypto.createHash('md5').update(fileId).digest('hex');
      const ext = path.extname(fileLink.pathname) || getExtensionByType(fileType);
      const filename = `${hash}${ext}`;
      const filepath = path.join(uploadsDir, filename);

      // 对于WebM/WebP格式，检查是否已存在转换后的PNG文件
      const needsConversion = (ext === '.webm' || ext === '.webp');
      const finalFilename = needsConversion ? `${hash}.png` : filename;
      const finalFilepath = needsConversion ? path.join(uploadsDir, finalFilename) : filepath;

      // 如果最终文件已存在，直接返回URL
      if (fs.existsSync(finalFilepath)) {
        console.log(`✅ 文件已缓存: ${finalFilename}`);
        return `http://192.168.9.159:3000/uploads/${finalFilename}`;
      }

      // 通过代理下载文件并保存（设置60秒超时）
      await Promise.race([
        new Promise((resolve, reject) => {
          const fileStream = fs.createWriteStream(filepath);
          let downloadTimeout = setTimeout(() => {
            fileStream.close();
            fs.unlink(filepath, () => {});
            reject(new Error('文件下载超时'));
          }, 60000);

          https.get(fileLink.href, { agent: proxyAgent }, (response) => {
            response.pipe(fileStream);

            fileStream.on('finish', () => {
              clearTimeout(downloadTimeout);
              fileStream.close();
              const fileSize = fs.statSync(filepath).size;
              console.log(`✅ 文件已保存: ${filename} (${(fileSize / 1024).toFixed(1)}KB)`);
              resolve();
            });

            fileStream.on('error', (err) => {
              clearTimeout(downloadTimeout);
              fs.unlink(filepath, () => {}); // 删除不完整的文件
              reject(err);
            });
          }).on('error', (err) => {
            clearTimeout(downloadTimeout);
            fs.unlink(filepath, () => {});
            reject(err);
          });
        })
      ]);

      // 如果需要转换格式（设置30秒超时）
      if (needsConversion) {
        console.log(`🔄 开始转换格式: ${ext} -> PNG`);
        await Promise.race([
          convertToPNG(filepath, finalFilepath),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('格式转换超时')), 30000)
          )
        ]);
      }

      return `http://192.168.9.159:3000/uploads/${finalFilename}`;

    } catch (err) {
      console.error('下载Telegram文件失败:', err.message || err);
      throw err;
    }
  }

  // 根据文件类型获取扩展名
  function getExtensionByType(fileType) {
    const extensions = {
      'photo': '.jpg',
      'sticker': '.webp',
      'animation': '.gif',
      'video': '.mp4',
      'audio': '.mp3',
      'document': '.bin'
    };
    return extensions[fileType] || '.bin';
  }

  // 处理群组消息（客服回复）
  bot.on('message', async (ctx) => {
    const message = ctx.message;
    const chatId = ctx.chat.id;
    const chatType = ctx.chat.type;
    const messageThreadId = message.message_thread_id;
    const fromId = ctx.from.id;
    const botId = ctx.botInfo.id;

    // 不处理 Bot 自己的消息
    if (fromId === botId) return;

    // 只处理群组话题消息
    if (chatType === 'supergroup' && chatId.toString() === GROUP_ID && messageThreadId) {
      const userId = topicUsers.get(messageThreadId);

      if (!userId) {
        console.log(`⚠️ 话题 ${messageThreadId} 没有对应的用户`);
        return;
      }

      // 转发给用户
      const ws = userConnections.get(userId);
      const isUserOnline = ws && ws.readyState === WebSocket.OPEN;

      if (isUserOnline) {
        const fromName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name || '客服';
        const msgId = `staff_${message.message_id}`;

        // 判断消息类型
        if (message.photo) {
          // 图片消息
          const photos = message.photo;
          const largestPhoto = photos[photos.length - 1]; // 获取最大尺寸

          try {
            console.log(`📥 开始下载图片: ${largestPhoto.file_id}`);
            const imageUrl = await downloadAndSaveTelegramFile(largestPhoto.file_id, 'photo');

            ws.send(JSON.stringify({
              type: 'message',
              from: 'staff',
              staffName: fromName,
              contentType: 'image',
              data: imageUrl,
              caption: message.caption || '',
              msgId: msgId,
              timestamp: Date.now()
            }));

            // 存储映射（客服消息也要追踪）
            telegramMessageMap.set(message.message_id, msgId);

            console.log(`✅ 转发图片给用户 ${userId}: ${imageUrl}`);
          } catch (err) {
            console.error('获取图片失败:', err);
            ws.send(JSON.stringify({
              type: 'message',
              from: 'staff',
              staffName: fromName,
              contentType: 'text',
              text: '[图片] (加载失败)',
              msgId: msgId,
              timestamp: Date.now()
            }));
          }
        } else if (message.text) {
          // 文本消息
          ws.send(JSON.stringify({
            type: 'message',
            from: 'staff',
            staffName: fromName,
            contentType: 'text',
            text: message.text,
            msgId: msgId,
            timestamp: Date.now()
          }));

          // 存储映射
          telegramMessageMap.set(message.message_id, msgId);

          console.log(`✅ 转发文本给用户 ${userId}`);
        } else if (message.sticker) {
          // 贴纸消息
          try {
            console.log(`📥 开始下载贴纸: ${message.sticker.file_id}`);
            const stickerUrl = await downloadAndSaveTelegramFile(message.sticker.file_id, 'sticker');

            ws.send(JSON.stringify({
              type: 'message',
              from: 'staff',
              staffName: fromName,
              contentType: 'sticker',
              data: stickerUrl,
              emoji: message.sticker.emoji || '',
              msgId: msgId,
              timestamp: Date.now()
            }));

            telegramMessageMap.set(message.message_id, msgId);

            console.log(`✅ 转发贴纸给用户 ${userId}: ${stickerUrl}`);
          } catch (err) {
            console.error('获取贴纸失败:', err);
            // 发送错误提示
            ws.send(JSON.stringify({
              type: 'message',
              from: 'staff',
              staffName: fromName,
              contentType: 'text',
              text: `[贴纸] ${message.sticker.emoji || '📄'} (加载失败)`,
              msgId: msgId,
              timestamp: Date.now()
            }));
          }
        } else if (message.animation) {
          // GIF/动画消息
          try {
            console.log(`📥 开始下载GIF: ${message.animation.file_id}`);
            const gifUrl = await downloadAndSaveTelegramFile(message.animation.file_id, 'animation');

            ws.send(JSON.stringify({
              type: 'message',
              from: 'staff',
              staffName: fromName,
              contentType: 'animation',
              data: gifUrl,
              msgId: msgId,
              timestamp: Date.now()
            }));

            telegramMessageMap.set(message.message_id, msgId);

            console.log(`✅ 转发 GIF 给用户 ${userId}: ${gifUrl}`);
          } catch (err) {
            console.error('获取 GIF 失败:', err);
            // 发送错误提示
            ws.send(JSON.stringify({
              type: 'message',
              from: 'staff',
              staffName: fromName,
              contentType: 'text',
              text: '[GIF动图] (加载失败)',
              msgId: msgId,
              timestamp: Date.now()
            }));
          }
        } else {
          // 其他类型消息
          ws.send(JSON.stringify({
            type: 'message',
            from: 'staff',
            staffName: fromName,
            contentType: 'text',
            text: '[不支持的消息类型]',
            timestamp: Date.now()
          }));
        }

        // 保存客服消息到历史记录
        const staffMsgContentType = message.photo ? 'image' :
                           message.text ? 'text' :
                           message.sticker ? 'sticker' :
                           message.animation ? 'animation' : 'text';
        const staffMsgContent = message.text || (message.caption || '') || `[${staffMsgContentType}]`;
        saveMessageToHistory(userId, msgId, staffMsgContentType, staffMsgContent, true, fromName);

      } else {
        // 用户不在线，增加未读计数
        const currentCount = unreadCounts.get(userId) || 0;
        unreadCounts.set(userId, currentCount + 1);
        console.log(`⚠️ 用户 ${userId} 不在线，未读消息: ${currentCount + 1}`);
      }
    }
  });

  // 处理编辑的消息
  bot.on('edited_message', async (ctx) => {
    const message = ctx.editedMessage;
    const messageThreadId = message.message_thread_id;

    if (!messageThreadId) return;

    const userId = topicUsers.get(messageThreadId);
    if (!userId) return;

    const ws = userConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      // 查找对应的客户端消息ID
      const clientMsgId = telegramMessageMap.get(message.message_id);

      if (clientMsgId && message.text) {
        ws.send(JSON.stringify({
          type: 'message_edited',
          msgId: clientMsgId,
          newText: message.text
        }));

        console.log(`✅ 通知用户 ${userId} 消息已编辑: ${clientMsgId}`);
      }
    }
  });
  
  bot.launch();
  console.log('✅ Telegram Bot 已启动');
  
} else {
  console.log('⚠️ 未配置 BOT_TOKEN，Telegram 功能已禁用');
}

// ==================== 定时任务：每日扣费 ====================

// 每天凌晨 0:00 执行扣费
cron.schedule('0 0 * * *', () => {
  console.log('\n⏰ 执行每日扣费任务...');
  
  const users = db.prepare('SELECT * FROM users WHERE is_active = 1 AND remaining_days > 0').all();
  
  for (const user of users) {
    const newRemaining = user.remaining_days - 1;
    
    db.prepare('UPDATE users SET remaining_days = ?, used_days = used_days + 1 WHERE user_id = ?').run(newRemaining, user.user_id);
    
    // 到期通知
    if (newRemaining === 0) {
      const ws = userConnections.get(user.user_id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'system',
          message: '您的服务已到期，请联系管理员续费'
        }));
      }
    }
    
    // 即将到期提醒
    if (newRemaining === 3) {
      const ws = userConnections.get(user.user_id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'system',
          message: `您的服务将在 ${newRemaining} 天后到期，请及时续费`
        }));
      }
    }
  }
  
  console.log(`✅ 扣费完成，处理 ${users.length} 个用户\n`);
}, {
  timezone: 'Asia/Shanghai'
});

// ==================== 管理后台 API ====================

// 认证中间件
function authenticateAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未授权' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '令牌无效' });
  }
}

// 管理员登录
adminApp.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  res.json({ success: true, token, admin: { username: admin.username, role: admin.role } });
});

// 获取统计数据
adminApp.get('/api/stats', authenticateAdmin, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
  const todayUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = DATE('now')").get().count;
  const expiringUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE remaining_days > 0 AND remaining_days <= 3').get().count;
  
  res.json({
    totalUsers,
    activeUsers,
    todayUsers,
    expiringUsers
  });
});

// 获取用户列表
adminApp.get('/api/users', authenticateAdmin, (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (page - 1) * limit;
  
  let query = 'SELECT * FROM users';
  let countQuery = 'SELECT COUNT(*) as count FROM users';
  const params = [];
  
  if (search) {
    query += ' WHERE user_id LIKE ? OR username LIKE ? OR email LIKE ?';
    countQuery += ' WHERE user_id LIKE ? OR username LIKE ? OR email LIKE ?';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  
  const users = db.prepare(query).all(...params, limit, offset);
  const total = db.prepare(countQuery).get(...params).count;
  
  res.json({
    users,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit)
  });
});

// 充值/延期
adminApp.post('/api/users/:userId/recharge', authenticateAdmin, (req, res) => {
  const { userId } = req.params;
  const { days, note } = req.body;
  
  try {
    db.prepare('UPDATE users SET remaining_days = remaining_days + ?, total_days = total_days + ? WHERE user_id = ?').run(days, days, userId);
    
    db.prepare('INSERT INTO recharge_logs (user_id, days, operator, note) VALUES (?, ?, ?, ?)').run(userId, days, req.admin.username, note || '');
    
    // 通知用户
    const ws = userConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'system',
        message: `您的账户已充值 ${days} 天，感谢您的支持！`
      }));
    }
    
    res.json({ success: true, message: `已充值 ${days} 天` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 启用/禁用用户
adminApp.post('/api/users/:userId/toggle', authenticateAdmin, (req, res) => {
  const { userId } = req.params;
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
    const newStatus = user.is_active === 1 ? 0 : 1;
    
    db.prepare('UPDATE users SET is_active = ? WHERE user_id = ?').run(newStatus, userId);
    
    res.json({ success: true, isActive: newStatus === 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 启动服务器 ====================

server.listen(WS_PORT, () => {
  console.log(`\n✅ WebSocket 服务器运行在: ws://192.168.9.159:${WS_PORT}`);
});

app.listen(HTTP_PORT, () => {
  console.log(`✅ HTTP 服务器运行在: http://192.168.9.159:${HTTP_PORT}`);
});

adminApp.listen(ADMIN_PORT, () => {
  console.log(`✅ 管理后台运行在: http://192.168.9.159:${ADMIN_PORT}`);
});

console.log('\n📊 系统信息:');
console.log(`  - 默认试用天数: ${DEFAULT_TRIAL_DAYS} 天`);
console.log(`  - Telegram Bot: ${BOT_TOKEN ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`  - 时区: Asia/Shanghai (北京时间)`);
console.log('\n🎉 系统启动完成！\n');

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  if (bot) bot.stop('SIGINT');
  db.close();
  process.exit(0);
});
