# 07. 대용량 연구 데이터 관리 설계

> **목표:** Obsidian/GitHub에는 연구 기록과 코드 중심의 가벼운 SSOT를 유지하고, FASTQ·BAM·현미경 이미지·장비 출력·대규모 분석 결과 등의 데이터는 별도 스토리지에서 안정적으로 관리하면서 `EXP-xxx`를 통해 서로 추적 가능하게 만든다.

---

## 1. 핵심 원칙

이 시스템에서는 **Git Repository와 Research Data Storage를 분리**한다.

```text
Git Repository
├─ Markdown 연구노트
├─ Protocol
├─ Decision
├─ 작은 Figure
├─ 분석 코드
└─ Metadata

Research Data Storage
├─ Raw data
├─ Large images
├─ Sequencing data
├─ Instrument exports
├─ Intermediate data
└─ Large analysis outputs
```

핵심은 데이터 파일 자체를 Git에 넣는 것이 아니라 **Git의 연구노트가 데이터의 위치와 의미를 설명하도록 하는 것**이다.

---

## 2. 왜 Git에 모든 데이터를 넣지 않는가?

Git은 소스 코드와 텍스트 파일의 버전 관리에 매우 적합하지만 대형 binary 연구 데이터에는 비효율적이다.

예:

```text
sample.fastq.gz     8 GB
alignment.bam      25 GB
microscopy.tif     12 GB
instrument.raw      4 GB
```

이런 파일이 반복적으로 변경되면 저장소가 빠르게 커지고 clone/pull/backup이 불편해진다.

따라서:

> **Git = 연구의 기록과 구조**

> **Data Storage = 연구 데이터의 실체**

로 역할을 분리한다.

---

## 3. 공통 식별자는 Experiment ID

앞선 설계와 마찬가지로 데이터 연결의 핵심도 GitHub URL이나 파일 경로가 아니라 `EXP-xxx`다.

```text
EXP-025
  │
  ├─ Obsidian Note
  ├─ GitHub Issue
  ├─ Raw Data
  ├─ Processed Data
  ├─ Analysis
  ├─ Wiki Evidence
  └─ Decision
```

예:

```text
Research Note:
EXP-025.md

GitHub Issue:
[EXP-025] Insert ratio test

Storage:
/PRJ-LYCOPENE/EXP-025/

Wiki:
Evidence: EXP-025
```

---

## 4. 권장 데이터 폴더 구조

예:

```text
Research-Data/
└── PRJ-LYCOPENE/
    ├── EXP-001/
    │   ├── raw/
    │   ├── processed/
    │   ├── analysis/
    │   └── exports/
    │
    ├── EXP-002/
    │   ├── raw/
    │   ├── processed/
    │   └── analysis/
    │
    └── shared/
```

가능하면 연구노트와 데이터 폴더가 같은 Experiment ID를 사용한다.

---

## 5. Raw / Processed / Analysis 분리

### `raw/`

장비에서 생성된 원본 데이터.

가능하면 수정하지 않는다.

```text
raw/
├── sequencing/
├── microscopy/
└── instrument/
```

### `processed/`

원본 데이터에서 변환·정제된 데이터.

```text
processed/
├── trimmed/
├── aligned/
└── normalized/
```

### `analysis/`

통계/모델링/분석 결과.

```text
analysis/
├── tables/
├── model-output/
└── intermediate/
```

### `exports/`

공유나 보고용으로 생성한 결과.

```text
exports/
├── figure-01.png
├── result-table.csv
└── report.pdf
```

---

## 6. Raw Data는 가급적 immutable하게

원본 데이터는 덮어쓰지 않는 것을 기본으로 한다.

좋은 흐름:

```text
Instrument
    ↓
raw/
    ↓
processing script
    ↓
processed/
    ↓
analysis/
```

좋지 않은 흐름:

```text
raw data
   ↓
Excel에서 수정
   ↓
같은 파일명으로 저장
```

원본이 변경되면 provenance를 잃기 쉽다.

---

## 7. Obsidian에서 데이터 참조

실험 노트 Frontmatter:

```yaml
---
type: experiment
id: EXP-025
project: PRJ-LYCOPENE
status: completed
data_id: EXP-025
---
```

본문:

```markdown
## Data

Raw data:
`research-data://PRJ-LYCOPENE/EXP-025/raw/`

Processed:
`research-data://PRJ-LYCOPENE/EXP-025/processed/`

