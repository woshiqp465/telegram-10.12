# 消息删除同步功能使用指南

## 问题说明

您反馈的问题：**客服在Telegram删除消息后，客户端仍然显示该消息**

## 技术背景

**Telegram Bot API 的限制**:
- Telegram Bot API 不提供消息删除事件的监听功能
- 当有人删除消息时，Bot 无法收到任何通知
- 这是 Telegram 官方的 API 限制，不是代码问题

## 解决方案

由于 API 限制，我们采用了一个**替代方案**：

### 核心思路
当客服想要删除客户端的消息时：
1. 不直接删除Telegram消息
2. 而是**编辑消息**为特定的删除标记
3. 服务器检测到删除标记后，通知客户端删除该消息

### 支持的删除标记
客服可以将消息编辑为以下任意一个文本（不区分大小写）：
- `[已删除]`
- `[deleted]`
- `[撤回]`
- `[recall]`

---

## 使用方法

### 步骤1: 在Telegram编辑消息

**手机端**:
1. 长按要删除的消息
2. 选择「编辑」
3. 将消息内容改为 `[已删除]`
4. 发送

**电脑端**:
1. 右键点击要删除的消息
2. 选择「Edit」(编辑)
3. 将消息内容改为 `[已删除]`
4. 按 Enter 发送

### 步骤2: 客户端自动删除

- 客户端会立即收到删除通知
- 消息从聊天界面消失
- 完全不可见

---

## 示例演示

### 场景：客服发错了消息

**Before (发送错误消息)**:
```
客服: 你好，这是错误的信息
```

**客服操作**:
1. 在Telegram编辑这条消息
2. 改为: `[已删除]`

**After (客户端效果)**:
```
(消息已消失，客户看不到任何内容)
```

---

## 技术实现

### 服务器端 (server/app.js line 786-831)

```javascript
// 处理编辑的消息
bot.on('edited_message', async (ctx) => {
  const message = ctx.editedMessage;
  const messageThreadId = message.message_thread_id;

  if (!messageThreadId) return;

  const userId = topicUsers.get(messageThreadId);
  if (!userId) return;

  const ws = userConnections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    const clientMsgId = telegramMessageMap.get(message.message_id);

    if (clientMsgId && message.text) {
      // 检查是否是删除标记
      const deleteMarkers = ['[已删除]', '[deleted]', '[撤回]', '[recall]'];
      const isDeleteMarker = deleteMarkers.some(marker =>
        message.text.trim().toLowerCase() === marker.toLowerCase()
      );

      if (isDeleteMarker) {
        // 发送删除消息通知
        ws.send(JSON.stringify({
          type: 'message_deleted',
          msgId: clientMsgId
        }));

        // 清除映射
        telegramMessageMap.delete(message.message_id);

        console.log(`🗑️ 客服删除消息，通知用户 ${userId}: ${clientMsgId}`);
      } else {
        // 正常的编辑操作
        ws.send(JSON.stringify({
          type: 'message_edited',
          msgId: clientMsgId,
          newText: message.text
        }));

        console.log(`✅ 通知用户 ${userId} 消息已编辑: ${clientMsgId}`);
      }
    }
  }
});
```

### 前端 (chat-widget.js line 628-629, 219-225)

```javascript
// WebSocket 消息处理
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);

  // ... 其他消息类型处理

  if (data.type === 'message_deleted') {
    deleteMessage(data.msgId);  // 从界面删除消息
  }
};

// 删除消息函数
function deleteMessage(msgId) {
  const msgData = messages.get(msgId);
  if (!msgData) return;

  msgData.element.remove();  // 从DOM移除
  messages.delete(msgId);    // 从内存清除
}
```

---

## 优点和局限性

### ✅ 优点
1. **无需客户端操作** - 客服单方面操作即可
2. **实时同步** - 编辑后立即删除
3. **简单易用** - 只需编辑消息
4. **兼容性好** - 适用于所有Telegram客户端
5. **可靠性高** - 编辑事件稳定可靠

