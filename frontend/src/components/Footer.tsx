import React from 'react';
import logoImage from '../assets/neoabhro_logo_transparent.PNG';

const Footer: React.FC = () => {
  return (
    <footer className="glass-effect border-t border-white/20">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {/* NeoAbhro Text - Left */}
          <div className="text-sm font-semibold text-white">
            NeoAbhro
          </div>
          
          {/* Logo - Center */}
          <div className="flex items-center justify-center">
            <img 
              src={logoImage} 
              alt="NeoAbhro Logo" 
              className="w-8 h-8 object-contain"
            />
          </div>
          
          {/* App Version - Right */}
          <p className="text-xs text-white/60">
            v{import.meta.env.VITE_APP_VERSION || '1.0.0'}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
