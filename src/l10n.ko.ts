/**
 * Korean catalog for the Obsidian plugin — the single source of Korean strings,
 * consumed via `this.t()` / `host.t()` and wired up in `i18n.ts` (ko locale).
 *
 * Conventions: 워크플로 / 샘플 / 유닛 오퍼레이션 / 실험, formal (존댓말) tone, and
 * positional `{0}` / literal `{Type}` placeholders left intact for `formatMessage`.
 */
const obsidianKo: Record<string, string> = {
  // Commands
  'Create experiment': '실험 생성',
  'Create workflow': '워크플로 생성',
  'Insert workflow': '워크플로 삽입',
  'Insert unit operation': '유닛 오퍼레이션 삽입',
  'Insert date': '날짜 삽입',
  'Insert date and time': '날짜 및 시간 삽입',
  'Pick date and time': '날짜 및 시간 선택',
  'Export tables to CSV': '표를 CSV로 내보내기',
  'Open workflow view': '워크플로 뷰 열기',
  'Open sample view': '샘플 뷰 열기',
  'Toggle MCP server': 'MCP 서버 켜기/끄기',
  'AI: Draft Method section': 'AI: Method 섹션 초안 작성',
  'AI: Summarize results': 'AI: 결과 요약',
  'AI: Extract sample definitions': 'AI: 샘플 정의 추출',
  'AI: Ask assistant (uses tools)': 'AI: 어시스턴트에게 요청 (툴 사용)',
  'Ask the AI assistant': 'AI 어시스턴트에게 요청',
  'What should the assistant do?': '어시스턴트가 무엇을 하면 될까요?',
  'e.g. Add a Method section describing the PCR setup':
    '예: PCR 조건을 설명하는 Method 섹션 추가',
  'Allow AI tool "{0}" to modify the vault?': 'AI 툴 "{0}"이(가) 보관함을 수정하도록 허용할까요?',
  'AI stopped after too many steps.': 'AI가 너무 많은 단계를 거쳐 중단되었습니다.',
  'AI ran {0} tool call(s).': 'AI가 툴을 {0}회 호출했습니다.',

  // View titles / ribbon
  'Workflows': '워크플로',
  'Samples': '샘플',

  // Pickers / prompts
  'New experiment': '새 실험',
  'Experiment title': '실험 제목',
  'Title is required.': '제목을 입력해야 합니다.',
  'Select workflow': '워크플로 선택',
  'Search workflows': '워크플로 검색',
  'Search unit operations': '유닛 오퍼레이션 검색',
  'Open a lab note first.': '먼저 랩노트 파일을 여세요.',
  'Workflow name': '워크플로 이름',
  'Enter a name for this workflow': '이 워크플로의 상세 별칭을 입력하세요',

  // Notices / results
  'Experiment created: {0}': '실험이 생성되었습니다: {0}',
  'Exported {0} CSV file(s).': 'CSV 파일 {0}개를 내보냈습니다.',
  'No tables found in this note.': '이 노트에서 표를 찾을 수 없습니다.',
  'Command failed: {0}': '명령 실행 실패: {0}',
  'Yes': '예',
  'Workflow created: {0}': '워크플로가 생성되었습니다: {0}',
  'Unit operation inserted: {0} {1}': '유닛 오퍼레이션이 삽입되었습니다: {0} {1}',
  'Please open a workflow file.': '워크플로 파일을 열어주세요.',
  'Please run this command on a workflow file inside the labnote folder.':
    'labnote 폴더 내의 워크플로 파일에서 실행해주세요.',
  'Missing unit operation info.': '유닛 오퍼레이션 정보가 없습니다.',

  // Workflow README auto-sync (delete pruning)
  'Removed from sample tree: {0}': '샘플 트리에서 제거됨: {0}',

  // Sample view context menu
  'Copy sample ID': '샘플 ID 복사',
  'Copied: {0}': '복사했습니다: {0}',
  'Insert reference': '참조 삽입',
  'Add sample': '샘플 추가',
  'Edit sample': '샘플 편집',
  'Delete sample': '샘플 삭제',
  'Open a note to insert into.': '삽입할 노트를 여세요.',
  'No samples found.': '샘플을 찾을 수 없습니다.',

  // Sample create / autocomplete actions
  'Generate new {0} ID': '새 {0} ID 생성',
  'Automatically generate a new sample ID': '샘플 ID를 자동으로 생성합니다',
  'Enter info': '직접 입력',
  'Manually enter sample ID, alias, and description': '샘플 ID·별칭·설명을 직접 입력합니다',
  'Search catalog': '카탈로그 검색',
  'Search {0} catalog': '{0} 카탈로그 검색',
  'Insert a reference from the product catalog': '제품 카탈로그에서 참조를 삽입합니다',
  'No {0} catalog found. Add resources/labsamples/{0}_*.json.':
    '{0} 카탈로그가 없습니다. resources/labsamples/{0}_*.json 파일을 추가하세요.',

  // Go to definition popup
  'Go to definition': '정의로 이동',
  'Sample definition': '샘플 정의',
  'Type': '타입',
  'ID': 'ID',
  'Alias': '별칭',
  'Description': '설명',
  'Scope': '범위',
  'File': '파일',
  'Open JSON file': 'JSON 파일 열기',
  'Could not open {0}': '{0}을(를) 열 수 없습니다',
  'No definition found for {0}': '{0}의 정의를 찾을 수 없습니다',
  'Close': '닫기',
  'Enter the {0} sample ID': '{0} 샘플 ID를 입력하세요',
  'e.g. {0}-12345': '예: {0}-12345',
  'Invalid ID. Expected {0}-<number>.': '잘못된 ID입니다. {0}-<숫자> 형식이어야 합니다.',
  'Enter an alias for the new {0} sample': '새 {0} 샘플의 별칭을 입력하세요',
  'e.g. Sample-A': '예: Sample-A',
  'Enter a description (optional)': '설명을 입력하세요 (선택)',
  'e.g. Sample used in experiment 1': '예: 실험 1에서 사용한 샘플',
  'Enter a new alias': '새 별칭을 입력하세요',
  'Enter a new description': '새 설명을 입력하세요',
  'Are you sure you want to delete {0}?': '{0}을(를) 삭제하시겠습니까?',
  'Delete': '삭제',
  'OK': '확인',
  'Cancel': '취소',
  'Sample added: {0}': '샘플이 추가되었습니다: {0}',
  'Sample updated: {0}': '샘플이 수정되었습니다: {0}',
  'Sample deleted: {0}': '샘플이 삭제되었습니다: {0}',

  // Settings tab
  'Sample tracking': '샘플 추적',
  'Autocomplete, highlighting and {Type}.json sync. Reload to apply.':
    '자동완성, 하이라이팅 및 {Type}.json 동기화. 적용하려면 다시 로드하세요.',
  'Custom sample types': '사용자 정의 샘플 타입',
  'Comma-separated types in addition to the built-ins.':
    '기본 제공 타입 외에 추가할 타입을 쉼표로 구분해 입력합니다.',
  'Global sample folder': '전역 샘플 폴더',
  'Vault-relative folder for vault-global samples.':
    '볼트 전역 샘플을 저장할 볼트 기준 상대 폴더입니다.',
  'AI provider': 'AI 프로바이더',
  'Provider': '프로바이더',
  'Disabled': '비활성화됨',
  'Endpoint': '엔드포인트',
  'Ollama endpoint': 'Ollama 엔드포인트',
  'OpenAI endpoint': 'OpenAI 엔드포인트',
  'Model': '모델',
  'API key': 'API 키',
  'Only sent to OpenAI-compatible providers, never to Ollama.':
    'OpenAI 호환 프로바이더에만 전송되며, Ollama에는 전송되지 않습니다.',
  'Enable MCP server': 'MCP 서버 활성화',
  'Desktop only. Exposes tools to external MCP clients.':
    '데스크톱 전용. 외부 MCP 클라이언트에 도구를 노출합니다.',
  'MCP token': 'MCP 토큰',
  'Copy the bearer token for external MCP clients (server must be running).':
    '외부 MCP 클라이언트용 베어러 토큰을 복사합니다 (서버가 실행 중이어야 합니다).',
  'Copy token': '토큰 복사',
  'Start the MCP server first.': 'MCP 서버를 먼저 시작하세요.',
  'MCP token copied to clipboard.': 'MCP 토큰을 클립보드에 복사했습니다.',

  // AI commands
  'Configure an AI provider in settings first.': '먼저 설정에서 AI 프로바이더를 구성하세요.',
  'Contacting {0}…': '{0}에 연결 중…',
  'AI request failed: {0}': 'AI 요청 실패: {0}',
  'Open a note first.': '먼저 노트를 여세요.',
  'Open a markdown note first.': '먼저 마크다운 노트를 여세요.',
  'Nothing to summarize.': '요약할 내용이 없습니다.',
  'Nothing to extract.': '추출할 내용이 없습니다.',
  'Created {0} sample(s).': '샘플 {0}개를 생성했습니다.',

  // MCP server
  'MCP server is desktop-only.': 'MCP 서버는 데스크톱 전용입니다.',
  'MCP server started on 127.0.0.1:{0}': 'MCP 서버가 127.0.0.1:{0}에서 시작되었습니다',
  'MCP server port {0} is already in use.': 'MCP 서버 포트 {0}이(가) 이미 사용 중입니다.',
  'MCP server error: {0}': 'MCP 서버 오류: {0}',
  'Allow MCP tool "{0}" to modify the vault?': 'MCP 도구 "{0}"가 볼트를 수정하도록 허용할까요?',
  'Target: {0}': '대상: {0}',
  'Allow': '허용',
};

export default obsidianKo;
