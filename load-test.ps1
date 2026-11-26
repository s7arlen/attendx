# Load Testing Script for Facial Recognition API
# Usage: .\load-test.ps1 -LoadLevel "normal" -Environment "staging"

param(
    [ValidateSet("normal", "medium", "high", "spike")]
    [string]$LoadLevel = "normal",
    
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging",
    
    [string]$BaseUrl = "http://localhost:4000/api",
    [string]$AuthToken = ""
)

# Configuration
$config = @{
    "normal" = @{
        "concurrent_users" = 10
        "ramp_up_seconds" = 30
        "test_duration_seconds" = 120
        "requests_per_user" = 5
    }
    "medium" = @{
        "concurrent_users" = 50
        "ramp_up_seconds" = 60
        "test_duration_seconds" = 180
        "requests_per_user" = 5
    }
    "high" = @{
        "concurrent_users" = 100
        "ramp_up_seconds" = 60
        "test_duration_seconds" = 180
        "requests_per_user" = 5
    }
    "spike" = @{
        "concurrent_users" = 200
        "ramp_up_seconds" = 10
        "test_duration_seconds" = 120
        "requests_per_user" = 2
    }
}

$testConfig = $config[$LoadLevel]

# Generate test data
function Generate-FaceDescriptor {
    $descriptor = @()
    for ($i = 0; $i -lt 128; $i++) {
        $descriptor += [math]::Round((Get-Random -Minimum -100 -Maximum 100) / 100.0, 3)
    }
    return $descriptor
}

# Test registration endpoint
function Test-FaceRegistration {
    param(
        [string]$Url,
        [string]$Token,
        [int]$RequestNumber
    )
    
    $descriptor = Generate-FaceDescriptor
    $payload = @{
        faceDescriptor = $descriptor
    } | ConvertTo-Json
    
    $startTime = Get-Date
    
    try {
        $response = Invoke-WebRequest -Uri "$Url/attendance/face/register" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $Token"
                "Content-Type" = "application/json"
            } `
            -Body $payload `
            -TimeoutSec 30 `
            -ErrorAction Stop
        
        $elapsedMs = (Get-Date).Subtract($startTime).TotalMilliseconds
        
        return @{
            "success" = $true
            "status" = $response.StatusCode
            "time_ms" = $elapsedMs
            "error" = $null
        }
    }
    catch {
        $elapsedMs = (Get-Date).Subtract($startTime).TotalMilliseconds
        return @{
            "success" = $false
            "status" = $_.Exception.Response.StatusCode
            "time_ms" = $elapsedMs
            "error" = $_.Exception.Message
        }
    }
}

# Test verification endpoint
function Test-FaceVerification {
    param(
        [string]$Url,
        [string]$Token,
        [int]$RequestNumber
    )
    
    $descriptor = Generate-FaceDescriptor
    $payload = @{
        sessionId = "507f1f77bcf86cd799439011"  # Example MongoDB ObjectId
        secureToken = "test-secure-token-$RequestNumber"
        faceDescriptor = $descriptor
    } | ConvertTo-Json
    
    $startTime = Get-Date
    
    try {
        $response = Invoke-WebRequest -Uri "$Url/attendance/face/verify" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $Token"
                "Content-Type" = "application/json"
            } `
            -Body $payload `
            -TimeoutSec 30 `
            -ErrorAction Stop
        
        $elapsedMs = (Get-Date).Subtract($startTime).TotalMilliseconds
        
        return @{
            "success" = $true
            "status" = $response.StatusCode
            "time_ms" = $elapsedMs
            "error" = $null
        }
    }
    catch {
        $elapsedMs = (Get-Date).Subtract($startTime).TotalMilliseconds
        return @{
            "success" = $false
            "status" = $_.Exception.Response.StatusCode
            "time_ms" = $elapsedMs
            "error" = $_.Exception.Message
        }
    }
}

