/**
 * Telegram 客服系统 - 前端聊天组件
 */
(function() {
  'use strict';
  const config = window.ChatWidgetConfig || {};
  const wsUrl = config.wsUrl || 'ws://192.168.9.159:8080';
  const position = config.position || 'right';
  const primaryColor = config.primaryColor || '#0088cc';
  let userId = config.userId || localStorage.getItem('chat_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('chat_user_id', userId);
  }
  let ws = null;
  let connected = false;
  function createWidget() {
    const html = '<div id="chat-widget" style="position:fixed;bottom:20px;'+position+':20px;z-index:999999"><div id="chat-button" style="width:60px;height:60px;border-radius:50%;background:'+primaryColor+';color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:28px">💬</div><div id="chat-window" style="display:none;position:absolute;bottom:80px;'+position+':0;width:360px;height:500px;background:white;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.2);flex-direction:column"><div style="background:'+primaryColor+';color:white;padding:16px;display:flex;justify-content:space-between"><div><div style="font-weight:bold">客服支持</div><div id="chat-status" style="font-size:12px">连接中...</div></div><button id="chat-close" style="background:none;border:none;color:white;font-size:24px;cursor:pointer">×</button></div><div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px;background:#f5f5f5"></div><div style="padding:16px;background:white;border-top:1px solid #e0e0e0"><div style="display:flex;gap:8px"><input id="chat-input" type="text" placeholder="输入消息..." style="flex:1;padding:10px;border:1px solid #e0e0e0;border-radius:20px;outline:none"/><button id="chat-send" style="background:'+primaryColor+';color:white;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer">➤</button></div></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }
  function initEvents() {
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
    document.getElementById('chat-send').onclick = sendMsg;
    document.getElementById('chat-input').onkeypress = (e) => {
      if (e.key === 'Enter') sendMsg();
    };
  }
  function connectWS() {
    if (connected) return;
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      connected = true;
      document.getElementById('chat-status').textContent = '在线';
      ws.send(JSON.stringify({type:'auth',userId:userId}));
    };
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'message') addMsg(data.text, 'staff');
      else if (data.type === 'system') addMsg(data.message, 'sys');
    };
    ws.onclose = () => {
      connected = false;
      document.getElementById('chat-status').textContent = '已断开';
      setTimeout(connectWS, 3000);
    };
  }
  function sendMsg() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    addMsg(text, 'user');
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({type:'chat',text:text}));
    input.value = '';
  }
  function addMsg(text, from) {
    const div = document.getElementById('chat-messages');
    const isUser = from === 'user';
    const html = '<div style="margin-bottom:12px;display:flex;justify-content:'+(isUser?'flex-end':'flex-start')+'"><div style="max-width:70%;padding:10px 14px;border-radius:18px;background:'+(isUser?primaryColor:'white')+';color:'+(isUser?'white':'#333')+';box-shadow:0 1px 2px rgba(0,0,0,0.1)">'+text.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div></div>';
    div.insertAdjacentHTML('beforeend', html);
    div.scrollTop = div.scrollHeight;
  }
  function init() {
    createWidget();
    initEvents();
    setTimeout(() => addMsg('👋 您好！有什么可以帮您？', 'sys'), 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
