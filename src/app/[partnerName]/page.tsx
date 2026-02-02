import { Suspense } from 'react';
import LandingPage from '@/components/LandingPage';

interface PageProps {
    params: {
        partnerName: string;
    };
}

export default function PartnerLandingPage({ params }: PageProps) {
    // Next.js automatically decodes URL parameters, but decodeURIComponent is safer for various environments
    const decodedName = decodeURIComponent(params.partnerName);

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LandingPage initialPartnerName={decodedName} />
        </Suspense>
    );
}