# Run load test
function Run-LoadTest {
    param(
        [string]$TestName,
        [scriptblock]$TestFunction,
        [int]$ConcurrentUsers,
        [int]$RequestsPerUser,
        [int]$RampUpSeconds,
        [int]$DurationSeconds
    )
    
    Write-Host "`n════════════════════════════════════════════════════════════════"
    Write-Host "LOAD TEST: $TestName" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════════"
    Write-Host "Concurrent Users: $ConcurrentUsers"
    Write-Host "Requests per User: $RequestsPerUser"
    Write-Host "Ramp-up Time: $RampUpSeconds seconds"
    Write-Host "Test Duration: $DurationSeconds seconds"
    Write-Host ""
    
    $results = @()
    $totalRequests = $ConcurrentUsers * $RequestsPerUser
    $successCount = 0
    $failureCount = 0
    $responseTimes = @()
    
    $startTime = Get-Date
    $rampUpInterval = $RampUpSeconds / $ConcurrentUsers
    
    Write-Host "Starting requests..."
    
    for ($user = 1; $user -le $ConcurrentUsers; $user++) {
        # Ramp up
        Start-Sleep -Milliseconds ([math]::Round($rampUpInterval * 1000))
        
        # Run requests for this user
        for ($req = 1; $req -le $RequestsPerUser; $req++) {
            $result = & $TestFunction -Url $BaseUrl -Token $AuthToken -RequestNumber $req
            $results += $result
            
            if ($result.success) {
                $successCount++
            } else {
                $failureCount++
            }
            
            $responseTimes += $result.time_ms
            
            # Progress indicator
            $completed = $results.Count
            $percentage = [math]::Round(($completed / $totalRequests) * 100)
            Write-Progress -Activity "Running Load Test" `
                -Status "$completed / $totalRequests requests ($percentage%)" `
                -PercentComplete $percentage
        }
    }
    
    Write-Progress -Activity "Running Load Test" -Completed
    
    # Calculate statistics
    $elapsedSeconds = (Get-Date).Subtract($startTime).TotalSeconds
    $avgResponse = $responseTimes | Measure-Object -Average | Select-Object -ExpandProperty Average
    $minResponse = $responseTimes | Measure-Object -Minimum | Select-Object -ExpandProperty Minimum
    $maxResponse = $responseTimes | Measure-Object -Maximum | Select-Object -ExpandProperty Maximum
    
    # Calculate percentiles
    $sorted = $responseTimes | Sort-Object
    $p95Index = [math]::Floor($sorted.Count * 0.95)
    $p95 = $sorted[$p95Index]
    
    $throughput = $results.Count / $elapsedSeconds
    $successRate = ($successCount / $results.Count) * 100
    
    # Display results
    Write-Host ""
    Write-Host "RESULTS:" -ForegroundColor Green
    Write-Host "────────────────────────────────────────────────────────────────"
    Write-Host "Total Requests: $($results.Count)"
    Write-Host "Success: $successCount ($('{0:F1}' -f $successRate)%)"
    Write-Host "Failed: $failureCount"
    Write-Host ""
    Write-Host "Response Times (ms):"
    Write-Host "  Average: $('{0:F1}' -f $avgResponse)"
    Write-Host "  Min: $('{0:F1}' -f $minResponse)"
    Write-Host "  Max: $('{0:F1}' -f $maxResponse)"
    Write-Host "  95th Percentile: $('{0:F1}' -f $p95)"
    Write-Host ""
    Write-Host "Throughput: $('{0:F2}' -f $throughput) req/sec"
    Write-Host "Elapsed Time: $('{0:F1}' -f $elapsedSeconds) seconds"
    
    # Pass/Fail criteria
    Write-Host ""
    Write-Host "PASS/FAIL CRITERIA:" -ForegroundColor Cyan
    
    $passed = $true
    
    # Check response time
    switch ($LoadLevel) {
        "normal" {
            $maxAllowed = 500
        }
        "medium" {
            $maxAllowed = 800
        }
        "high" {
            $maxAllowed = 1500
        }
        "spike" {
            $maxAllowed = 2000
        }
    }
    
    if ($avgResponse -le $maxAllowed) {
        Write-Host "✅ Avg Response Time: $('{0:F1}' -f $avgResponse)ms <= $maxAllowed ms (PASS)"
    } else {
        Write-Host "❌ Avg Response Time: $('{0:F1}' -f $avgResponse)ms > $maxAllowed ms (FAIL)"
        $passed = $false
    }
    
    # Check error rate
    $maxErrorRate = 1.0
    if ($successRate -ge (100 - $maxErrorRate)) {
        Write-Host "✅ Error Rate: $('{0:F2}' -f (100 - $successRate))% <= $maxErrorRate% (PASS)"
    } else {
        Write-Host "❌ Error Rate: $('{0:F2}' -f (100 - $successRate))% > $maxErrorRate% (FAIL)"
        $passed = $false
    }
    
    # Check throughput
    $minThroughput = 5
    if ($throughput -ge $minThroughput) {
        Write-Host "✅ Throughput: $('{0:F2}' -f $throughput) req/sec >= $minThroughput req/sec (PASS)"
    } else {
        Write-Host "❌ Throughput: $('{0:F2}' -f $throughput) req/sec < $minThroughput req/sec (FAIL)"
        $passed = $false
    }
    
    Write-Host ""
    if ($passed) {
        Write-Host "OVERALL: ✅ PASS" -ForegroundColor Green
    } else {
        Write-Host "OVERALL: ❌ FAIL" -ForegroundColor Red
    }
    
    return $passed
}

# Main execution
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host "FACIAL RECOGNITION - LOAD TESTING SUITE"
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host "Load Level: $LoadLevel"
Write-Host "Environment: $Environment"
Write-Host "Base URL: $BaseUrl"
Write-Host ""

if (-not $AuthToken) {
    Write-Host "⚠️  WARNING: No auth token provided. Tests may fail if authentication is required."
    Write-Host "   Usage: .\load-test.ps1 -AuthToken `"your-token-here`""
    Write-Host ""
}

# Run tests
$allPassed = $true

$testName = "$LoadLevel Load Test - Registration"
$passed = Run-LoadTest -TestName $testName `
    -TestFunction ${function:Test-FaceRegistration} `
    -ConcurrentUsers $testConfig.concurrent_users `
    -RequestsPerUser $testConfig.requests_per_user `
    -RampUpSeconds $testConfig.ramp_up_seconds `
    -DurationSeconds $testConfig.test_duration_seconds

$allPassed = $allPassed -and $passed

$testName = "$LoadLevel Load Test - Verification"
$passed = Run-LoadTest -TestName $testName `
    -TestFunction ${function:Test-FaceVerification} `
    -ConcurrentUsers $testConfig.concurrent_users `
    -RequestsPerUser $testConfig.requests_per_user `
    -RampUpSeconds $testConfig.ramp_up_seconds `
    -DurationSeconds $testConfig.test_duration_seconds

$allPassed = $allPassed -and $passed

# Summary
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host "LOAD TEST SUMMARY"
Write-Host "════════════════════════════════════════════════════════════════"

if ($allPassed) {
    Write-Host "✅ ALL LOAD TESTS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ SOME LOAD TESTS FAILED" -ForegroundColor Red
    exit 1
}
