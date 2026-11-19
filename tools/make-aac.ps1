# Transcode out/audio.wav to ADTS AAC (out/audio.aac) with the encoder built into Windows (WinRT MediaTranscoder).
# No third-party tools needed. ASCII only (PS 5.1 reads BOM-less scripts as ANSI).
param([string]$Root = '', [string]$In = 'out\audio.wav', [string]$Name = 'audio.aac')
if (-not $Root) { $Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path) }
$in = Join-Path $Root $In
$outDir = Join-Path $Root 'out'
New-Item -ItemType Directory -Force $outDir | Out-Null

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$ext = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 }
$asOp = $ext | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$asActP = $ext | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1' } | Select-Object -First 1
function Await($op, $type) { $t = $asOp.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Transcoding.MediaTranscoder, Windows.Media.Transcoding, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media.MediaProperties, ContentType = WindowsRuntime] | Out-Null

$src = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($in)) ([Windows.Storage.StorageFile])
$folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($outDir)) ([Windows.Storage.StorageFolder])
$dst = Await ($folder.CreateFileAsync($Name, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
$profile = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateM4a([Windows.Media.MediaProperties.AudioEncodingQuality]::High)
$profile.Container.Subtype = 'ADTS'
$profile.Audio.SampleRate = 48000
$profile.Audio.Bitrate = 256000
$tr = New-Object Windows.Media.Transcoding.MediaTranscoder
$tr.AlwaysReencode = $true
$prep = Await ($tr.PrepareFileTranscodeAsync($src, $dst, $profile)) ([Windows.Media.Transcoding.PrepareTranscodeResult])
if (-not $prep.CanTranscode) { "CANNOT TRANSCODE: $($prep.FailureReason)"; exit 1 }
$sw = [Diagnostics.Stopwatch]::StartNew()
$task = $asActP.MakeGenericMethod([double]).Invoke($null, @($prep.TranscodeAsync()))
try { $task.Wait(-1) | Out-Null } catch { "WAIT ERROR after $($sw.Elapsed.TotalSeconds)s: " + $_.Exception.InnerException.InnerException.Message }
$f = Get-Item -LiteralPath (Join-Path $outDir $Name)
"OK $Name $($f.Length) bytes in $($sw.Elapsed.TotalSeconds)s; audio: $($profile.Audio.Subtype) $($profile.Audio.Bitrate)bps $($profile.Audio.SampleRate)Hz x$($profile.Audio.ChannelCount)"
