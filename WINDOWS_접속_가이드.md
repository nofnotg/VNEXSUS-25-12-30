# 🚀 VNEXSUS Windows에서 접속하기 - 완벽 가이드

이 가이드는 **Linux/WSL에서 실행 중인 VNEXSUS 서버**에 **Windows에서 접속**하는 방법을 설명합니다.

---

## 📋 목차

1. [시나리오 선택](#시나리오-선택)
2. [시나리오 A: WSL에서 실행](#시나리오-a-wsl에서-실행)
3. [시나리오 B: 원격 Linux 서버](#시나리오-b-원격-linux-서버)
4. [문제 해결](#문제-해결)

---

## 🔍 시나리오 선택

먼저 자신의 상황에 맞는 시나리오를 선택하세요:

### 당신의 상황은?

- **시나리오 A**: Claude Code가 **같은 PC의 WSL** 안에서 돌아가고 있다
  - ✅ WSL2를 사용 중
  - ✅ Windows와 WSL이 같은 컴퓨터에 있음
  - ✅ `wsl` 명령으로 Linux 환경에 접근 가능

- **시나리오 B**: Claude Code가 **원격 Linux 서버**에서 돌아가고 있다
  - ✅ 클라우드 서버 (AWS, GCP, Azure 등)
  - ✅ 회사 개발 서버
  - ✅ 다른 컴퓨터의 Linux

---

## 시나리오 A: WSL에서 실행

WSL에서 실행하고 Windows에서 접속하는 가장 간단한 방법입니다.

### ⚡ 빠른 시작 (원클릭)

#### 방법 1: Docker로 실행 (권장)

1. **WSL에서 Docker 컨테이너 시작**
   ```bash
   cd /home/user/VNEXSUS-25-12-30
   ./start-docker-wsl.sh
   ```

2. **Windows에서 브라우저 열기**
   - 메인 애플리케이션: http://localhost:3030
   - 개발 관리자: http://localhost:8088

3. **완료!** 🎉

#### 방법 2: 직접 실행

1. **WSL에서 서버 시작**
   ```bash
   cd /home/user/VNEXSUS-25-12-30
   ./start-wsl.sh
   ```

2. **Windows에서 브라우저 열기**
   - 메인 애플리케이션: http://localhost:3030
   - 개발 관리자: http://localhost:8088

3. **완료!** 🎉

### 📝 상세 설명

#### 왜 WSL에서는 이렇게 간단한가요?

WSL2는 Windows와 네트워크를 자동으로 공유합니다. 따라서:
- WSL의 `localhost` = Windows의 `localhost`
- 추가 설정 없이 바로 접속 가능

#### 서버가 0.0.0.0으로 바인딩되어야 합니다

VNEXSUS는 이미 `0.0.0.0`으로 바인딩되도록 설정되어 있습니다:
- ✅ `backend/app.js`: `app.listen(PORT, '0.0.0.0', ...)`
- ✅ `docker-compose.yml`: 포트 3030, 8088 노출

만약 접속이 안 된다면 [문제 해결](#문제-해결) 섹션을 참고하세요.

### 🔧 고급 사용법

#### WSL IP로 직접 접속

때로는 WSL의 IP 주소로 직접 접속해야 할 수 있습니다:

1. **WSL에서 IP 확인**
   ```bash
   ip addr show eth0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1
   # 예: 172.24.123.45
   ```

2. **Windows에서 접속**
   ```
   http://172.24.123.45:3030
   http://172.24.123.45:8088
   ```

#### 다른 기기에서 접속

같은 네트워크의 다른 기기(스마트폰, 태블릿 등)에서 접속하려면:

1. **Windows PC의 IP 확인**
   ```cmd
   ipconfig
   # IPv4 주소 확인 (예: 192.168.1.100)
   ```

2. **Windows 방화벽 설정**
   - 이미 `windows-setup.bat`를 실행했다면 자동 설정됨
   - 수동 설정: 포트 3030, 8088을 인바운드 허용

3. **다른 기기에서 접속**
   ```
   http://192.168.1.100:3030
   http://192.168.1.100:8088
   ```

---

## 시나리오 B: 원격 Linux 서버

원격 Linux 서버에서 실행하고 Windows에서 접속하는 방법입니다.

### ⚡ 빠른 시작 (SSH 터널링)

가장 안전하고 권장되는 방법입니다.

#### 1단계: SSH 터널 설정 파일 수정

`connect-ssh-tunnel.bat` (또는 `.ps1`) 파일을 편집:

```batch
REM 아래 값들을 실제 환경에 맞게 수정
set REMOTE_USER=ubuntu
set REMOTE_HOST=192.168.1.100
set SSH_KEY_PATH=%USERPROFILE%\.ssh\id_rsa
```

#### 2단계: SSH 터널 연결

**배치 파일 사용 (간단)**:
```cmd
connect-ssh-tunnel.bat
```

**PowerShell 사용 (권장)**:
```powershell
.\connect-ssh-tunnel.ps1
```

**수동으로 실행 (이해를 위해)**:
```cmd
ssh -L 3030:localhost:3030 -L 8088:localhost:8088 ubuntu@192.168.1.100
```

#### 3단계: Windows에서 브라우저 열기

터널이 연결된 상태에서:

**자동으로 열기**:
```cmd
open-after-tunnel.bat
```

**수동으로 열기**:
- http://localhost:3030
- http://localhost:8088

#### 4단계: 완료! 🎉

SSH 터널이 연결되어 있는 동안 Windows에서 원격 서버에 접속할 수 있습니다.

### 📝 SSH 터널링 상세 설명

#### SSH 터널링이란?

SSH 터널은 **안전한 통로**를 만들어줍니다:
```
Windows (localhost:3030) ──[암호화된 SSH 터널]──> Linux 서버 (localhost:3030)
```

#### 장점
- ✅ **보안**: 모든 트래픽이 암호화됨
- ✅ **간편**: 방화벽/포트 오픈 불필요
- ✅ **안전**: 외부에 포트 노출 안 함

#### 주의사항
- ⚠️ SSH 터널 창을 닫으면 연결이 끊김
- ⚠️ 비밀번호 또는 SSH 키 필요
- ⚠️ 네트워크가 불안정하면 재연결 필요

### 🔧 대안: 직접 포트 오픈 (비권장)

SSH 터널을 사용할 수 없는 경우에만 사용하세요.

#### 원격 서버에서 설정

1. **서버가 0.0.0.0으로 바인딩되도록 확인**
   ```bash
   # VNEXSUS는 이미 0.0.0.0으로 바인딩됨
   cd /home/user/VNEXSUS-25-12-30
   ./start-docker-wsl.sh  # 또는 ./start-wsl.sh
   ```

2. **방화벽에서 포트 오픈**
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 3030/tcp
   sudo ufw allow 8088/tcp
   sudo ufw enable

   # CentOS/RHEL
   sudo firewall-cmd --permanent --add-port=3030/tcp
   sudo firewall-cmd --permanent --add-port=8088/tcp
   sudo firewall-cmd --reload
   ```

3. **클라우드 보안 그룹 설정**
   - AWS: Security Group에서 인바운드 규칙 추가
   - GCP: 방화벽 규칙 추가
   - Azure: 네트워크 보안 그룹 설정

#### Windows에서 접속

원격 서버의 공인 IP로 접속:
```
http://서버-공인-IP:3030
http://서버-공인-IP:8088
```

#### ⚠️ 보안 경고

- **인증 설정 필수**: 비밀번호, API 키 등으로 접근 제어
- **HTTPS 사용 권장**: Let's Encrypt로 무료 인증서 발급
- **IP 화이트리스트**: 신뢰할 수 있는 IP만 허용

---

## 문제 해결

### 1. "연결할 수 없습니다" (ERR_CONNECTION_REFUSED)

#### WSL 환경
```bash
# WSL에서 서버가 실행 중인지 확인
ps aux | grep node

# 포트가 열려 있는지 확인
netstat -tuln | grep 3030

# 서버 재시작
./start-wsl.sh  # 또는 ./start-docker-wsl.sh
```

#### 원격 서버 (SSH 터널)
```cmd
# Windows에서 터널이 연결되어 있는지 확인
netstat -ano | findstr ":3030"

# 터널 재연결
connect-ssh-tunnel.bat
```

### 2. "사이트에 연결할 수 없음" (ERR_CONNECTION_TIMED_OUT)

#### 원격 서버 직접 접속 시

1. **원격 서버의 방화벽 확인**
   ```bash
   sudo ufw status  # Ubuntu
   sudo firewall-cmd --list-all  # CentOS
   ```

2. **클라우드 보안 그룹 확인**
   - AWS/GCP/Azure 콘솔에서 인바운드 규칙 확인

3. **서버가 0.0.0.0으로 바인딩되었는지 확인**
   ```bash
   netstat -tuln | grep 3030
   # 0.0.0.0:3030이 보여야 함 (127.0.0.1:3030이 아니라)
   ```

### 3. WSL에서 localhost로 접속 안 됨

#### WSL IP로 직접 접속 시도
```bash
# WSL에서 IP 확인
hostname -I

# Windows에서 WSL IP로 접속
http://[WSL-IP]:3030
```

#### WSL 네트워크 재시작
```powershell
# PowerShell (관리자 권한)
wsl --shutdown
# 잠시 후 WSL 재시작
wsl
```

### 4. SSH 터널 연결 실패

#### SSH 설치 확인
```cmd
where ssh
# 없으면: Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

#### SSH 키 권한 확인
```bash
# 원격 서버에서
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

#### 상세 로그 확인
```cmd
ssh -v -L 3030:localhost:3030 ubuntu@서버IP
```

### 5. 방화벽 문제 (Windows)

#### Windows Defender 방화벽 설정
```powershell
# PowerShell (관리자 권한)
New-NetFirewallRule -DisplayName "VNEXSUS Port 3030" -Direction Inbound -LocalPort 3030 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "VNEXSUS Port 8088" -Direction Inbound -LocalPort 8088 -Protocol TCP -Action Allow
```

또는 `windows-setup.bat`를 관리자 권한으로 실행하세요.

---

## 📚 추가 자료

### 빠른 참조

#### WSL 환경
```bash
# 서버 시작 (Docker)
./start-docker-wsl.sh

# 서버 시작 (직접)
./start-wsl.sh

# 서버 종료 (Docker)
./stop-docker-wsl.sh

# 로그 확인
docker-compose logs -f  # Docker
tail -f backend/logs/server.log  # 직접 실행
```

#### 원격 서버 (SSH 터널)
```cmd
REM 터널 연결
connect-ssh-tunnel.bat

REM 브라우저 열기
open-after-tunnel.bat

REM 터널 종료
Ctrl+C (터널 창에서)
```

### 포트 정보

| 포트 | 용도 | URL |
|------|------|-----|
| 3030 | 메인 애플리케이션 | http://localhost:3030 |
| 8088 | 개발 관리자 | http://localhost:8088 |

### 관련 파일

| 파일 | 용도 |
|------|------|
| `start-wsl.sh` | WSL에서 직접 서버 시작 |
| `start-docker-wsl.sh` | WSL에서 Docker로 서버 시작 |
| `stop-docker-wsl.sh` | Docker 서버 종료 |
| `connect-ssh-tunnel.bat` | SSH 터널 연결 (배치) |
| `connect-ssh-tunnel.ps1` | SSH 터널 연결 (PowerShell) |
| `open-after-tunnel.bat` | 터널 연결 후 브라우저 열기 |
| `windows-setup.bat` | Windows 환경 초기 설정 |

---

## 🎯 요약

### 가장 쉬운 방법

**WSL 환경**:
```bash
./start-docker-wsl.sh
```
→ Windows 브라우저에서 `http://localhost:3030` 접속

**원격 서버**:
```cmd
connect-ssh-tunnel.bat
```
→ Windows 브라우저에서 `http://localhost:3030` 접속

### 선택 가이드

| 상황 | 방법 | 난이도 | 보안 |
|------|------|--------|------|
| WSL 환경 | `start-docker-wsl.sh` | ⭐ | ✅ |
| 원격 서버 | SSH 터널링 | ⭐⭐ | ✅✅✅ |
| 원격 서버 (공개) | 직접 포트 오픈 | ⭐⭐⭐ | ⚠️ |

---

## 💬 도움이 필요하세요?

1. 먼저 [문제 해결](#문제-해결) 섹션 확인
2. 로그 파일 확인:
   - Docker: `docker-compose logs`
   - 직접 실행: `backend/logs/server.log`
3. 이슈 제기: GitHub Issues 또는 팀 채널

---

**🎉 이제 Linux에서 실행하는 VNEXSUS에 Windows에서 쉽게 접속할 수 있습니다!**
