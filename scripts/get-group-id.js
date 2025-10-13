/**
 * 获取 Telegram 群组 ID
 * 使用方法：
 * 1. 创建一个 Telegram 群组
 * 2. 将 Bot 添加到群组
 * 3. 在群组中发送一条消息
 * 4. 运行此脚本
 */

const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// 读取配置
const configPath = path.join(__dirname, '..', 'config.json');
let BOT_TOKEN = '';

if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  BOT_TOKEN = config.BOT_TOKEN || '';
}

if (!BOT_TOKEN) {
  console.error('❌ 错误：未找到 BOT_TOKEN');
  console.log('\n请先创建 config.json 文件：');
  console.log('{\n  "BOT_TOKEN": "你的Bot Token"\n}');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

console.log('🤖 Bot 已启动，等待接收群组消息...\n');
console.log('📝 操作步骤：');
console.log('1. 将 Bot 添加到你的群组');
console.log('2. 在群组中发送任意消息');
console.log('3. 此脚本会显示群组 ID\n');

bot.on('message', (ctx) => {
  const chat = ctx.chat;

  console.log('✅ 收到消息！\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 群组信息：');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`类型: ${chat.type}`);
  console.log(`标题: ${chat.title || '(私聊)'}`);
  console.log(`ID: ${chat.id}`);

  if (chat.type === 'supergroup') {
    console.log('\n✅ 这是一个超级群组，可以使用！');
    console.log(`\n请将以下 ID 添加到 config.json 中：`);
    console.log(`"GROUP_ID": "${chat.id}"`);

    // 检查是否启用了 Topics
    if (chat.is_forum) {
      console.log('\n✅ 已启用 Topics 功能');
    } else {
      console.log('\n⚠️  未启用 Topics 功能');
      console.log('请在群组设置中启用 "Topics"');
    }
  } else if (chat.type === 'group') {
    console.log('\n⚠️  这是普通群组，需要转换为超级群组');
    console.log('请在群组设置中将其升级为超级群组');
  } else {
    console.log('\n❌ 这不是群组，请在群组中发送消息');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
});

bot.launch();

// 优雅关闭
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// 超时提示
setTimeout(() => {
  console.log('\n⏰ 已等待 60 秒，未收到消息');
  console.log('请确认：');
  console.log('1. Bot 已添加到群组');
  console.log('2. 在群组中发送了消息');
  console.log('3. Bot Token 正确');
  process.exit(1);
}, 60000);
