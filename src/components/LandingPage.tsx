import React from 'react';
import { SignInButton, SignUpButton, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Shield, Zap, Globe, Cpu } from 'lucide-react';

export default function LandingPage() {
    const { isSignedIn } = useAuth();

    if (isSignedIn) {
        return <Navigate to="/app" replace />;
    }

    return (
        <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-blue-500/30">
            {/* Header */}
            <nav className="fixed top-0 w-full z-50 bg-[#0a0a0b]/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-600 rounded-lg">
                                <Cpu className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                SOFTI AI ANALYTICS
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <SignInButton mode="modal">
                                <button className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                                    Accedi
                                </button>
                            </SignInButton>
                            <SignUpButton mode="modal">
                                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20">
                                    Inizia ora
                                </button>
                            </SignUpButton>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="pt-32 pb-20 overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center relative">
                        {/* Background Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] -z-10 rounded-full" />

                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6 animate-fade-in">
                            <Zap className="w-3 h-3" />
                            <span>Nuova Analisi AI 3.0 Disponibile</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
                            Analisi di Mercato Premium <br />
                            <span className="bg-gradient-to-r from-blue-400 via-blue-200 to-white bg-clip-text text-transparent italic">
                                Potenziata dall'Intelligenza Artificiale
                            </span>
                        </h1>

                        <p className="max-w-2xl mx-auto text-lg text-gray-400 mb-10 leading-relaxed">
                            La piattaforma definitiva per trader che non scendono a compromessi.
                            Precisione istituzionale, insight in tempo reale e analisi AI avanzata per trasformare ogni dato in opportunità.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            {isSignedIn ? (
                                <Navigate to="/app" replace />
                            ) : (
                                <>
                                    <SignUpButton mode="modal">
                                        <button className="w-full sm:w-auto px-8 py-4 bg-white text-black font-black text-lg rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                                            Prova Gratis <TrendingUp className="w-5 h-5" />
                                        </button>
                                    </SignUpButton>
                                    <button className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 text-white font-bold text-lg rounded-2xl hover:bg-white/10 transition-all">
                                        Guarda Demo
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Feature Grid */}
                        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                { icon: BarChart3, title: "Deep Analysis", desc: "Analizziamo oltre 50 asset globali con modelli di regressione neurale in real-time." },
                                { icon: Shield, title: "Smart Risk", desc: "Gestione del rischio automatizzata basata sulla volatilità e sentiment di mercato." },
                                { icon: Globe, title: "Global Reach", desc: "Accesso a dati istituzionali su Forex, Commodities e Indici da ogni parte del mondo." }
                            ].map((f, i) => (
                                <div key={i} className="p-8 rounded-3xl bg-[#111112] border border-white/5 hover:border-blue-500/20 transition-all group">
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <f.icon className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12 bg-[#0a0a0b]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2 opacity-50">
                        <Cpu className="w-5 h-5" />
                        <span className="text-sm font-bold">SOFTI AI ANALYTICS</span>
                    </div>
                    <p className="text-gray-600 text-xs">
                        © 2026 Softi AI Analytics. Tutti i diritti riservati. Il trading comporta rischi elevati.
                    </p>
                </div>
            </footer>
        </div>
    );
}
