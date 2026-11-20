import React from 'react';

export const LiquidBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Dynamic ambient mesh gradients */}
      <div 
        className="absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] rounded-full blur-[110px] opacity-25 dark:opacity-20 animate-orb-slow"
        style={{
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.7) 0%, rgba(99, 102, 241, 0.4) 50%, transparent 70%)',
        }}
      />
      <div 
        className="absolute top-[35%] -right-[15%] w-[60vw] h-[60vw] rounded-full blur-[130px] opacity-20 dark:opacity-15 animate-orb-reverse"
        style={{
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.7) 0%, rgba(59, 130, 246, 0.3) 50%, transparent 70%)',
        }}
      />
      <div 
        className="absolute -bottom-[15%] left-[20%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-20 dark:opacity-15 animate-orb-slow"
        style={{
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.6) 0%, rgba(56, 189, 248, 0.2) 60%, transparent 75%)',
        }}
      />
      
      {/* Subtle glass grid texture */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:24px_24px] opacity-60" />
    </div>
  );
};
