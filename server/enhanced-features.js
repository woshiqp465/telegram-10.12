/**
 * 增强功能模块
 * 包含：typing指示器、历史记录、快捷回复等
 */

// 创建聊天历史表
function createChatHistoryTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id VARCHAR(255) NOT NULL,
      message_id VARCHAR(255) UNIQUE,
      telegram_msg_id INTEGER,
      message_type VARCHAR(50) NOT NULL,
      content TEXT,
      from_staff BOOLEAN DEFAULT 0,
      staff_name VARCHAR(255),
      caption TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME,
      INDEX idx_user_id (user_id),
      INDEX idx_created_at (created_at)
    );
    
    CREATE TABLE IF NOT EXISTS quick_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      shortcut VARCHAR(50),
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // 插入默认快捷回复
  const count = db.prepare('SELECT COUNT(*) as count FROM quick_replies').get().count;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO quick_replies (title, content, shortcut, sort_order) VALUES (?, ?, ?, ?)');
    insert.run('问候', '您好！有什么可以帮您？', '/hello', 1);
    insert.run('查询中', '请稍等，我查询一下相关信息', '/wait', 2);
    insert.run('感谢等待', '感谢您的耐心等待', '/thanks', 3);
    insert.run('还有问题', '还有其他问题需要帮助吗？', '/more', 4);
    insert.run('结束语', '祝您生活愉快！如有问题随时联系我们', '/bye', 5);
  }
}

// 保存消息到历史
function saveMessageToHistory(db, data) {
  try {
    const stmt = db.prepare(`
      INSERT INTO chat_messages 
      (user_id, message_id, telegram_msg_id, message_type, content, from_staff, staff_name, caption, read_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      data.userId,
      data.messageId,
      data.telegramMsgId || null,
      data.messageType,
      data.content,
      data.fromStaff ? 1 : 0,
      data.staffName || null,
      data.caption || null,
      data.fromStaff ? new Date().toISOString() : null // 客服消息自动标记为已读
    );
  } catch (err) {
    console.error('保存消息历史失败:', err);
  }
}

// 获取聊天历史
function getChatHistory(db, userId, limit = 50) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(userId, limit).reverse(); // 反转以按时间正序显示
  } catch (err) {
    console.error('获取聊天历史失败:', err);
    return [];
  }
}

// 标记消息为已读
function markMessagesAsRead(db, userId) {
  try {
    const stmt = db.prepare(`
      UPDATE chat_messages 
      SET read_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND from_staff = 1 AND read_at IS NULL
    `);
    stmt.run(userId);
  } catch (err) {
    console.error('标记已读失败:', err);
  }
}

// 获取未读消息数
function getUnreadCount(db, userId) {
  try {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM chat_messages 
      WHERE user_id = ? AND from_staff = 1 AND read_at IS NULL
    `);
    return stmt.get(userId).count;
  } catch (err) {
    console.error('获取未读数失败:', err);
    return 0;
  }
}

// 获取快捷回复列表
function getQuickReplies(db) {
  try {
    const stmt = db.prepare('SELECT * FROM quick_replies ORDER BY sort_order ASC');
    return stmt.all();
  } catch (err) {
    console.error('获取快捷回复失败:', err);
    return [];
  }
}

module.exports = {
  createChatHistoryTable,
  saveMessageToHistory,
  getChatHistory,
  markMessagesAsRead,
  getUnreadCount,
  getQuickReplies
};
