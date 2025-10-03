import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Edit, Trash2, Save, X, Download, Upload, UserCheck, UserX, UserPlus } from 'lucide-react';

interface UserConfigProps {
  onBack: () => void;
}

interface User {
  _id: string;
  phone: string;
  credits: number;
  role: 'user' | 'admin';
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

const UserConfig: React.FC<UserConfigProps> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>([
    {
      _id: '1',
      phone: '+1234567890',
      credits: 999999,
      role: 'admin',
      createdAt: '2024-01-01T00:00:00.000Z',
      lastLogin: new Date().toISOString(),
      isActive: true
    },
    {
      _id: '2',
      phone: '+1234567891',
      credits: 10,
      role: 'user',
      createdAt: '2024-01-01T00:00:00.000Z',
      lastLogin: new Date().toISOString(),
      isActive: true
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({
    phone: '',
    credits: 0,
    role: 'user',
    isActive: true
  });

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      // Use the same API base URL as other requests
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api';
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded users:', data);
        setUsers(data);
      } else {
        console.error('Failed to load users:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Validate required fields for new users
      if (!editingUser && !formData.phone) {
        alert('Phone number is required for new users');
        return;
      }

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api';
      const url = editingUser 
        ? `${API_BASE_URL}/users/${editingUser._id}`
        : `${API_BASE_URL}/users`;
      
      const method = editingUser ? 'PUT' : 'POST';
      
      // For editing, only send editable fields (exclude phone and PIN)
      const requestData = editingUser 
        ? {
            credits: formData.credits,
            role: formData.role,
            isActive: formData.isActive
          }
        : formData;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        await loadUsers();
        setShowForm(false);
        setEditingUser(null);
        setFormData({
          phone: '',
          credits: 0,
          role: 'user',
          isActive: true
        });
        alert(editingUser ? 'User updated successfully!' : 'User created successfully!');
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Error: ${errorData.message || 'Failed to save user'}`);
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving user. Please try again.');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData(user);
    setShowForm(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api';
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await loadUsers();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api';
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isActive: !isActive })
      });

      if (response.ok) {
        await loadUsers();
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const exportUsers = () => {
    const dataStr = JSON.stringify(users, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users-config-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importUsers = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedUsers = JSON.parse(e.target?.result as string);
        
        if (Array.isArray(importedUsers)) {
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api';
          const response = await fetch(`${API_BASE_URL}/users/import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ users: importedUsers })
          });

          if (response.ok) {
            await loadUsers();
            alert('Users imported successfully!');
          } else {
            alert('Error importing users. Please check the file format.');
          }
        } else {
          alert('Invalid file format. Please ensure the file contains an array of user objects.');
        }
      } catch (error) {
        console.error('Error importing users:', error);
        alert('Error parsing the file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const filteredUsers = users.filter(user =>
    user.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={exportUsers}
            className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <label className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import</span>
            <input
              type="file"
              accept=".json"
              onChange={importUsers}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Search */}
      <div className="p-6 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
          <input
            type="text"
            placeholder="Search users by phone or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {showForm ? (
          /* Form */
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-white">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h4>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                  setFormData({
                    phone: '',
                    credits: 0,
                    role: 'user',
                    isActive: true
                  });
                }}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Phone Number {editingUser && <span className="text-red-400 text-xs">(Cannot be edited)</span>}
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    editingUser ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  placeholder="+1234567890"
                  disabled={editingUser ? true : false}
                  required
                />
                {editingUser && (
                  <p className="text-xs text-gray-400 mt-1">
                    Phone number cannot be changed for existing users
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Credits
                </label>
                <input
                  type="number"
                  value={formData.credits || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, credits: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Number of credits"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Role
                </label>
                <select
                  value={formData.role || 'user'}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'user' | 'admin' }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  PIN {editingUser && <span className="text-red-400 text-xs">(Cannot be edited)</span>}
                </label>
                <input
                  type="password"
                  value={editingUser ? "••••••" : "0000"}
                  className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white ${
                    editingUser ? 'opacity-50 cursor-not-allowed' : 'opacity-75'
                  }`}
                  disabled
                  placeholder="PIN is encrypted"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {editingUser 
                    ? "PIN is encrypted and cannot be viewed or edited by administrators"
                    : "New users will have default PIN '0000' (encrypted in database)"
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isActive || false}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-white">Active</span>
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                  setFormData({
                    phone: '',
                    credits: 0,
                    role: 'user',
                    isActive: true
                  });
                }}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
            </div>
          </div>
        ) : (
          /* User List */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">User Management</h3>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-white/60">
                  {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
                </div>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setFormData({
                      phone: '',
                      credits: 0,
                      role: 'user',
                      isActive: true
                    });
                    setShowForm(true);
                  }}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add New User</span>
                </button>
              </div>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-5 h-5 text-blue-400 mt-0.5">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-300 mb-1">Security Notice</h4>
                  <p className="text-xs text-blue-200">
                    PIN codes are encrypted and never stored in plain text. They are not visible to administrators or database admins for security reasons.
                  </p>
                </div>
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-white/60 mt-2">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/60">
                  {searchTerm ? 'No users found matching your search.' : 'No users found.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredUsers.map((user) => (
                <div
                  key={user._id}
                  className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h4 className="text-lg font-medium text-white">{user.phone}</h4>
                        <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                          user.role === 'admin' 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-blue-600 text-white'
                        }`}>
                          {user.role.toUpperCase()}
                        </span>
                        {user.isActive ? (
                          <span className="px-3 py-1 bg-green-600 text-white text-xs rounded-full font-medium flex items-center space-x-1">
                            <UserCheck className="w-3 h-3" />
                            <span>ACTIVE</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gray-600 text-white text-xs rounded-full font-medium flex items-center space-x-1">
                            <UserX className="w-3 h-3" />
                            <span>INACTIVE</span>
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-2">
                        <div>
                          <p className="text-white/60 text-sm">Credits</p>
                          <p className="text-white font-medium">{user.credits}</p>
                        </div>
                        <div>
                          <p className="text-white/60 text-sm">Created</p>
                          <p className="text-white text-sm">{formatDate(user.createdAt)}</p>
                        </div>
                        {user.lastLogin && (
                          <div>
                            <p className="text-white/60 text-sm">Last Login</p>
                            <p className="text-white text-sm">{formatDate(user.lastLogin)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => toggleUserStatus(user._id, user.isActive)}
                        className={`p-2 rounded-lg transition-colors ${
                          user.isActive 
                            ? 'hover:bg-red-700 text-red-400' 
                            : 'hover:bg-green-700 text-green-400'
                        }`}
                        title={user.isActive ? 'Deactivate User' : 'Activate User'}
                      >
                        {user.isActive ? (
                          <UserX className="w-4 h-4" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserConfig;
