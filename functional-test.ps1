# Functional Testing Script for Facial Recognition Feature
# Tests all 8 scenarios described in NEXT_STEPS.md

param(
    [string]$BaseUrl = "http://localhost:4000/api",
    [string]$AuthToken = "",
    [string]$TeacherToken = "",
    [string]$StudentId = "507f1f77bcf86cd799439011",
    [string]$TeacherId = "507f1f77bcf86cd799439012",
    [string]$SubjectId = "507f1f77bcf86cd799439013",
    [string]$SessionId = ""
)

# Global test results
$testResults = @()
$passCount = 0
$failCount = 0

# Helper function to log test result
function Log-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message
    )
    
    $status = if ($Passed) { "✅ PASS" } else { "❌ FAIL" }
    Write-Host "$status | $TestName"
    if ($Message) {
        Write-Host "       $Message" -ForegroundColor Gray
    }
    
    if ($Passed) {
        $global:passCount++
    } else {
        $global:failCount++
    }
    
    $global:testResults += @{
        "name" = $TestName
        "passed" = $Passed
        "message" = $Message
    }
}

# Generate test face descriptor
function Generate-FaceDescriptor {
    $descriptor = @()
    for ($i = 0; $i -lt 128; $i++) {
        $descriptor += [math]::Round((Get-Random -Minimum -100 -Maximum 100) / 100.0, 3)
    }
    return $descriptor
}

