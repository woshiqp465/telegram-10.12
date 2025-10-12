/**
 * 获取 Telegram 群组 ID 的工具
 *
 * 使用方法:
 * 1. 运行此脚本: node get-group-id.js
 * 2. 把 Bot 加入你的群组
 * 3. 在群里发送任意消息(比如: hello)
 * 4. 查看控制台输出的群组 ID
 */

const { Telegraf } = require('telegraf');
const fs = require('fs');

// 尝试从 config.json 读取 Bot Token
let BOT_TOKEN = '';

try {
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  BOT_TOKEN = config.botToken;
} catch (error) {
  console.log('⚠️  未找到 config.json 或配置文件格式错误');
}

// 如果没有配置文件,提示用户输入
if (!BOT_TOKEN) {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 Telegram 群组 ID 检测工具');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('❌ 请先创建 config.json 文件并填写 Bot Token');
  console.log('');
  console.log('📋 步骤:');
  console.log('1. 复制 config.example.json 为 config.json');
  console.log('2. 在 config.json 中填写你的 Bot Token');
  console.log('3. 重新运行此脚本');
  console.log('');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🤖 Bot 已启动,正在监听消息...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('📋 操作步骤:');
console.log('1. 确保 Bot 已加入你的群组');
console.log('2. 在群里发送任意消息(比如: hello)');
console.log('3. 查看下面显示的群组信息');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// 监听所有消息
bot.on('message', (ctx) => {
  const chat = ctx.chat;
  const from = ctx.from;
  const message = ctx.message;

  console.log('📨 收到新消息!');
  console.log('');
  console.log('📍 群组信息:');
  console.log(`  类型: ${chat.type}`);
  console.log(`  群组 ID: ${chat.id}`);
  console.log(`  群组名称: ${chat.title || '(无)'}`);

  if (chat.type === 'supergroup') {
    console.log('  ✅ 这是超级群组,支持话题功能!');
  } else if (chat.type === 'group') {
    console.log('  ⚠️  这是普通群组,需要升级为超级群组才能使用话题!');
  } else if (chat.type === 'private') {
    console.log('  💬 这是私聊消息');
  }

  console.log('');
  console.log('👤 发送者信息:');
  console.log(`  用户 ID: ${from.id}`);
  console.log(`  用户名: ${from.username || '(无)'}`);
  console.log(`  名字: ${from.first_name || ''} ${from.last_name || ''}`);
  console.log('');
  console.log('💬 消息内容:');
  console.log(`  ${message.text || '(非文本消息)'}`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // 如果是群组,给出使用提示
  if (chat.type === 'supergroup' || chat.type === 'group') {
    console.log('✅ 已获取群组 ID!');
    console.log('');
    console.log('📋 请记下这个群组 ID:');
    console.log(`👉 ${chat.id}`);
    console.log('');
    console.log('📝 下一步:');
    console.log('1. 复制上面的群组 ID');
    console.log('2. 编辑 config.json 文件');
    console.log('3. 将 groupId 的值改为上面的 ID');
    console.log('4. 运行 node bot.js 启动客服系统');
    console.log('');
    console.log('现在可以按 Ctrl+C 停止脚本了');
    console.log('');
  }
});

bot.launch();

console.log('✅ Bot 已启动成功!');
console.log('等待接收群组消息...');
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
