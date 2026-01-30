import Link from 'next/link';

export default function PortalPage() {
    return (
        <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[#0f172a] overflow-hidden relative">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full filter blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900 rounded-full filter blur-[120px]"></div>
            </div>

            <div className="max-w-4xl w-full relative z-10">
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-black text-white tracking-widest mb-4">
                        DOLBOM <span className="text-blue-500">CONNECT</span>
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                        Premium Partner & Admin Gateway
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Partner Gateway */}
                    <Link href="/partner" className="glass-card hover-lift p-10 rounded-[3rem] text-left group glow">
                        <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-8 border border-blue-500/30">
                            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>

                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">파트너 센터</h2>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                            링크 발급, 유입 실정 확인 및<br />인센티브 정산 현황을 조회합니다.
                        </p>
                        <div className="flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest group-hover:gap-4 transition-all">
                            Enter Portal <span>→</span>
                        </div>
                    </Link>

                    {/* Admin Gateway */}
                    <Link href="/admin" className="glass-card hover-lift p-10 rounded-[3rem] text-left group">
                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-8 border border-white/10">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                            </svg>

                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">관리자 센터</h2>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                            리드 상태 체크, 파트너 발급 및<br />정산 처리를 관리합니다.
                        </p>
                        <div className="flex items-center gap-2 text-slate-300 font-black text-xs uppercase tracking-widest group-hover:gap-4 transition-all">
                            Authorized Only <span>→</span>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
