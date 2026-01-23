@echo off
chcp 65001 >nul
echo ========================================
echo VNEXSUS 서버 시작
echo ========================================
echo.

:: .env 파일 확인
if not exist ".env" (
    echo [오류] .env 파일을 찾을 수 없습니다.
    echo windows-setup.bat를 먼저 실행하세요.
    pause
    exit /b 1
)

:: Node.js 확인
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [오류] Node.js가 설치되지 않았습니다.
    pause
    exit /b 1
)

:: 백엔드 폴더로 이동
if not exist "backend" (
    echo [오류] backend 폴더를 찾을 수 없습니다.
    echo 현재 디렉토리가 프로젝트 루트인지 확인하세요.
    pause
    exit /b 1
)

cd backend

:: node_modules 확인
if not exist "node_modules" (
    echo [경고] node_modules가 없습니다. 패키지를 설치합니다...
    call npm install
    if %errorLevel% neq 0 (
        echo [오류] 패키지 설치 실패
        pause
        exit /b 1
    )
)

:: 서버 시작
echo.
echo 서버를 시작합니다...
echo.
echo 메인 서버: http://localhost:3030
echo Dev Manager: http://localhost:8088
echo.
echo 서버를 중지하려면 Ctrl+C를 누르세요.
echo ========================================
echo.

npm start

pause
