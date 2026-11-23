import React, { useState } from 'react';
import Header from './components/Header';
import ExplorerView from './components/ExplorerView';
import UploadView from './components/UploadView';
import WorkflowView from './components/WorkflowView';
import { SYSTEM_USERS, DEFAULT_USER } from './constants/systemUsers';
import './App.css';

export default function App() {
  const [currentView, setCurrentView] = useState('explorer'); // 'explorer', 'upload', 'workflow'
  const [globalSearch, setGlobalSearch] = useState('');

  const [currentUser, setCurrentUser] = useState(() => {
    const savedId = localStorage.getItem('dcci_simulated_user');
    if (savedId) {
      const matched = SYSTEM_USERS.find(u => u.id === savedId || u.role === savedId);
      if (matched) return matched;
    }
    return DEFAULT_USER;
  });

  const handleSelectUser = (user) => {
    setCurrentUser(user);
    localStorage.setItem('dcci_simulated_user', user.id);
  };

  return (
    <div className="d-flex flex-column vh-100 overflow-hidden bg-light">
      {/* Top DCCI Navigation Bar */}
      <Header 
        currentView={currentView}
        setCurrentView={setCurrentView}
        globalSearch={globalSearch}
        setGlobalSearch={setGlobalSearch}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
      />

      {/* Main View Area */}
      <main className="flex-grow-1 overflow-hidden">
        {currentView === 'explorer' && (
          <ExplorerView 
            onNavigateUpload={() => setCurrentView('upload')}
            globalSearch={globalSearch}
          />
        )}

        {currentView === 'upload' && (
          <UploadView 
            onUploadSuccess={() => setCurrentView('explorer')}
          />
        )}

        {currentView === 'workflow' && (
          <WorkflowView 
            currentUser={currentUser}
          />
        )}
      </main>
    </div>
  );
}
