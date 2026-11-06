# 길기억 (Route Memory)

운전자가 놓쳤던 곳과 약한 회전 유형을 기억해, 처음 가는 길에서도 방향지시등이 꺼진 채 어려운 구간에 다가갈 때만 음성 한 문장으로 알려 주는 차량용 앱입니다. 일반 운전자부터 택시·화물·버스 기사까지 운전 유형별로 동작합니다.

## 현재 상태

이 저장소는 1차 서류 심사용 시제품입니다.

| 구분 | 상태 |
| --- | --- |
| 판단 규칙 (약한 유형 학습, 필요할 때만 말하기, 운전 유형 프로필) | 구현, 자동 테스트 통과 |
| 동반앱 시연 화면 (PC, Android) | 구현, 가상 신호로 동작 |
| Pleos Connect SDK 연동 | 미구현, 2차 PT 심사 전 진행 예정 |
| 표준 AAOS 에뮬레이터 (Android 15, API 35) | release APK 설치, 실행, 전체 장면 재생 확인 |
| Pleos Connect Emulator, 실차 구동 | 미검증 |
| 주행 중 동작 | 미구현. 앱이 DO를 선언하지 않아 주행 상태가 되면 시스템이 화면을 차단하고, 정차하면 돌아옵니다 |

시연 화면의 차량 신호와 내비게이션 정보는 모두 시뮬레이션입니다. 화면에도 항상 표시됩니다.

## 저장소 구성

| 경로 | 내용 |
| --- | --- |
| `android/` | Android Gradle 프로젝트 |
| `android/core/` | 판단 규칙 `DriveCoach`, 시연 장면 `CoachDemo` (순수 Java) |
| `android/coach/` | 동반앱 시연 화면 |
| `android/pleos/` | 제출용 앱. 위치·네트워크·차량 권한을 쓰지 않습니다 |
| `android/shared/`, `mobile/`, `automotive/` | 이전 단계의 지도 내비게이션 시제품 |
| `pc/` | PC 웹 시연. `src/coach.js`가 Android와 같은 규칙입니다 |
| `apk/` | 실행용 release APK |

## 실행 방법

### APK

Android Automotive 에뮬레이터 또는 기기에 설치합니다.

```
adb install apk/Sogangdai_길기억_release.apk
```

앱 목록에서 길기억을 열고 재생을 누르면 장면이 이어집니다. 아래 장면 버튼으로 원하는 장면을 바로 볼 수 있습니다.

### PC 웹 시연

Node.js 22 이상이 필요합니다. 별도 패키지 설치는 없습니다.

```
cd pc
npm test
npm run build
node serve.cjs
```

브라우저에서 `http://127.0.0.1:4173/`을 열고 왼쪽 메뉴의 동반앱 시연을 누릅니다.

### 소스에서 Android 빌드

JDK 17과 Android SDK 35가 필요합니다.

```
cd android
./gradlew :core:verifyCoach :coach:testDebugUnitTest :pleos:assembleDebug
```

서명된 release APK를 만들려면 `keystore.properties.example`을 참고해 `keystore.properties`를 만든 뒤 `:pleos:assembleRelease`를 실행합니다.

## 테스트 환경 및 필요한 설정

- Android 10(API 29) 이상. 앱은 Automotive 기기를 대상으로 선언되어 있습니다.
- 실행 확인 환경: Android Automotive 에뮬레이터 (Android 15, API 35, x86_64, 1024×768). 시연은 정차 상태에서 합니다.
- 빌드 도구: Gradle 8.11.1, Android Gradle Plugin 8.9.1, Java 17
- 자동 테스트: JUnit, Robolectric, Node.js 내장 테스트
- 음성 알림은 기기의 Android 음성 합성을 사용합니다. 한국어 음성이 없으면 화면으로만 표시됩니다.
- API 키나 계정 설정은 필요하지 않습니다.

## APK 파일 위치

`apk/Sogangdai_길기억_release.apk`

## 라이선스

사용한 오픈소스와 지도·데이터의 출처는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다.
