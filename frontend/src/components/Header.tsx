import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingCart, LogOut, CreditCard, Cog } from 'lucide-react';
import { getCurrentMarathiMonth, getCurrentSeason, formatSeasonDisplay } from '../utils/marathiCalendar';

interface HeaderProps {
  onBuyCredits: () => void;
  onTransactionReport?: () => void;
  onConfigMenu?: () => void;
  isAdmin?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onBuyCredits, onTransactionReport, onConfigMenu, isAdmin }) => {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const marathiMonth = getCurrentMarathiMonth(date);
    return `${day}-${month}-${year} (${marathiMonth.marathi})`;
  };

  const getSeasonName = (date: Date): string => {
    const currentSeason = getCurrentSeason(date);
    return formatSeasonDisplay(currentSeason.english);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* App Name */}
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-bold text-gradient">Raga-Mitra</h1>
          </div>

          {/* Credits and Actions */}
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <div 
                  onClick={onBuyCredits}
                  className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-sm">Buy</span>
                  <span className="text-xs text-white/80">
                    {user.credits} credits
                  </span>
                </div>


                    {onTransactionReport && (
                      <button
                        onClick={onTransactionReport}
                        className="p-2 text-white/60 hover:text-white transition-colors"
                        title={isAdmin ? "Transaction Reports" : "My Transactions"}
                      >
                        <CreditCard className="w-5 h-5" />
                      </button>
                    )}

                    {onConfigMenu && (
                      <button
                        onClick={onConfigMenu}
                        className="p-2 text-white/60 hover:text-white transition-colors"
                        title="Configuration"
                      >
                        <Cog className="w-5 h-5" />
                      </button>
                    )}


                <button
                  onClick={logout}
                  className="p-2 text-white/60 hover:text-white transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Date, Time & Season Info */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
          <p className="text-sm text-white/80">{formatDate(currentTime)}</p>
          <p className="text-base font-semibold text-primary-300">{formatTime(currentTime)}</p>
          <p className="text-sm text-secondary-300">{getSeasonName(currentTime)}</p>
        </div>
      </div>
    </header>
  );
};

export default Header;
