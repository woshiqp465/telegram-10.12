/**
 * Telegram 客服系统 - 前端聊天组件（增强版）
 * 支持：文本、图片、表情、Emoji、复制粘贴
 */
(function() {
  'use strict';

  const config = window.ChatWidgetConfig || {};
  const wsUrl = config.wsUrl || 'ws://192.168.9.159:8080';
  const apiUrl = config.apiUrl || 'http://192.168.9.159:3000';
  const position = config.position || 'right';
  const primaryColor = config.primaryColor || '#0088cc';

  let userId = config.userId || localStorage.getItem('chat_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('chat_user_id', userId);
  }

  let ws = null;
  let connected = false;

  // Emoji 列表（常用）
  const emojis = ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙','💪','🙏','✍️','💅','🤳'];

  function createWidget() {
    const posStyle = position === 'right' ? 'right:20px' : 'left:20px';
    const windowPosStyle = position === 'right' ? 'right:0' : 'left:0';

    const html = `
      <div id="chat-widget" style="position:fixed;bottom:20px;${posStyle};z-index:999999">
        <!-- 悬浮按钮 -->
        <div id="chat-button" style="width:60px;height:60px;border-radius:50%;background:${primaryColor};color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:28px;transition:transform 0.2s" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          💬
        </div>

        <!-- 聊天窗口 -->
        <div id="chat-window" style="display:none;position:absolute;bottom:80px;${windowPosStyle};width:380px;height:580px;background:white;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.2);flex-direction:column;overflow:hidden">

          <!-- 头部 -->
          <div style="background:${primaryColor};color:white;padding:16px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:bold;font-size:16px">客服支持</div>
              <div id="chat-status" style="font-size:12px;opacity:0.9">连接中...</div>
            </div>
            <button id="chat-close" style="background:none;border:none;color:white;font-size:28px;cursor:pointer;padding:0;width:32px;height:32px;line-height:28px">×</button>
          </div>

          <!-- 消息区域 -->
          <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px;background:#f5f5f5"></div>

          <!-- Emoji 选择器 -->
          <div id="emoji-picker" style="display:none;max-height:200px;overflow-y:auto;padding:8px;background:white;border-top:1px solid #e0e0e0;text-align:center"></div>

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
                  <div id="chat-input" contenteditable="true" placeholder="输入消息..." style="min-height:40px;max-height:120px;overflow-y:auto;padding:10px 12px;border:1px solid #e0e0e0;border-radius:20px;outline:none;background:white;line-height:1.5;font-size:15px" data-placeholder="输入消息..."></div>
                </div>
                <button id="chat-send" style="background:${primaryColor};color:white;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:18px;flex-shrink:0;transition:opacity 0.2s" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">➤</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 样式 -->
      <style>
        #chat-input:empty:before {
          content: attr(data-placeholder);
          color: #999;
          pointer-events: none;
        }
        #chat-messages::-webkit-scrollbar,
        #emoji-picker::-webkit-scrollbar,
        #chat-input::-webkit-scrollbar {
          width: 6px;
        }
        #chat-messages::-webkit-scrollbar-thumb,
        #emoji-picker::-webkit-scrollbar-thumb,
        #chat-input::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 3px;
        }
        .emoji-item {
          display: inline-block;
          font-size: 28px;
          padding: 6px;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.2s;
          line-height: 1;
          width: 40px;
          height: 40px;
          text-align: center;
        }
        .emoji-item:hover {
          background: #f0f0f0;
          transform: scale(1.2);
        }
        .message-image {
          max-width: 250px;
          max-height: 250px;
          border-radius: 8px;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .message-image:hover {
          opacity: 0.9;
        }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function initEvents() {
    // 打开/关闭聊天窗口
    document.getElementById('chat-button').onclick = () => {
      const win = document.getElementById('chat-window');
      if (win.style.display === 'none') {
        win.style.display = 'flex';
        document.getElementById('chat-input').focus();
        connectWS();
      } else {
        win.style.display = 'none';
      }
    };

    document.getElementById('chat-close').onclick = () => {
      document.getElementById('chat-window').style.display = 'none';
    };

    // 发送消息
    document.getElementById('chat-send').onclick = sendMsg;

    // 输入框回车发送
    const inputDiv = document.getElementById('chat-input');
    inputDiv.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });

    // 粘贴处理（支持图片粘贴）
    inputDiv.addEventListener('paste', handlePaste);

    // Emoji 按钮
    document.getElementById('btn-emoji').onclick = toggleEmojiPicker;

    // 图片上传按钮
    document.getElementById('btn-image').onclick = () => {
      document.getElementById('file-input').click();
    };

    document.getElementById('file-input').onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        uploadImage(file);
      }
      e.target.value = ''; // 清空，允许重复上传同一文件
    };

    // 初始化 Emoji 选择器
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

    // 在光标位置插入 emoji
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

    // 检查是否有图片
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        uploadImage(file);
        hasImage = true;
        break;
      }
    }

    // 如果没有图片，处理文本粘贴（纯文本）
    if (!hasImage) {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    }
  }

  function uploadImage(file) {
    if (!file || !file.type.match('image.*')) {
      addMsg('❌ 只支持图片格式', 'sys');
      return;
    }

    // 检查文件大小（限制 5MB）
    if (file.size > 5 * 1024 * 1024) {
      addMsg('❌ 图片大小不能超过 5MB', 'sys');
      return;
    }

    // 显示上传中提示
    const msgId = 'upload-' + Date.now();
    addMsg('📤 正在上传图片...', 'sys', msgId);

    // 转换为 Base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;

      // 创建预览
      const img = new Image();
      img.onload = () => {
        // 压缩图片（如果太大）
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

        // 移除上传提示
        removeMsg(msgId);

        // 显示图片消息
        addImageMsg(compressedBase64, 'user');

        // 发送到服务器
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'chat',
            contentType: 'image',
            data: compressedBase64,
            filename: file.name
          }));
        }
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  }

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
          addImageMsg(data.data || data.text, 'staff');
        } else {
          addMsg(data.text, 'staff', null, data.staffName);
        }
      } else if (data.type === 'system') {
        addMsg(data.message, 'sys');
      } else if (data.type === 'user_info') {
        // 用户信息（可选处理）
        console.log('用户信息:', data.user);
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

    if (!text) return;

    addMsg(text, 'user');

    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'chat',
        contentType: 'text',
        text: text
      }));
    }

    input.textContent = '';

    // 隐藏 emoji 选择器
    document.getElementById('emoji-picker').style.display = 'none';
  }

  function addMsg(text, from, msgId, staffName) {
    const div = document.getElementById('chat-messages');
    const isUser = from === 'user';
    const isSys = from === 'sys';

    const msgDiv = document.createElement('div');
    if (msgId) msgDiv.id = msgId;
    msgDiv.style.cssText = 'margin-bottom:12px;display:flex;justify-content:' + (isUser ? 'flex-end' : 'flex-start');

    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
      max-width:70%;
      padding:10px 14px;
      border-radius:18px;
      background:${isSys ? '#fff3cd' : (isUser ? primaryColor : 'white')};
      color:${isUser ? 'white' : '#333'};
      box-shadow:0 1px 2px rgba(0,0,0,0.1);
      word-wrap:break-word;
      white-space:pre-wrap;
      font-size:15px;
      line-height:1.4;
    `;

    // 添加客服名称
    if (staffName && !isUser && !isSys) {
      const nameSpan = document.createElement('div');
      nameSpan.textContent = staffName;
      nameSpan.style.cssText = 'font-size:11px;opacity:0.7;margin-bottom:4px';
      contentDiv.appendChild(nameSpan);
    }

    // 直接使用 innerText 来保留 emoji 的原生显示
    // 转义 HTML 特殊字符，但保留 emoji
    const textSpan = document.createElement('span');
    textSpan.innerText = text;
    contentDiv.appendChild(textSpan);

    msgDiv.appendChild(contentDiv);
    div.appendChild(msgDiv);
    div.scrollTop = div.scrollHeight;
  }

  function addImageMsg(imageSrc, from, staffName) {
    const div = document.getElementById('chat-messages');
    const isUser = from === 'user';

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'margin-bottom:12px;display:flex;justify-content:' + (isUser ? 'flex-end' : 'flex-start');

    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
      max-width:70%;
      padding:4px;
      border-radius:12px;
      background:${isUser ? primaryColor : 'white'};
      box-shadow:0 1px 2px rgba(0,0,0,0.1);
    `;

    // 添加客服名称
    if (staffName && !isUser) {
      const nameSpan = document.createElement('div');
      nameSpan.textContent = staffName;
      nameSpan.style.cssText = 'font-size:11px;opacity:0.7;margin:4px 8px';
      contentDiv.appendChild(nameSpan);
    }

    const img = document.createElement('img');
    img.src = imageSrc;
    img.className = 'message-image';
    img.onclick = () => {
      window.open(imageSrc, '_blank');
    };

    contentDiv.appendChild(img);
    msgDiv.appendChild(contentDiv);
    div.appendChild(msgDiv);
    div.scrollTop = div.scrollHeight;
  }

  function removeMsg(msgId) {
    const msg = document.getElementById(msgId);
    if (msg) msg.remove();
  }

  function init() {
    createWidget();
    initEvents();
    setTimeout(() => {
      addMsg('👋 您好！有什么可以帮您？\n\n支持发送文本、图片、表情 😊', 'sys');
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