# Test 1: Face Registration
function Test-FaceRegistration {
    Write-Host "`n════════════════════════════════════════════════════════════════"
    Write-Host "TEST 1: FACE REGISTRATION" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════════"
    
    try {
        $descriptor = Generate-FaceDescriptor
        $payload = @{
            faceDescriptor = $descriptor
        } | ConvertTo-Json
        
        Write-Host "Sending face descriptor (128 elements)..."
        $response = Invoke-WebRequest -Uri "$BaseUrl/attendance/face/register" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $AuthToken"
                "Content-Type" = "application/json"
            } `
            -Body $payload `
            -TimeoutSec 10 `
            -ErrorAction Stop
        
        $result = $response.Content | ConvertFrom-Json
        
        if ($result.success -and $result.message -like "*registered*") {
            Log-TestResult "Face Registration" $true "Successfully registered face descriptor"
            return $true
        } else {
            Log-TestResult "Face Registration" $false "Response indicated failure: $($result.message)"
            return $false
        }
    }
    catch {
        Log-TestResult "Face Registration" $false "Exception: $($_.Exception.Message)"
        return $false
    }
}

# Test 2: Face Verification - Success Case
function Test-FaceVerificationSuccess {
    Write-Host "`n════════════════════════════════════════════════════════════════"
    Write-Host "TEST 2: FACE VERIFICATION - SUCCESS CASE" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════════"
    
    if (-not $SessionId) {
        Write-Host "⚠️  Skipping: No session ID provided"
        Log-TestResult "Face Verification Success" $false "Session ID not provided"
        return $false
    }
    
    try {
        $descriptor = Generate-FaceDescriptor
        $payload = @{
            sessionId = $SessionId
            secureToken = "test-secure-token-success"
            faceDescriptor = $descriptor
        } | ConvertTo-Json
        
        Write-Host "Sending face verification request..."
        $response = Invoke-WebRequest -Uri "$BaseUrl/attendance/face/verify" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $AuthToken"
                "Content-Type" = "application/json"
            } `
            -Body $payload `
            -TimeoutSec 10 `
            -ErrorAction Stop
        
        $result = $response.Content | ConvertFrom-Json
        
        if ($result.success) {
            Log-TestResult "Face Verification Success" $true "Attendance marked successfully"
            return $true
        } else {
            Log-TestResult "Face Verification Success" $false "Verification failed: $($result.message)"
            return $false
        }
    }
    catch {
        Log-TestResult "Face Verification Success" $false "Exception: $($_.Exception.Message)"
        return $false
    }
}

# Test 3: Face Verification - Failure Case (Low Similarity)
function Test-FaceVerificationFailure {
    Write-Host "`n════════════════════════════════════════════════════════════════"
    Write-Host "TEST 3: FACE VERIFICATION - FAILURE CASE (LOW SIMILARITY)" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════════"
    
    if (-not $SessionId) {
        Write-Host "⚠️  Skipping: No session ID provided"
        Log-TestResult "Face Verification Failure" $false "Session ID not provided"
        return $false
    }
    
    try {
        # Create a very different descriptor to simulate different face
        $descriptor = @()
        for ($i = 0; $i -lt 128; $i++) {
            $descriptor += [math]::Round((Get-Random -Minimum 50 -Maximum 100) / 100.0, 3)
        }
        
        $payload = @{
            sessionId = $SessionId
            secureToken = "test-secure-token-failure"
            faceDescriptor = $descriptor
        } | ConvertTo-Json
        
        Write-Host "Sending face verification with different face..."
        $response = Invoke-WebRequest -Uri "$BaseUrl/attendance/face/verify" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $AuthToken"
                "Content-Type" = "application/json"
            } `
            -Body $payload `
            -TimeoutSec 10 `
            -ErrorAction Stop
        
        # Should not reach here - should fail with 401
        Log-TestResult "Face Verification Failure" $false "Expected failure but got success"
        return $false
    }
    catch {
        $error = $_.Exception.Response.StatusCode
        if ($error -eq 401 -or $error -eq "Unauthorized") {
            Log-TestResult "Face Verification Failure" $true "Correctly rejected with 401 Unauthorized"
            return $true
        } else {
            Log-TestResult "Face Verification Failure" $false "Unexpected error code: $error"
            return $false
        }
    }
}

# Test 4: Invalid Face Descriptor (Non-128 elements)
function Test-InvalidDescriptorLength {
    Write-Host "`n════════════════════════════════════════════════════════════════"
    Write-Host "TEST 4: INVALID DESCRIPTOR - NON-128 ELEMENTS" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════════"
    
    try {
        # Create invalid descriptor with 100 elements instead of 128
        $invalidDescriptor = @()
        for ($i = 0; $i -lt 100; $i++) {
            $invalidDescriptor += 0.5
        }
        
        $payload = @{
            faceDescriptor = $invalidDescriptor
        } | ConvertTo-Json
        
        Write-Host "Sending invalid descriptor (100 elements instead of 128)..."
        $response = Invoke-WebRequest -Uri "$BaseUrl/attendance/face/register" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $AuthToken"
                "Content-Type" = "application/json"
            } `
            -Body $payload `
            -TimeoutSec 10 `
            -ErrorAction Stop
        
        # Should not reach here - should fail with 400
        Log-TestResult "Invalid Descriptor Length" $false "Expected validation error but got success"
        return $false
    }
    catch {
        $error = $_.Exception.Response.StatusCode
        if ($error -eq 400 -or $error -eq "BadRequest") {
            Log-TestResult "Invalid Descriptor Length" $true "Correctly rejected with 400 Bad Request"
            return $true
        } else {
            Log-TestResult "Invalid Descriptor Length" $false "Unexpected error code: $error"
            return $false
        }
    }
}

# Test 5: Invalid Descriptor - Non-numeric Values
function Test-InvalidDescriptorValues {
    Write-Host "`n════════════════════════════════════════════════════════════════"
    Write-Host "TEST 5: INVALID DESCRIPTOR - NON-NUMERIC VALUES" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════════"
    
    try {
        # Create descriptor with non-numeric values
        $invalidDescriptor = @()
        for ($i = 0; $i -lt 128; $i++) {
            if ($i -eq 50) {
                $invalidDescriptor += "not-a-number"  # Invalid value
            } else {
                $invalidDescriptor += 0.5
            }
        }
        
        $payload = @{
            faceDescriptor = $invalidDescriptor
        } | ConvertTo-Json
        
        Write-Host "Sending descriptor with non-numeric values..."
        $response = Invoke-WebRequest -Uri "$BaseUrl/attendance/face/register" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $AuthToken"
                "Content-Type" = "application/json"
            } `
            -Body $payload `
            -TimeoutSec 10 `
            -ErrorAction Stop
        
        Log-TestResult "Invalid Descriptor Values" $false "Expected validation error but got success"
        return $false
    }
    catch {
        $error = $_.Exception.Response.StatusCode
        if ($error -eq 400 -or $error -eq "BadRequest") {
            Log-TestResult "Invalid Descriptor Values" $true "Correctly rejected with 400 Bad Request"
            return $true
        } else {
            Log-TestResult "Invalid Descriptor Values" $false "Unexpected error code: $error"
            return $false
        }
    }
}

# Test 6: Missing Required Fields
function Test-MissingRequiredFields {
    Write-Host "`n════════════════════════════════════════════════════════════════"
    Write-Host "TEST 6: MISSING REQUIRED FIELDS" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════════"
    
    try {
        # Empty payload
        $payload = @{} | ConvertTo-Json
        
        Write-Host "Sending empty payload..."
        $response = Invoke-WebRequest -Uri "$BaseUrl/attendance/face/register" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $AuthToken"
                "Content-Type" = "application/json"
            } `
            -Body $payload `
            -TimeoutSec 10 `
            -ErrorAction Stop
        
        Log-TestResult "Missing Required Fields" $false "Expected validation error but got success"
        return $false
    }
    catch {
        $error = $_.Exception.Response.StatusCode
        if ($error -eq 400 -or $error -eq "BadRequest") {
            Log-TestResult "Missing Required Fields" $true "Correctly rejected with 400 Bad Request"
            return $true
        } else {
            Log-TestResult "Missing Required Fields" $false "Unexpected error code: $error"
            return $false
        }
    }
}

# Test 7: Authentication Required
function Test-AuthenticationRequired {
    Write-Host "`n════════════════════════════════════════════════════════════════"
    Write-Host "TEST 7: AUTHENTICATION REQUIRED" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════════"
    
    try {
        $descriptor = Generate-FaceDescriptor
        $payload = @{
            faceDescriptor = $descriptor
        } | ConvertTo-Json
        
        Write-Host "Sending request without authentication..."
        $response = Invoke-WebRequest -Uri "$BaseUrl/attendance/face/register" `
            -Method POST `
            -Headers @{
                "Content-Type" = "application/json"
            } `
            -Body $payload `
            -TimeoutSec 10 `
            -ErrorAction Stop
        
        Log-TestResult "Authentication Required" $false "Expected auth error but got success"
        return $false
    }
    catch {
        $error = $_.Exception.Response.StatusCode
        if ($error -eq 401 -or $error -eq "Unauthorized") {
            Log-TestResult "Authentication Required" $true "Correctly rejected with 401 Unauthorized"
            return $true
        } else {
            Log-TestResult "Authentication Required" $false "Unexpected error code: $error"
            return $false
        }
    }
}

# Test 8: Response Format Validation
function Test-ResponseFormat {
    Write-Host "`n════════════════════════════════════════════════════════════════"
    Write-Host "TEST 8: RESPONSE FORMAT VALIDATION" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════════"
    
    try {
        $descriptor = Generate-FaceDescriptor
        $payload = @{
            faceDescriptor = $descriptor
        } | ConvertTo-Json
        
        Write-Host "Validating response format..."
        $response = Invoke-WebRequest -Uri "$BaseUrl/attendance/face/register" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $AuthToken"
                "Content-Type" = "application/json"
            } `
            -Body $payload `
            -TimeoutSec 10 `
            -ErrorAction Stop
        
        $result = $response.Content | ConvertFrom-Json
        
        $hasSuccess = $result.PSObject.Properties.Name -contains "success"
        $hasMessage = $result.PSObject.Properties.Name -contains "message"
        $hasData = $result.PSObject.Properties.Name -contains "data"
        
        if ($hasSuccess -and $hasMessage) {
            Log-TestResult "Response Format Validation" $true "Response contains required fields"
            return $true
        } else {
            Log-TestResult "Response Format Validation" $false "Response missing required fields"
            return $false
        }
    }
    catch {
        Log-TestResult "Response Format Validation" $false "Exception: $($_.Exception.Message)"
        return $false
    }
}

# Main execution
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host "FACIAL RECOGNITION - FUNCTIONAL TEST SUITE"
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host "Base URL: $BaseUrl"
Write-Host ""

if (-not $AuthToken) {
    Write-Host "⚠️  ERROR: Auth token required"
    Write-Host "   Usage: .\functional-test.ps1 -AuthToken `"your-token`""
    exit 1
}

# Run all tests
Write-Host "Running tests...`n"

Test-FaceRegistration
Test-FaceVerificationSuccess
Test-FaceVerificationFailure
Test-InvalidDescriptorLength
Test-InvalidDescriptorValues
Test-MissingRequiredFields
Test-AuthenticationRequired
Test-ResponseFormat

# Summary
Write-Host "`n════════════════════════════════════════════════════════════════"
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host "Total Tests: $($passCount + $failCount)"
Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "✅ ALL TESTS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ SOME TESTS FAILED" -ForegroundColor Red
    exit 1
}
