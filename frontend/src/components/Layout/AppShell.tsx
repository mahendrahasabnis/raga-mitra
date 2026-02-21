import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HeartPulse, Home, Dumbbell, Salad, Users, LogOut, PhoneCall, MessageCircle, MessageSquare, Sun, Moon, User, LayoutDashboard, ScanLine } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "../../contexts/AuthContext";
import { ClientProvider } from "../../contexts/ClientContext";
import { resourcesApi } from "../../services/api";
import QrScannerModal from "../Shared/QrScannerModal";

const baseTabs = [
  { to: "/app/today", label: "Today", icon: Home },
  { to: "/app/dash", label: "Dash", icon: LayoutDashboard },
  { to: "/app/health", label: "Health", myLabel: "My Health", icon: HeartPulse },
  { to: "/app/fitness", label: "Fitness", myLabel: "My Fitness", icon: Dumbbell },
  { to: "/app/diet", label: "Diet", myLabel: "My Diet", icon: Salad },
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
  const [selectedClient, setSelectedClient] = useState<string | null>(() => localStorage.getItem("client-context-id"));
  const [clientSearch, setClientSearch] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [patientFromDash, setPatientFromDash] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showQrPopup, setShowQrPopup] = useState(false);

  // Read client from URL during render so it's available immediately when navigating from Dash
  const urlClient = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("client")?.trim() || null;
  }, [location.search]);

  const effectiveSelectedClient = urlClient || selectedClient;

  // Use patientFromDash from location.state when navigating from Dash (available on first render)
  const statePatient = (location.state as { patientFromDash?: { id: string; name: string; phone: string } } | undefined)?.patientFromDash;
  const effectivePatientFromDash = (urlClient && statePatient?.id === urlClient) ? statePatient : patientFromDash;

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
      setPatientFromDash(null);
    }
  }, [selectedClient]);

  // Sync selectedClient from URL when navigating from Dash (or any page with ?client=)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const clientId = params.get("client")?.trim();
    const state = location.state as { patientFromDash?: { id: string; name: string; phone: string } } | undefined;
    if (clientId) {
      setSelectedClient(clientId);
      if (state?.patientFromDash && state.patientFromDash.id === clientId) {
        setPatientFromDash(state.patientFromDash);
      }
    }
  }, [location.search, location.state]);

  const hasResourceRole = useMemo(() => {
    const plat = user?.privileges?.find((p) => p.platform === "aarogya-mitra");
    const roles = (plat?.roles || []).concat(user?.role ? [user.role] : []);
    return roles.some((r) => r && ['doctor', 'fitnesstrainer', 'fitness trainer', 'dietitian', 'dietition', 'nutritionist'].includes(String(r).toLowerCase()));
  }, [user]);

  const hasCheckinRole = useMemo(() => {
    const plat = user?.privileges?.find((p) => p.platform === "aarogya-mitra");
    const roles = (plat?.roles || []).concat(user?.role ? [user.role] : []);
    return roles.some((r) => r && ['doctor', 'receptionist', 'nurse'].includes(String(r).toLowerCase()));
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
          // Clear stored client only if list loaded and client is no longer in it.
          // Do NOT clear when URL has ?client= — user explicitly navigated to view that patient (e.g. from Dash).
          const urlClient = new URLSearchParams(window.location.search).get("client")?.trim();
          if (mappedClients.length > 0 && !urlClient) {
            setSelectedClient((prev) => {
              if (!prev) return prev;
              return mappedClients.some((c: { id: string }) => c.id === prev) ? prev : null;
            });
          }
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
  }, [hasResourceRole, selectedClient]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const term = clientSearch.toLowerCase();
    return clients.filter((c) =>
      (c.name || "").toLowerCase().includes(term) || (c.phone || "").toLowerCase().includes(term)
    );
  }, [clients, clientSearch]);

  const selectedClientLabel = useMemo(() => {
    if (!effectiveSelectedClient) return "My data";
    if (effectivePatientFromDash && effectivePatientFromDash.id === effectiveSelectedClient) {
      const { name, phone } = effectivePatientFromDash;
      if (name && phone) return `${name} - ${phone}`;
      return name || phone || "My data";
    }
    const client = clients.find((c) => c.id === effectiveSelectedClient);
    if (!client) return "My data";
    const name = client.name || "";
    const phone = client.phone || "";
    if (name && phone) return `${name} - ${phone}`;
    return name || phone || "My data";
  }, [clients, effectiveSelectedClient, effectivePatientFromDash]);

  const selectedClientName = useMemo(() => {
    if (!effectiveSelectedClient) return "";
    if (effectivePatientFromDash && effectivePatientFromDash.id === effectiveSelectedClient) return effectivePatientFromDash.name || effectivePatientFromDash.phone || "";
    const client = clients.find((c) => c.id === effectiveSelectedClient);
    return client?.name || client?.phone || "";
  }, [clients, effectiveSelectedClient, effectivePatientFromDash]);

  const selectedClientPhone = useMemo(() => {
    if (!effectiveSelectedClient) return "";
    if (effectivePatientFromDash && effectivePatientFromDash.id === effectiveSelectedClient) return effectivePatientFromDash.phone || "";
    const client = clients.find((c) => c.id === effectiveSelectedClient);
    return client?.phone || "";
  }, [clients, effectiveSelectedClient, effectivePatientFromDash]);

  const selectedClientPhoneDigits = useMemo(() => {
    return (selectedClientPhone || "").replace(/[^0-9+]/g, "");
  }, [selectedClientPhone]);

  useEffect(() => {
    if (!clientSearch) return;
    if (filteredClients.length === 1) {
      setSelectedClient(filteredClients[0].id);
    }
  }, [clientSearch, filteredClients]);

  const navTabs = useMemo(() => {
    const viewingClient = !!effectiveSelectedClient;
    const resolved = baseTabs.map(t => ({
      ...t,
      label: viewingClient ? t.label : (t.myLabel || t.label),
    }));
    if (hasResourceRole && viewingClient) {
      return resolved.filter((t) => t.to !== "/app/resources" && t.to !== "/app/dash");
    }
    if (!hasResourceRole) {
      return resolved.filter((t) => t.to !== "/app/dash");
    }
    return resolved;
  }, [hasResourceRole, effectiveSelectedClient]);

  const rolesLabel = useMemo(() => {
    const plat = user?.privileges?.find((p) => p.platform === "aarogya-mitra");
    const roles = (plat?.roles || []).filter((r) => r && String(r).toLowerCase() !== 'guest');
    return roles.join(", ");
  }, [user]);

  const shellBg = theme === "light"
    ? "text-foreground"
    : "text-foreground";

  return (
    <div className={`min-h-screen ${shellBg} flex flex-col`}>
      <header className={`sticky top-0 z-20 backdrop-blur-xl ${theme === "light" ? "bg-glass border-b" : "bg-glass border-b"}`} style={{ borderColor: 'var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="safe-area px-4 py-3 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex flex-col gap-0.5">
              <p className={`text-xs uppercase tracking-[0.15em] ${theme === "light" ? "text-rose-600/80" : "text-rose-300/80"}`}>Aarogya-Mitra</p>
              {user?.name && <p className="text-sm font-semibold whitespace-normal">{user.name}</p>}
              {rolesLabel && (
                <p className={`text-[11px] ${theme === "light" ? "text-slate-600" : "text-gray-400"}`}>
                  Roles: {rolesLabel}
                </p>
              )}
              {rolesLabel && (
                <div className={`h-px w-full ${theme === "light" ? "bg-slate-200" : "bg-white/10"}`} />
              )}
              {selectedClientName && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${theme === "light" ? "text-emerald-700" : "text-emerald-200"}`}>
                    {selectedClientName}
                  </span>
                  <span className={`text-[11px] ${theme === "light" ? "text-slate-600" : "text-gray-400"}`}>
                    <a
                      href={`tel:${selectedClientPhone}`}
                      className="hover:underline"
                    >
                      CALL
                    </a>
                    {" / "}
                    <a
                      href={`sms:${selectedClientPhone}`}
                      className="hover:underline"
                    >
                      SMS
                    </a>
                    {" / "}
                    <a
                      href={`https://wa.me/${selectedClientPhoneDigits.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      Whats App
                    </a>
                    {" / "}
                    <a
                      href={`https://wa.me/${selectedClientPhoneDigits.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      V-Call
                    </a>
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 justify-end">
              {user?.id && (
                <button
                  onClick={() => setShowQrPopup(true)}
                  className="flex flex-col items-center cursor-pointer"
                  title="Tap to enlarge QR"
                >
                  <QRCodeCanvas
                    value={user.id}
                    size={56}
                    bgColor="transparent"
                    fgColor={theme === "light" ? "#111827" : "#e5e7eb"}
                  />
                  <span className={`text-[10px] ${theme === "light" ? "text-slate-600" : "text-gray-400"}`}>
                    User QR
                  </span>
                </button>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {hasCheckinRole && (
                  <button
                    onClick={() => setShowQrScanner(true)}
                    className={`h-8 w-8 rounded-2xl border flex items-center justify-center transition ${
                      theme === "light"
                        ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 shadow-sm"
                        : "bg-rose-500/15 border-rose-400/30 text-rose-300 hover:bg-rose-500/25"
                    }`}
                    title="Scan patient QR"
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                  </button>
                )}
                {hasResourceRole && (
                  <button
                    onClick={() => setClientPickerOpen(true)}
                    className={`h-8 w-8 rounded-2xl text-sm font-medium border transition flex items-center justify-center ${
                      theme === "light"
                        ? "bg-white text-slate-900 border-slate-200 shadow-sm"
                        : "bg-white/10 text-white border-white/15"
                    }`}
                    title="Clients"
                  >
                    <Users className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                  className={`h-8 w-8 rounded-2xl border flex items-center justify-center transition ${
                    theme === "light"
                      ? "bg-white text-slate-900 border-black/10 shadow-sm"
                      : "bg-white/10 border-white/15 text-white"
                  }`}
                  title={theme === "light" ? "Switch to dark" : "Switch to light"}
                >
                  {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => { logout(); navigate("/login"); }}
                  className={`h-8 w-8 rounded-2xl border flex items-center justify-center transition ${
                    theme === "light" ? "bg-white text-slate-900 border-black/10 hover:bg-slate-100 shadow-sm" : "bg-white/10 border border-white/15 hover:bg-white/15 text-white"
                  }`}
                  title="Logout"
                >
                  <LogOut className={`h-3.5 w-3.5 ${theme === "light" ? "text-rose-700" : "text-rose-200"}`} />
                </button>
              </div>
            </div>
          </div>
          {effectiveSelectedClient && (
            <div
              className={`px-3 py-2 flex items-center justify-between gap-3 rounded-xl ${
              theme === "light"
                ? "bg-emerald-500/25 border border-emerald-400/50 text-emerald-900"
                : "bg-emerald-500/30 border border-emerald-400/40 text-emerald-100"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span className="font-semibold truncate">
                Viewing patient data: {selectedClientName || effectiveSelectedClient}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedClient(null);
                const params = new URLSearchParams(location.search);
                params.delete("client");
                const search = params.toString();
                navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
              }}
              className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded-lg transition ${
                theme === "light"
                  ? "bg-emerald-500/40 hover:bg-emerald-500/60 text-emerald-900"
                  : "bg-emerald-500/40 hover:bg-emerald-500/60 text-emerald-100"
              }`}
            >
              Clear
            </button>
          </div>
          )}
        </div>
      </header>
      {clientPickerOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-xl w-full p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Select Client</h2>
              <button
                onClick={() => setClientPickerOpen(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Search clients by name or phone..."
              className={`h-10 px-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 w-full ${
                theme === "light"
                  ? "bg-white border border-slate-200 text-slate-900"
                  : "bg-white/10 border border-white/15 text-white placeholder:text-gray-300"
              }`}
            />
            <div className="mt-3 max-h-80 overflow-y-auto space-y-2">
              <button
                onClick={() => {
                  setSelectedClient(null);
                  setClientPickerOpen(false);
                }}
                className={`w-full text-left p-3 rounded-lg transition ${theme === "light" ? "bg-slate-100 hover:bg-slate-200 text-slate-800" : "bg-white/5 hover:bg-white/10"}`}
              >
                My data
              </button>
              {filteredClients.map((c) => {
                const displayName = c.name || '';
                const displayPhone = c.phone || '';
                const displayText = displayName
                  ? (displayPhone ? `${displayName} - ${displayPhone}` : displayName)
                  : (displayPhone || 'Unknown');
                const isSelected = effectiveSelectedClient === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClient(c.id);
                      setClientPickerOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      isSelected
                        ? theme === "light"
                          ? "bg-emerald-500/30 text-emerald-900"
                          : "bg-emerald-500/20 text-emerald-200"
                        : theme === "light"
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-800"
                          : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {displayText}
                  </button>
                );
              })}
              {filteredClients.length === 0 && (
                <div className={`text-sm text-center py-6 ${theme === "light" ? "text-slate-600" : "text-gray-400"}`}>No clients found</div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-h-0 px-4 pt-4" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex-1 overflow-y-auto min-h-0">
          <ClientProvider value={effectiveSelectedClient}>{children}</ClientProvider>
        </div>
      </main>

      <nav className={`fixed bottom-0 left-0 right-0 z-30 backdrop-blur-2xl border-t bg-glass`} style={{ borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="safe-area">
          <div className="flex justify-center">
            <div className="flex justify-around w-full">
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

      {showQrScanner && (
        <QrScannerModal
          isOpen={showQrScanner}
          onClose={() => setShowQrScanner(false)}
        />
      )}

      {showQrPopup && user?.id && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQrPopup(false)}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`flex flex-col items-center gap-3 p-6 rounded-3xl shadow-2xl ${
              theme === "light" ? "bg-white" : "bg-gray-900 border border-white/10"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <QRCodeCanvas
              value={user.id}
              size={220}
              bgColor={theme === "light" ? "#ffffff" : "#111827"}
              fgColor={theme === "light" ? "#111827" : "#e5e7eb"}
              level="H"
              includeMargin
            />
            <p className={`text-sm font-medium ${theme === "light" ? "text-slate-700" : "text-gray-300"}`}>
              {user.name || "User QR"}
            </p>
            <p className={`text-xs ${theme === "light" ? "text-slate-400" : "text-gray-500"}`}>
              Show this to the receptionist
            </p>
            <button
              onClick={() => setShowQrPopup(false)}
              className={`mt-1 px-6 py-2 rounded-xl text-sm font-medium transition ${
                theme === "light"
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AppShell;
