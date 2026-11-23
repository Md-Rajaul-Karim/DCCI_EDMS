import React, { useState, useEffect } from 'react';
import Api from '../api';
import Swal from 'sweetalert2';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  Grid, 
  List, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Share2, 
  Lock, 
  Download, 
  Calendar, 
  Building, 
  Trash2, 
  RotateCcw, 
  Archive, 
  AlertTriangle, 
  Inbox,
  ChevronRight,
  ChevronDown,
  FolderPlus
} from 'lucide-react';
import DocumentViewerModal from './DocumentViewerModal';

export default function ExplorerView({ onNavigateUpload, globalSearch }) {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // Default: Table List View
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [selectedDocForModal, setSelectedDocForModal] = useState(null);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [archiveStats, setArchiveStats] = useState({ activeCount: 0, archivedCount: 0 });
  const [expandedFolderIds, setExpandedFolderIds] = useState([1, 4, 26]); // Auto-expand DCCI root, IT department, and 2026 Projects

  // Subfolder creation modal state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [targetParentFolder, setTargetParentFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const openNewFolderModal = (parentFolder) => {
    setTargetParentFolder(parentFolder || folders.find(f => f.Id === 1) || folders[0]);
    setNewFolderName('');
    setShowNewFolderModal(true);
  };

  const getFolderPath = (folder) => {
    if (!folder) return [];
    const path = [];
    let current = folder;
    const visited = new Set();
    while (current && !visited.has(current.Id)) {
      visited.add(current.Id);
      path.unshift(current);
      current = folders.find(f => f.Id === current.ParentId);
    }
    return path;
  };

  const handleCreateSubfolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim() || !targetParentFolder) return;
    try {
      setIsCreatingFolder(true);
      const res = await Api.post('/Folder/CreateSubfolder', {
        name: newFolderName.trim(),
        parentId: targetParentFolder.Id
      });
      if (res.data.status) {
        Swal.fire({
          icon: 'success',
          title: 'Subfolder Created!',
          text: `"${newFolderName.trim()}" created under ${targetParentFolder.Name}.`,
          timer: 1600,
          showConfirmButton: false
        });
        const createdFolder = res.data.data;
        // Expand the parent folder
        setExpandedFolderIds(prev => Array.from(new Set([...prev, targetParentFolder.Id])));
        // Reload folders
        const listRes = await Api.get('/Folder/GetTree');
        if (listRes.data.status) {
          const list = listRes.data.data || [];
          setFolders(list);
          const found = list.find(f => f.Id === createdFolder.Id);
          if (found) setSelectedFolder(found);
        }
        setShowNewFolderModal(false);
        setNewFolderName('');
      } else {
        Swal.fire('Error', res.data.message || 'Failed to create subfolder', 'error');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || err.message, 'error');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleDeleteSubfolder = async (folder) => {
    if (!folder || folder.FolderType !== 'Subfolder') return;
    const confirm = await Swal.fire({
      title: 'Delete Subfolder?',
      text: `Are you sure you want to delete "${folder.Name}"? It must be empty.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, Delete'
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await Api.delete(`/Folder/DeleteFolder?folderId=${folder.Id}`);
      if (res.data.status) {
        Swal.fire('Deleted!', 'Subfolder deleted successfully.', 'success');
        const parent = folders.find(f => f.Id === folder.ParentId);
        loadFolders();
        if (parent) setSelectedFolder(parent);
      } else {
        Swal.fire('Cannot Delete', res.data.message, 'warning');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || err.message, 'error');
    }
  };

  const toggleExpand = (folderId, e) => {
    if (e) e.stopPropagation();
    setExpandedFolderIds(prev => 
      prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
    );
  };

  useEffect(() => {
    loadFolders();
    loadArchiveStats();
  }, []);

  useEffect(() => {
    loadDocuments();
    loadArchiveStats(selectedFolder?.Id);
  }, [selectedFolder, docTypeFilter, globalSearch, showArchivedOnly]);

  const loadArchiveStats = async (folderId = null) => {
    try {
      const targetFolderId = folderId !== null ? folderId : selectedFolder?.Id;
      let url = '/Document/GetArchiveStats';
      if (targetFolderId) {
        url += `?folderId=${targetFolderId}`;
      }
      const res = await Api.get(url);
      if (res.data.status && res.data.data) {
        setArchiveStats(res.data.data);
      }
    } catch (err) {
      console.error('Error loading archive stats:', err);
    }
  };

  const loadFolders = async () => {
    try {
      const res = await Api.get('/Folder/GetTree');
      if (res.data.status) {
        const list = res.data.data || [];
        setFolders(list);
        // Default select IT department
        const it = list.find(f => f.Code === 'IT') || list[0];
        if (it) setSelectedFolder(it);
      }
    } catch (err) {
      console.error('Error loading folders:', err);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      let url = '/Document/GetDocumentList?';
      if (showArchivedOnly) {
        url += 'onlyDeleted=true&';
      }
      if (selectedFolder) url += `folderId=${selectedFolder.Id}&`;
      if (docTypeFilter) url += `docType=${encodeURIComponent(docTypeFilter)}&`;
      if (globalSearch) url += `search=${encodeURIComponent(globalSearch)}&`;

      const res = await Api.get(url);
      if (res.data.status) {
        setDocuments(res.data.data || []);
      } else {
        setDocuments([]);
      }
      loadArchiveStats();
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreDoc = async (docId, docName, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await Api.post('/Document/Restore', docId, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.data.status) {
        Swal.fire({
          icon: 'success',
          title: 'Document Restored!',
          text: `"${docName}" has been restored to active documents.`,
          timer: 1600,
          showConfirmButton: false
        });
        loadDocuments();
        loadArchiveStats();
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  // Root folders (ParentId == null)
  const rootFolders = folders.filter(f => !f.ParentId);

  // Recursive tree node renderer for multi-tier subfolder hierarchy (Loophole 5)
  const renderFolderItem = (folder, level = 0) => {
    const isSelected = selectedFolder?.Id === folder.Id && !showArchivedOnly;
    const children = folders.filter(f => f.ParentId === folder.Id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolderIds.includes(folder.Id);
    const isRoot = !folder.ParentId;

    return (
      <div key={folder.Id} className="mb-1" style={{ marginLeft: level > 0 ? `${Math.min(level, 4) * 8}px` : 0 }}>
        <div
          className={`tree-node d-flex align-items-center justify-content-between p-1 rounded ${isSelected ? 'active bg-success text-white fw-bold' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => {
            setSelectedFolder(folder);
            setShowArchivedOnly(false);
          }}
        >
          <div className="d-flex align-items-center text-truncate flex-grow-1" style={{ minWidth: 0 }}>
            {hasChildren ? (
              <span 
                className={`me-1 cursor-pointer ${isSelected ? 'text-white' : 'text-muted'}`}
                onClick={(e) => toggleExpand(folder.Id, e)}
                style={{ width: '16px', display: 'inline-flex', alignItems: 'center' }}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : (
              <span style={{ width: '16px', display: 'inline-block' }}></span>
            )}

            {isRoot ? (
              <Building size={16} className={`me-2 ${isSelected ? 'text-white' : 'text-success'} flex-shrink-0`} />
            ) : isSelected || isExpanded ? (
              <FolderOpen size={15} className={`me-2 ${isSelected ? 'text-white' : 'text-warning'} flex-shrink-0`} />
            ) : (
              <Folder size={15} className={`me-2 ${isSelected ? 'text-white' : 'text-muted'} flex-shrink-0`} />
            )}

            <span className="text-truncate" style={{ fontSize: level === 0 ? '0.88rem' : level === 1 ? '0.82rem' : '0.78rem' }}>
              {folder.Name}
            </span>
          </div>

          <div className="d-flex align-items-center gap-1 ms-1">
            {hasChildren && (
              <span className={`badge ${isSelected ? 'bg-white text-success' : 'bg-light text-muted border'}`} style={{ fontSize: '0.62rem' }}>
                {children.length}
              </span>
            )}
            <button
              type="button"
              className={`btn btn-xs p-0 border-0 ${isSelected ? 'text-white' : 'text-muted'}`}
              style={{ opacity: 0.65, background: 'none' }}
              title={`Create subfolder inside ${folder.Name}`}
              onClick={(e) => {
                e.stopPropagation();
                openNewFolderModal(folder);
              }}
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Recursive subfolders rendering */}
        {hasChildren && isExpanded && (
          <div className="border-start ms-2 ps-1 mt-1">
            {children.map(child => renderFolderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="d-flex h-100">
      {/* Left Explorer Tree Sidebar (Dilip's demo layout) */}
      <div className="tree-sidebar d-flex flex-column justify-content-between" style={{ width: '280px', flexShrink: 0 }}>
        <div>
          <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
            <span className="fw-bold text-success fs-6">Document Explorer</span>
            <span className="badge bg-light text-dark">{folders.length} Folders</span>
          </div>

          <div>
            {rootFolders.map((root) => renderFolderItem(root, 0))}
          </div>
        </div>

        {/* Dedicated Archive / Recycle Bin Section in Left Sidebar */}
        <div className="pt-3 border-top mt-3">
          <div 
            className={`tree-node d-flex align-items-center justify-content-between p-2 rounded cursor-pointer ${showArchivedOnly && !selectedFolder ? 'active bg-danger text-white' : 'text-danger bg-danger bg-opacity-10 border border-danger border-opacity-25'}`}
            style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
            onClick={() => {
              setSelectedFolder(null);
              setShowArchivedOnly(true);
            }}
            title="View all soft-deleted / archived documents"
          >
            <div className="d-flex align-items-center gap-2">
              <Trash2 size={16} className={showArchivedOnly && !selectedFolder ? 'text-white' : 'text-danger'} />
              <span className="fw-bold">Archive / Recycle Bin</span>
            </div>
            <span className={`badge rounded-pill ${showArchivedOnly && !selectedFolder ? 'bg-white text-danger' : 'bg-danger text-white'}`}>
              {archiveStats.globalArchivedCount !== undefined ? archiveStats.globalArchivedCount : archiveStats.archivedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Right Main Documents Area */}
      <div className="flex-grow-1 p-3 overflow-y-auto" style={{ height: 'calc(100vh - 60px)' }}>
        
        {/* Top Action & Filter Toolbar */}
        <div className="d-flex align-items-center justify-content-between mb-3 bg-white p-3 rounded shadow-sm border">
          <div>
            <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
              {showArchivedOnly ? (
                <>
                  <Trash2 size={20} className="text-danger" />
                  <span>
                    {selectedFolder ? `${selectedFolder.Name} — Archive / Recycle Bin` : 'All Archived Documents (Recycle Bin)'}
                  </span>
                </>
              ) : (
                <>
                  <FolderOpen size={20} className="text-success" />
                  <span>{selectedFolder ? selectedFolder.Name : 'All Active Documents'}</span>
                </>
              )}
            </h5>
            <small className="text-muted">
              {documents.length} document{documents.length !== 1 ? 's' : ''} {showArchivedOnly ? 'in Archive/Trash' : 'found'}
            </small>
          </div>

          <div className="d-flex align-items-center gap-2">
            
            {/* Quick Toggle: Active vs Archive/Trash */}
            <div className="btn-group btn-group-sm">
              <button 
                className={`btn ${!showArchivedOnly ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                onClick={() => setShowArchivedOnly(false)}
                title="View active active documents"
              >
                Active Files
              </button>
              <button 
                className={`btn ${showArchivedOnly ? 'btn-danger text-white' : 'btn-outline-danger'} d-flex align-items-center gap-1`}
                onClick={() => setShowArchivedOnly(true)}
                title="View soft-deleted/archived documents"
              >
                <Trash2 size={13} />
                <span>Archive / Trash</span>
                <span className="badge bg-light text-dark ms-1">{archiveStats.archivedCount}</span>
              </button>
            </div>

            {/* Document Type Dropdown */}
            <select
              className="form-select form-select-sm"
              style={{ width: '170px' }}
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
            >
              <option value="">All Document Types</option>
              <option value="WORK ORDER">WORK ORDER</option>
              <option value="Agreement">Agreement</option>
              <option value="IT_OFFICE FILE">IT_OFFICE FILE</option>
              <option value="General">General</option>
            </select>

            {/* View Switcher: Grid vs Table */}
            <div className="btn-group btn-group-sm">
              <button 
                className={`btn ${viewMode === 'grid' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('grid')}
                title="Grid View (Dilip Style)"
              >
                <Grid size={15} />
              </button>
              <button 
                className={`btn ${viewMode === 'table' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('table')}
                title="Table List View"
              >
                <List size={15} />
              </button>
            </div>

            {/* Create Subfolder Action Button (Loophole 5) */}
            {!showArchivedOnly && selectedFolder && (
              <button 
                className="btn btn-sm btn-outline-success d-flex align-items-center gap-1 fw-semibold"
                onClick={() => openNewFolderModal(selectedFolder)}
                title={`Create a new subfolder inside ${selectedFolder.Name}`}
              >
                <FolderPlus size={15} />
                <span>+ New Folder</span>
              </button>
            )}

            {/* Upload Button */}
            {!showArchivedOnly && (
              <button className="btn btn-sm btn-success d-flex align-items-center gap-1 fw-semibold" onClick={onNavigateUpload}>
                <Plus size={16} /> Upload New
              </button>
            )}
          </div>
        </div>

        {/* Interactive Breadcrumb Bar (Loophole 5) */}
        {!showArchivedOnly && (
          <div className="bg-light px-3 py-2 rounded mb-3 border d-flex align-items-center justify-content-between shadow-sm">
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb mb-0 small align-items-center">
                <li className="breadcrumb-item">
                  <span 
                    className="text-decoration-none text-muted"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setSelectedFolder(null); setShowArchivedOnly(false); }}
                  >
                    <Building size={14} className="me-1 text-success" />
                    <span>DCCI</span>
                  </span>
                </li>
                {getFolderPath(selectedFolder).map((item, idx, arr) => {
                  const isLast = idx === arr.length - 1;
                  return (
                    <li key={item.Id} className={`breadcrumb-item ${isLast ? 'active fw-bold text-success' : ''}`}>
                      {isLast ? (
                        <span>{item.Name}</span>
                      ) : (
                        <span 
                          className="text-primary text-decoration-underline" 
                          style={{ cursor: 'pointer' }}
                          onClick={() => { setSelectedFolder(item); setShowArchivedOnly(false); }}
                        >
                          {item.Name}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>

            {/* If current folder is a custom subfolder, provide Delete empty folder action */}
            {selectedFolder && selectedFolder.FolderType === 'Subfolder' && (
              <button
                type="button"
                className="btn btn-xs btn-outline-danger py-0 px-2 d-flex align-items-center gap-1"
                style={{ fontSize: '0.72rem' }}
                onClick={() => handleDeleteSubfolder(selectedFolder)}
                title="Delete this subfolder (only permitted if empty)"
              >
                <Trash2 size={12} />
                <span>Delete Subfolder</span>
              </button>
            )}
          </div>
        )}

        {/* Informational banner when viewing Archived items */}
        {showArchivedOnly && (
          <div className="alert alert-warning py-2 px-3 mb-3 d-flex align-items-center justify-content-between shadow-sm">
            <div className="d-flex align-items-center gap-2">
              <AlertTriangle size={18} className="text-warning flex-shrink-0" />
              <div className="small">
                <strong>Archive / Recycle Bin View:</strong> You are viewing documents moved to archive or soft-deleted. Click <strong>Restore</strong> on any file to return it to the active folder.
              </div>
            </div>
            {selectedFolder && (
              <button 
                className="btn btn-xs btn-outline-dark small py-1 px-2"
                style={{ fontSize: '0.75rem' }}
                onClick={() => setSelectedFolder(null)}
              >
                Show All Deleted Across All Folders
              </button>
            )}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 text-muted">Loading documents...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && documents.length === 0 && (
          <div className="text-center py-5 bg-white rounded border p-4">
            {showArchivedOnly ? (
              <>
                <Trash2 size={48} className="text-muted mb-2 opacity-50" />
                <h6 className="fw-semibold text-secondary">Archive / Recycle Bin is empty</h6>
                <p className="small text-muted mb-3">No archived or deleted files found in this view.</p>
                <button className="btn btn-sm btn-outline-success" onClick={() => setShowArchivedOnly(false)}>
                  Back to Active Files
                </button>
              </>
            ) : (
              <>
                <FileText size={48} className="text-muted mb-2 opacity-50" />
                <h6 className="fw-semibold text-secondary">No documents in this folder</h6>
                <p className="small text-muted mb-3">You can upload a new document or select another folder.</p>
                <button className="btn btn-sm btn-outline-success" onClick={onNavigateUpload}>
                  <Plus size={14} className="me-1" /> Upload to {selectedFolder?.Name || 'this folder'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Documents Render: Grid View (matches Dilip's demo exactly!) */}
        {!loading && documents.length > 0 && viewMode === 'grid' && (
          <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
            {documents.map((doc) => {
              const tags = doc.Tags ? doc.Tags.split(',').filter(Boolean) : [];
              const isLocked = doc.IsCheckedOut === 1 || doc.IsCheckedOut === true;
              const isDeleted = doc.IsDeleted === 1;

              return (
                <div key={doc.Id} className="col">
                  <div 
                    className="doc-grid-card shadow-sm position-relative" 
                    style={isDeleted ? { border: '1px dashed #f59e0b', background: '#fffdf7' } : {}}
                    onClick={() => setSelectedDocForModal(doc)}
                  >
                    
                    {/* Top indicators */}
                    <div className="d-flex justify-content-between align-items-center w-100 mb-2">
                      <span className="badge bg-light text-secondary border" style={{ fontSize: '0.7rem' }}>
                        v{doc.Version || '1.00'}
                      </span>
                      <div className="d-flex align-items-center gap-1">
                        {isDeleted ? (
                          <span className="badge bg-warning text-dark d-flex align-items-center gap-1" style={{ fontSize: '0.65rem' }}>
                            <Archive size={10} /> Archived
                          </span>
                        ) : (
                          <>
                            {doc.IsLockedByWorkflow === 1 && (
                              <span className="badge bg-warning text-dark border border-warning d-flex align-items-center gap-1" style={{ fontSize: '0.65rem' }} title={`Attached to active Workflow Case #${doc.LockedByCaseAppId}`}>
                                <Lock size={10} /> Case #{doc.LockedByCaseAppId}
                              </span>
                            )}
                            {isLocked && <Lock size={13} className="text-warning" title="Checked Out" />}
                            <Share2 size={13} className="text-muted" title={doc.ShareScope} />
                          </>
                        )}
                      </div>
                    </div>

                    {/* Big File Icon */}
                    <div className="doc-icon-wrap">
                      <div style={{
                        width: '54px',
                        height: '64px',
                        borderRadius: '6px',
                        background: isDeleted ? '#fef3c7' : '#ecfdf5',
                        border: isDeleted ? '2px solid #d97706' : '2px solid #059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDeleted ? '#d97706' : '#059669'
                      }}>
                        <FileText size={32} />
                      </div>
                    </div>

                    {/* Document Title */}
                    <div className="mb-2">
                      <h6 className="fw-bold text-dark text-truncate mb-1" title={doc.Name}>
                        {doc.Name}
                      </h6>
                      <small className="text-muted d-block text-truncate">
                        {doc.SupplierName || doc.OriginalFileName}
                      </small>
                    </div>

                    {/* Type & Tags */}
                    <div className="mt-auto pt-2 border-top">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25" style={{ fontSize: '0.65rem' }}>
                          {doc.DocumentType || 'WORK ORDER'}
                        </span>
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                          {(doc.FileSizeBytes / 1024).toFixed(0)} KB
                        </small>
                      </div>

                      {/* Folder Name Badge */}
                      <div className="mb-1 text-truncate">
                        <span className="badge bg-light text-success border text-truncate" style={{ fontSize: '0.65rem', maxWidth: '100%' }}>
                          📁 {doc.FolderName || 'General'}
                        </span>
                      </div>

                      {/* File No and Note No */}
                      {(doc.FileNo || doc.NoteNo) && (
                        <div className="small text-muted mb-1 text-truncate" style={{ fontSize: '0.72rem' }}>
                          {doc.FileNo && <span className="me-2" title={`File No: ${doc.FileNo}`}>📁 <strong className="text-secondary">{doc.FileNo}</strong></span>}
                          {doc.NoteNo && <span title={`Note No: ${doc.NoteNo}`}>📝 <strong className="text-secondary">{doc.NoteNo}</strong></span>}
                        </div>
                      )}

                      <div className="text-truncate mb-2">
                        {tags.map((t, idx) => (
                          <span key={idx} className="tag-badge">{t.trim()}</span>
                        ))}
                      </div>

                      {/* Quick Restore Button on Card if Archived */}
                      {isDeleted && (
                        <button 
                          className="btn btn-sm btn-outline-success d-flex align-items-center justify-content-center gap-1 w-100 py-1"
                          onClick={(e) => handleRestoreDoc(doc.Id, doc.Name, e)}
                          title="Restore this document back to active list"
                        >
                          <RotateCcw size={13} />
                          <span className="small fw-semibold">Restore to Folder</span>
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Documents Render: Table View */}
        {!loading && documents.length > 0 && viewMode === 'table' && (
          <div className="table-responsive bg-white rounded border shadow-sm">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small text-uppercase text-secondary">
                <tr>
                  <th>Document Name</th>
                  <th>File No</th>
                  <th>Note No</th>
                  <th>Type</th>
                  <th>Supplier / Party</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const isDeleted = doc.IsDeleted === 1;
                  return (
                    <tr key={doc.Id} style={{ cursor: 'pointer' }} onClick={() => setSelectedDocForModal(doc)}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <FileText size={18} className={isDeleted ? "text-warning flex-shrink-0" : "text-success flex-shrink-0"} />
                          <div>
                            <span className="fw-semibold text-dark d-block">{doc.Name}</span>
                            <small className="text-muted">{doc.OriginalFileName}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {doc.FileNo ? (
                          <span className="badge bg-light text-dark border font-monospace" style={{ fontSize: '0.78rem' }}>
                            {doc.FileNo}
                          </span>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td>
                        {doc.NoteNo ? (
                          <span className="badge bg-light text-dark border font-monospace" style={{ fontSize: '0.78rem' }}>
                            {doc.NoteNo}
                          </span>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">
                          {doc.DocumentType}
                        </span>
                      </td>
                      <td>{doc.SupplierName || '—'}</td>
                      <td><span className="badge bg-light text-dark border">v{doc.Version}</span></td>
                      <td>
                        {isDeleted ? (
                          <span className="badge bg-warning text-dark"><Archive size={10} className="me-1" /> Archived</span>
                        ) : doc.IsLockedByWorkflow === 1 ? (
                          <span className="badge bg-warning text-dark border border-warning" title={`Attached to active Workflow Case #${doc.LockedByCaseAppId}`}>
                            <Lock size={10} className="me-1" /> In Approval (#{doc.LockedByCaseAppId})
                          </span>
                        ) : doc.IsCheckedOut ? (
                          <span className="badge bg-warning text-dark"><Lock size={10} /> Locked</span>
                        ) : (
                          <span className="badge bg-success bg-opacity-10 text-success">Available</span>
                        )}
                      </td>
                      <td><small className="text-muted">{doc.CreatedAt}</small></td>
                      <td className="text-end" onClick={(e) => e.stopPropagation()}>
                        {isDeleted ? (
                          <button 
                            className="btn btn-sm btn-outline-success d-flex align-items-center gap-1 ms-auto"
                            onClick={(e) => handleRestoreDoc(doc.Id, doc.Name, e)}
                            title="Restore Document"
                          >
                            <RotateCcw size={14} /> Restore
                          </button>
                        ) : (
                          <button 
                            className="btn btn-sm btn-outline-success me-1"
                            onClick={() => setSelectedDocForModal(doc)}
                            title="View Document"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Modal Preview Inspector */}
      {selectedDocForModal && (
        <DocumentViewerModal 
          doc={selectedDocForModal}
          onClose={() => setSelectedDocForModal(null)}
          onRefresh={loadDocuments}
        />
      )}

      {/* Create New Subfolder Modal (Loophole 5) */}
      {showNewFolderModal && targetParentFolder && (
        <div 
          className="modal show d-block" 
          tabIndex="-1" 
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-success text-white py-2 px-3">
                <div className="d-flex align-items-center gap-2">
                  <FolderPlus size={18} />
                  <h6 className="modal-title mb-0 fw-bold">Create New Subfolder</h6>
                </div>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setShowNewFolderModal(false)}
                ></button>
              </div>

              <form onSubmit={handleCreateSubfolder}>
                <div className="modal-body p-3">
                  <div className="mb-3 p-2 bg-light rounded border">
                    <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Parent Location / মূল অবস্থান:</small>
                    <div className="fw-semibold text-dark small d-flex align-items-center gap-1 mt-1">
                      <FolderOpen size={15} className="text-warning flex-shrink-0" />
                      <span>{targetParentFolder.Name}</span>
                      <span className="badge bg-secondary ms-1" style={{ fontSize: '0.65rem' }}>
                        {targetParentFolder.FolderType}
                      </span>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-bold">
                      Subfolder Name / সাব-ফোল্ডারের নাম <span className="text-danger">*</span>:
                    </label>
                    <input 
                      type="text" 
                      className="form-control form-control-sm"
                      placeholder="e.g. 2026 Fiscal Year, CCTV Projects, Hardware Maintenance"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      required
                      autoFocus
                    />
                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.72rem' }}>
                      Enter a meaningful title for grouping related files and proposals.
                    </small>
                  </div>
                </div>

                <div className="modal-footer py-2 px-3 bg-light">
                  <button 
                    type="button" 
                    className="btn btn-sm btn-secondary" 
                    onClick={() => setShowNewFolderModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-sm btn-success px-3 fw-bold d-flex align-items-center gap-1 shadow-sm"
                    disabled={isCreatingFolder || !newFolderName.trim()}
                  >
                    <FolderPlus size={14} />
                    <span>{isCreatingFolder ? 'Creating...' : 'Create Subfolder'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
