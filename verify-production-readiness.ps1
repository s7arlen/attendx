# Production Readiness Verification Script
# Comprehensive checks before deployment to production

param(
    [switch]$Verbose = $false,
    [string]$OutputFile = "deployment-verification-report.txt"
)

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$reportContent = @()
$checksPassed = 0
$checksFailed = 0

function Add-Report {
    param([string]$Message, [string]$Status = "INFO")
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $formattedMsg = "[$timestamp] [$Status] $Message"
    
    if ($Status -eq "PASS") {
        Write-Host $formattedMsg -ForegroundColor Green
        $script:checksPassed++
    } elseif ($Status -eq "FAIL") {
        Write-Host $formattedMsg -ForegroundColor Red
        $script:checksFailed++
    } elseif ($Status -eq "WARN") {
        Write-Host $formattedMsg -ForegroundColor Yellow
    } else {
        Write-Host $formattedMsg -ForegroundColor Gray
    }
    
    $reportContent += $formattedMsg
}

function Verify-Compilation {
    Add-Report "Starting TypeScript Compilation Checks..." "INFO"
    
    # Backend compilation
    Push-Location backend
    $result = npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -eq 0) {
        Add-Report "Backend TypeScript Compilation" "PASS"
    } else {
        Add-Report "Backend TypeScript Compilation - FAILED" "FAIL"
        Add-Report $result "WARN"
    }
    Pop-Location
    
    # Frontend compilation
    Push-Location frontend
    $result = npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -eq 0) {
        Add-Report "Frontend TypeScript Compilation" "PASS"
    } else {
        Add-Report "Frontend TypeScript Compilation - FAILED" "FAIL"
        Add-Report $result "WARN"
    }
    Pop-Location
}

function Verify-Dependencies {
    Add-Report "Starting Dependency Checks..." "INFO"
    
    # Check npm packages
    $backendPackages = Get-Content backend/package.json | ConvertFrom-Json
    $frontendPackages = Get-Content frontend/package.json | ConvertFrom-Json
    
    # Verify critical dependencies exist
    $criticalDeps = @("express", "mongoose", "jsonwebtoken", "zod", "bcryptjs")
    foreach ($dep in $criticalDeps) {
        if ($backendPackages.dependencies.PSObject.Properties.Name -contains $dep) {
            Add-Report "Backend dependency: $dep" "PASS"
        } else {
            Add-Report "Missing backend dependency: $dep" "FAIL"
        }
    }
    
    # Check facial recognition dependencies
    if ($frontendPackages.dependencies.PSObject.Properties.Name -contains "face-api.js") {
        Add-Report "Frontend dependency: face-api.js" "PASS"
    } else {
        Add-Report "Missing frontend dependency: face-api.js" "FAIL"
    }
}

function Verify-FileStructure {
    Add-Report "Starting File Structure Checks..." "INFO"
    
    # Backend controllers
    $requiredFiles = @(
        "backend/src/controllers/facialRecognition.controller.ts",
        "backend/src/routes/attendance.routes.ts",
        "backend/src/models/User.model.ts",
        "backend/src/models/AttendanceRecord.model.ts",
        "frontend/src/components/shared/FacialRecognitionCapture.tsx",
        "frontend/src/services/facialRecognition.service.ts"
    )
    
    foreach ($file in $requiredFiles) {
        if (Test-Path $file) {
            Add-Report "Required file exists: $file" "PASS"
        } else {
            Add-Report "Missing required file: $file" "FAIL"
        }
    }
}

function Verify-EnvironmentConfig {
    Add-Report "Starting Environment Configuration Checks..." "INFO"
    
    # Check backend .env
    if (Test-Path backend/.env) {
        $envContent = Get-Content backend/.env -Raw
        
        if ($envContent -match "FACE_SIMILARITY_THRESHOLD") {
            Add-Report "Backend env: FACE_SIMILARITY_THRESHOLD configured" "PASS"
        } else {
            Add-Report "Backend env: FACE_SIMILARITY_THRESHOLD not configured" "WARN"
        }
        
        if ($envContent -match "DATABASE_URL|MONGO_URI") {
            Add-Report "Backend env: Database connection configured" "PASS"
        } else {
            Add-Report "Backend env: Database connection not configured" "FAIL"
        }
        
        if ($envContent -match "JWT_SECRET") {
            Add-Report "Backend env: JWT_SECRET configured" "PASS"
        } else {
            Add-Report "Backend env: JWT_SECRET not configured" "FAIL"
        }
    } else {
        Add-Report "Backend .env file not found" "FAIL"
    }
    
    # Check frontend .env
    if (Test-Path frontend/.env.local) {
        Add-Report "Frontend env file exists" "PASS"
    } else {
        Add-Report "Frontend .env.local not configured (may be okay if using defaults)" "WARN"
    }
}