### ⚠️ 局限性
1. **不是真正删除** - Telegram聊天记录仍保留（但客户看不到）
2. **需要编辑** - 需要额外一步编辑操作
3. **只能删除文本** - 图片/贴纸需要特殊处理（后续可扩展）

---

## 常见问题 FAQ

### Q1: 为什么不直接监听删除事件？
**A**: Telegram Bot API 不提供消息删除事件的监听功能。这是Telegram官方的限制，所有Bot都无法监听到消息删除。

### Q2: 客服真的删除消息会怎样？
**A**: 如果客服直接在Telegram删除消息（而不是编辑），客户端**不会**收到任何通知，消息会继续显示。这就是您遇到的问题。

### Q3: 可以自定义删除标记吗？
**A**: 可以。在 `server/app.js` 第803行修改 `deleteMarkers` 数组即可：

```javascript
const deleteMarkers = ['[已删除]', '[deleted]', '[撤回]', '[recall]', '[自定义标记]'];
```

### Q4: 删除标记会显示在客户端吗？
**A**: 不会！服务器检测到删除标记后，会立即通知客户端删除消息，客户看不到 `[已删除]` 这个文本。

### Q5: 可以删除图片和贴纸吗？
**A**: 目前只支持文本消息。因为图片和贴纸编辑后会变成文本，技术上可行但需要额外处理。可以作为未来改进方向。

### Q6: 客服删除很多消息会不会很麻烦？
**A**: 确实需要逐条编辑。如果需要批量删除，建议：
1. 谨慎发送消息，减少错误
2. 或者实现批量操作脚本（未来功能）

---

## 测试验证

### 测试步骤

1. **打开测试页面**:
   ```
   http://192.168.9.159:3000/test.html
   ```

2. **客服发送测试消息**:
   - 在Telegram客服群组的对应话题发送：`这是一条测试消息`

3. **验证消息显示**:
   - 客户端应该能看到：`这是一条测试消息`

4. **执行删除操作**:
   - 在Telegram编辑该消息为：`[已删除]`

5. **验证删除效果**:
   - 客户端消息应该立即消失
   - 服务器日志应该显示：`🗑️ 客服删除消息，通知用户 user_xxx: staff_xxx`

### 服务器日志

```bash
# 查看删除操作日志
ssh kefu@192.168.9.159 'tail -f ~/telegram-chat-system/server.log | grep "删除"'
```

应该看到类似输出：
```
🗑️ 客服删除消息，通知用户 user_hyo6qro87ys: staff_12345
```

---

## 未来改进方向

### 可能的增强功能

1. **批量删除**
   - 实现命令式批量删除
   - 例如发送 `/delete_last 5` 删除最近5条消息

2. **图片/贴纸删除**
   - 扩展删除标记检测到媒体消息
   - 可能需要新的实现方案

3. **删除确认**
   - 客户端显示 "消息已撤回" 提示
   - 避免用户困惑

4. **时间限制**
   - 只允许删除一定时间内的消息
   - 例如：5分钟内可删除

5. **权限控制**
   - 只允许特定客服删除
   - 记录删除操作日志

---

## 总结

✅ **当前实现**:
- 服务器已部署新版本（PID 169029）
- 功能已上线并正常运行
- 支持4种删除标记
- 实时同步删除

📝 **使用方法**:
- 编辑消息为 `[已删除]` 或其他标记
- 客户端自动删除该消息

⚠️ **注意事项**:
- 这是Telegram API限制的替代方案
- 不是真正的消息删除（Telegram仍保留记录）
- 但客户完全看不到，达到删除效果

🔧 **技术支持**:
- 如有问题，查看服务器日志
- 或联系技术人员协助

---

**更新日期**: 2025-10-14
**版本**: v1.0
**服务器**: http://192.168.9.159:3000

**🤖 Generated with [Claude Code](https://claude.com/claude-code)**

Co-Authored-By: Claude <noreply@anthropic.com>
