import React, { useState, useEffect, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LogOut, Stethoscope, Users, Calendar, Briefcase, Home } from "lucide-react";

interface HeaderProps {
  onBuyCredits?: () => void; // Keep for backward compatibility, but won't be used
}

const Header: React.FC<HeaderProps> = () => {
  const { user, logout, hasRole } = useAuth();
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
    return `${day}-${month}-${year}`;
  };

  const navItems = useMemo(() => {
    const items: Array<{ to: string; label: string; icon: React.FC<any>; show: boolean }> = [
      { to: "/", label: "Home", icon: Home, show: true },
      { to: "/appointments", label: "Appointments", icon: Calendar, show: true },
      { to: "/dashboard/doctor", label: "Doctor", icon: Stethoscope, show: hasRole("doctor") },
      { to: "/dashboard/reception", label: "Reception", icon: Users, show: hasRole("reception") || hasRole("receptionist") },
      { to: "/dashboard/billing", label: "Billing", icon: Briefcase, show: hasRole("billing") },
      { to: "/hcp", label: "HCP Admin", icon: Briefcase, show: hasRole("owner") || hasRole("admin") || hasRole("clinic_admin") },
    ];
    return items.filter((i) => i.show);
  }, [hasRole]);

  return (
    <header className="glass-effect border-b border-red-500/30">
      <div className="max-w-7xl mx-auto px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-bold text-gradient">Aarogya Mitra</h1>
            {navItems.length > 0 && (
              <nav className="hidden sm:flex items-center space-x-3">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center space-x-1 px-3 py-2 rounded-md text-sm ${
                        isActive
                          ? "bg-red-600 text-white"
                          : "text-white/70 hover:text-white hover:bg-red-600/30"
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right text-xs text-white/70">
              <span>{formatDate(currentTime)}</span>
              <span className="text-sm text-red-300 font-semibold">{formatTime(currentTime)}</span>
            </div>
            {user && (
              <button
                onClick={logout}
                className="p-2 text-white/70 hover:text-white transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        {navItems.length > 0 && (
          <div className="sm:hidden mt-3 flex flex-wrap gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-1 px-3 py-2 rounded-md text-xs ${
                    isActive
                      ? "bg-red-600 text-white"
                      : "text-white/70 hover:text-white hover:bg-red-600/30"
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}

        {/* Date & Time for mobile */}
        <div className="sm:hidden mt-2 text-center text-xs text-white/70">
          <span className="block">{formatDate(currentTime)}</span>
          <span className="text-sm text-red-300 font-semibold">{formatTime(currentTime)}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
