@echo off
title YT-dlp Pro Auto Installer
color 0A

echo =======================================================
echo        YT-dlp Pro Auto-Installer
echo =======================================================
echo.
echo Please wait while we download the required core files...
echo This may take 1-3 minutes depending on your internet.
echo.

:: التأكد من وجود مجلد السيرفر
if not exist "yt-server" mkdir "yt-server"

echo [1/3] Downloading yt-dlp engine...
curl -L -o "yt-server\yt-dlp.exe" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"

echo.
echo [2/3] Downloading FFmpeg (for video/audio fast merging)...
curl -L -o "ffmpeg.zip" "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"

echo.
echo [3/3] Extracting and installing components...
powershell -Command "Expand-Archive -Path 'ffmpeg.zip' -DestinationPath 'ffmpeg_temp' -Force"

:: نقل ملفات الدمج لمجلد السيرفر
for /d %%I in ("ffmpeg_temp\*") do (
    copy /Y "%%I\bin\ffmpeg.exe" "yt-server\" >nul
    copy /Y "%%I\bin\ffprobe.exe" "yt-server\" >nul
)

echo.
echo Cleaning up temporary files...
del /Q "ffmpeg.zip"
rmdir /S /Q "ffmpeg_temp"

echo.
echo =======================================================
echo    [SUCCESS] All components are installed!
echo    You can now run "Start-Hidden.vbs" to start the server.
echo =======================================================
pause