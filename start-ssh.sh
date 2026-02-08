#!/bin/bash

# VNEXSUS SSH 지원 컨테이너 시작 스크립트
# SSH로 접속 가능한 Docker 컨테이너를 실행합니다

set -e

echo "========================================"
echo "VNEXSUS SSH 지원 컨테이너 시작"
echo "========================================"
echo ""

# 현재 디렉토리 확인
if [ ! -f "docker-compose.ssh.yml" ]; then
    echo "❌ 오류: docker-compose.ssh.yml 파일을 찾을 수 없습니다."
    echo "   프로젝트 루트 디렉토리에서 실행해주세요."
    exit 1
fi

# .env 파일 확인
if [ ! -f ".env" ]; then
    echo "⚠️  경고: .env 파일이 없습니다."
    echo ""
    read -p ".env.example을 복사하여 .env를 생성하시겠습니까? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp .env.example .env
        echo "✓ .env 파일이 생성되었습니다."
        echo "  API 키를 입력한 후 다시 실행해주세요."
        exit 0
    else
        echo "❌ .env 파일이 필요합니다. 종료합니다."
        exit 1
    fi
fi

# Docker 설치 확인
if ! command -v docker &> /dev/null; then
    echo "❌ 오류: Docker가 설치되어 있지 않습니다."
    echo "   https://docs.docker.com/get-docker/ 에서 Docker를 설치해주세요."
    exit 1
fi

# Docker Compose 설치 확인
if ! command -v docker-compose &> /dev/null; then
    echo "❌ 오류: Docker Compose가 설치되어 있지 않습니다."
    echo "   https://docs.docker.com/compose/install/ 에서 Docker Compose를 설치해주세요."
    exit 1
fi

# SSH 키 디렉토리 생성
if [ ! -d "ssh-keys" ]; then
    echo "[1/4] SSH 키 디렉토리 생성 중..."
    mkdir -p ssh-keys
    chmod 700 ssh-keys
    echo "✓ ssh-keys 디렉토리 생성 완료"
else
    echo "[1/4] SSH 키 디렉토리 확인 완료"
fi

# 기존 컨테이너 확인 및 종료
echo ""
echo "[2/4] 기존 컨테이너 확인 중..."
if docker ps -a | grep -q "vnexsus-backend-ssh"; then
    echo "기존 컨테이너를 종료합니다..."
    docker-compose -f docker-compose.ssh.yml down
    echo "✓ 기존 컨테이너 종료 완료"
else
    echo "✓ 기존 컨테이너 없음"
fi

# Docker 이미지 빌드 및 컨테이너 시작
echo ""
echo "[3/4] Docker 이미지 빌드 및 컨테이너 시작 중..."
echo "    (처음 실행 시 몇 분이 소요될 수 있습니다)"
echo ""

docker-compose -f docker-compose.ssh.yml up -d --build

# 컨테이너 시작 대기
echo ""
echo "[4/4] 컨테이너 시작 대기 중..."
sleep 5

# 상태 확인
if docker ps | grep -q "vnexsus-backend-ssh"; then
    echo "✓ 컨테이너 시작 완료"
else
    echo "❌ 오류: 컨테이너 시작 실패"
    echo ""
    echo "로그 확인:"
    docker-compose -f docker-compose.ssh.yml logs
    exit 1
fi

echo ""
echo "========================================"
echo "✅ VNEXSUS SSH 지원 컨테이너 시작 완료"
echo "========================================"
echo ""
echo "📌 접속 정보:"
echo "   호스트: localhost"
echo "   SSH 포트: 2222"
echo "   사용자: vnexsus"
echo "   비밀번호: vnexsus2024"
echo ""
echo "📌 웹 인터페이스:"
echo "   메인: http://localhost:3030"
echo "   개발: http://localhost:8088"
echo ""
echo "🔐 SSH 접속 방법:"
echo "   ssh -p 2222 vnexsus@localhost"
echo ""
echo "📝 상세 가이드:"
echo "   SSH_접속_가이드.md 파일을 참조하세요."
echo ""
echo "💡 유용한 명령어:"
echo "   로그 보기:      docker-compose -f docker-compose.ssh.yml logs -f"
echo "   컨테이너 종료:   docker-compose -f docker-compose.ssh.yml down"
echo "   컨테이너 재시작: docker-compose -f docker-compose.ssh.yml restart"
echo ""

# SSH 접속 테스트 제안
echo "========================================"
read -p "지금 SSH 접속을 테스트하시겠습니까? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "SSH 접속 중... (비밀번호: vnexsus2024)"
    echo ""
    ssh -p 2222 vnexsus@localhost
fi
