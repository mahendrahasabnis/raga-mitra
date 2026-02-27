import React from 'react';

const Footer: React.FC<{ theme?: 'light' | 'dark' }> = ({ theme = 'dark' }) => {
  return (
    <div
      className="flex items-center justify-between px-4 border-t leading-none"
      style={{ backgroundColor: 'var(--canvas)', borderColor: 'var(--border)', padding: '3px 16px' }}
    >
      <span className="text-[9px] font-semibold tracking-wide select-none">
        <span style={{ color: 'var(--brand-red)' }}>Neo</span>
        <span style={{ color: 'var(--muted)' }}>Abhro</span>
      </span>
      <img src="/neoabhro-logo.png" alt="NeoAbhro" className="h-3 object-contain" />
      <span className="text-[8px] font-mono select-none" style={{ color: 'var(--muted-light)' }}>
        {__APP_VERSION__}
      </span>
    </div>
  );
};

export default Footer;
