#!/bin/bash
# Telegram 客服系统启动脚本

cd ~/telegram-chat-system

echo "🚀 启动 Telegram 客服系统..."
echo ""

# 使用 nohup 后台运行
nohup node server/app.js > data/logs/app.log 2>&1 &

echo $! > data/app.pid

echo "✅ 系统已启动！"
echo ""
echo "📍 访问地址:"
echo "  - 测试页面: http://192.168.9.159:3000/test.html"
echo "  - 管理后台: http://192.168.9.159:3001"
echo "  - 管理账号: admin / admin"
echo ""
echo "📋 查看日志: tail -f ~/telegram-chat-system/data/logs/app.log"
echo "🛑 停止服务: kill \$(cat ~/telegram-chat-system/data/app.pid)"
echo ""
