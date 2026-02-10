---
description: Vercel 프로덕션 배포 워크플로우
---

# Vercel 프로덕션 배포

## 배포 절차

// turbo-all

1. 빌드 검증
```
npm run build
```

2. Git 커밋 및 푸시
```
git add -A; git commit -m "<커밋 메시지>"; git push
```

3. Vercel 프로덕션 배포
```
npx vercel --prod
```

## 참고사항
- Vercel 프로젝트의 Production Branch가 `main`이 아닌 경우, `git push`만으로는 프리뷰 배포만 됨
- 프로덕션 배포를 위해서는 `npx vercel --prod` 명령어를 사용하거나, Vercel 대시보드에서 프리뷰를 "Promote to Production" 해야 함
- 또는 Vercel 대시보드 > Settings > Git > Production Branch를 `main`으로 변경하면 push만으로 자동 프로덕션 배포 가능
