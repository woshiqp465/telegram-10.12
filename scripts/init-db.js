/**
 * 数据库初始化脚本
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// 项目根目录的data文件夹
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');
const db = new Database(dbPath);

console.log('📦 开始初始化数据库...\n');

// 1. 用户表
console.log('创建表: users');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255),
    email VARCHAR(255),
    is_anonymous BOOLEAN DEFAULT 1,
    
    -- 付费相关
    total_days INTEGER DEFAULT 0,
    used_days INTEGER DEFAULT 0,
    remaining_days INTEGER DEFAULT 0,
    expire_date DATETIME,
    is_active BOOLEAN DEFAULT 1,
    
    -- 统计
    first_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_messages INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 2. 话题映射表
console.log('创建表: user_topics');
db.exec(`
  CREATE TABLE IF NOT EXISTS user_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    topic_id INTEGER NOT NULL,
    topic_name VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )
`);

// 3. 充值记录表
console.log('创建表: recharge_logs');
db.exec(`
  CREATE TABLE IF NOT EXISTS recharge_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(255) NOT NULL,
    days INTEGER NOT NULL,
    operator VARCHAR(255),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )
`);

// 4. 管理员表
console.log('创建表: admins');
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 5. 系统配置表
console.log('创建表: system_config');
db.exec(`
  CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 创建索引
console.log('\n创建索引...');
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_topics_user_id ON user_topics(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_topics_topic_id ON user_topics(topic_id);
  CREATE INDEX IF NOT EXISTS idx_recharge_logs_user_id ON recharge_logs(user_id);
`);

// 创建默认管理员账号
console.log('\n创建默认管理员账号...');
const hashedPassword = bcrypt.hashSync('admin', 10);
try {
  db.prepare('INSERT INTO admins (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'super_admin');
  console.log('✅ 默认管理员创建成功: admin / admin');
} catch (err) {
  if (err.message.includes('UNIQUE')) {
    console.log('⚠️ 管理员账号已存在，跳过');
  } else {
    console.error('❌ 创建管理员失败:', err.message);
  }
}

// 插入默认配置
console.log('\n插入默认系统配置...');
const configs = [
  ['default_trial_days', '7', '新用户默认试用天数'],
  ['system_name', 'Telegram 客服系统', '系统名称'],
  ['enable_registration', 'true', '是否允许新用户注册'],
];

const insertConfig = db.prepare('INSERT OR IGNORE INTO system_config (key, value, description) VALUES (?, ?, ?)');
configs.forEach(([key, value, desc]) => {
  insertConfig.run(key, value, desc);
});

console.log('✅ 默认配置插入完成');

db.close();

console.log('\n🎉 数据库初始化完成！');
console.log('📍 数据库位置:', dbPath);
console.log('\n默认管理员账号:');
console.log('  用户名: admin');
console.log('  密码: admin');
console.log('  ⚠️ 请尽快修改密码！\n');
