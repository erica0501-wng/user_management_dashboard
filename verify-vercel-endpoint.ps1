# Test if Vercel transactions endpoint is live
$token = Read-Host "Paste your auth token from browser console"
$url = "https://user-management-dashboard-backend.vercel.app/portfolio/transactions"

Write-Host "`n📤 Testing: $url" -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $token"
}

try {
    $response = Invoke-WebRequest -Uri $url -Headers $headers -Method GET
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "$($response.Content)" -ForegroundColor White
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
}
