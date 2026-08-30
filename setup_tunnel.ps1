# setup_tunnel.ps1
# Automates the creation and configuration of a locally managed Cloudflare Tunnel for hcvalue.xyz

$domain = "hcvalue.xyz"
$tunnelName = "hcvalue-tunnel"
$localPort = 8000
$cfDir = Join-Path $env:USERPROFILE ".cloudflared"
$certPath = Join-Path $cfDir "cert.pem"

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "     Cloudflare Tunnel Local Setup for $domain" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check if cloudflared is installed
$cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflaredCmd) {
    Write-Host "[ERROR] cloudflared is not installed or not in your PATH." -ForegroundColor Red
    Write-Host "Please install it using: winget install Cloudflare.cloudflared" -ForegroundColor Yellow
    Exit 1
}

Write-Host "[*] Found cloudflared at: $($cloudflaredCmd.Source)" -ForegroundColor Green

# 2. Check for login cert
if (-not (Test-Path $certPath)) {
    Write-Host "[*] No active Cloudflare login certificate found." -ForegroundColor Yellow
    Write-Host "Please login to Cloudflare in the browser that opens now." -ForegroundColor Cyan
    Write-Host "Make sure to select and authorize the domain '$domain'." -ForegroundColor Cyan
    Write-Host ""
    
    # Run login (this will block until authorized in browser)
    cloudflared login
    
    if (-not (Test-Path $certPath)) {
        Write-Host "[ERROR] Login was not completed or cert.pem is missing. Setup failed." -ForegroundColor Red
        Exit 1
    }
} else {
    Write-Host "[*] Existing login certificate found at: $certPath" -ForegroundColor Green
}

# 3. Check if tunnel already exists or create it
Write-Host "[*] Checking for existing tunnels..." -ForegroundColor Cyan
$existingTunnels = (cloudflared tunnel list 2>&1) -join "`n"

$tunnelUuid = $null
if ($existingTunnels -match $tunnelName) {
    Write-Host "[*] Tunnel '$tunnelName' already exists." -ForegroundColor Green
    # Extract UUID of existing tunnel (36-character hex/dash format)
    if ($existingTunnels -match "([a-f0-9\-]{36})\s+$tunnelName") {
        $tunnelUuid = $Matches[1]
    }
} else {
    Write-Host "[*] Creating new tunnel '$tunnelName'..." -ForegroundColor Cyan
    $createOutput = (cloudflared tunnel create $tunnelName 2>&1) -join "`n"
    Write-Host $createOutput
    
    # Extract UUID from output (looks like: Created tunnel hcvalue-tunnel with id <UUID>)
    if ($createOutput -match "with id ([a-f0-9\-]{36})") {
        $tunnelUuid = $Matches[1]
    }
}

if (-not $tunnelUuid) {
    Write-Host "[ERROR] Could not retrieve or create Tunnel UUID. Please check your cloudflared installation." -ForegroundColor Red
    Exit 1
}

Write-Host "[*] Tunnel UUID: $tunnelUuid" -ForegroundColor Green

# 4. Create config.yml
$configPath = Join-Path $cfDir "config.yml"
$credentialsPath = Join-Path $cfDir "$tunnelUuid.json"

Write-Host "[*] Creating configuration file..." -ForegroundColor Cyan
$configContent = @"
tunnel: $tunnelUuid
credentials-file: $credentialsPath

ingress:
  - hostname: $domain
    service: http://localhost:$localPort
  - hostname: www.$domain
    service: http://localhost:$localPort
  - service: http_status:404
"@

Set-Content -Path $configPath -Value $configContent
# Also place a copy in the workspace for backup / reference
Set-Content -Path (Join-Path $PSScriptRoot "config.yml") -Value $configContent

Write-Host "[*] Configuration file successfully created at: $configPath" -ForegroundColor Green

# 5. Route DNS
Write-Host "[*] Routing DNS records for $domain to the tunnel..." -ForegroundColor Cyan
cloudflared tunnel route dns $tunnelName $domain
cloudflared tunnel route dns $tunnelName "www.$domain"

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "  Setup completed successfully!" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "You can now run your server using 'start_server.bat' and start the tunnel"
Write-Host "by running 'start_tunnel.bat' and selecting Option 1."
Write-Host ""
