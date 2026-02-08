# VNEXSUS 빠른 시작 (Docker)

## 🚀 3분 안에 시작하기

### Windows에서 실행

#### 1. Docker Desktop 설치
[Docker Desktop](https://www.docker.com/products/docker-desktop/) 다운로드 → 설치 → 재시작

#### 2. 프로젝트 준비
```bash
# Git이 있으면
git clone <레포지토리-URL>
cd VNEXSUS-25-12-30

# 또는 ZIP 다운로드 후 압축 해제
```

#### 3. 환경변수 설정
```bash
# .env 파일 생성
copy .env.example .env

# 편집기로 .env 열어서 API 키 입력
# 필수: OPENAI_API_KEY, GOOGLE_API_KEY, GOOGLE_CLOUD_VISION_API_KEY
```

#### 4. 실행!
```bash
docker compose up -d
```

#### 5. 브라우저에서 접속
http://localhost:3030

---

## 🌐 원격에서 접속 (현재 활성)

**지금 바로 테스트:** https://loud-colts-sing.loca.lt

⚠️ 이 URL은 임시이며, 서버 재시작 시 변경됩니다.

---

## 📝 주요 명령어

```bash
# 실행
docker compose up -d

# 로그 확인
docker compose logs -f

# 중지
docker compose down

# 재시작
docker compose restart
```

---

## ❓ 문제 해결

### "포트가 이미 사용 중"
```bash
# 포트 확인
netstat -ano | findstr :3030

# 또는 다른 포트 사용 (docker-compose.yml 수정)
ports:
  - "8080:3030"
```

### "Docker 데몬 실행 안됨"
→ Docker Desktop이 실행 중인지 확인 (시스템 트레이 확인)

### "환경변수 누락"
→ `.env` 파일에 API 키가 제대로 입력되었는지 확인

---

## 📚 자세한 가이드

- **전체 Docker 가이드**: [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md)
- **Windows 로컬 설정**: [WINDOWS_LOCAL_SETUP_GUIDE.md](WINDOWS_LOCAL_SETUP_GUIDE.md)
- **일반 로컬 설정**: [LOCAL_SETUP.md](LOCAL_SETUP.md)

---

## ✅ 체크리스트

- [ ] Docker Desktop 설치 완료
- [ ] 프로젝트 다운로드 완료
- [ ] `.env` 파일 생성 및 API 키 입력
- [ ] `docker compose up -d` 실행
- [ ] http://localhost:3030 접속 확인
- [ ] API 상태 확인: http://localhost:3030/api/status

---

**문제가 있나요?** 이슈를 남겨주세요!
