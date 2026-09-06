# Labnote Assistant for Obsidian (labnoteo)

**버전 0.76.0**

생물학·생명정보학 실험을 위한 Obsidian용 Markdown 기반 실험 노트입니다. 샘플 추적, 워크플로 체크리스트, 유닛 오퍼레이션, 선택적 LLM 보조 기능을 제공합니다.

이 저장소는 Labnote Assistant의 Obsidian 포팅 버전입니다. 파싱·도메인 로직은 동반 VS Code 확장과 개념을 공유하지만, 이 저장소 안에서 완전히 자립적으로 동작합니다.

## 주요 기능

- **샘플 추적**: 전용 Samples 사이드바 뷰. 샘플(DNA, RNA, Plasmid 및 사용자 정의 타입)을 정의·삽입·편집·검색합니다. 로컬(노트)/글로벌 범위 간 이동을 지원합니다.
- **워크플로 체크리스트**: Workflows 사이드바 뷰에서 번호가 매겨진 워크플로 노트를 생성·관리하고, 유닛 오퍼레이션을 삽입하며 목차를 자동 동기화합니다.
- **유닛 오퍼레이션**: 내장 카탈로그에서 하드웨어/소프트웨어 유닛 오퍼레이션을 삽입하고, 헤딩 정규화와 목차를 자동 갱신합니다.
- **CSV 내보내기**: 노트의 표를 CSV로 내보냅니다.
- **샘플 자동완성·하이라이트**: 편집 중 샘플 참조에 대한 인라인 제안과 하이라이트를 제공합니다.
- **LLM 보조(선택)**: Ollama 또는 OpenAI로 실험 방법 초안 작성, 결과 요약, 샘플 추출을 수행합니다. 로컬 MCP 서버 토글도 포함합니다.

## 주요 명령어

| 명령어 | 설명 |
|---|---|
| 날짜/시간 삽입 | 현재 날짜 또는 타임스탬프 삽입 |
| 실험 생성 | 새 `.labnote.md` 실험 노트 생성 |
| 워크플로 생성 | 번호가 매겨진 워크플로 노트 생성 |
| 유닛 오퍼레이션 삽입 | 카탈로그에서 유닛 오퍼레이션 삽입 |
| 표 CSV 내보내기 | 노트의 표를 CSV로 내보내기 |
| AI: 방법 초안 | 설정된 LLM으로 실험 방법 초안 작성 |
| AI: 결과 요약 | 설정된 LLM으로 결과 요약 |
| AI: 샘플 추출 | 설정된 LLM으로 노트에서 샘플 추출 |
| MCP 서버 토글 | 로컬 MCP 서버 시작/중지 |
| 워크플로/샘플 뷰 열기 | 사이드바 뷰 표시 |

## 설치 (수동)

1. 릴리스에서 `main.js`, `manifest.json`, `versions.json`을 내려받습니다.
2. 보관함(vault)의 `.obsidian/plugins/labnoteo/` 폴더를 만들고 세 파일을 복사합니다.
3. Obsidian 설정 → 커뮤니티 플러그인에서 **Labnote Assistant**를 활성화합니다.

## 설정

- **샘플 추적**: Samples 사이드바 뷰 표시 여부.
- **사용자 정의 샘플 타입**: 내장 타입 외에 사용자 정의 타입 추가.
- **LLM 제공자**: `none`, `ollama`, `openai` (데스크톱 빌드는 제공자와 직접 통신).

## 개발자 참고

npm workspaces 모노레포 구조입니다:

- `packages/labnoteo` — Obsidian 플러그인 (esbuild로 `main.js` 번들).
- `packages/labnoteo-core` — 플랫폼 중립 core 로직 (파서, 워크플로/샘플 도메인). 플러그인이 사용합니다.

```bash
npm install           # 전체 워크스페이스 설치
npm run build         # Obsidian 플러그인 번들 -> packages/labnoteo/main.js
npm run typecheck     # core + plugin 타입 검사
npm test              # core 단위 테스트 실행 (vitest)
npm run sync:versions # 루트 버전을 패키지 + manifest에 전파
```

## 요구 사항

- Obsidian `1.5.0` 이상.
- 개발 시 Node.js `22+`.

## 라이선스

MIT
