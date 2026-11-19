import React, { useState, useEffect } from 'react';
import Api from '../api';
import { 
  Archive, 
  Folder, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Plus, 
  Search, 
  DownloadCloud, 
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import DocumentViewerModal from './DocumentViewerModal';

export default function ArchiveProjectView({ onNavigateUpload }) {
  const [archiveFolders, setArchiveFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDocForModal, setSelectedDocForModal] = useState(null);

  useEffect(() => {
    loadArchiveFolders();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      loadDocuments(selectedFolder.Id);
    }
  }, [selectedFolder]);

  const loadArchiveFolders = async () => {
    try {
      const res = await Api.get('/Folder/GetTree');
      if (res.data.status) {
        const list = res.data.data || [];
        const subs = list.filter(f => f.FolderType === 'ArchiveSubfolder');
        setArchiveFolders(subs);
        if (subs.length > 0) setSelectedFolder(subs[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadDocuments = async (folderId) => {
    try {
      setLoading(true);
      const res = await Api.get(`/Document/GetDocumentList?folderId=${folderId}`);
      if (res.data.status) {
        setDocuments(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-4" style={{ height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
      
      {/* Project Banner & Status Stepper (Sayeed demo matching) */}
      <div className="bg-white rounded p-4 shadow-sm border mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-primary">BPC-2026-0011</span>
              <span className="badge bg-light text-dark border">Conferences</span>
              <span className="badge bg-success bg-opacity-10 text-success fw-bold">Archived</span>
            </div>
            <h4 className="fw-bold text-dark mb-0">DCCI AI SUMMIT 2026</h4>
            <small className="text-muted">Standard 15-Folder Event Archive Structure</small>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1">
              <DownloadCloud size={14} /> Download Archive ZIP
            </button>
            <button className="btn btn-sm btn-success d-flex align-items-center gap-1" onClick={onNavigateUpload}>
              <Plus size={14} /> Add Document
            </button>
          </div>
        </div>

        {/* 3-Step Lifecycle Stepper */}
        <div className="d-flex align-items-center justify-content-center py-2 px-3 bg-light rounded border">
          <div className="d-flex align-items-center text-success fw-bold small">
            <CheckCircle2 size={18} className="me-1" /> 1. Initiated
          </div>
          <div style={{ width: '80px', height: '2px', backgroundColor: '#0b7337', margin: '0 1rem' }}></div>
          <div className="d-flex align-items-center text-success fw-bold small">
            <CheckCircle2 size={18} className="me-1" /> 2. Review
          </div>
          <div style={{ width: '80px', height: '2px', backgroundColor: '#0b7337', margin: '0 1rem' }}></div>
          <div className="d-flex align-items-center text-success fw-bold small">
            <ShieldCheck size={18} className="me-1" /> 3. Archived (Compliant)
          </div>
        </div>
      </div>

      {/* Grid of the 15 Standard Folders */}
      <h6 className="fw-bold text-dark mb-3">Archive Folders (Select to inspect files):</h6>
      
      <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-5 g-3 mb-4">
        {archiveFolders.map((f) => {
          const isSelected = selectedFolder?.Id === f.Id;
          const isRequired = f.IsRequired === 1 || f.IsRequired === true;

          return (
            <div key={f.Id} className="col">
              <div 
                className={`archive-folder-card ${isRequired ? 'required' : ''} ${isSelected ? 'border-success bg-light' : ''}`}
                onClick={() => setSelectedFolder(f)}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <Folder size={22} className={isSelected ? 'text-success' : 'text-secondary'} />
                  {isRequired && (
                    <span className="badge-required">REQUIRED</span>
                  )}
                </div>

                <div className="fw-semibold text-dark text-truncate small" title={f.Name}>
                  {f.Name}
                </div>
                <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>
                  {isSelected ? `${documents.length} files` : 'Click to view'}
                </small>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Folder Files Table */}
      {selectedFolder && (
        <div className="bg-white rounded p-4 shadow-sm border">
          <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
            <div>
              <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                <Folder size={18} className="text-warning" />
                <span>{selectedFolder.Name}</span>
                {selectedFolder.IsRequired && (
                  <span className="badge-required ms-1">MANDATORY FOLDER</span>
                )}
              </h6>
              <small className="text-muted">{documents.length} file(s) archived</small>
            </div>

            <button className="btn btn-sm btn-outline-success" onClick={onNavigateUpload}>
              <Plus size={14} className="me-1" /> Upload to this folder
            </button>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-success" role="status"></div>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-4 text-muted small">
              No files uploaded to this folder yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small text-secondary">
                  <tr>
                    <th>File</th>
                    <th>Type</th>
                    <th>Version</th>
                    <th>Uploaded Date</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.Id} style={{ cursor: 'pointer' }} onClick={() => setSelectedDocForModal(d)}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <FileText size={16} className="text-success" />
                          <span className="fw-semibold text-dark">{d.Name}</span>
                        </div>
                      </td>
                      <td><span className="badge bg-light text-dark border">{d.DocumentType}</span></td>
                      <td><span className="badge bg-secondary">v{d.Version}</span></td>
                      <td><small className="text-muted">{d.CreatedAt}</small></td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-success">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedDocForModal && (
        <DocumentViewerModal 
          doc={selectedDocForModal}
          onClose={() => setSelectedDocForModal(null)}
          onRefresh={() => loadDocuments(selectedFolder.Id)}
        />
      )}

    </div>
  );
}
