$ErrorActionPreference = 'Stop'

$source = 'E:/Desktop/作品整理'
$output = Join-Path $PSScriptRoot '../public/portfolio'
$temp = 'C:/codex-tmp/duan-portfolio-build'

$folders = @('commercial', 'brand', 'photography', 'ai', 'video', 'covers')
foreach ($folder in $folders) {
  New-Item -ItemType Directory -Force -Path (Join-Path $output $folder) | Out-Null
}
New-Item -ItemType Directory -Force -Path $temp | Out-Null

function Convert-WebImage {
  param([string]$InputPath, [string]$OutputPath, [string]$Filter = "scale='min(2400,iw)':-2")
  & ffmpeg -hide_banner -loglevel error -i $InputPath -vf $Filter -frames:v 1 -c:v libwebp -quality 84 -compression_level 4 -y $OutputPath
  if ($LASTEXITCODE -ne 0) { throw "Image conversion failed: $InputPath" }
}

function New-PreviewVideo {
  param([string[]]$InputPaths, [string]$OutputPath, [string]$PosterPath)
  $segments = @()
  $segmentIndex = 0
  foreach ($inputPath in $InputPaths) {
    $duration = [double](& ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 -- $inputPath)
    $positions = if ($InputPaths.Count -gt 1) { @(0.46) } else { @(0.14, 0.46, 0.78) }
    foreach ($position in $positions) {
      $segmentIndex++
      $start = [math]::Max(0, [math]::Min($duration - 4.2, $duration * $position))
      $segment = Join-Path $temp ("segment-{0:d3}.mp4" -f $segmentIndex)
      & ffmpeg -hide_banner -loglevel error -ss $start -i $inputPath -t 4.2 -an -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0xf3f3f3" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -r 30 -y $segment
      if ($LASTEXITCODE -ne 0) { throw "Video segment failed: $inputPath" }
      $segments += $segment
    }
  }
  $concatFile = Join-Path $temp 'concat.txt'
  ($segments | ForEach-Object { "file '$($_ -replace "'", "''")'" }) | Set-Content -LiteralPath $concatFile -Encoding ascii
  & ffmpeg -hide_banner -loglevel error -f concat -safe 0 -i $concatFile -c copy -movflags +faststart -y $OutputPath
  if ($LASTEXITCODE -ne 0) { throw "Video concat failed: $OutputPath" }
  & ffmpeg -hide_banner -loglevel error -ss 6 -i $OutputPath -frames:v 1 -c:v libwebp -quality 86 -y $PosterPath
  Remove-Item -LiteralPath $concatFile -Force -ErrorAction SilentlyContinue
  $segments | ForEach-Object { Remove-Item -LiteralPath $_ -Force -ErrorAction SilentlyContinue }
}

function New-SquareCover {
  param(
    [string]$InputPath,
    [string]$OutputPath,
    [string]$Filter = "scale=1200:1200:force_original_aspect_ratio=increase,crop=1200:1200:(iw-ow)/2:(ih-oh)/2"
  )
  & ffmpeg -hide_banner -loglevel error -i $InputPath -vf $Filter -frames:v 1 -c:v libwebp -quality 86 -y $OutputPath
  if ($LASTEXITCODE -ne 0) { throw "Cover conversion failed: $InputPath" }
}

function New-VideoCover {
  param([string]$InputPath, [string]$OutputPath, [int]$Frame, [string]$Filter)
  $coverFilter = "select=eq(n\,$Frame),$Filter"
  & ffmpeg -hide_banner -loglevel error -i $InputPath -vf $coverFilter -frames:v 1 -c:v libwebp -quality 88 -y $OutputPath
  if ($LASTEXITCODE -ne 0) { throw "Video cover conversion failed: $InputPath" }
}

# Brand and digital design
Convert-WebImage "$source/包装/0001.png" "$output/brand/grain-packaging.webp"
Convert-WebImage "$source/海报/0008.png" "$output/brand/sanfu-01.webp"
Convert-WebImage "$source/海报/0009.png" "$output/brand/sanfu-02.webp"
Convert-WebImage "$source/海报/0010.png" "$output/brand/sanfu-03.webp"
Convert-WebImage "$source/VI-IP/0002.png" "$output/brand/cultural-center-vi.webp"
Convert-WebImage "$source/VI-IP/0003.png" "$output/brand/ip-system.webp"
Convert-WebImage "$source/UI/0005.png" "$output/brand/ui-case-01.webp"
Convert-WebImage "$source/UI/0006.png" "$output/brand/ui-case-02.webp"
Convert-WebImage "$source/UI/0007.png" "$output/brand/ui-case-03.webp"
Convert-WebImage "$source/UI/展板3-1.png" "$output/brand/wellness-ui-01.webp"
Convert-WebImage "$source/UI/展板3-2.png" "$output/brand/wellness-ui-02.webp"
Convert-WebImage "$source/UI/展板3-3.png" "$output/brand/wellness-ui-03.webp"
New-SquareCover "$output/brand/sanfu-01.webp" "$output/covers/brand.webp" "crop=2200:2200:100:500,scale=1200:1200"

# Photography
Convert-WebImage "$source/摄影作品集/6f6445623bfc15962ced7e9899205516.jpg" "$output/photography/mountain.webp" "eq=brightness=0.025:contrast=1.06:saturation=0.92:gamma=1.04,scale='min(2400,iw)':-2"
Convert-WebImage "$source/摄影作品集/XLL_5674.jpg" "$output/photography/city.webp" "eq=contrast=1.04:saturation=0.94,scale='min(2400,iw)':-2"
Convert-WebImage "$source/摄影作品集/XLL_0604.jpg" "$output/photography/blossom.webp" "eq=contrast=1.02:saturation=0.92,scale='min(2400,iw)':-2"
Convert-WebImage "$source/摄影作品集/hxsy.jpg" "$output/photography/documentary.webp" "eq=contrast=1.04:saturation=0.9,scale='min(2400,iw)':-2"
New-SquareCover "$output/photography/mountain.webp" "$output/covers/photography.webp" "crop=ih:ih:(iw-ih)/2:0,scale=1200:1200"

# AI stills
Convert-WebImage "$source/AI生成/ChatGPT-敦煌千年之美海报.png" "$output/ai/dunhuang.webp"
Convert-WebImage "$source/AI生成/Gemini-人物半身像.png" "$output/ai/portrait-half.webp"
Convert-WebImage "$source/AI生成/Gemini-人物面部特写.png" "$output/ai/portrait-close.webp"

# Commercial previews
New-PreviewVideo @("$source/宣传片、纪录片/猫人线下快闪.mp4") "$output/commercial/maoren-pop-up.mp4" "$output/commercial/maoren-pop-up-poster.webp"
New-PreviewVideo @("$source/宣传片、纪录片/海尔.mov") "$output/commercial/haier-store.mp4" "$output/commercial/haier-store-poster.webp"
New-PreviewVideo @("$source/宣传片、纪录片/酒店宣传片.mp4") "$output/commercial/hotel-promo.mp4" "$output/commercial/hotel-promo-poster.webp"
New-PreviewVideo @("$source/广告视频-剪辑/猫眼-果果车厘子-兰子帅.MP4", "$source/广告视频-剪辑/猫眼-乔姐窝窝头（1）-兰子帅.MP4", "$source/广告视频-剪辑/猫眼-乔姐窝窝头（2）-兰子帅.MP4") "$output/commercial/retail-ads.mp4" "$output/commercial/retail-ads-poster.webp"
New-VideoCover "$output/commercial/maoren-pop-up.mp4" "$output/covers/commercial.webp" 300 "crop=720:720:280:0,scale=1200:1200"

# AI video previews
New-PreviewVideo @("$source/ai视频/ai短片预告.mp4") "$output/ai/ai-trailer.mp4" "$output/ai/ai-trailer-poster.webp"
New-PreviewVideo @("$source/ai视频/d3adfc03519bbe792ed48aa5f7f9d43f_raw.mp4") "$output/ai/fantasy-film.mp4" "$output/ai/fantasy-film-poster.webp"
New-VideoCover "$output/ai/fantasy-film.mp4" "$output/covers/ai.webp" 300 "crop=540:540:390:0,scale=1200:1200"

# Short-form and film previews
New-PreviewVideo @("$source/宣传片、纪录片/9月29日.mp4") "$output/video/atmospheric-documentary.mp4" "$output/video/atmospheric-documentary-poster.webp"
New-PreviewVideo @("$source/宣传片、纪录片/纪录片.m4v") "$output/video/food-documentary.mp4" "$output/video/food-documentary-poster.webp"
New-PreviewVideo @("$source/宣传片、纪录片/视频.m4v") "$output/video/narrative-film.mp4" "$output/video/narrative-film-poster.webp"
New-PreviewVideo @("$source/平面设计/中国建筑.mp4") "$output/video/china-architecture.mp4" "$output/video/china-architecture-poster.webp"
New-VideoCover "$output/video/narrative-film.mp4" "$output/covers/video.webp" 360 "crop=600:600:520:10,scale=1200:1200"

# Storyboard evidence
$storyTemp = Join-Path $temp 'storyboard'
New-Item -ItemType Directory -Force -Path $storyTemp | Out-Null
& pdftoppm -jpeg -f 1 -l 13 -r 130 "$source/宣传片、纪录片/武汉味道_分镜.pdf" (Join-Path $storyTemp 'page') | Out-Null
$storyPages = @(1, 5, 8, 10, 12)
for ($index = 0; $index -lt $storyPages.Count; $index++) {
  $page = $storyPages[$index]
  $sourcePage = Join-Path $storyTemp ("page-{0:d2}.jpg" -f $page)
  $destination = Join-Path $output 'video' ("wuhan-storyboard-{0:d2}.webp" -f ($index + 1))
  Convert-WebImage $sourcePage $destination "scale='min(1800,iw)':-2"
}

Write-Output "Portfolio assets created in $output"
