@echo off
echo ================================
echo Deploying Frontend to Vercel
echo ================================

cd frontend
call vercel --prod --yes --confirm

echo.
echo ================================
echo Frontend deployment complete!
echo ================================
pause
