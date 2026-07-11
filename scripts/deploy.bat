@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo.
echo === 가족 앨범 Firebase 배포 ===
echo.
echo 1) 브라우저가 열리면 Google 계정으로 로그인해 주세요.
firebase login
if errorlevel 1 (
  echo Firebase 로그인에 실패했습니다.
  pause
  exit /b 1
)
echo.
echo 2) Firebase 프로젝트 생성 및 배포 중...
call npm run deploy:firebase
echo.
pause
