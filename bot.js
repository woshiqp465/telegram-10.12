/**
 * Telegram 双向客服系统
 * 用户私聊 Bot <-> 群组话题 <-> 客服
 */

const { Telegraf } = require('telegraf');
const fs = require('fs');

// 读取配置
let config;
try {
  config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch (error) {
  console.error('❌ 无法读取 config.json 文件');
  console.error('💡 请复制 config.example.json 为 config.json 并填写配置');
  process.exit(1);
}

// 验证配置
if (!config.botToken) {
  console.error('❌ 请在 config.json 中填写 botToken');
  process.exit(1);
}

if (!config.groupId) {
  console.error('❌ 请在 config.json 中填写 groupId');
  console.error('💡 运行 node get-group-id.js 来获取群组 ID');
  process.exit(1);
}

// 创建 Bot
const bot = new Telegraf(config.botToken);

// 存储用户话题ID的映射 (userId -> topicId)
const userTopics = new Map();
// 存储话题ID到用户ID的反向映射 (topicId -> userId)
const topicUsers = new Map();
// 存储正在创建话题的用户ID (防止并发创建重复话题)
const creatingTopics = new Set();

/**
 * 为用户创建专属话题
 */
async function createUserTopic(ctx, userId, username, firstName) {
  const displayName = username ? `@${username}` : firstName || '用户';
  const topicName = `用户 - ${firstName || '新用户'}`;

  try {
    console.log(`📝 正在为用户 ${displayName} (ID: ${userId}) 创建话题: "${topicName}"`);

    // 标记正在创建中
    creatingTopics.add(userId);

    const forumTopic = await ctx.telegram.createForumTopic(config.groupId, topicName);
    const topicId = forumTopic.message_thread_id;

    console.log(`✅ 成功创建话题 "${topicName}" (Topic ID: ${topicId})`);

    // 立即保存双向映射
    userTopics.set(userId, topicId);
    topicUsers.set(topicId, userId);

    // 移除创建中标记
    creatingTopics.delete(userId);

    // 在新话题中发送欢迎消息
    const welcomeMessage =
      `👋 新用户咨询\n\n` +
      `👤 用户: ${displayName}\n` +
      `🆔 Telegram ID: ${userId}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📢 本话题用于与该用户沟通\n` +
      `💬 客服在此回复,消息将自动发送给用户`;

    await ctx.telegram.sendMessage(config.groupId, welcomeMessage, {
      message_thread_id: topicId,
    });

    console.log(`✅ 已为用户 ${displayName} 创建话题`);
    return topicId;

  } catch (error) {
    console.error(`❌ 创建话题失败:`, error.message);
    // 发生错误也要移除创建中标记
    creatingTopics.delete(userId);
    return null;
  }
}

// ==================== 双向消息转发系统 ====================
bot.on('message', async (ctx) => {
  const message = ctx.message;
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;
  const messageThreadId = message.message_thread_id;
  const from = ctx.from;
  const fromId = from.id;
  const botId = ctx.botInfo.id;

  // 不处理Bot自己发的消息
  if (fromId === botId) {
    return;
  }

  // ========== 场景1: 用户私聊 → 转发到群组话题 ==========
  if (chatType === 'private') {
    const userId = fromId;
    const username = from.username;
    const firstName = from.first_name;
    const displayName = username ? `@${username}` : firstName || '用户';

    console.log(`📱 收到用户私聊: ${displayName} (ID: ${userId})`);

    // 检查是否已有话题
    let topicId = userTopics.get(userId);

    // 如果没有话题且不在创建中,创建新话题
    if (!topicId && !creatingTopics.has(userId)) {
      console.log(`💡 用户 ${displayName} 还没有话题,正在创建...`);
      topicId = await createUserTopic(ctx, userId, username, firstName);

      if (!topicId) {
        // 创建失败,通知用户
        await ctx.reply('⚠️ 系统繁忙,请稍后再试');
        return;
      }
    } else if (creatingTopics.has(userId)) {
      // 正在创建中,等待100ms后重新获取
      console.log(`⏳ 用户 ${displayName} 的话题正在创建中,等待...`);
      await new Promise(resolve => setTimeout(resolve, 100));
      topicId = userTopics.get(userId);

      // 如果等待后仍然没有,说明创建失败了
      if (!topicId) {
        console.log(`⚠️ 用户 ${displayName} 话题创建超时,跳过此消息`);
        return;
      }
    }

    // 转发消息到群组话题
    try {
      if (message.text) {
        await ctx.telegram.sendMessage(
          config.groupId,
          `👤 ${displayName}:\n💬 ${message.text}`,
          { message_thread_id: topicId }
        );
      } else if (message.photo) {
        const photo = message.photo[message.photo.length - 1];
        await ctx.telegram.sendPhoto(config.groupId, photo.file_id, {
          caption: `👤 ${displayName}:\n📷 ` + (message.caption || ''),
          message_thread_id: topicId
        });
      } else if (message.document) {
        await ctx.telegram.sendDocument(config.groupId, message.document.file_id, {
          caption: `👤 ${displayName}:\n📎 ` + (message.caption || ''),
          message_thread_id: topicId
        });
      } else if (message.voice) {
        await ctx.telegram.sendVoice(config.groupId, message.voice.file_id, {
          caption: `👤 ${displayName}:\n🎤 语音`,
          message_thread_id: topicId
        });
      } else if (message.video) {
        await ctx.telegram.sendVideo(config.groupId, message.video.file_id, {
          caption: `👤 ${displayName}:\n🎥 ` + (message.caption || ''),
          message_thread_id: topicId
        });
      } else if (message.audio) {
        await ctx.telegram.sendAudio(config.groupId, message.audio.file_id, {
          caption: `👤 ${displayName}:\n🎵 ` + (message.caption || ''),
          message_thread_id: topicId
        });
      } else if (message.sticker) {
        await ctx.telegram.sendMessage(
          config.groupId,
          `👤 ${displayName}:\n😊 发送了贴纸`,
          { message_thread_id: topicId }
        );
        await ctx.telegram.sendSticker(config.groupId, message.sticker.file_id, {
          message_thread_id: topicId
        });
      }
      console.log(`  ✅ 已转发到群组话题 ${topicId}`);
    } catch (error) {
      console.error(`  ❌ 转发到群组话题失败:`, error.message);
    }

    return;
  }

  // ========== 场景2: 群组话题 → 转发回用户私聊 ==========
  if (chatType === 'supergroup' && chatId === config.groupId && messageThreadId) {
    const fromName = from.username ? `@${from.username}` : from.first_name || '客服';

    console.log(`💬 收到群组话题消息: ${fromName} (ID: ${fromId}) 在话题 ${messageThreadId}`);

    // 查找该话题对应的用户
    const targetUserId = topicUsers.get(messageThreadId);

    if (!targetUserId) {
      console.log(`  ⚠️ 话题 ${messageThreadId} 没有对应的用户`);
      return;
    }

    // 构建转发消息前缀 (简洁版,无尾巴)
    const messagePrefix = `💬 客服 ${fromName}:\n`;
    const messageFooter = '';

    // 转发消息给用户
    try {
      if (message.text) {
        await ctx.telegram.sendMessage(
          targetUserId,
          `${messagePrefix}${message.text}${messageFooter}`
        );
      } else if (message.photo) {
        const photo = message.photo[message.photo.length - 1];
        await ctx.telegram.sendPhoto(targetUserId, photo.file_id, {
          caption: `${messagePrefix}📷 ` + (message.caption || '') + messageFooter
        });
      } else if (message.document) {
        await ctx.telegram.sendDocument(targetUserId, message.document.file_id, {
          caption: `${messagePrefix}📎 ` + (message.caption || '') + messageFooter
        });
      } else if (message.voice) {
        await ctx.telegram.sendVoice(targetUserId, message.voice.file_id, {
          caption: `${messagePrefix}🎤 语音${messageFooter}`
        });
      } else if (message.video) {
        await ctx.telegram.sendVideo(targetUserId, message.video.file_id, {
          caption: `${messagePrefix}🎥 ` + (message.caption || '') + messageFooter
        });
      } else if (message.audio) {
        await ctx.telegram.sendAudio(targetUserId, message.audio.file_id, {
          caption: `${messagePrefix}🎵 ` + (message.caption || '') + messageFooter
        });
      } else if (message.sticker) {
        await ctx.telegram.sendMessage(targetUserId, `${messagePrefix}😊 发送了贴纸${messageFooter}`);
        await ctx.telegram.sendSticker(targetUserId, message.sticker.file_id);
      }

      console.log(`  ✅ 已转发给用户 ${targetUserId}`);
    } catch (error) {
      console.error(`  ❌ 转发给用户 ${targetUserId} 失败:`, error.message);
      if (error.response && error.response.error_code === 403) {
        console.log(`  ⚠️ 用户 ${targetUserId} 可能屏蔽了Bot`);
        // 在话题中通知客服
        await ctx.reply(`⚠️ 无法发送消息给用户(用户可能屏蔽了Bot)`, {
          message_thread_id: messageThreadId
        });
      }
    }

    return;
  }
});

// 启动 Bot
bot.launch();

console.log('🤖 Telegram 双向客服系统已启动!');
console.log('');
console.log('💬 工作模式:');
console.log(`  📍 群组 ID: ${config.groupId}`);
console.log('  🎯 用户私聊 → 自动创建话题并转发到群组');
console.log('  💬 群组话题 → 客服回复自动转发给用户');
console.log('  👥 话题命名: "用户 - 名字"');
console.log('  🔔 支持: 文本/图片/文件/语音/视频/音频/贴纸');
console.log('');
console.log('✅ Bot 运行中...');
console.log('');

// 优雅关闭
process.once('SIGINT', () => {
  console.log('\n正在关闭 Bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('\n正在关闭 Bot...');
  bot.stop('SIGTERM');
});
