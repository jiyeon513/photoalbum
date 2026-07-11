// Firebase 콘솔(https://console.firebase.google.com)에서 프로젝트 생성 후
// 프로젝트 설정 → 앱 추가 → 웹 → firebaseConfig 값을 아래에 붙여넣으세요.
// 이 파일을 firebase-config.js 로 복사한 뒤 값을 채우면 됩니다.

window.firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Firestore 규칙 (Firebase 콘솔 → Firestore → 규칙):
//   match /sharedPhotos/{photoId} { allow read, write: if true; }
//
// Storage 규칙 (Firebase 콘솔 → Storage → 규칙):
//   match /shared/{albumId}/{fileName} { allow read, write: if true; }
//
// 가족만 쓰는 앱이라 우선 전체 공개로 두었습니다.
// 나중에 Firebase Authentication으로 가족 계정을 추가하는 것을 권장합니다.
