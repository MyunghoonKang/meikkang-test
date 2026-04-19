# 데모 리허설 체크리스트

## 사전 (데모 전날)
- [ ] 법인카드로 식사 결제 1건 완료 (데모 당일 카드내역 조회용) — Plan B 연동 시
- [ ] 아마란스 접속 + 로그인 동작 확인
- [ ] `npm run dev` 양쪽 다 기동, http://localhost:5173 접속
- [ ] 4대 PC 간 네트워크 연결 확인 (유선 권장)
- [ ] 샘플 게임 3종 플레이 테스트

## 데모 당일 시나리오 (모두 같은 `/room/XXXX` URL 안에서 진행됨)
1. 호스트 PC에서 `npm start` (prod 모드) 또는 `npm run dev`
2. 4대 PC에서 http://<host-ip>:3000 접속 (또는 5173)
3. 호스트: "방 만들기" → 룸 코드 공유 → 모두 `PREPARING` (LobbyView)
4. 3명: 룸 코드 입력 → 참여 → 여전히 `PREPARING`
5. 호스트: 게임 선택 → "시작" → 모두 `PLAYING` (GameView)
6. 각자 플레이 → 패자 결정 → 모두 `FINISHED` (ResultView, 패자 발표)
7. 패자: 인라인 CredentialForm에 ID/PW 입력 → 저장 → `CREDENTIAL_INPUT` → `QUEUED`
8. (데모) 패자: "지금 상신 실행" → `RUNNING` (워커 진행 단계 indicator) → `COMPLETED` (ERP 참조번호) 또는 `FAILED` (errorLog)

## 플랜 B (ERP 불안정 시)
- `.env`에 `MOCK_MODE=true` → Playwright 대신 사전 캡처 스크린샷 연출

## 서버 기동 확인
```bash
# 서버 상태 확인
curl http://localhost:3000/api/health
# 기대: {"ok":true}

# 게임 목록 확인
curl http://localhost:3000/api/games
# 기대: [{"id":"number-guess",...}]

# 게임 업로드 (운영자 사전 등록)
curl -F "file=@games/number-guess.html" http://localhost:3000/api/games
# 기대: 201 + JSON meta
```

## npm test 최종 확인
```bash
npm test
# 기대: 30 tests passing
```
