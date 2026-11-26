# Start Full AttendEx Application (Backend + Frontend)

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗"
Write-Host "║         AttendEx - Attendance Management System         ║"
Write-Host "║                   STARTUP SCRIPT                        ║"
Write-Host "╚════════════════════════════════════════════════════════╝"
Write-Host ""

# Verify MongoDB is running
Write-Host "✓ Checking MongoDB..."
$mongod = Get-Process mongod -ErrorAction SilentlyContinue
if ($mongod) {
    Write-Host "  ✅ MongoDB is running (PID: $($mongod.Id))"
} else {
    Write-Host "  ❌ MongoDB is NOT running"
    Write-Host "  Please start MongoDB before continuing"
    exit 1
}

# Kill any existing processes
Write-Host ""
Write-Host "✓ Cleaning up existing processes..."

@(4000, 5173) | ForEach-Object {
    $port = $_
    $existing = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  Killing process on port $port..."
        Stop-Process -Id $existing.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

Write-Host ""
Write-Host "✓ Dependencies check..."

# Check npm packages
Push-Location c:\Users\LENSTAR\Downloads\MY-PROJECTS\ATTENDEX\backend
if (-not (Test-Path node_modules)) {
    Write-Host "  Installing backend dependencies..."
    npm install --silent
}
Write-Host "  ✅ Backend packages ready"
Pop-Location

Push-Location c:\Users\LENSTAR\Downloads\MY-PROJECTS\ATTENDEX\frontend
if (-not (Test-Path node_modules)) {
    Write-Host "  Installing frontend dependencies..."
    npm install --silent
}
Write-Host "  ✅ Frontend packages ready"
Pop-Location

Write-Host ""
Write-Host "════════════════════════════════════════════════════════"
Write-Host "STARTING SERVERS"
Write-Host "════════════════════════════════════════════════════════"
Write-Host ""

# Start backend in background
Write-Host "→ Starting Backend (Port 4000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd c:\Users\LENSTAR\Downloads\MY-PROJECTS\ATTENDEX\backend; `$env:NODE_ENV='development'; npm run dev" -PassThru | Out-Null
Start-Sleep -Seconds 3

# Start frontend in background
Write-Host "→ Starting Frontend (Port 5173)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd c:\Users\LENSTAR\Downloads\MY-PROJECTS\ATTENDEX\frontend; `$env:NODE_ENV='development'; npm run dev" -PassThru | Out-Null
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "════════════════════════════════════════════════════════"
Write-Host "SERVERS STARTED SUCCESSFULLY"
Write-Host "════════════════════════════════════════════════════════"
Write-Host ""
Write-Host "✅ Backend:  http://localhost:4000/health"
Write-Host "✅ Frontend: http://localhost:5173"
Write-Host ""
Write-Host "API Docs:    http://localhost:4000/api"
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers"
Write-Host ""

# Wait indefinitely
Start-Sleep -Seconds 999999
