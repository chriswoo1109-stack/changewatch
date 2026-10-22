# ChangeWatch (체인지워치) — Claude Code 작업 안내

이 파일은 Claude Code가 이 프로젝트에서 작업할 때 항상 먼저 읽는 안내서입니다.
답변과 코드 주석은 **한국어**로 작성합니다.

## 프로젝트 개요
- 병원·공공기관 등에서 **들은 안내(음성/텍스트)를 정리**하고, 이전 안내와 비교해 **바뀐 정보만** 찾아 알려주는 웹 서비스.
- 핵심 차별점: 변경(change) / 정정(correction) / 취소(cancel)와 **단순 언급(mention)**, **불확실(uncertain)** 을 구분한다.
- 원칙: **AI가 제안하고, 규칙 검증(verifier)이 확인한 뒤에만 저장한다.** 불확실하면 자동 반영하지 않고 사용자 확인(pending)을 요청한다.
- 대학 팀 프로젝트(3인, 2주). MVP 범위는 **병원 시나리오**(대기실 방송 + 진료실 설명). 은행·공공기관·교통은 확장 예시.
- 형태: 모바일 웹(PWA 예정). 네이티브 앱 아님.

## 기술 스택
### 프론트엔드 (`frontend/`)
- React 18 + TypeScript + Vite 6
- Tailwind CSS v4 (`@tailwindcss/vite`, 설정 파일 없음, `src/styles/index.css`에서 `@import "tailwindcss"`)
- React Router v6, Zustand v5 (persist로 sessionId만 브라우저 저장)
- 서버 통신: `fetch` 래퍼(`src/api/client.ts`). 별도 라이브러리 없음
- 녹음: MediaRecorder API (`src/hooks/useRecorder.ts`, webm/mp4)
- 배포 예정: Vercel

### 백엔드 (`backend/`)
- Python 3.13 + FastAPI, Uvicorn
- SQLAlchemy 2.0 (로컬 SQLite `changewatch.db`, 배포 시 PostgreSQL 예정), 시작 시 `create_all`
- Pydantic v2 / pydantic-settings (`.env`에서 설정)
- AI: OpenAI API (`openai` 패키지). `LLM_PROVIDER=mock`이면 규칙 기반 모의 분석기 사용(API 키 불필요)
- 음성 인식: OpenAI 음성 인식 API (키 필요, 없으면 501)
- 테스트: pytest
- 배포 예정: Render

## 폴더 구조
```
changewatch/
├── CLAUDE.md
├── README.md                 # 실행 방법
├── docs/api.md               # ★ 프론트·백엔드 API 약속 (변경 시 양쪽 동시 수정)
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI 앱, CORS, 라우터 등록 (prefix /api)
│   │   ├── core/config.py    # 환경변수 설정 (Settings)
│   │   ├── db.py             # 엔진, SessionLocal, Base, get_db
│   │   ├── models/           # VisitSession, Announcement, Fact, ChangeLog
│   │   ├── schemas/          # Pydantic 요청·응답·LLM 출력 형식 (Candidate 등)
│   │   ├── api/routes/       # sessions, announcements, transcribe, changes
│   │   ├── services/
│   │   │   ├── llm_extractor.py   # 안내 → 변경 후보 추출 (MockExtractor / OpenAIExtractor)
│   │   │   ├── verifier.py        # ★ 규칙 검증: applied / pending / ignored 결정
│   │   │   ├── session_service.py # 분석 흐름, 저장, 확인 처리
│   │   │   └── stt_service.py     # 음성 → 텍스트
│   │   ├── prompts/extract.txt    # AI 프롬프트 (str.format 사용 → JSON 중괄호는 {{ }})
│   │   └── domains/*.json         # 분야별 추적 항목 템플릿 (hospital, public_office)
│   └── tests/
│       ├── fixtures/sentences.json # 변경 판단 테스트 문장 세트
│       ├── test_verifier.py
│       └── test_api.py
└── frontend/
    └── src/
        ├── App.tsx            # 라우트 + 하단 탭, max-w-md 모바일 레이아웃
        ├── pages/             # 화면 (파일 주석에 디자인 시안 번호)
        ├── components/        # common/, result/, session/
        ├── hooks/             # useRecorder, useAnalyze, useCurrentSession
        ├── api/               # client.ts, sessions.ts, announcements.ts
        ├── stores/sessionStore.ts
        └── types/index.ts     # 백엔드 스키마와 1:1로 맞춘 타입
```

## 핵심 데이터 흐름
1. 프론트: 녹음 → `POST /api/sessions/{id}/transcribe` → 텍스트 (또는 직접 입력)
2. 프론트: `POST /api/sessions/{id}/announcements` `{text}`
3. 백엔드 `session_service.analyze`:
   현재 Fact 조회 → `llm_extractor`로 Candidate 목록 → `verifier.verify`로 상태 결정 →
   applied면 Fact 갱신 → 모든 후보를 ChangeLog로 저장 → `AnalyzeResponse` 반환
