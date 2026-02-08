#!/bin/bash

echo "========================================"
echo "VNEXSUS Docker 종료"
echo "========================================"
echo ""

# Docker Compose로 종료
docker-compose down

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ VNEXSUS 앱이 종료되었습니다."
    echo ""
else
    echo ""
    echo "❌ 종료 실패. docker-compose logs 명령으로 로그를 확인하세요."
    exit 1
fi
