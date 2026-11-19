import React, { useState } from 'react';
import Header from './components/Header';
import ExplorerView from './components/ExplorerView';
import UploadView from './components/UploadView';
import WorkflowView from './components/WorkflowView';
import './App.css';

export default function App() {
  const [currentView, setCurrentView] = useState('explorer'); // 'explorer', 'upload', 'workflow'
  const [globalSearch, setGlobalSearch] = useState('');

  return (
    <div className="d-flex flex-column vh-100 overflow-hidden bg-light">
      {/* Top DCCI Navigation Bar */}
      <Header 
        currentView={currentView}
        setCurrentView={setCurrentView}
        globalSearch={globalSearch}
        setGlobalSearch={setGlobalSearch}
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
          <WorkflowView />
        )}
      </main>
    </div>
  );
}