Analysis:
`research-data://PRJ-LYCOPENE/EXP-025/analysis/`
```

`research-data://`는 실제 표준 프로토콜이라는 의미가 아니라 **팀 내부의 논리적 URI 예시**다.

---

## 8. 절대경로를 피하는 이유

다음처럼 기록하면:

```text
D:\Haseong\data\EXP-025\
```

다른 PC에서는 사용할 수 없다.

NAS를 직접 기록해도 환경 변화에 취약할 수 있다.

```text
\\192.168.0.20\data\...
```

대신 논리적 식별자를 사용한다.

```text
research-data://PRJ-LYCOPENE/EXP-025/raw/
```

그리고 각 환경이 이를 실제 위치로 매핑한다.

```text
Lab PC
research-data://
→ Z:\Research-Data\

Linux server
research-data://
→ /mnt/research-data/

Object Storage
research-data://
→ s3://research-data/
```

---

## 9. 초기에는 단순 경로도 가능

MVP에서 URI resolver까지 만들 필요는 없다.

초기에는:

```yaml
data_path: PRJ-LYCOPENE/EXP-025/
```

만 기록해도 충분하다.

중요한 것은 개인 PC의 절대경로를 SSOT로 삼지 않는 것이다.

---

## 10. 스토리지 선택

대략 세 가지 선택지가 있다.

### NAS

적합:

- 연구실 내부 공유
- Windows/macOS 파일 탐색기 접근
- 대용량 이미지/장비 데이터
- 사용자가 일반 폴더처럼 사용해야 하는 경우

장점:

- 익숙한 파일 시스템
- 사용이 쉬움
- 내부망 운영 가능

주의:

- 백업은 별도로 설계해야 함
- 원격 접근 정책 필요

### Object Storage

예: S3-compatible storage.

적합:

- 대규모 데이터
- 프로그램/API 접근
- AI/분석 pipeline
- 향후 데이터 catalog
- 서버 기반 workflow

장점:

- 확장성이 좋음
- object ID 기반 관리
- 자동화에 유리

주의:

- 일반 사용자에게 파일 시스템보다 낯설 수 있음

### HPC/Research Storage

기관의 기존 스토리지가 있다면 우선 검토한다.

특히 대규모 sequencing/compute workflow와 연계하기 좋다.

---

## 11. 추천 방향

현재 단계에서는 다음 구조가 현실적이다.

```text
Obsidian + GitHub
        │
        │ metadata/link
        ▼
Research Storage
(NAS 또는 기관 스토리지)
        │
        ▼
Analysis Server / GPU
```

AI/자동화가 고도화되면 S3-compatible Object Storage 계층을 추가할 수 있다.

---

## 12. Git LFS는 어디까지 사용할까?

Git LFS는 큰 파일을 Git history에 직접 저장하는 문제를 줄여준다.

하지만 **연구 데이터 스토리지 전체를 Git LFS로 대체하는 용도**로 보지는 않는 것이 좋다.

LFS가 적합한 예:

```text
논문 Figure 원본
작은 reference dataset
모델 artifact 일부
팀이 Git commit과 함께 versioning해야 하는 binary
```

별도 스토리지가 더 적합한 예:

```text
FASTQ
BAM
대규모 microscopy
대량 instrument raw data
수백 GB 이상의 dataset
```

---

## 13. Git LFS를 사용하지 않아도 되는 초기 설계

초기에는 더 단순하게:

```text
Git
→ Markdown/code/small assets

Research Storage
→ large binary data
```

만 운영해도 충분하다.

LFS는 실제 필요가 확인된 뒤 추가하는 것이 좋다.

---

## 14. `.gitignore` 정책

예:

```gitignore
# Raw sequencing
*.fastq
*.fastq.gz
*.fq
*.fq.gz
*.bam
*.cram

# Common large raw-data locations
raw-data/
instrument-data/
local-data/

# Temporary
.DS_Store
Thumbs.db
*.tmp
```

단, `.gitignore`만 믿지 않는다.

파일 크기 검사도 함께 사용한다.

---

## 15. Pre-commit 대용량 파일 검사

권장 정책 예:

```text
< 10 MB
→ 허용

10–50 MB
→ 경고

> 50 MB
→ 차단
```

팀에 따라 threshold를 설정 파일로 분리한다.

예:

```yaml
warning_size_mb: 10
block_size_mb: 50
```

---

## 16. 왜 pre-commit이 중요한가?

