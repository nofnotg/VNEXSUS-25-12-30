#!/bin/bash

echo "========================================"
echo "VNEXSUS Docker (WSL 환경)"
echo "========================================"
echo ""

# 색상 코드
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# WSL IP 주소 확인
WSL_IP=$(ip addr show eth0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1)
if [ -z "$WSL_IP" ]; then
    WSL_IP=$(hostname -I | awk '{print $1}')
fi

echo "📍 현재 WSL 환경:"
echo "   WSL IP: ${GREEN}$WSL_IP${NC}"
echo ""

# Docker 설치 확인
if ! command -v docker &> /dev/null; then
    echo "${RED}❌ Docker가 설치되지 않았습니다.${NC}"
    echo ""
    echo "WSL에서 Docker 설치 방법:"
    echo "1. Docker Desktop for Windows 설치 (권장):"
    echo "   https://www.docker.com/products/docker-desktop/"
    echo ""
    echo "2. 또는 WSL 내부에 Docker 설치:"
    echo "   curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "   sudo sh get-docker.sh"
    echo "   sudo usermod -aG docker \$USER"
    echo ""
    exit 1
fi

# Docker 실행 확인
if ! docker info > /dev/null 2>&1; then
    echo "${RED}❌ Docker 데몬이 실행되고 있지 않습니다.${NC}"
    echo ""
    echo "해결 방법:"
    echo "1. Docker Desktop을 실행하세요 (Windows)"
    echo "2. 또는 WSL에서: sudo service docker start"
    echo ""
    exit 1
fi

echo "${GREEN}✓ Docker 버전: $(docker --version)${NC}"
echo ""

# docker-compose 확인
if ! command -v docker-compose &> /dev/null; then
    echo "${RED}❌ docker-compose가 설치되지 않았습니다.${NC}"
    echo ""
    echo "설치 방법:"
    echo "sudo apt-get update"
    echo "sudo apt-get install docker-compose-plugin"
    echo ""
    exit 1
fi

echo "${GREEN}✓ docker-compose 버전: $(docker-compose --version)${NC}"
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
        echo ""
    else
        echo "${RED}   오류: .env.example 파일도 없습니다.${NC}"
        exit 1
    fi
fi

# docker-compose.yml 확인
if [ ! -f "docker-compose.yml" ]; then
    echo "${RED}❌ docker-compose.yml 파일을 찾을 수 없습니다.${NC}"
    echo "   현재 디렉토리가 프로젝트 루트인지 확인하세요."
    exit 1
fi

# Docker Compose로 실행
echo "========================================"
echo "🚀 Docker 컨테이너를 시작합니다..."
echo "========================================"
echo ""
echo "처음 실행 시 이미지를 다운로드하므로 시간이 걸릴 수 있습니다."
echo ""

docker-compose up -d

if [ $? -ne 0 ]; then
    echo ""
    echo "${RED}❌ Docker 컨테이너 시작 실패${NC}"
    echo ""
    echo "문제 해결:"
    echo "1. Docker Desktop이 실행 중인지 확인"
    echo "2. .env 파일의 설정을 확인"
    echo "3. 로그 확인: docker-compose logs"
    echo ""
    exit 1
fi

# 컨테이너 시작 대기
echo "컨테이너 시작 대기 중..."
sleep 5

# 컨테이너 상태 확인
CONTAINER_STATUS=$(docker-compose ps -q vnexsus-backend)

if [ -n "$CONTAINER_STATUS" ]; then
    echo ""
    echo "========================================"
    echo "${GREEN}✓ VNEXSUS 앱이 시작되었습니다!${NC}"
    echo "========================================"
    echo ""
    echo "📍 ${BLUE}WSL 내부에서 접속:${NC}"
    echo "   http://localhost:3030"
    echo "   http://localhost:8088"
    echo ""
    echo "📍 ${BLUE}Windows에서 접속:${NC}"
    echo "   http://localhost:3030"
    echo "   http://localhost:8088"
    echo ""
    echo "   ${YELLOW}또는 WSL IP로 직접 접속:${NC}"
    echo "   http://$WSL_IP:3030"
    echo "   http://$WSL_IP:8088"
    echo ""
    echo "📄 주요 페이지:"
    echo "   • 메인 애플리케이션:  http://localhost:3030"
    echo "   • 파일 업로드:        http://localhost:3030/hybrid-interface.html"
    echo "   • 개발 관리자:        http://localhost:8088"
    echo ""
    echo "⚙️  Docker 제어:"
    echo "   • 컨테이너 상태:      docker-compose ps"
    echo "   • 로그 확인:          docker-compose logs -f"
    echo "   • 앱 종료:            docker-compose down"
    echo "   • 또는:               ./stop-docker-wsl.sh"
    echo ""
    echo "========================================"
    echo ""
else
    echo ""
    echo "${RED}❌ 컨테이너 시작 실패${NC}"
    echo "   docker-compose logs 명령으로 로그를 확인하세요."
    exit 1
fi
