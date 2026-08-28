function Resolve-PlatformPython {
    [CmdletBinding()]
    param(
        [string]$WorkspaceRoot
    )

    if ([string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
        $sourceRoot = Split-Path -Parent $PSScriptRoot
        $WorkspaceRoot = Split-Path -Parent $sourceRoot
    }
    $WorkspaceRoot = [IO.Path]::GetFullPath($WorkspaceRoot)

    $isWindowsPlatform = $PSVersionTable.PSEdition -eq 'Desktop'
    $isWindowsVariable = Get-Variable -Name IsWindows -ErrorAction SilentlyContinue
    if ($null -ne $isWindowsVariable) {
        $isWindowsPlatform = [bool]$isWindowsVariable.Value
    }

    $virtualEnvironment = [IO.Path]::Combine($WorkspaceRoot, 'local-runtime', 'dependencies', 'backend-venv')
    $workspaceCandidates = if ($isWindowsPlatform) {
        @(
            ([IO.Path]::Combine($virtualEnvironment, 'Scripts', 'python.exe')),
            ([IO.Path]::Combine($virtualEnvironment, 'bin', 'python3')),
            ([IO.Path]::Combine($virtualEnvironment, 'bin', 'python'))
        )
    } else {
        @(
            ([IO.Path]::Combine($virtualEnvironment, 'bin', 'python3')),
            ([IO.Path]::Combine($virtualEnvironment, 'bin', 'python')),
            ([IO.Path]::Combine($virtualEnvironment, 'Scripts', 'python.exe'))
        )
    }

    $candidates = [Collections.Generic.List[string]]::new()
    if (-not [string]::IsNullOrWhiteSpace($env:PLATFORM_PYTHON)) {
        $candidates.Add($env:PLATFORM_PYTHON.Trim())
    }
    foreach ($candidate in $workspaceCandidates) {
        $candidates.Add($candidate)
    }
    foreach ($commandName in $(if ($isWindowsPlatform) { @('python.exe', 'python') } else { @('python3', 'python') })) {
        $command = Get-Command -Name $commandName -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
            $candidates.Add($command.Source)
        }
    }

    foreach ($candidate in $candidates) {
        $resolvedCandidate = $null
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $resolvedCandidate = (Resolve-Path -LiteralPath $candidate).Path
        } else {
            $command = Get-Command -Name $candidate -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($null -ne $command -and (Test-Path -LiteralPath $command.Source -PathType Leaf)) {
                $resolvedCandidate = (Resolve-Path -LiteralPath $command.Source).Path
            }
        }
        if ([string]::IsNullOrWhiteSpace($resolvedCandidate)) {
            continue
        }

        try {
            & $resolvedCandidate -c 'import sys; raise SystemExit(0 if sys.executable else 1)' 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                return $resolvedCandidate
            }
        } catch {
            continue
        }
    }

    throw "No executable Python runtime was found. Configure PLATFORM_PYTHON or install the workspace runtime under '$virtualEnvironment'."
}
