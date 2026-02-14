@echo off
chcp 65001 >nul
echo ========================================
echo VNEXSUS Docker 실행
echo ========================================
echo.

:: Docker 실행 확인
docker --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [오류] Docker가 설치되지 않았거나 실행 중이지 않습니다.
    echo.
    echo 1. Docker Desktop을 설치하세요: https://www.docker.com/products/docker-desktop/
    echo 2. Docker Desktop을 실행하고 잠시 기다린 후 다시 시도하세요.
    echo.
    pause
    exit /b 1
)

:: .env 파일 확인
if not exist ".env" (
    echo [경고] .env 파일이 없습니다.
    echo.
    if exist ".env.secure" (
        echo .env.secure 파일을 .env로 복사합니다...
        copy ".env.secure" ".env" >nul
        echo.
        echo [중요] .env 파일을 열어서 API 키를 설정하세요!
        echo         GOOGLE_CLOUD_VISION_API_KEY 항목을 확인하세요.
        echo.
        pause
    ) else (
        echo .env 파일을 생성해야 합니다.
        echo WINDOWS_사용자_가이드.md 파일을 참조하세요.
        pause
        exit /b 1
    )
)

:: docker-compose.yml 확인
if not exist "docker-compose.yml" (
    echo [오류] docker-compose.yml 파일을 찾을 수 없습니다.
    echo 현재 디렉토리가 프로젝트 루트인지 확인하세요.
    pause
    exit /b 1
)

:: Docker Compose로 실행
echo Docker 컨테이너를 시작합니다...
echo 처음 실행 시 이미지를 다운로드하므로 시간이 걸릴 수 있습니다.
echo.

docker-compose up -d

if %errorLevel% neq 0 (
    echo.
    echo [오류] Docker 컨테이너 시작 실패
    echo.
    echo 문제 해결:
    echo 1. Docker Desktop이 실행 중인지 확인
    echo 2. .env 파일의 설정을 확인
    echo 3. 방화벽 설정을 확인
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✓ VNEXSUS 앱이 시작되었습니다!
echo ========================================
echo.
echo 브라우저에서 다음 주소로 접속하세요:
echo.
echo   메인 애플리케이션:  http://localhost:3030
echo   파일 업로드:        http://localhost:3030/hybrid-interface.html
echo   개발 관리자:        http://localhost:8088
echo.
echo 컨테이너 상태 확인: docker-compose ps
echo 로그 확인:          docker-compose logs -f
echo 앱 종료:            stop-docker.bat 실행 또는 docker-compose down
echo.
echo ========================================
echo.

:: IP 주소 확인
echo 네트워크 정보:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    set IP=!IP: =!
    echo   내부 IP: !IP!
    echo   다른 기기에서 접속: http://!IP!:3030
    goto :found
)
:found

echo.
pause