GitHub Action은 push 이후 실행된다.

매우 큰 파일은 GitHub에 도달하기 전에 막는 것이 낫다.

```text
Obsidian
   ↓
Git stage
   ↓
pre-commit
   ↓
large file?
  /       \
NO        YES
│          │
commit     BLOCK
```

---

## 17. GitHub에서도 다시 검사

Local hook은 사용자가 우회할 수 있다.

예:

```text
git commit --no-verify
```

또 다른 Git client가 hook을 사용하지 않을 수도 있다.

따라서 GitHub Actions에서도 size policy를 다시 검사한다.

```text
Local pre-commit
= UX / early prevention

GitHub Action
= central policy enforcement
```

---

## 18. 큰 파일을 발견했을 때

자동 이동하지 않는다.

대신:

```text
Large file detected:
sample.fastq.gz

Size:
8.2 GB

Suggested action:
1. Store under EXP-025 in Research Data Storage.
2. Add the data path or ID to EXP-025.md.
3. Remove the file from Git staging.
```

처럼 안내한다.

---

## 19. 데이터 Manifest

데이터가 많아지면 각 Experiment에 작은 manifest를 두는 것이 유용하다.

예:

```yaml
experiment: EXP-025

files:
  - name: sample01.fastq.gz
    type: raw
    size: 8.2GB
    checksum: sha256:...
  - name: sample02.fastq.gz
    type: raw
    size: 7.9GB
    checksum: sha256:...
```

이 manifest 자체는 Git Repository에 저장할 수 있다.

---

## 20. Manifest의 장점

Git에는 데이터 전체 대신:

```text
파일 이름
파일 크기
checksum
storage location
생성 날짜
data type
```

만 남는다.

따라서:

```text
Git history
     ↓
어떤 데이터가 존재했는지 추적
     ↓
Storage
     ↓
실제 파일 확인
```

이 가능해진다.

---

## 21. Checksum

대용량 데이터의 동일성을 확인하려면 checksum이 유용하다.

예:

```text
SHA-256
```

흐름:

```text
Raw file
   ↓
SHA-256
   ↓
Manifest
```

나중에 데이터를 다른 NAS나 archive로 옮긴 뒤 checksum을 다시 계산해 동일성을 검증할 수 있다.

---

## 22. 데이터 provenance

최소한 다음 관계를 추적할 수 있어야 한다.

```text
EXP-025
   │
   ▼
raw/sample01
   │
   ▼
processing script
   │
   ▼
processed/sample01
   │
   ▼
analysis
   │
   ▼
Figure 2A
   │
   ▼
Wiki Finding 03
```

처음부터 완전한 provenance system을 만들 필요는 없다.

Experiment ID + manifest + analysis code만 있어도 상당한 추적성이 생긴다.

---

## 23. 분석 코드와 데이터 분리

코드:

```text
Git Repository
```

데이터:

```text
Research Storage
```

예:

```text
Git:
analysis/assembly_efficiency.py

Data:
research-data://PRJ-LYCOPENE/EXP-025/processed/

Output:
research-data://PRJ-LYCOPENE/EXP-025/analysis/
```

노트에는 분석 코드와 데이터 ID를 함께 기록한다.

---

## 24. 재현성을 높이려면

Experiment Note:

```markdown
## Analysis

Script:
`analysis/assembly_efficiency.py`

Input:
`research-data://PRJ-LYCOPENE/EXP-025/processed/`

Output:
`research-data://PRJ-LYCOPENE/EXP-025/analysis/`

Parameters:
...
```

처럼 기록할 수 있다.

향후 workflow engine으로 확장하기도 쉽다.

---

## 25. 데이터 삭제

연구 데이터 자동 삭제는 매우 보수적으로 다뤄야 한다.

AI나 GitHub Action에 자동 삭제 권한을 주지 않는다.

권장:

```text
delete request
     ↓
human review
     ↓
archive / retention policy 확인
     ↓
explicit deletion
```

특히 raw data는 별도의 보존 정책을 적용한다.

---

## 26. Backup과 Sync는 다르다

NAS RAID가 있다고 해서 backup이 완료된 것은 아니다.

개념적으로:

```text
Primary Storage
       │
       ├─ redundancy
       │
       └─ Backup
              │
              └─ Separate location
```

가 필요하다.

중요 데이터는 기관 정책에 맞춰 별도 backup/archival 계층을 둔다.

---

## 27. 권장 백업 개념

예:

```text
Working Storage
      ↓
