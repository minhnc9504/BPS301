param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $InputPath).ProviderPath
$target = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
if ([IO.Path]::GetExtension($source) -ne '.pptx' -or [IO.Path]::GetExtension($target) -ne '.pdf') {
    throw 'Expected a .pptx input and .pdf output.'
}
if (Test-Path -LiteralPath $target) { throw 'The output PDF already exists.' }
if (-not (Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($target)) -PathType Container)) {
    throw 'Output directory does not exist.'
}
if (-not [type]::GetTypeFromProgID('PowerPoint.Application')) {
    throw 'PowerPoint COM is unavailable. Export the presentation as PDF locally using PowerPoint or LibreOffice Impress.'
}

$existingPowerPoint = Get-Process -Name POWERPNT -ErrorAction SilentlyContinue
$powerPoint = $null
$presentation = $null
try {
    $powerPoint = New-Object -ComObject PowerPoint.Application
    $presentation = $powerPoint.Presentations.Open($source, -1, 0, 0)
    $presentation.SaveAs($target, 32)
    Write-Output $target
} finally {
    if ($presentation) {
        try { $presentation.Close() }
        finally { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($presentation) }
    }
    if ($powerPoint) {
        try {
            if (-not $existingPowerPoint -and $powerPoint.Presentations.Count -eq 0) { $powerPoint.Quit() }
        } finally { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($powerPoint) }
    }
}
