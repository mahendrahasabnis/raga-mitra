import React, { useEffect, useState } from "react";
import { Users, ShieldCheck, Phone, PhoneCall, MessageSquare, MessageCircle, Stethoscope, Dumbbell, Salad } from "lucide-react";
import { resourcesApi, userApi } from "../../services/api";

const cardBase = "card";

const roleOptions = ["Doctor", "FitnessTrainer", "Dietitian"];

const ResourcesPage: React.FC = () => {
  const [resources, setResources] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", role: "Doctor" });
  const [loading, setLoading] = useState(false);
  const [nameReadOnly, setNameReadOnly] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const load = async () => {
    try {
      const res = await resourcesApi.list();
      console.log('🟢 [FRONTEND] Resources list response:', res);
      // Ensure resources is always an array
      const resourcesList = res.resources;
      if (Array.isArray(resourcesList)) {
        setResources(resourcesList);
      } else if (resourcesList && typeof resourcesList === 'object') {
        // If it's an object, try to convert to array or use empty array
        console.warn('🟢 [FRONTEND] Resources is not an array, using empty array');
        setResources([]);
      } else {
        setResources([]);
      }
    } catch (err) {
      console.warn("resources load failed", err);
      setResources([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Lookup user by phone to auto-populate name; make name read-only when found
  useEffect(() => {
    const digits = form.phone.replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length < 10) {
      setNameReadOnly(false);
      setLookupStatus(null);
      return;
    }
    const controller = new AbortController();
    const lookup = async () => {
      setIsLookingUp(true);
      setLookupStatus(null);
      try {
        const normalized = digits.startsWith("+") ? digits : `+${digits}`;
        const res = await userApi.getByPhone(normalized);
        if (res?.user?.name) {
          setForm((f) => ({ ...f, name: res.user.name }));
          setNameReadOnly(true);
          setLookupStatus("Found user");
        } else {
          setNameReadOnly(false);
          setLookupStatus("Not found, please enter name");
        }
      } catch (err: any) {
        setNameReadOnly(false);
        setLookupStatus("Not found, please enter name");
      } finally {
        setIsLookingUp(false);
      }
    };
    const t = setTimeout(lookup, 400);
    return () => clearTimeout(t);
  }, [form.phone]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // If phone doesn't start with + and user is typing, add +91 prefix
    if (!value.startsWith('+')) {
      // Extract digits only
      const digits = value.replace(/\D/g, '');
      if (digits.length > 0) {
        // Auto-add +91 prefix when first digit is entered
        value = `+91${digits}`;
      } else {
        // If no digits, keep empty (allows clearing)
        value = '';
      }
    }
    // If it starts with +, keep it as is (user might be entering different country code)
    
    setForm((f) => ({ ...f, phone: value }));
  };

  const handleAdd = async () => {
    if (loading) return;
    setLoading(true);
    setSaveStatus(null);
    const payload = {
      ...form,
      access_health: true,
      access_fitness: true,
      access_diet: true,
    };
    console.log('🟢 [FRONTEND] Adding resource with payload:', payload);
    try {
      const res = await resourcesApi.add(payload);
      console.log('🟢 [FRONTEND] Add resource response:', res);
      if (res?.resource) {
        console.log('🟢 [FRONTEND] Resource added successfully, updating UI');
        setResources((prev) => [res.resource, ...prev]);
        setForm({ name: "", phone: "", role: "Doctor" });
        setNameReadOnly(false);
        setLookupStatus(null);
        setSaveStatus({ type: "success", message: "Resource added and saved to aarogya_mitra." });
      } else {
        console.error('🟢 [FRONTEND] No resource in response:', res);
        setSaveStatus({ type: "error", message: "Save failed. No resource returned." });
      }
    } catch (err: any) {
      console.error('🟢 [FRONTEND] Resource add failed:', err);
      console.error('🟢 [FRONTEND] Error details:', err.response?.data || err.message);
      setSaveStatus({ type: "error", message: `Save failed: ${err.response?.data?.message || err.message || 'Unknown error'}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className={`${cardBase} p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-rose-200" />
          <h2 className="text-lg font-semibold">Resources</h2>
        </div>
        <p className="text-sm text-gray-300/80">Doctors, trainers, dietitians with access controls.</p>
      </section>

      <section className={`${cardBase} p-4 space-y-3`}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-gray-400">Name</p>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
              disabled={nameReadOnly}
              className={`w-full rounded-xl px-3 py-2 text-sm ${
                nameReadOnly
                  ? "bg-white/5 border border-white/10 text-gray-300 cursor-not-allowed"
                  : "bg-white/10 border border-white/10 text-white"
              }`}
            />
            {lookupStatus && (
              <p className="text-[11px] text-gray-400">{isLookingUp ? "Searching..." : lookupStatus}</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-400">Phone</p>
            <div className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-3 py-2">
              <Phone className="h-4 w-4 text-rose-200" />
              <input
                value={form.phone}
                onChange={handlePhoneChange}
                placeholder="+91..."
                className="bg-transparent w-full text-sm text-white outline-none"
                inputMode="tel"
              />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-400">Role</p>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-sm text-white"
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={loading}
          className="w-full rounded-xl bg-rose-500/80 text-sm font-semibold py-3 shadow-lg shadow-rose-900/40"
        >
          {loading ? "Saving..." : "Add resource"}
        </button>
        {saveStatus && (
          <p className={`text-sm mt-1 ${saveStatus.type === "success" ? "text-emerald-300" : "text-red-300"}`}>
            {saveStatus.message}
          </p>
        )}
      </section>

      <section className={`${cardBase} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-rose-200" />
          <h3 className="text-md font-semibold">Access</h3>
        </div>
        <div className="space-y-3">
          {resources.length === 0 && <p className="text-sm text-gray-400">No resources yet.</p>}
          {resources.map((r) => {
            const resourceName = r.name || r.resource_name || '';
            const resourcePhone = r.phone || r.resource_phone || '';
            const phoneDigitsOnly = resourcePhone.replace(/[^0-9]/g, '');
            const role = (r.role || '').toLowerCase();
            
            // Determine icon based on role
            let RoleIcon = Users;
            if (role.includes('doctor')) {
              RoleIcon = Stethoscope;
            } else if (role.includes('fitness') || role.includes('trainer')) {
              RoleIcon = Dumbbell;
            } else if (role.includes('diet') || role.includes('nutrition')) {
              RoleIcon = Salad;
            }
            
            return (
              <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <RoleIcon className="h-5 w-5 text-rose-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{resourceName || resourcePhone || 'Unknown'}</p>
                      {resourcePhone && (
                        <p className="text-xs text-gray-400 mt-0.5">{resourcePhone}</p>
                      )}
                    </div>
                  </div>
                  {resourcePhone && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={`tel:${resourcePhone}`}
                        className="h-9 w-9 rounded-xl grid place-items-center bg-white/10 border border-white/15 text-rose-100 hover:bg-white/20 transition-colors"
                        title="Call"
                      >
                        <PhoneCall className="h-4 w-4" />
                      </a>
                      <a
                        href={`sms:${resourcePhone}`}
                        className="h-9 w-9 rounded-xl grid place-items-center bg-white/10 border border-white/15 text-rose-100 hover:bg-white/20 transition-colors"
                        title="SMS"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                      <a
                        href={`https://wa.me/${phoneDigitsOnly}`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-9 w-9 rounded-xl grid place-items-center bg-white/10 border border-white/15 text-rose-100 hover:bg-white/20 transition-colors"
                        title="WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ResourcesPage;
