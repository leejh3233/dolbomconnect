import { Suspense } from 'react';
import LandingPage from '@/components/LandingPage';

export default function HomePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LandingPage />
    </Suspense>
  );
}
