param(
  [string]$ChromePath = "",
  [string]$PnpmPath = "C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
)

$ErrorActionPreference = "Stop"
$workspace = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourceDir = Join-Path $workspace "docs\flows\sources"
$svgDir = Join-Path $workspace "docs\flows\rendered\svg"
$pngDir = Join-Path $workspace "docs\flows\rendered\png"

if ([string]::IsNullOrWhiteSpace($ChromePath)) {
  $playwrightRoot = Join-Path $env:LOCALAPPDATA "ms-playwright"
  $chromeCandidate = Get-ChildItem -LiteralPath $playwrightRoot -Recurse -Filter "chrome.exe" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "chromium-\d+\\chrome-win64\\chrome\.exe$" } |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($null -eq $chromeCandidate) {
    throw "Không tìm thấy Chromium. Chạy Playwright install chromium hoặc truyền -ChromePath."
  }
  $ChromePath = $chromeCandidate.FullName
}

if (-not (Test-Path -LiteralPath $ChromePath)) {
  throw "ChromePath không tồn tại: $ChromePath"
}
if (-not (Test-Path -LiteralPath $PnpmPath)) {
  throw "PnpmPath không tồn tại: $PnpmPath"
}

New-Item -ItemType Directory -Force -Path $svgDir, $pngDir | Out-Null
$configPath = Join-Path ([System.IO.Path]::GetTempPath()) "edu-ops-mermaid-puppeteer-$PID.json"

try {
  @{
    executablePath = $ChromePath
    args = @("--no-sandbox", "--disable-setuid-sandbox")
  } | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8

  Get-ChildItem -LiteralPath $sourceDir -Filter "*.mmd" | Sort-Object Name | ForEach-Object {
    $base = $_.BaseName
    & $PnpmPath dlx "@mermaid-js/mermaid-cli@11.12.0" -p $configPath -i $_.FullName -o (Join-Path $svgDir "$base.svg") -t neutral -b transparent
    if ($LASTEXITCODE -ne 0) { throw "SVG render failed: $base" }

    & $PnpmPath dlx "@mermaid-js/mermaid-cli@11.12.0" -p $configPath -i $_.FullName -o (Join-Path $pngDir "$base.png") -t neutral -b white -w 1800 -s 1.5
    if ($LASTEXITCODE -ne 0) { throw "PNG render failed: $base" }
  }
}
finally {
  if (Test-Path -LiteralPath $configPath) {
    Remove-Item -LiteralPath $configPath -Force
  }
}

Write-Host "Rendered 14 Mermaid sources to SVG and PNG."

