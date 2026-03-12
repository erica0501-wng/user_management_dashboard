# Check SMTP Configuration Status
Write-Host "`n=== SMTP Configuration Status ===" -ForegroundColor Cyan
Write-Host ""

$envPath = "backend\.env"
$smtpConfigured = $false
$needsAppPassword = $false

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    
    if ($envContent -match "SMTP_HOST") {
        Write-Host "SMTP_HOST: Configured" -ForegroundColor Green
        $smtpConfigured = $true
    } else {
        Write-Host "SMTP_HOST: Not configured" -ForegroundColor Red
    }
    
    if ($envContent -match "SMTP_USER.*ericaaawonggg0501@gmail.com") {
        Write-Host "SMTP_USER: Configured (ericaaawonggg0501@gmail.com)" -ForegroundColor Green
    } elseif ($envContent -match "SMTP_USER") {
        Write-Host "SMTP_USER: Configured (other email)" -ForegroundColor Yellow
    } else {
        Write-Host "SMTP_USER: Not configured" -ForegroundColor Red
    }
    
    if ($envContent -match 'SMTP_PASS="YOUR_APP_PASSWORD_HERE"') {
        Write-Host "SMTP_PASS: Needs App Password" -ForegroundColor Red
        $needsAppPassword = $true
    } elseif ($envContent -match 'SMTP_PASS=""') {
        Write-Host "SMTP_PASS: Empty password" -ForegroundColor Red
        $needsAppPassword = $true
    } elseif ($envContent -match "SMTP_PASS") {
        Write-Host "SMTP_PASS: Configured" -ForegroundColor Green
    } else {
        Write-Host "SMTP_PASS: Not configured" -ForegroundColor Red
        $needsAppPassword = $true
    }
    
    Write-Host ""
    
    if ($needsAppPassword) {
        Write-Host "Status: Configuration incomplete" -ForegroundColor Red
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Visit: https://myaccount.google.com/apppasswords" -ForegroundColor White
        Write-Host "  2. Generate App Password" -ForegroundColor White
        Write-Host "  3. Copy password to backend\.env SMTP_PASS" -ForegroundColor White
        Write-Host "  4. Restart backend server" -ForegroundColor White
        Write-Host ""
        Write-Host "Details: GMAIL_SETUP_GUIDE_ericaaawonggg0501.md" -ForegroundColor Cyan
    } elseif ($smtpConfigured) {
        Write-Host "Status: Configuration complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Remember to restart backend server:" -ForegroundColor Yellow
        Write-Host "  1. Press Ctrl+C to stop backend" -ForegroundColor White
        Write-Host "  2. Run: cd backend; npm start" -ForegroundColor White
        Write-Host ""
        Write-Host "Then test email notification:" -ForegroundColor Yellow
        Write-Host "  Method 1: Visit http://localhost:5173 > Settings > Send Test" -ForegroundColor White
        Write-Host "  Method 2: Run .\quick-test.ps1" -ForegroundColor White
    }
} else {
    Write-Host ".env file not found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""
