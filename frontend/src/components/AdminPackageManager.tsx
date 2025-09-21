import React, { useState, useEffect } from 'react';
import { Edit, Save, X, Plus, Trash2, DollarSign, Package, Star } from 'lucide-react';

interface CreditPackage {
  id: number;
  credits: number;
  price: number;
  originalPrice: number;
  discount: number;
  popular: boolean;
  description: string;
}

interface AdminPackageManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onPackageUpdate: (packages: CreditPackage[]) => void;
}

const AdminPackageManager: React.FC<AdminPackageManagerProps> = ({
  isOpen,
  onClose,
  onPackageUpdate
}) => {
  const [packages, setPackages] = useState<CreditPackage[]>([
    {
      id: 1,
      credits: 7,
      price: 63,
      originalPrice: 70,
      discount: 10,
      popular: false,
      description: 'Perfect for trying out the app'
    },
    {
      id: 2,
      credits: 77,
      price: 462,
      originalPrice: 660,
      discount: 30,
      popular: true,
      description: 'Most popular choice'
    },
    {
      id: 3,
      credits: 777,
      price: 2331,
      originalPrice: 4662,
      discount: 50,
      popular: false,
      description: 'Great value for regular users'
    },
    {
      id: 4,
      credits: 7777,
      price: 7777,
      originalPrice: 77770,
      discount: 90,
      popular: false,
      description: 'Best value for music lovers'
    }
  ]);

  const [editingPackage, setEditingPackage] = useState<CreditPackage | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const calculateDiscount = (price: number, originalPrice: number) => {
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  };

  const handleEdit = (pkg: CreditPackage) => {
    setEditingPackage({ ...pkg });
    setIsAddingNew(false);
  };

  const handleAddNew = () => {
    setEditingPackage({
      id: Math.max(...packages.map(p => p.id)) + 1,
      credits: 0,
      price: 0,
      originalPrice: 0,
      discount: 0,
      popular: false,
      description: ''
    });
    setIsAddingNew(true);
  };

  const handleSave = () => {
    if (!editingPackage) return;

    const updatedPackage = {
      ...editingPackage,
      discount: calculateDiscount(editingPackage.price, editingPackage.originalPrice)
    };

    if (isAddingNew) {
      setPackages([...packages, updatedPackage]);
    } else {
      setPackages(packages.map(p => p.id === editingPackage.id ? updatedPackage : p));
    }

    setEditingPackage(null);
    setIsAddingNew(false);
    onPackageUpdate(packages);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this package?')) {
      setPackages(packages.filter(p => p.id !== id));
      onPackageUpdate(packages);
    }
  };

  const handleCancel = () => {
    setEditingPackage(null);
    setIsAddingNew(false);
  };

  const handleInputChange = (field: keyof CreditPackage, value: any) => {
    if (!editingPackage) return;
    
    setEditingPackage({
      ...editingPackage,
      [field]: value
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <div className="flex items-center space-x-3">
            <Package className="w-6 h-6 text-primary-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Admin - Package Management</h2>
              <p className="text-white/60 mt-1">Manage credit packages and pricing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Add New Package Button */}
          <div className="flex justify-end">
            <button
              onClick={handleAddNew}
              className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Package</span>
            </button>
          </div>

          {/* Packages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="relative bg-white/5 border border-white/20 rounded-xl p-4 hover:border-white/40 transition-colors"
              >
                {/* Popular Badge */}
                {pkg.popular && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center">
                      <Star className="w-3 h-3 mr-1" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Package Info */}
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-white mb-2">
                    {pkg.credits}
                  </div>
                  <div className="text-sm text-white/60 mb-1">credits</div>
                  
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <span className="text-2xl font-bold text-primary-400">
                      ₹{pkg.price}
                    </span>
                    <span className="text-lg text-white/40 line-through">
                      ₹{pkg.originalPrice}
                    </span>
                    <span className="text-sm text-green-400 font-semibold">
                      {pkg.discount}% OFF
                    </span>
                  </div>
                  
                  <div className="text-xs text-white/60">
                    {pkg.description}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(pkg)}
                    className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(pkg.id)}
                    className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Edit/Add Modal */}
          {editingPackage && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 w-full max-w-2xl">
                <div className="flex items-center justify-between p-6 border-b border-white/20">
                  <h3 className="text-xl font-bold text-white">
                    {isAddingNew ? 'Add New Package' : 'Edit Package'}
                  </h3>
                  <button
                    onClick={handleCancel}
                    className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Credits
                      </label>
                      <input
                        type="number"
                        value={editingPackage.credits}
                        onChange={(e) => handleInputChange('credits', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-primary-500"
                        placeholder="Enter credits"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Price (₹)
                      </label>
                      <input
                        type="number"
                        value={editingPackage.price}
                        onChange={(e) => handleInputChange('price', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-primary-500"
                        placeholder="Enter price"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Original Price (₹)
                      </label>
                      <input
                        type="number"
                        value={editingPackage.originalPrice}
                        onChange={(e) => handleInputChange('originalPrice', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-primary-500"
                        placeholder="Enter original price"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="popular"
                        checked={editingPackage.popular}
                        onChange={(e) => handleInputChange('popular', e.target.checked)}
                        className="w-4 h-4 text-primary-600 bg-white/10 border-white/20 rounded focus:ring-primary-500"
                      />
                      <label htmlFor="popular" className="text-sm text-white">
                        Mark as Most Popular
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editingPackage.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-primary-500"
                      placeholder="Enter package description"
                    />
                  </div>

                  {/* Preview */}
                  <div className="bg-white/5 rounded-lg p-4 border border-white/20">
                    <h4 className="text-sm font-medium text-white mb-2">Preview:</h4>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white mb-1">
                        {editingPackage.credits} credits
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-xl font-bold text-primary-400">
                          ₹{editingPackage.price}
                        </span>
                        <span className="text-lg text-white/40 line-through">
                          ₹{editingPackage.originalPrice}
                        </span>
                        <span className="text-sm text-green-400 font-semibold">
                          {calculateDiscount(editingPackage.price, editingPackage.originalPrice)}% OFF
                        </span>
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        {editingPackage.description}
                      </div>
                      {editingPackage.popular && (
                        <div className="mt-2">
                          <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                            Most Popular
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-4">
                    <button
                      onClick={handleCancel}
                      className="flex-1 py-3 px-6 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors flex items-center justify-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isAddingNew ? 'Add Package' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPackageManager;
