'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPage() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState(false);
    const [activeTab, setActiveTab] = useState('manage');
    const [masterData, setMasterData] = useState<any>(null);
    const [filters, setFilters] = useState({
        month: 'ALL',
        status: 'ALL'
    });
    // Settlement Tab Filters
    const [settleMonth, setSettleMonth] = useState('ALL');
    const [settleStatus, setSettleStatus] = useState('미정산'); // 'ALL' | '미정산' | '정산완료'

    // Partner Tab Filters
    const [showExcluded, setShowExcluded] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [settleModal, setSettleModal] = useState<any>(null);

    const settlePartner = async () => {
        if (!settleModal) return;
        try {
            const res = await fetch('/api/admin/settle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerName: settleModal.partner })
            });
            const data = await res.json();
            if (data.success) {
                alert(`${settleModal.partner}님 정산 처리가 완료되었습니다. (총 ${data.count}건)`);
                setSettleModal(null);
                fetchData();
            } else {
                alert(data.error || '정산 실패');
            }
        } catch (err) {
            console.error('Settle failed:', err);
        }
    };

    const confirmSettle = (p: any) => {
        let pending = 0;
        if (p.pendingMap) {
            Object.values(p.pendingMap).forEach((v: any) => pending += v);
        }

        if (pending <= 0) return alert("정산할 금액이 없습니다.");

        const isEmployee = (!p.bank && !p.account) || p.type === '직원';

        if (isEmployee) {
            if (confirm(`${p.name} (직원)\n미정산 금액: ${fmt(pending)}원\n\n정산 처리 하시겠습니까?`)) {
                doSettleDirect(p.name);
            }
        } else {
            setSettleModal({ partner: p.name, amount: pending, bank: p.bank, account: p.account, type: '인플루언서' });
        }
    };

    const doSettleDirect = async (name: string) => {
        try {
            const res = await fetch('/api/admin/settle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerName: name })
            });
            const data = await res.json();
            if (data.success) {
                alert(`${name}님 정산 처리가 완료되었습니다.`);
                fetchData();
            }
        } catch (e) { console.error(e); }
    };

    const excludePartner = async (name: string, currentStatus: string) => {
        const newStatus = currentStatus === '제외' ? 'Active' : '제외';
        if (!confirm(`${name}님을 '${newStatus}' 상태로 변경하시겠습니까?`)) return;

        try {
            const res = await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updatePartnerStatus', partnerName: name, status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                fetchData();
            } else {
                alert(data.error);
            }
        } catch (err) {
            console.error('Exclude failed:', err);
        }
    };

    useEffect(() => {
        const storedAuth = localStorage.getItem('admin_auth');
        if (storedAuth === 'dolbom4146') {
            setPassword(storedAuth);
            setIsLoggedIn(true);
        }
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            fetchData();
        }
    }, [isLoggedIn]);

    const tryAdminLogin = () => {
        // Current master password from Code.gs context
        if (password === 'dolbom4146') {
            setIsLoggedIn(true);
            setLoginError(false);
            localStorage.setItem('admin_auth', password);
        } else {
            setLoginError(true);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_auth');
        setIsLoggedIn(false);
        setPassword('');
    };

    const fetchData = async () => {
        // Loading spinner only on initial load or manual refresh, not background updates
        if (!masterData) setIsLoading(true);
        try {
            const res = await fetch('/api/admin');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setMasterData(data);
        } catch (err) {
            console.error('Fetch admin data failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const updateStatus = async (rowId: number, col: number, value: any) => {
        // Optimistic Update: Update UI immediately
        const prevData = JSON.parse(JSON.stringify(masterData)); // Deep copy for rollback
        const newData = { ...masterData };
        const lead = newData.leads.find((l: any) => l.rowId === rowId);

        if (lead) {
            if (col === 9) lead.isBooking = value;
            if (col === 10) lead.isCompleted = value;
            setMasterData(newData); // Update local state immediately
        }

        try {
            await fetch('/api/admin', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowId, col, value })
            });
            // Background sync (optional, to ensure consistency)
            // fetchData(); 
        } catch (err) {
            console.error('Update status failed:', err);
            setMasterData(prevData); // Revert on failure
            alert('업데이트에 실패했습니다. 다시 시도해주세요.');
        }
    };

    const fmt = (n: number) => new Intl.NumberFormat().format(n || 0);

    const formatMonth = (m: string) => {
        if (m === 'ALL') return '전체 기간';
        // m is YYYY-MM
        const parts = m.split('-');
        if (parts.length < 2) return m;
        return `${parts[1]}월 (${parts[0]})`;
    };

    // Filter logic
    const filteredLeads = masterData?.leads?.filter((l: any) => {
        const mOk = (filters.month === 'ALL' || l.fullMonth === filters.month);
        let sOk = false;
        if (filters.status === 'ALL') sOk = true;
        else if (filters.status === '예약완료') sOk = (l.isBooking === true);
        else if (filters.status === '시공완료') sOk = (l.isCompleted === true);
        else if (filters.status === '상담대기') sOk = (!l.isBooking && !l.isCompleted);
        else sOk = String(l.status || "").includes(filters.status);
        return mOk && sOk;
    }) || [];

    if (!isLoggedIn) {
        return (
            <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center p-6 font-gothic">
                <div className="max-w-sm w-full text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-slate-100">
                        <svg className="w-8 h-8 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    </div>
                    <h2 className="text-2xl font-black mb-2 tracking-tight">관리자 인증</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">Dolbom Connect Admin Security</p>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && tryAdminLogin()}
                        placeholder="Passcode"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl mb-4 text-center outline-none font-bold text-lg focus:border-blue-500 transition-colors"
                    />
                    <button
                        onClick={tryAdminLogin}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95 transition-all"
                    >
                        시스템 접속
                    </button>
                    {loginError && <p className="text-red-500 text-[10px] font-bold mt-4">접속 정보가 올바르지 않습니다.</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20 font-gothic bg-[#f8fafc]">
            <header className="bg-white border-b border-slate-100 py-6 px-8 sticky top-0 z-40">
                <div className="max-w-[1400px] mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-black tracking-tight">
                        돌봄 커넥트 관리자 <span className="text-slate-200 font-normal mx-2">|</span>
                        <span className="text-xs text-slate-400 font-bold ml-1"> 통합 관제 시스템</span>
                    </h1>
                    <button onClick={handleLogout} className="bg-slate-50 px-4 py-2 rounded-xl text-[11px] font-black text-slate-600 border border-slate-100 hover:bg-slate-100 cursor-pointer">
                        로그아웃
                    </button>
                </div>
            </header>

            <nav className="bg-white border-b border-slate-50 px-8 sticky top-[81px] z-30">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex overflow-x-auto no-scrollbar rounded-[2rem] bg-slate-50/50 p-2 mb-6 sm:mb-8 gap-3 border border-slate-100">
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={`flex-1 py-4 text-xs sm:text-sm font-black rounded-2xl transition-all min-w-[80px] ${activeTab === 'manage' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400'}`}
                        >
                            통합관리
                        </button>
                        <button
                            onClick={() => setActiveTab('settlement')}
                            className={`flex-1 py-4 text-xs sm:text-sm font-black rounded-2xl transition-all min-w-[80px] ${activeTab === 'settlement' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400'}`}
                        >
                            통합정산
                        </button>
                        <button
                            onClick={() => setActiveTab('partners')}
                            className={`flex-1 py-4 text-xs sm:text-sm font-black rounded-2xl transition-all min-w-[80px] ${activeTab === 'partners' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400'}`}
                        >
                            인원관리
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-[1400px] mx-auto p-8 space-y-8">
                {activeTab === 'manage' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 slide-up">
                        <div className="glass-card p-8 rounded-[2rem]">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">전체 누적 정산완료</p>
                            <h4 className="text-3xl font-black text-blue-600">{fmt(masterData?.totalSettled)}원</h4>
                        </div>
                        <div className="glass-card p-8 rounded-[2rem]">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">전체 미정산 잔액</p>
                            <h4 className="text-3xl font-black text-red-500">{fmt(masterData?.totalPending)}원</h4>
                        </div>
                        <div className="glass-card p-8 rounded-[2rem]">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">필터 설정</p>
                            <div className="flex flex-col gap-2">
                                <select
                                    value={filters.month}
                                    onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-[11px] font-black outline-none"
                                >
                                    <option value="ALL">전체 기간</option>
                                    {[...new Set(masterData?.leads?.map((l: any) => l.fullMonth) as string[] || [])]
                                        .filter(m => m !== 'Unknown')
                                        .sort().reverse()
                                        .map(m => (
                                            <option key={m} value={m}>{formatMonth(m)}</option>
                                        ))}
                                </select>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-[11px] font-black outline-none"
                                >
                                    <option value="ALL">전체 진행상태</option>
                                    <option value="상담대기">상담대기</option>
                                    <option value="예약완료">예약완료</option>
                                    <option value="시공완료">시공완료</option>
                                </select>
                            </div>
                        </div>
                        <div className="bg-slate-900 p-8 rounded-[2rem] text-white flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">전체 리드 현황</p>
                            <div className="flex justify-between items-end">
                                <div>
                                    <h4 className="text-xl font-black">{masterData?.leads?.filter((l: any) => (!l.isBooking && !l.isCompleted)).length || 0}<span className="text-[10px] text-slate-500 ml-1">대기</span></h4>
                                </div>
                                <div className="text-right">
                                    <h4 className="text-xl font-black">{masterData?.leads?.filter((l: any) => l.isBooking).length || 0}<span className="text-[10px] text-slate-500 ml-1">예약</span></h4>
                                    <h4 className="text-xl font-black text-blue-400">{masterData?.leads?.filter((l: any) => l.isCompleted).length || 0}<span className="text-[10px] text-blue-900 ml-1">시공</span></h4>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'manage' && (
                    <div className="slide-up">
                        <div className="glass-card rounded-[2.5rem] overflow-hidden">
                            <table className="w-full text-left bg-white hidden md:table">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-4">일자</th>
                                        <th className="px-8 py-4">파트너/장소</th>
                                        <th className="px-8 py-4 text-center">예약</th>
                                        <th className="px-8 py-4 text-center">시공</th>
                                        <th className="px-8 py-4">매출액</th>
                                        <th className="px-8 py-4 text-right">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-sm">
                                    {filteredLeads.map((l: any) => (
                                        <tr key={l.rowId} className="hover:bg-slate-50">
                                            <td className="px-8 py-4 font-bold text-slate-400 text-[11px]">{l.shortDate}</td>
                                            <td className="px-8 py-4">
                                                <div className="font-black text-slate-900">{l.partner}</div>
                                                <div className="text-[10px] text-slate-400 font-bold">{l.apt}</div>
                                            </td>
                                            <td className="px-8 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={l.isBooking}
                                                    onChange={(e) => updateStatus(l.rowId, 9, e.target.checked)}
                                                    className="w-4 h-4 rounded"
                                                />
                                            </td>
                                            <td className="px-8 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={l.isCompleted}
                                                    onChange={(e) => updateStatus(l.rowId, 10, e.target.checked)}
                                                    className="w-4 h-4 rounded"
                                                />
                                            </td>
                                            <td className="px-8 py-4 font-black">{fmt(l.saleAmount)}원</td>
                                            <td className="px-8 py-4 text-right">
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${l.isCompleted ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    {l.isCompleted ? '시공완료' : l.isBooking ? '예약완료' : '상담대기'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="md:hidden p-4 space-y-4">
                                {filteredLeads.map((l: any) => (
                                    <div key={l.rowId} className="glass-card p-4 rounded-xl space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-slate-400">{l.date}</span>
                                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black ${l.isCompleted ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>{l.settlement}</span>
                                        </div>
                                        <div className="font-black text-slate-900">{l.partner} <span className="font-normal text-slate-400 text-xs">| {l.apt}</span></div>
                                        <div className="flex justify-between items-center pt-2">
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-1 text-[10px] font-bold">
                                                    <input type="checkbox" checked={l.isBooking} onChange={(e) => updateStatus(l.rowId, 9, e.target.checked)} /> 예약
                                                </label>
                                                <label className="flex items-center gap-1 text-[10px] font-bold">
                                                    <input type="checkbox" checked={l.isCompleted} onChange={(e) => updateStatus(l.rowId, 10, e.target.checked)} /> 시공
                                                </label>
                                            </div>
                                            <div className="font-black text-sm">{fmt(l.saleAmount)}원</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Other tabs integration */}
                {activeTab === 'settlement' && (
                    <div className="slide-up">
                        <div className="mb-6 flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase">기간</span>
                                <select
                                    value={settleMonth}
                                    onChange={(e) => setSettleMonth(e.target.value)}
                                    className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                >
                                    <option value="ALL">전체 누적</option>
                                    {[...new Set(masterData?.leads?.map((l: any) => l.fullMonth) as string[] || [])]
                                        .filter(m => m !== 'Unknown') // Filter Unknown
                                        .sort().reverse().map(m => (
                                            <option key={m} value={m}>{formatMonth(m)}</option>
                                        ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase">상태</span>
                                <div className="flex bg-slate-50 rounded-xl p-1 border border-slate-100">
                                    <button
                                        onClick={() => setSettleStatus('ALL')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${settleStatus === 'ALL' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}
                                    >
                                        전체
                                    </button>
                                    <button
                                        onClick={() => setSettleStatus('미정산')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${settleStatus === '미정산' ? 'bg-white shadow text-red-500' : 'text-slate-400'}`}
                                    >
                                        미정산
                                    </button>
                                    <button
                                        onClick={() => setSettleStatus('정산완료')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${settleStatus === '정산완료' ? 'bg-white shadow text-blue-500' : 'text-slate-400'}`}
                                    >
                                        정산완료
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5">파트너</th>
                                        <th className="px-8 py-5">유형</th>
                                        <th className="px-8 py-5">{settleMonth === 'ALL' ? '누적' : formatMonth(settleMonth)} 합계</th>
                                        <th className="px-8 py-5 text-right">액션</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {masterData?.partners?.map((p: any, i: number) => {
                                        // Calculate based on filters
                                        let pending = 0;
                                        let settled = 0;
                                        const targetMonths = settleMonth === 'ALL' ? Object.keys(p.pendingMap || {}) : [settleMonth];

                                        // Pending Calculation
                                        if (p.pendingMap) {
                                            if (settleMonth === 'ALL') {
                                                Object.values(p.pendingMap).forEach(v => pending += (v as number));
                                            } else {
                                                pending = p.pendingMap[settleMonth] || 0;
                                            }
                                        }

                                        // Settled Calculation
                                        if (p.settledMap) {
                                            if (settleMonth === 'ALL') {
                                                Object.values(p.settledMap).forEach(v => settled += (v as number));
                                            } else {
                                                settled = p.settledMap[settleMonth] || 0;
                                            }
                                        }

                                        const showByType =
                                            (settleStatus === 'ALL' && (pending > 0 || settled > 0)) ||
                                            (settleStatus === '미정산' && pending > 0) ||
                                            (settleStatus === '정산완료' && settled > 0);

                                        if (!showByType && settleStatus !== 'ALL') return null;
                                        // If ALL, show if any activity
                                        if (settleStatus === 'ALL' && pending === 0 && settled === 0) return null;

                                        if (p.status === '제외' && !showExcluded) return null; // Respect showExcluded global or local? 
                                        // The user didn't ask for excluded toggle here, but generally excluded partners don't get settled.
                                        if (p.status === '제외') return null;

                                        return (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-5 font-black text-slate-800">{p.name}</td>
                                                <td className="px-8 py-5 text-xs text-slate-500 font-bold">{p.type || '인플루언서'}</td>
                                                <td className="px-8 py-5">
                                                    {settleStatus !== '정산완료' && pending > 0 && <div className="text-red-500 font-black">미정산: {fmt(pending)}원</div>}
                                                    {settleStatus !== '미정산' && settled > 0 && <div className="text-blue-500 font-black">완료: {fmt(settled)}원</div>}
                                                    {pending === 0 && settled === 0 && <span className="text-slate-300">-</span>}
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    {pending > 0 ? (
                                                        <button
                                                            onClick={() => confirmSettle(p)}
                                                            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-blue-200 active:scale-95 transition-all"
                                                        >
                                                            정산하기
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-slate-300 font-bold"> - </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'partners' && (
                    <div className="slide-up">
                        <div className="mb-6 flex justify-end">
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                                <input
                                    type="checkbox"
                                    checked={showExcluded}
                                    onChange={(e) => setShowExcluded(e.target.checked)}
                                    className="w-4 h-4 rounded text-slate-900"
                                />
                                <span className="text-[11px] font-bold text-slate-500">제외된 인원 보기</span>
                            </label>
                        </div>
                        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5">이름</th>
                                        <th className="px-8 py-5">유형</th>
                                        <th className="px-8 py-5">상태</th>
                                        <th className="px-8 py-5 text-right">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {masterData?.partners?.map((p: any, i: number) => {
                                        if (!showExcluded && p.status === '제외') return null;

                                        return (
                                            <tr key={i} className={`hover:bg-slate-50/50 transition-colors ${p.status === '제외' ? 'bg-slate-50 opacity-60' : ''}`}>
                                                <td className="px-8 py-5 font-black text-slate-800">{p.name}</td>
                                                <td className="px-8 py-5 text-xs text-slate-500 font-bold">{p.type || '인플루언서'}</td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${p.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                                        {p.status === '제외' ? '만료/제외' : '활동중'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <button
                                                        onClick={() => excludePartner(p.name, p.status)}
                                                        className="bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-slate-50"
                                                    >
                                                        {p.status === '제외' ? '복구' : '제외 (만료)'}
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {settleModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
                        <h3 className="text-xl font-black mb-1">{settleModal.partner}님 정산</h3>
                        <p className="text-slate-400 text-xs font-bold mb-6">
                            {settleModal.isEmployee
                                ? '직원 급여 합산 대상입니다.'
                                : '아래 계좌로 입금 후 정산 완료를 누르세요.'}
                        </p>

                        <div className="bg-slate-50 p-6 rounded-2xl mb-6 border border-slate-100">
                            {settleModal.isEmployee ? (
                                <div className="text-center py-4 space-y-2">
                                    <span className="text-2xl">💼</span>
                                    <div className="text-sm font-black text-slate-700">월급에 합산 지급</div>
                                    <p className="text-[10px] text-slate-400">별도 이체 없이 급여일에 포함되어<br />지급됨을 확인해주세요.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="text-[10px] font-black text-slate-400 uppercase mb-1">입금 계좌 정보</div>
                                    <div className="text-lg font-black text-slate-900 mb-1">{settleModal.bank} {settleModal.account}</div>
                                    <div className="text-sm font-bold text-slate-500">예금주: {settleModal.partner}</div>
                                </>
                            )}

                            <div className="mt-6 pt-6 border-t border-slate-200">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500">정산 금액</span>
                                    <span className="text-xl font-black text-blue-600">{fmt(settleModal.amount)}원</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setSettleModal(null)} className="flex-1 py-4 font-bold text-slate-400 text-sm">취소</button>
                            <button onClick={settlePartner} className="flex-[2] bg-blue-600 text-white rounded-2xl font-black shadow-xl text-sm active:scale-95 transition-all">
                                {settleModal.isEmployee ? '합산 처리 완료' : '정산 완료 처리'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
