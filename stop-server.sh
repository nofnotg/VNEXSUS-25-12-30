#!/bin/bash

echo "========================================"
echo "VNEXSUS 서버 종료 중..."
echo "========================================"

# node app.js 프로세스 찾기 및 종료
NODE_PID=$(ps aux | grep "node.*app.js" | grep -v grep | awk '{print $2}')

if [ -n "$NODE_PID" ]; then
    echo "서버 프로세스 (PID: $NODE_PID) 종료 중..."
    kill $NODE_PID
    sleep 2

    # 프로세스가 여전히 실행 중이면 강제 종료
    if ps -p $NODE_PID > /dev/null 2>&1; then
        echo "강제 종료 중..."
        kill -9 $NODE_PID
    fi

    echo "✅ 서버가 종료되었습니다."
else
    echo "⚠️  실행 중인 서버를 찾을 수 없습니다."
fi

echo "========================================"