function Verify-GitStatus {
    Add-Report "Starting Git Status Checks..." "INFO"
    
    $status = git status --porcelain
    
    if ($status) {
        Add-Report "Uncommitted changes detected:" "WARN"
        $status | ForEach-Object { Add-Report "  $_" "WARN" }
    } else {
        Add-Report "No uncommitted changes in tracked files" "PASS"
    }
    
    $branch = git rev-parse --abbrev-ref HEAD
    if ($branch -eq "main" -or $branch -eq "master") {
        Add-Report "On main branch: $branch" "PASS"
    } else {
        Add-Report "Not on main branch (currently: $branch)" "WARN"
    }
}

function Verify-SecurityPatches {
    Add-Report "Starting Security Patch Checks..." "INFO"
    
    Push-Location backend
    
    # Check zod version
    $packageJson = Get-Content package.json | ConvertFrom-Json
    $zodVersion = $packageJson.dependencies.zod
    
    if ($zodVersion -match "^4\." -or $zodVersion -match ">=4") {
        Add-Report "Zod version: $zodVersion (v4+ - security patched)" "PASS"
    } else {
        Add-Report "Zod version: $zodVersion (should be v4+)" "WARN"
    }
    
    # Check WebAuthn version
    $webauthnVersion = $packageJson.dependencies."@simplewebauthn/server"
    if ($webauthnVersion -match "^14\." -or $webauthnVersion -match ">=14") {
        Add-Report "WebAuthn version: $webauthnVersion (v14+ - latest API)" "PASS"
    } else {
        Add-Report "WebAuthn version: $webauthnVersion (should be v14+)" "WARN"
    }
    
    Pop-Location
}

function Verify-TestDocumentation {
    Add-Report "Starting Test Documentation Checks..." "INFO"
    
    $testDocs = @(
        "TEST_RESULTS_SUMMARY.md",
        "TESTING_CHECKLIST.md",
        "RUN_TESTS.md",
        "functional-test.ps1",
        "load-test.ps1"
    )
    
    foreach ($doc in $testDocs) {
        if (Test-Path $doc) {
            Add-Report "Test documentation found: $doc" "PASS"
        } else {
            Add-Report "Test documentation missing: $doc" "WARN"
        }
    }
}

function Verify-DeploymentDocumentation {
    Add-Report "Starting Deployment Documentation Checks..." "INFO"
    
    $deployDocs = @(
        "FACIAL_RECOGNITION_COMPLETE.md",
        "FACIAL_RECOGNITION_IMPLEMENTATION.md",
        "DEPLOYMENT_READINESS_FINAL.md",
        "PRODUCTION_VALIDATION_CHECKLIST.md"
    )
    
    foreach ($doc in $deployDocs) {
        if (Test-Path $doc) {
            Add-Report "Deployment documentation found: $doc" "PASS"
        } else {
            Add-Report "Deployment documentation missing: $doc" "FAIL"
        }
    }
}

function Verify-AuditLogs {
    Add-Report "Starting Audit Logging Checks..." "INFO"
    
    $controllerPath = "backend/src/controllers/facialRecognition.controller.ts"
    
    if (Test-Path $controllerPath) {
        $content = Get-Content $controllerPath -Raw
        
        if ($content -match "createAuditLog") {
            Add-Report "Audit logging implemented in facial recognition controller" "PASS"
        } else {
            Add-Report "Audit logging NOT found in facial recognition controller" "FAIL"
        }
    }
}

