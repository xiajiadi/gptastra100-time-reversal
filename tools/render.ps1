# Offline render: headless Edge renders index.html?render=1 frame by frame, streams H.264 to out/body.bin + out/head.bin,
# then this script joins them into the final MP4. Requires tools/server.ps1 running (port 8766) and out/audio.aac. ASCII only.
#   powershell -ExecutionPolicy Bypass -File tools\render.ps1 -W 1920 -Out "GPTAstra100_1080p.mp4"
#   (make-video.ps1 in the project root does server + audio + render in one go)
param([int]$W = 1920, [double]$From = 0, [double]$To = 0, [string]$Out = 'GPTAstra100.mp4', [int]$Br = 0, [int]$TimeoutSec = 7200, [int]$Port = 8766, [switch]$NoAudio, [string]$Page = "index.html")
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$q = "${Page}?render=1&w=$W"
if ($To -gt 0) { $q += "&from=$($From.ToString([Globalization.CultureInfo]::InvariantCulture))&to=$($To.ToString([Globalization.CultureInfo]::InvariantCulture))" }
if ($Br -gt 0) { $q += "&br=$Br" }
if ($NoAudio) { $q += "&noaudio=1" }
$body = Join-Path $root 'out\body.bin'; $head = Join-Path $root 'out\head.bin'
foreach ($f in @($body, $head)) { if (Test-Path -LiteralPath $f) { Remove-Item -LiteralPath $f -Force } }
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'tools\run-page.ps1') -Path $q -TimeoutSec $TimeoutSec -Done 'RENDER DONE' -Fail 'RENDER ERR|INIT ERR' -Port $Port
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not ((Test-Path -LiteralPath $head) -and (Test-Path -LiteralPath $body))) { 'NO OUTPUT'; exit 1 }
$dst = Join-Path $root $Out
$fs = [IO.File]::Create($dst)
try { foreach ($f in @($head, $body)) { $in = [IO.File]::OpenRead($f); try { $in.CopyTo($fs, 8MB) } finally { $in.Close() } } } finally { $fs.Close() }
Remove-Item -LiteralPath $head, $body -Force
$len = (Get-Item -LiteralPath $dst).Length
"WROTE $dst  $([math]::Round($len / 1MB, 1)) MB"
