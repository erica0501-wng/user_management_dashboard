@echo off
echo ====================================
echo 检查Vercel环境变量配置
echo ====================================
echo.
echo 步骤 1: 打开Backend项目环境变量页面
echo https://vercel.com/ericas-projects-fa24d81a/backend/settings/environment-variables
echo.
echo 步骤 2: 确认以下环境变量已添加:
echo.
echo [必需] DATABASE_URL
echo   Value: postgresql://neondb_owner:npg_UQ7uqTIKnfB6@ep-solitary-moon-a1iyv6k3-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
echo   Environments: Production, Preview, Development
echo.
echo [必需] JWT_SECRET
echo   Value: (from your local .env file)
echo   Environments: Production, Preview, Development
echo.
echo ====================================
echo 配置完成后，按任意键重新部署...
pause >nul
echo.
echo 正在重新部署backend...
cd backend
vercel --prod
echo.
echo ====================================
echo 部署完成！
echo 测试API端点...
echo.
curl https://backend-mauve-one-19.vercel.app/polymarket/markets?limit=1
echo.
pause