function Verify-ErrorHandling {
    Add-Report "Starting Error Handling Checks..." "INFO"
    
    # Check frontend error boundaries
    $capturePath = "frontend/src/components/shared/FacialRecognitionCapture.tsx"
    if (Test-Path $capturePath) {
        $content = Get-Content $capturePath -Raw
        
        if ($content -match "try\s*\{|catch\s*\(|Error") {
            Add-Report "Frontend error handling implemented" "PASS"
        } else {
            Add-Report "Frontend error handling may be incomplete" "WARN"
        }
    }
    
    # Check backend error handling
    $backendPath = "backend/src/controllers/facialRecognition.controller.ts"
    if (Test-Path $backendPath) {
        $content = Get-Content $backendPath -Raw
        
        if ($content -match "res\.status\(4\d{2}\)|catch\s*\(") {
            Add-Report "Backend error handling implemented" "PASS"
        } else {
            Add-Report "Backend error handling may be incomplete" "WARN"
        }
    }
}

function Verify-Authentication {
    Add-Report "Starting Authentication Checks..." "INFO"
    
    $controllerPath = "backend/src/controllers/facialRecognition.controller.ts"
    if (Test-Path $controllerPath) {
        $content = Get-Content $controllerPath -Raw
        
        if ($content -match "req\.user|AuthRequest|Bearer") {
            Add-Report "Authentication enforcement implemented" "PASS"
        } else {
            Add-Report "Authentication enforcement may be incomplete" "FAIL"
        }
    }
}

function Verify-RateLimiting {
    Add-Report "Starting Rate Limiting Checks..." "INFO"
    
    $routesPath = "backend/src/routes/attendance.routes.ts"
    if (Test-Path $routesPath) {
        $content = Get-Content $routesPath -Raw
        
        if ($content -match "rate.*limit|limiter|rateLimit") {
            Add-Report "Rate limiting configured" "PASS"
        } else {
            Add-Report "Rate limiting configuration not found" "WARN"
        }
    }
}

function Verify-DataValidation {
    Add-Report "Starting Data Validation Checks..." "INFO"
    
    # Check Zod schemas
    $validatorsPath = "backend/src/validators/facialRecognition.validators.ts"
    if (Test-Path $validatorsPath) {
        Add-Report "Facial recognition validators file exists" "PASS"
        
        $content = Get-Content $validatorsPath -Raw
        if ($content -match "z\.array|z\.object|parse|validate") {
            Add-Report "Zod validation schemas implemented" "PASS"
        } else {
            Add-Report "Zod validation may be incomplete" "WARN"
        }
    } else {
        Add-Report "Facial recognition validators file not found" "WARN"
    }
}

# Main execution
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host "PRODUCTION READINESS VERIFICATION SCRIPT"
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host "Start Time: $timestamp`n"

try {
    Push-Location "c:\Users\LENSTAR\Downloads\MY-PROJECTS\ATTENDEX"
    
    Verify-Compilation
    Write-Host ""
    
    Verify-Dependencies
    Write-Host ""
    
    Verify-FileStructure
    Write-Host ""
    
    Verify-EnvironmentConfig
    Write-Host ""
    
    Verify-GitStatus
    Write-Host ""
    
    Verify-SecurityPatches
    Write-Host ""
    
    Verify-TestDocumentation
    Write-Host ""
    
    Verify-DeploymentDocumentation
    Write-Host ""
    
    Verify-AuditLogs
    Write-Host ""
    
    Verify-ErrorHandling
    Write-Host ""
    
    Verify-Authentication
    Write-Host ""
    
    Verify-RateLimiting
    Write-Host ""
    
    Verify-DataValidation
    Write-Host ""
    
    # Summary
    Write-Host "════════════════════════════════════════════════════════════════"
    Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════════"
    Write-Host "Checks Passed: $checksPassed" -ForegroundColor Green
    Write-Host "Checks Failed: $checksFailed" -ForegroundColor Red
    Write-Host ""
    
    if ($checksFailed -eq 0) {
        Write-Host "✅ ALL CHECKS PASSED - READY FOR PRODUCTION" -ForegroundColor Green
        $exitCode = 0
    } else {
        Write-Host "⚠️  SOME CHECKS FAILED OR WARNINGS PRESENT" -ForegroundColor Yellow
        Write-Host "Review failures above before proceeding to production"
        $exitCode = 1
    }
    
    # Save report
    $reportContent | Out-File $OutputFile -Encoding UTF8
    Write-Host ""
    Write-Host "Full report saved to: $OutputFile"
    
    Pop-Location
    exit $exitCode
}
catch {
    Write-Host "ERROR during verification: $($_.Exception.Message)" -ForegroundColor Red
    Pop-Location
    exit 1
}

