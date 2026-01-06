import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Building2, Plus, MapPin, Phone, Mail, Users, Calendar, Clock, Edit2, Save, X } from 'lucide-react';
import HCPRegistration from './HCPRegistration';
import { hcpApi } from '../../services/api';
import ClinicManagement from './ClinicManagement';
import PracticeManagement from './PracticeManagement';
import DoctorManagement from './DoctorManagement';
import ReceptionDutyManagement from './ReceptionDutyManagement';
import HCPTreeView from './HCPTreeView';
import HCPTreeViewSplit from './HCPTreeViewSplit';

interface HCP {
  _id: string;
  name: string;
  type: string;
  registrationNumber: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  contactInfo: {
    phone: string;
    email: string;
    website?: string;
  };
  owners: string[];
  receptionists: string[];
  clinics: any[];
  practices: any[];
  doctors: any[];
  createdAt: string;
}

type ViewMode = 'list' | 'register' | 'edit' | 'view' | 'clinics' | 'practices' | 'doctors' | 'duties' | 'tree';

const HCPManagement: React.FC = () => {
  const location = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [hcps, setHcps] = useState<HCP[]>([]);
  const [selectedHCP, setSelectedHCP] = useState<HCP | null>(null);
  const [editingHCP, setEditingHCP] = useState<HCP | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Set view mode based on current route and HCP status
  useEffect(() => {
    if (location.pathname === '/hcp/register') {
      setViewMode('register');
    } else if (location.pathname === '/hcp') {
      // On /hcp route: if no HCPs exist, show register form; otherwise show list/tree
      if (hcps.length === 0 && !loading) {
        setViewMode('register');
      } else if (hcps.length === 1) {
        // If owner has exactly one HCP, show it in tree view by default
        setSelectedHCP(hcps[0]);
        setViewMode('tree');
      } else if (hcps.length > 1) {
        // If owner has multiple HCPs, show list view
        setViewMode('list');
      }
    } else if (location.pathname === '/clinics' || location.pathname === '/clinics/add') {
      // Show clinic management - if only one HCP, auto-select it
      if (hcps.length === 1) {
        setSelectedHCP(hcps[0]);
        setViewMode('clinics');
      } else if (hcps.length > 1) {
        setViewMode('list'); // Show list to select HCP
      } else {
        setViewMode('list'); // No HCPs, show list
      }
    } else if (location.pathname === '/practices' || location.pathname === '/practices/add') {
      // Show practice management - if only one HCP, auto-select it
      if (hcps.length === 1) {
        setSelectedHCP(hcps[0]);
        setViewMode('practices');
      } else if (hcps.length > 1) {
        setViewMode('list'); // Show list to select HCP
      } else {
        setViewMode('list'); // No HCPs, show list
      }
    } else if (location.pathname === '/doctors') {
      // Show doctor management - if only one HCP, auto-select it
      if (hcps.length === 1) {
        setSelectedHCP(hcps[0]);
        setViewMode('doctors');
      } else if (hcps.length > 1) {
        setViewMode('list'); // Show list to select HCP
      } else {
        setViewMode('list'); // No HCPs, show list
      }
    } else if (hcps.length === 1) {
      // If owner has exactly one HCP, show it in tree view by default
      setSelectedHCP(hcps[0]);
      setViewMode('tree');
    } else if (hcps.length > 1) {
      // If owner has multiple HCPs, show list view
      setViewMode('list');
    } else {
      setViewMode('list');
    }
  }, [location.pathname, hcps.length]);

  useEffect(() => {
    loadHCPs();
  }, []);

  const loadHCPs = async () => {
    try {
      setLoading(true);
      const data = await hcpApi.getAll();
      setHcps(data.hcps);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHCPCreated = (hcp: HCP) => {
    setHcps(prev => [hcp, ...prev]);
    setViewMode('list');
  };

  const handleViewHCP = (hcp: HCP) => {
    setSelectedHCP(hcp);
    setViewMode('tree'); // Show tree view by default
  };

  const handleEditHCP = (hcp: HCP) => {
    setEditingHCP({ ...hcp });
    setViewMode('edit');
  };

  const handleSaveHCP = async () => {
    if (!editingHCP) return;

    try {
      setSaving(true);
      const updatedHCP = await hcpApi.update(editingHCP._id, editingHCP);
      setHcps(prev => prev.map(hcp => hcp._id === editingHCP._id ? updatedHCP : hcp));
      setEditingHCP(null);
      setViewMode('list');
    } catch (err: any) {
      setError(err.message || 'Failed to update HCP');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingHCP(null);
    setViewMode('list');
  };

  const handleViewModeChange = (mode: ViewMode, hcp?: HCP) => {
    setViewMode(mode);
    if (hcp) {
      setSelectedHCP(hcp);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getHCPTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'hospital': 'Hospital',
      'clinic': 'Clinic',
      'practice': 'Practice',
      'diagnostic_center': 'Diagnostic Center'
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading HCPs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={loadHCPs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (viewMode) {
      case 'register':
        return (
          <HCPRegistration
            onSuccess={handleHCPCreated}
            onCancel={() => {
              setViewMode('list');
            }}
          />
        );
      case 'view':
        return selectedHCP ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">HCP Details</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('tree')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center"
                >
                  <span className="mr-2">🌳</span>
                  View as Tree
                </button>
                <button
                  onClick={() => handleEditHCP(selectedHCP)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit HCP
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      HCP Name
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                      {selectedHCP.name}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                      {getHCPTypeLabel(selectedHCP.type)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Registration Number
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                      {selectedHCP.registrationNumber}
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Address</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Street
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                      {selectedHCP.address.street}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                        {selectedHCP.address.city}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                        {selectedHCP.address.state}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pincode
                      </label>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                        {selectedHCP.address.pincode}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Country
                      </label>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                        {selectedHCP.address.country}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                      {selectedHCP.contactInfo.phone}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                      {selectedHCP.contactInfo.email}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                      {selectedHCP.contactInfo.website || 'Not provided'}
                    </div>
                  </div>
                </div>

                {/* Licenses */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Licenses</h3>
                  {selectedHCP.licenses && selectedHCP.licenses.length > 0 ? (
                    <div className="space-y-3">
                      {selectedHCP.licenses.map((license: any, index: number) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                License Number
                              </label>
                              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                                {license.number}
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Issuing Authority
                              </label>
                              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                                {license.issuingAuthority}
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Valid From
                              </label>
                              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                                {license.validFrom}
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Valid To
                              </label>
                              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
                                {license.validTo}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No licenses registered</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null;
      case 'edit':
        return editingHCP ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Edit HCP</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingHCP(null);
                    setViewMode('list');
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveHCP}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      HCP Name (Read Only)
                    </label>
                    <input
                      type="text"
                      value={editingHCP.name}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={editingHCP.type}
                      onChange={(e) => setEditingHCP({...editingHCP, type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="hospital">Hospital</option>
                      <option value="clinic">Clinic</option>
                      <option value="practice">Practice</option>
                      <option value="diagnostic_center">Diagnostic Center</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={editingHCP.registrationNumber}
                      onChange={(e) => setEditingHCP({...editingHCP, registrationNumber: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Address</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Street
                    </label>
                    <input
                      type="text"
                      value={editingHCP.address.street}
                      onChange={(e) => setEditingHCP({
                        ...editingHCP, 
                        address: {...editingHCP.address, street: e.target.value}
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={editingHCP.address.city}
                        onChange={(e) => setEditingHCP({
                          ...editingHCP, 
                          address: {...editingHCP.address, city: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={editingHCP.address.state}
                        onChange={(e) => setEditingHCP({
                          ...editingHCP, 
                          address: {...editingHCP.address, state: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pincode
                      </label>
                      <input
                        type="text"
                        value={editingHCP.address.pincode}
                        onChange={(e) => setEditingHCP({
                          ...editingHCP, 
                          address: {...editingHCP.address, pincode: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Country
                      </label>
                      <input
                        type="text"
                        value={editingHCP.address.country}
                        onChange={(e) => setEditingHCP({
                          ...editingHCP, 
                          address: {...editingHCP.address, country: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={editingHCP.contactInfo.phone}
                      onChange={(e) => setEditingHCP({
                        ...editingHCP, 
                        contactInfo: {...editingHCP.contactInfo, phone: e.target.value}
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editingHCP.contactInfo.email}
                      onChange={(e) => setEditingHCP({
                        ...editingHCP, 
                        contactInfo: {...editingHCP.contactInfo, email: e.target.value}
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={editingHCP.contactInfo.website || ''}
                      onChange={(e) => setEditingHCP({
                        ...editingHCP, 
                        contactInfo: {...editingHCP.contactInfo, website: e.target.value}
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null;
      case 'clinics':
        return selectedHCP ? (
          <ClinicManagement
            hcp={selectedHCP}
            onBack={() => setViewMode('list')}
          />
        ) : null;
      case 'practices':
        return selectedHCP ? (
          <PracticeManagement
            hcp={selectedHCP}
            onBack={() => setViewMode('list')}
          />
        ) : null;
      case 'doctors':
        return selectedHCP ? (
          <DoctorManagement
            hcp={selectedHCP}
            onBack={() => setViewMode('list')}
          />
        ) : null;
      case 'duties':
        return selectedHCP ? (
          <ReceptionDutyManagement
            hcp={selectedHCP}
            onBack={() => setViewMode('list')}
          />
        ) : null;
      case 'tree':
        return selectedHCP ? (
          <HCPTreeViewSplit 
            hcpId={selectedHCP._id}
            onBack={() => {
              setSelectedHCP(null);
              setViewMode('list');
            }}
          />
        ) : null;
      case 'list':
      default:
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">
                  {location.pathname === '/clinics' ? 'Clinic Management' :
                   location.pathname === '/practices' ? 'Practice Management' :
                   location.pathname === '/doctors' ? 'Doctor Management' :
                   'Healthcare Providers'}
                </h1>
              </div>
              {hcps.length === 0 && (
                <button
                  onClick={() => setViewMode('register')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add HCP
                </button>
              )}
            </div>

            {/* Route-specific guidance */}
            {(location.pathname === '/clinics' || location.pathname === '/practices' || location.pathname === '/doctors') && hcps.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    {location.pathname === '/clinics' && 'Select a healthcare provider below to manage its clinics.'}
                    {location.pathname === '/practices' && 'Select a healthcare provider below to manage its practices.'}
                    {location.pathname === '/doctors' && 'Select a healthcare provider below to manage its doctors.'}
                  </p>
                </div>
              </div>
            )}

            {/* HCP List */}
            {hcps.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Healthcare Providers Found
                </h3>
                <p className="text-gray-500 mb-6">
                  Get started by registering your first healthcare provider.
                </p>
                <button
                  onClick={() => setViewMode('register')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Register HCP
                </button>
              </div>
            ) : (
              <div>
                {hcps.length > 0 && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <p className="text-sm text-blue-800">
                        You have {hcps.length} healthcare provider{hcps.length > 1 ? 's' : ''} registered. 
                        {hcps.length === 1 ? ' Click "View" to see details or "Edit" to modify.' : ' Select one to view or edit details.'}
                      </p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hcps.map((hcp) => (
                  <div
                    key={hcp._id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{hcp.name}</h3>
                          <p className="text-sm text-gray-500">{getHCPTypeLabel(hcp.type)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {hcp.address?.city && hcp.address?.state && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="h-4 w-4" />
                          <span>{hcp.address.city}, {hcp.address.state}</span>
                        </div>
                      )}
                      {hcp.contactInfo?.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4" />
                          <span>{hcp.contactInfo.phone}</span>
                        </div>
                      )}
                      {hcp.contactInfo?.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="h-4 w-4" />
                          <span>{hcp.contactInfo.email}</span>
                        </div>
                      )}
                      {!hcp.address?.city && !hcp.contactInfo?.phone && !hcp.contactInfo?.email && (
                        <div className="text-sm text-gray-400 italic">
                          No contact information provided
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center text-sm text-gray-600 mb-4">
                      <div>
                        <div className="font-medium text-gray-900">{hcp.clinics?.length || 0}</div>
                        <div>Clinics</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{hcp.practices?.length || 0}</div>
                        <div>Practices</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{hcp.doctors?.length || 0}</div>
                        <div>Doctors</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewModeChange('clinics', hcp)}
                        className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Clinics
                      </button>
                      <button
                        onClick={() => handleViewModeChange('practices', hcp)}
                        className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Practices
                      </button>
                      <button
                        onClick={() => handleViewModeChange('doctors', hcp)}
                        className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Doctors
                      </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleViewHCP(hcp)}
                          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <Building2 className="h-4 w-4" />
                          View
                        </button>
                        <button
                          onClick={() => handleEditHCP(hcp)}
                          className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleViewModeChange('duties', hcp)}
                        className="w-full px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <Calendar className="h-4 w-4" />
                        Manage Duties
                      </button>
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      Created: {formatDate(hcp.createdAt)}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {renderView()}
    </div>
  );
};

export default HCPManagement;
