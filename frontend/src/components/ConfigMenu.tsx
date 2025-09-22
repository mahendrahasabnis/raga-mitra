import React, { useState } from 'react';
import { X, Settings, Music, Users, CreditCard, UserCheck, Download, Upload } from 'lucide-react';
import RagaConfig from './config/RagaConfig';
import ArtistConfig from './config/ArtistConfig';
import CreditConfig from './config/CreditConfig';
import UserConfig from './config/UserConfig';
import AudioFileUpload from './AudioFileUpload';

interface ConfigMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

interface ConfigModule {
  id: string;
  name: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
  description: string;
}

const ConfigMenu: React.FC<ConfigMenuProps> = ({ isOpen, onClose, isAdmin }) => {
  const [activeModule, setActiveModule] = useState<string | null>(null);

  const configModules: ConfigModule[] = [
    {
      id: 'audio',
      name: 'Audio Management',
      icon: <Music className="w-5 h-5" />,
      component: AudioFileUpload,
      description: 'Upload and manage audio files with metadata extraction'
    },
    {
      id: 'raga',
      name: 'Raga Management',
      icon: <Settings className="w-5 h-5" />,
      component: RagaConfig,
      description: 'Manage raga configurations, import/export raga data'
    },
    {
      id: 'artist',
      name: 'Artist Management',
      icon: <Users className="w-5 h-5" />,
      component: ArtistConfig,
      description: 'Manage artist profiles and specializations'
    },
    {
      id: 'credit',
      name: 'Credit Bundles',
      icon: <CreditCard className="w-5 h-5" />,
      component: CreditConfig,
      description: 'Configure credit packages and pricing'
    },
    {
      id: 'user',
      name: 'User Management',
      icon: <UserCheck className="w-5 h-5" />,
      component: UserConfig,
      description: 'Manage users, roles, and permissions'
    }
  ];

  const handleModuleSelect = (moduleId: string) => {
    setActiveModule(moduleId);
  };

  const handleBack = () => {
    setActiveModule(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Slide-out Panel */}
      <div className="absolute right-0 top-0 h-full w-96 bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">
              {activeModule ? configModules.find(m => m.id === activeModule)?.name : 'Configuration'}
            </h2>
          </div>
          <button
            onClick={activeModule ? handleBack : onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            {activeModule ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <X className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!activeModule ? (
            /* Module Selection */
            <div className="p-6 space-y-4">
              <p className="text-sm text-white/60 mb-6">
                Select a configuration module to manage system settings and data.
              </p>
              
              {configModules.map((module) => (
                <div
                  key={module.id}
                  onClick={() => handleModuleSelect(module.id)}
                  className="p-4 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors border border-gray-700"
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 p-2 bg-blue-500/20 rounded-lg">
                      {module.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-white mb-1">
                        {module.name}
                      </h3>
                      <p className="text-sm text-white/60">
                        {module.description}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-400 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Active Module Content */
            <div className="h-full">
              {(() => {
                const module = configModules.find(m => m.id === activeModule);
                if (!module) return null;
                
                const Component = module.component;
                return <Component onBack={handleBack} />;
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigMenu;
