$ErrorActionPreference = "Stop"

$workspace = Resolve-Path (Join-Path $PSScriptRoot "..")
$srsPath = Join-Path $workspace "docs\srs\SRS.md"
$registryPath = Join-Path $workspace "docs\flows\FLOW-REGISTRY.md"
$sourceDir = Join-Path $workspace "docs\flows\sources"
$svgDir = Join-Path $workspace "docs\flows\rendered\svg"
$pngDir = Join-Path $workspace "docs\flows\rendered\png"
$desktopDir = Join-Path $workspace "wireframes\screenshots\desktop"
$mobileDir = Join-Path $workspace "wireframes\screenshots\mobile"

$requiredFiles = @(
  (Join-Path $workspace "docs\README.md"),
  (Join-Path $workspace "docs\decisions\DECISION-LOG.md"),
  $srsPath,
  $registryPath,
  (Join-Path $workspace "wireframes\index.html"),
  (Join-Path $workspace "wireframes\assets\wireframes.css"),
  (Join-Path $workspace "wireframes\assets\wireframes.js")
)

$missing = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($missing.Count -gt 0) {
  throw "Missing required files: $($missing -join ', ')"
}

$sources = @(Get-ChildItem -LiteralPath $sourceDir -Filter "*.mmd")
$svgs = @(Get-ChildItem -LiteralPath $svgDir -Filter "*.svg")
$pngs = @(Get-ChildItem -LiteralPath $pngDir -Filter "*.png")
$desktop = @(Get-ChildItem -LiteralPath $desktopDir -Filter "*.png")
$mobile = @(Get-ChildItem -LiteralPath $mobileDir -Filter "*.png")

if ($sources.Count -ne 14 -or $svgs.Count -ne 14 -or $pngs.Count -ne 14) {
  throw "Flow artifact count mismatch: source=$($sources.Count), svg=$($svgs.Count), png=$($pngs.Count)"
}
if ($desktop.Count -ne 27 -or $mobile.Count -ne 13) {
  throw "Screenshot count mismatch: desktop=$($desktop.Count), mobile=$($mobile.Count)"
}

$registry = Get-Content -Raw -LiteralPath $registryPath
foreach ($source in $sources) {
  $base = $source.BaseName
  if ($registry -notmatch [regex]::Escape($base)) {
    throw "Flow registry does not reference $base"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $svgDir "$base.svg"))) {
    throw "Missing SVG for $base"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $pngDir "$base.png"))) {
    throw "Missing PNG for $base"
  }
}

$srs = Get-Content -Raw -LiteralPath $srsPath
$requirementIds = [regex]::Matches($srs, "(?m)^\| ((?:FR|NFR)-[A-Z]+-\d{3}) \|") | ForEach-Object { $_.Groups[1].Value }
$duplicateRequirementIds = @($requirementIds | Group-Object | Where-Object Count -gt 1)
if ($duplicateRequirementIds.Count -gt 0) {
  throw "Duplicate requirement IDs: $($duplicateRequirementIds.Name -join ', ')"
}

$requirementRows = [regex]::Matches($srs, "(?m)^\| ((?:FR|NFR)-[A-Z]+-\d{3}) \|(.+)$")
$rowsMissingAcceptance = @($requirementRows | Where-Object { $_.Value -notmatch "AC-" })
$rowsMissingFlow = @($requirementRows | Where-Object { $_.Value -notmatch "FL-" })
$rowsMissingWireframe = @($requirementRows | Where-Object { $_.Value -notmatch "WF-" })
if ($rowsMissingAcceptance.Count -gt 0) { throw "Requirement rows missing AC: $($rowsMissingAcceptance.Count)" }
if ($rowsMissingFlow.Count -gt 0) { throw "Requirement rows missing flow: $($rowsMissingFlow.Count)" }
if ($rowsMissingWireframe.Count -gt 0) { throw "Requirement rows missing wireframe: $($rowsMissingWireframe.Count)" }

[PSCustomObject]@{
  RequirementIds = $requirementIds.Count
  FlowSources = $sources.Count
  FlowSVG = $svgs.Count
  FlowPNG = $pngs.Count
  DesktopScreenshots = $desktop.Count
  MobileScreenshots = $mobile.Count
  Status = "PASS"
} | Format-List
