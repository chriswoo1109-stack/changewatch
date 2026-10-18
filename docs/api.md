# ChangeWatch API 명세 (v0.1)

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
// 요청
{ "title": "오늘 병원 방문", "domain": "hospital" }
// 응답 201
{ "id": "a1b2...", "title": "오늘 병원 방문", "domain": "hospital", "created_at": "2026-10-17T10:00:00", "facts": [] }
```

## 2. 세션 조회 (현재 유효한 정보)
`GET /sessions/{session_id}`
```json
{
  "id": "a1b2...", "title": "오늘 병원 방문", "domain": "hospital", "created_at": "...",
  "facts": [ { "key": "room", "label": "진료실", "value": "5번", "updated_at": "..." } ]
}
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
  ]
}
```

- AI 분석이 실패하면(OpenAI 오류, 응답 형식 오류) `502` + `"AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요"`.
  이때 안내 원문과 변경 이력은 저장되지 않으므로, 프론트는 같은 텍스트로 다시 시도하게 하면 됩니다.

## 4. 음성 → 텍스트
`POST /sessions/{session_id}/transcribe` (multipart/form-data, 필드 이름 `file`)
```json
{ "text": "진료실이 5번으로 변경되었습니다." }
```
- OpenAI 키가 없으면 `501` + 안내 메시지. 프론트는 텍스트 입력으로 안내합니다.
- 분석은 하지 않습니다. 프론트가 받은 텍스트로 3번 API를 이어서 호출합니다.

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

## 에러 형식
```json
{ "detail": "세션을 찾을 수 없습니다" }
```
