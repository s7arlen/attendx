# Start Backend Server with Debugging

Write-Host "════════════════════════════════════════════════════════"
Write-Host "Starting AttendEx Backend Server"
Write-Host "════════════════════════════════════════════════════════"

# Set environment
$env:NODE_ENV = "development"
$env:PORT = "4000"

Write-Host ""
Write-Host "Configuration:"
Write-Host "  NODE_ENV: $($env:NODE_ENV)"
Write-Host "  PORT: $($env:PORT)"
Write-Host "  MONGODB_URI: $($env:MONGODB_URI)"
Write-Host ""

# Kill any existing process on port 4000
Write-Host "Checking for existing processes on port 4000..."
$existing = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Found existing process on port 4000, killing it..."
    Stop-Process -Id $existing.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "Port 4000 is now free"
} else {
    Write-Host "Port 4000 is free"
}

Write-Host ""
Write-Host "Starting server..."
Write-Host "════════════════════════════════════════════════════════"
Write-Host ""

# Start the development server
cd c:\Users\LENSTAR\Downloads\MY-PROJECTS\ATTENDEX\backend
npm run dev
