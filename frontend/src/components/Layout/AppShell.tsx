import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, HeartPulse, Home, Dumbbell, Salad, Users, LogOut, PhoneCall, MessageCircle, MessageSquare } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { resourcesApi } from "../../services/api";

const tabs = [
  { to: "/app/today", label: "Today", icon: Home },
  { to: "/app/calendar", label: "Calendar", icon: Calendar },
  { to: "/app/health", label: "Health", icon: HeartPulse },
  { to: "/app/fitness", label: "Fitness", icon: Dumbbell },
  { to: "/app/diet", label: "Diet", icon: Salad },
  { to: "/app/resources", label: "Resources", icon: Users },
];

type Props = {
  children: React.ReactNode;
};

const AppShell: React.FC<Props> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });
  const [clients, setClients] = useState<Array<{ id: string; name: string; phone: string; role?: string }>>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    // Legacy class support for backward compatibility
    document.documentElement.classList.remove("theme-dark", "theme-light");
    document.documentElement.classList.add(theme === "light" ? "theme-light" : "theme-dark");
  }, [theme]);

  // Persist selected client to allow other pages to read-only logic in future
  useEffect(() => {
    if (selectedClient) {
      localStorage.setItem("client-context-id", selectedClient);
    } else {
      localStorage.removeItem("client-context-id");
    }
  }, [selectedClient]);

  const hasResourceRole = useMemo(() => {
    const plat = user?.privileges?.find((p) => p.platform === "aarogya-mitra");
    const roles = (plat?.roles || []).concat(user?.role ? [user.role] : []);
    return roles.some((r) => ['doctor', 'fitnesstrainer', 'fitness trainer', 'dietitian', 'dietition', 'nutritionist'].includes(r.toLowerCase()));
  }, [user]);

  useEffect(() => {
    if (!hasResourceRole) return;
    const fetchClients = async () => {
      try {
        const res = await resourcesApi.listClients();
        console.log('🟢 [APPSHELL] listClients response:', res);
        console.log('🟢 [APPSHELL] Clients data:', res.clients);
        // Ensure clients is always an array
        const clientsList = res.clients;
        if (Array.isArray(clientsList)) {
          // Map backend fields to frontend format (patient_name/patient_phone -> name/phone)
          const mappedClients = clientsList.map((c: any) => {
            const name = c.patient_name || c.name || '';
            const phone = c.patient_phone || c.phone || '';
            console.log('🟢 [APPSHELL] Mapping client:', { original: c, mapped: { id: c.id, name, phone, role: c.role } });
            return {
              id: c.id,
              name: name,
              phone: phone,
              role: c.role
            };
          });
          console.log('🟢 [APPSHELL] Mapped clients:', mappedClients);
          setClients(mappedClients);
        } else if (clientsList && typeof clientsList === 'object') {
          console.warn('🟢 [APPSHELL] Clients is not an array, using empty array');
          setClients([]);
        } else {
          setClients([]);
        }
      } catch (e) {
        console.warn("⚠️ Failed to load clients", e);
        setClients([]);
      }
    };
    fetchClients();
  }, [hasResourceRole]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const term = clientSearch.toLowerCase();
    return clients.filter((c) =>
      (c.name || "").toLowerCase().includes(term) || (c.phone || "").toLowerCase().includes(term)
    );
  }, [clients, clientSearch]);

  useEffect(() => {
    if (!clientSearch) return;
    if (filteredClients.length === 1) {
      setSelectedClient(filteredClients[0].id);
    }
  }, [clientSearch, filteredClients]);

  const navTabs = useMemo(() => {
    if (hasResourceRole && selectedClient) {
      return tabs.filter((t) => t.to !== "/app/resources");
    }
    return tabs;
  }, [hasResourceRole, selectedClient]);

  const rolesLabel = useMemo(() => {
    const plat = user?.privileges?.find((p) => p.platform === "aarogya-mitra");
    const roles = (plat?.roles || []).filter((r) => r && r.toLowerCase() !== 'guest');
    return roles.join(", ");
  }, [user]);

  const shellBg = theme === "light"
    ? "text-foreground"
    : "text-foreground";

  return (
    <div className={`min-h-screen ${shellBg} flex flex-col`}>
      <header className={`sticky top-0 z-20 backdrop-blur-xl ${theme === "light" ? "bg-glass border-b" : "bg-glass border-b"}`} style={{ borderColor: 'var(--border)' }}>
        <div className="safe-area px-4 py-3 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex justify-center">
              <p className={`text-xs uppercase tracking-[0.15em] ${theme === "light" ? "text-rose-600/80" : "text-rose-300/80"}`}>Aarogya-Mitra</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold whitespace-nowrap">Welcome back</h1>
                {user?.name && <p className="text-sm font-semibold whitespace-nowrap">{user.name}</p>}
                {rolesLabel && (
                  <p className={`text-[11px] mt-0.5 ${theme === "light" ? "text-slate-600" : "text-gray-400"}`}>
                    Roles: {rolesLabel}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                  className={`h-10 px-4 min-w-[96px] rounded-2xl border text-sm font-medium flex items-center gap-2 justify-center transition ${
                    theme === "light"
                      ? "bg-white text-slate-900 border-black/10 shadow-sm"
                      : "bg-white/10 border-white/15 text-white"
                  }`}
                >
                  {theme === "light" ? "Dark" : "Light"}
                </button>
                <button
                  onClick={() => { logout(); navigate("/login"); }}
                  className={`h-10 px-4 min-w-[96px] rounded-2xl text-sm font-medium flex items-center gap-2 justify-center transition ${
                    theme === "light" ? "bg-white text-slate-900 border border-black/10 hover:bg-slate-100 shadow-sm" : "bg-white/10 border border-white/15 hover:bg-white/15 text-white"
                  }`}
                >
                  <LogOut className={`h-4 w-4 ${theme === "light" ? "text-rose-700" : "text-rose-200"}`} />
                  <span>Logout</span>
                </button>
              </div>
            </div>

            {hasResourceRole && (
              <div className="flex flex-wrap items-center gap-2 justify-center">
                <input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search patients..."
                  className={`h-10 px-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                    theme === "light"
                      ? "bg-white border border-slate-200 text-slate-900"
                      : "bg-white/10 border border-white/15 text-white placeholder:text-gray-300"
                  } w-48 md:w-64`}
                />
                <select
                  value={selectedClient || ""}
                  onChange={(e) => setSelectedClient(e.target.value || null)}
                  className={`h-10 px-3 rounded-2xl text-sm font-medium border transition leading-tight ${
                    theme === "light"
                      ? "bg-white text-slate-900 border-slate-200 shadow-sm"
                      : "bg-white/10 text-white border-white/15"
                  }`}
                >
                  <option value="">My data</option>
                  {filteredClients.map((c) => {
                    const displayName = c.name || '';
                    const displayPhone = c.phone || '';
                    const displayText = displayName 
                      ? (displayPhone ? `${displayName} - ${displayPhone}` : displayName)
                      : (displayPhone || 'Unknown');
                    return (
                      <option key={c.id} value={c.id}>
                        {displayText}
                      </option>
                    );
                  })}
                </select>
                {selectedClient && (
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${clients.find((c) => c.id === selectedClient)?.phone || ""}`}
                      className={`h-10 w-10 rounded-2xl grid place-items-center ${
                        theme === "light" ? "bg-white border border-slate-200 text-rose-700" : "bg-white/10 border border-white/15 text-rose-100"
                      }`}
                    >
                      <PhoneCall className="h-4 w-4" />
                    </a>
                    <a
                      href={`sms:${clients.find((c) => c.id === selectedClient)?.phone || ""}`}
                      className={`h-10 w-10 rounded-2xl grid place-items-center ${
                        theme === "light" ? "bg-white border border-slate-200 text-rose-700" : "bg-white/10 border border-white/15 text-rose-100"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </a>
                    <a
                      href={`https://wa.me/${(clients.find((c) => c.id === selectedClient)?.phone || "").replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`h-10 w-10 rounded-2xl grid place-items-center ${
                        theme === "light" ? "bg-white border border-slate-200 text-rose-700" : "bg-white/10 border border-white/15 text-rose-100"
                      }`}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
        {children}
      </main>

      <nav className={`fixed bottom-0 left-0 right-0 z-30 backdrop-blur-2xl border-t bg-glass`} style={{ borderColor: 'var(--border)' }}>
        <div className="safe-area">
          <div className="flex justify-center">
            <div className="grid grid-cols-6 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6 gap-0 w-full">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = location.pathname === tab.to;
                return (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    className="flex flex-col items-center py-3 text-xs gap-1"
                  >
                    <motion.div
                      animate={{ scale: isActive ? 1 : 0.96 }}
                      className={`h-10 w-10 rounded-2xl grid place-items-center transition-colors ${
                        isActive
                          ? theme === "light"
                            ? "bg-rose-100 border border-rose-200 text-rose-700"
                            : "bg-rose-500/25 border border-rose-400/30 text-rose-100"
                          : theme === "light"
                            ? "text-slate-500"
                            : "text-gray-200"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </motion.div>
                    <span className={isActive ? (theme === "light" ? "text-rose-700" : "text-rose-100") : (theme === "light" ? "text-slate-600" : "text-gray-200")}>{tab.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default AppShell;
