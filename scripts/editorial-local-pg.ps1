param([ValidateSet('start','stop','status')][string]$Action='status')
$ErrorActionPreference='Stop'
$base='D:\Documentos\Bitaria\HomologacaoEditorial'
$bin=Join-Path $base 'pg17\bin'
$data=Join-Path $base 'data'
$evidence=Join-Path $base 'evidencias'
if($Action -eq 'stop') { & "$bin\pg_ctl.exe" -D $data -m fast -w stop; if($LASTEXITCODE -ne 0){throw 'Falha no encerramento local'}; exit }
if($Action -eq 'status') { & "$bin\pg_ctl.exe" -D $data status; exit }
$os=Get-CimInstance Win32_OperatingSystem
if($os.FreePhysicalMemory -lt 2097152){throw 'Menos de 2 GiB livres: inicializacao recusada.'}
$existing=Get-CimInstance Win32_Process -Filter "Name='postgres.exe'"
if($existing){throw 'Existe PostgreSQL em execucao; revisar antes de iniciar.'}
if(Get-NetTCPConnection -LocalPort 55439 -ErrorAction SilentlyContinue){throw 'Porta 55439 ocupada.'}
& "$bin\postgres.exe" --version
if($LASTEXITCODE -ne 0){throw 'Binarios indisponiveis.'}
$secret=Join-Path $base 'secrets\initdb-password.txt'
$passfile=Join-Path $base 'secrets\pgpass-local.conf'
if(!(Test-Path (Join-Path $data 'PG_VERSION'))){
 $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
 $bytes=New-Object byte[] 32; $rng.GetBytes($bytes); $rng.Dispose()
 $password=[Convert]::ToBase64String($bytes)
 [IO.File]::WriteAllText($secret,$password,[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllText($passfile,"127.0.0.1:55439:*:postgres:$password",[Text.UTF8Encoding]::new($false))
 & "$bin\initdb.exe" -D $data -U postgres --encoding=UTF8 --locale=C --auth=scram-sha-256 --pwfile=$secret
 if($LASTEXITCODE -ne 0){throw 'Falha initdb local.'}
 $password=$null
}
$config=@"
listen_addresses = '127.0.0.1'
port = 55439
cluster_name = 'bitaria_editorial_homolog_local'
shared_buffers = '32MB'
work_mem = '1MB'
maintenance_work_mem = '32MB'
max_connections = 12
password_encryption = 'scram-sha-256'
fsync = on
full_page_writes = on
synchronous_commit = on
log_statement = 'none'
log_min_error_statement = 'panic'
"@
[IO.File]::WriteAllText((Join-Path $data 'postgresql.conf'),$config,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $data 'pg_hba.conf'),"host all all 127.0.0.1/32 scram-sha-256`n",[Text.UTF8Encoding]::new($false))
& "$bin\pg_ctl.exe" -D $data -l (Join-Path $base 'logs\postgres-local-20261117.log') -w start
if($LASTEXITCODE -ne 0){throw 'Falha no inicio local.'}
$env:PGPASSFILE=$passfile
$env:PGCLIENTENCODING='UTF8'
& "$bin\psql.exe" -X -w -h 127.0.0.1 -p 55439 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "select version(),inet_server_addr(),inet_server_port(),current_setting('data_directory'),current_setting('cluster_name');"
if($LASTEXITCODE -ne 0){throw 'Falha no isolamento local.'}
Get-NetTCPConnection -LocalPort 55439 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
[pscustomobject]@{date='2026-11-17';environment='LOCAL_SYNTHETIC_ONLY';freeMemoryKiB=$os.FreePhysicalMemory;totalMemoryKiB=$os.TotalVisibleMemorySize;port=55439;listen='127.0.0.1';productionAccess=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidence 'inicio-20261117.json') -Encoding UTF8
