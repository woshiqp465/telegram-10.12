#!/bin/bash
# Telegram 客服系统启动脚本（使用代理）

cd ~/telegram-chat-system

echo "🚀 启动 Telegram 客服系统（使用 V2Ray 代理）..."
echo ""

# 设置代理环境变量
export http_proxy="socks5://127.0.0.1:1080"
export https_proxy="socks5://127.0.0.1:1080"
export HTTP_PROXY="socks5://127.0.0.1:1080"
export HTTPS_PROXY="socks5://127.0.0.1:1080"

# 停止旧进程
if [ -f data/app.pid ]; then
  OLD_PID=$(cat data/app.pid)
  if ps -p $OLD_PID > /dev/null 2>&1; then
    echo "🛑 停止旧进程..."
    kill $OLD_PID
    sleep 2
  fi
fi

# 启动服务
nohup node server/app.js > data/logs/app.log 2>&1 &

echo $! > data/app.pid

echo "✅ 系统已启动！"
echo ""
echo "📍 访问地址:"
echo "  - 测试页面: http://192.168.9.159:3000/test.html"
echo "  - 管理后台: http://192.168.9.159:3001"
echo "  - 管理账号: admin / admin"
echo ""
echo "🌐 代理: socks5://127.0.0.1:1080 ✅"
echo ""
echo "📋 查看日志: tail -f ~/telegram-chat-system/data/logs/app.log"
echo "🛑 停止服务: kill \$(cat ~/telegram-chat-system/data/app.pid)"
echo ""
