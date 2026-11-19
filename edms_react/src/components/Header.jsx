import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderTree, 
  UploadCloud, 
  Archive, 
  GitBranch, 
  Search, 
  Bell, 
  User, 
  Layers,
  CheckCheck,
  Clock,
  FileText,
  AlertCircle,
  ExternalLink,
  X
} from 'lucide-react';

export default function Header({ currentView, setCurrentView, globalSearch, setGlobalSearch }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'workflow',
      title: 'Action Required: Pending Proposal',
      description: 'Pre-Approval Sheet #7566940683 (CCTV Security System) assigned to your desk for HOD review.',
      time: '15m ago',
      read: false,
      targetView: 'workflow'
    },
    {
      id: 2,
      type: 'document',
      title: 'Document Revision Notice',
      description: 'Write-off-Damage Report has been updated to v2.00 in the IT Department folder.',
      time: '1h ago',
      read: false,
      targetView: 'explorer'
    },
    {
      id: 3,
      type: 'expiry',
      title: 'Contract Expiration Warning',
      description: 'SMS Agreement 2025 (Software Shop Limited) is due for renewal review.',
      time: 'Yesterday',
      read: false,
      targetView: 'explorer'
    }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (item) => {
    // Mark as read
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    setShowNotifications(false);
    if (item.targetView) {
      setCurrentView(item.targetView);
    }
  };

  return (
    <header className="dcci-header">
      <div className="d-flex align-items-center gap-3">
        <div className="logo-text" style={{ cursor: 'pointer' }} onClick={() => setCurrentView('explorer')}>
          <div style={{
            background: 'white',
            color: '#0b7337',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1rem'
          }}>
            DC
          </div>
          <span>DCCI DMS</span>
        </div>
        <span className="app-badge">EDMS & Workflow</span>

        {/* View Switcher Tabs */}
        <div className="d-flex ms-3 gap-1">
          <button 
            className={`btn btn-sm ${currentView === 'explorer' ? 'btn-light text-success fw-bold' : 'btn-outline-light border-0 text-white'}`}
            onClick={() => setCurrentView('explorer')}
            title="Document Explorer Tree"
          >
            <FolderTree size={16} className="me-1" /> Explorer
          </button>
          <button 
            className={`btn btn-sm ${currentView === 'upload' ? 'btn-light text-success fw-bold' : 'btn-outline-light border-0 text-white'}`}
            onClick={() => setCurrentView('upload')}
            title="Standard File Upload & Metadata"
          >
            <UploadCloud size={16} className="me-1" /> Upload Document
          </button>
          <button 
            className={`btn btn-sm ${currentView === 'workflow' ? 'btn-light text-success fw-bold' : 'btn-outline-light border-0 text-white'}`}
            onClick={() => setCurrentView('workflow')}
            title="Workflow Cases & E-Forms"
          >
            <GitBranch size={16} className="me-1" /> Workflow Cases
          </button>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3">
        {/* Quick Search */}
        <div className="input-group input-group-sm" style={{ width: '260px' }}>
          <span className="input-group-text bg-white border-0 text-muted">
            <Search size={14} />
          </span>
          <input
            type="text"
            className="form-control border-0 shadow-none ps-0"
            placeholder="Search documents or tags..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
        </div>

        {/* Interactive Notifications Bell */}
        <div className="position-relative" ref={dropdownRef}>
          <button 
            className="nav-launcher-btn position-relative" 
            title="DCCI System Notifications"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div 
              className="position-absolute end-0 mt-2 bg-white rounded shadow-lg border text-dark"
              style={{ width: '360px', zIndex: 1100, maxHeight: '480px', overflowY: 'auto' }}
            >
              <div className="d-flex align-items-center justify-content-between p-3 border-bottom bg-light">
                <div className="d-flex align-items-center gap-2">
                  <Bell size={16} className="text-success" />
                  <span className="fw-bold fs-6">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="badge bg-danger rounded-pill" style={{ fontSize: '0.7rem' }}>
                      {unreadCount} New
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button 
                    className="btn btn-sm btn-link text-decoration-none text-success p-0 small"
                    onClick={handleMarkAllRead}
                  >
                    <CheckCheck size={14} className="me-1" /> Mark all read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="p-0">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 border-bottom d-flex gap-2 align-items-start ${!item.read ? 'bg-light bg-opacity-50' : ''}`}
                    style={{ cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                    onClick={() => handleNotificationClick(item)}
                  >
                    <div className="mt-1">
                      {item.type === 'workflow' && <GitBranch size={16} className="text-primary" />}
                      {item.type === 'document' && <FileText size={16} className="text-success" />}
                      {item.type === 'expiry' && <AlertCircle size={16} className="text-warning" />}
                    </div>

                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <span className={`small fw-bold ${!item.read ? 'text-dark' : 'text-secondary'}`}>
                          {item.title}
                        </span>
                        {!item.read && (
                          <span className="badge bg-success rounded-pill" style={{ width: '8px', height: '8px', padding: 0 }}></span>
                        )}
                      </div>
                      
                      <p className="small text-muted mb-1 lh-sm" style={{ fontSize: '0.78rem' }}>
                        {item.description}
                      </p>

                      <div className="d-flex align-items-center justify-content-between">
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                          <Clock size={11} className="me-1" /> {item.time}
                        </small>
                        <span className="badge bg-light text-primary border" style={{ fontSize: '0.65rem' }}>
                          Click to View &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2 text-center bg-light border-top">
                <button 
                  className="btn btn-sm btn-link text-decoration-none text-secondary small p-0"
                  onClick={() => { setShowNotifications(false); setCurrentView('workflow'); }}
                >
                  View Workflow Task Dashboard &rarr;
                </button>
              </div>

            </div>
          )}
        </div>

        {/* User Chip */}
        <div className="d-flex align-items-center gap-2 bg-white bg-opacity-10 px-2 py-1 rounded">
          <div style={{
            background: 'white',
            color: '#0b7337',
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            ER
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Engr. Dilip K Roy</span>
        </div>
      </div>
    </header>
  );
}
