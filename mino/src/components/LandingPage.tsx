/**
 * MINO-SMS Public Landing Page
 * Clean, standard typography, mobile-first responsiveness with fixed bottom navigation,
 * streamlined header wordmark, and focused content architecture.
 */

import React from 'react';
import {
  ShieldCheck,
  BookOpen,
  DollarSign,
  CalendarCheck,
  HeartHandshake,
  ArrowRight,
  Lock,
  WifiOff,
  School,
  Clock,
  Smile,
  Layers,
  Heart
} from 'lucide-react';

interface LandingPageProps {
  onGoToSchoolLogin: () => void;
  onGoToEnrollSchool?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGoToSchoolLogin,
  onGoToEnrollSchool
}) => {
  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col font-sans antialiased selection:bg-amber-100 selection:text-amber-900">
      {/* 1. Top Bar Contract Navigation Header */}
      <header className="h-14 sm:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between gap-8 sticky top-0 z-40">
        {/* Zone 1: Clean Brand Identity (no micro comment or pill badge) */}
        <a href="#" className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <img
            src="/assets/aistudio/logo_234aadf4.png"
            alt="MINO Logo"
            referrerPolicy="no-referrer"
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
          />
          <span className="font-bold text-lg sm:text-xl tracking-tight text-slate-900 leading-none">
            MINO
          </span>
        </a>

        {/* Zone 2: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <a href="#how-it-helps" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            How It Helps
          </a>
          <a href="#offline-care" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            Works Offline
          </a>
          <a href="#community" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            For Teachers & Parents
          </a>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onGoToSchoolLogin}
            className="px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. Hero Section with Full-Bleed Classroom Background Image */}
      <section className="relative min-h-[520px] sm:min-h-[600px] lg:min-h-[640px] flex items-center overflow-hidden bg-slate-950 border-b border-slate-800">
        {/* Background Image */}
        <img
          src="/assets/aistudio/ghana-classroom-hero_2a96bd3d.webp"
          alt="Teacher supporting students with a tablet in classroom"
          className="absolute inset-0 w-full h-full object-cover object-center select-none"
        />
        {/* Directional Scrim for Crisp Text Contrast while Keeping Classroom Scene Visible */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-950/75 to-slate-900/35"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/25"
        />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
          <div className="max-w-2xl space-y-6 text-left">
            <h1 className="text-3xl sm:text-5xl lg:text-[3.4rem] font-bold text-white tracking-tight leading-[1.13] [text-wrap:balance]">
              Where great schools thrive, teachers feel supported, and families stay close.
            </h1>

            <p className="max-w-xl text-sm sm:text-base text-slate-200 leading-relaxed font-normal">
              MINO brings calm and simplicity to daily school life. From quick morning roll calls and straightforward grading to clear fee receipts and termly report cards—everything works together smoothly, even during power or internet outages.
            </p>

            {/* Action Callouts */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {onGoToEnrollSchool && (
                <button
                  type="button"
                  onClick={onGoToEnrollSchool}
                  className="w-full sm:w-auto min-h-[48px] px-7 py-3 text-sm font-semibold rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white flex items-center justify-center gap-2 shadow-md transition-colors whitespace-nowrap shrink-0"
                >
                  <School className="w-4 h-4 text-amber-200" />
                  <span>Enroll Your School Now</span>
                  <ArrowRight className="w-4 h-4 text-amber-200" />
                </button>
              )}
              <button
                type="button"
                onClick={onGoToSchoolLogin}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3 text-sm font-semibold rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-xs border border-white/30 text-white flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Sign In to School</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Core Pillars Band */}
      <section className="py-10 sm:py-12 px-4 sm:px-8 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          <div className="p-5 bg-white border border-slate-200 rounded-2xl">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
              <WifiOff className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-slate-900">Works Without Internet</div>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Take attendance and record marks anywhere on campus. Safely updates when online.
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-slate-900">Stress-Free Grading</div>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Teachers finish report cards in minutes, giving them their weekends back.
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl">
            <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center mb-3">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-slate-900">Clear Parent Updates</div>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Instant digital fee receipts and online student report cards for parents.
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
              <Lock className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-slate-900">Secure Student Files</div>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Every child's records are safeguarded, protected, and fully backed up.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Core Modules */}
      <section id="how-it-helps" className="py-16 px-4 sm:px-8 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
              Everything Your School Community Needs
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Practical, reliable tools designed for administrators, classroom teachers, and families.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-6 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3 hover:border-slate-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-800 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Teacher-Friendly Gradebook
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Enter continuous assessment marks and final exam scores smoothly. A keyboard-friendly layout calculates totals and letter grades automatically.
              </p>
            </div>

            <div className="p-6 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3 hover:border-slate-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                School Fee Tracking
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Know who has paid and what balance remains with clarity. Issue digital receipts that give parents reassurance and eliminate guesswork for your bursar.
              </p>
            </div>

            <div className="p-6 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3 hover:border-slate-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-sky-100/80 text-sky-800 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Quick Daily Roll Call
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Take morning attendance in seconds with a simple tap. Notice attendance trends early and keep students engaged in their learning journey.
              </p>
            </div>

            <div className="p-6 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3 hover:border-slate-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-800 flex items-center justify-center">
                <Smile className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Parent & Student Access
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Parents can view their children’s verified report cards, attendance records, and fee payment history right from their mobile phones anytime.
              </p>
            </div>

            <div className="p-6 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3 hover:border-slate-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-800 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Organized Timetables & Notices
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Keep the whole school on the same page. Share class schedules, subject allocations, and school-wide announcements with ease.
              </p>
            </div>

            <div className="p-6 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3 hover:border-slate-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Multi-Campus Management
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                For educational leaders and school boards overseeing multiple campuses with consolidated enrollment, staff, and financial oversight.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Offline Resilience Section */}
      <section id="offline-care" className="py-16 px-4 sm:px-8 bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight [text-wrap:balance]">
              Because Learning Never Stops for Bad Internet
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Electricity fluctuates and internet connections can be unpredictable. MINO works reliably offline and syncs automatically when connectivity returns.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <WifiOff className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Teach and Record Anywhere on Campus
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Carry phones, tablets, or laptops to classrooms, assembly halls, or sports fields. Take attendance and enter test grades with zero connection, then sync securely when back online.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Safe Protection for Student Records
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Student files, family contact details, and fee records are encrypted locally and in transit so only authorized school staff and guardians can access their records.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Community Testimonial */}
      <section id="community" className="py-14 px-4 sm:px-8 bg-amber-50/40 border-b border-slate-200">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <blockquote className="text-base sm:text-lg font-medium text-slate-800 leading-relaxed [text-wrap:balance]">
            “Before MINO, preparing end-of-term reports meant piles of paper registers and sleepless weekends. Now, our teachers finish their remarks calmly, parents receive clear updates on their phones, and our school office feels peaceful.”
          </blockquote>
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-900">Mrs. Clara Adebayo</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>Head of Academics & Student Welfare, Oakridge Model Academy</span>
          </div>
        </div>
      </section>

      {/* 6. Quiet Footer */}
      <footer className="py-8 px-4 sm:px-8 bg-slate-950 text-slate-400 text-xs mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
              <img
                src="/assets/aistudio/logo_234aadf4.png"
                alt="MINO Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-bold text-white">MINO</span>
            <span aria-hidden="true">·</span>
            <span>School Management Platform</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs">
            <button type="button" onClick={onGoToSchoolLogin} className="hover:text-white transition-colors">
              School Sign In
            </button>
            {onGoToEnrollSchool && (
              <button type="button" onClick={onGoToEnrollSchool} className="hover:text-white transition-colors">
                Enroll School
              </button>
            )}
            <span className="text-slate-500">© 2026 MINO Platform Services</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
