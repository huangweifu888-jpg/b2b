[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Image,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^sha256:[0-9a-f]{64}$')]
    [string]$Digest,
    [Parameter(Mandatory = $true)]
    [string]$Predicate
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command cosign -ErrorAction SilentlyContinue)) {
    throw 'cosign is required for container attestation signing. Install it on the isolated release runner.'
}
if (-not (Test-Path -LiteralPath $Predicate)) {
    throw "Attestation predicate does not exist: $Predicate"
}

# Identity/key configuration is supplied by the release runner (for example
# keyless OIDC or COSIGN_KEY); it is never read from a source-controlled file.
& cosign attest --yes --predicate $Predicate --type cyclonedx "$Image@$Digest"
if ($LASTEXITCODE -ne 0) { throw "cosign attestation failed with exit code $LASTEXITCODE" }
Write-Output "Container attestation signed: $Image@$Digest"
