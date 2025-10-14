# 🧪 Phase 3 测试指南

**测试目标**: 验证Telegram贴纸和GIF在客户端的显示效果
**测试环境**: http://192.168.9.159:3000
**更新时间**: 2025-10-14

---

## 📋 测试前准备

### 1. 验证服务器状态
```bash
# 检查服务器进程
ssh kefu@192.168.9.159 'ps aux | grep node | grep -v grep'

# 应该看到:
# kefu  168204  ... node server/app.js
```

### 2. 打开测试页面
```
http://192.168.9.159:3000/test.html
```

### 3. 打开浏览器开发者工具
- Chrome/Edge: F12 或 Cmd+Option+I
- 切换到 Console 标签查看日志
- 切换到 Network 标签查看网络请求

---

## 🎯 测试用例

### 测试1: 动画贴纸（WebM格式）

**目标**: 验证Telegram的动画贴纸能正确显示并播放动画

**步骤**:
1. 在Telegram客服群组中，对指定话题发送一个动画贴纸
2. 观察客户端聊天界面

**预期结果**:
- ✅ 贴纸应该显示为 `<video>` 标签
- ✅ 贴纸应该自动播放动画
- ✅ 动画应该循环播放
- ✅ 没有声音
- ✅ 如果有emoji标签，应显示在贴纸下方

**服务器日志检查**:
```bash
ssh kefu@192.168.9.159 'tail -f ~/telegram-chat-system/server.log'
```

应该看到:
```
📥 开始下载贴纸: CAACAgUAAyEFAASzrx0e...
✅ 文件已保存: abc123def456.webm (125.6KB)
✅ 文件准备就绪: abc123def456.webm (.webm格式)
✅ 转发贴纸给用户 user_xxx: http://192.168.9.159:3000/uploads/abc123def456.webm
```

**浏览器Console检查**:
- 应该看到 WebSocket 接收到 sticker 消息
- 不应该有 "视频贴纸加载失败" 错误

**浏览器Network检查**:
- 应该能看到请求 `http://192.168.9.159:3000/uploads/xxx.webm`
- 状态码应该是 200
- Content-Type 应该是 video/webm

---

### 测试2: 静态贴纸（WebP格式）

**目标**: 验证静态贴纸能正确显示

**步骤**:
1. 在Telegram发送一个静态贴纸（通常是meme贴纸）
2. 观察客户端界面

**预期结果**:
- ✅ 贴纸应该显示为 `<img>` 标签
- ✅ 图片清晰可见
- ✅ 大小约150x150像素

**服务器日志**:
```
📥 开始下载贴纸: CAACAgUAAyEFAASzrx0e...
✅ 文件已保存: def789ghi012.webp (45.2KB)
✅ 文件准备就绪: def789ghi012.webp (.webp格式)
```

**浏览器Network检查**:
- 请求 `http://192.168.9.159:3000/uploads/xxx.webp`
- 状态码 200
- Content-Type: image/webp

---

### 测试3: GIF动图（MP4格式）

**目标**: 验证GIF动图（实际是MP4）能正确播放

**步骤**:
1. 在Telegram发送一个GIF动图
2. 观察客户端界面

**预期结果**:
- ✅ 动图应该显示为 `<video>` 标签
- ✅ 自动播放
- ✅ 循环播放
- ✅ 没有声音
- ✅ 可以点击打开新标签页查看大图

**服务器日志**:
```
📥 开始下载GIF动图: CgACAgUAAyEFAASzrx0e...
✅ 文件已保存: jkl345mno678.mp4 (256.8KB)
✅ 文件准备就绪: jkl345mno678.mp4 (.mp4格式)
✅ 转发GIF给用户 user_xxx: http://192.168.9.159:3000/uploads/jkl345mno678.mp4
```

**浏览器Network检查**:
- 请求 `http://192.168.9.159:3000/uploads/xxx.mp4`
- 状态码 200
- Content-Type: video/mp4

---

### 测试4: 普通图片（JPG/PNG格式）

