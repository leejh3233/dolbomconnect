'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PartnerPage() {
    const [step, setStep] = useState(1); // 1: Login, 2: Dashboard
    const [partnerName, setPartnerName] = useState('');
    const [partnerPwd, setPartnerPwd] = useState('');
    const [bank, setBank] = useState('');
    const [account, setAccount] = useState('');
    const [isRegistered, setIsRegistered] = useState(false);
    const [isEmployee, setIsEmployee] = useState(false); // Used as checkbox state for "I am an employee"
    const [statusMsg, setStatusMsg] = useState('');
    const [showPwdArea, setShowPwdArea] = useState(false);

    // Password Change State
    const [pwdOld, setPwdOld] = useState('');
    const [pwdNew, setPwdNew] = useState('');
    const [pwdConfirm, setPwdConfirm] = useState('');
    const [masterData, setMasterData] = useState<any>(null);
    const [myLinks, setMyLinks] = useState<any[]>([]);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [monthFilter, setMonthFilter] = useState('ALL');
    const [media, setMedia] = useState('');
    const [isLoading, setIsLoading] = useState(false);



    // Session Persistence
    useEffect(() => {
        const stored = localStorage.getItem('partner_auth');
        if (stored) {
            try {
                const { name, password, isEmployee: storedEmp } = JSON.parse(stored);
                if (name && password) {
                    setPartnerName(name);
                    setPartnerPwd(password);
                    if (storedEmp) setIsEmployee(true);

                    // Auto-load dashboard
                    setStep(2);
                    verifyAndLoad(name, password);
                }
            } catch (e) {
                console.error("Session parse error", e);
                localStorage.removeItem('partner_auth');
            }
        }
    }, []);

    const verifyAndLoad = async (name: string, password: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/partner-data?empId=${encodeURIComponent(name)}&password=${encodeURIComponent(password)}`);
            const data = await res.json();
            if (data.error) {
                // If invalid credentials, clear session
                if (res.status === 401) {
                    localStorage.removeItem('partner_auth');
                    setStep(1);
                    return;
                }
            }
            setMasterData(data);
            const resLinks = await fetch(`/api/links?name=${encodeURIComponent(name)}`);
            const links = await resLinks.json();
            setMyLinks(links);
        } catch (err) {
            console.error('Auto-login failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const checkName = async () => {
        if (!partnerName.trim()) return;
        try {
            const res = await fetch(`/api/partners/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: partnerName })
            });
            const data = await res.json();

            if (res.status === 404) {
                return alert(data.error);
            }

            // Automatically set isEmployee based on backend data
            if (data.isEmployee !== undefined) {
                setIsEmployee(data.isEmployee);
            }

            setShowPwdArea(true);

            if (res.status === 400) {
                setStatusMsg('신규 파트너이시군요! 비밀번호를 설정해주세요.');
                setIsRegistered(false);
            } else {
                setStatusMsg('등록된 비밀번호를 입력하세요.');
                setIsRegistered(true);
            }
        } catch (err) {
            console.error('Check name failed:', err);
        }
    };

    const login = async () => {
        if (partnerPwd.length !== 4) return alert("비밀번호 4자리 숫자를 입력하세요.");

        try {
            const body: any = { name: partnerName, password: partnerPwd };
            if (!isRegistered) { // First time setting password
                body.bank = bank;
                body.account = account;
                if (isEmployee) {
                    body.bank = '';
                    body.account = '';
                    body.type = '직원';
                } else {
                    body.type = '외부파트너';
                }
            }

            const res = await fetch('/api/partners/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                // Save session
                localStorage.setItem('partner_auth', JSON.stringify({
                    name: partnerName,
                    password: partnerPwd,
                    isEmployee
                }));

                setStep(2);
                fetchDashboardData();
            } else {
                alert(data.error || '로그인 실패');
            }
        } catch (err) {
            console.error('Login failed:', err);
        }
    };

    const handleLogout = () => {
        if (confirm('로그아웃 하시겠습니까?')) {
            localStorage.removeItem('partner_auth');
            window.location.href = '/portal';
        }
    };

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/partner-data?empId=${encodeURIComponent(partnerName)}&password=${encodeURIComponent(partnerPwd)}`);
            const data = await res.json();
            setMasterData(data);

            const resLinks = await fetch(`/api/links?name=${encodeURIComponent(partnerName)}`);
            const links = await resLinks.json();
            setMyLinks(links);
        } catch (err) {
            console.error('Fetch dashboard data failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const createNewLink = async () => {
        if (!media) return alert("홍보할 매체를 선택해주세요!");
        try {
            const res = await fetch('/api/links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: partnerName, password: partnerPwd, source: media })
            });
            const data = await res.json();
            if (data.url) {
                alert("링크가 발급되었습니다.");
                fetchDashboardData();
            }
        } catch (err) {
            console.error('Create link failed:', err);
        }
    };

    const deleteLink = async (sid: string) => {
        if (!confirm("정말 이 링크를 삭제할까요?")) return;
        try {
            await fetch(`/api/links?sid=${sid}`, { method: 'DELETE' });
            alert("삭제되었습니다.");
            fetchDashboardData();
        } catch (err) {
            console.error('Delete link failed:', err);
        }
    };

    const copyToClipboard = (txt: string) => {
        navigator.clipboard.writeText(txt).then(() => alert("링크가 복사되었습니다!"));
    };

    const changePassword = async () => {
        if (pwdNew !== pwdConfirm) return alert("새 비밀번호가 일치하지 않습니다.");
        if (pwdNew.length !== 4) return alert("비밀번호는 4자리 숫자여야 합니다.");

        try {
            const res = await fetch('/api/partners/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: partnerName, oldPassword: pwdOld, newPassword: pwdNew })
            });
            const data = await res.json();
            if (data.success) {
                alert("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
                setStep(1);
                setPartnerPwd('');
                setIsRegistered(true);
                setShowProfileModal(false);
            } else {
                alert(data.error || "비밀번호 변경 실패");
            }
        } catch (e) {
            console.error(e);
            alert("변경 실패");
        }
    };

    const fmt = (n: number) => new Intl.NumberFormat().format(n || 0);

    // Filter logic
    const months = masterData?.stats?.monthly ? Object.keys(masterData.stats.monthly).sort().reverse() : [];
    const filteredLeads = masterData?.stats?.allLeads?.filter((l: any) => monthFilter === 'ALL' || l.month === monthFilter) || [];


    return (
        <div className="min-h-[100dvh] pb-12 select-none bg-[#f1f5f9] font-sans">
            <header className="bg-slate-900 text-white py-6 px-6 shadow-2xl sticky top-0 z-50">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-lg font-black tracking-tighter">돌봄 파트너 센터</h1>
                            <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">
                                {step === 2 ? `${partnerName} 파트너님` : 'Partner Dashboard'}
                            </p>
                        </div>
                        {step === 2 && (
                            <button
                                onClick={() => {
                                    setPwdOld('');
                                    setPwdNew('');
                                    setPwdConfirm('');
                                    setShowProfileModal(true);
                                }}
                                className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-slate-700 hover:text-white transition-colors"
                            >
                                비밀번호 변경
                            </button>
                        )}
                    </div>
                    <button onClick={handleLogout} className="bg-slate-800 px-4 py-2 rounded-xl text-[11px] font-bold hover:bg-slate-700 active:scale-95 transition-transform">
                        나가기
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
                {step === 1 ? (
                    <section className="max-w-sm mx-auto bg-white rounded-[2.5rem] shadow-xl p-6 md:p-10 border border-white mt-10">
                        <h2 className="text-xl font-black text-slate-800 mb-6 text-center">파트너 본인 확인</h2>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">성함</label>
                                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                                    <input
                                        type="text"
                                        value={partnerName}
                                        onChange={(e) => setPartnerName(e.target.value)}
                                        placeholder="성함 입력"
                                        className="flex-1 min-w-[120px] px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-sm"
                                    />
                                    <button
                                        onClick={checkName}
                                        className="whitespace-nowrap bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-xs active:scale-95"
                                    >
                                        확인
                                    </button>
                                </div>
                            </div>

                            {showPwdArea && (
                                <div className="slide-up space-y-5">
                                    <p className="text-[10px] font-bold text-blue-600 bg-blue-50 p-3 rounded-xl border border-blue-100">
                                        {statusMsg}
                                    </p>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">비밀번호 (4자리)</label>
                                        <input
                                            type="password"
                                            value={partnerPwd}
                                            onChange={(e) => setPartnerPwd(e.target.value)}
                                            maxLength={4}
                                            placeholder="••••"
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none font-black text-center tracking-[1rem] text-xl"
                                        />
                                    </div>
                                    {!isRegistered && (
                                        <div className="space-y-4">
                                            {isEmployee ? (
                                                <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-[1.5rem] text-center slide-up">
                                                    <div className="text-2xl mb-2">💼</div>
                                                    <div className="text-[11px] font-black text-blue-700">돌봄커넥트 정직원 확인</div>
                                                    <p className="text-[10px] text-blue-500 font-bold mt-1 leading-relaxed">
                                                        시공 인센티브는 매월 정해진<br />
                                                        월급날에 합산하여 지급됩니다.
                                                    </p>
                                                    <p className="text-[9px] text-slate-400 mt-2 font-medium">별도의 계좌 정보 등록이 필요 없습니다.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4 slide-up">
                                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">계좌 정보 (정산용)</div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input
                                                                type="text"
                                                                value={bank}
                                                                onChange={(e) => setBank(e.target.value)}
                                                                placeholder="은행명"
                                                                className="px-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-colors"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={account}
                                                                onChange={(e) => setAccount(e.target.value)}
                                                                placeholder="계좌번호"
                                                                className="px-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-colors"
                                                            />
                                                        </div>
                                                        <p className="text-[9px] text-slate-400 mt-3 ml-1 font-medium italic">* 정확한 정산을 위해 본인 명의의 계좌를 입력하세요.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={login}
                                        className="w-full bg-blue-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                                    >
                                        대시보드 접속
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                ) : (
                    <section className="animate-in fade-in duration-500 space-y-6">
                        <div className="bg-white rounded-[2rem] p-8 border border-white shadow-xl space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">나의 홍보 링크 발급</h3>
                                    <p className="text-xs text-slate-500 font-medium">홍보할 채널을 선택하세요.</p>
                                </div>
                                <div className="flex w-full md:w-auto gap-2">
                                    <select
                                        value={media}
                                        onChange={(e) => setMedia(e.target.value)}
                                        className="flex-1 md:w-44 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-xs"
                                    >
                                        <option value="">-- 매체 선택 --</option>
                                        <option value="인스타그램">인스타그램</option>
                                        <option value="블로그">블로그</option>
                                        <option value="당근마켓">당근마켓</option>
                                        <option value="카페/커뮤니티">카페/커뮤니티</option>
                                        <option value="지인소개">지인소개/직접</option>
                                    </select>
                                    <button onClick={createNewLink} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-sm active:scale-95">링크 생성</button>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-50">
                                <h4 className="text-[9px] font-black text-slate-300 uppercase mb-3 tracking-widest">발급된 고유 링크 내역</h4>
                                <div className="space-y-2">
                                    {myLinks.length === 0 ? (
                                        <p className="text-[10px] text-slate-300 italic">아직 발급된 링크가 없습니다.</p>
                                    ) : (
                                        myLinks.map((link: any) => (
                                            <div key={link.sid} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 slide-up">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="text-[8px] font-black text-blue-500 uppercase mb-0.5">{link.source}</div>
                                                    <div className="text-[10px] font-mono text-slate-500 truncate">{link.url}</div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => copyToClipboard(link.url)} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[9px] font-black active:scale-90 shadow-sm">복사</button>
                                                    <button onClick={() => deleteLink(link.sid)} className="bg-red-50 text-red-500 border border-red-100 px-3 py-1.5 rounded-lg text-[9px] font-black active:scale-90 shadow-sm">삭제</button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="bg-white p-5 rounded-2xl border border-white shadow-xl text-center">
                                <div className="text-[9px] font-black text-slate-400 uppercase mb-1">총 누적 정산완료</div>
                                <div className="text-xl font-black text-slate-900">{fmt(masterData?.stats?.totalSettled)}원</div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-white shadow-xl text-center">
                                <div className="text-[9px] font-black text-slate-400 uppercase mb-1">총 미정산 잔액</div>
                                <div className="text-xl font-black text-red-500">{fmt(masterData?.stats?.totalPending)}원</div>
                            </div>
                            <div className="bg-slate-900 p-5 rounded-2xl shadow-xl text-center text-white col-span-2 md:col-span-1">
                                <div className="text-[9px] font-black text-slate-500 uppercase mb-1">합계</div>
                                <div className="text-lg font-black text-blue-400">
                                    {fmt(masterData?.stats?.monthly?.[monthFilter]?.incentive || 0)}원
                                </div>

                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] shadow-xl border border-white overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                <select
                                    value={monthFilter}
                                    onChange={(e) => setMonthFilter(e.target.value)}
                                    className="bg-white border border-slate-100 px-3 py-1.5 rounded-xl text-xs font-bold outline-none"
                                >
                                    <option value="ALL">전체 기간 실적 보기</option>
                                    {months.map(m => (
                                        <option key={m} value={m}>{m === 'NaN-NaN' ? '날짜오류' : m} 실적 내역</option>
                                    ))}
                                </select>
                                <span className="text-[10px] font-black text-slate-400 uppercase">상세 리포트</span>
                            </div>
                            <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-left min-w-[500px]">
                                    <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase border-b">
                                        <tr>
                                            <th className="px-6 py-4">일자 / 대상</th>
                                            <th className="px-6 py-4">상태</th>
                                            <th className="px-6 py-4">인센티브</th>
                                            <th className="px-6 py-4 text-right">정산</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-[11px]">
                                        {filteredLeads.map((l: any, i: number) => (
                                            <tr key={i}>
                                                <td className="px-6 py-4 font-bold text-slate-700">{l.date}<br /><span className="text-[9px] text-slate-400">{l.apt || l.region}</span></td>
                                                <td className="px-6 py-4 font-black">
                                                    <span className={`px-2 py-1 rounded-lg ${l.isCompleted ? 'bg-blue-50 text-blue-600' : l.isBooking ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        {l.isCompleted ? '시공완료' : l.isBooking ? '예약완료' : '상담대기'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-black text-slate-800">{fmt(l.incentive)}원</td>
                                                <td className={`px-6 py-4 text-right font-black ${l.settlement === '정산완료' ? 'text-blue-500' : 'text-slate-300'}`}>{l.settlement}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {showProfileModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-[3rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
                        <h3 className="text-xl font-black text-slate-900 mb-6 pl-4 border-l-4 border-blue-600">비밀번호 변경</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">현재 비밀번호</label>
                                <input
                                    type="password"
                                    value={pwdOld}
                                    onChange={(e) => setPwdOld(e.target.value)}
                                    maxLength={4}
                                    placeholder="••••"
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-black text-center text-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">새 비밀번호 (4자리)</label>
                                <input
                                    type="password"
                                    value={pwdNew}
                                    onChange={(e) => setPwdNew(e.target.value)}
                                    maxLength={4}
                                    placeholder="••••"
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-black text-center text-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">비밀번호 확인</label>
                                <input
                                    type="password"
                                    value={pwdConfirm}
                                    onChange={(e) => setPwdConfirm(e.target.value)}
                                    maxLength={4}
                                    placeholder="••••"
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-black text-center text-lg"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowProfileModal(false)} className="flex-1 py-4 text-slate-400 font-bold text-sm">취소</button>
                            <button onClick={changePassword} className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all text-sm">변경하기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
