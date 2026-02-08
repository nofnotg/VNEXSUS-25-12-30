#!/bin/bash

# VNEXSUS SSH 키 설정 스크립트
# SSH 키를 생성하고 Docker 컨테이너에 추가합니다

set -e

echo "========================================"
echo "VNEXSUS SSH 키 설정"
echo "========================================"
echo ""

# SSH 키 파일 경로
SSH_KEY_PATH="$HOME/.ssh/id_rsa_vnexsus"
SSH_PUB_KEY_PATH="$HOME/.ssh/id_rsa_vnexsus.pub"
SSH_KEYS_DIR="./ssh-keys"

# =====================================================
# 1단계: SSH 키 생성
# =====================================================

echo "[1/4] SSH 키 확인 중..."
echo ""

if [ -f "$SSH_KEY_PATH" ]; then
    echo "✓ SSH 키가 이미 존재합니다: $SSH_KEY_PATH"
    echo ""
    read -p "새로운 키를 생성하시겠습니까? (기존 키는 백업됩니다) (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # 기존 키 백업
        backup_path="${SSH_KEY_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
        mv "$SSH_KEY_PATH" "$backup_path"
        mv "$SSH_PUB_KEY_PATH" "${backup_path}.pub"
        echo "✓ 기존 키를 백업했습니다: $backup_path"
    else
        echo "기존 키를 사용합니다."
        echo ""
        # 2단계로 건너뛰기
        generate_key=false
    fi
else
    generate_key=true
fi

if [ "$generate_key" != "false" ]; then
    echo ""
    echo "SSH 키를 생성합니다..."
    echo ""

    # .ssh 디렉토리 생성
    mkdir -p "$HOME/.ssh"
    chmod 700 "$HOME/.ssh"

    # SSH 키 생성
    ssh-keygen -t rsa -b 4096 -C "vnexsus@$(hostname)" -f "$SSH_KEY_PATH"

    echo ""
    echo "✓ SSH 키 생성 완료"
    echo "  개인 키: $SSH_KEY_PATH"
    echo "  공개 키: $SSH_PUB_KEY_PATH"
fi

# =====================================================
# 2단계: ssh-keys 디렉토리 준비
# =====================================================

echo ""
echo "[2/4] ssh-keys 디렉토리 준비 중..."
echo ""

# ssh-keys 디렉토리 생성
mkdir -p "$SSH_KEYS_DIR"
chmod 700 "$SSH_KEYS_DIR"

# 기존 authorized_keys 확인
if [ -f "$SSH_KEYS_DIR/authorized_keys" ]; then
    echo "✓ 기존 authorized_keys 파일 발견"
    echo ""
    read -p "덮어쓰시겠습니까? (y/N): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        # 기존 파일에 추가
        echo "기존 파일에 새 키를 추가합니다..."
        cat "$SSH_PUB_KEY_PATH" >> "$SSH_KEYS_DIR/authorized_keys"
        echo "✓ 공개 키를 추가했습니다"
    else
        # 새 파일 생성
        cp "$SSH_PUB_KEY_PATH" "$SSH_KEYS_DIR/authorized_keys"
        echo "✓ authorized_keys 파일을 생성했습니다"
    fi
else
    # 새 파일 생성
    cp "$SSH_PUB_KEY_PATH" "$SSH_KEYS_DIR/authorized_keys"
    echo "✓ authorized_keys 파일을 생성했습니다"
fi

# 권한 설정
chmod 600 "$SSH_KEYS_DIR/authorized_keys"

echo ""
echo "✓ ssh-keys 디렉토리 준비 완료"

# =====================================================
# 3단계: Docker 컨테이너 재시작
# =====================================================

echo ""
echo "[3/4] Docker 컨테이너 확인 중..."
echo ""

if docker ps | grep -q "vnexsus-backend-ssh"; then
    echo "컨테이너가 실행 중입니다. 재시작이 필요합니다."
    echo ""
    read -p "컨테이너를 재시작하시겠습니까? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "컨테이너 재시작 중..."
        docker-compose -f docker-compose.ssh.yml restart
        echo "✓ 컨테이너 재시작 완료"

        # 재시작 대기
        echo "컨테이너 시작 대기 중..."
        sleep 5
    else
        echo "⚠️  컨테이너를 재시작하지 않았습니다."
        echo "   SSH 키 인증을 사용하려면 수동으로 재시작하세요:"
        echo "   docker-compose -f docker-compose.ssh.yml restart"
    fi
else
    echo "✓ 컨테이너가 실행 중이 아닙니다"
    echo "  컨테이너를 시작하려면 다음 명령을 실행하세요:"
    echo "  ./start-ssh.sh"
fi

# =====================================================
# 4단계: SSH 접속 테스트
# =====================================================

echo ""
echo "[4/4] SSH 접속 테스트"
echo ""

if docker ps | grep -q "vnexsus-backend-ssh"; then
    echo "SSH 키 인증을 테스트합니다..."
    echo ""
    read -p "SSH 접속을 테스트하시겠습니까? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "SSH 접속 중... (비밀번호 없이 접속되어야 합니다)"
        echo ""
        ssh -p 2222 -i "$SSH_KEY_PATH" vnexsus@localhost
    fi
else
    echo "⚠️  컨테이너가 실행 중이 아니므로 테스트를 건너뜁니다."
fi

# =====================================================
# 완료
# =====================================================

echo ""
echo "========================================"
echo "✅ SSH 키 설정 완료"
echo "========================================"
echo ""
echo "📌 SSH 키 정보:"
echo "   개인 키: $SSH_KEY_PATH"
echo "   공개 키: $SSH_PUB_KEY_PATH"
echo "   인증 파일: $SSH_KEYS_DIR/authorized_keys"
echo ""
echo "🔐 SSH 접속 방법:"
echo "   ssh -p 2222 -i $SSH_KEY_PATH vnexsus@localhost"
echo ""
echo "💡 간편 접속을 위해 ~/.ssh/config에 추가:"
echo ""
echo "   Host vnexsus"
echo "       HostName localhost"
echo "       Port 2222"
echo "       User vnexsus"
echo "       IdentityFile $SSH_KEY_PATH"
echo ""
echo "   추가 후 'ssh vnexsus'로 접속 가능"
echo ""

# SSH config 추가 제안
read -p "~/.ssh/config에 자동으로 추가하시겠습니까? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # SSH config 파일 확인
    SSH_CONFIG="$HOME/.ssh/config"

    # 기존 설정 확인
    if [ -f "$SSH_CONFIG" ] && grep -q "Host vnexsus" "$SSH_CONFIG"; then
        echo "⚠️  ~/.ssh/config에 이미 'vnexsus' 호스트가 존재합니다."
        echo "   수동으로 편집해주세요."
    else
        # SSH config에 추가
        cat >> "$SSH_CONFIG" << EOF

# VNEXSUS SSH 접속
Host vnexsus
    HostName localhost
    Port 2222
    User vnexsus
    IdentityFile $SSH_KEY_PATH

EOF
        chmod 600 "$SSH_CONFIG"
        echo "✓ ~/.ssh/config에 추가했습니다"
        echo "  이제 'ssh vnexsus'로 간편하게 접속할 수 있습니다!"
    fi
fi

echo ""
echo "========================================"
echo ""
