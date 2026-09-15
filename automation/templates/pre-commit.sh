#!/bin/sh
# labnoteo pre-commit hook — 대용량 파일 차단 + 노트 검증 경고.
# 활성화: git config core.hooksPath .labnoteo/hooks
#
# Node가 있으면 번들 스크립트(.labnoteo/scripts/check-large-files.mjs)로 검사하고,
# 없으면 아래의 순수 shell 크기 검사(>50MB 차단)로 대체합니다. (F2: Node-free)

# 1) Node 경로: 정확한 임계값(10/50MB) 및 연구자 친화 메시지
if command -v node >/dev/null 2>&1 && [ -f .labnoteo/scripts/check-large-files.mjs ]; then
  node .labnoteo/scripts/check-large-files.mjs --staged
  size_status=$?
  [ "$size_status" -ne 0 ] && exit "$size_status"

  # 노트 검증은 경고만 합니다. 여기서 막으면 무관한 옛 노트의 오류 하나가 볼트의
  # 모든 커밋을 세워 버리고, 최종 게이트는 어차피 서버측 validate 워크플로우입니다.
  # 목적은 push 전에 알아차리게 하는 것 — 특히 @issue 마커를 복사해 ID가 겹치면
  # 두 논의가 한 이슈로 합쳐지는데, 그건 조용히 일어납니다.
  #
  # 노트를 건드리지 않은 커밋은 건너뜁니다. validate는 실험 폴더의 모든 노트를
  # 읽으므로 큰 보관함에서는 비용이 작지 않습니다.
  if git diff --cached --name-only --diff-filter=ACM | grep -q '^labnote/' \
    && [ -f .labnoteo/scripts/validate.mjs ]; then
    notes_out=$(node .labnoteo/scripts/validate.mjs --notes-only 2>&1)
    if [ $? -ne 0 ]; then
      echo ""
      echo "⚠️  노트 검증 경고 — 커밋은 계속 진행합니다."
      echo "$notes_out" | grep '^❌' | head -20
      echo ""
      echo "push하면 서버 validate가 같은 내용으로 실패합니다. 먼저 고치세요."
    fi
  fi

  exit 0
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
