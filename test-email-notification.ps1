# Email Notification Test Script
param(
    [string]$username = "erica",
    [string]$password = "password123"
)

Write-Host "Email Notification Test Script" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Write-Host "1. Checking if backend is running..." -ForegroundColor Yellow
try {
    $backendCheck = Invoke-RestMethod -Uri "http://localhost:3000" -Method Get -ErrorAction Stop
    Write-Host "   Backend is running!" -ForegroundColor Green
} catch {
    Write-Host "   Backend is not running!" -ForegroundColor Red
    Write-Host "   Please start the backend first: cd backend; npm start" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Login to get token
Write-Host "2. Logging in as '$username'..." -ForegroundColor Yellow
try {
    $loginBody = @{ username = $username; password = $password } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -ErrorAction Stop
    $token = $loginResponse.token
    Write-Host "   Login successful!" -ForegroundColor Green
} catch {
    Write-Host "   Login failed! Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Get notification settings
Write-Host "3. Checking notification settings..." -ForegroundColor Yellow
try {
    $settings = Invoke-RestMethod -Uri "http://localhost:3000/notifications/settings" -Method GET -Headers @{Authorization = "Bearer $token"} -ErrorAction Stop
    Write-Host "   Email Enabled: $($settings.settings.emailEnabled)" -ForegroundColor Cyan
    Write-Host "   Discord Enabled: $($settings.settings.discordEnabled)" -ForegroundColor Cyan
    Write-Host "   Default Channels: $($settings.settings.defaultChannels -join ', ')" -ForegroundColor Cyan
    
    if (-not $settings.settings.emailEnabled) {
        Write-Host "   Email is disabled. Enable it in settings first!" -ForegroundColor Yellow
    } else {
        Write-Host "   Email is enabled!" -ForegroundColor Green
    }
} catch {
    Write-Host "   Failed to get settings! Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Check SMTP configuration
Write-Host "4. Checking SMTP configuration..." -ForegroundColor Yellow
$envPath = "backend\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
    $smtpHost = $envContent | Select-String "SMTP_HOST" | Select-Object -First 1
    $smtpUser = $envContent | Select-String "SMTP_USER" | Select-Object -First 1
    
    if ($smtpHost -and $smtpUser) {
        Write-Host "   SMTP settings found in .env file" -ForegroundColor Green
        Write-Host "   $smtpHost" -ForegroundColor Cyan
        Write-Host "   $smtpUser" -ForegroundColor Cyan
    } else {
        Write-Host "   SMTP settings NOT found in .env file" -ForegroundColor Yellow
        Write-Host "   Please add SMTP configuration to backend/.env" -ForegroundColor Yellow
        Write-Host "   See EMAIL_NOTIFICATION_TEST_GUIDE.md for instructions" -ForegroundColor Yellow
    }
} else {
    Write-Host "   .env file not found!" -ForegroundColor Yellow
}

Write-Host ""

# Send test notification
Write-Host "5. Sending test notification..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/notifications/test" -Method POST -Headers @{Authorization = "Bearer $token"} -ContentType "application/json" -ErrorAction Stop
    Write-Host "   Test notification sent successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Notification Results:" -ForegroundColor Cyan
    
    foreach ($notification in $response.notifications) {
        if ($notification.success) {
            Write-Host "      $($notification.channel): Success" -ForegroundColor Green
        } else {
            Write-Host "      $($notification.channel): Failed - $($notification.error)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "   Check your email inbox (and spam folder)!" -ForegroundColor Cyan
} catch {
    Write-Host "   Failed to send test notification!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        try {
            $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "   Details: $($errorDetail.error)" -ForegroundColor Red
        } catch {}
    }
}

Write-Host ""
Write-Host "===============================" -ForegroundColor Cyan
Write-Host "Test complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tips:" -ForegroundColor Yellow
Write-Host "  - If email not received, check spam folder" -ForegroundColor Gray
Write-Host "  - Make sure SMTP is configured in backend/.env" -ForegroundColor Gray
Write-Host "  - Restart backend after adding SMTP settings" -ForegroundColor Gray
Write-Host "  - Check backend logs for error messages" -ForegroundColor Gray
Write-Host ""