**目标**: 验证普通图片正常显示

**步骤**:
1. 在Telegram发送一张图片
2. 观察客户端界面

**预期结果**:
- ✅ 图片清晰显示
- ✅ 使用 `<img>` 标签
- ✅ 点击可以打开新标签页查看大图

**服务器日志**:
```
📥 开始下载图片: AgACAgUAAyEFAASzrx0e...
✅ 文件已保存: pqr901stu234.jpg (512.3KB)
✅ 文件准备就绪: pqr901stu234.jpg (.jpg格式)
```

---

### 测试5: 文件缓存机制

**目标**: 验证相同文件不会重复下载

**步骤**:
1. 在Telegram发送一个贴纸
2. 等待客户端显示成功
3. 再次发送**完全相同**的贴纸
4. 观察服务器日志

**预期结果**:
- ✅ 第一次发送时有 "开始下载" 日志
- ✅ 第二次发送时有 "文件已缓存" 日志
- ✅ 第二次不应该有下载过程
- ✅ 两次都能正常显示

**服务器日志对比**:
```
# 第一次
📥 开始下载贴纸: CAACAgUAAyEFAASzrx0e...
✅ 文件已保存: abc123.webm (125.6KB)

# 第二次（相同贴纸）
✅ 文件已缓存: abc123.webm
```

---

### 测试6: 超时保护

**目标**: 验证大文件下载超时时服务器不会崩溃

**步骤**:
1. 在Telegram发送一个非常大的图片或视频（10MB+）
2. 如果下载超时（>60秒），观察服务器是否还能正常工作
3. 尝试发送其他消息

**预期结果**:
- ✅ 服务器不应该崩溃（进程不应该退出）
- ✅ 客户端可能显示 "[贴纸]" 或 "[图片]" 文本（降级显示）
- ✅ 服务器日志显示超时错误但继续运行
- ✅ 其他消息仍然能正常接收和显示

**服务器日志**:
```
📥 开始下载图片: AgACAgUAAyEFAASzrx0e...
❌ 下载Telegram文件失败: 文件下载超时
⚠️  转发图片给用户失败，降级为文本显示
```

**关键验证点**:
- ❌ **不应该**看到 "TimeoutError: Promise timed out"
- ❌ **不应该**看到 "Node.js v20.19.5" 进程退出信息
- ✅ **应该**看到错误被捕获并继续运行

---

## 🐛 常见问题排查

### 问题1: 贴纸显示为 "[贴纸]" 文本

**可能原因**:
1. 服务器下载失败
2. 文件保存失败
3. URL生成错误
4. 网络问题

**排查步骤**:
```bash
# 1. 检查服务器日志
ssh kefu@192.168.9.159 'tail -100 ~/telegram-chat-system/server.log | grep "贴纸"'

# 2. 检查uploads目录
ssh kefu@192.168.9.159 'ls -lh ~/telegram-chat-system/public/uploads/ | tail -10'

# 3. 检查文件权限
ssh kefu@192.168.9.159 'ls -ld ~/telegram-chat-system/public/uploads/'

# 4. 测试代理连接
ssh kefu@192.168.9.159 'curl --socks5 127.0.0.1:1080 https://api.telegram.org'
```

---

### 问题2: 视频不播放/图片不显示

**可能原因**:
1. 浏览器不支持视频格式
2. CORS跨域问题
3. 文件损坏

**排查步骤**:
1. 打开浏览器Console查看错误信息
2. 查看Network标签，检查文件请求状态
3. 尝试直接访问文件URL: `http://192.168.9.159:3000/uploads/xxx.webm`
4. 查看HTML元素类型（右键检查元素）

**验证HTML结构**:
```html
<!-- 动画贴纸应该是这样 -->
<video src="http://192.168.9.159:3000/uploads/abc123.webm"
       autoplay loop muted playsinline
       style="width:150px;height:150px;...">
</video>

<!-- 静态贴纸应该是这样 -->
<img src="http://192.168.9.159:3000/uploads/def456.webp"
     style="width:150px;height:150px;...">
```

