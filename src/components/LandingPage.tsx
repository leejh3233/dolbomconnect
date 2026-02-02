'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LandingPage({ initialPartnerName }: { initialPartnerName?: string }) {
    const searchParams = useSearchParams();
    const [empId, setEmpId] = useState('본사');
    const [source, setSource] = useState('직접유입');
    const [formData, setFormData] = useState({
        area: '',
        aptName: '',
        pyeong: '',
        scope: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialPartnerName) {
            const decoded = decodeURIComponent(initialPartnerName);
            // Verify partner existence
            fetch(`/api/partners/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: decoded })
            }).then(res => {
                if (res.ok) {
                    setEmpId(decoded);
                    setSource('개인브랜드');
                } else {
                    // If not exists or error, fallback to 본사
                    setEmpId('본사');
                    setSource(`개인브랜드(미등록:${decoded})`);
                }
            }).catch(() => {
                setEmpId('본사');
                setSource(`개인브랜드(오류:${decoded})`);
            });
        } else {
            const sid = searchParams.get('sid');
            if (sid) {
                fetch(`/api/sid-lookup?sid=${sid}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.empId) {
                            setEmpId(data.empId);
                            setSource(data.source || '단축링크');
                        }
                    })
                    .catch(err => console.error('SID lookup failed:', err));
            } else {
                const pEmpId = searchParams.get('empId');
                const pPartner = searchParams.get('partner');
                const pSource = searchParams.get('source');

                if (pEmpId || pPartner) setEmpId(pEmpId || pPartner || '본사');
                if (pSource) setSource(pSource);
            }
        }
    }, [searchParams, initialPartnerName]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const submitForm = async () => {
        const { area, aptName, pyeong, scope } = formData;

        if (!area || !aptName || !pyeong || !scope) {
            alert("모든 항목을 입력해주세요! 😊");
            return;
        }

        const copyText = `🏠 돌봄매트 견적 문의 (추천인 혜택 적용)

📍 상담 정보
- 지역: ${area}
- 아파트명: ${aptName}
- 평수: ${pyeong}
- 시공범위: ${scope}
- 추천인: ${empId}

🎁 확보하신 추천인 혜택
✅ 공구가 자동 적용: 장당 15,500원
✅ 전문 시공비 혜택: 300,000원 상당(100장이상)
✅ 시크릿 쿠폰팩 증정: 80,000원 (웰컴3만+추천인5만(지인쿠폰중복X))

━━━━━━━━━━━━━━━━

위 혜택으로 상담 부탁드립니다!`;

        try {
            await navigator.clipboard.writeText(copyText);
            alert("🎉 상담내용이 복사되었습니다!\n카톡창에 '붙여넣기' 하시면 시크릿혜택 8만원이 적용됩니다.");
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }

        setIsSubmitting(true);
        const kakaoUrl = "https://pf.kakao.com/_UMyBK/chat";

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, empId, source })
            });
            if (!response.ok) {
                const errorData = await response.json();
                alert(`저장 실패: ${errorData.error}\n(시트의 항목 이름이 일치하는지 확인해주세요)`);
            }
        } catch (err) {
            console.error('Save lead failed:', err);
            alert("서버 연결 실패. 네트워크를 확인해주세요.");
        }


        window.location.href = kakaoUrl;
    };

    return (
        <main className="bg-gradient-to-br from-blue-50 to-gray-100 min-h-[100dvh] flex items-center justify-center p-4">
            <div className="card w-full max-w-md bg-white rounded-3xl premium-shadow overflow-hidden relative border border-white">
                {/* Top Banner */}
                <div className="bg-blue-600 px-6 py-4 text-white text-center">
                    <div className="inline-block bg-blue-500 bg-opacity-30 rounded-full px-3 py-1 text-xs font-semibold mb-1 tracking-wide">
                        ✨ 프리미엄 층간소음 매트
                    </div>
                    <h2 className="text-xl font-bold tracking-tight">돌봄매트 간편 견적</h2>
                </div>

                <div className="p-8">
                    <div className="text-center mb-8">
                        <p className="text-gray-600 text-sm leading-relaxed">
                            아래 내용을 입력하시면 상담 정보가 복사되어<br />
                            <b className="text-blue-600">카카오톡 전문 상담</b>으로 즉시 연결됩니다.
                        </p>

                        {/* Benefit Badge */}
                        {empId !== "본사" ? (
                            <div className="mt-4 inline-flex flex-col items-center gap-2">
                                <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-4 py-2 rounded-lg">
                                    <span className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                    </span>
                                    <span className="text-xs font-bold text-blue-700">시크릿 혜택 적용중</span>
                                </div>
                                {initialPartnerName && (
                                    <p className="text-[10px] text-slate-400 font-bold">
                                        <span className="text-blue-600">{empId}</span> 파트너님의 특별 페이지입니다.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="mt-4 inline-flex items-center gap-2 bg-slate-50 border border-slate-100 px-4 py-2 rounded-lg">
                                <span className="text-xs font-bold text-slate-400">일반 혜택 적용중</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">지역</label>
                            <input
                                type="text"
                                id="area"
                                value={formData.area}
                                onChange={handleChange}
                                placeholder="예: 서울, 부산"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">아파트명</label>
                            <input
                                type="text"
                                id="aptName"
                                value={formData.aptName}
                                onChange={handleChange}
                                placeholder="예: 롯데캐슬"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">평수</label>
                            <input
                                type="text"
                                id="pyeong"
                                value={formData.pyeong}
                                onChange={handleChange}
                                placeholder="예: 34평"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">시공 희망 범위</label>
                            <input
                                type="text"
                                id="scope"
                                value={formData.scope}
                                onChange={handleChange}
                                placeholder="예: 거실+복도"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">추천인 (할인 혜택 포함)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    id="empId"
                                    value={empId}
                                    readOnly
                                    className="w-full px-4 py-3 bg-blue-50 border border-blue-100 text-blue-800 font-bold rounded-xl focus:outline-none pointer-events-none text-sm"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        id="btnSubmit"
                        onClick={submitForm}
                        className="w-full mt-8 bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] font-bold py-4 rounded-xl shadow-sm transition-all transform active:scale-95 flex items-center justify-center gap-2 text-[16px]"
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                연결 중... (안될 시 클릭)
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 5.92 2 10.75c0 2.8 1.5 5.25 3.84 6.83-.16.6-.58 2.17-.66 2.5-.1.35.13.35.27.25.11-.08 1.57-1.07 2.18-1.5 1.55.45 3.2.7 4.9.7 5.52 0 10-3.92 10-8.75S15.52 2 12 2z" />
                                </svg>
                                카톡 채널 상담 바로가기
                            </>
                        )}
                    </button>

                    <p className="text-[11px] text-gray-400 text-center mt-4">
                        *지금 링크로 연결시 추천인 혜택이 자동 적용됩니다.
                    </p>
                </div>
            </div>
        </main>
    );
}
