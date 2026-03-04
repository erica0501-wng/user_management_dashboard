@echo off
echo ================================
echo Deploying Backend to Vercel
echo ================================

cd backend
call vercel --prod --yes --confirm

echo.
echo ================================
echo Backend deployment complete!
echo ================================
echo.
echo Copy the backend URL that appears above
echo.
pause
