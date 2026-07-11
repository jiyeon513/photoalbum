param(
  [string]$ProjectId = "photoalbum-jiyeon513"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Firebase 로그인 확인 중..."
firebase login:list | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Firebase 로그인이 필요합니다. 브라우저에서 로그인 후 다시 실행해 주세요."
  Start-Process firebase -ArgumentList "login" -Wait
}

$projects = firebase projects:list --json | ConvertFrom-Json
$existing = $projects.result | Where-Object { $_.projectId -eq $ProjectId }

if (-not $existing) {
  Write-Host "Firebase 프로젝트 생성: $ProjectId"
  firebase projects:create $ProjectId --display-name "가족 앨범"
}

firebase use $ProjectId

Write-Host "Firestore 데이터베이스 확인..."
firebase firestore:databases:create --location=asia-northeast3 --project $ProjectId 2>$null | Out-Null

Write-Host "Firestore / Storage 규칙 배포..."
firebase deploy --only firestore:rules,storage --project $ProjectId

Write-Host "웹 앱 등록 및 설정 추출..."
$appsJson = firebase apps:list WEB --project $ProjectId --json | ConvertFrom-Json
$appId = $appsJson.result[0].appId

if (-not $appId) {
  firebase apps:create WEB "photoalbum-web" --project $ProjectId | Out-Null
  $appsJson = firebase apps:list WEB --project $ProjectId --json | ConvertFrom-Json
  $appId = $appsJson.result[0].appId
}

$sdk = firebase apps:sdkconfig WEB $appId --project $ProjectId --json | ConvertFrom-Json
$config = $sdk.result.sdkConfig

$configJs = @"
window.firebaseConfig = {
  apiKey: "$($config.apiKey)",
  authDomain: "$($config.authDomain)",
  projectId: "$($config.projectId)",
  storageBucket: "$($config.storageBucket)",
  messagingSenderId: "$($config.messagingSenderId)",
  appId: "$($config.appId)"
};
"@

Set-Content -Path (Join-Path $Root "firebase-config.js") -Value $configJs -Encoding UTF8
Set-Content -Path (Join-Path $Root ".firebaserc") -Value "{ `"projects`": { `"default`": `"$ProjectId`" } }" -Encoding UTF8

Write-Host "Firebase Hosting 배포..."
firebase deploy --only hosting --project $ProjectId

Write-Host ""
Write-Host "배포 완료!"
Write-Host "사이트: https://$ProjectId.web.app"
Write-Host "firebase-config.js 가 자동으로 업데이트되었습니다."
