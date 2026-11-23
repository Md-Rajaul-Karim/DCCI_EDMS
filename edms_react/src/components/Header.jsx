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
  X,
  ChevronDown,
  Check
} from 'lucide-react';
import { SYSTEM_USERS } from '../constants/systemUsers';
import Api from '../api';

export default function Header({ currentView, setCurrentView, globalSearch, setGlobalSearch, currentUser, onSelectUser }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const dropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('dcci_read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fetchNotifications = async () => {
    try {
      if (!currentUser) return;
      const res = await Api.get(`/Workflow/GetNotifications?userRole=${encodeURIComponent(currentUser.role || '')}&userName=${encodeURIComponent(currentUser.name || '')}`);
      if (res?.data?.success && Array.isArray(res.data.data)) {
        const raw = res.data.data;
        const mapped = raw.map(n => ({
          ...n,
          read: readIds.includes(n.id)
        }));
        setNotifications(mapped);
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [currentUser, readIds]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = () => {
    const allIds = notifications.map(n => n.id);
    const updated = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(updated);
    localStorage.setItem('dcci_read_notifications', JSON.stringify(updated));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (item) => {
    if (!readIds.includes(item.id)) {
      const updated = [...readIds, item.id];
      setReadIds(updated);
      localStorage.setItem('dcci_read_notifications', JSON.stringify(updated));
    }
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
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted">
                    <Bell size={28} className="text-secondary opacity-50 mb-2 d-block mx-auto" />
                    <div className="small fw-semibold text-secondary">No New Notifications</div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>Your desk is currently up to date!</div>
                  </div>
                ) : (
                  notifications.map((item) => (
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
                  ))
                )}
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

        {/* User Persona Switcher Dropdown (Simulation Mode) */}
        <div className="position-relative" ref={userDropdownRef}>
          <button 
            type="button"
            className="btn p-1 px-2 d-flex align-items-center gap-2 rounded border-0 text-white"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}
            onClick={() => setShowUserMenu(!showUserMenu)}
            title="Click to switch active user role / desk"
          >
            <div style={{
              background: currentUser?.color || '#0b7337',
              color: '#ffffff',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '2px solid rgba(255, 255, 255, 0.8)'
            }}>
              {currentUser?.avatar || 'ER'}
            </div>
            <div className="text-start d-flex flex-column" style={{ lineHeight: '1.1' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{currentUser?.name || 'Engr. Dilip K Roy'}</span>
              <span className="text-white-50" style={{ fontSize: '0.68rem' }}>{currentUser?.role || 'Head of Department'}</span>
            </div>
            <ChevronDown size={14} className="text-white-50 ms-1" />
          </button>

          {showUserMenu && (
            <div 
              className="position-absolute end-0 mt-2 bg-white rounded shadow-lg border py-2"
              style={{ width: '360px', zIndex: 1050, animation: 'fadeIn 0.15s ease' }}
            >
              <div className="px-3 py-1 border-bottom mb-1">
                <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                  Simulated Active Desk (সরাসরি ইউজার পরিবর্তন)
                </div>
                <div className="text-secondary small" style={{ fontSize: '0.72rem' }}>
                  লগইন পরিবর্তন না করে সরাসরি দায়িত্বশীল কর্মকর্তা সিলেক্ট করুন:
                </div>
              </div>

              {SYSTEM_USERS.map((user) => {
                const isActive = currentUser?.id === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    className={`dropdown-item px-3 py-2 d-flex align-items-center justify-content-between text-start ${isActive ? 'bg-light' : ''}`}
                    onClick={() => {
                      if (onSelectUser) onSelectUser(user);
                      setShowUserMenu(false);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <div style={{
                        background: user.color,
                        color: 'white',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        flexShrink: 0
                      }}>
                        {user.avatar}
                      </div>
                      <div>
                        <div className="fw-bold text-dark small" style={{ fontSize: '0.82rem' }}>
                          {user.label}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                          {user.designation}
                        </div>
                      </div>
                    </div>
                    {isActive && <Check size={16} className="text-success ms-2 flex-shrink-0" />}
                  </button>
                );
              })}

              <div className="px-3 pt-2 mt-1 border-top text-muted" style={{ fontSize: '0.68rem', lineHeight: '1.3' }}>
                <div className="fw-semibold text-dark mb-1">DCCI Approval & Review Flow:</div>
                <span className="text-primary fw-medium">Initiator</span> &rarr;{' '}
                <span className="fw-medium" style={{ color: '#059669' }}>Checker</span> &rarr;{' '}
                <span className="text-success fw-medium">HOD</span> &rarr;{' '}
                <span className="text-warning text-dark fw-medium">Accounts</span> &rarr;{' '}
                <span style={{ color: '#7c3aed' }} className="fw-medium">SG</span> &rarr;{' '}
                <span className="text-danger fw-medium">President</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
