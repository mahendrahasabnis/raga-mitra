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
    <header className="glass-effect border-b border-white/20">
      <div className="max-w-7xl mx-auto px-3 py-3 sm:px-4 sm:py-4">
        {/* App Name - Full Width on Mobile */}
        <div className="flex justify-center mb-3 sm:hidden">
          <h1 className="text-xl font-bold text-gradient">Raga-Mitra</h1>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-bold text-gradient">Raga-Mitra</h1>
          </div>
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <button 
                  onClick={onBuyCredits}
                  className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-sm">Buy</span>
                  <span className="text-xs text-white/80">
                    {user.credits} credits
                  </span>
                </button>

                {onTransactionReport && (
                  <button
                    onClick={onTransactionReport}
                    className="p-2 text-white/60 hover:text-white transition-colors"
                    title={isAdmin ? "Transaction Reports" : "My Transactions"}
                  >
                    <CreditCard className="w-5 h-5" />
                  </button>
                )}

                {onConfigMenu && isAdmin && (
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

        {/* Mobile Layout - Credits and Actions */}
        <div className="flex flex-col space-y-2 sm:hidden">
          {user && (
            <>
              {/* Buy Credits Button - Full Width */}
              <button 
                onClick={onBuyCredits}
                className="w-full flex items-center justify-center space-x-2 bg-white/10 hover:bg-white/20 px-4 py-3 rounded-lg transition-colors"
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="text-base font-medium">Buy Credits</span>
                <span className="text-sm text-white/80 bg-white/10 px-2 py-1 rounded-full">
                  {user.credits}
                </span>
              </button>

              {/* Action Buttons Row */}
              <div className="flex justify-center space-x-3">
                {onTransactionReport && (
                  <button
                    onClick={onTransactionReport}
                    className="flex flex-col items-center space-y-1 p-3 text-white/60 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg"
                    title={isAdmin ? "Transaction Reports" : "My Transactions"}
                  >
                    <CreditCard className="w-6 h-6" />
                    <span className="text-xs">Transactions</span>
                  </button>
                )}


                {onConfigMenu && isAdmin && (
                  <button
                    onClick={onConfigMenu}
                    className="flex flex-col items-center space-y-1 p-3 text-white/60 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg"
                    title="Configuration"
                  >
                    <Cog className="w-6 h-6" />
                    <span className="text-xs">Settings</span>
                  </button>
                )}

                <button
                  onClick={logout}
                  className="flex flex-col items-center space-y-1 p-3 text-white/60 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg"
                  title="Logout"
                >
                  <LogOut className="w-6 h-6" />
                  <span className="text-xs">Logout</span>
                </button>
              </div>
            </>
          )}
        </div>
        
        {/* Date, Time & Season Info - Responsive */}
        <div className="flex flex-col space-y-2 mt-4 pt-3 border-t border-white/10 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <p className="text-sm text-white/80 text-center sm:text-left">{formatDate(currentTime)}</p>
          <p className="text-lg font-semibold text-primary-300 text-center sm:text-base">{formatTime(currentTime)}</p>
          <p className="text-sm text-secondary-300 text-center sm:text-right">{getSeasonName(currentTime)}</p>
        </div>
      </div>
    </header>
  );
};

export default Header;
