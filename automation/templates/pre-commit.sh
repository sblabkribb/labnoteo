#!/bin/sh
# labnoteo pre-commit hook — 대용량 파일이 Git에 커밋되는 것을 차단합니다.
# 활성화: git config core.hooksPath .githooks
#
# Node가 있으면 번들 스크립트(scripts/check-large-files.mjs)로 검사하고,
# 없으면 아래의 순수 shell 크기 검사(>50MB 차단)로 대체합니다. (F2: Node-free)

# 1) Node 경로: 정확한 임계값(10/50MB) 및 연구자 친화 메시지
if command -v node >/dev/null 2>&1 && [ -f scripts/check-large-files.mjs ]; then
  node scripts/check-large-files.mjs --staged
  exit $?
fi

# 2) Node-free 대체 경로: 스테이징된 파일 중 50MB 초과만 차단
LIMIT=$((50 * 1024 * 1024))
status=0
files=$(git diff --cached --name-only --diff-filter=ACM)
IFS='
'
for f in $files; do
  [ -f "$f" ] || continue
  size=$(wc -c < "$f" 2>/dev/null | tr -d ' ')
  [ -n "$size" ] || size=0
  if [ "$size" -gt "$LIMIT" ]; then
    echo "❌ 커밋 차단: $f ($((size / 1024 / 1024)) MB > 50 MB)"
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  echo ""
  echo "대용량 원시 데이터는 Git 대신 별도 스토리지(NAS/오브젝트 스토리지)에 보관하고"
  echo "연구노트에서 EXP-ID로 링크하세요."
fi

exit $status
