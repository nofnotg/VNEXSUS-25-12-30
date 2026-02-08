#!/bin/bash

# VNEXSUS SSH 접속 스크립트 (Linux/Mac/WSL)
# Docker 컨테이너에 SSH로 접속합니다

# =====================================================
# 설정 부분 - 필요시 수정
# =====================================================

# 로컬 환경 설정
SSH_HOST="localhost"
SSH_PORT="2222"
SSH_USER="vnexsus"
SSH_KEY=""  # SSH 키 파일 경로 (선택사항)

# =====================================================
# 원격 환경 설정 (원격 서버 사용 시)
# =====================================================
# 아래 주석을 해제하고 값을 설정하세요
# SSH_HOST="192.168.1.100"  # 원격 서버 IP
# SSH_PORT="2222"
# SSH_USER="vnexsus"
# SSH_KEY="$HOME/.ssh/id_rsa_vnexsus"

# =====================================================
# 스크립트 시작
# =====================================================

echo "========================================"
echo "VNEXSUS SSH 접속"
echo "========================================"
echo ""

# 접속 정보 표시
echo "접속 정보:"
echo "  호스트: $SSH_HOST"
echo "  포트:   $SSH_PORT"
echo "  사용자: $SSH_USER"

if [ -n "$SSH_KEY" ]; then
    echo "  인증:   SSH 키 ($SSH_KEY)"
else
    echo "  인증:   비밀번호 (vnexsus2024)"
fi

echo ""
echo "========================================"
echo ""

# SSH 명령 실행
if [ -n "$SSH_KEY" ]; then
    # SSH 키 파일 존재 확인
    if [ ! -f "$SSH_KEY" ]; then
        echo "❌ 오류: SSH 키 파일을 찾을 수 없습니다: $SSH_KEY"
        echo ""
        echo "다음 중 하나를 수행하세요:"
        echo "  1. SSH 키 경로를 수정하세요"
        echo "  2. SSH_KEY 변수를 비워서 비밀번호 인증을 사용하세요"
        exit 1
    fi

    # SSH 키로 접속
    ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SSH_HOST"
else
    # 비밀번호로 접속
    ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST"
fi

# 접속 종료 시
echo ""
echo "SSH 연결이 종료되었습니다."
echo ""
