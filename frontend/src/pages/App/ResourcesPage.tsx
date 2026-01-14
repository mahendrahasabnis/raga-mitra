import React, { useEffect, useState } from "react";
import { Users, Stethoscope, Dumbbell, Salad, PhoneCall, MessageCircle, MessageSquare, Plus, Search, X, Trash2 } from "lucide-react";
import { resourcesApi, userApi } from "../../services/api";

const ResourcesPage: React.FC = () => {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(
    () => localStorage.getItem("client-context-id")
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "client-context-id") {
        setSelectedClient(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const res = await resourcesApi.list();
      // Normalize roles: ensure each resource has a roles array
      const normalizedResources = (Array.isArray(res.resources) ? res.resources : []).map((r: any) => {
        if (r.roles) {
          // Already has roles array
          if (typeof r.roles === 'string') {
            try {
              r.roles = JSON.parse(r.roles);
            } catch {
              r.roles = [r.roles];
            }
          }
          if (!Array.isArray(r.roles)) {
            r.roles = [r.roles];
          }
        } else if (r.role) {
          // Has old role field, convert to array
          r.roles = [r.role];
        } else {
          r.roles = [];
        }
        return r;
      });
      setResources(normalizedResources);
    } catch (error) {
      console.error("Failed to fetch resources:", error);
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    
    // Get selected roles from checkboxes
    const selectedRoles: string[] = [];
    const roles = ['Doctor', 'FitnessTrainer', 'Dietitian'];
    roles.forEach(role => {
      if (formData.get(`role-${role}`) === 'on') {
        selectedRoles.push(role);
      }
    });

    if (!name || !phone || selectedRoles.length === 0) {
      alert("Please fill all fields and select at least one role");
      return;
    }

    try {
      const response = await resourcesApi.add({ name, phone, roles: selectedRoles });
      setShowAddForm(false);
      // Update local state with the new resources from response instead of refetching
      if (response.resources && Array.isArray(response.resources)) {
        const normalizedResources = response.resources.map((r: any) => {
          if (r.roles) {
            if (typeof r.roles === 'string') {
              try {
                r.roles = JSON.parse(r.roles);
              } catch {
                r.roles = [r.roles];
              }
            }
            if (!Array.isArray(r.roles)) {
              r.roles = [r.roles];
            }
          } else if (r.role) {
            r.roles = [r.role];
          } else {
            r.roles = [];
          }
          return r;
        });
        setResources(normalizedResources);
      } else {
        // Fallback to refetch if response format is unexpected
        fetchResources();
      }
    } catch (error: any) {
      console.error("Failed to add resource:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error details:", error.response?.data?.details);
      console.error("Error details array:", JSON.stringify(error.response?.data?.details, null, 2));
      const errorMessage = error.response?.data?.message || "Failed to add resource";
      const details = error.response?.data?.details;
      let fullMessage = errorMessage;
      if (details) {
        if (Array.isArray(details)) {
          fullMessage = details.length > 0 
            ? `${errorMessage}: ${details.map((d: any) => (typeof d === 'string' ? d : d.message || JSON.stringify(d))).join(', ')}`
            : errorMessage;
        } else if (typeof details === 'object') {
          const detailStr = details.message || details.sql || JSON.stringify(details);
          fullMessage = `${errorMessage}: ${detailStr}`;
        } else {
          fullMessage = `${errorMessage}: ${details}`;
        }
      }
      alert(fullMessage);
    }
  };

  const handleToggleAccess = async (resourceId: string, accessType: 'health' | 'fitness' | 'diet', currentValue: boolean) => {
    try {
      const payload: any = {};
      payload[`access_${accessType}`] = !currentValue;
      
      console.log('🟢 [FRONTEND] Toggling access:', { resourceId, accessType, currentValue, newValue: !currentValue, payload });
      const response = await resourcesApi.updateAccess(resourceId, payload);
      
      // Update only the affected resource in the local state instead of refetching all
      setResources((prevResources) =>
        prevResources.map((resource) =>
          resource.id === resourceId
            ? { ...resource, ...response.resource }
            : resource
        )
      );
    } catch (error: any) {
      console.error("Failed to update access:", error);
      alert(error.response?.data?.message || "Failed to update access");
    }
  };

  const handleToggleRole = async (resourceId: string, role: string, currentRoles: string[]) => {
    try {
      const newRoles = currentRoles.includes(role)
        ? currentRoles.filter(r => r !== role)
        : [...currentRoles, role];
      
      const payload = { roles: newRoles };
      console.log('🟢 [FRONTEND] Toggling role:', { resourceId, role, currentRoles, newRoles, payload });
      const response = await resourcesApi.updateAccess(resourceId, payload);
      
      // Update only the affected resource in the local state
      setResources((prevResources) =>
        prevResources.map((resource) =>
          resource.id === resourceId
            ? { ...resource, ...response.resource, roles: newRoles }
            : resource
        )
      );
    } catch (error: any) {
      console.error("Failed to update roles:", error);
      alert(error.response?.data?.message || "Failed to update roles");
    }
  };

  const handleDelete = async (resourceId: string, resourceName: string) => {
    if (!confirm(`Are you sure you want to remove ${resourceName}?`)) {
      return;
    }

    try {
      await resourcesApi.delete(resourceId);
      // Remove from local state instead of refetching
      setResources((prevResources) => prevResources.filter(r => r.id !== resourceId));
    } catch (error: any) {
      console.error("Failed to delete resource:", error);
      alert(error.response?.data?.message || "Failed to delete resource");
    }
  };

  const handleLookup = async (phone: string, setName: (name: string) => void) => {
    try {
      const response = await userApi.getByPhone(phone);
      if (response.user?.name) {
        setName(response.user.name);
      }
    } catch (error) {
      // User not found, allow manual entry
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'doctor':
        return <Stethoscope className="h-4 w-4 text-blue-400" />;
      case 'fitnesstrainer':
      case 'fitness trainer':
        return <Dumbbell className="h-4 w-4 text-emerald-400" />;
      case 'dietitian':
        return <Salad className="h-4 w-4 text-rose-400" />;
      default:
        return <Users className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRoleIconsGrid = (roles: string[]) => {
    if (!roles || roles.length === 0) {
      return <Users className="h-5 w-5 text-gray-400" />;
    }
    
    // Show up to 4 roles in a 2x2 grid
    const displayRoles = roles.slice(0, 4);
    const roleMap: { [key: string]: React.ReactNode } = {
      'Doctor': <Stethoscope className="h-4 w-4 text-blue-400" />,
      'FitnessTrainer': <Dumbbell className="h-4 w-4 text-emerald-400" />,
      'Dietitian': <Salad className="h-4 w-4 text-rose-400" />,
    };

    return (
      <div className="grid grid-cols-2 gap-1 w-10 h-10">
        {displayRoles.map((role, index) => (
          <div key={index} className="flex items-center justify-center">
            {roleMap[role] || <Users className="h-3 w-3 text-gray-400" />}
          </div>
        ))}
        {displayRoles.length < 4 && Array.from({ length: 4 - displayRoles.length }).map((_, index) => (
          <div key={`empty-${index}`} className="w-4 h-4" />
        ))}
      </div>
    );
  };

  const filteredResources = resources.filter((r) => {
    const matchesSearch = !searchTerm || 
      r.resource_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.resource_phone?.includes(searchTerm);
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="card p-4">
        <p className="text-sm text-gray-400">Loading resources...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      {!selectedClient && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Resources</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Resource
          </button>
        </div>
      )}

      {resources.length > 0 && (
        <div className="card p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search resources..."
              className="input-field w-full pl-10"
            />
          </div>
        </div>
      )}

      {showAddForm && !selectedClient && (
        <AddResourceForm
          onClose={() => setShowAddForm(false)}
          onAdd={handleAdd}
          onLookup={handleLookup}
        />
      )}

      {filteredResources.length === 0 ? (
        <div className="card p-8 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No resources found</p>
          {!selectedClient && (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary mt-4"
            >
              Add your first resource
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredResources.map((resource) => {
            const roles = Array.isArray(resource.roles) ? resource.roles : (resource.role ? [resource.role] : []);
            return (
              <div key={resource.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    {getRoleIconsGrid(roles)}
                    <div>
                      <h3 className="font-semibold">{resource.resource_name || 'Unknown'}</h3>
                      <p className="text-sm text-gray-400">{resource.resource_phone || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!selectedClient && (
                      <button
                        onClick={() => handleDelete(resource.id, resource.resource_name || 'this resource')}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition"
                        title="Remove Resource"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <a
                      href={`tel:${resource.resource_phone}`}
                      className="p-2 rounded-lg hover:bg-white/10 transition"
                      title="Call"
                    >
                      <PhoneCall className="h-4 w-4" />
                    </a>
                    <a
                      href={`sms:${resource.resource_phone}`}
                      className="p-2 rounded-lg hover:bg-white/10 transition"
                      title="SMS"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                    <a
                      href={`https://wa.me/${resource.resource_phone?.replace(/\+/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-white/10 transition"
                      title="WhatsApp"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Roles Toggle */}
                {!selectedClient && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-xs text-gray-400 mb-2">Roles:</p>
                    <div className="flex flex-wrap gap-2">
                      {['Doctor', 'FitnessTrainer', 'Dietitian'].map((role) => {
                        const isActive = roles.includes(role);
                        return (
                          <button
                            key={role}
                            onClick={() => handleToggleRole(resource.id, role, roles)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-gray-600/20 text-gray-400 border border-gray-600/30'
                            } hover:bg-opacity-30`}
                          >
                            {getRoleIcon(role)}
                            <span className="ml-1.5">{role === 'FitnessTrainer' ? 'Fitness Trainer' : role}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Access Controls */}
                {!selectedClient && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <p className="text-xs text-gray-400 mb-2">Access Permissions:</p>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Health</span>
                        <button
                          onClick={() => handleToggleAccess(resource.id, 'health', resource.access_health || false)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            resource.access_health ? 'bg-emerald-500' : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              resource.access_health ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Fitness</span>
                        <button
                          onClick={() => handleToggleAccess(resource.id, 'fitness', resource.access_fitness || false)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            resource.access_fitness ? 'bg-emerald-500' : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              resource.access_fitness ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Diet</span>
                        <button
                          onClick={() => handleToggleAccess(resource.id, 'diet', resource.access_diet || false)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            resource.access_diet ? 'bg-emerald-500' : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              resource.access_diet ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AddResourceForm: React.FC<{
  onClose: () => void;
  onAdd: (e: React.FormEvent<HTMLFormElement>) => void;
  onLookup: (phone: string, setName: (name: string) => void) => void;
}> = ({ onClose, onAdd, onLookup }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['Doctor']);

  useEffect(() => {
    if (phone.length >= 10) {
      const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
      onLookup(normalizedPhone, setName);
    }
  }, [phone, onLookup]);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Doctor':
        return <Stethoscope className="h-4 w-4" />;
      case 'FitnessTrainer':
        return <Dumbbell className="h-4 w-4" />;
      case 'Dietitian':
        return <Salad className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Add Resource</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={onAdd} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Roles (Select one or more)</label>
          <div className="space-y-2">
            {['Doctor', 'FitnessTrainer', 'Dietitian'].map((role) => (
              <label key={role} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name={`role-${role}`}
                  checked={selectedRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500"
                />
                <div className="flex items-center gap-2">
                  {getRoleIcon(role)}
                  <span className="text-sm">{role === 'FitnessTrainer' ? 'Fitness Trainer' : role}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Phone Number</label>
          <input
            type="tel"
            name="phone"
            value={phone}
            onChange={(e) => {
              let value = e.target.value;
              if (!value.startsWith('+')) {
                value = '+91' + value.replace(/^\+?91?/, '');
              }
              setPhone(value);
            }}
            className="input-field w-full"
            placeholder="+919876543210"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field w-full"
            required
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1">
            Add
          </button>
        </div>
      </form>
    </div>
  );
};

export default ResourcesPage;
