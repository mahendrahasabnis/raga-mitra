import React, { useState, useEffect } from 'react';
import { FileText, Plus, Scan } from 'lucide-react';
import { useSelectedClient } from '../../contexts/ClientContext';
import { medicalHistoryApi } from '../../services/api';
import PastVisitsList from './PastVisitsList';
import AddPastVisitModal from './AddPastVisitModal';
import ScanReceiptModal from './ScanReceiptModal';

const MedicalHistoryPage: React.FC = () => {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanReceiptModal, setShowScanReceiptModal] = useState(false);
  const selectedClient = useSelectedClient();

  useEffect(() => {
    fetchPastVisits();
  }, [selectedClient]);

  const fetchPastVisits = async () => {
    setLoading(true);
    try {
      const patientId = selectedClient || undefined;
      const response = await medicalHistoryApi.getPastVisits(patientId);
      setVisits(response.visits || response || []);
    } catch (error) {
      console.error('Error fetching past visits:', error);
      setVisits([]);
    } finally {
      setLoading(false);
    }
  };

  const handleModalSuccess = () => {
    fetchPastVisits();
    setShowAddModal(false);
    setShowScanReceiptModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Medical History</h2>
          <p className="text-gray-600 text-sm mt-1">View and manage your past doctor visits</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowScanReceiptModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Scan className="w-4 h-4" />
            Scan Receipt
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Visit
          </button>
        </div>
      </div>

      {/* Past Visits List */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading medical history...</p>
          </div>
        </div>
      ) : (
        <PastVisitsList visits={visits} onRefresh={fetchPastVisits} />
      )}

      {/* Add Visit Modal */}
      {showAddModal && (
        <AddPastVisitModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Scan Receipt Modal */}
      {showScanReceiptModal && (
        <ScanReceiptModal
          isOpen={showScanReceiptModal}
          onClose={() => setShowScanReceiptModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};

export default MedicalHistoryPage;