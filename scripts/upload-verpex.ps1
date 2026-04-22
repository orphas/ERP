param(
    [Parameter(Mandatory = $true)]
    [string]$HostName,

    [Parameter(Mandatory = $true)]
    [string]$Username,

    [Parameter(Mandatory = $true)]
    [string]$Password,

    [Parameter(Mandatory = $true)]
    [string]$RemoteRoot,

    [string]$LocalRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

$itemsToUpload = @(
    ".env",
    ".next",
    "app",
    "components",
    "lib",
    "middleware.ts",
    "next-env.d.ts",
    "next.config.ts",
    "package.json",
    "postcss.config.js",
    "prisma",
    "public",
    "server.js",
    "static",
    "tailwind.config.ts",
    "tsconfig.json"
)

$skipSegments = @(
    ".git",
    ".next-dev",
    ".venv",
    "node_modules",
    "playwright-report",
    "test-results",
    "tests"
)

$credential = New-Object System.Net.NetworkCredential($Username, $Password)

function Get-FtpUri {
    param([string]$RemotePath)

    $normalizedRemotePath = $RemotePath -replace "\\", "/"
    return "ftp://$HostName$normalizedRemotePath"
}

function Invoke-FtpRequest {
    param(
        [string]$Method,
        [string]$RemotePath,
        [string]$LocalFile
    )

    $request = [System.Net.FtpWebRequest]::Create((Get-FtpUri -RemotePath $RemotePath))
    $request.Credentials = $credential
    $request.Method = $Method
    $request.EnableSsl = $true
    $request.UseBinary = $true
    $request.UsePassive = $true
    $request.KeepAlive = $false
    $request.Proxy = $null

    if ($LocalFile) {
        $bytes = [System.IO.File]::ReadAllBytes($LocalFile)
        $request.ContentLength = $bytes.Length
        $requestStream = $request.GetRequestStream()
        try {
            $requestStream.Write($bytes, 0, $bytes.Length)
        }
        finally {
            $requestStream.Dispose()
        }
    }

    $response = $request.GetResponse()
    try {
        return $response.StatusDescription
    }
    finally {
        $response.Dispose()
    }
}

function Ensure-RemoteDirectory {
    param([string]$RemoteDirectory)

    $trimmed = $RemoteDirectory.TrimEnd("/")
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        return
    }

    $segments = $trimmed.TrimStart("/").Split("/", [System.StringSplitOptions]::RemoveEmptyEntries)
    $current = ""

    foreach ($segment in $segments) {
        $current += "/$segment"
        try {
            Invoke-FtpRequest -Method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory) -RemotePath $current | Out-Null
        }
        catch {
            $message = $_.Exception.Message
            if ($message -notmatch "550" -and $message -notmatch "exists") {
                throw
            }
        }
    }
}

function Should-SkipPath {
    param([string]$RelativePath)

    $normalizedPath = (($RelativePath -replace "\\", "/") -replace "/+", "/")

    if ($normalizedPath.StartsWith(".next/cache/")) {
        return $true
    }

    if ($normalizedPath -eq ".next/trace") {
        return $true
    }

    $segments = $normalizedPath.Split("/", [System.StringSplitOptions]::RemoveEmptyEntries)
    foreach ($segment in $segments) {
        if ($skipSegments -contains $segment) {
            return $true
        }
    }

    return $false
}

function Get-RelativeFilePath {
    param(
        [string]$RootPath,
        [string]$TargetPath
    )

    $root = [System.IO.Path]::GetFullPath($RootPath)
    if (-not $root.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $root += [System.IO.Path]::DirectorySeparatorChar
    }

    $rootUri = New-Object System.Uri($root)
    $targetUri = New-Object System.Uri([System.IO.Path]::GetFullPath($TargetPath))
    return [System.Uri]::UnescapeDataString($rootUri.MakeRelativeUri($targetUri).ToString()) -replace "/", "\\"
}

function Upload-File {
    param(
        [string]$LocalFile,
        [string]$RelativePath
    )

    $normalizedRelativePath = (($RelativePath -replace "\\", "/") -replace "/+", "/")
    $remoteFilePath = "$RemoteRoot/$normalizedRelativePath" -replace "//+", "/"
    $remoteDirectory = Split-Path $remoteFilePath -Parent

    Ensure-RemoteDirectory -RemoteDirectory $remoteDirectory
    Invoke-FtpRequest -Method ([System.Net.WebRequestMethods+Ftp]::UploadFile) -RemotePath $remoteFilePath -LocalFile $LocalFile | Out-Null
    Write-Host "Uploaded $normalizedRelativePath"
}

foreach ($item in $itemsToUpload) {
    $localPath = Join-Path $LocalRoot $item

    if (-not (Test-Path $localPath)) {
        continue
    }

    $entry = Get-Item $localPath

    if ($entry.PSIsContainer) {
        $files = Get-ChildItem $localPath -File -Recurse
        foreach ($file in $files) {
            $relativePath = Get-RelativeFilePath -RootPath $LocalRoot -TargetPath $file.FullName
            if (Should-SkipPath -RelativePath $relativePath) {
                continue
            }

            Upload-File -LocalFile $file.FullName -RelativePath $relativePath
        }
    }
    else {
        $relativePath = Get-RelativeFilePath -RootPath $LocalRoot -TargetPath $entry.FullName
        if (Should-SkipPath -RelativePath $relativePath) {
            continue
        }

        Upload-File -LocalFile $entry.FullName -RelativePath $relativePath
    }
}