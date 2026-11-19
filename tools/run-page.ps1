# Open a page of this project in headless Edge (GPU on) and wait until render.log reports DONE / ERR. ASCII only.
#   powershell -ExecutionPolicy Bypass -File tools\run-page.ps1 -Path "index.html?shots=10,20"
param([string]$Path = 'index.html', [int]$TimeoutSec = 600, [string]$Done = 'DONE', [string]$Fail = 'ERR', [int]$Port = 8766)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$log = Join-Path $root 'tools\render.log'
$profileLeaf = "astra-edge-$Port"
$prof = Join-Path $root "out/$profileLeaf"
New-Item -ItemType Directory -Force $prof | Out-Null
if (Test-Path -LiteralPath $log) { Remove-Item -LiteralPath $log -Force }
$url = "http://localhost:$Port/" + $Path
# Find Edge: registry App Paths first, then the two default install locations
$edge = $null
foreach ($k in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe') {
    try { $v = (Get-ItemProperty -Path $k -ErrorAction Stop).'(default)'; if ($v -and (Test-Path $v)) { $edge = $v; break } } catch { }
}
foreach ($c in "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") { if (-not $edge -and (Test-Path $c)) { $edge = $c } }
if (-not $edge) { 'Microsoft Edge not found'; exit 1 }
$args2 = @('--headless=new', "--user-data-dir=`"$prof`"", '--no-first-run', '--disable-extensions', '--autoplay-policy=no-user-gesture-required',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-gpu-rasterization', '--force-gpu-mem-available-mb=8192',
  '--js-flags="--max-old-space-size=8192 --expose-gc"', '--window-size=1920,1080', "`"$url`"")
$p = Start-Process $edge -ArgumentList $args2 -PassThru
$sw = [Diagnostics.Stopwatch]::StartNew(); $state = 'TIMEOUT'
while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    Start-Sleep -Milliseconds 700
    if (Test-Path -LiteralPath $log) {
        $txt = Get-Content -LiteralPath $log -Raw -Encoding UTF8
        if ($txt -match $Done) { $state = 'DONE'; break }
        if ($txt -match $Fail) { $state = 'ERROR'; break }
    }
}
Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*$profileLeaf*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
"STATE: $state after $([int]$sw.Elapsed.TotalSeconds)s"
if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log -Encoding UTF8 | Select-Object -Last 40 }

if ($state -ne "DONE") { exit 1 }
