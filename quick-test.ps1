# 快速测试邮件通知
# 用法: .\quick-test.ps1

Write-Host "`n=== 邮件通知快速测试 ===" -ForegroundColor Cyan
Write-Host ""

# 获取用户输入
$username = Read-Host "请输入你的用户名"
$password = Read-Host "请输入你的密码" -AsSecureString
$passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

Write-Host "`n正在测试..." -ForegroundColor Yellow

try {
    # 登录
    $loginBody = @{ username = $username; password = $passwordPlain } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    $token = $loginResponse.token
    Write-Host "  登录成功" -ForegroundColor Green
    
    # 获取设置
    $settings = Invoke-RestMethod -Uri "http://localhost:3000/notifications/settings" -Method GET -Headers @{Authorization = "Bearer $token"}
    Write-Host "  Email 已启用: $($settings.settings.emailEnabled)" -ForegroundColor Cyan
    
    # 如果email未启用，先启用它
    if (-not $settings.settings.emailEnabled) {
        Write-Host "  正在启用 Email 通知..." -ForegroundColor Yellow
        $updateBody = @{ emailEnabled = $true; defaultChannels = @("email") } | ConvertTo-Json
        Invoke-RestMethod -Uri "http://localhost:3000/notifications/settings" -Method PUT -Headers @{Authorization = "Bearer $token"} -ContentType "application/json" -Body $updateBody | Out-Null
        Write-Host "  Email 通知已启用" -ForegroundColor Green
    }
    
    # 发送测试通知
    Write-Host "`n  发送测试通知..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "http://localhost:3000/notifications/test" -Method POST -Headers @{Authorization = "Bearer $token"} -ContentType "application/json"
    
    Write-Host "`n  结果:" -ForegroundColor Cyan
    foreach ($notification in $response.notifications) {
        if ($notification.success) {
            Write-Host "    $($notification.channel): 成功" -ForegroundColor Green
        } else {
            Write-Host "    $($notification.channel): 失败 - $($notification.error)" -ForegroundColor Red
        }
    }
    
    Write-Host "`n  请检查你的邮箱 (包括垃圾邮件文件夹)!" -ForegroundColor Cyan
    
} catch {
    Write-Host "`n  测试失败: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Message -like "*401*") {
        Write-Host "  用户名或密码错误" -ForegroundColor Yellow
    }
}

Write-Host "`n=====================" -ForegroundColor Cyan
Write-Host ""
