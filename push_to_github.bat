@echo off
echo Pushing code to GitHub...
set "PATH=D:\Git\cmd;%PATH%"
git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo Push failed. Please check the error message above.
) else (
    echo.
    echo Successfully pushed to GitHub!
)
pause
