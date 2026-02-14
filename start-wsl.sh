#!/bin/bash

echo "========================================"
echo "VNEXSUS WSL 환경 시작"
echo "========================================"
echo ""

# 색상 코드
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 포트 설정
MAIN_PORT=${PORT:-3030}
DEV_PORT=8088

# WSL IP 주소 확인
WSL_IP=$(ip addr show eth0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1)
if [ -z "$WSL_IP" ]; then
    echo "${YELLOW}⚠️  WSL IP를 자동으로 찾을 수 없습니다.${NC}"
    echo "   hostname -I 명령으로 수동 확인하세요."
    WSL_IP=$(hostname -I | awk '{print $1}')
fi

echo "📍 현재 WSL 환경 정보:"
echo "   WSL IP 주소: ${GREEN}$WSL_IP${NC}"
echo ""

# .env 파일 확인
if [ ! -f ".env" ]; then
    echo "${YELLOW}⚠️  .env 파일이 없습니다.${NC}"
    if [ -f ".env.example" ]; then
        echo "   .env.example을 복사합니다..."
        cp .env.example .env
        echo "${GREEN}✓ .env 파일 생성 완료${NC}"
        echo ""
        echo "${YELLOW}⚠️  중요: .env 파일을 열어 API 키를 설정하세요!${NC}"
        echo "   vi .env 또는 code .env"
        echo ""
        read -p "계속하려면 Enter를 누르세요..."
    else
        echo "${YELLOW}   경고: .env.example 파일도 없습니다.${NC}"
        echo "   .env 파일을 수동으로 생성해야 합니다."
        exit 1
    fi
fi

# Node.js 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되지 않았습니다."
    echo "   다음 명령으로 설치하세요:"
    echo "   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -"
    echo "   sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "${GREEN}✓ Node.js 버전: $NODE_VERSION${NC}"
echo ""

# 백엔드 패키지 설치 확인
if [ ! -d "backend/node_modules" ]; then
    echo "📦 백엔드 패키지를 설치합니다..."
    cd backend && npm install && cd ..
    if [ $? -ne 0 ]; then
        echo "❌ 패키지 설치 실패"
        exit 1
    fi
    echo "${GREEN}✓ 패키지 설치 완료${NC}"
    echo ""
fi

# 필수 폴더 생성
echo "📁 필수 폴더 생성 중..."
mkdir -p backend/uploads
mkdir -p credentials
mkdir -p reports
mkdir -p logs
echo "${GREEN}✓ 폴더 생성 완료${NC}"
echo ""

# 서버 시작
echo "========================================"
echo "🚀 서버를 시작합니다..."
echo "========================================"
echo ""

cd backend

# 환경 변수 설정 (0.0.0.0으로 바인딩하여 외부 접근 허용)
export HOST=0.0.0.0
export PORT=$MAIN_PORT

# 서버 시작
node app.js &
SERVER_PID=$!

# 서버 시작 대기
echo "서버 시작 대기 중..."
sleep 3

# 서버 상태 확인
if ps -p $SERVER_PID > /dev/null; then
    echo ""
    echo "========================================"
    echo "${GREEN}✓ VNEXSUS 서버가 시작되었습니다!${NC}"
    echo "========================================"
    echo ""
    echo "📍 ${BLUE}WSL 내부에서 접속:${NC}"
    echo "   http://localhost:$MAIN_PORT"
    echo "   http://localhost:$DEV_PORT"
    echo ""
    echo "📍 ${BLUE}Windows에서 접속:${NC}"
    echo "   http://localhost:$MAIN_PORT"
    echo "   http://localhost:$DEV_PORT"
    echo ""
    echo "   ${YELLOW}또는 WSL IP로 직접 접속:${NC}"
    echo "   http://$WSL_IP:$MAIN_PORT"
    echo "   http://$WSL_IP:$DEV_PORT"
    echo ""
    echo "📄 주요 페이지:"
    echo "   • 메인 애플리케이션:  http://localhost:$MAIN_PORT"
    echo "   • 파일 업로드:        http://localhost:$MAIN_PORT/hybrid-interface.html"
    echo "   • 개발 관리자:        http://localhost:$DEV_PORT"
    echo ""
    echo "⚙️  서버 제어:"
    echo "   • 로그 확인:          tail -f logs/server.log"
    echo "   • 서버 종료:          kill $SERVER_PID"
    echo "   • 또는:               Ctrl+C 누른 후 fg 명령 실행 후 다시 Ctrl+C"
    echo ""
    echo "========================================"
    echo ""

    # 서버 프로세스 포그라운드로 가져오기
    wait $SERVER_PID
else
    echo ""
    echo "❌ 서버 시작 실패"
    echo "   backend/logs/ 폴더의 로그 파일을 확인하세요."
    exit 1
fi
