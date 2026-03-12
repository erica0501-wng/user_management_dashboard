# Test Polymarket Order Creation
# This script verifies that orders are being created when you trade on Polymarket

param(
    [string]$username = "erica",
    [string]$password = "password123"
)

Write-Host "`n=== Testing Polymarket Order Creation ===" -ForegroundColor Cyan
Write-Host ""

# Login
Write-Host "1. Logging in..." -ForegroundColor Yellow
try {
    $loginBody = @{ username = $username; password = $password } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    $token = $loginResponse.token
    Write-Host "   Login successful!" -ForegroundColor Green
} catch {
    Write-Host "   Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Get current orders count
Write-Host "2. Checking current orders..." -ForegroundColor Yellow
try {
    $ordersResponse = Invoke-RestMethod -Uri "http://localhost:3000/portfolio/orders" -Method GET -Headers @{Authorization = "Bearer $token"}
    $ordersBefore = $ordersResponse.length
    Write-Host "   Current orders: $ordersBefore" -ForegroundColor Cyan
    
    # Show recent Polymarket orders
    $polymarketOrders = $ordersResponse | Where-Object { $_.name -like "*-*" } | Select-Object -First 5
    if ($polymarketOrders.Count -gt 0) {
        Write-Host "`n   Recent Polymarket orders:" -ForegroundColor Cyan
        foreach ($order in $polymarketOrders) {
            Write-Host "     - $($order.name) | $($order.direction) | $$($order.price) | $($order.createdAt)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   No Polymarket orders found yet" -ForegroundColor Gray
    }
} catch {
    Write-Host "   Failed to get orders: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Instructions:" -ForegroundColor Yellow
Write-Host "   a) Go to http://localhost:5173/polymarket" -ForegroundColor White
Write-Host "   b) Click any market" -ForegroundColor White
Write-Host "   c) Buy 1 share (any outcome)" -ForegroundColor White
Write-Host "   d) Run this script again to see the new order" -ForegroundColor White

Write-Host ""
Write-Host "4. To verify after trading:" -ForegroundColor Yellow
Write-Host "   Run: .\test-polymarket-orders.ps1" -ForegroundColor Cyan

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