4. pending은 `POST /api/changes/{id}/confirm` `{approve}`로 사용자가 처리

### 용어
- **Session(VisitSession)**: 방문 단위. 같은 세션의 안내끼리만 비교한다.
- **Fact**: 현재 유효한 정보 (세션당 key 하나, 예: room=5번)
- **ChangeLog**: 변경 후보와 판단 결과 이력
- change_type: `new | change | correction | cancel | mention | uncertain`
- status: `applied | pending | ignored | rejected`

### verifier 규칙 (순서대로 적용)
0. 후보를 근거 문장이 원문에 나온 순서로 정렬한 뒤 판단 (AI가 순서를 섞어도 "취소 → 새 일정" 유지)
1. evidence(근거 문장)가 원문에 없으면 → pending
2. 도메인 템플릿에 없는 key → pending
3. mention → ignored (기존 값 유지)
3-1. 안내 대상(`services/audience.py`, 근거가 든 원문 문장 전체를 한글 숫자 정규화 후 판단): 다른 사람("12번 환자분", "김철수님", 내 시각과 다른 "오전 11시 예약 환자분들", 내 진료실과 다른 "3번 진료실 환자분들") → ignored / 누구인지 모름(내 번호·이름·시각 미설정, "처음 오신 분은") → pending (사유에 "내 번호를 등록하면 자동으로 구분해요" 안내)
3-2. 값이 항목 이름을 꾸미기만 하는 문장("5번 진료실은 지금 혼잡합니다": 바뀜 표현·안내 말투 없음) → ignored
3-3. 이미 저장된 값과 같은 값(취소 제외) → ignored (불확실 말투여도 묻지 않음: 이미 5번인데 "아마 5번일 겁니다")
4. uncertain, confidence < 0.7, 또는 근거에 불확실 표현("아마", "것 같", "쯤" 등)이 있으면 → pending
5. cancel: 기존 값 있으면 applied(Fact 삭제), 없으면 ignored
6. 값 없음 / 문장 형태(30자 초과, "~니다·~세요" 등) / 항목의 `value_pattern` 불일치 / 값 뒤에 `not_followed_by`("12번 환자분") → pending, 기존과 같은 값 → ignored
   (비교 전 값 정규화: 한글 숫자 → 숫자, `type: "time"` 항목은 `am_hours` 기준 오전/오후 보정 — `services/normalize.py`)
7. new인데 다른 기존 값이 있음 → pending
8. 그 외 → applied

## 실행 명령 (Windows Git Bash 기준)
```bash
# 백엔드 (backend 폴더에서)
source .venv/Scripts/activate
uvicorn app.main:app --reload      # http://localhost:8000/docs
pytest -v
python -m scripts.evaluate [--provider openai]   # 변경 판단 정확도 평가
python -m scripts.demo_check --provider openai --repeat 5   # 시연 시나리오(tests/fixtures/demo.json) 반복 점검
python -m scripts.demo_check --base-url https://<배포 주소>   # 배포 서버로 같은 시나리오 점검 (서버 깨우기·AI 설정 확인)
python -m scripts.report --provider openai --repeat 3   # 발표용 비교표 (AI 단독 vs 규칙 검증), 결과는 docs/evaluation.md에 정리

# 프론트 (frontend 폴더에서)
npm run dev                        # http://localhost:5173
npm run build                      # 타입 검사 + 빌드
```

## 코딩 규칙
- **API 형식을 바꾸면** `docs/api.md`, `backend/app/schemas/`, `frontend/src/types/index.ts` 세 곳을 함께 수정한다.
- 새 분야는 코드가 아니라 `backend/app/domains/<분야>.json` 추가로 확장한다.
  항목 필드: `key`, `label`, `keywords`(모의 분석기용), `description`(AI 프롬프트에 표시), `type: "time"`, `value_pattern`, `unit`(숫자만 온 값에 붙일 단위, "12" → "12번"), `not_followed_by`, `group_call`("3번 진료실 환자분들"처럼 묶음 호출에 쓰이는 항목)
- 프롬프트·항목 설명을 바꾸면 `python -m scripts.evaluate --provider openai`를 2회 이상 돌려 **잘못된 반영 수**가 늘지 않았는지 확인한다. (작은 문구 변경으로 다른 유형이 깨지는 일이 잦다)
- 변경 판단 로직을 바꾸면 `tests/fixtures/sentences.json`에 사례를 추가하고 `pytest`가 통과하는지 확인한다.
- AI가 만든 결과는 반드시 `verifier`를 거친 뒤 저장한다. 라우트나 extractor에서 Fact를 직접 바꾸지 않는다.
- 사용자에게 보이는 문구와 에러 메시지(`detail`)는 한국어로 쓴다.
- 프론트 스타일은 Tailwind 클래스로 작성하고, 모바일 화면(max-w-md)을 기준으로 한다.
- 새 라이브러리는 꼭 필요할 때만 추가하고, 추가 시 이유를 설명한다.
- `.env`, API 키, `changewatch.db`, `.venv`, `node_modules`는 절대 커밋하지 않는다.

