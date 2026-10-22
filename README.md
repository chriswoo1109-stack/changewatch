# ChangeWatch (체인지워치)

들은 안내를 정리하고, **바뀐 정보만** 찾아 알려주는 웹 서비스.

```
changewatch/
├── frontend/   React + TypeScript + Vite + Tailwind   (담당: A)
├── backend/    Python + FastAPI + SQLite               (담당: B, C)
└── docs/       API 명세, 기획 문서
```

## 처음 실행하기

### 백엔드 (Git Bash)
```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate      # Mac은 source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```
- 브라우저에서 http://localhost:8000/docs 가 열리면 성공
- 테스트: `pytest -v`
- 기본은 **모의 분석 모드**(API 키 없이 규칙 기반). 실제 AI를 쓰려면 `.env`에서
  `LLM_PROVIDER=openai`, `OPENAI_API_KEY=키` 로 바꾸고 서버를 다시 실행합니다.
- 다음부터는 `cd backend` → `source .venv/Scripts/activate` → `uvicorn app.main:app --reload` 만 하면 됩니다.

### 프론트엔드 (Git Bash 새 창)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
- http://localhost:5173 이 열리면 성공 (백엔드도 켜져 있어야 함)
- 휴대폰으로 보려면: 같은 와이파이에서 `npm run dev`에 표시되는 Network 주소로 접속
  (녹음 기능은 https 배포 후 휴대폰에서 동작합니다)

### 시연 문장 (순서대로 입력해 보세요)
1. `진료실은 3번입니다.` → 신규 저장
2. `5번 진료실은 지금 혼잡합니다.` → 단순 언급, 3번 유지
3. `진료실이 5번으로 변경되었습니다.` → 3번 → 5번 변경
4. `아마 진료실이 7번일 거예요.` → 확인 요청

시연 전에 실제 AI로 위 순서가 매번 맞는지 점검합니다 (backend 폴더, `.env`에 OpenAI 키 필요):
```bash
python -m scripts.demo_check --provider openai --repeat 5
python -m scripts.demo_check --base-url https://<배포 주소>   # 배포된 서버로 점검 (발표 직전, 서버 깨우기 겸)
```
시연 문장을 바꾸면 `backend/tests/fixtures/demo.json`도 함께 고쳐 주세요.

## 핵심 파일
| 파일 | 역할 |
|---|---|
| `backend/app/services/llm_extractor.py` | 안내에서 변경 후보 추출 (AI / 모의) |
| `backend/app/services/verifier.py` | ★ 규칙 검증: 반영·확인 요청·무시 결정 |
| `backend/app/prompts/extract.txt` | AI 프롬프트 |
| `backend/app/domains/*.json` | 분야별 추적 항목 (새 분야 = JSON 추가) |
| `backend/tests/fixtures/sentences.json` | 테스트 문장 세트 (정확도 측정용) |
| `frontend/src/pages/` | 화면 (시안 번호 주석 참고) |
| `docs/api.md` | 프론트·백엔드 약속 |
| `docs/deploy.md` | 배포 방법 (Neon + Render + Vercel) |
| `docs/evaluation.md` | 정확도 평가 결과 (발표용 비교표) |

## 브랜치 규칙
- `main`: 검증된 시연 버전 / `develop`: 통합 / `feature/fe-*`, `feature/be-*`: 기능 개발
- develop, main에 직접 push 불가 → feature 브랜치에서 PR, 1명 승인 후 병합
- 커밋: `feat:` 기능, `fix:` 버그, `docs:` 문서, `refactor:`, `chore:` 설정
