@echo off
chcp 65001 >nul
echo ========================================
echo VNEXSUS Docker 로그 확인
echo ========================================
echo.
echo 로그를 실시간으로 확인합니다.
echo 종료하려면 Ctrl+C를 누르세요.
echo.
echo ========================================
echo.

docker-compose logs -f

pause
