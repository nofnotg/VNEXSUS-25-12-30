@echo off
chcp 65001 >nul
echo ========================================
echo  VNEXSUS 개발 서버 시작 (PORT 5050)
echo  접속: http://localhost:5050
echo  외부: https://dev.vnexsus.com
echo ========================================
echo.

:: 개발 환경 설정
set NODE_ENV=development

:: 프로젝트 루트에서 실행
cd /d %~dp0

echo 개발 서버를 시작합니다...
echo 서버를 중지하려면 Ctrl+C를 누르세요.
echo.

node backend/app.js

pause
