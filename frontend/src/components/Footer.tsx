import React from 'react';

const Footer: React.FC<{ theme?: 'light' | 'dark' }> = ({ theme = 'dark' }) => {
  return (
    <div style={{ backgroundColor: 'var(--canvas)' }}>
      <div
        className="flex items-center justify-between px-4 border-t"
        style={{ borderColor: 'var(--border)', height: '20px' }}
      >
        <span className="text-[9px] font-semibold tracking-wide select-none leading-none">
          <span style={{ color: 'var(--brand-red)' }}>Neo</span>
          <span style={{ color: 'var(--muted)' }}>Abhro</span>
        </span>
        <img src="/neoabhro-logo.png" alt="NeoAbhro" className="h-3 object-contain" />
        <span className="text-[8px] font-mono select-none leading-none" style={{ color: 'var(--muted-light)' }}>
          {__APP_VERSION__}
        </span>
      </div>
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)', backgroundColor: 'var(--canvas)' }} />
    </div>
  );
};

export default Footer;
