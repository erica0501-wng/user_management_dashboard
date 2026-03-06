# Test Alert API Endpoints

# 1. Get authentication token first (update with your credentials)
$token = "your-jwt-token-here"

# Base URL
$apiUrl = "http://localhost:3000"

# Test 1: Get all alerts
Write-Host "Test 1: Getting all alerts..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/alerts" -Method Get -Headers @{
        "Authorization" = "Bearer $token"
    }
    Write-Host "✓ Success: Found $($response.count) alerts" -ForegroundColor Green
    $response.alerts | Format-Table -AutoSize
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"

# Test 2: Create a price alert
Write-Host "Test 2: Creating a price alert..." -ForegroundColor Cyan
try {
    $alertData = @{
        marketId = "mock-1"
        question = "Will Bitcoin reach $100k by end of 2026?"
        outcome = "Yes"
        alertType = "Price"
        targetPrice = 0.70
        condition = "Above"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$apiUrl/alerts" -Method Post -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } -Body $alertData
    
    Write-Host "✓ Success: Alert created with ID $($response.alert.id)" -ForegroundColor Green
    $alertId = $response.alert.id
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"

# Test 3: Get triggered alerts
Write-Host "Test 3: Getting triggered alerts..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/alerts/triggered" -Method Get -Headers @{
        "Authorization" = "Bearer $token"
    }
    Write-Host "✓ Success: Found $($response.count) triggered alerts" -ForegroundColor Green
    $response.alerts | Format-Table -AutoSize
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"

# Test 4: Get order book
Write-Host "Test 4: Getting order book..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/polymarket/orderbook/test-token-123" -Method Get
    Write-Host "✓ Success: Order book retrieved" -ForegroundColor Green
    Write-Host "  Best Bid: $($response.metrics.bestBid)" -ForegroundColor Yellow
    Write-Host "  Best Ask: $($response.metrics.bestAsk)" -ForegroundColor Yellow
    Write-Host "  Total Volume: $($response.metrics.totalVolume)" -ForegroundColor Yellow
    Write-Host "  Spread: $($response.metrics.spread) ($($response.metrics.spreadPercent)%)" -ForegroundColor Yellow
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"
Write-Host "Testing complete!" -ForegroundColor Green