## Git 협업 규칙 (git flow)
- `main`: 검증된 시연 버전 / `develop`: 통합 / `feature/*`: 기능 개발
- main, develop은 보호됨 → 직접 push 불가. **feature 브랜치에서 작업 → PR → 1명 승인 → Squash and merge**
- 브랜치 이름: `feature/fe-기능`, `feature/be-기능`, 급한 수정 `hotfix/내용`
- 커밋 메시지: `feat:` 기능, `fix:` 버그, `docs:` 문서, `refactor:` 리팩터링, `chore:` 설정 (한국어 설명 가능)
- Claude는 develop/main 브랜치에서 파일을 수정하기 전에 현재 브랜치를 확인하고, feature 브랜치가 아니면 먼저 알려준다.
- `git push`, PR 생성·병합은 사용자가 요청할 때만 한다.

## 팀 역할
- A (프론트): 화면, 녹음, PWA, Vercel 배포
- B (백엔드, 팀장): API, DB, 음성 인식 연동, Render 배포, 레포 관리
- C (AI 엔진 + 기획): 프롬프트, verifier, 테스트 문장 세트, 정확도 평가, 발표자료

## 우선순위
**시연 흐름이 매끄럽게 동작하는 것**이 최우선이다.
(시안 2 메인 → 3 녹음 → 4 결과 → 5 오늘의 안내 → 10 이력, 12 확인 요청, 그리고 내 차례 알림)
범위를 넓히는 제안보다 완성도를 높이는 제안을 우선한다.
한 번에 기능 하나만 작업하고, 작업이 끝나면 어떤 파일을 바꿨는지와 직접 확인하는 방법을 알려준다.

## 주의사항 (구현할 때 반드시 고려)
### 웹의 한계
- **백그라운드 녹음 불가:** 화면이 꺼지거나 다른 앱으로 전환하면 녹음이 멈춘다. 백그라운드 녹음을 시도하지 말 것.
  내 차례 알림은 **화면을 켜 둔 "대기 모드"에서만 동작**한다: Screen Wake Lock API로 화면 꺼짐 방지,
  `visibilitychange`로 앱 전환을 감지해 돌아왔을 때 "듣기가 N분간 멈춰 있었어요" 안내.
- **마이크는 https에서만:** 휴대폰에서 `http://192.168...`로는 마이크가 막힌다. 휴대폰 테스트는 배포(https) 후에 한다.
- **iPhone 진동 불가:** `navigator.vibrate`는 안드로이드만 지원. 항상 `navigator.vibrate?.(...)`로 호출하고 화면·소리 알림을 함께 쓴다.
- **iPhone 소리 제한:** 사용자 터치 전에는 오디오·speechSynthesis가 무시된다. "듣기 시작" 버튼 클릭 시 오디오를 미리 활성화한다.
- **iPhone 홈 화면 앱과 Safari는 저장 공간이 분리**되어 sessionId가 공유되지 않는다.

### 연속 듣기·인식 정확도
- 녹음을 일정 간격(20~30초)으로 잘라 보낼 때 경계에서 문장이 잘리지 않도록 조각을 2~3초 겹치거나 직전 텍스트 끝부분을 이어 붙여 분석한다.
- 번호 매칭: 한글 숫자("삼십칠")를 숫자로 정규화하고, "137번"·"370번"이 37번으로 오인되지 않게 숫자 경계를 확인한다. 이런 사례를 테스트 문장에 포함한다.
- 음성 인식 오류를 전제로 설계한다: 원문 근거 표시와 확인 요청(pending)을 항상 유지한다.

### 배포·운영
- Render 무료 서버는 15분 미사용 시 잠들어 첫 요청이 매우 느리다. 프론트에서 로딩 문구를 충분히 보여주고, 발표 전 미리 깨운다.
- Render 무료 서버는 디스크가 유지되지 않아 SQLite 데이터가 사라진다. 배포 DB는 PostgreSQL(Neon 등)을 `DATABASE_URL`로 연결한다.
- 배포 시 백엔드 `CORS_ORIGINS`에 프론트 배포 주소를 추가하고, 프론트 `VITE_API_URL`을 백엔드 배포 주소로 설정한다.
- 첫 배포는 10/22~23에 미리 해 보고, 최종 배포는 10/26까지 끝낸다.

### 보안·개인정보·비용
- OpenAI API 키는 백엔드 `.env`에만 둔다. 프론트 코드에 키나 외부 AI 호출을 넣지 않는다.
- 연속 듣기는 API 호출이 많으므로 불필요한 호출을 줄이고(무음 구간 생략 등), OpenAI 사용 한도를 설정한다.
- 원본 음성은 저장하지 않는다. 처음 듣기 시작 전에 "음성이 텍스트 변환·분석을 위해 외부 AI로 전송되며 원본은 저장하지 않습니다" 안내를 보여준다.
