$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$nodePath = 'C:\Program Files\nodejs'
$nodeExe = Join-Path $nodePath 'node.exe'
$npxCmd = Join-Path $nodePath 'npx.cmd'

if (Test-Path $nodePath) {
  if ($env:Path -notlike "*$nodePath*") {
    $env:Path = "$nodePath;$env:Path"
  }
}

if (!(Get-Command node -ErrorAction SilentlyContinue) -and !(Test-Path $nodeExe)) {
  throw 'Node.js no esta disponible. Instala Node o revisa C:\Program Files\nodejs.'
}

Set-Location $projectRoot

if (Test-Path $npxCmd) {
  & $npxCmd expo start -c
} else {
  npx expo start -c
}
