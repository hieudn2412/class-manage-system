@echo off
setlocal EnableExtensions
title Class Management - Development Launcher

cd /d "%~dp0"
set "PROJECT_ROOT=%CD%"

echo [1/3] Checking prerequisites...

where docker >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker was not found. Install Docker Desktop, then try again.
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo Docker Engine is not running. Starting Docker Desktop...

    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" (
        start "" "%LOCALAPPDATA%\Docker\Docker Desktop.exe"
    ) else (
        echo ERROR: Docker Desktop could not be found.
        pause
        exit /b 1
    )

    echo Waiting up to 120 seconds for Docker Engine...
    powershell -NoProfile -Command "$deadline = (Get-Date).AddSeconds(120); do { Start-Sleep -Seconds 2; & docker info *> $null; if ($LASTEXITCODE -eq 0) { exit 0 } } while ((Get-Date) -lt $deadline); exit 1"
    if errorlevel 1 (
        echo ERROR: Docker Engine did not become ready within 120 seconds.
        echo Finish starting Docker Desktop, then run this file again.
        pause
        exit /b 1
    )

    echo Docker Engine is ready.
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm was not found. Install Node.js 22 or newer, then try again.
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%\class-backend\mvnw.cmd" (
    echo ERROR: Backend Maven wrapper was not found.
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%\class-frontend\package.json" (
    echo ERROR: Frontend package.json was not found.
    pause
    exit /b 1
)

if exist "C:\Program Files\Java\jdk-17\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-17"
)

if defined JAVA_HOME (
    if not exist "%JAVA_HOME%\bin\java.exe" (
        echo ERROR: JAVA_HOME does not point to a valid Java installation: %JAVA_HOME%
        pause
        exit /b 1
    )
) else (
    where java >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Java was not found. Install Java 17 or set JAVA_HOME, then try again.
        pause
        exit /b 1
    )
)

powershell -NoProfile -Command "$java = Join-Path $env:JAVA_HOME 'bin\java.exe'; if (-not (Test-Path $java)) { $java = 'java' }; $version = & $java -version 2>&1 | Select-Object -First 1; if ($version -match '\d+') { if ([int]$Matches[0] -ge 17) { exit 0 } }; exit 1"
if errorlevel 1 (
    echo ERROR: Backend requires Java 17 or newer.
    echo Current JAVA_HOME: %JAVA_HOME%
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%\class-frontend\node_modules" (
    echo Frontend dependencies are missing. Running npm install...
    pushd "%PROJECT_ROOT%\class-frontend"
    call npm install
    if errorlevel 1 (
        popd
        echo ERROR: Could not install frontend dependencies.
        pause
        exit /b 1
    )
    popd
)

echo [2/3] Starting PostgreSQL...
docker compose -f "%PROJECT_ROOT%\class-backend\docker-compose.yml" up -d --wait --wait-timeout 60 postgres
if errorlevel 1 (
    echo ERROR: PostgreSQL could not be started or did not become healthy.
    pause
    exit /b 1
)

echo [3/3] Starting backend and frontend...

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
    start "Class Management - Backend" /D "%PROJECT_ROOT%\class-backend" cmd /k "call mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev"
) else (
    echo Backend port 8080 is already in use; a new backend was not started.
)

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
    start "Class Management - Frontend" /D "%PROJECT_ROOT%\class-frontend" cmd /k "npm run dev"
) else (
    echo Frontend port 4173 is already in use; a new frontend was not started.
)

echo.
echo Development services have been launched.
echo Frontend: http://localhost:4173
echo Backend:  http://localhost:8080
echo.
echo Close the Backend or Frontend terminal window to stop that service.
timeout /t 3 /nobreak >nul
start "" "http://localhost:4173"

endlocal
exit /b 0