Daily/regular backup
      ↓
Secondary Storage
      ↓
Long-term archive
```

구체적인 retention 기간은 연구기관/프로젝트 정책에 따라 정한다.

---

## 28. 모바일 환경

모바일에서 대용량 데이터를 직접 동기화하지 않는 것이 좋다.

모바일에서는:

```text
GitHub Issue
Research Note
Wiki
Small Figure
Data metadata
```

정도만 본다.

실제 Raw Data는 연구실 PC나 분석 서버에서 접근한다.

---

## 29. Obsidian Sync와 대용량 파일

Vault에 대용량 데이터가 들어가면 Obsidian 자체의:

- indexing
- backup
- Git
- 모바일 동기화

모두 부담이 커질 수 있다.

따라서 Vault 자체를 가볍게 유지하는 것이 중요하다.

---

## 30. 데이터 Catalog로 발전

데이터가 많아지면 단순 폴더 검색이 어려워진다.

향후:

```text
Experiment ID
Sample ID
Organism
Assay
Date
Project
Instrument
Data Type
```

등을 검색할 수 있는 catalog를 만들 수 있다.

---

## 31. Sample ID 도입

실험보다 sample 단위 추적이 중요해지면:

```text
EXP-025
├── SMP-0001
├── SMP-0002
└── SMP-0003
```

처럼 확장할 수 있다.

초기부터 복잡하게 만들 필요는 없지만 ID namespace는 확장 가능하게 설계한다.

---

## 32. 향후 AI와 데이터 Catalog

AI에게 Raw Data 전체를 주기보다는 catalog를 검색하게 한다.

예:

```text
User:
"EXP-025의 sequencing 데이터가 어디 있지?"

AI
 ↓
Data Catalog
 ↓
EXP-025
 ↓
Storage URI + metadata
```

또는:

```text
"lycopene 프로젝트에서 Nanopore 데이터가 있는 실험을 찾아줘."
```

처럼 사용할 수 있다.

---

## 33. AI의 데이터 접근 권한

AI Agent가 스토리지를 읽게 된다면 단계적으로 권한을 부여한다.

초기:

```text
metadata read-only
```

다음:

```text
selected processed data read
```

필요한 경우에만 raw data 접근을 검토한다.

삭제/이동 권한은 기본적으로 주지 않는다.

---

## 34. 민감 데이터

데이터마다 접근 등급이 다를 수 있다.

예:

```yaml
access: internal
ai_access: local-only
```

또는:

```yaml
access: restricted
ai_access: disabled
```

이 metadata는 향후 AI 자동화와 권한 제어에 사용할 수 있다.

---

## 35. 연구노트와 데이터 Manifest 연결

예:

```yaml
---
type: experiment
id: EXP-025
data_manifest: manifests/EXP-025.yaml
---
```

`manifests/EXP-025.yaml`:

```yaml
experiment: EXP-025
storage: PRJ-LYCOPENE/EXP-025/

datasets:
  - id: DATA-0001
    role: raw
    format: fastq.gz
    checksum: sha256:...
```

이렇게 하면 Git만 clone해도 어떤 데이터가 존재하는지 알 수 있다.

---

## 36. 모든 파일을 Manifest에 기록해야 할까?

처음에는 아니다.

예를 들어 수만 개의 작은 파일이 있다면 파일 하나씩 기록하는 것은 과하다.

대신:

```text
dataset 단위
directory 단위
archive 단위
```

로 관리할 수 있다.

예:

```yaml
dataset_id: DATA-0021
path: EXP-025/raw/sequencing/
file_count: 192
```

필요할 때 상세 inventory를 별도로 생성한다.

---

## 37. 작은 결과 파일은 Git에 둘 수 있다

다음은 Git에 포함해도 유용할 수 있다.

```text
작은 CSV
요약 통계
작은 PNG/SVG Figure
실험 plate layout
configuration
metadata
```

판단 기준은 단순 파일 크기뿐 아니라 **버전 관리 가치**다.

---

## 38. Figure 관리

논문 Figure의 최종 SVG/PDF/PNG가 비교적 작다면 Git에서 관리할 수 있다.

예:

```text
figures/
├── Fig1/
│   ├── Fig1.svg
│   └── README.md
```

README에는:

```text
Source experiments:
EXP-014
EXP-018
EXP-025

