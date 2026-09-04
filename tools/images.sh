#!/bin/bash
# Fernrow image pipeline.
# Downloads source photography, applies one consistent house grade, crops to fixed
# ratios, then encodes AVIF + WebP at responsive widths.
#
#   usage: bash tools/images.sh
#
# Source photography: Unsplash (Unsplash License — free for commercial use).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/img"
SRC="/tmp/fw/hires"
mkdir -p "$OUT" "$SRC"

# House grade: gentle warm shift, deep-but-open shadows, slightly muted colour.
GRADE="colortemperature=temperature=5450:mix=0.72:pl=0.05,eq=contrast=1.055:saturation=0.94:gamma=0.99,unsharp=3:3:0.35"

# name | unsplash photo id | aspect w:h | widths
SPEC='
hero|photo-1555507036-ab1f4038808a|3:2|640 768 1024 1280 1600 2200
loaf|photo-1549931319-a545dcf3bc73|21:9|800 1400 2000
room|photo-1600093463592-8e36ae95ef56|4:3|600 1000 1400
visit|photo-1445116572660-236099ec97a0|3:2|600 1000 1400
g-espresso|photo-1559496417-e7f25cb247f3|4:5|400 700 1000
g-cookies|photo-1499636136210-6f4ee915583e|4:5|400 700 1000
g-toast|photo-1525351484163-7529414344d8|4:5|400 700 1000
g-latte|photo-1541167760496-1628856ab772|4:5|400 700 1000
g-rolls|photo-1608198093002-ad4e005484ec|4:5|400 700 1000
g-matcha|photo-1515823064-d6e0c04616a7|4:5|400 700 1000
g-counter|photo-1453614512568-c4024d13c247|4:5|400 700 1000
g-case|photo-1534432182912-63863115e106|4:5|400 700 1000
'

echo "name,id,ratio,widths" > "$ROOT/assets/img/CREDITS.csv"

echo "$SPEC" | while IFS='|' read -r name id ratio widths; do
  [ -z "${name:-}" ] && continue
  src="$SRC/$name.jpg"
  if [ ! -s "$src" ]; then
    code=$(curl -sS -o "$src" -w '%{http_code}' --max-time 60 \
      "https://images.unsplash.com/$id?w=2400&q=85&fm=jpg&fit=max")
    [ "$code" = "200" ] || { echo "!! $name download failed ($code)"; continue; }
  fi
  aw=${ratio%%:*}; ah=${ratio##*:}
  echo "$name,$id,$ratio,\"$widths\"" >> "$ROOT/assets/img/CREDITS.csv"
  for w in $widths; do
    h=$(( w * ah / aw )); h=$(( h - h % 2 ))
    vf="scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},$GRADE"
    ffmpeg -nostdin -y -hide_banner -loglevel error -i "$src" -vf "$vf" \
      -c:v libaom-av1 -still-picture 1 -crf 34 -cpu-used 6 -pix_fmt yuv420p "$OUT/$name-$w.avif"
    ffmpeg -nostdin -y -hide_banner -loglevel error -i "$src" -vf "$vf" \
      -c:v libwebp -quality 74 -compression_level 6 "$OUT/$name-$w.webp"
    printf '  %-12s %5s  avif %6s  webp %6s\n' "$name" "${w}w" \
      "$(stat -c%s "$OUT/$name-$w.avif")" "$(stat -c%s "$OUT/$name-$w.webp")"
  done
  # tiny blurred placeholder, inlined as a data URI in CSS/HTML where useful
  ffmpeg -nostdin -y -hide_banner -loglevel error -i "$src" \
    -vf "scale=20:-2,$GRADE" -c:v libwebp -quality 30 "$OUT/$name-lqip.webp"
done
echo "done. total: $(du -sh "$OUT" | cut -f1)"
