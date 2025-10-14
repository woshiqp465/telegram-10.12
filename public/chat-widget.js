/**
 * Telegram 客服系统 - 前端聊天组件 V2
 * 支持：消息撤回、编辑、图片+文字、复制粘贴、表情
 */
(function() {
  'use strict';

  const config = window.ChatWidgetConfig || {};
  const wsUrl = config.wsUrl || 'ws://192.168.9.159:8080';
  const position = config.position || 'right';
  const primaryColor = config.primaryColor || '#667eea';
  const gradientColor = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  let unreadCount = 0;

  let userId = config.userId || localStorage.getItem('chat_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('chat_user_id', userId);
  }

  let ws = null;
  let connected = false;
  let messageIdCounter = 0;
  const messages = new Map(); // 存储所有消息 {msgId -> {data, element}}
  let typingTimer = null;
  let isTyping = false;

  // Emoji 列表
  const emojis = ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙','💪','🙏','✍️','💅','🤳','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝'];

  function createWidget() {
    const posStyle = position === 'right' ? 'right:20px' : 'left:20px';
    const windowPosStyle = position === 'right' ? 'right:0' : 'left:0';

    const html = `
      <div id="chat-widget" style="position:fixed;bottom:20px;${posStyle};z-index:999999">
        <!-- 悬浮按钮 -->
        <div id="chat-button" style="width:64px;height:64px;border-radius:50%;background:${gradientColor};color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 20px rgba(102, 126, 234, 0.4);font-size:28px;transition:all 0.3s;position:relative;animation:pulse-ring 3s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite" onmouseover="this.style.transform='scale(1.1) translateY(-2px)';this.style.boxShadow='0 8px 30px rgba(102, 126, 234, 0.6)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.4)'">
          💬
          <span id="unread-badge" style="display:none;position:absolute;top:-5px;right:-5px;background:#ff4444;color:white;border-radius:12px;padding:2px 8px;font-size:11px;font-weight:bold;min-width:20px;text-align:center;box-shadow:0 2px 8px rgba(255,68,68,0.5)"></span>
        </div>

        <!-- 聊天窗口 -->
        <div id="chat-window" style="display:none;position:absolute;bottom:80px;${windowPosStyle};width:400px;height:600px;background:white;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.2);flex-direction:column;overflow:hidden">

          <!-- 头部 -->
          <div style="background:${gradientColor};color:white;padding:16px;display:flex;justify-content:space-between;align-items:center">
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

          <!-- Emoji 选择器 -->
          <div id="emoji-picker" style="display:none;max-height:200px;overflow-y:auto;padding:8px;background:white;border-top:1px solid #e0e0e0;text-align:center"></div>

          <!-- 图片预览区 -->
          <div id="image-preview" style="display:none;padding:8px 16px;background:#f9f9f9;border-top:1px solid #e0e0e0"></div>

          <!-- 输入区域 -->
          <div style="background:white;border-top:1px solid #e0e0e0">
            <!-- 工具栏 -->
            <div style="display:flex;gap:8px;padding:8px 16px;border-bottom:1px solid #f0f0f0">
              <button id="btn-emoji" title="表情" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:background 0.2s" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='none'">😀</button>
              <button id="btn-image" title="上传图片" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:background 0.2s" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='none'">📷</button>
              <input type="file" id="file-input" accept="image/*" style="display:none">
            </div>

            <!-- 输入框 -->
            <div style="padding:12px 16px">
              <div style="display:flex;gap:8px;align-items:flex-end">
                <div style="flex:1;position:relative">
                  <div id="chat-input" contenteditable="true" placeholder="输入消息..." style="min-height:40px;max-height:120px;overflow-y:auto;padding:10px 12px;border:1px solid #e0e0e0;border-radius:20px;outline:none;background:white;line-height:1.5" data-placeholder="输入消息..."></div>
                </div>
                <button id="chat-send" style="background:${gradientColor};color:white;border:none;border-radius:50%;width:42px;height:42px;cursor:pointer;font-size:18px;flex-shrink:0;transition:all 0.2s;box-shadow:0 2px 8px rgba(102,126,234,0.3)" onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 4px 12px rgba(102,126,234,0.5)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 2px 8px rgba(102,126,234,0.3)'">➤</button>
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
        @keyframes pulse-ring {
          0% { transform: scale(0.95); }
          50% { transform: scale(1.02); }
          100% { transform: scale(0.95); }
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
          padding: 4px;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .emoji-item:hover {
          background: #f0f0f0;
        }
        .message-image {
          max-width: 280px;
          max-height: 280px;
          border-radius: 8px;
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
        .message-container.user .message-bubble {
          background: ${gradientColor};
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
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
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
          background: #f0f0f0;
        }
        .message-edited {
          font-size: 11px;
          color: #999;
          font-style: italic;
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
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function initEvents() {
    document.getElementById('chat-button').onclick = () => {
      const win = document.getElementById('chat-window');
      if (win.style.display === 'none') {
        win.style.display = 'flex';
        document.getElementById('chat-input').focus();
        clearUnreadCount();
        connectWS();
      } else {
        win.style.display = 'none';
      }
    };

    document.getElementById('chat-close').onclick = () => {
      document.getElementById('chat-window').style.display = 'none';
    };

    document.getElementById('chat-send').onclick = sendMsg;

    const inputDiv = document.getElementById('chat-input');
    inputDiv.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });

    // 监听输入事件，发送typing状态
    inputDiv.addEventListener('input', () => {
      if (!connected) return;

      // 如果还没有开始typing，发送typing_start
      if (!isTyping) {
        isTyping = true;
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'typing_start',
            userId: userId
          }));
        }
      }

      // 清除之前的定时器
      clearTimeout(typingTimer);

      // 3秒后发送typing_stop
      typingTimer = setTimeout(() => {
        isTyping = false;
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'typing_stop',
            userId: userId
          }));
        }
      }, 3000);
    });

    inputDiv.addEventListener('paste', handlePaste);

    document.getElementById('btn-emoji').onclick = toggleEmojiPicker;

    document.getElementById('btn-image').onclick = () => {
      document.getElementById('file-input').click();
    };

    document.getElementById('file-input').onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        previewImage(file);
      }
      e.target.value = '';
    };

    initEmojiPicker();
  }

  function initEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    emojis.forEach(emoji => {
      const span = document.createElement('span');
      span.className = 'emoji-item';
      span.textContent = emoji;
      span.onclick = () => {
        insertEmoji(emoji);
        picker.style.display = 'none';
      };
      picker.appendChild(span);
    });
  }

  function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
  }

  function insertEmoji(emoji) {
    const input = document.getElementById('chat-input');
    input.focus();

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const textNode = document.createTextNode(emoji);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function handlePaste(e) {
    const items = e.clipboardData.items;
    let hasImage = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        previewImage(file);
        hasImage = true;
        break;
      }
    }

    if (!hasImage) {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    }
  }

  let pendingImage = null;

  function previewImage(file) {
    if (!file || !file.type.match('image.*')) {
      addMsg('❌ 只支持图片格式', 'sys');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addMsg('❌ 图片大小不能超过 5MB', 'sys');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxSize = 1200;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        pendingImage = compressedBase64;

        showImagePreview(compressedBase64);
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  }

  function showImagePreview(base64) {
    const preview = document.getElementById('image-preview');
    preview.style.display = 'block';
    preview.innerHTML = `
      <div class="preview-image-container">
        <img src="${base64}" class="preview-image">
        <button class="preview-remove" onclick="window.chatWidget.clearImagePreview()">×</button>
      </div>
    `;
    document.getElementById('chat-input').focus();
  }

  function clearImagePreview() {
    pendingImage = null;
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('image-preview').innerHTML = '';
  }

  window.chatWidget = { clearImagePreview };

  function connectWS() {
    if (connected) return;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connected = true;
      document.getElementById('chat-status').textContent = '在线';
      ws.send(JSON.stringify({
        type: 'auth',
        userId: userId,
        username: config.userName,
        email: config.userEmail
      }));
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === 'message') {
        if (data.contentType === 'image') {
          addImageMsg(data.data || data.text, 'staff', data.staffName, data.caption, data.msgId);
        } else if (data.contentType === 'sticker') {
          addStickerMsg(data.data, 'staff', data.staffName, data.emoji, data.msgId);
        } else if (data.contentType === 'animation') {
          addAnimationMsg(data.data, 'staff', data.staffName, data.msgId);
        } else {
          addMsg(data.text, 'staff', data.msgId, data.staffName);
        }
      } else if (data.type === 'system') {
        addMsg(data.message, 'sys');
      } else if (data.type === 'message_deleted') {
        deleteMessage(data.msgId);
      } else if (data.type === 'message_edited') {
        editMessage(data.msgId, data.newText);
      } else if (data.type === 'typing_start') {
        showTypingIndicator();
      } else if (data.type === 'typing_stop') {
        hideTypingIndicator();
      } else if (data.type === 'unread_count') {
        updateUnreadBadge(data.count);
      }
    };

    ws.onclose = () => {
      connected = false;
      document.getElementById('chat-status').textContent = '重连中...';
      setTimeout(connectWS, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket 错误:', err);
    };
  }

  function sendMsg() {
    const input = document.getElementById('chat-input');
    const text = input.textContent.trim();

    if (!text && !pendingImage) return;

    // 停止typing状态
    if (isTyping) {
      clearTimeout(typingTimer);
      isTyping = false;
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'typing_stop',
          userId: userId
        }));
      }
    }

    const msgId = 'msg_' + userId + '_' + (++messageIdCounter);

    if (pendingImage) {
      // 发送图片消息（可能带文字）
      addImageMsg(pendingImage, 'user', null, text, msgId);

      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'chat',
          contentType: 'image',
          data: pendingImage,
          caption: text,
          msgId: msgId
        }));
      }

      clearImagePreview();
    } else {
      // 纯文本消息
      addMsg(text, 'user', msgId);

      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'chat',
          contentType: 'text',
          text: text,
          msgId: msgId
        }));
      }
    }

    input.textContent = '';
    document.getElementById('emoji-picker').style.display = 'none';
  }

  function addMsg(text, from, msgId, staffName) {
    const div = document.getElementById('chat-messages');
    const isUser = from === 'user';
    const isSys = from === 'sys';

    if (!msgId) msgId = 'sys_' + Date.now();

    const msgContainer = document.createElement('div');
    msgContainer.className = 'message-container ' + from;
    msgContainer.id = msgId;
    msgContainer.style.justifyContent = isUser ? 'flex-end' : 'flex-start';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-bubble';
    contentDiv.style.cssText = `
      background: ${isSys ? '#fff3cd' : (isUser ? gradientColor : 'white')};
      color: ${isUser ? 'white' : '#333'};
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    if (staffName && !isUser && !isSys) {
      const nameSpan = document.createElement('div');
      nameSpan.textContent = staffName;
      nameSpan.style.cssText = 'font-size:11px;opacity:0.7;margin-bottom:4px;font-weight:bold';
      contentDiv.appendChild(nameSpan);
    }

    const textDiv = document.createElement('div');
    textDiv.textContent = text;
    textDiv.className = 'message-text';
    contentDiv.appendChild(textDiv);

    msgContainer.appendChild(contentDiv);

    // 添加操作按钮（仅用户消息）
    if (isUser && !isSys) {
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.innerHTML = `
        <button class="action-btn" onclick="window.chatWidget.editMsg('${msgId}')" title="编辑">✏️</button>
        <button class="action-btn" onclick="window.chatWidget.deleteMsg('${msgId}')" title="删除">🗑️</button>
      `;
      msgContainer.appendChild(actions);
    }

    div.appendChild(msgContainer);
    div.scrollTop = div.scrollHeight;

    messages.set(msgId, {
      element: msgContainer,
      text: text,
      type: 'text'
    });
  }

  function addImageMsg(imageSrc, from, staffName, caption, msgId) {
    const div = document.getElementById('chat-messages');
    const isUser = from === 'user';

    if (!msgId) msgId = 'img_' + Date.now();

    const msgContainer = document.createElement('div');
    msgContainer.className = 'message-container ' + from;
    msgContainer.id = msgId;
    msgContainer.style.justifyContent = isUser ? 'flex-end' : 'flex-start';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-bubble';
    contentDiv.style.cssText = `
      background: ${isUser ? gradientColor : 'white'};
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 4px;
    `;

    if (staffName && !isUser) {
      const nameSpan = document.createElement('div');
      nameSpan.textContent = staffName;
      nameSpan.style.cssText = 'font-size:11px;opacity:0.7;margin:4px 8px;font-weight:bold';
      contentDiv.appendChild(nameSpan);
    }

    const img = document.createElement('img');
    img.src = imageSrc;
    img.className = 'message-image';
    img.onclick = () => {
      window.open(imageSrc, '_blank');
    };
    contentDiv.appendChild(img);

    if (caption) {
      const captionDiv = document.createElement('div');
      captionDiv.className = 'image-caption';
      captionDiv.textContent = caption;
      captionDiv.style.color = isUser ? 'white' : '#333';
      contentDiv.appendChild(captionDiv);
    }

    msgContainer.appendChild(contentDiv);

    if (isUser) {
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.innerHTML = `
        <button class="action-btn" onclick="window.chatWidget.deleteMsg('${msgId}')" title="删除">🗑️</button>
      `;
      msgContainer.appendChild(actions);
    }

    div.appendChild(msgContainer);
    div.scrollTop = div.scrollHeight;

    messages.set(msgId, {
      element: msgContainer,
      imageSrc: imageSrc,
      caption: caption,
      type: 'image'
    });
  }

  function deleteMsg(msgId) {
    if (!confirm('确定要删除这条消息吗？')) return;

    const msgData = messages.get(msgId);
    if (!msgData) return;

    // 从界面移除
    msgData.element.remove();
    messages.delete(msgId);

    // 通知服务器
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'delete_message',
        msgId: msgId
      }));
    }
  }

  function deleteMessage(msgId) {
    const msgData = messages.get(msgId);
    if (!msgData) return;

    msgData.element.remove();
    messages.delete(msgId);
  }

  function editMsg(msgId) {
    const msgData = messages.get(msgId);
    if (!msgData || msgData.type !== 'text') return;

    const newText = prompt('编辑消息:', msgData.text);
    if (!newText || newText === msgData.text) return;

    // 更新界面
    const textDiv = msgData.element.querySelector('.message-text');
    textDiv.textContent = newText;

    // 添加已编辑标记
    let editedMark = msgData.element.querySelector('.message-edited');
    if (!editedMark) {
      editedMark = document.createElement('div');
      editedMark.className = 'message-edited';
      editedMark.textContent = '已编辑';
      msgData.element.querySelector('.message-bubble').appendChild(editedMark);
    }

    msgData.text = newText;

    // 通知服务器
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'edit_message',
        msgId: msgId,
        newText: newText
      }));
    }
  }

  function editMessage(msgId, newText) {
    const msgData = messages.get(msgId);
    if (!msgData || msgData.type !== 'text') return;

    const textDiv = msgData.element.querySelector('.message-text');
    textDiv.textContent = newText;

    let editedMark = msgData.element.querySelector('.message-edited');
    if (!editedMark) {
      editedMark = document.createElement('div');
      editedMark.className = 'message-edited';
      editedMark.textContent = '已编辑';
      msgData.element.querySelector('.message-bubble').appendChild(editedMark);
    }

    msgData.text = newText;
  }

  function addStickerMsg(stickerUrl, from, staffName, emoji, msgId) {
    const div = document.getElementById('chat-messages');
    const isUser = from === 'user';

    if (!msgId) msgId = 'sticker_' + Date.now();

    const msgContainer = document.createElement('div');
    msgContainer.className = 'message-container ' + from;
    msgContainer.id = msgId;
    msgContainer.style.justifyContent = isUser ? 'flex-end' : 'flex-start';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-bubble';
    contentDiv.style.cssText = `
      background: transparent;
      padding: 4px;
    `;

    if (staffName && !isUser) {
      const nameSpan = document.createElement('div');
      nameSpan.textContent = staffName;
      nameSpan.style.cssText = 'font-size:11px;opacity:0.7;margin:4px 8px;font-weight:bold;color:#666';
      contentDiv.appendChild(nameSpan);
    }

    const img = document.createElement('img');
    img.src = stickerUrl;
    img.style.cssText = 'width:150px;height:150px;object-fit:contain;display:block';
    img.alt = emoji || '贴纸';

    // 添加加载错误处理
    img.onerror = () => {
      console.error('贴纸加载失败:', stickerUrl);
      contentDiv.innerHTML = '';
      const errorDiv = document.createElement('div');
      errorDiv.textContent = emoji ? `${emoji} [贴纸]` : '📄 [贴纸加载失败]';
      errorDiv.style.cssText = 'font-size:48px;padding:20px';
      contentDiv.appendChild(errorDiv);
    };

    img.onload = () => {
      console.log('贴纸加载成功:', stickerUrl);
    };

    contentDiv.appendChild(img);

    msgContainer.appendChild(contentDiv);
    div.appendChild(msgContainer);
    div.scrollTop = div.scrollHeight;

    messages.set(msgId, {
      element: msgContainer,
      stickerUrl: stickerUrl,
      type: 'sticker'
    });
  }

  function addAnimationMsg(gifUrl, from, staffName, msgId) {
    const div = document.getElementById('chat-messages');
    const isUser = from === 'user';

    if (!msgId) msgId = 'gif_' + Date.now();

    const msgContainer = document.createElement('div');
    msgContainer.className = 'message-container ' + from;
    msgContainer.id = msgId;
    msgContainer.style.justifyContent = isUser ? 'flex-end' : 'flex-start';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-bubble';
    contentDiv.style.cssText = `
      background: ${isUser ? gradientColor : 'white'};
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 4px;
    `;

    if (staffName && !isUser) {
      const nameSpan = document.createElement('div');
      nameSpan.textContent = staffName;
      nameSpan.style.cssText = 'font-size:11px;opacity:0.7;margin:4px 8px;font-weight:bold';
      contentDiv.appendChild(nameSpan);
    }

    const img = document.createElement('img');
    img.src = gifUrl;
    img.className = 'message-image';
    img.onclick = () => {
      window.open(gifUrl, '_blank');
    };

    // 添加加载错误处理
    img.onerror = () => {
      console.error('GIF加载失败:', gifUrl);
      contentDiv.innerHTML = '';
      const errorDiv = document.createElement('div');
      errorDiv.textContent = '🎞️ [动画加载失败]';
      errorDiv.style.cssText = 'font-size:24px;padding:20px;color:#999';
      contentDiv.appendChild(errorDiv);
    };

    img.onload = () => {
      console.log('GIF加载成功:', gifUrl);
    };

    contentDiv.appendChild(img);

    msgContainer.appendChild(contentDiv);

    if (isUser) {
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.innerHTML = `
        <button class="action-btn" onclick="window.chatWidget.deleteMsg('${msgId}')" title="删除">🗑️</button>
      `;
      msgContainer.appendChild(actions);
    }

    div.appendChild(msgContainer);
    div.scrollTop = div.scrollHeight;

    messages.set(msgId, {
      element: msgContainer,
      gifUrl: gifUrl,
      type: 'animation'
    });
  }

  // Typing指示器相关函数
  let typingIndicatorTimer = null;

  function showTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.style.display = 'block';
      const messagesDiv = document.getElementById('chat-messages');
      messagesDiv.scrollTop = messagesDiv.scrollHeight;

      // 自动隐藏（防止服务器未发送stop事件）
      clearTimeout(typingIndicatorTimer);
      typingIndicatorTimer = setTimeout(() => {
        hideTypingIndicator();
      }, 10000); // 10秒后自动隐藏
    }
  }

  function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
    clearTimeout(typingIndicatorTimer);
  }

  // 未读消息徽章
  function updateUnreadBadge(count) {
    unreadCount = count;
    const badge = document.getElementById('unread-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  // 聊天窗口打开时清除未读计数
  function clearUnreadCount() {
    updateUnreadBadge(0);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'mark_read',
        userId: userId
      }));
    }
  }

  window.chatWidget = {
    ...window.chatWidget,
    deleteMsg,
    editMsg
  };

  function init() {
    createWidget();
    initEvents();
    setTimeout(() => {
      addMsg('👋 您好！有什么可以帮您？\n\n支持发送文本、图片、表情\n✏️ 可以编辑和删除已发送的消息', 'sys');
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
