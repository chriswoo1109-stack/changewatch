# 배포 가이드 (Neon + Render + Vercel)

순서: **① Neon(DB) → ② Render(백엔드) → ③ Vercel(프론트) → ④ CORS 연결 → ⑤ 확인**
모두 무료이고 GitHub 계정으로 가입합니다. 예상 시간 1~2시간.

> API 키·DB 주소는 각 서비스 화면에만 입력합니다. 저장소에 절대 커밋하지 않습니다.

## ① Neon — PostgreSQL DB
1. https://neon.tech 가입 → **Create project** (이름 `changewatch`, 지역 **Asia Pacific (Singapore)**)
2. 대시보드의 **Connection string** 복사
   - 형식: `postgresql://사용자:비밀번호@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   - 그대로 붙여넣으면 됩니다. 코드가 `postgresql+psycopg://`로 바꿔 줍니다.
3. 테이블은 백엔드가 처음 실행될 때 자동으로 만들어집니다.

## ② Render — 백엔드
1. https://render.com 가입 → **New → Blueprint** → 이 저장소 선택
   - 저장소 루트의 `render.yaml`을 읽어 설정이 자동으로 채워집니다. (배포 브랜치: `main`. 중간발표 전까지는 `develop`이었음)
2. 입력 칸이 나오면 값 입력
   | 키 | 값 |
   |---|---|
   | `OPENAI_API_KEY` | OpenAI 키 |
   | `DATABASE_URL` | ①에서 복사한 Neon 주소 |
   | `CORS_ORIGINS` | 지금은 비워 두거나 `http://localhost:5173` → ④에서 수정 |
   | `CORS_ORIGIN_REGEX` | 비워 두기 (선택) |
3. **Apply** → 첫 빌드 5~10분
4. 완료 후 주소 확인: `https://changewatch-api.onrender.com/api/health`
   → `{"status":"ok","llm_provider":"openai"}` 이면 성공

## ③ Vercel — 프론트
1. https://vercel.com 가입 → **Add New → Project** → 이 저장소 Import
2. 설정
   - **Root Directory**: `frontend` (Edit 눌러 선택)
   - Framework: Vite (자동 인식)
   - **Environment Variables**: `VITE_API_URL` = ②의 Render 주소 (`https://changewatch-api.onrender.com`, 끝에 `/` 없이)
3. **Deploy** → 1~2분
4. 배포 주소 확인 (예: `https://changewatch.vercel.app`)
5. 배포 브랜치: Settings → Git → **Production Branch**를 `main`으로 (develop 변경은 develop → main PR로 반영)

## ④ CORS 연결
Render → 서비스 → **Environment** → `CORS_ORIGINS` 수정
```
https://changewatch.vercel.app,http://localhost:5173
```
저장하면 자동 재배포됩니다. (주소는 ③에서 받은 실제 주소로)

PR마다 생기는 Vercel 미리보기 주소도 허용하려면 `CORS_ORIGIN_REGEX`에:
```
https://changewatch-.*\.vercel\.app
```

## ⑤ 확인
- [ ] PC 브라우저에서 Vercel 주소 접속 → 새 방문 시작 → 문장 입력 → 결과 화면
- [ ] `/session` 화면에서 새로고침해도 404가 안 남 (`frontend/vercel.json`)
- [ ] 휴대폰에서 접속 → **녹음** → 결과 (https라 마이크 동작)
- [ ] 브라우저 개발자 도구 Console에 CORS 에러 없음
- [ ] **시연 문장 점검**: 내 컴퓨터의 `backend` 폴더에서 배포 서버로 시연 시나리오를 보내 봅니다
  ```bash
  python -m scripts.demo_check --base-url https://<Render 주소> --repeat 2
  ```
  `AI 설정: openai`, `단계 통과: 20/20`이 나오면 정상입니다. 첫 줄의 "서버 응답" 시간이 잠든 서버를 깨우는 시간입니다.
  (점검용 세션은 배포 DB에 `[시연 점검]` 제목으로 남습니다. 요금 보호(같은 접속 1분 20회)에 걸리지 않게
  분석 요청을 1분 18번 이하로 나눠 보내므로 `--repeat 2`는 1분 남짓 걸리고, 하루 AI 한도에서 20회를 씁니다)

## 자주 나는 문제
| 증상 | 원인·해결 |
|---|---|
| 첫 요청이 30초~1분 걸림 | Render 무료 서버가 15분 미사용 시 잠듦. 발표 전에 `/api/health`로 미리 깨우기 |
| 프론트에서 "서버에 연결할 수 없습니다" | `VITE_API_URL` 오타, 또는 CORS. Vercel 환경변수를 바꾼 뒤에는 **Redeploy** 필요 |
| Console에 `CORS policy` 에러 | `CORS_ORIGINS`에 Vercel 주소가 정확히(https, 끝 `/` 없이) 들어갔는지 확인 |
| Render 빌드 실패 | Render → Logs 확인. Python 버전은 `render.yaml`의 `PYTHON_VERSION` |
| DB 구조를 바꿨는데 에러 | Neon 대시보드 → SQL Editor에서 테이블 삭제 후 재배포 (데이터 사라짐, 시연 전에만) |
| 음성 인식 501 | Render에 `OPENAI_API_KEY`가 없음 |
| 점검에서 `AI 설정: mock` 경고 | Render 환경변수 `LLM_PROVIDER=openai`, `OPENAI_API_KEY` 확인 후 재배포 |
| 결과가 이상한데 AI 설정은 openai | 실행 중 AI 호출이 실패하면 모의 분석기로 대체됩니다. Render → Logs에서 "AI 분석 실패 → 모의 분석기로 대체" 확인 |
