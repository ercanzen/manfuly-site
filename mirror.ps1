# Simple site mirror script for manfuly.ch
# Downloads all reachable pages/assets on the same domain into .\site

param(
    [string]$StartUrl = "https://www.manfuly.ch/",
    [string]$OutDir = "$PSScriptRoot\site",
    [int]$MaxPages = 300
)

Add-Type -AssemblyName System.Web

$allowedHosts = @("manfuly.ch", "www.manfuly.ch")
$visitedPages = New-Object System.Collections.Generic.HashSet[string]
$downloadedAssets = New-Object System.Collections.Generic.HashSet[string]
$pageQueue = New-Object System.Collections.Generic.Queue[string]
$pageQueue.Enqueue($StartUrl)

$headers = @{
    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
}

function Get-LocalPath {
    param([Uri]$Uri, [string]$OutDir)
    $path = $Uri.AbsolutePath
    if ($path -eq "" -or $path -eq "/") { $path = "/index.html" }
    elseif ($path.EndsWith("/")) { $path = $path + "index.html" }
    elseif (-not ([System.IO.Path]::GetFileName($path) -match "\.")) {
        $path = $path + "/index.html"
    }
    $path = $path.TrimStart("/")
    if ($allowedHosts -notcontains $Uri.Host) {
        $path = "_external\$($Uri.Host)\$path"
    }
    $path = $path -replace "/", [System.IO.Path]::DirectorySeparatorChar
    return (Join-Path $OutDir $path)
}

function Save-Content {
    param([string]$LocalPath, [byte[]]$Bytes)
    $dir = Split-Path $LocalPath -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllBytes($LocalPath, $Bytes)
}

function Get-RawBytes {
    param($Response)
    $stream = $Response.RawContentStream
    $stream.Position = 0
    $ms = New-Object System.IO.MemoryStream
    $stream.CopyTo($ms)
    return $ms.ToArray()
}

function Download-Asset {
    param([string]$Url)
    if ($downloadedAssets.Contains($Url)) { return }
    $downloadedAssets.Add($Url) | Out-Null
    try {
        $uri = [Uri]$Url
        $resp = Invoke-WebRequest -Uri $Url -Headers $headers -UseBasicParsing -TimeoutSec 30
        $bytes = Get-RawBytes -Response $resp
        $localPath = Get-LocalPath -Uri $uri -OutDir $OutDir
        Save-Content -LocalPath $localPath -Bytes $bytes
        Write-Host "Asset:  $Url"
        # If it's a CSS file, scan for further url(...) references
        if ($Url -match "\.css($|\?)") {
            $cssText = [System.Text.Encoding]::UTF8.GetString($bytes)
            $matches = [regex]::Matches($cssText, "url\(\s*['\""]?([^'\"")]+)['\""]?\s*\)")
            foreach ($m in $matches) {
                $ref = $m.Groups[1].Value
                if ($ref -match "^data:") { continue }
                try {
                    $absUrl = (New-Object Uri([Uri]$Url, $ref)).AbsoluteUri
                    Download-Asset -Url $absUrl
                } catch {}
            }
        }
    } catch {
        Write-Host "FAILED asset: $Url - $($_.Exception.Message)"
    }
}

$pageCount = 0
while ($pageQueue.Count -gt 0 -and $pageCount -lt $MaxPages) {
    $url = $pageQueue.Dequeue()
    $cleanUrl = $url -replace "#.*$", ""
    if ($visitedPages.Contains($cleanUrl)) { continue }
    $visitedPages.Add($cleanUrl) | Out-Null

    $uri = [Uri]$cleanUrl
    if ($allowedHosts -notcontains $uri.Host) { continue }

    try {
        $resp = Invoke-WebRequest -Uri $cleanUrl -Headers $headers -UseBasicParsing -TimeoutSec 30
    } catch {
        Write-Host "FAILED page: $cleanUrl - $($_.Exception.Message)"
        continue
    }

    $pageCount++
    $pageBytes = Get-RawBytes -Response $resp
    $localPath = Get-LocalPath -Uri $uri -OutDir $OutDir
    Save-Content -LocalPath $localPath -Bytes $pageBytes
    Write-Host "Page:   $cleanUrl -> $localPath"

    $html = [System.Text.Encoding]::UTF8.GetString($pageBytes)

    # Extract href/src/srcset attributes
    $attrMatches = [regex]::Matches($html, "(?:href|src)\s*=\s*[""']([^""']+)[""']")
    foreach ($m in $attrMatches) {
        $ref = $m.Groups[1].Value
        if ($ref -match "^(mailto:|tel:|javascript:|data:|#)") { continue }
        try {
            $absUri = New-Object Uri([Uri]$cleanUrl, $ref)
        } catch { continue }
        $absUrl = $absUri.AbsoluteUri

        $ext = [System.IO.Path]::GetExtension($absUri.AbsolutePath).ToLower()
        $pageExts = @("", ".html", ".htm", ".php")
        if (($allowedHosts -contains $absUri.Host) -and ($pageExts -contains $ext)) {
            if (-not $visitedPages.Contains($absUrl)) {
                $pageQueue.Enqueue($absUrl)
            }
        } else {
            Download-Asset -Url $absUrl
        }
    }

    # srcset
    $srcsetMatches = [regex]::Matches($html, "srcset\s*=\s*[""']([^""']+)[""']")
    foreach ($m in $srcsetMatches) {
        $parts = $m.Groups[1].Value -split ",\s+"
        foreach ($p in $parts) {
            $ref = ($p.Trim() -split "\s+")[0]
            if (-not $ref) { continue }
            try {
                $absUri = New-Object Uri([Uri]$cleanUrl, $ref)
                Download-Asset -Url $absUri.AbsoluteUri
            } catch {}
        }
    }

    # inline url(...) in <style> blocks
    $inlineCss = [regex]::Matches($html, "url\(\s*['\""]?([^'\"")]+)['\""]?\s*\)")
    foreach ($m in $inlineCss) {
        $ref = $m.Groups[1].Value
        if ($ref -match "^data:") { continue }
        try {
            $absUri = New-Object Uri([Uri]$cleanUrl, $ref)
            Download-Asset -Url $absUri.AbsoluteUri
        } catch {}
    }
}

Write-Host ""
Write-Host "Done. Pages: $($visitedPages.Count), Assets: $($downloadedAssets.Count)"
Write-Host "Output: $OutDir"
