# Serves the mirrored site locally so root-relative links (/kontakt, /_astro-...) work correctly.
param(
    [string]$SiteDir = "$PSScriptRoot\site",
    [int]$Port = 8080
)

$mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".txt"  = "text/plain"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $SiteDir at http://localhost:$Port/  (Ctrl+C to stop)"
Start-Process "http://localhost:$Port/"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response
        try {
            $localPath = $req.Url.AbsolutePath.TrimStart("/")
            if ($localPath -eq "") { $localPath = "index.html" }
            $filePath = Join-Path $SiteDir $localPath

            if (Test-Path $filePath -PathType Container) {
                $filePath = Join-Path $filePath "index.html"
            }
            if (-not (Test-Path $filePath -PathType Leaf)) {
                $altPath = "$filePath.html"
                if (Test-Path $altPath -PathType Leaf) { $filePath = $altPath }
            }

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = $mimeMap[$ext]
                if (-not $contentType) { $contentType = "application/octet-stream" }
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $res.ContentType = $contentType
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $localPath")
                $res.OutputStream.Write($msg, 0, $msg.Length)
            }
        } catch {
            $res.StatusCode = 500
        } finally {
            $res.OutputStream.Close()
        }
    }
} finally {
    $listener.Stop()
}
