import React from 'react';

const Footer: React.FC<{ theme?: 'light' | 'dark' }> = ({ theme = 'dark' }) => {
  return (
    <div
      className="flex items-center justify-between px-4 py-1 border-t"
      style={{ backgroundColor: 'var(--canvas)', borderColor: 'var(--border)' }}
    >
      <span className="text-[10px] font-semibold tracking-wide select-none">
        <span style={{ color: 'var(--brand-red)' }}>Neo</span>
        <span style={{ color: 'var(--muted)' }}>Abhro</span>
      </span>
      <img src="/neoabhro-logo.png" alt="NeoAbhro" className="h-4 object-contain" />
      <span className="text-[9px] font-mono select-none" style={{ color: 'var(--muted-light)' }}>
        {__APP_VERSION__}
      </span>
    </div>
  );
};

export default Footer;
