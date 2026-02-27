import React from 'react';

const Footer: React.FC<{ theme?: 'light' | 'dark' }> = ({ theme = 'dark' }) => {
  return (
    <div className={`flex items-center justify-between px-4 py-1 border-t ${theme === 'light' ? 'border-slate-200/60 bg-white/80' : 'border-white/5 bg-black/40'}`}>
      <span className="text-[10px] font-semibold tracking-wide select-none">
        <span className="text-rose-500">Neo</span>
        <span className={theme === 'light' ? 'text-slate-600' : 'text-gray-400'}>Abhro</span>
      </span>
      <img src="/neoabhro-logo.png" alt="NeoAbhro" className="h-4 object-contain" />
      <span className={`text-[9px] font-mono select-none ${theme === 'light' ? 'text-slate-400' : 'text-gray-500'}`}>
        {__APP_VERSION__}
      </span>
    </div>
  );
};

export default Footer;