Analysis:
analysis/figure1.py
```

를 기록한다.

---

## 39. 데이터 이동 시 경로 문제

논리적 ID를 사용하는 이유가 여기서 중요해진다.

예:

```text
NAS A
→ NAS B
```

로 데이터를 이전해도:

```text
EXP-025
DATA-0021
```

ID는 변하지 않는다.

resolver/catalog만 새 위치를 가리키면 된다.

---

## 40. 장기적으로 권장되는 데이터 계층

```text
                 Obsidian
                    │
             Research Note
                    │
                    ▼
             Git Repository
                    │
          Metadata / Manifest
                    │
                    ▼
              Data Catalog
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
      NAS       Object Store   Archive
       │            │
       └──────┬─────┘
              ▼
       Analysis Compute
              │
              ▼
       Processed Results
              │
              ▼
         Wiki / Paper
```

---

## 41. 초기 MVP

처음에는 다음만 구현해도 충분하다.

### Git

```text
Markdown
Code
Small assets
```

### Storage

```text
PRJ-ID/
└── EXP-ID/
    ├── raw/
    ├── processed/
    └── analysis/
```

### Protection

```text
.gitignore
+
pre-commit size check
+
GitHub Action validation
```

### Research Note

```yaml
data_path: PRJ-LYCOPENE/EXP-025/
```

여기까지가 현실적인 첫 단계다.

---

## 42. 2단계

운영하면서 필요하면:

```text
Data Manifest
Checksum
Dataset ID
Automated inventory
```

를 추가한다.

---

## 43. 3단계

데이터 규모가 커지면:

```text
Data Catalog
Object Storage
Access control
Automated provenance
```

를 추가한다.

---

## 44. 4단계

AI/자동화가 고도화되면:

```text
Metadata-aware RAG
Data discovery Agent
Analysis workflow integration
MCP tools
Automated provenance graph
```

로 발전시킬 수 있다.

---

## 45. 전체 흐름

```text
Experiment
    │
    ├───────────────┐
    ▼               ▼
Research Note     Raw Data
    │               │
    │            Storage
    │               │
    │           Processing
    │               │
    │               ▼
    │          Processed Data
    │               │
    │            Analysis
    │               │
    └───────┬───────┘
            ▼
          Result
            │
        GitHub Issue
            │
        Interpretation
            │
            ▼
        Wiki Finding
            │
            ▼
           Paper
```

---

## 46. 최종 권장 원칙

1. Git Repository를 데이터 저장소로 만들지 않는다.
2. 연구노트와 데이터는 `EXP-xxx`로 연결한다.
3. Raw Data는 가능한 한 수정하지 않는다.
4. 개인 PC의 절대경로를 연구 기록의 기준으로 사용하지 않는다.
5. 대용량 파일은 pre-commit에서 먼저 차단한다.
6. GitHub에서도 중앙 정책을 다시 검증한다.
7. 자동으로 파일을 다른 스토리지로 이동시키지 않는다.
8. 데이터 규모가 커지면 Manifest와 checksum을 도입한다.
9. Git LFS는 선택적으로 사용하며 연구 데이터 스토리지 전체를 대체하지 않는다.
10. AI에는 처음부터 Raw Data 전체가 아니라 metadata와 분석된 결과를 제공한다.
11. 데이터 삭제/이동은 사람이 승인한다.
12. 장기적으로 위치(path)보다 안정적인 ID를 중심으로 관리한다.

---

## 47. 한 문장으로 정리

> **Git에는 연구의 의미와 이력을 저장하고, 대용량 스토리지에는 데이터의 실체를 저장하며, Experiment/Dataset ID가 두 세계를 연결하도록 한다.**

---

## 48. 다음 문서

다음 문서는:

`08_implementation-roadmap.md`

에서 지금까지 설계한 전체 시스템을 실제로 구축하는 순서를 정리한다.

주요 내용:

- 기존 Obsidian Vault를 최대한 유지하면서 시작하는 방법
- GitHub Repository 초기 설정
- `.gitignore`
- Experiment Template
- Frontmatter 최소 규칙
- pre-commit 대용량 파일 검사
- GitHub Issue/Label 설정
- GitHub Actions MVP
- Wiki 초기 구조
- AI 자동화 도입 시점
- NAS/Object Storage 연결 시점
- 1주차 / 2주차 / 이후 단계별 구축 계획
- 무엇을 처음부터 하지 말아야 하는지
- 실제 운영 후 평가할 지표
