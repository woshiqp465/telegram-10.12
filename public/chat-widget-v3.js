/**
 * Telegram 客服系统 V3 - 现代化增强版
 * 新增：typing指示器、已读回执、在线状态、历史记录、快捷回复、现代化UI
 */
(function() {
  'use strict';

  const config = window.ChatWidgetConfig || {};
  const wsUrl = config.wsUrl || 'ws://192.168.9.159:8080';
  const position = config.position || 'right';
  const primaryColor = config.primaryColor || '#667eea';

  let userId = config.userId || localStorage.getItem('chat_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('chat_user_id', userId);
  }

  let ws = null;
  let connected = false;
  let messageIdCounter = 0;
  const messages = new Map();
  let typingTimer = null;
  let unreadCount = 0;
  let staffOnline = true;
  let quickReplies = [];

  // Emoji 列表
  const emojis = ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙','💪','🙏','✍️','💅','🤳','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝'];

  function createWidget() {
    const posStyle = position === 'right' ? 'right:20px' : 'left:20px';
    const windowPosStyle = position === 'right' ? 'right:0' : 'left:0';

    const html = `
      <div id="chat-widget" style="position:fixed;bottom:20px;${posStyle};z-index:999999">
        <!-- 悬浮按钮 -->
        <div id="chat-button" style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg, ${primaryColor} 0%, #764ba2 100%);color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 20px rgba(102, 126, 234, 0.4);font-size:28px;transition:all 0.3s;position:relative" onmouseover="this.style.transform='scale(1.1) translateY(-2px)';this.style.boxShadow='0 8px 30px rgba(102, 126, 234, 0.6)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.4)'">
          💬
          <span id="unread-badge" style="display:none;position:absolute;top:-5px;right:-5px;background:#ff4444;color:white;border-radius:12px;padding:2px 8px;font-size:11px;font-weight:bold;min-width:20px;text-align:center;box-shadow:0 2px 8px rgba(255,68,68,0.5)"></span>
        </div>

        <!-- 聊天窗口 -->
        <div id="chat-window" style="display:none;position:absolute;bottom:85px;${windowPosStyle};width:400px;height:650px;background:white;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,0.2);flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">

          <!-- 头部 -->
          <div style="background:linear-gradient(135deg, ${primaryColor} 0%, #764ba2 100%);color:white;padding:16px;display:flex;justify-content:space-between;align-items:center">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <div style="font-weight:600;font-size:16px">客服团队</div>
                <div id="staff-status" style="display:flex;align-items:center;gap:4px">
                  <span style="width:8px;height:8px;background:#10b981;border-radius:50%;animation:pulse 2s infinite"></span>
                  <span style="font-size:12px;opacity:0.95">在线</span>
                </div>
              </div>
              <div style="font-size:11px;opacity:0.85" id="chat-status">通常在5分钟内回复</div>
            </div>
            <button id="chat-close" style="background:none;border:none;color:white;font-size:32px;cursor:pointer;padding:0;width:36px;height:36px;line-height:32px;border-radius:50%;transition:background 0.2s" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='none'">×</button>
          </div>

          <!-- 消息区域 -->
          <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px;background:#f7f8fa"></div>

          <!-- 正在输入指示器 -->
          <div id="typing-indicator" style="display:none;padding:8px 16px;background:#f7f8fa">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="display:flex;gap:3px">
                <span style="width:6px;height:6px;background:#9ca3af;border-radius:50%;animation:bounce 1.4s infinite ease-in-out"></span>
                <span style="width:6px;height:6px;background:#9ca3af;border-radius:50%;animation:bounce 1.4s infinite ease-in-out 0.16s"></span>
                <span style="width:6px;height:6px;background:#9ca3af;border-radius:50%;animation:bounce 1.4s infinite ease-in-out 0.32s"></span>
              </div>
              <span style="font-size:12px;color:#6b7280">客服正在输入...</span>
            </div>
          </div>

          <!-- 快捷回复 -->
          <div id="quick-replies-bar" style="display:none;padding:8px 16px;background:white;border-top:1px solid #e5e7eb;overflow-x:auto;white-space:nowrap"></div>

          <!-- Emoji 选择器 -->
          <div id="emoji-picker" style="display:none;max-height:200px;overflow-y:auto;padding:8px;background:white;border-top:1px solid #e0e0e0;text-align:center"></div>

          <!-- 图片预览区 -->
          <div id="image-preview" style="display:none;padding:8px 16px;background:#f9f9f9;border-top:1px solid #e0e0e0"></div>

          <!-- 输入区域 -->
          <div style="background:white;border-top:1px solid #e5e7eb">
            <!-- 工具栏 -->
            <div style="display:flex;gap:8px;padding:8px 16px;border-bottom:1px solid #f0f0f0">
              <button id="btn-emoji" title="表情" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:background 0.2s" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='none'">😀</button>
              <button id="btn-image" title="上传图片" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:background 0.2s" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='none'">📷</button>
              <button id="btn-quick-reply" title="快捷回复" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:background 0.2s" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='none'">⚡</button>
              <input type="file" id="file-input" accept="image/*" style="display:none">
            </div>

            <!-- 输入框 -->
            <div style="padding:12px 16px">
              <div style="display:flex;gap:8px;align-items:flex-end">
                <div style="flex:1;position:relative">
                  <div id="chat-input" contenteditable="true" placeholder="输入消息..." style="min-height:40px;max-height:120px;overflow-y:auto;padding:10px 12px;border:1px solid #e0e0e0;border-radius:20px;outline:none;background:white;line-height:1.5;transition:border-color 0.2s" data-placeholder="输入消息..."></div>
                </div>
                <button id="chat-send" style="background:linear-gradient(135deg, ${primaryColor} 0%, #764ba2 100%);color:white;border:none;border-radius:50%;width:42px;height:42px;cursor:pointer;font-size:18px;flex-shrink:0;transition:all 0.2s;box-shadow:0 2px 8px rgba(102,126,234,0.3)" onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 4px 12px rgba(102,126,234,0.5)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 2px 8px rgba(102,126,234,0.3)'">➤</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 样式 -->
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        #chat-input:empty:before {
          content: attr(data-placeholder);
          color: #999;
          pointer-events: none;
        }
        #chat-input:focus {
          border-color: ${primaryColor};
        }
        #chat-messages::-webkit-scrollbar,
        #emoji-picker::-webkit-scrollbar,
        #chat-input::-webkit-scrollbar {
          width: 6px;
        }
        #chat-messages::-webkit-scrollbar-thumb,
        #emoji-picker::-webkit-scrollbar-thumb,
        #chat-input::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 3px;
        }
        .emoji-item {
          display: inline-block;
          font-size: 24px;
          padding: 6px;
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.2s, transform 0.1s;
        }
        .emoji-item:hover {
          background: #f0f0f0;
          transform: scale(1.2);
        }
        .message-image {
          max-width: 280px;
          max-height: 280px;
          border-radius: 12px;
          cursor: pointer;
          transition: opacity 0.2s;
          display: block;
        }
        .message-image:hover {
          opacity: 0.9;
        }
        .message-bubble {
          position: relative;
          max-width: 75%;
          padding: 10px 14px;
          border-radius: 18px;
          word-wrap: break-word;
          white-space: pre-wrap;
          animation: slideIn 0.3s ease-out;
        }
        .message-container {
          margin-bottom: 12px;
          display: flex;
          position: relative;
          animation: fadeIn 0.3s ease-out;
        }
        .message-container:hover .message-actions {
          opacity: 1;
        }
        .message-actions {
          position: absolute;
          top: 0;
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s;
          background: rgba(255,255,255,0.95);
          padding: 4px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .message-container.user .message-actions {
          right: 0;
        }
        .message-container.staff .message-actions {
          left: 0;
        }
        .action-btn {
          background: none;
          border: none;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 14px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .action-btn:hover {
          background: #e5e7eb;
        }
        .message-edited {
          font-size: 10px;
          color: #9ca3af;
          font-style: italic;
          margin-top: 4px;
        }
        .message-status {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 2px;
          text-align: right;
        }
        .message-time {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 4px;
        }
        .image-caption {
          padding: 8px;
          font-size: 14px;
        }
        .preview-image-container {
          position: relative;
          display: inline-block;
        }
        .preview-image {
          max-width: 200px;
          max-height: 150px;
          border-radius: 8px;
        }
        .preview-remove {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0,0,0,0.6);
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          font-size: 16px;
          line-height: 20px;
        }
        .quick-reply-btn {
          display: inline-block;
          padding: 6px 12px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          margin-right: 8px;
        }
        .quick-reply-btn:hover {
          background: #e5e7eb;
          border-color: ${primaryColor};
          color: ${primaryColor};
        }
        .date-divider {
          text-align: center;
          margin: 16px 0 8px;
          color: #9ca3af;
          font-size: 12px;
        }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }
