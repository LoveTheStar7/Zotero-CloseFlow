$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root "src"
$dist = Join-Path $root "dist"
$package = Join-Path $dist "closeflow-1.0.0.xpi"
$zipPackage = Join-Path $dist "closeflow-1.0.0.zip"
$packageFiles = @(
    (Join-Path $src "manifest.json"),
    (Join-Path $src "bootstrap.js"),
    (Join-Path $src "prefs.js"),
    (Join-Path $src "prefs.xhtml"),
    (Join-Path $src "icon.svg"),
    (Join-Path $src "icon32.png"),
    (Join-Path $src "icon48.png"),
    (Join-Path $src "icon96.png")
)

if (Test-Path $dist) {
    Remove-Item -LiteralPath $dist -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $dist | Out-Null

Compress-Archive -Path $packageFiles -DestinationPath $zipPackage -Force
Move-Item -LiteralPath $zipPackage -Destination $package -Force

Write-Host "Built $package"
