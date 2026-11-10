@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo Lan dau chay: dang cai thu vien, doi 1-2 phut...
  call npm install
)
echo Dang bat game... Dong cua so nay la tat game.
echo Link cho TikTok LIVE Studio hien ben duoi khi server chay xong (cong 3000, ban thi cong ke tiep).
rem Che do live: trang stage khong tu tai lai khi sua code
set LIVE_MODE=1
rem Server tu mo trang dieu khien dung cong vua chon
set OPEN_DASHBOARD=1
npm run dev
pause
