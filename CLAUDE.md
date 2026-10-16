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
1. evidence(근거 문장)가 원문에 없으면 → pending
2. 도메인 템플릿에 없는 key → pending
3. mention → ignored (기존 값 유지)
4. uncertain 또는 confidence < 0.7 → pending
5. cancel: 기존 값 있으면 applied(Fact 삭제), 없으면 ignored
6. 값 없음 → pending / 기존과 같은 값 → ignored
7. new인데 다른 기존 값이 있음 → pending
8. 그 외 → applied

## 실행 명령 (Windows Git Bash 기준)
```bash
# 백엔드 (backend 폴더에서)
source .venv/Scripts/activate
uvicorn app.main:app --reload      # http://localhost:8000/docs
pytest -v

# 프론트 (frontend 폴더에서)
npm run dev                        # http://localhost:5173
npm run build                      # 타입 검사 + 빌드
```

## 코딩 규칙
- **API 형식을 바꾸면** `docs/api.md`, `backend/app/schemas/`, `frontend/src/types/index.ts` 세 곳을 함께 수정한다.
- 새 분야는 코드가 아니라 `backend/app/domains/<분야>.json` 추가로 확장한다.
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
2주 안에 **시연 흐름이 매끄럽게 동작하는 것**이 최우선이다.
(시안 2 메인 → 3 녹음 → 4 결과 → 5 오늘의 안내 → 10 이력, 12 확인 요청)
설정, 다른 분야, 백그라운드 녹음 등은 후순위다. 범위를 넓히는 제안보다 완성도를 높이는 제안을 우선한다.
