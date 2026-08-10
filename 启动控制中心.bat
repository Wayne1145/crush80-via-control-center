@echo off
chcp 65001 >nul
REM 仅启动已构建的本地控制中心；WebHID 必须通过 localhost 打开，不能直接打开 file://。
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo [Crush 80] 未发现构建产物，正在执行安全构建...
  call npm run build
  if errorlevel 1 (
    echo [Crush 80] 构建失败，窗口将保持打开以便查看错误。
    pause
    exit /b 1
  )
)
start "Crush 80 控制中心" http://127.0.0.1:4178
call npm run serve
