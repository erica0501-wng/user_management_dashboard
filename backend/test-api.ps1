# Get token from a test user (Erica Wong)
$loginBody = @{
    email = "ericawong@gmail.com"
    password = "password123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = $loginResponse.token

Write-Host "Token: $token" -ForegroundColor Green
Write-Host ""

# Test my-shared-watchlists endpoint
$headers = @{
    "Authorization" = "Bearer $token"
}

Write-Host "Testing /social/my-shared-watchlists..." -ForegroundColor Yellow
$myShares = Invoke-RestMethod -Uri "http://localhost:3000/social/my-shared-watchlists" -Method GET -Headers $headers
$myShares | ConvertTo-Json -Depth 5
