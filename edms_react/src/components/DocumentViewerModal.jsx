import React, { useState, useEffect } from 'react';
import Api, { API_BASE_URL } from '../api';
import * as XLSX from 'xlsx';
import { 
  X, 
  Download, 
  Trash2, 
  Lock, 
  Unlock, 
  FileText, 
  Upload, 
  History, 
  Eye,
  FileSpreadsheet,
  RotateCcw,
  CheckCircle,
  Clock,
  Archive,
  AlertTriangle,
  Share2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Activity,
  Layers
} from 'lucide-react';
import Swal from 'sweetalert2';
import { SYSTEM_USERS, DEFAULT_USER } from '../constants/systemUsers';

export default function DocumentViewerModal({ doc, onClose, onRefresh, zIndex = 1050, readOnly = false }) {
  const [activeTab, setActiveTab] = useState('metadata'); // 'metadata', 'versions', or 'audit'
  const [versions, setVersions] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeVersion, setActiveVersion] = useState(null); // null = current version
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [isCheckedOut, setIsCheckedOut] = useState(doc?.IsCheckedOut === 1 || doc?.IsCheckedOut === true);
  const [isShareActive, setIsShareActive] = useState(doc?.IsShareableLinkActive === 1 || doc?.IsShareableLinkActive === true);
  const [shareToken, setShareToken] = useState(doc?.ShareableToken || '');
  const [serverLanIp, setServerLanIp] = useState('192.168.10.127');

  useEffect(() => {
    Api.get('/Document/GetServerNetworkInfo').then(res => {
      if (res.data?.status && res.data.data?.lanIp) {
        setServerLanIp(res.data.data.lanIp);
      }
    }).catch(() => {});
  }, []);

  // Spreadsheet preview state for Excel files
  const [excelSheets, setExcelSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [excelTableRows, setExcelTableRows] = useState([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState(null);

  const loadActivityLogs = async (docId) => {
    try {
      setLogsLoading(true);
      const res = await Api.get(`/Document/GetActivityLogs?documentId=${docId}`);
      if (res.data?.status) {
        setActivityLogs(res.data.data || []);
      }
    } catch (err) {
      console.error('Error loading activity logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (doc?.Id) {
      loadVersions(doc.Id);
      loadActivityLogs(doc.Id);
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doc, onClose]);

  // Get current active user persona
  const getSimulatedUser = () => {
    try {
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('dcci_simulated_user') : null;
      if (savedId) {
        const matched = SYSTEM_USERS.find(u => u.id === savedId || u.role === savedId);
        if (matched) return matched;
      }
    } catch {}
    return DEFAULT_USER;
  };
  const activeUser = getSimulatedUser();

  // Determine active file details (whether viewing current or a previous version)
  const currentFileName = activeVersion ? (activeVersion.FilePath || '') : (doc.OriginalFileName || doc.Name || '');
  const fileExt = currentFileName.split('.').pop().toLowerCase();
  const isExcel = fileExt === 'xlsx' || fileExt === 'xls';
  const isPdf = fileExt === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(fileExt);

  const previewStreamUrl = activeVersion 
    ? `${API_BASE_URL}/Document/StreamVersion?versionId=${activeVersion.Id}&user=${encodeURIComponent(activeUser.name)}&role=${encodeURIComponent(activeUser.role || activeUser.designation)}`
    : `${API_BASE_URL}/Document/StreamPdf?id=${doc.Id}&user=${encodeURIComponent(activeUser.name)}&role=${encodeURIComponent(activeUser.role || activeUser.designation)}`;

  // If the active file is Excel, parse and render it as an in-browser spreadsheet table!
  useEffect(() => {
    if (isExcel) {
      loadExcelData(previewStreamUrl);
    }
  }, [activeVersion, doc, isExcel]);

  const loadExcelData = async (url) => {
    try {
      setExcelLoading(true);
      setExcelError(null);
      const res = await Api.get(url, { responseType: 'arraybuffer' });
      const workbook = XLSX.read(res.data, { type: 'array' });
      
      const sheetNames = workbook.SheetNames || [];
      setExcelSheets(sheetNames);
      
      if (sheetNames.length > 0) {
        const firstSheet = sheetNames[0];
        setSelectedSheet(firstSheet);
        renderSheet(workbook, firstSheet);
      }
    } catch (err) {
      console.error('Error parsing Excel:', err);
      setExcelError('Could not render Excel preview. You can still download the file directly.');
    } finally {
      setExcelLoading(false);
    }
  };

  const renderSheet = (workbook, sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    // Convert to 2D array of rows
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    setExcelTableRows(jsonData.slice(0, 100)); // Render first 100 rows for high performance
  };

  const handleSheetChange = async (sheetName) => {
    setSelectedSheet(sheetName);
    try {
      const res = await Api.get(previewStreamUrl, { responseType: 'arraybuffer' });
      const workbook = XLSX.read(res.data, { type: 'array' });
      renderSheet(workbook, sheetName);
    } catch (err) {
      console.error(err);
    }
  };

  const loadVersions = async (id) => {
    try {
      const res = await Api.get(`/Document/GetVersions?documentId=${id}`);
      if (res.data.status) {
        setVersions(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching versions:', err);
    }
  };

  const handleCheckOutToggle = async () => {
    try {
      const endpoint = isCheckedOut ? '/Document/CheckIn' : '/Document/CheckOut';
      const res = await Api.post(endpoint, doc.Id);
      if (res.data.status) {
        setIsCheckedOut(!isCheckedOut);
        Swal.fire({
          icon: 'success',
          title: isCheckedOut ? 'Checked In' : 'Checked Out',
          text: isCheckedOut ? 'Document released for editing.' : 'Document locked for your editing.',
          timer: 1500,
          showConfirmButton: false
        });
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const handleUploadVersion = async (e) => {
    e.preventDefault();
    if (!newVersionFile) {
      Swal.fire('Error', 'Please select a file to upload as new version.', 'warning');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', newVersionFile);
      formData.append('documentId', doc.Id);
      formData.append('changeSummary', changeSummary);

      const res = await Api.post('/Document/UploadNewVersion', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.status) {
        Swal.fire({
          icon: 'success',
          title: 'Version Updated',
          text: `New version ${res.data.data.version} created!`,
          timer: 1500,
          showConfirmButton: false
        });
        setIsUploadingVersion(false);
        setNewVersionFile(null);
        setChangeSummary('');
        setActiveVersion(null); // Return to latest
        loadVersions(doc.Id);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const handleDownloadFile = async (v = null) => {
    try {
      const targetVersion = v || activeVersion;
      const downloadEndpoint = targetVersion 
        ? `/Document/DownloadVersion?versionId=${targetVersion.Id}&user=${encodeURIComponent(activeUser.name)}&role=${encodeURIComponent(activeUser.role || activeUser.designation)}`
        : `/Document/Download?id=${doc.Id}&user=${encodeURIComponent(activeUser.name)}&role=${encodeURIComponent(activeUser.role || activeUser.designation)}`;
      
      const targetName = targetVersion ? (targetVersion.FilePath ? targetVersion.FilePath.split('/').pop() : `document_v${targetVersion.VersionNumber}`) : currentFileName;

      const res = await Api.get(downloadEndpoint, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = targetName || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      // Auto refresh audit log immediately
      setTimeout(() => {
        if (doc?.Id) loadActivityLogs(doc.Id);
      }, 500);
    } catch (err) {
      console.error('Download error:', err);
      const directUrl = (v || activeVersion)
        ? `${API_BASE_URL}/Document/DownloadVersion?versionId=${(v || activeVersion).Id}&user=${encodeURIComponent(activeUser.name)}&role=${encodeURIComponent(activeUser.role || activeUser.designation)}`
        : `${API_BASE_URL}/Document/Download?id=${doc.Id}&user=${encodeURIComponent(activeUser.name)}&role=${encodeURIComponent(activeUser.role || activeUser.designation)}`;
      window.open(directUrl, '_blank');
      setTimeout(() => {
        if (doc?.Id) loadActivityLogs(doc.Id);
      }, 500);
    }
  };

  const handleDelete = async () => {
    if (doc?.IsLockedByWorkflow === 1 || doc?.IsLockedByWorkflow === true) {
      Swal.fire({
        icon: 'warning',
        title: 'Deletion Locked (Workflow Protected)',
        text: `This document is attached to an active Workflow Case (App ID: #${doc.LockedByCaseAppId || ''}). To preserve audit compliance and prevent broken approval sheets, it cannot be deleted while under review.`
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Move to Archive/Trash?',
      text: 'You can restore this document anytime.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, Archive it'
    });

    if (confirm.isConfirmed) {
      try {
        const res = await Api.post('/Document/Delete', doc.Id);
        if (res.data.status) {
          Swal.fire('Archived', 'Document moved to archive.', 'success');
          onClose();
          if (onRefresh) onRefresh();
        } else {
          Swal.fire('Cannot Delete', res.data.message || 'Deletion failed', 'error');
        }
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || err.message, 'error');
      }
    }
  };

  const handleRestore = async () => {
    try {
      const res = await Api.post('/Document/Restore', doc.Id, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.data.status) {
        Swal.fire({
          icon: 'success',
          title: 'Restored!',
          text: `"${doc.Name}" has been restored to active documents.`,
          timer: 1600,
          showConfirmButton: false
        });
        onClose();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const handleToggleShare = async () => {
    try {
      const res = await Api.post('/Document/ToggleShareableLink', doc.Id, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.data.status) {
        const active = res.data.data.isShareableLinkActive === 1 || res.data.data.isShareableLinkActive === true;
        setIsShareActive(active);
        setShareToken(res.data.data.shareableToken || '');
        Swal.fire({
          icon: 'success',
          title: active ? 'External Link Active' : 'External Link Deactivated',
          text: active 
            ? 'A secure token link has been created. Anyone with this link can view this document without ERP login.' 
            : 'External access to this document has been revoked.',
          timer: 2000,
          showConfirmButton: false
        });
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  if (!doc) return null;

  const tagsList = doc.Tags ? doc.Tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const currentDisplayVersion = activeVersion ? activeVersion.VersionNumber : (doc.Version || '1.00');

  return (
    <div 
      className="modal show d-block" 
      tabIndex="-1" 
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: zIndex }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: '96vw', height: '92vh' }}>
        <div className="modal-content h-100 d-flex flex-column border-0 shadow-lg">
          
          {/* Header Bar */}
          <div className="modal-header py-2 px-3 bg-dark text-white d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              {isExcel ? (
                <FileSpreadsheet size={22} className="text-success" />
              ) : (
                <FileText size={22} className="text-warning" />
              )}
              <span className="fw-bold fs-6">{doc.Name || doc.OriginalFileName}</span>
              <span className="badge bg-success ms-2">v{currentDisplayVersion}</span>
              
              {activeVersion && (
                <span className="badge bg-warning text-dark d-flex align-items-center gap-1">
                  <Clock size={12} /> Viewing History: v{activeVersion.VersionNumber}
                </span>
              )}

              {isCheckedOut && (
                <span className="badge bg-danger text-white d-flex align-items-center gap-1">
                  <Lock size={12} /> Locked by {doc.CheckedOutBy || 'DILIP'}
                </span>
              )}
            </div>

            <div className="d-flex align-items-center gap-2">
              {activeVersion && (
                <button 
                  className="btn btn-sm btn-outline-warning text-white"
                  onClick={() => setActiveVersion(null)}
                  title="Return to latest version"
                >
                  <RotateCcw size={13} className="me-1" /> Latest (v{doc.Version})
                </button>
              )}

              {readOnly ? (
                <span className="badge bg-warning text-dark d-flex align-items-center gap-1 py-1 px-2 border border-warning" style={{ fontSize: '0.75rem' }}>
                  <Lock size={12} /> Workflow Review (Locked)
                </span>
              ) : (
                <>
                  <button 
                    className={`btn btn-sm ${isCheckedOut ? 'btn-outline-warning' : 'btn-outline-light'}`}
                    onClick={handleCheckOutToggle}
                    title={isCheckedOut ? 'Check In Document' : 'Check Out Document'}
                  >
                    {isCheckedOut ? <Unlock size={14} className="me-1" /> : <Lock size={14} className="me-1" />}
                    {isCheckedOut ? 'Check In' : 'Check Out'}
                  </button>

                  {doc.IsDeleted === 1 ? (
                    <button 
                      className="btn btn-sm btn-success d-flex align-items-center gap-1 fw-semibold" 
                      onClick={handleRestore} 
                      title="Restore this document back to active folder"
                    >
                      <RotateCcw size={15} />
                      <span>Restore</span>
                    </button>
                  ) : doc.IsLockedByWorkflow === 1 ? (
                    <button 
                      className="btn btn-sm btn-outline-warning" 
                      onClick={() => Swal.fire({
                        icon: 'warning',
                        title: 'Workflow Protected',
                        text: `This document is attached to active Workflow Case #${doc.LockedByCaseAppId}. It cannot be moved to trash while the approval is in progress.`
                      })} 
                      title={`Deletion Locked: Attached to active Workflow Case #${doc.LockedByCaseAppId}`}
                    >
                      <Lock size={15} className="text-warning" />
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-outline-danger" onClick={handleDelete} title="Move to Archive / Trash">
                      <Trash2 size={15} />
                    </button>
                  )}
                </>
              )}
              
              <button 
                className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
                onClick={() => handleDownloadFile()}
                title={`Download ${currentFileName} to your computer`}
              >
                <Download size={15} />
                <span className="small d-none d-md-inline">Download</span>
              </button>
              
              <button 
                className="btn btn-sm btn-danger d-flex align-items-center gap-1 fw-bold ms-1" 
                onClick={onClose}
                title="Back to Explorer (Esc)"
              >
                <X size={16} /> Close
              </button>
            </div>
          </div>

          {/* Modal Body: Left Viewer, Right Meta/Versions */}
          <div className="modal-body p-0 d-flex h-100 overflow-hidden">
            
            {/* Left Pane: In-Browser Document Preview */}
            <div className="flex-grow-1 bg-white d-flex flex-column border-end position-relative" style={{ minWidth: '65%' }}>
              
              {/* Archived Document Warning Banner */}
              {doc.IsDeleted === 1 && (
                <div className="bg-warning bg-opacity-25 border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2 text-dark small">
                    <AlertTriangle size={16} className="text-warning flex-shrink-0" />
                    <span>This document is currently in <strong>Archive / Trash</strong>. It is hidden from regular active views.</span>
                  </div>
                  <button className="btn btn-sm btn-success d-flex align-items-center gap-1 py-1 px-3 fw-semibold" onClick={handleRestore}>
                    <RotateCcw size={14} /> Restore Document
                  </button>
                </div>
              )}

              {/* History Notice Banner */}
              {activeVersion && (
                <div className="bg-warning bg-opacity-25 border-bottom px-3 py-1 d-flex align-items-center justify-content-between small">
                  <div>
                    <strong>Viewing Past Version:</strong> v{activeVersion.VersionNumber} &bull; Uploaded on {activeVersion.CreatedAt} &bull; <em>{activeVersion.ChangeSummary || 'Revision'}</em>
                  </div>
                  <button className="btn btn-sm btn-dark py-0" onClick={() => setActiveVersion(null)}>
                    Switch to Current v{doc.Version}
                  </button>
                </div>
              )}

              {/* 1. If File is EXCEL: Render Interactive In-Browser Spreadsheet! */}
              {isExcel && (
                <div className="d-flex flex-column h-100 overflow-hidden">
                  
                  {/* Sheet Tabs Header */}
                  <div className="d-flex align-items-center justify-content-between bg-light border-bottom px-3 py-2">
                    <div className="d-flex align-items-center gap-2">
                      <FileSpreadsheet size={18} className="text-success" />
                      <span className="fw-bold small text-dark">Spreadsheet Preview</span>
                      
                      {excelSheets.length > 1 && (
                        <div className="btn-group btn-group-sm ms-2">
                          {excelSheets.map((sh, idx) => (
                            <button
                              key={idx}
                              className={`btn btn-sm ${selectedSheet === sh ? 'btn-success text-white fw-bold' : 'btn-outline-secondary'}`}
                              onClick={() => handleSheetChange(sh)}
                            >
                              {sh}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <a 
                      href={previewStreamUrl} 
                      download={currentFileName}
                      className="btn btn-sm btn-success d-flex align-items-center gap-1"
                    >
                      <Download size={13} /> Download Excel File
                    </a>
                  </div>

                  {/* Spreadsheet Grid */}
                  <div className="flex-grow-1 overflow-auto p-2 bg-light">
                    {excelLoading && (
                      <div className="text-center py-5">
                        <div className="spinner-border text-success" role="status"></div>
                        <p className="mt-2 text-muted small">Rendering Excel spreadsheet...</p>
                      </div>
                    )}

                    {excelError && (
                      <div className="alert alert-warning m-3 small">
                        {excelError}
                      </div>
                    )}

                    {!excelLoading && !excelError && excelTableRows.length > 0 && (
                      <div className="table-responsive bg-white border shadow-sm rounded">
                        <table className="table table-bordered table-sm table-hover mb-0" style={{ fontSize: '0.82rem' }}>
                          <thead className="table-secondary text-center">
                            <tr>
                              <th style={{ width: '45px' }}>#</th>
                              {excelTableRows[0] && excelTableRows[0].map((_, colIdx) => (
                                <th key={colIdx} style={{ minWidth: '100px' }}>
                                  {String.fromCharCode(65 + (colIdx % 26))}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {excelTableRows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                <td className="table-light text-center text-muted fw-bold">{rIdx + 1}</td>
                                {Array.isArray(row) && row.map((cell, cIdx) => (
                                  <td key={cIdx} className={rIdx === 0 ? 'fw-bold bg-light' : ''}>
                                    {cell !== null && cell !== undefined ? cell.toString() : ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {!excelLoading && !excelError && excelTableRows.length === 0 && (
                      <div className="text-center py-5 text-muted small">
                        The selected sheet is empty.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. If File is PDF: Embed Native PDF Viewer */}
              {isPdf && (
                <iframe
                  src={previewStreamUrl}
                  title={doc.Name}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              )}

              {/* 3. If File is IMAGE: Show Image with Zoom */}
              {isImage && (
                <div className="h-100 d-flex align-items-center justify-content-center bg-dark p-3 overflow-auto">
                  <img 
                    src={previewStreamUrl} 
                    alt={doc.Name} 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                  />
                </div>
              )}

              {/* 4. If Other Office Document (e.g. Word .docx) */}
              {!isExcel && !isPdf && !isImage && (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center p-5 text-center bg-light">
                  <FileText size={64} className="text-primary mb-3" />
                  <h5 className="fw-bold text-dark mb-1">{doc.Name}</h5>
                  <p className="text-muted small mb-3">
                    Office Document ({fileExt.toUpperCase()}) &bull; {(doc.FileSizeBytes / 1024).toFixed(1)} KB
                  </p>
                  <a 
                    href={previewStreamUrl} 
                    download={currentFileName}
                    className="btn btn-primary d-flex align-items-center gap-2"
                  >
                    <Download size={16} /> Download to Open in MS Office
                  </a>
                </div>
              )}

            </div>

            {/* Right Pane: Meta Data, Version History & Central Audit Trail Sidebar */}
            <div className="d-flex flex-column bg-white p-3 overflow-y-auto" style={{ width: '400px', flexShrink: 0 }}>
              
              {/* Tab Navigation */}
              <div className="d-flex border-bottom pb-2 mb-3 gap-1">
                <button 
                  className={`btn btn-sm flex-fill ${activeTab === 'metadata' ? 'btn-success text-white fw-bold' : 'btn-light text-muted'}`}
                  onClick={() => setActiveTab('metadata')}
                  style={{ fontSize: '0.78rem' }}
                >
                  <Eye size={13} className="me-1" /> Meta Data
                </button>
                <button 
                  className={`btn btn-sm flex-fill ${activeTab === 'versions' ? 'btn-success text-white fw-bold' : 'btn-light text-muted'}`}
                  onClick={() => setActiveTab('versions')}
                  style={{ fontSize: '0.78rem' }}
                >
                  <History size={13} className="me-1" /> Versions ({versions.length || 1})
                </button>
                <button 
                  className={`btn btn-sm flex-fill ${activeTab === 'audit' ? 'btn-success text-white fw-bold' : 'btn-light text-muted'}`}
                  onClick={() => { setActiveTab('audit'); if (doc?.Id) loadActivityLogs(doc.Id); }}
                  style={{ fontSize: '0.78rem' }}
                >
                  <ShieldCheck size={13} className="me-1" /> Audit Trail ({activityLogs.length})
                </button>
              </div>

              {/* Tab 1: Meta Data Fields */}
              {activeTab === 'metadata' && (
                <div>
                  <h6 className="fw-bold text-success mb-3 border-bottom pb-2">Document Properties</h6>
                  
                  <div className="mb-2">
                    <small className="text-muted d-block">File Name:</small>
                    <span className="fw-semibold">{doc.Name}</span>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <small className="text-muted d-block">File No:</small>
                      <span className="fw-semibold">{doc.FileNo || '—'}</span>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">Note No:</small>
                      <span className="fw-semibold">{doc.NoteNo || '—'}</span>
                    </div>
                  </div>

                  <div className="mb-2">
                    <small className="text-muted d-block">Document Type:</small>
                    <span className="badge bg-primary">{doc.DocumentType || 'WORK ORDER'}</span>
                  </div>

                  <div className="mb-2">
                    <small className="text-muted d-block">Supplier / Party:</small>
                    <span className="fw-semibold">{doc.SupplierName || '—'}</span>
                  </div>

                  <div className="mb-2">
                    <small className="text-muted d-block">Expiry Date:</small>
                    <span className="fw-semibold">{doc.ExpiryDate || 'No Expiry'}</span>
                    {doc.ActionUponExpiry && doc.ActionUponExpiry !== 'NONE' && (
                      <span className="badge bg-warning text-dark ms-2">{doc.ActionUponExpiry}</span>
                    )}
                  </div>

                  <div className="mb-2">
                    <small className="text-muted d-block">Sharing Scope:</small>
                    <span className="badge bg-info text-dark">{doc.ShareScope || 'All Logged in Users'}</span>
                  </div>

                  {readOnly ? (
                    <div className="mb-3 p-2 rounded bg-light border border-warning border-opacity-50">
                      <div className="d-flex align-items-center gap-1 text-warning-emphasis fw-bold" style={{ fontSize: '0.78rem' }}>
                        <Lock size={13} className="text-warning" />
                        <span>Workflow Locked Attachment</span>
                      </div>
                      <small className="text-muted d-block mt-1" style={{ fontSize: '0.72rem' }}>
                        This document is officially linked to an active workflow case. External public sharing is disabled to protect confidential audit data.
                      </small>
                    </div>
                  ) : (
                    /* Public Shareable Link Box */
                    <div className="mb-3 p-2 rounded bg-light border">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <small className="fw-bold text-dark d-flex align-items-center gap-1">
                          <Share2 size={13} className={isShareActive ? 'text-success' : 'text-muted'} />
                          <span>Public Shareable Link</span>
                        </small>
                        <button 
                          className={`btn btn-xs py-0 px-2 btn-${isShareActive ? 'outline-danger' : 'outline-success'}`}
                          style={{ fontSize: '0.7rem' }}
                          onClick={handleToggleShare}
                          title={isShareActive ? 'Deactivate public link' : 'Generate public share link'}
                        >
                          {isShareActive ? 'Deactivate' : 'Enable Link'}
                        </button>
                      </div>

                      {isShareActive && shareToken ? (
                        <div>
                          {(() => {
                            const publicShareUrl = `http://${serverLanIp || '192.168.10.127'}:5162/api/Document/PublicStream?token=${shareToken}`;
                            return (
                              <>
                                <div className="input-group input-group-sm mt-1">
                                  <input 
                                    type="text" 
                                    readOnly 
                                    className="form-control form-control-sm bg-white" 
                                    style={{ fontSize: '0.72rem' }}
                                    value={publicShareUrl}
                                  />
                                  <button 
                                    className="btn btn-outline-success" 
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(publicShareUrl);
                                      Swal.fire({
                                        icon: 'success',
                                        title: 'Link Copied!',
                                        text: `Network link copied (${publicShareUrl}). Colleagues on your office network/Wi-Fi can access this file directly.`,
                                        timer: 2000,
                                        showConfirmButton: false
                                      });
                                    }}
                                    title="Copy network share link"
                                  >
                                    <Copy size={12} />
                                  </button>
                                  <a 
                                    href={publicShareUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-outline-primary"
                                    title="Open external preview in new tab"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                </div>
                                <div className="d-flex align-items-center justify-content-between mt-1">
                                  <small className="text-success fw-semibold" style={{ fontSize: '0.68rem' }}>
                                    ✓ Public link active (No ERP login required)
                                  </small>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>
                          External access is currently disabled. Click Enable Link to share with external parties.
                        </small>
                      )}
                    </div>
                  )}

                  <div className="mb-2">
                    <small className="text-muted d-block">Tags:</small>
                    <div>
                      {tagsList.length > 0 ? (
                        tagsList.map((tag, idx) => (
                          <span key={idx} className="badge bg-secondary me-1 mb-1">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted fst-italic">None</span>
                      )}
                    </div>
                  </div>

                  <div className="mb-3">
                    <small className="text-muted d-block">Notes / Remarks:</small>
                    <p className="small text-secondary bg-light p-2 rounded mb-0">
                      {doc.Notes || 'No additional notes provided.'}
                    </p>
                  </div>

                  <div className="p-2 border rounded bg-light text-muted small">
                    <div><strong>Created By:</strong> {doc.CreatedBy || 'DILIP'}</div>
                    <div><strong>Created At:</strong> {doc.CreatedAt}</div>
                    <div><strong>Current Version:</strong> v{doc.Version || '1.00'}</div>
                    <div><strong>Size:</strong> {(doc.FileSizeBytes / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
              )}

              {/* Tab 2: Version History & Switcher */}
              {activeTab === 'versions' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                    <h6 className="fw-bold text-success mb-0">Version Timeline</h6>
                    {readOnly ? (
                      <span className="badge bg-light text-secondary border d-flex align-items-center gap-1 py-1 px-2" style={{ fontSize: '0.72rem' }}>
                        <Lock size={12} className="text-muted" /> Version Locked
                      </span>
                    ) : (
                      <button 
                        className="btn btn-sm btn-outline-success"
                        onClick={() => setIsUploadingVersion(!isUploadingVersion)}
                      >
                        <Upload size={14} className="me-1" /> New Version
                      </button>
                    )}
                  </div>

                  {/* Form to upload new version (only for writable repository explorer) */}
                  {!readOnly && isUploadingVersion && (
                    <form onSubmit={handleUploadVersion} className="border p-2 rounded bg-light mb-3">
                      <small className="fw-bold d-block mb-1">Upload New Version File:</small>
                      <input 
                        type="file" 
                        className="form-control form-control-sm mb-2" 
                        onChange={(e) => setNewVersionFile(e.target.files[0])}
                        required 
                      />
                      <input 
                        type="text" 
                        className="form-control form-control-sm mb-2" 
                        placeholder="Change summary (e.g. Revised prices)"
                        value={changeSummary}
                        onChange={(e) => setChangeSummary(e.target.value)}
                      />
                      <div className="d-flex justify-content-end gap-1">
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsUploadingVersion(false)}>Cancel</button>
                        <button type="submit" className="btn btn-sm btn-success">Save Version</button>
                      </div>
                    </form>
                  )}

                  {/* Versions List with Preview & Download Actions */}
                  <div className="timeline">
                    {versions.map((v, i) => {
                      const isCurrentlyPreviewed = activeVersion ? activeVersion.Id === v.Id : (v.VersionNumber === doc.Version);
                      const isLatest = v.VersionNumber === doc.Version;

                      return (
                        <div 
                          key={i} 
                          className={`border rounded p-3 mb-3 bg-white shadow-sm ${isCurrentlyPreviewed ? 'border-success' : ''}`}
                          style={{ borderLeft: isCurrentlyPreviewed ? '4px solid #0b7337' : '1px solid #dee2e6' }}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="badge bg-success fs-6">v{v.VersionNumber}</span>
                            {isLatest ? (
                              <span className="badge bg-primary">Latest Version</span>
                            ) : (
                              <span className="badge bg-light text-secondary border">Previous Version</span>
                            )}
                          </div>

                          <div className="small text-muted mb-1">
                            <strong>Date:</strong> {v.CreatedAt}
                          </div>

                          <div className="small mb-2">
                            <strong>Summary:</strong> {v.ChangeSummary || 'Document revision'}
                          </div>

                          {/* Version Actions: Preview & Download */}
                          <div className="d-flex gap-1 pt-2 border-top">
                            <button
                              className={`btn btn-sm flex-fill ${isCurrentlyPreviewed ? 'btn-success disabled text-white' : 'btn-outline-success'}`}
                              onClick={() => {
                                if (isLatest) {
                                  setActiveVersion(null);
                                } else {
                                  setActiveVersion(v);
                                }
                              }}
                            >
                              <Eye size={13} className="me-1" />
                              {isCurrentlyPreviewed ? 'Viewing Now' : `Preview v${v.VersionNumber}`}
                            </button>

                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => handleDownloadFile(v)}
                              title={`Download version ${v.VersionNumber}`}
                            >
                              <Download size={13} />
                            </button>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: Centralized Document Activity & Audit Trail (Loophole 6) */}
              {activeTab === 'audit' && (
                <div className="d-flex flex-column h-100">
                  <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                    <div>
                      <h6 className="fw-bold text-success mb-0 d-flex align-items-center gap-1">
                        <ShieldCheck size={16} /> Audit Trail & Activity
                      </h6>
                      <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                        Immutable record of views, downloads, edits & workflow locks
                      </small>
                    </div>
                    <button 
                      className="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center gap-1"
                      onClick={() => doc?.Id && loadActivityLogs(doc.Id)}
                      title="Refresh activity logs"
                      style={{ fontSize: '0.75rem' }}
                    >
                      <RotateCcw size={12} className={logsLoading ? 'fa-spin' : ''} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {/* Compliance Security Banner */}
                  <div className="p-2 mb-3 rounded bg-light border border-success border-opacity-25 d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                      <div className="bg-success text-white rounded-circle p-1 d-flex align-items-center justify-content-center" style={{ width: 24, height: 24 }}>
                        <ShieldCheck size={14} />
                      </div>
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.76rem' }}>ISO 27001 / ICT Act Compliance</div>
                        <div className="text-muted" style={{ fontSize: '0.68rem' }}>Tamper-proof event sequence & IP logging</div>
                      </div>
                    </div>
                    <span className="badge bg-success" style={{ fontSize: '0.68rem' }}>
                      {activityLogs.length} Events
                    </span>
                  </div>

                  {/* Logs Timeline */}
                  {logsLoading && activityLogs.length === 0 ? (
                    <div className="text-center py-5 text-muted small">
                      <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                      Loading audit records...
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="text-center py-5 text-muted small fst-italic">
                      No activity records found for this document.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2 overflow-y-auto pe-1" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                      {activityLogs.map((log, idx) => {
                        const act = log.ActionType || 'VIEW';
                        const isUpload = act === 'UPLOAD';
                        const isNewVer = act === 'NEW_VERSION';
                        const isView = act === 'VIEW' || act === 'VIEW_VERSION' || act === 'PUBLIC_VIEW';
                        const isDownload = act === 'DOWNLOAD' || act === 'DOWNLOAD_VERSION';
                        const isAttach = act === 'WORKFLOW_ATTACH';
                        const isCheck = act === 'CHECKOUT' || act === 'CHECKIN';
                        const isTrash = act === 'TRASH';
                        const isRestore = act === 'RESTORE';

                        const badgeColor = isUpload ? '#0b7337' 
                          : isNewVer ? '#7c3aed' 
                          : isDownload ? '#0891b2' 
                          : isView ? '#0284c7' 
                          : isAttach ? '#d97706' 
                          : isCheck ? '#ea580c' 
                          : isTrash ? '#dc2626' 
                          : isRestore ? '#059669' 
                          : '#4b5563';

                        const badgeBg = isUpload ? '#ecfdf5' 
                          : isNewVer ? '#f5f3ff' 
                          : isDownload ? '#ecfeff' 
                          : isView ? '#f0f9ff' 
                          : isAttach ? '#fffbeb' 
                          : isCheck ? '#fff7ed' 
                          : isTrash ? '#fef2f2' 
                          : isRestore ? '#f0fdf4' 
                          : '#f9fafb';

                        return (
                          <div 
                            key={log.Id || idx} 
                            className="p-2 rounded border position-relative"
                            style={{ 
                              backgroundColor: badgeBg, 
                              borderColor: '#e2e8f0', 
                              borderLeft: `4px solid ${badgeColor}`,
                              fontSize: '0.78rem'
                            }}
                          >
                            <div className="d-flex align-items-center justify-content-between mb-1">
                              <span 
                                className="badge text-uppercase fw-bold"
                                style={{ 
                                  backgroundColor: badgeColor, 
                                  color: 'white', 
                                  fontSize: '0.66rem',
                                  letterSpacing: '0.4px'
                                }}
                              >
                                {act.replace('_', ' ')}
                              </span>
                              <span className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '0.70rem' }}>
                                <Clock size={11} /> {log.CreatedAt}
                              </span>
                            </div>

                            <div className="d-flex align-items-center gap-1 mb-1">
                              <span className="fw-bold text-dark">{log.PerformedBy}</span>
                              <span className="badge bg-secondary" style={{ fontSize: '0.64rem' }}>{log.UserRole}</span>
                            </div>

                            {log.Details && (
                              <div className="text-secondary mb-1" style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>
                                {log.Details}
                              </div>
                            )}

                            <div className="d-flex align-items-center justify-content-between text-muted border-top pt-1 mt-1" style={{ fontSize: '0.66rem' }}>
                              <span>IP: <code className="text-dark">{log.IpAddress || '127.0.0.1'}</code></span>
                              <span className="text-success fw-semibold">Digitally Logged</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
