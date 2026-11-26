# Start Frontend Server

Write-Host "════════════════════════════════════════════════════════"
Write-Host "Starting AttendEx Frontend Server"
Write-Host "════════════════════════════════════════════════════════"

# Set environment
$env:NODE_ENV = "development"

Write-Host ""
Write-Host "Configuration:"
Write-Host "  NODE_ENV: $($env:NODE_ENV)"
Write-Host "  VITE_API_URL: http://localhost:4000/api"
Write-Host ""

# Kill any existing process on port 5173
Write-Host "Checking for existing processes on port 5173..."
$existing = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Found existing process on port 5173, killing it..."
    Stop-Process -Id $existing.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "Port 5173 is now free"
} else {
    Write-Host "Port 5173 is free"
}

Write-Host ""
Write-Host "Starting frontend dev server..."
Write-Host "════════════════════════════════════════════════════════"
Write-Host ""

# Start the development server
cd c:\Users\LENSTAR\Downloads\MY-PROJECTS\ATTENDEX\frontend
npm run dev
