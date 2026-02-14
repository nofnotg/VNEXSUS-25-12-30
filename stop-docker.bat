@echo off
chcp 65001 >nul
echo ========================================
echo VNEXSUS Docker 종료
echo ========================================
echo.

:: Docker 실행 확인
docker --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [오류] Docker가 설치되지 않았거나 실행 중이지 않습니다.
    pause
    exit /b 1
)

:: Docker Compose로 종료
echo Docker 컨테이너를 종료합니다...
echo.

docker-compose down

if %errorLevel% neq 0 (
    echo.
    echo [오류] Docker 컨테이너 종료 실패
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✓ VNEXSUS 앱이 종료되었습니다.
echo ========================================
echo.
echo 다시 시작하려면: start-docker.bat 실행
echo.

pause
