@echo off
chcp 65001 >nul
echo ========================================
echo VNEXSUS 개발 모드 서버 시작
echo (파일 변경 시 자동 재시작)
echo ========================================
echo.

cd backend

:: nodemon 확인
call npm list nodemon >nul 2>&1
if %errorLevel% neq 0 (
    echo nodemon이 설치되지 않았습니다. 설치 중...
    call npm install --save-dev nodemon
)

echo.
echo 개발 모드로 서버를 시작합니다...
echo 파일이 변경되면 자동으로 재시작됩니다.
echo.
echo 메인 서버: http://localhost:3030
echo Dev Manager: http://localhost:8088
echo.
echo 서버를 중지하려면 Ctrl+C를 누르세요.
echo ========================================
echo.

npm run dev

pause
