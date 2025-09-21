import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 glass-effect border-t border-white/20">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {/* NeoAbhro Text - Left */}
          <div className="text-sm font-semibold text-white">
            NeoAbhro
          </div>
          
          {/* Logo - Center */}
          <div className="flex items-center justify-center">
            <div className="relative w-8 h-8">
              {/* Red ribbon */}
              <div className="absolute inset-0 bg-red-500 rounded-sm transform rotate-45 scale-75"></div>
              {/* Gray ribbon */}
              <div className="absolute inset-0 bg-gray-400 rounded-sm transform -rotate-45 scale-75"></div>
              {/* Overlay for 3D effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-sm"></div>
            </div>
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
