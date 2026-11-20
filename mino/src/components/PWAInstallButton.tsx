/**
 * PWA In-App Install Button & iOS Safari Manual Guidance Modal
 * Adheres strictly to the 3-colour palette and purposeful radii (no pills).
 */

import React, { useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running standalone, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#0F172A] text-white hover:bg-[#1E293B] border border-slate-700 transition-colors shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B45309]"
        title="Install MINO-SMS on device for offline performance"
      >
        <Download className="w-3.5 h-3.5 text-[#B45309]" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 transition-colors"
          title="Add MINO-SMS to Home Screen"
        >
          <Share2 className="w-3.5 h-3.5 text-[#B45309]" />
          <span>Add to Home Screen</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-[6px] bg-white p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Install on iOS Safari</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 text-xs text-slate-600 space-y-2.5 leading-relaxed">
                <p>1. Tap the <strong className="text-slate-900">Share</strong> icon at the bottom of your Safari browser bar.</p>
                <p>2. Scroll down and select <strong className="text-slate-900">"Add to Home Screen"</strong>.</p>
                <p>3. Tap <strong className="text-slate-900">Add</strong> in the top-right corner to access MINO-SMS offline with fast native performance.</p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 text-xs font-semibold rounded-[4px] bg-[#0F172A] text-white hover:bg-[#1E293B]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
