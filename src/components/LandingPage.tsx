import React from 'react';
import { SignInButton, SignUpButton, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { Activity, BarChart3, Cpu, Globe, Shield, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'motion/react';

const heroItems = [
    { label: 'Latency', value: '38ms avg' },
    { label: 'Coverage', value: '50+ assets' },
    { label: 'Signal Engine', value: 'MT5 + Gemini' }
];

const features = [
    {
        icon: BarChart3,
        title: 'MT5-native intelligence',
        description: 'Analyzer JSON, bridge live e report periodici convergono in una sola superficie operativa.'
    },
    {
        icon: Shield,
        title: 'Risk context on top',
        description: 'Wyckoff, liquidita e session quality vengono esposti come decision signals, non come testo decorativo.'
    },
    {
        icon: Globe,
        title: 'Cross-market radar',
        description: 'Forex, commodities, crypto e indici scorrono nello stesso motore con priorita guidata dalla confidenza.'
    }
];

const steps = [
    {
        index: '01',
        title: 'Ingest the market',
        description: 'MT5, watchlists e feed macro alimentano il layer live senza ricarichi manuali.'
    },
    {
        index: '02',
        title: 'Score the setup',
        description: 'Il sistema comprime bias multi-timeframe, liquidita e confidence score in un segnale leggibile.'
    },
    {
        index: '03',
        title: 'Act with context',
        description: 'Alert, interactive analysis e market reports arrivano gia pronti per il decision flow del trader.'
    }
];

const containerVariants = {
    hidden: {},
    show: {
        transition: {
            staggerChildren: 0.08
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 28, scale: 0.96 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1
    }
};

export default function LandingPage() {
    const { isSignedIn } = useAuth();

    if (isSignedIn) {
        return <Navigate to="/app" replace />;
    }

    return (
        <div className="min-h-screen bg-[#08111B] text-white selection:bg-[#00A3FF]/30">
            <nav className="fixed top-0 z-50 w-full border-b border-white/8 bg-[#08111B]/75 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-[#1F6FEB]/25 bg-[#1F6FEB]/15 p-2">
                            <Cpu className="h-5 w-5 text-[#7DCBFF]" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#6E7681]">Softi AI</p>
                            <p className="text-sm font-black tracking-[0.18em] text-[#F0F6FC]">ANALYZER</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <SignInButton mode="modal">
                            <button className="text-sm font-semibold text-[#8B949E] transition-colors hover:text-white">
                                Accedi
                            </button>
                        </SignInButton>
                        <SignUpButton mode="modal">
                            <button className="rounded-full bg-[#F0F6FC] px-4 py-2 text-sm font-black text-[#08111B] transition-transform hover:scale-[1.03]">
                                Inizia ora
                            </button>
                        </SignUpButton>
                    </div>
                </div>
            </nav>

            <main>
                <section className="relative isolate min-h-[100svh] overflow-hidden border-b border-white/6 pt-16">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,163,255,0.18),transparent_35%),radial-gradient(circle_at_80%_25%,rgba(242,204,96,0.16),transparent_28%),linear-gradient(180deg,#08111B_0%,#0A1622_45%,#08111B_100%)]" />
                    <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:84px_84px]" />
                    <div className="absolute -left-24 top-28 h-72 w-72 rounded-full bg-[#00A3FF]/12 blur-[120px]" />
                    <div className="absolute bottom-12 right-0 h-80 w-80 rounded-full bg-[#E3B341]/10 blur-[140px]" />

                    <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col justify-between px-4 pb-12 pt-12 sm:px-6 lg:px-8">
                        <motion.div
                            initial="hidden"
                            animate="show"
                            variants={containerVariants}
                            className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.7fr)] lg:items-end"
                        >
                            <div className="max-w-4xl">
                                <motion.div
                                    variants={itemVariants}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                    className="inline-flex items-center gap-2 rounded-full border border-[#1F6FEB]/25 bg-[#1F6FEB]/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#7DCBFF]"
                                >
                                    <Zap className="h-3.5 w-3.5" />
                                    AI Market Operating Layer
                                </motion.div>

                                <motion.h1
                                    variants={itemVariants}
                                    className="mt-8 max-w-5xl text-5xl font-black leading-[0.95] tracking-[-0.05em] text-[#F0F6FC] sm:text-6xl lg:text-8xl"
                                >
                                    Read the tape.
                                    <span className="block text-[#7DCBFF]">Score the move.</span>
                                    <span className="block text-[#F2CC60]">Execute with context.</span>
                                </motion.h1>

                                <motion.p
                                    variants={itemVariants}
                                    className="mt-8 max-w-xl text-base leading-7 text-[#9BA7B4] sm:text-lg"
                                >
                                    Softi AI Analyzer unisce MT5 live, sentiment macro e report generativi in una sola control surface.
                                    Nessuna dashboard da vetrina: solo segnali, priorita e contesto operativo.
                                </motion.p>

                                <motion.div variants={itemVariants} className="mt-10 flex flex-col gap-4 sm:flex-row">
                                    <SignUpButton mode="modal">
                                        <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F0F6FC] px-8 py-4 text-base font-black text-[#08111B] transition-transform hover:scale-[1.02]">
                                            Apri la piattaforma
                                            <TrendingUp className="h-5 w-5" />
                                        </button>
                                    </SignUpButton>
                                    <SignInButton mode="modal">
                                        <button className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/5 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-white/10">
                                            Guarda la demo live
                                        </button>
                                    </SignInButton>
                                </motion.div>
                            </div>

                            <motion.div
                                variants={containerVariants}
                                className="grid gap-5 border-l border-white/8 pl-0 lg:pl-8"
                            >
                                {heroItems.map((item) => (
                                    <motion.div
                                        key={item.label}
                                        variants={itemVariants}
                                        className="border-b border-white/8 pb-5"
                                    >
                                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#6E7681]">{item.label}</p>
                                        <p className="mt-2 text-2xl font-black tracking-tight text-[#F0F6FC]">{item.value}</p>
                                    </motion.div>
                                ))}
                            </motion.div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.35 }}
                            className="mt-16 grid gap-6 border-t border-white/8 pt-8 text-sm text-[#9BA7B4] lg:grid-cols-[1.2fr_1fr_1fr]"
                        >
                            <div className="max-w-md">
                                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#6E7681]">Bridge live</p>
                                <p className="mt-2 leading-6">
                                    Analyzer packets, alert high-confidence e report periodici scorrono nello stesso motore senza perdita di contesto.
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#6E7681]">Signal surface</p>
                                <p className="mt-2 leading-6">Confidence score visuale, watchlist globale e sentiment wire direttamente nella dashboard.</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#6E7681]">Decision flow</p>
                                <p className="mt-2 leading-6">Dalla lettura del regime alla validazione del setup, tutto resta rapido e leggibile anche sotto pressione.</p>
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="border-b border-white/6 bg-[#0A121B] px-4 py-24 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{ duration: 0.6 }}
                            className="max-w-2xl"
                        >
                            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#6E7681]">What the desk gets</p>
                            <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#F0F6FC] sm:text-5xl">
                                A tighter trading cockpit, not a louder dashboard.
                            </h2>
                        </motion.div>

                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            whileInView="show"
                            viewport={{ once: true, amount: 0.22 }}
                            className="mt-16 grid gap-10 lg:grid-cols-3 lg:gap-0"
                        >
                            {features.map((feature, index) => (
                                <motion.div
                                    key={feature.title}
                                    variants={itemVariants}
                                    className="relative lg:px-8"
                                >
                                    {index !== 0 && <div className="absolute left-0 top-0 hidden h-full w-px bg-white/8 lg:block" />}
                                    <div className="mb-6 inline-flex rounded-2xl border border-[#1F6FEB]/20 bg-[#1F6FEB]/10 p-3 text-[#7DCBFF]">
                                        <feature.icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-2xl font-black tracking-tight text-[#F0F6FC]">{feature.title}</h3>
                                    <p className="mt-4 max-w-sm text-sm leading-7 text-[#8B949E]">{feature.description}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </section>

                <section className="bg-[#08111B] px-4 py-24 sm:px-6 lg:px-8">
                    <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.9fr_1.1fr]">
                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{ duration: 0.6 }}
                            className="max-w-lg"
                        >
                            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#6E7681]">Workflow</p>
                            <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#F0F6FC] sm:text-5xl">
                                From market noise to execution context in three clean steps.
                            </h2>
                            <p className="mt-6 text-base leading-7 text-[#8B949E]">
                                L&apos;interfaccia resta compatta, ma la catena decisionale diventa piu ricca: ingestione, scoring, azione.
                            </p>
                        </motion.div>

                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            whileInView="show"
                            viewport={{ once: true, amount: 0.2 }}
                            className="space-y-8"
                        >
                            {steps.map((step) => (
                                <motion.div
                                    key={step.index}
                                    variants={itemVariants}
                                    className="grid gap-4 border-b border-white/8 pb-8 sm:grid-cols-[120px_1fr]"
                                >
                                    <div className="text-5xl font-black tracking-[-0.06em] text-[#243244]">{step.index}</div>
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight text-[#F0F6FC]">{step.title}</h3>
                                        <p className="mt-3 max-w-xl text-sm leading-7 text-[#8B949E]">{step.description}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </section>

                <section className="border-t border-white/6 bg-[#0A121B] px-4 py-24 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        whileInView={{ opacity: 1, y: 0, scale: 1 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.65, ease: 'easeOut' }}
                        className="mx-auto max-w-5xl text-center"
                    >
                        <div className="mx-auto inline-flex rounded-full border border-[#E3B341]/25 bg-[#E3B341]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#F2CC60]">
                            <Activity className="mr-2 h-3.5 w-3.5" />
                            Enterprise-grade market workflow
                        </div>
                        <h2 className="mt-6 text-4xl font-black tracking-[-0.05em] text-[#F0F6FC] sm:text-6xl">
                            Switch from scattered signals to a single operating surface.
                        </h2>
                        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[#8B949E]">
                            Avvia la piattaforma, collega il bridge MT5 e lascia che report, alert e feed lavorino nello stesso flusso.
                        </p>
                        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                            <SignUpButton mode="modal">
                                <button className="rounded-2xl bg-[#F0F6FC] px-8 py-4 text-base font-black text-[#08111B] transition-transform hover:scale-[1.02]">
                                    Crea il tuo accesso
                                </button>
                            </SignUpButton>
                            <SignInButton mode="modal">
                                <button className="rounded-2xl border border-white/12 bg-white/5 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-white/10">
                                    Apri area clienti
                                </button>
                            </SignInButton>
                        </div>
                    </motion.div>
                </section>
            </main>

            <footer className="border-t border-white/6 bg-[#08111B] py-10">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-xs text-[#6E7681] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
                    <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        <span className="font-bold uppercase tracking-[0.24em]">Softi AI Analyzer</span>
                    </div>
                    <p>© 2026 Softi AI Analytics. Tutti i diritti riservati. Il trading comporta rischi elevati.</p>
                </div>
            </footer>
        </div>
    );
}
