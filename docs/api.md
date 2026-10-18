# ChangeWatch API 명세 (v0.2)

> v0.2 변경: 할 일(todos), 내 차례 알림(my_number·my_name, my_turn) 추가.
> DB 테이블 구조가 바뀌었으므로 **로컬 `backend/changewatch.db`를 지우고** 서버를 다시 실행하세요.

- 기본 주소: `http://localhost:8000/api`
- 백엔드를 실행하면 `http://localhost:8000/docs` 에서 직접 호출해 볼 수 있습니다.
- 이 문서를 바꿀 때는 프론트(`frontend/src/types/index.ts`)와 백엔드(`backend/app/schemas/`)를 같이 바꿉니다.

## 공통 값

| change_type | 의미 | 예시 |
|---|---|---|
| `new` | 처음 나온 정보 | "진료실은 3번입니다" |
| `change` | 기존 정보 변경 | "진료실이 5번으로 변경되었습니다" |
| `correction` | 정정 | "10시가 아니라 11시입니다" |
| `cancel` | 취소 | "오늘 검사는 취소되었습니다" |
| `mention` | 단순 언급 (반영 안 함) | "5번 진료실은 혼잡합니다" |
| `uncertain` | 불확실 (확인 요청) | "아마 5번일 거예요" |

| status | 의미 |
|---|---|
| `applied` | 현재 정보에 반영됨 |
| `pending` | 사용자 확인 필요 |
| `ignored` | 반영하지 않음 (단순 언급, 같은 값 등) |
| `rejected` | 사용자가 거절함 |

## 1. 방문 세션 만들기
`POST /sessions`
```json
// 요청 (my_number, my_name은 선택. 내 차례 알림에 사용)
{ "title": "오늘 병원 방문", "domain": "hospital", "my_number": "37", "my_name": null }
// 응답 201
{
  "id": "a1b2...", "title": "오늘 병원 방문", "domain": "hospital",
  "my_number": "37", "my_name": null, "created_at": "2026-10-17T10:00:00",
  "facts": [], "todos": []
}
```

## 2. 세션 조회 (현재 유효한 정보 + 할 일)
`GET /sessions/{session_id}`
```json
{
  "id": "a1b2...", "title": "오늘 병원 방문", "domain": "hospital",
  "my_number": "37", "my_name": null, "created_at": "...",
  "facts": [ { "key": "room", "label": "진료실", "value": "5번", "updated_at": "..." } ],
  "todos": [ { "id": 1, "text": "처방전을 약국에 제출하기", "evidence": "처방전은 약국에 제출하세요.", "done": false, "created_at": "..." } ]
}
```

## 2-1. 내 번호·이름 바꾸기
`PATCH /sessions/{session_id}`
```json
// 요청: 보낸 필드만 바뀜. 빈 문자열 ""은 지우기
{ "my_number": "42" }
// 응답: 세션 (2번과 같은 형식)
```

## 3. 안내 분석 ★
`POST /sessions/{session_id}/announcements`
```json
// 요청
{ "text": "진료실이 5번으로 변경되었습니다." }
// 응답 200
{
  "announcement_id": 2,
  "text": "진료실이 5번으로 변경되었습니다.",
  "needs_confirmation": false,
  "changes": [
    {
      "id": 2, "key": "room", "label": "진료실",
      "old_value": "3번", "new_value": "5번",
      "change_type": "change", "evidence": "진료실이 5번으로 변경되었습니다.",
      "confidence": 0.9, "status": "applied", "reason": "변경 내용을 반영했습니다",
      "created_at": "..."
    }
  ],
  "todos": [],
  "my_turn": null
}
```
- `todos`: 이번 안내에서 **새로** 생긴 할 일만. 전체 목록은 2번 세션 조회의 `todos`.
  원문에 근거가 없거나 이미 있는 할 일은 저장하지 않습니다.
