$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$compilado = Join-Path $raiz 'backend\target\services-vales.jar'
$directorio = Join-Path $raiz '.local\ejecucion-vscode'
$ejecutable = Join-Path $directorio 'services-vales.jar'
$archivoEnv = Join-Path $raiz '.env'
if (-not (Test-Path -LiteralPath $archivoEnv -PathType Leaf)) {
    if ((Test-Path -LiteralPath (Join-Path $raiz '.local\vales-db.properties')) -or
        (Test-Path -LiteralPath (Join-Path $raiz '.local\vales-https.properties'))) {
        throw 'Traslada la configuración anterior a .env. Consulta docs/base-datos-vales.md y docs/guia-proyecto.md.'
    }
    [IO.File]::Copy((Join-Path $raiz '.env.example'), $archivoEnv)
}

function Detener-Vales([string]$jar) {
    $ruta = '(?:^|[\s";])' + [regex]::Escape($jar) + '(?=$|[\s";])'
    $entrada = '(?:^|[\s"])org\.springframework\.boot\.loader\.launch\.JarLauncher(?=$|[\s"])'
    $procesos = Get-CimInstance Win32_Process -Filter "Name = 'java.exe' OR Name = 'javaw.exe'"
    foreach ($proceso in $procesos) {
        if (($proceso.CommandLine -replace '/', '\') -notmatch $ruta -or $proceso.CommandLine -notmatch $entrada) {
            continue
        }
        $instancia = Get-Process -Id $proceso.ProcessId -ErrorAction SilentlyContinue
        if (!$instancia -or [Math]::Abs(($instancia.StartTime - $proceso.CreationDate).TotalSeconds) -gt 1) {
            continue
        }
        Stop-Process -InputObject $instancia
        if (!$instancia.WaitForExit(10000)) {
            throw 'No se pudo detener Vales.'
        }
    }
}

# Las versiones anteriores arrancaban directamente desde el JAR de compilación.
Detener-Vales $compilado
$wrapper = Join-Path $raiz '.mvn\wrapper\maven-wrapper.jar'
& java "-Dmaven.multiModuleProjectDirectory=$raiz" -cp $wrapper org.apache.maven.wrapper.MavenWrapperMain -f backend/pom.xml clean package
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# La instancia activa usa una copia, así Maven puede compilar antes de reiniciarla.
Detener-Vales $ejecutable
New-Item -ItemType Directory -Force -Path $directorio | Out-Null
Copy-Item -LiteralPath $compilado -Destination $ejecutable -Force
