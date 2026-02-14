# 🔐 VNEXSUS SSH 접속 가이드

VNEXSUS Docker 컨테이너에 SSH로 직접 접속하는 완벽 가이드입니다.

---

## 📋 목차

1. [개요](#개요)
2. [빠른 시작](#빠른-시작)
3. [상세 설정](#상세-설정)
4. [SSH 키 인증 설정](#ssh-키-인증-설정)
5. [문제 해결](#문제-해결)
6. [보안 권장사항](#보안-권장사항)

---

## 🎯 개요

### SSH 접속이 필요한 경우

- **원격 서버 관리**: 터미널을 통해 서버 관리
- **로그 확인**: 실시간 로그 모니터링
- **디버깅**: 서버 내부에서 직접 디버깅
- **파일 관리**: SFTP를 통한 파일 전송

### 접속 정보

| 항목 | 값 |
|------|-----|
| **호스트** | localhost (로컬) 또는 서버 IP (원격) |
| **포트** | 2222 |
| **사용자명** | vnexsus |
| **기본 비밀번호** | vnexsus2024 |
| **홈 디렉토리** | /app |

> ⚠️ **보안 경고**: 프로덕션 환경에서는 반드시 비밀번호를 변경하고 SSH 키 인증을 사용하세요!

---

## 🚀 빠른 시작

### 1단계: SSH 지원 컨테이너 실행

#### Docker Compose 사용 (권장)

```bash
# SSH 지원 컨테이너 빌드 및 시작
docker-compose -f docker-compose.ssh.yml up -d --build

# 로그 확인
docker-compose -f docker-compose.ssh.yml logs -f
```

#### Docker 직접 사용

```bash
# 이미지 빌드
docker build -f Dockerfile.ssh -t vnexsus-ssh:latest .

# 컨테이너 실행
docker run -d \
  --name vnexsus-ssh \
  -p 3030:3030 \
  -p 8088:8088 \
  -p 2222:2222 \
  --env-file .env \
  vnexsus-ssh:latest
```

### 2단계: SSH 접속

#### Linux/Mac/WSL

```bash
# 로컬 접속
ssh -p 2222 vnexsus@localhost

# 원격 접속
ssh -p 2222 vnexsus@서버IP주소

# 비밀번호: vnexsus2024
```

#### Windows (PowerShell 또는 CMD)

```cmd
# 로컬 접속
ssh -p 2222 vnexsus@localhost

# 원격 접속
ssh -p 2222 vnexsus@서버IP주소
```

#### PuTTY 사용 (Windows)

1. **PuTTY 실행**
2. **Host Name**: localhost (또는 서버 IP)
3. **Port**: 2222
4. **Connection type**: SSH
5. **Open** 클릭
6. **로그인**: vnexsus / vnexsus2024

### 3단계: 접속 확인

```bash
# 현재 디렉토리 확인
pwd
# 출력: /app

# 서버 프로세스 확인
ps aux | grep node

# 로그 확인
tail -f logs/server.log
```

---

## ⚙️ 상세 설정

### 비밀번호 변경

접속 후 즉시 비밀번호를 변경하세요:

```bash
# SSH 접속 후
passwd

# 새 비밀번호 입력 (두 번)
```

### SSH 포트 변경

기본 포트 2222를 다른 포트로 변경하려면:

#### docker-compose.ssh.yml 수정

```yaml
services:
  vnexsus-backend:
    ports:
      - "3030:3030"
      - "8088:8088"
      - "22222:2222"  # 호스트의 22222 포트로 변경
```

#### 재시작

```bash
docker-compose -f docker-compose.ssh.yml down
docker-compose -f docker-compose.ssh.yml up -d
```

#### 새 포트로 접속

```bash
ssh -p 22222 vnexsus@localhost
```

---

## 🔑 SSH 키 인증 설정

비밀번호 대신 SSH 키를 사용하여 더 안전하게 접속할 수 있습니다.

### 1단계: SSH 키 생성

#### Linux/Mac/WSL

```bash
# SSH 키 생성
ssh-keygen -t rsa -b 4096 -C "vnexsus@youremail.com"

# 저장 위치: ~/.ssh/id_rsa_vnexsus
# 비밀번호 입력 (선택사항)

# 공개 키 내용 확인
cat ~/.ssh/id_rsa_vnexsus.pub
```

#### Windows (PowerShell)

```powershell
# SSH 키 생성
ssh-keygen -t rsa -b 4096 -C "vnexsus@youremail.com"

# 저장 위치: C:\Users\사용자명\.ssh\id_rsa_vnexsus
# 비밀번호 입력 (선택사항)

# 공개 키 내용 확인
Get-Content $env:USERPROFILE\.ssh\id_rsa_vnexsus.pub
```

### 2단계: 공개 키를 컨테이너에 추가

#### 방법 1: ssh-copy-id 사용 (Linux/Mac/WSL)

```bash
# 공개 키를 컨테이너에 복사
ssh-copy-id -p 2222 -i ~/.ssh/id_rsa_vnexsus.pub vnexsus@localhost
```

#### 방법 2: 수동으로 복사

```bash
# 1. 공개 키 내용 복사
cat ~/.ssh/id_rsa_vnexsus.pub

# 2. SSH로 컨테이너 접속
ssh -p 2222 vnexsus@localhost

# 3. authorized_keys 파일에 추가
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "공개키내용" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

#### 방법 3: Docker 볼륨 사용 (가장 권장)

```bash
# 1. ssh-keys 디렉토리 생성
mkdir -p ssh-keys

# 2. 공개 키를 authorized_keys로 복사
cp ~/.ssh/id_rsa_vnexsus.pub ssh-keys/authorized_keys
chmod 600 ssh-keys/authorized_keys

# 3. docker-compose.ssh.yml의 볼륨 설정이 이미 되어 있음
#    volumes:
#      - ./ssh-keys:/home/vnexsus/.ssh:ro

# 4. 컨테이너 재시작
docker-compose -f docker-compose.ssh.yml restart
```

### 3단계: SSH 키로 접속

```bash
# 키 파일 지정하여 접속
ssh -p 2222 -i ~/.ssh/id_rsa_vnexsus vnexsus@localhost

# Windows
ssh -p 2222 -i %USERPROFILE%\.ssh\id_rsa_vnexsus vnexsus@localhost
```

### SSH Config 설정 (선택사항)

`~/.ssh/config` 파일에 추가:

```
Host vnexsus-local
    HostName localhost
    Port 2222
    User vnexsus
    IdentityFile ~/.ssh/id_rsa_vnexsus

Host vnexsus-remote
    HostName 서버IP주소
    Port 2222
    User vnexsus
    IdentityFile ~/.ssh/id_rsa_vnexsus
```

이제 간단하게 접속:

```bash
# 로컬
ssh vnexsus-local

# 원격
ssh vnexsus-remote
```

---

## 🔧 원격 서버 접속 설정

### 클라우드 서버 방화벽 설정

#### AWS (Security Group)

1. EC2 콘솔 → Security Groups
2. Inbound Rules 추가:
   - Type: Custom TCP
   - Port: 2222
   - Source: My IP (또는 특정 IP 범위)

#### GCP (Firewall Rules)

```bash
gcloud compute firewall-rules create vnexsus-ssh \
  --allow tcp:2222 \
  --source-ranges=당신의IP/32 \
  --description="VNEXSUS SSH access"
```

#### Azure (Network Security Group)

1. Azure Portal → Network Security Groups
2. Inbound security rules 추가:
   - Destination port ranges: 2222
   - Protocol: TCP
   - Source: My IP address

### Linux 서버 방화벽 설정

#### Ubuntu/Debian (UFW)

```bash
sudo ufw allow 2222/tcp
sudo ufw enable
sudo ufw status
```

#### CentOS/RHEL (firewalld)

```bash
sudo firewall-cmd --permanent --add-port=2222/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

---

## 🛠️ 문제 해결

### 1. "Connection refused" 오류

```bash
# 컨테이너가 실행 중인지 확인
docker ps | grep vnexsus

# 컨테이너가 없으면 시작
docker-compose -f docker-compose.ssh.yml up -d

# 포트가 열려 있는지 확인
docker exec vnexsus-backend-ssh netstat -tuln | grep 2222

# SSH 서비스 상태 확인
docker exec vnexsus-backend-ssh ps aux | grep sshd
```

### 2. "Permission denied (publickey,password)" 오류

```bash
# 비밀번호 인증이 활성화되어 있는지 확인
docker exec vnexsus-backend-ssh cat /etc/ssh/sshd_config | grep PasswordAuthentication

# SSH 서비스 재시작
docker exec vnexsus-backend-ssh killall sshd
docker exec vnexsus-backend-ssh /usr/sbin/sshd -D -p 2222 &
```

### 3. "Host key verification failed" 오류

```bash
# known_hosts에서 이전 항목 제거
ssh-keygen -R "[localhost]:2222"

# 또는
rm ~/.ssh/known_hosts

# 다시 접속 시도
ssh -p 2222 vnexsus@localhost
```

### 4. SSH 키 권한 오류

```bash
# 키 파일 권한 수정
chmod 600 ~/.ssh/id_rsa_vnexsus
chmod 644 ~/.ssh/id_rsa_vnexsus.pub

# ssh-keys 디렉토리 권한 (Docker 볼륨)
chmod 700 ssh-keys
chmod 600 ssh-keys/authorized_keys
```

### 5. 원격 접속 안 됨

```bash
# 1. 방화벽 확인
sudo ufw status  # Ubuntu
sudo firewall-cmd --list-all  # CentOS

# 2. 포트 바인딩 확인
netstat -tuln | grep 2222

# 3. Docker 포트 매핑 확인
docker port vnexsus-backend-ssh

# 4. 클라우드 보안 그룹 확인 (AWS/GCP/Azure)
```

---

## 🔒 보안 권장사항

### 1. 기본 비밀번호 변경 (필수)

```bash
# SSH 접속 후
passwd
```

### 2. SSH 키 인증 사용 (강력 권장)

- 비밀번호 인증보다 훨씬 안전
- 위의 [SSH 키 인증 설정](#ssh-키-인증-설정) 참조

### 3. 비밀번호 인증 비활성화 (프로덕션)

SSH 키 설정 후:

```bash
# 컨테이너 내부에서
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo killall sshd
sudo /usr/sbin/sshd -D -p 2222 &
```

또는 Dockerfile.ssh 수정:

```dockerfile
RUN sed -i 's/#PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
```

### 4. Root 로그인 비활성화 (이미 설정됨)

Dockerfile.ssh에서 이미 설정:

```dockerfile
sed -i 's/#PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
```

### 5. IP 화이트리스트

docker-compose.ssh.yml에 추가:

```yaml
services:
  vnexsus-backend:
    networks:
      vnexsus-network:
        ipv4_address: 172.20.0.10
```

방화벽 규칙으로 특정 IP만 허용

### 6. Fail2Ban 설정 (고급)

컨테이너 내부에서:

```bash
# Fail2Ban 설치 및 설정
apk add fail2ban
# 설정 파일 편집...
```

### 7. SSH 포트 변경

기본 2222를 예측하기 어려운 포트로 변경

### 8. 로그 모니터링

```bash
# 접속 로그 확인
docker exec vnexsus-backend-ssh tail -f /var/log/auth.log

# 실패한 로그인 시도 확인
docker exec vnexsus-backend-ssh grep "Failed password" /var/log/auth.log
```

---

## 📚 유용한 명령어

### 컨테이너 관리

```bash
# 컨테이너 시작
docker-compose -f docker-compose.ssh.yml up -d

# 컨테이너 종료
docker-compose -f docker-compose.ssh.yml down

# 컨테이너 재시작
docker-compose -f docker-compose.ssh.yml restart

# 로그 보기
docker-compose -f docker-compose.ssh.yml logs -f

# 컨테이너 상태 확인
docker-compose -f docker-compose.ssh.yml ps
```

### SSH 접속

```bash
# 기본 접속
ssh -p 2222 vnexsus@localhost

# 키 파일 지정
ssh -p 2222 -i ~/.ssh/id_rsa_vnexsus vnexsus@localhost

# 상세 로그 출력
ssh -v -p 2222 vnexsus@localhost

# X11 포워딩 (GUI 앱)
ssh -X -p 2222 vnexsus@localhost
```

### 파일 전송 (SCP/SFTP)

```bash
# SCP로 파일 업로드
scp -P 2222 local-file.txt vnexsus@localhost:/app/uploads/

# SCP로 파일 다운로드
scp -P 2222 vnexsus@localhost:/app/logs/server.log ./

# SFTP 세션 시작
sftp -P 2222 vnexsus@localhost
```

### 포트 포워딩

```bash
# 로컬 포트 포워딩 (원격의 3306을 로컬 3306으로)
ssh -p 2222 -L 3306:localhost:3306 vnexsus@localhost

# 원격 포트 포워딩
ssh -p 2222 -R 8080:localhost:8080 vnexsus@localhost
```

---

## 🎯 요약

### 빠른 접속 순서

1. **컨테이너 시작**
   ```bash
   docker-compose -f docker-compose.ssh.yml up -d
   ```

2. **SSH 접속**
   ```bash
   ssh -p 2222 vnexsus@localhost
   # 비밀번호: vnexsus2024
   ```

3. **작업 수행**
   ```bash
   cd /app
   tail -f logs/server.log
   ```

4. **종료**
   ```bash
   exit
   ```

### 접속 정보 요약

| 항목 | 로컬 환경 | 원격 환경 |
|------|----------|----------|
| **호스트** | localhost | 서버 IP 주소 |
| **포트** | 2222 | 2222 |
| **사용자** | vnexsus | vnexsus |
| **비밀번호** | vnexsus2024 | vnexsus2024 (변경 권장) |
| **홈 디렉토리** | /app | /app |

---

## 💬 지원

문제가 발생하면:

1. [문제 해결](#문제-해결) 섹션 확인
2. 로그 확인: `docker-compose -f docker-compose.ssh.yml logs`
3. GitHub Issues 또는 팀 채널에 문의

---

**🎉 이제 VNEXSUS 컨테이너에 SSH로 안전하게 접속할 수 있습니다!**

> ⚠️ **프로덕션 환경에서는 반드시 보안 권장사항을 따르세요!**
