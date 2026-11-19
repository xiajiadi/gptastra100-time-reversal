# Draw and encode seven 30 fps segments, then mux the continuous soundtrack.
param(
    [ValidateSet(1920, 3840)][int]$W = 3840,
    [ValidateRange(1024, 65535)][int]$Port = 8766,
    [string]$Python = 'python'
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$tools = Join-Path $root 'tools'
$out = Join-Path $root 'out'
$null = New-Item -ItemType Directory -Path $out -Force
$windowsPs = Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
$uri = "http://localhost:$Port/index.html"
$wav = Join-Path $out 'audio.wav'
$aac = Join-Path $out 'audio.aac'
$dest = Join-Path $out "GPTAstra100_$($W)x$($W * 9 / 16).mp4"

function Run-Step([string]$Label, [scriptblock]$Action) {
    Write-Host $Label
    & $Action
    if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

& $Python -c 'import av'
if ($LASTEXITCODE -ne 0) { throw 'Install requirements.txt in a Python virtual environment and use -Python to select it.' }

$listener = [Net.Sockets.TcpClient]::new()
try { $listener.Connect('localhost', $Port) } catch [Net.Sockets.SocketException] { }
$busy = $listener.Connected
$listener.Dispose()
if ($busy) { throw "Port $Port is already in use. Choose another port with -Port." }

$serverScript = Join-Path $tools 'server.ps1'
$server = Start-Process -FilePath $windowsPs -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $serverScript), '-Port', $Port
) -WindowStyle Hidden -PassThru
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $ready = (Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200
            if ($ready) { break }
        } catch { Start-Sleep -Milliseconds 350 }
        if ($server.HasExited) { break }
    }
    if (-not $ready) { throw "Render server did not start on $uri" }

    foreach ($file in @($wav, $aac)) {
        if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
    }

    Run-Step 'Synthesizing soundtrack' {
        & $windowsPs -NoProfile -ExecutionPolicy Bypass -File "$tools/run-page.ps1" -Path 'index.html?audio=1' -Done 'AUDIO DONE' -Port $Port
    }
    Run-Step 'Encoding AAC' {
        & $windowsPs -NoProfile -ExecutionPolicy Bypass -File "$tools/make-aac.ps1"
    }
    if (-not (Test-Path -LiteralPath $aac) -or (Get-Item -LiteralPath $aac).Length -eq 0) {
        throw 'AAC encoding produced no audio'
    }

    $cuts = @(0, 36, 57, 81, 118, 153, 184, 210)
    $bitrate = if ($W -eq 3840) { 14000000 } else { 7000000 }
    for ($part = 0; $part -lt $cuts.Count - 1; $part++) {
        $partName = 'out/part-{0:D2}.mp4' -f $part
        Run-Step "Rendering $partName" {
            & $windowsPs -NoProfile -ExecutionPolicy Bypass -File "$tools/render.ps1" -W $W -Br $bitrate -From $cuts[$part] -To $cuts[$part+1] -Out $partName -Port $Port -NoAudio
        }
    }
    Run-Step 'Muxing final MP4' {
        & $Python "$tools/mux.py" --width $W --output $dest
    }
    Write-Host "Wrote $dest"
} finally {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id -ErrorAction SilentlyContinue }
}