- `my_turn`: 내 번호·이름이 불렸을 때만 채워짐. 프론트는 이 값이 있으면 화면·소리·진동으로 알립니다.
  ```json
  { "matched": "37번", "evidence": "37번 환자분 3번 진료실로 오세요." }
  ```
  "137번", "370번"은 37번으로 보지 않습니다.

- AI 응답 형식이 조금 틀리면 고칠 수 있는 후보는 고쳐 쓰고, 고칠 수 없는 후보만 버립니다.
- AI 분석 자체가 실패하면(OpenAI 오류·한도 초과·JSON 아님) 에러 대신 **모의 분석기 결과로 응답**합니다.
  결과는 똑같이 verifier를 거칩니다. (시연 중 502로 멈추지 않게)

## 4. 음성 → 텍스트
`POST /sessions/{session_id}/transcribe` (multipart/form-data, 필드 이름 `file`)
```json
{ "text": "진료실이 5번으로 변경되었습니다." }
```
- 실패 시 상태 코드와 한국어 `detail`. 프론트는 `detail`을 보여주고 텍스트 입력으로 안내합니다.
  | 코드 | 상황 |
  |---|---|
  | `501` | OpenAI 키 없음 |
  | `400` | 빈 녹음 파일 |
  | `413` | 25MB 초과 |
  | `502` | 음성 인식 서버 오류 (네트워크·한도 초과 등) |
  | `422` | 인식 결과가 비어 있음 |
- 분석은 하지 않습니다. 프론트가 받은 텍스트로 3번 API를 이어서 호출합니다.

## 4-1. 대기 모드 듣기 (초안)
`POST /sessions/{session_id}/listen` (multipart/form-data)
| 필드 | 내용 |
|---|---|
| `file` | 음성 조각 (20~30초, 앞 조각과 2~3초 겹치게) |
| `prev_text` | 선택. 직전 응답의 `text` (경계에서 잘린 문장 보완·겹친 문장 제거용) |

```json
// 응답 200
{
  "text": "37번 환자분 3번 진료실로 오세요.",
  "skipped": false,
  "my_turn": { "matched": "37번", "evidence": "37번 환자분 3번 진료실로 오세요." },
  "analysis": { ... 3번 안내 분석 응답과 같은 형식 ... }
}
```
- 서버 처리 순서: 음성 인식 → 잡음 문장 제거 → 직전 조각과 겹친 문장 제거 → 내 차례 확인 → **안내 키워드가 있을 때만** AI 분석
- `skipped: true`: 조용하거나 새로 들린 내용이 없음. `text`는 빈 문자열, 나머지는 null
- `my_turn`이 있으면 즉시 알림 (AI 분석을 기다리지 않음)
- `analysis`가 null이면 저장된 것 없음 (AI 호출 생략)
- 에러는 4번과 같음 (단, 인식 결과가 비면 422 대신 `skipped: true`)
- 프론트가 할 일: 무음 구간은 보내지 않기(음량 확인), 화면 꺼짐 방지(Wake Lock), 앱 전환 감지

## 5. 변경 이력
`GET /sessions/{session_id}/history` → `Change[]` (최신순)

## 6. 확인 요청 승인·거절
`POST /changes/{change_id}/confirm`
```json
// 요청
{ "approve": true }
// 응답: 처리된 Change (status가 applied 또는 rejected로 바뀜)
```
- 이미 처리된 변경이면 `409`.

## 7. 할 일 체크
`PATCH /todos/{todo_id}`
```json
// 요청
{ "done": true }
// 응답: 바뀐 Todo
{ "id": 1, "text": "처방전을 약국에 제출하기", "evidence": "처방전은 약국에 제출하세요.", "done": true, "created_at": "..." }
```
- 없는 할 일이면 `404`.

## 읽어주기 (TTS)
- 서버 API 없음. 프론트에서 브라우저 `speechSynthesis`로 `changes`의 내용을 읽습니다.

## 에러 형식
```json
{ "detail": "세션을 찾을 수 없습니다" }
```