---

### 问题3: 服务器崩溃

**症状**:
- WebSocket断开连接
- 无法接收任何消息
- 测试页面无法打开

**排查步骤**:
```bash
# 1. 检查进程是否还在运行
ssh kefu@192.168.9.159 'ps aux | grep node'

# 2. 查看最后的日志
ssh kefu@192.168.9.159 'tail -100 ~/telegram-chat-system/server.log'

# 3. 如果崩溃，重启服务器
ssh kefu@192.168.9.159 'cd ~/telegram-chat-system && nohup node server/app.js > server.log 2>&1 &'

# 4. 验证重启成功
ssh kefu@192.168.9.159 'tail -f ~/telegram-chat-system/server.log'
```

---

### 问题4: 缓存文件太多

**症状**: uploads目录占用大量磁盘空间

**排查**:
```bash
# 查看uploads目录大小
ssh kefu@192.168.9.159 'du -sh ~/telegram-chat-system/public/uploads/'

# 查看文件数量
ssh kefu@192.168.9.159 'ls ~/telegram-chat-system/public/uploads/ | wc -l'
```

**清理方案**:
```bash
# 删除7天前的文件
ssh kefu@192.168.9.159 'find ~/telegram-chat-system/public/uploads/ -type f -mtime +7 -delete'

# 或者删除全部缓存（重新下载）
ssh kefu@192.168.9.159 'rm -rf ~/telegram-chat-system/public/uploads/*'
```

---

## 📊 测试报告模板

测试完成后，请记录以下信息:

```markdown
## 测试结果

**测试日期**: 2025-10-14
**测试人员**: [姓名]
**测试环境**: http://192.168.9.159:3000

### 测试1: 动画贴纸（WebM）
- [ ] 通过
- [ ] 失败
- 备注: ___________

### 测试2: 静态贴纸（WebP）
- [ ] 通过
- [ ] 失败
- 备注: ___________

### 测试3: GIF动图（MP4）
- [ ] 通过
- [ ] 失败
- 备注: ___________

### 测试4: 普通图片（JPG/PNG）
- [ ] 通过
- [ ] 失败
- 备注: ___________

### 测试5: 文件缓存
- [ ] 通过
- [ ] 失败
- 备注: ___________

### 测试6: 超时保护
- [ ] 通过
- [ ] 失败
- 备注: ___________

### 其他问题
___________

### 整体评价
- [ ] 优秀 - 所有功能完美工作
- [ ] 良好 - 大部分功能正常，有小问题
- [ ] 一般 - 核心功能正常，但有明显问题
- [ ] 较差 - 核心功能不稳定
```

---

## 🎯 成功标准

Phase 3被认为完全成功需要满足:

1. ✅ **动画贴纸**: 100% 正常显示并播放动画
2. ✅ **静态贴纸**: 100% 正常显示
3. ✅ **GIF动图**: 100% 正常播放并循环
4. ✅ **普通图片**: 100% 正常显示
5. ✅ **缓存机制**: 相同文件不重复下载
6. ✅ **超时保护**: 下载失败时服务器不崩溃
7. ✅ **响应速度**: 首次显示 < 2秒，缓存文件 < 0.5秒
8. ✅ **浏览器兼容**: Chrome/Safari/Edge/Firefox 全部正常

---

## 📞 需要帮助？

如果测试过程中遇到问题:

1. **查看服务器日志**:
   ```bash
   ssh kefu@192.168.9.159 'tail -f ~/telegram-chat-system/server.log'
   ```

2. **查看浏览器Console**: F12 → Console标签

3. **检查网络请求**: F12 → Network标签

4. **提供详细信息**:
   - 什么操作触发的问题
   - 服务器日志截图
   - 浏览器Console截图
   - 浏览器Network标签截图

---

**祝测试顺利！🎉**

---

**🤖 Generated with [Claude Code](https://claude.com/claude-code)**

Co-Authored-By: Claude <noreply@anthropic.com>
