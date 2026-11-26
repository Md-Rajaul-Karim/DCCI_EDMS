import React, { useState, useEffect } from 'react';
import Api from '../api';
import { 
  UploadCloud, 
  Trash2, 
  FileText, 
  Eye, 
  CheckCircle, 
  ArrowRight, 
  Save, 
  RotateCcw,
  Tag,
  Calendar,
  Layers,
  Share2
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function UploadView({ onUploadSuccess }) {
  const [folders, setFolders] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([
    'WORK ORDER',
    'Proposal',
    'Agreement',
    'IT_OFFICE FILE',
    'Circular',
    'Invoice',
    'Specification',
    'Report',
    'General'
  ]);
  const [isCustomType, setIsCustomType] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState('');
  const [stagedFiles, setStagedFiles] = useState([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Metadata form state - Folderization is strictly by DocumentType
  const [meta, setMeta] = useState({
    Name: '',
    DocumentType: 'WORK ORDER',
    ExpiryDate: '',
    ActionUponExpiry: 'NONE',
    Tags: '',
    SupplierName: '',
    FileNo: '',
    NoteNo: '',
    Notes: '',
    ShareScope: 'All Logged in Users',
    ShareGroups: '',
    IsShareableLinkActive: false
  });

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const res = await Api.get('/Folder/GetTree');
      if (res.data.status && Array.isArray(res.data.data)) {
        setFolders(res.data.data);
        const typesFromFolders = res.data.data
          .filter(f => f.FolderType === 'DocumentType' || (f.ParentId && f.Code))
          .map(f => f.Code || f.Name);
        if (typesFromFolders.length > 0) {
          const combined = Array.from(new Set([...documentTypes, ...typesFromFolders]));
          setDocumentTypes(combined);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer ? e.dataTransfer.files : e.target.files);
    
    // Check 200MB limit per file
    const oversized = files.filter(f => f.size > 200 * 1024 * 1024);
    if (oversized.length > 0) {
      Swal.fire('File Too Large', 'Maximum allowed file size is 200 MB per file.', 'error');
      return;
    }

    const newStaged = files.map(file => ({
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      type: file.type || 'application/octet-stream',
      previewUrl: URL.createObjectURL(file)
    }));

    setStagedFiles(prev => [...prev, ...newStaged]);
    if (stagedFiles.length === 0 && newStaged.length > 0) {
      setMeta(m => ({ ...m, Name: newStaged[0].name.replace(/\.[^/.]+$/, "") }));
    }
  };

  const handleRemoveStaged = (index) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedFileIndex === index) setSelectedFileIndex(0);
  };

  const handleRemoveAll = () => {
    setStagedFiles([]);
    setSelectedFileIndex(0);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (stagedFiles.length === 0) {
      Swal.fire('No Files', 'Please drop or select at least one file to upload.', 'warning');
      return;
    }

    if (!meta.Name || !meta.Name.trim()) {
      Swal.fire('Validation', 'Document Name is required.', 'warning');
      return;
    }

    const finalDocType = isCustomType 
      ? (customTypeInput.trim() || 'General') 
      : (meta.DocumentType || 'WORK ORDER');

    // Auto-map to folder ID based on DocumentType
    const matchedFolder = folders.find(f => 
      f.Code?.toLowerCase() === finalDocType.toLowerCase() || 
      f.Name?.toLowerCase() === finalDocType.toLowerCase()
    );
    const targetFolderId = matchedFolder ? matchedFolder.Id : 10;

    try {
      setIsSubmitting(true);
      
      // Upload the staged files with the metadata
      for (const item of stagedFiles) {
        const formData = new FormData();
        formData.append('file', item.file);
        
        const fileMeta = {
          ...meta,
          DocumentType: finalDocType,
          DepartmentFolderId: targetFolderId,
          Name: stagedFiles.length === 1 ? meta.Name : `${meta.Name} - ${item.name}`
        };
        formData.append('metadataJson', JSON.stringify(fileMeta));

        const res = await Api.post('/Document/Upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (!res.data.status) {
          throw new Error(res.data.message || 'Upload failed');
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Upload Complete',
        text: `${stagedFiles.length} document(s) uploaded and saved to [${finalDocType}] folder!`,
        timer: 1800,
        showConfirmButton: false
      });

      // Clear form
      setStagedFiles([]);
      setIsCustomType(false);
      setCustomTypeInput('');
      setMeta({
        Name: '',
        DocumentType: 'WORK ORDER',
        ExpiryDate: '',
        ActionUponExpiry: 'NONE',
        Tags: '',
        SupplierName: '',
        FileNo: '',
        NoteNo: '',
        Notes: '',
        ShareScope: 'All Logged in Users',
        ShareGroups: '',
        IsShareableLinkActive: false
      });

      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      Swal.fire('Upload Error', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-4" style={{ height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
      <div className="row g-4">
        
        {/* Left Column: File Dropzone & Staged Files (Dilip demo style) */}
        <div className="col-lg-6">
          <div className="bg-white rounded p-4 shadow-sm border mb-4">
            <h6 className="fw-bold text-success mb-3">Drop Your File Here!</h6>
            
            {/* Drop Box */}
            <div 
              className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => document.getElementById('fileInput').click()}
            >
              <UploadCloud size={48} className="text-success mb-2" />
              <h6 className="fw-bold text-dark mb-1">Click to browse or drag and drop files here</h6>
              <p className="small text-muted mb-0">
                You can attach multiple files, maximum <strong>200 MB</strong> for each file
              </p>
              <span className="badge bg-light text-secondary border mt-2">
                PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
              </span>
              <input 
                id="fileInput" 
                type="file" 
                multiple 
                className="d-none" 
                onChange={handleFileDrop} 
              />
            </div>

            {/* Staged Files Cards */}
            {stagedFiles.length > 0 && (
              <div className="mt-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="fw-bold text-dark">
                    Staged Files ({stagedFiles.length})
                  </span>
                  <button className="btn btn-sm btn-outline-danger" onClick={handleRemoveAll}>
                    <Trash2 size={13} className="me-1" /> REMOVE ALL
                  </button>
                </div>

                <div className="row row-cols-1 row-cols-sm-2 g-3">
                  {stagedFiles.map((item, idx) => (
                    <div key={idx} className="col">
                      <div className="border rounded p-3 text-center bg-light position-relative">
                        <div className="d-flex justify-content-center mb-2">
                          <div style={{
                            width: '48px',
                            height: '56px',
                            background: '#eff6ff',
                            border: '2px solid #3b82f6',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#3b82f6'
                          }}>
                            <FileText size={26} />
                          </div>
                        </div>

                        <span className="fw-semibold text-dark d-block text-truncate small mb-1" title={item.name}>
                          {item.name}
                        </span>
                        <small className="text-muted d-block mb-2">{item.size}</small>

                        <div className="d-flex justify-content-center gap-1">
                          <a 
                            href={item.previewUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn btn-sm btn-outline-primary py-0 px-2"
                            title="Preview"
                          >
                            <Eye size={12} />
                          </a>
                          <button 
                            className="btn btn-sm btn-outline-danger py-0 px-2"
                            onClick={() => handleRemoveStaged(idx)}
                            title="Remove"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Metadata Indexing Form (Dilip demo right pane) */}
        <div className="col-lg-6">
          <div className="bg-white rounded p-4 shadow-sm border">
            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
              <h6 className="fw-bold text-success mb-0">Add Meta Data & Classification</h6>
              <span className="badge bg-success bg-opacity-10 text-success">DCCI Schema</span>
            </div>

            <form onSubmit={handleSave}>
              
              {/* Document Name */}
              <div className="mb-3">
                <label className="form-label small fw-bold">Document Name <span className="text-danger">*</span></label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  placeholder="e.g. SMS Agreement 2025"
                  value={meta.Name}
                  onChange={(e) => setMeta({ ...meta, Name: e.target.value })}
                  required
                />
              </div>

              {/* Auto Folderization Banner */}
              <div className="p-2 mb-3 bg-light rounded border border-success border-opacity-25 d-flex align-items-center gap-2">
                <Layers size={18} className="text-success flex-shrink-0" />
                <div className="small text-muted" style={{ fontSize: '0.78rem' }}>
                  <strong>স্বয়ংক্রিয় ফোল্ডারাইজেশন:</strong> সিলেক্ট করা <strong>Document Type</strong> অনুসারেই ফাইলটি Explorer-এ নির্দিষ্ট ফোল্ডারে সংরক্ষিত হবে। আলাদা ডিপার্টমেন্ট সিলেক্ট করার প্রয়োজন নেই।
                </div>
              </div>

              {/* Document Type (Acts as Target Folder) & Action Upon Expiry */}
              <div className="row g-2 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold">
                    Document Type <span className="text-danger">*</span> (Target Folder)
                  </label>
                  {!isCustomType ? (
                    <select 
                      className="form-select form-select-sm border-success"
                      value={meta.DocumentType}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          setIsCustomType(true);
                        } else {
                          setMeta({ ...meta, DocumentType: e.target.value });
                        }
                      }}
                      required
                    >
                      {documentTypes.map(type => (
                        <option key={type} value={type}>📁 {type}</option>
                      ))}
                      <option value="__NEW__">+ Add Custom Document Type...</option>
                    </select>
                  ) : (
                    <div className="input-group input-group-sm">
                      <input 
                        type="text" 
                        className="form-control form-control-sm border-success" 
                        placeholder="Enter custom type..."
                        value={customTypeInput}
                        onChange={(e) => setCustomTypeInput(e.target.value)}
                        autoFocus
                      />
                      <button 
                        type="button" 
                        className="btn btn-outline-secondary"
                        onClick={() => {
                          setIsCustomType(false);
                          setCustomTypeInput('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold">Action Upon Expiry</label>
                  <select 
                    className="form-select form-select-sm"
                    value={meta.ActionUponExpiry}
                    onChange={(e) => setMeta({ ...meta, ActionUponExpiry: e.target.value })}
                  >
                    <option value="NONE">NONE</option>
                    <option value="Archive">Archive</option>
                    <option value="Delete">Delete</option>
                  </select>
                </div>
              </div>

              {/* Expiry Date & Supplier Name */}
              <div className="row g-2 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold">Expiration Date</label>
                  <input 
                    type="date" 
                    className="form-control form-control-sm"
                    value={meta.ExpiryDate}
                    onChange={(e) => setMeta({ ...meta, ExpiryDate: e.target.value })}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold">Supplier / Vendor Name</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm"
                    placeholder="e.g. Software Shop Limited"
                    value={meta.SupplierName}
                    onChange={(e) => setMeta({ ...meta, SupplierName: e.target.value })}
                  />
                </div>
              </div>

              {/* File No & Note No */}
              <div className="row g-2 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold">File Number</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm"
                    placeholder="e.g. DCCI/IT/2025/248-1"
                    value={meta.FileNo}
                    onChange={(e) => setMeta({ ...meta, FileNo: e.target.value })}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold">Note Number</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm"
                    placeholder="e.g. PA-44270"
                    value={meta.NoteNo}
                    onChange={(e) => setMeta({ ...meta, NoteNo: e.target.value })}
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="mb-3">
                <label className="form-label small fw-bold">Tags (Comma-separated)</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  placeholder="e.g. SMS, Agreement, Vendor, 2025"
                  value={meta.Tags}
                  onChange={(e) => setMeta({ ...meta, Tags: e.target.value })}
                />
              </div>

              {/* Sharing Scope */}
              <div className="mb-3">
                <label className="form-label small fw-bold">Share Document(s)</label>
                <select 
                  className="form-select form-select-sm"
                  value={meta.ShareScope}
                  onChange={(e) => setMeta({ ...meta, ShareScope: e.target.value })}
                >
                  <option value="All Logged in Users">All Logged in Users</option>
                  <option value="Public">Public</option>
                  <option value="Training">Group: Training</option>
                  <option value="PR">Group: PR</option>
                  <option value="Project">Group: Project</option>
                  <option value="Gulshan Center">Group: Gulshan Center</option>
                </select>
              </div>

              {/* Shareable Link Toggle */}
              <div className="mb-3 p-2 rounded bg-light border">
                <div className="form-check form-switch mb-1">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="shareableLinkToggle"
                    checked={meta.IsShareableLinkActive}
                    onChange={(e) => setMeta({ ...meta, IsShareableLinkActive: e.target.checked })}
                  />
                  <label className="form-check-label small fw-bold text-dark d-flex align-items-center gap-1" htmlFor="shareableLinkToggle">
                    <Share2 size={14} className="text-success" />
                    Generate Shareable External Link
                  </label>
                </div>

                {meta.IsShareableLinkActive ? (
                  <div className="mt-2 small bg-white p-2 rounded border border-success border-opacity-50">
                    <div className="fw-semibold text-success d-flex align-items-center gap-1 mb-1">
                      <CheckCircle size={14} className="text-success" />
                      External Public Access Enabled
                    </div>
                    <div className="text-secondary" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                      এটি অন করলে সিস্টেম একটি সুরক্ষিত <strong>ইউনিক টোকেন লিংক (Tokenized Public URL)</strong> তৈরি করবে। এই লিংকটি আপনি কোনো এক্সটার্নাল ভেন্ডর, সাপ্লায়ার, অডিটর বা কমিটির মেম্বারকে দিলে তারা <strong>ERP-তে লগইন বা পাসওয়ার্ড ছাড়াই</strong> সরাসরি শুধু এই নির্দিষ্ট ফাইলটি ভিউ ও ডাউনলোড করতে পারবেন।
                    </div>
                  </div>
                ) : (
                  <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                    অফ থাকলে ফাইলটি শুধুমাত্র ERP সিস্টেমে লগইন থাকা নির্দিষ্ট ইউজাররা দেখতে পাবেন।
                  </small>
                )}
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="form-label small fw-bold">File Notes / Summary</label>
                <textarea 
                  rows="2" 
                  className="form-control form-control-sm"
                  placeholder="Additional context or notes..."
                  value={meta.Notes}
                  onChange={(e) => setMeta({ ...meta, Notes: e.target.value })}
                ></textarea>
              </div>

              {/* Action Buttons */}
              <div className="d-flex justify-content-end gap-2 border-top pt-3">
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                  onClick={() => setMeta({
                    Name: '',
                    DocumentType: 'WORK ORDER',
                    DepartmentFolderId: '',
                    ExpiryDate: '',
                    ActionUponExpiry: 'NONE',
                    Tags: '',
                    SupplierName: '',
                    FileNo: '',
                    NoteNo: '',
                    Notes: '',
                    ShareScope: 'All Logged in Users',
                    ShareGroups: '',
                    IsShareableLinkActive: false
                  })}
                >
                  <RotateCcw size={14} /> CLEAR
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-success px-4 d-flex align-items-center gap-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      UPLOADING...
                    </>
                  ) : (
                    <>
                      <Save size={15} /> SAVE & INDEX
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
