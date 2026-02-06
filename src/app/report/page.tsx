"use client";

import React, { useState, useEffect } from "react";

export default function ReportPage() {
    const [partners, setPartners] = useState<string[]>([]);
    const [aptList, setAptList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [form, setForm] = useState({
        시공일자: new Date().toISOString().slice(0, 10),
        추천인: "없음",
        시공팀원: "",
        지역: "",
        아파트명: "",
        동호수: "",
        연락처: "",
        평수: "",
        신축여부: "",
        결제방법: "",
        색상: "모던",
        판매갯수: "",
        판매비용: "",
        미결제금액: "",
        예약금현금영수증: "",
        특이사항: "",
    });

    const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
    const scopes = ["거실", "복도", "주방", "아일랜드", "아이방", "안방", "알파룸", "방1", "방2", "집전체", "기타"];

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://dolbomconnect.vercel.app";

    // 1. 추천인 목록 가져오기
    useEffect(() => {
        fetch(`${backendUrl}/api/leads?type=partners`)
            .then(res => res.json())
            .then(data => {
                if (data.partners) {
                    setPartners(["없음", ...data.partners.filter((p: string) => p !== "없음")]);
                }
            })
            .catch(err => console.error("추천인 로드 실패:", err));
    }, [backendUrl]);

    // 2. 추천인 입력 시 아파트 목록 즉시 가져오기 (타이핑 대응)
    useEffect(() => {
        const recommender = form.추천인.trim();
        // 2글자 이상 입력되었을 때만 검색 (성능 및 정확도)
        if (recommender.length >= 2 && recommender !== "없음") {
            setIsLoading(true);
            fetch(`${backendUrl}/api/leads?type=apartments&recommender=${encodeURIComponent(recommender)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.apartments) {
                        setAptList(data.apartments);
                    }
                })
                .catch(err => {
                    console.error("아파트 목록 로드 실패:", err);
                    setAptList([]);
                })
                .finally(() => setIsLoading(false));
        } else {
            setAptList([]);
        }
    }, [form.추천인, backendUrl]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleScopeChange = (scope: string) => {
        setSelectedScopes(prev =>
            prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
        );
    };

    const generateResult = () => {
        const scopeString = selectedScopes.join(", ");
        return `📋 시공보고서
1. 시공일자 : ${form.시공일자}
2. 추천인 : ${form.추천인}
3. 시공팀원 : ${form.시공팀원}
4. 지역 : ${form.지역}
5. 아파트명 : ${form.아파트명}
6. 동호수 : ${form.동호수}
7. 연락처 : ${form.연락처}
8. 평수 : ${form.평수}
9. 시공범위 : ${scopeString}
10. 신축여부 : ${form.신축여부}
11. 결제방법 : ${form.결제방법}
12. 색상 : ${form.색상}
13. 판매갯수 : ${form.판매갯수}
14. 판매비용 : ${form.판매비용}
15. 미결제금액 : ${form.미결제금액}
16. 예약금 현금영수증 : ${form.예약금현금영수증}
17. 특이사항 : ${form.특이사항}`;
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(generateResult());
        alert("복사 완료!");
    };

    const handleSend = async () => {
        // ⚠️ 전송 전 유효성 검사 (데이터 전송 전에 먼저 확인!)
        if (form.추천인 && form.추천인 !== "없음" && form.추천인.trim().length >= 2) {
            if (aptList.length > 0) {
                const isValidApt = aptList.some((apt: any) => apt.aptName === form.아파트명);
                if (!isValidApt) {
                    alert("❌ 아파트명을 항목에서 선택해주세요!\n\n추천인으로 예약된 아파트 목록에서만 선택 가능합니다.\n현재 입력값: " + (form.아파트명 || "(비어있음)"));
                    return; // 전송 중단
                }
            }
        }

        if (!form.아파트명.trim()) {
            alert("❌ 아파트명을 입력해주세요!");
            return;
        }

        const cleanSaleAmount = form.판매비용.toString().replace(/,/g, '');
        const appsScriptUrl = "https://script.google.com/macros/s/AKfycbzITllVlYaPqmfoT7eVPd1nSDl31uiaQFO9VFILQeBo_swAUNScMOKM_F_c9iz7TbKI/exec";

        try {
            // 1. 엑셀 시트 전송 (Apps Script - 시공보고서 기록용)
            await fetch(appsScriptUrl, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify({
                    ...form,
                    추천인: form.추천인 === "없음" ? "" : form.추천인,
                    시공범위: selectedScopes.join(", ")
                }),
                headers: { "Content-Type": "application/json" },
            });

            // 2. 인센티브 시트 연동 (기존 예약 내역 업데이트용)
            if (form.추천인 && form.추천인 !== "없음") {
                const response = await fetch(`${backendUrl}/api/leads`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        recommender: form.추천인,
                        aptName: form.아파트명,
                        saleAmount: cleanSaleAmount,
                        area: form.지역,
                        pyeong: form.평수,
                        scope: selectedScopes.join(", "),
                        source: "현장시공"
                    })
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || "인센티브 시트 연동 중 오류가 발생했습니다.");
                }
            }

            alert("✅ 시공보고서 전송이 완료되었습니다!");
        } catch (e: any) {
            alert(e.message || "전송 중 오류가 발생했습니다.");
        }
    };

    // 아파트명 입력란 활성화 조건: 추천인이 비어있지 않거나 "없음"일 때
    const isAptEnabled = form.추천인.trim() !== "";

    return (
        <main className="p-4 max-w-xl mx-auto bg-white shadow-lg rounded-xl my-8">
            <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">시공보고서 작성</h1>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">1. 시공일자</label>
                    <input type="date" name="시공일자" value={form.시공일자} onChange={handleChange} className="w-full border-2 border-gray-200 p-3 rounded-lg focus:border-blue-500 outline-none transition-all" />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">2. 추천인 (검색)</label>
                    <input
                        type="text"
                        name="추천인"
                        value={form.추천인}
                        onChange={handleChange}
                        list="partner-list"
                        autoComplete="off"
                        placeholder="추천인 이름을 입력하세요 (없으면 '없음' 입력)"
                        className="w-full border-2 border-gray-200 p-3 rounded-lg focus:border-blue-500 outline-none transition-all"
                    />
                    <datalist id="partner-list">
                        {partners.map(p => <option key={p} value={p} />)}
                    </datalist>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        5. 아파트명 {isLoading && <span className="text-blue-500 text-xs animate-pulse">(로딩 중...)</span>}
                    </label>

                    {/* 추천인이 "없음"이 아니고 아파트 목록이 있으면 select 드롭다운 사용 (목록 외 입력 원천 차단) */}
                    {isAptEnabled && form.추천인 !== "없음" && aptList.length > 0 ? (
                        <select
                            name="아파트명"
                            value={form.아파트명}
                            onChange={handleChange}
                            className="w-full border-2 border-blue-300 p-3 rounded-lg focus:border-blue-500 outline-none transition-all bg-white text-gray-800 font-medium"
                        >
                            <option value="">-- 아파트를 선택하세요 --</option>
                            {aptList.map((apt: any, idx: number) => (
                                <option key={idx} value={apt.aptName}>{apt.aptName}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            name="아파트명"
                            value={form.아파트명}
                            onChange={handleChange}
                            disabled={!isAptEnabled}
                            placeholder={
                                !isAptEnabled ? "추천인을 먼저 입력하세요" :
                                    form.추천인 === "없음" ? "아파트명을 자유롭게 입력하세요" :
                                        isLoading ? "아파트 목록 로딩 중..." :
                                            "아파트명을 입력하세요"
                            }
                            className={`w-full border-2 p-3 rounded-lg outline-none transition-all ${!isAptEnabled
                                ? "bg-gray-50 border-gray-100 cursor-not-allowed text-gray-400"
                                : "bg-white border-gray-200 focus:border-blue-500 text-gray-800"
                                }`}
                        />
                    )}

                    {/* 안내 메시지 */}
                    {isAptEnabled && form.추천인 !== "없음" && !isLoading && aptList.length === 0 && form.추천인.trim().length >= 2 && (
                        <p className="text-[10px] text-red-400 mt-1 ml-1">⚠️ 해당 추천인으로 '예약완료'된 아파트가 없습니다. 자유 입력 가능합니다.</p>
                    )}
                    {isAptEnabled && form.추천인 !== "없음" && aptList.length > 0 && (
                        <p className="text-[10px] text-blue-500 mt-1 ml-1">✅ 위 목록에서 아파트를 선택해주세요.</p>
                    )}
                </div>

                {[
                    { label: "3. 시공팀원", name: "시공팀원" },
                    { label: "4. 지역", name: "지역" },
                    { label: "6. 동호수", name: "동호수" },
                    { label: "7. 연락처", name: "연락처" },
                    { label: "8. 평수", name: "평수" }
                ].map(field => (
                    <div key={field.name}>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{field.label}</label>
                        <input type="text" name={field.name} value={(form as any)[field.name]} onChange={handleChange} className="w-full border-2 border-gray-200 p-3 rounded-lg focus:border-blue-500 outline-none transition-all" />
                    </div>
                ))}

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">9. 시공범위 (다중 선택)</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        {scopes.map(scope => (
                            <button
                                key={scope}
                                type="button"
                                onClick={() => handleScopeChange(scope)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedScopes.includes(scope)
                                    ? "bg-blue-600 text-white shadow-md scale-105"
                                    : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
                                    }`}
                            >
                                {scope}
                            </button>
                        ))}
                    </div>
                </div>

                {[
                    { label: "10. 신축여부", name: "신축여부" },
                    { label: "11. 결제방법", name: "결제방법" }
                ].map(field => (
                    <div key={field.name}>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{field.label}</label>
                        <input type="text" name={field.name} value={(form as any)[field.name]} onChange={handleChange} className="w-full border-2 border-gray-200 p-3 rounded-lg focus:border-blue-500 outline-none transition-all" />
                    </div>
                ))}

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">12. 색상</label>
                    <select name="색상" value={form.색상} onChange={handleChange} className="w-full border-2 border-gray-200 p-3 rounded-lg focus:border-blue-500 outline-none transition-all bg-white">
                        <option value="모던">모던</option>
                        <option value="마블">마블</option>
                        <option value="코튼베이지">코튼베이지</option>
                        <option value="우드">우드</option>
                    </select>
                </div>

                {[
                    { label: "13. 판매갯수", name: "판매갯수" },
                    { label: "14. 판매비용", name: "판매비용" },
                    { label: "15. 미결제금액", name: "미결제금액" },
                    { label: "16. 예약금 현금영수증", name: "예약금현금영수증" },
                    { label: "17. 특이사항", name: "특이사항" }
                ].map(field => (
                    <div key={field.name}>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{field.label}</label>
                        <input type="text" name={field.name} value={(form as any)[field.name]} onChange={handleChange} className="w-full border-2 border-gray-200 p-3 rounded-lg focus:border-blue-500 outline-none transition-all" />
                    </div>
                ))}
            </div>

            <div className="flex gap-3 mt-8">
                <button onClick={handleCopy} className="flex-1 bg-gray-800 text-white font-bold py-4 rounded-xl hover:bg-gray-700 transition-colors shadow-lg active:scale-95">결과 복사하기</button>
                <button onClick={handleSend} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg active:scale-95">엑셀 시트 전송</button>
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded-xl border-2 border-gray-100">
                <h2 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">미리보기</h2>
                <div className="whitespace-pre-wrap text-gray-700 font-mono text-sm leading-relaxed">
                    {generateResult()}
                </div>
            </div>
        </main>
    );
}
