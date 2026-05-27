# Local Atlas

직접 가야 열리는 로컬 캡슐 지도입니다. 사용자는 지도에서 장소 캡슐을 발견하고, 실제 위치 근처에서 서버 검증을 통과해야 숨겨진 메시지를 열 수 있습니다.

## MVP 핵심 루프

1. 지도에서 캡슐 발견
2. 실제 장소로 이동
3. 현장 위치 인증
4. 숨겨진 메시지 열람
5. 발견 기록 저장
6. 공유

## 실행

```bash
npm install
npm run dev
```

## Android 앱 테스트

Capacitor로 Vite 빌드를 Android 앱에 패키징합니다.

```bash
npm run cap:sync
npm run cap:open:android
```

Android Studio에서 기기 또는 에뮬레이터를 선택한 뒤 Run을 누릅니다. CLI로 바로 실행할 때는 다음 명령을 사용합니다.

```bash
npm run cap:run:android
```

Kakao Developers의 Web 플랫폼 도메인에는 Capacitor Android WebView origin인 `https://localhost`도 등록합니다.

## Android 개발모드

USB로 연결된 기기 또는 에뮬레이터에서 Vite 개발 서버를 보게 실행합니다. 저장할 때마다 WebView가 갱신됩니다.

터미널 1:

```bash
npm run dev:android
```

터미널 2:

```bash
npm run cap:dev:android:usb
```

Wi-Fi로 직접 접근시키려면 PC와 기기를 같은 네트워크에 두고 개발 서버를 외부 접속 가능하게 실행합니다.

터미널 1:

```bash
npm run dev:host -- --port 5174 --strictPort
```

터미널 2:

```bash
npx cap run android -l --host 192.168.0.103 --port 5174
```

IP가 바뀌면 `192.168.0.103` 부분을 현재 Mac의 Wi-Fi IP로 바꿉니다. Kakao Developers의 JavaScript SDK 도메인에는 `http://192.168.0.103:5174`도 등록합니다.

## 테스트 배포 체크리스트

1. `.env.example`을 기준으로 배포 플랫폼에 환경변수를 등록합니다.
2. Kakao Developers의 Web 플랫폼 도메인에 로컬 주소와 테스트 배포 도메인을 등록합니다.
3. `supabase/migrations/202604270001_test_deploy_core.sql`을 Supabase SQL editor 또는 Supabase CLI로 적용합니다. 기존 `public.mylocalplace`는 `public.mlp_mylocalplace`로 rename하고, 모든 앱 테이블은 `mlp_` prefix를 사용합니다.
4. `supabase/migrations/202604270002_harden_mlp_permissions.sql`을 이어서 적용합니다. 발견 기록은 RPC만 쓸 수 있게 잠그고, 프로필/캡슐 권한을 컬럼 단위로 제한합니다.
5. Supabase Auth에서 Email/Password 로그인을 켜고, Site URL과 Redirect URL에 테스트 배포 도메인을 등록합니다.
6. HTTPS 배포 환경에서 위치 권한, 지도 로딩, 회원가입, 캡슐 생성, 현장 언락을 확인합니다.

## MVP 테스트 체크리스트

1. 로그인과 회원가입이 정상 동작하는지 확인합니다.
2. Kakao 지도가 정상 로딩되는지 확인합니다.
3. 위치 권한 허용/거부 상태에서 안내 문구가 적절히 보이는지 확인합니다.
4. 캡슐 생성 시 제목, 숨겨진 메시지, 카테고리, 위치 좌표 검증이 동작하는지 확인합니다.
5. 지도 마커 클릭 시 캡슐 제목, 카테고리, 거리, 언락 반경, 난이도, 남은 열람 수가 보이는지 확인합니다.
6. 현장 인증 성공/실패 흐름과 `mlp_verify_and_unlock` RPC 응답 처리를 확인합니다.
7. 언락 성공 후 공유 문구 복사가 동작하는지 확인합니다.
8. 신고 접수가 `mlp_capsule_reports`에 저장되는지 확인합니다.
9. 대시보드에서 내 발견 기록과 내가 만든 캡슐이 실제 데이터로 보이는지 확인합니다.

## 환경변수

```bash
VITE_KAKAO_API_KEY=your_kakao_javascript_key_here
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 핵심 데이터 모델

- `mlp_profiles`: 사용자 프로필과 이후 확장용 상태값
- `mlp_mylocalplace`: 지도에 표시되는 로컬 캡슐. 기존 `mylocalplace.id int8` 기본키를 유지합니다.
- `mlp_capsule_discoveries`: 사용자의 캡슐 발견 기록
- `mlp_capsule_reports`: 사용자 신고 기록
- `mlp_verify_and_unlock`: 현재 좌표와 캡슐 좌표를 서버에서 비교해 잠금 해제 처리

## 검증 명령

```bash
npm run lint
npm run build
```

## 현재 제한사항

현재 MVP에서는 아래 기능을 전면 노출하지 않습니다.

- 실제 결제
- 상점/Pro 패스
- 공개 캡슐 승인 시스템
- 브랜드 캠페인 관리
- 쿠폰 실정산
