import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit, Trash2, Save, X, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface CreditConfigProps {
  onBack: () => void;
}

interface CreditPackage {
  _id?: string;
  name: string;
  credits: number;
  price: number;
  gstPercentage: number;
  isActive: boolean;
  description?: string;
}

const CreditConfig: React.FC<CreditConfigProps> = ({ onBack }) => {
  const [packages, setPackages] = useState<CreditPackage[]>([
    {
      _id: '1',
      name: 'Starter Pack',
      credits: 7,
      price: 9,
      gstPercentage: 18,
      isActive: true,
      description: 'Perfect for trying out the app'
    },
    {
      _id: '2',
      name: 'Popular Pack',
      credits: 77,
      price: 6,
      gstPercentage: 18,
      isActive: true,
      description: 'Most popular choice'
    },
    {
      _id: '3',
      name: 'Value Pack',
      credits: 777,
      price: 3,
      gstPercentage: 18,
      isActive: true,
      description: 'Great value for regular users'
    },
    {
      _id: '4',
      name: 'Mega Pack',
      credits: 7777,
      price: 1,
      gstPercentage: 18,
      isActive: true,
      description: 'Best value for heavy users'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CreditPackage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<CreditPackage>>({
    name: '',
    credits: 0,
    price: 0,
    gstPercentage: 18,
    isActive: true,
    description: ''
  });

  // Load packages on component mount
  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api/credit-packages', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPackages(data);
      }
    } catch (error) {
      console.error('Error loading credit packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const url = editingPackage 
        ? `https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api/credit-packages/${editingPackage._id}`
        : 'https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api/credit-packages';
      
      const method = editingPackage ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadPackages();
        setShowForm(false);
        setEditingPackage(null);
        setFormData({
          name: '',
          credits: 0,
          price: 0,
          gstPercentage: 18,
          isActive: true,
          description: ''
        });
      }
    } catch (error) {
      console.error('Error saving credit package:', error);
    }
  };

  const handleEdit = (pkg: CreditPackage) => {
    setEditingPackage(pkg);
    setFormData(pkg);
    setShowForm(true);
  };

  const handleDelete = async (packageId: string) => {
    if (!confirm('Are you sure you want to delete this credit package?')) return;
    
    try {
      const response = await fetch(`https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api/credit-packages/${packageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await loadPackages();
      }
    } catch (error) {
      console.error('Error deleting credit package:', error);
    }
  };

  const exportPackages = async () => {
    // Prepare data for Excel export
    const excelData = packages.map(pkg => ({
      'Package Name': pkg.name,
      'Credits': pkg.credits,
      'Base Price (₹)': pkg.price,
      'GST %': pkg.gstPercentage,
      'Total Price (₹)': calculateTotalPrice(pkg.price, pkg.gstPercentage),
      'Active': pkg.isActive ? 'Yes' : 'No',
      'Description': pkg.description || ''
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Package Name
      { wch: 10 }, // Credits
      { wch: 15 }, // Base Price
      { wch: 10 }, // GST %
      { wch: 15 }, // Total Price
      { wch: 8 },  // Active
      { wch: 30 }  // Description
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Credit Packages');
    
    const fileName = `credit_packages_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Try File System Access API first (modern browsers)
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Excel files',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            },
          }],
        });
        
        const writable = await fileHandle.createWritable();
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        await writable.write(new Uint8Array(wbout));
        await writable.close();
        return;
      } catch (err) {
        // User cancelled or error occurred, fall back to download
        console.log('File System Access API failed, falling back to download');
      }
    }
    
    // Fallback: Use XLSX.writeFile for browsers without File System Access API
    XLSX.writeFile(wb, fileName);
  };

  const importPackages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        let importedPackages;

        // Check file extension to determine format
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          // Handle Excel files
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          // Convert Excel data to package format
          importedPackages = jsonData.map((row: any) => ({
            name: row['Package Name'] || '',
            credits: parseInt(row['Credits']) || 0,
            price: parseFloat(row['Base Price (₹)']) || 0,
            gstPercentage: parseFloat(row['GST %']) || 18,
            isActive: row['Active'] === 'Yes' || row['Active'] === true,
            description: row['Description'] || ''
          }));
        } else {
          // Handle JSON files (fallback)
          importedPackages = JSON.parse(data as string);
        }
        
        if (Array.isArray(importedPackages)) {
          const response = await fetch('https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api/credit-packages/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ packages: importedPackages })
          });

          if (response.ok) {
            await loadPackages();
            alert('Credit packages imported successfully!');
          } else {
            alert('Error importing credit packages. Please check the file format.');
          }
        } else {
          alert('Invalid file format. Please ensure the file contains an array of package objects.');
        }
      } catch (error) {
        console.error('Error importing credit packages:', error);
        alert('Error parsing the file. Please check the format.');
      }
    };
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const calculateTotalPrice = (price: number, gstPercentage: number) => {
    const gstAmount = (price * gstPercentage) / 100;
    return price + gstAmount;
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
            onClick={exportPackages}
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
              accept=".xlsx,.xls,.json"
              onChange={importPackages}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {showForm ? (
          /* Form */
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-white">
                {editingPackage ? 'Edit Credit Package' : 'Add New Credit Package'}
              </h4>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingPackage(null);
                  setFormData({
                    name: '',
                    credits: 0,
                    price: 0,
                    gstPercentage: 18,
                    isActive: true,
                    description: ''
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
                  Package Name
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Starter Pack"
                />
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
                  min="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Base Price (₹)
                </label>
                <input
                  type="number"
                  value={formData.price || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Base price in rupees"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  GST Percentage (%)
                </label>
                <input
                  type="number"
                  value={formData.gstPercentage || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, gstPercentage: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="GST percentage"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
            </div>

            {/* Price Summary */}
            {formData.price && formData.gstPercentage && (
              <div className="bg-gray-700 rounded-lg p-4">
                <h5 className="text-sm font-medium text-white mb-2">Price Summary</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Base Price:</span>
                    <span className="text-white">₹{formData.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">GST ({formData.gstPercentage}%):</span>
                    <span className="text-white">₹{((formData.price * formData.gstPercentage) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-600 pt-1">
                    <span className="text-white font-medium">Total Price:</span>
                    <span className="text-white font-medium">₹{calculateTotalPrice(formData.price, formData.gstPercentage).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Package description"
              />
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
                  setEditingPackage(null);
                  setFormData({
                    name: '',
                    credits: 0,
                    price: 0,
                    gstPercentage: 18,
                    isActive: true,
                    description: ''
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
          /* Package List */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Credit Packages</h3>
              <div className="text-sm text-white/60">
                {packages.length} package{packages.length !== 1 ? 's' : ''} available
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-white/60 mt-2">Loading credit packages...</p>
              </div>
            ) : packages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/60">No credit packages found. Add your first package to get started.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {packages.map((pkg) => (
                <div
                  key={pkg._id}
                  className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-white">{pkg.name}</h4>
                        {pkg.isActive ? (
                          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                        <div>
                          <p className="text-white/60 text-sm">Credits</p>
                          <p className="text-white font-medium">{pkg.credits}</p>
                        </div>
                        <div>
                          <p className="text-white/60 text-sm">Base Price</p>
                          <p className="text-white font-medium">₹{pkg.price.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-white/60 text-sm">GST ({pkg.gstPercentage}%)</p>
                          <p className="text-white font-medium">₹{((pkg.price * pkg.gstPercentage) / 100).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-white/60 text-sm">Total Price</p>
                          <p className="text-white font-medium">₹{calculateTotalPrice(pkg.price, pkg.gstPercentage).toFixed(2)}</p>
                        </div>
                      </div>
                      
                      {pkg.description && (
                        <p className="text-white/60 text-sm">{pkg.description}</p>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(pkg)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => pkg._id && handleDelete(pkg._id)}
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

export default CreditConfig;
