# Local Atlas

위치 기반 로컬 아지트 탐험 앱입니다. 사용자는 지도에 숨겨진 장소 캡슐을 매설하고, 다른 사용자는 실제 위치 근처에서 서버 검증을 통과해야 숨겨진 메시지를 열 수 있습니다.

## 실행

```bash
npm install
npm run dev
```

## 테스트 배포 체크리스트

1. `.env.example`을 기준으로 배포 플랫폼에 환경변수를 등록합니다.
2. Kakao Developers의 Web 플랫폼 도메인에 로컬 주소와 테스트 배포 도메인을 등록합니다.
3. `supabase/migrations/202604270001_test_deploy_core.sql`을 Supabase SQL editor 또는 Supabase CLI로 적용합니다. 기존 `public.mylocalplace`는 `public.mlp_mylocalplace`로 rename하고, 모든 앱 테이블은 `mlp_` prefix를 사용합니다.
4. `supabase/migrations/202604270002_harden_mlp_permissions.sql`을 이어서 적용합니다. 발견 기록은 RPC만 쓸 수 있게 잠그고, 프로필/캡슐 권한을 컬럼 단위로 제한합니다.
5. Supabase Auth에서 Email/Password 로그인을 켜고, Site URL과 Redirect URL에 테스트 배포 도메인을 등록합니다.
6. HTTPS 배포 환경에서 위치 권한, 지도 로딩, 회원가입, 아지트 매설, 현장 언락을 확인합니다.

## 환경변수

```bash
VITE_KAKAO_API_KEY=your_kakao_javascript_key_here
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 핵심 데이터 모델

- `mlp_profiles`: 사용자 프로필, 에너지, 마스터 키, Pro 여부
- `mlp_mylocalplace`: 지도에 표시되는 아지트 캡슐. 기존 `mylocalplace.id int8` 기본키를 유지합니다.
- `mlp_capsule_discoveries`: 사용자의 캡슐 발견 기록
- `mlp_capsule_reports`: 사용자 신고 기록
- `mlp_verify_and_unlock`: 현재 좌표와 캡슐 좌표를 서버에서 비교해 잠금 해제 처리

## 검증 명령

```bash
npm run lint
npm run build
```

## 현재 제한사항

상점은 테스트 모드입니다. 실제 결제 승인, 영수증 검증, 아이템 지급은 아직 결제 서버와 연결되어 있지 않습니다.
