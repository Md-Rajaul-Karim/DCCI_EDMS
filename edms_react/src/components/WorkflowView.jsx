import React, { useState, useEffect } from 'react';
import Api from '../api';
import DocumentViewerModal from './DocumentViewerModal';
import DcciNoteSheetPrint from './DcciNoteSheetPrint';
import { 
  GitBranch, 
  Inbox, 
  FileEdit, 
  HelpCircle, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Plus, 
  Search, 
  FileText, 
  Eye, 
  User, 
  Paperclip,
  X,
  Check,
  RotateCcw,
  Send,
  Printer,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Building,
  CheckCircle2,
  Calendar,
  Info
} from 'lucide-react';
import Swal from 'sweetalert2';
import { SYSTEM_USERS } from '../constants/systemUsers';

export default function WorkflowView({ currentUser }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeBucket, setActiveBucket] = useState('Process Status');
  const [bucketCounts, setBucketCounts] = useState({
    inbox: 0,
    draft: 0,
    query: 0,
    risk: 0,
    overDue: 0,
    processStatus: 0
  });
  const [selectedCase, setSelectedCase] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingAttachmentDoc, setViewingAttachmentDoc] = useState(null);
  const [loadingAttachment, setLoadingAttachment] = useState(false);
  const [edmsDocuments, setEdmsDocuments] = useState([]);
  const [selectedNewAttachments, setSelectedNewAttachments] = useState([]);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Action form state inside modal
  const [actionComments, setActionComments] = useState('');
  const [actingRole, setActingRole] = useState('Head of Department');
  const [actingUser, setActingUser] = useState('Engr. Dilip K Roy');
  const [isActing, setIsActing] = useState(false);

  // New Application form
  const [newApp, setNewApp] = useState({
    ProcessName: 'DCCI- Pre-Approval',
    Initiator: 'Md. Arman Hossen',
    Designation: 'Senior Officer',
    DepartmentName: 'Information and Technology',
    OfficeName: 'DCCI HQ',
    FileName: '',
    FileNumber: '',
    NoteNumber: '',
    Priority: 'Medium',
    Subject: '',
    Description: '',
    QuotationType: 'RFQ',
    EstimatedCost: 0,
    HasChecker: false,
    IsVatTaxApplicable: true
  });

  const loadEdmsDocuments = async () => {
    try {
      const res = await Api.get('/Document/GetDocumentList');
      if (res.data?.status && res.data?.data) {
        setEdmsDocuments(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching EDMS documents for workflow:', err);
    }
  };

  const findLinkedDoc = (att) => {
    if (!att || !edmsDocuments || edmsDocuments.length === 0) return null;
    const nameLower = (att.name || '').toLowerCase().trim();
    const titleLower = (att.title || '').toLowerCase().trim();
    return edmsDocuments.find(d => {
      const dName = (d.Name || '').toLowerCase().trim();
      const dOrig = (d.OriginalFileName || '').toLowerCase().trim();
      const dPath = (d.FilePath || '').toLowerCase().trim();
      return (
        (nameLower && (dOrig === nameLower || dName === nameLower || dPath.includes(nameLower))) ||
        (titleLower && (dName === titleLower || dOrig === titleLower))
      );
    }) || null;
  };

  const getParsedAttachments = (c) => {
    if (!c) return [];
    let attList = [];
    if (c.AttachmentsJson) {
      try {
        attList = typeof c.AttachmentsJson === 'string' ? JSON.parse(c.AttachmentsJson) : c.AttachmentsJson;
      } catch (e) {
        attList = [];
      }
    }
    if (!attList || attList.length === 0) {
      if (c.AppId === '7566940683') {
        attList = [
          { name: 'Draft_Specifications.pdf', title: 'CCTV Technical Specifications', label: 'Attachment-1 (Specs)' },
          { name: 'Vendor_Price_Quotation.pdf', title: 'Vendor Price Quotation Comparison', label: 'Attachment-2 (Price Quotation)' }
        ];
      }
    }
    return (attList || []).map(att => {
      const linked = findLinkedDoc(att);
      return {
        ...att,
        version: linked?.Version || att.version || '1.00',
        title: att.title || linked?.Name || att.name
      };
    });
  };

  // Desk Authority / Current Custodian Helper
  const isMyTurnToAct = (role, taskName) => {
    if (!role || !taskName) return false;
    const r = role.toLowerCase().trim();
    const t = taskName.toLowerCase().trim();

    // If case is under Review:
    if (t.startsWith('review')) {
      if (t.includes('head of department') && r.includes('head of department')) return true;
      if (t.includes('accounts') && r.includes('accounts')) return true;
      if (t.includes('secretary general') && r.includes('secretary general')) return true;
      if (t.includes('president') && r.includes('president')) return true;
      if (t.includes('checker') && r.includes('checker')) return true;
      if (t.includes('internal reviewer') || t === 'reviewer review') {
        return r.includes('head of department') || r.includes('accounts');
      }
      return false;
    }

    // Standard sequential desks:
    if (t.includes('head of department') && r.includes('head of department')) return true;
    if (t.includes('accounts') && r.includes('accounts')) return true;
    if (t.includes('secretary general') && r.includes('secretary general')) return true;
    if (t.includes('president') && r.includes('president')) return true;
    if (t.includes('initiator') && r.includes('initiator')) return true;

    return false;
  };

  useEffect(() => {
    loadBucketCounts();
    loadCases();
    loadEdmsDocuments();
  }, [activeBucket, searchTerm]);

  // Sync acting role & user when currentUser changes from Header dropdown
  useEffect(() => {
    if (currentUser) {
      setActingRole(currentUser.role);
      setActingUser(currentUser.name);
      if (currentUser.role === 'Initiator') {
        setNewApp(prev => ({
          ...prev,
          Initiator: currentUser.name,
          Designation: currentUser.designation
        }));
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedCase?.AppId) {
      loadActionHistory(selectedCase.AppId);
      loadEdmsDocuments();
      if (currentUser) {
        setActingRole(currentUser.role);
        setActingUser(currentUser.name);
      } else {
        // Auto-set acting role based on case task
        const task = selectedCase.TaskName || '';
        if (task.includes('Head of Department')) {
          setActingRole('Head of Department');
          setActingUser('Engr. Dilip K Roy');
        } else if (task.includes('Accounts')) {
          setActingRole('Accounts & Finance');
          setActingUser('CFO / Chief Accounts Officer');
        } else if (task.includes('Secretary General')) {
          setActingRole('Secretary General');
          setActingUser('Secretary General (SG)');
        } else if (task.includes('President')) {
          setActingRole('President');
          setActingUser('President of DCCI');
        } else if (task.includes('Initiator') || selectedCase.AppStatus === 'Query') {
          setActingRole('Initiator');
          setActingUser(selectedCase.Initiator || 'Md. Arman Hossen');
        }
      }
    }
  }, [selectedCase, currentUser]);

  const loadBucketCounts = async () => {
    try {
      const res = await Api.get('/Workflow/GetBucketCounts');
      if (res.data.status && res.data.data) {
        setBucketCounts(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching bucket counts:', err);
    }
  };

  const loadCases = async () => {
    try {
      setLoading(true);
      let url = `/Workflow/GetParticipatedList?search=${encodeURIComponent(searchTerm)}&`;
      if (activeBucket) {
        url += `bucket=${encodeURIComponent(activeBucket)}&`;
      }
      const res = await Api.get(url);
      if (res.data.status) {
        setCases(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadActionHistory = async (appId) => {
    try {
      setLoadingHistory(true);
      const res = await Api.get(`/Workflow/GetActionHistory?appId=${appId}`);
      if (res.data.status) {
        setActionHistory(res.data.data || []);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenAttachment = async (att) => {
    try {
      setLoadingAttachment(true);
      const linked = findLinkedDoc(att);
      if (linked?.Id) {
        // Fetch fresh copy with full versions & metadata
        const res = await Api.get(`/Document/GetDocumentById?id=${linked.Id}`);
        if (res.data?.status && res.data?.data) {
          setViewingAttachmentDoc(res.data.data);
          return;
        }
        setViewingAttachmentDoc(linked);
        return;
      }

      const fileName = typeof att === 'string' ? att : (att.name || att.OriginalFileName);
      const fileTitle = typeof att === 'object' ? (att.title || '') : '';
      const res = await Api.get(`/Document/GetDocumentByName?name=${encodeURIComponent(fileName)}&title=${encodeURIComponent(fileTitle)}`);
      if (res.data?.status && res.data?.data) {
        setViewingAttachmentDoc(res.data.data);
      } else {
        // Fallback document object
        setViewingAttachmentDoc({
          Id: 0,
          Name: att.title || fileName,
          OriginalFileName: fileName,
          FilePath: `/media/documents/${fileName}`,
          FileExtension: '.pdf',
          DocumentType: 'Proposal',
          SupplierName: 'Hikvision & Dahua Partners',
          FileNo: selectedCase?.FileNumber || 'DCCI/IT/2024/248-1',
          NoteNo: selectedCase?.NoteNumber || 'WO-CCTV',
          Notes: 'Attached to Pre-Approval Case #' + (selectedCase?.AppId || ''),
          Version: '1.00',
          CreatedBy: selectedCase?.Initiator || 'DILIP',
          CreatedAt: selectedCase?.LastModified || new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error opening attachment:', err);
      const fileName = typeof att === 'string' ? att : (att.name || 'document.pdf');
      setViewingAttachmentDoc({
        Id: 0,
        Name: att.title || fileName,
        OriginalFileName: fileName,
        FilePath: `/media/documents/${fileName}`,
        FileExtension: '.pdf',
        DocumentType: 'Proposal',
        SupplierName: 'Hikvision & Dahua Partners',
        FileNo: selectedCase?.FileNumber || 'DCCI/IT/2024/248-1',
        NoteNo: selectedCase?.NoteNumber || 'WO-CCTV',
        Notes: 'Attached to Pre-Approval Case #' + (selectedCase?.AppId || ''),
        Version: '1.00',
        CreatedBy: selectedCase?.Initiator || 'DILIP',
        CreatedAt: selectedCase?.LastModified || new Date().toISOString()
      });
    } finally {
      setLoadingAttachment(false);
    }
  };

  const handleReviewAction = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Send for Internal Review',
      html: `
        <div class="text-start mb-2">
          <label class="form-label small fw-bold text-dark">Select Target Reviewer / Department:</label>
          <select id="swal-target-role" class="form-select form-select-sm mb-3">
            <option value="Accounts & Finance">Accounts & Finance (CFO)</option>
            <option value="Head of Department">Head of Department (Dilip Roy)</option>
            <option value="Secretary General">Secretary General (SG)</option>
            <option value="President of DCCI">President of DCCI</option>
            <option value="Legal Cell">Legal Cell</option>
            <option value="Internal Audit Cell">Internal Audit Cell</option>
            <option value="Checker (Officer IT)">Checker (Officer IT)</option>
          </select>
          <label class="form-label small fw-bold text-dark">Review Instructions / Note (নোট বা পরামর্শ):</label>
          <textarea id="swal-review-notes" class="form-control form-control-sm" rows="3" placeholder="Specify review remarks or queries...">${actionComments || ''}</textarea>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Send for Review',
      confirmButtonColor: '#0d6efd',
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        const targetRole = document.getElementById('swal-target-role').value;
        const reviewNotes = document.getElementById('swal-review-notes').value;
        return { targetRole, reviewNotes };
      }
    });

    if (formValues) {
      await handleExecuteAction('Review', formValues.targetRole, formValues.reviewNotes);
    }
  };

  const handleExecuteAction = async (actionType, targetRole = null, customComments = null) => {
    const finalComments = customComments !== null ? customComments : actionComments;

    if (actionType !== 'Clarify' && !isMyTurnToAct(actingRole, selectedCase.TaskName)) {
      Swal.fire({
        icon: 'warning',
        title: 'Desk Custody Lock',
        text: `This file is currently pending at "${selectedCase.TaskName}". You cannot take action while it is at another desk.`
      });
      return;
    }

    if ((actionType === 'Query' || actionType === 'Reject' || actionType === 'Clarify') && !finalComments.trim()) {
      Swal.fire('Comments Required', `Please write remarks or clarification details before submitting.`, 'warning');
      return;
    }

    if (actionType !== 'Review') {
      let confirmText = `Are you sure you want to perform "${actionType}" on Application #${selectedCase.AppId}?`;
      if (actionType === 'Approve') {
        if (selectedCase?.TaskName?.toLowerCase().startsWith('review')) {
          const lastReviewAction = [...actionHistory].reverse().find(a => a.ActionType === 'Review');
          const returnRole = lastReviewAction?.FromRole || 'Calling Authority';
          confirmText = `Submit your review observations and return Application #${selectedCase.AppId} to ${returnRole}?`;
        } else {
          const destText = 
            actingRole === 'Head of Department' ? 'Accounts & Finance (CFO)' :
            actingRole === 'Accounts & Finance' ? 'Secretary General (SG)' :
            actingRole === 'Secretary General' ? 'President of DCCI' :
            actingRole === 'President' ? 'Final Completion (চূড়ান্ত অনুমোদন)' : 'Next Stage';
          confirmText = `Approve Application #${selectedCase.AppId} and forward to ${destText}?`;
        }
      }

      const confirm = await Swal.fire({
        title: actionType === 'Clarify' ? 'Submit Clarification?' : (selectedCase?.TaskName?.toLowerCase().startsWith('review') && actionType === 'Approve') ? 'Return Review Feedback?' : actionType === 'Approve' && actingRole === 'President' ? 'Final Approval?' : `${actionType} Application?`,
        text: actionType === 'Clarify' 
          ? `Submit your written explanation for Application #${selectedCase.AppId} and return to Approver?`
          : confirmText,
        icon: actionType === 'Reject' ? 'warning' : actionType === 'Clarify' ? 'info' : 'question',
        showCancelButton: true,
        confirmButtonColor: actionType === 'Reject' ? '#dc3545' : actionType === 'Query' ? '#ffc107' : '#198754',
        confirmButtonText: actionType === 'Clarify' ? 'Yes, Submit Clarification' : `Yes, ${actionType}`
      });

      if (!confirm.isConfirmed) return;
    }

    try {
      setIsActing(true);
      const performer = actionType === 'Clarify' ? (selectedCase.Initiator || 'Md. Arman Hossen') : actingUser;
      const perfRole = actionType === 'Clarify' ? (selectedCase.Designation || 'Senior Officer (Initiator)') : actingRole;

      const res = await Api.post('/Workflow/ExecuteAction', {
        AppId: selectedCase.AppId,
        Action: actionType,
        PerformedBy: performer,
        Role: perfRole,
        Comments: finalComments,
        TargetRole: targetRole
      });

      if (res.data.status) {
        const nextInfo = res.data?.data?.NewTaskName ? ` (Next Desk: ${res.data.data.NewTaskName})` : '';
        let successTitle = 'Approved & Forwarded!';
        if (actionType === 'Clarify') {
          successTitle = 'Clarification Submitted!';
        } else if (actionType === 'Review') {
          successTitle = 'Forwarded for Review!';
        } else if (selectedCase?.TaskName?.toLowerCase().startsWith('review')) {
          successTitle = `Review Feedback Returned to ${res.data?.data?.NewTaskName || 'Calling Authority'}!`;
        } else if (actionType === 'Approve' && actingRole === 'President') {
          successTitle = 'Approved & Completed!';
        }

        Swal.fire({
          icon: 'success',
          title: successTitle,
          text: (res.data.message || '') + nextInfo,
          timer: 2400,
          showConfirmButton: false
        });
        setActionComments('');
        // Refresh details and cases
        const updatedRes = await Api.get(`/Workflow/GetCaseById?appId=${selectedCase.AppId}`);
        if (updatedRes.data.status && updatedRes.data.data) {
          setSelectedCase(updatedRes.data.data);
        }
        loadCases();
        loadBucketCounts();
        loadActionHistory(selectedCase.AppId);
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setIsActing(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newApp.Subject.trim() || !newApp.FileName.trim()) {
      Swal.fire('Validation', 'Subject and File Name are required.', 'warning');
      return;
    }

    try {
      const payload = {
        ...newApp,
        AttachmentsJson: selectedNewAttachments.length > 0 ? JSON.stringify(selectedNewAttachments) : null
      };
      const res = await Api.post('/Workflow/CreateApplication', payload);
      if (res.data.status) {
        Swal.fire({
          icon: 'success',
          title: 'Proposal Submitted!',
          text: `Application ID #${res.data.data} created with ${selectedNewAttachments.length} linked attachment(s) and routed to Head of Department for review.`,
          timer: 2200,
          showConfirmButton: false
        });
        setShowCreateModal(false);
        setSelectedNewAttachments([]);
        setShowAttachmentPicker(false);
        setNewApp({
          ProcessName: 'DCCI- Pre-Approval',
          Initiator: 'Md. Arman Hossen',
          Designation: 'Senior Officer',
          DepartmentName: 'Information and Technology',
          OfficeName: 'DCCI HQ',
          FileName: '',
          FileNumber: '',
          NoteNumber: '',
          Priority: 'Medium',
          Subject: '',
          Description: '',
          QuotationType: 'RFQ',
          EstimatedCost: 0,
          HasChecker: false,
          IsVatTaxApplicable: true
        });
        loadCases();
        loadBucketCounts();
        loadEdmsDocuments();
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  // Approval Chain Stages
  const approvalStages = [
    { title: 'Initiator', role: 'Created' },
    { title: 'Checker', role: 'Technical Check' },
    { title: 'HOD', role: 'Head of Dept' },
    { title: 'Accounts', role: 'Accounts & Finance' },
    { title: 'Secretary General', role: 'SG Review' },
    { title: 'President', role: 'President Approval' },
    { title: 'Complete', role: 'Action Complete' }
  ];

  const getActiveStageIndex = (c) => {
    if (!c) return 0;
    if (c.AppStatus === 'Complete') return 6;
    if (c.TaskName?.includes('President')) return 5;
    if (c.TaskName?.includes('Secretary General')) return 4;
    if (c.TaskName?.includes('Accounts')) return 3;
    if (c.TaskName?.includes('Head of Department')) return 2;
    if (c.TaskName?.includes('Checker')) return 1;
    return 0;
  };

  return (
    <div className="d-flex h-100">
      
      {/* Left Sidebar Case Buckets (Matches Dilip demo exact layout) */}
      <div className="tree-sidebar d-flex flex-column justify-content-between" style={{ width: '270px', flexShrink: 0 }}>
        <div>
          {currentUser?.role === 'Initiator' ? (
            <button 
              className="btn btn-success w-100 mb-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={18} /> New Application
            </button>
          ) : (
            <button 
              className="btn btn-outline-secondary w-100 mb-3 d-flex align-items-center justify-content-center gap-1 small"
              style={{ opacity: 0.7, cursor: 'not-allowed', fontSize: '0.82rem' }}
              title="নতুন আবেদন শুধুমাত্র Initiator তৈরি করতে পারেন। নতুন আবেদন করতে টপবারে ইনিশিয়েটর নির্বাচন করুন।"
              onClick={() => {
                Swal.fire({
                  icon: 'info',
                  title: 'Initiator Desk Only',
                  text: 'নতুন প্রস্তাবনা বা রিকুইজিশন শুধুমাত্র আবেদনকারী (Initiator) তৈরি করতে পারেন। নতুন আবেদন দাখিল করতে অনুগ্রহ করে টপবারে Initiator (Md. Arman Hossen) ডেস্ক নির্বাচন করুন।'
                });
              }}
            >
              <Plus size={15} /> New Application
              <span className="badge bg-secondary ms-1" style={{ fontSize: '0.62rem' }}>Initiator Only</span>
            </button>
          )}

          <div className="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom">
            <span className="fw-bold text-success small text-uppercase">Workflow Buckets</span>
            <span className="badge bg-light text-dark">{bucketCounts.processStatus} Total</span>
          </div>

          <div className="d-flex flex-column gap-1">
            {[
              { name: 'Inbox', count: bucketCounts.inbox, icon: <Inbox size={15} />, color: 'primary' },
              { name: 'Draft', count: bucketCounts.draft, icon: <FileEdit size={15} />, color: 'secondary' },
              { name: 'Query', count: bucketCounts.query, icon: <HelpCircle size={15} />, color: 'warning' },
              { name: 'Risk', count: bucketCounts.risk, icon: <AlertTriangle size={15} />, color: 'danger' },
              { name: 'OverDue', count: bucketCounts.overDue, icon: <Clock size={15} />, color: 'danger' },
              { name: 'Process Status', count: bucketCounts.processStatus, icon: <CheckCircle size={15} />, color: 'success' }
            ].map((item) => {
              const isActive = activeBucket === item.name;
              return (
                <div
                  key={item.name}
                  className={`tree-node justify-content-between ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveBucket(item.name)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="d-flex align-items-center gap-2">
                    {item.icon}
                    <span>{item.name}</span>
                  </div>
                  <span className={`badge ${isActive ? 'bg-success text-white' : item.count > 0 && item.name === 'OverDue' ? 'bg-danger text-white' : 'bg-light text-secondary border'}`}>
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operational Context note */}
        <div className="p-2 rounded bg-light border text-muted small mt-3">
          <small className="d-block fw-bold text-dark mb-1">DCCI SOW Compliance</small>
          <small style={{ fontSize: '0.72rem', lineHeight: '1.3' }}>
            Multi-level dynamic approval chain with sequential routing and digital note sheet history.
          </small>
        </div>
      </div>

      {/* Right Content Area: Cases List */}
      <div className="flex-grow-1 p-3 overflow-y-auto" style={{ height: 'calc(100vh - 60px)' }}>
        
        {/* Top Header & Filter Toolbar */}
        <div className="d-flex align-items-center justify-content-between mb-3 bg-white p-3 rounded shadow-sm border">
          <div>
            <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
              <GitBranch size={20} className="text-success" />
              <span>Participated Cases — {activeBucket}</span>
            </h5>
            <small className="text-muted">
              {cases.length} case{cases.length !== 1 ? 's' : ''} found in this bucket
            </small>
          </div>

          <div className="d-flex align-items-center gap-2">
            <div className="input-group input-group-sm" style={{ width: '280px' }}>
              <span className="input-group-text bg-light border-end-0">
                <Search size={14} className="text-muted" />
              </span>
              <input 
                type="text" 
                className="form-control form-control-sm border-start-0 border-end-0"
                placeholder="Search by APP ID, Document, Subject, Initiator..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="btn btn-sm btn-link bg-white border border-start-0 text-muted px-2 d-flex align-items-center"
                  style={{ textDecoration: 'none' }}
                  title="Clear search"
                  onClick={() => setSearchTerm('')}
                >
                  <X size={14} className="text-secondary" />
                </button>
              )}
            </div>

            <button className="btn btn-sm btn-outline-success d-flex align-items-center gap-1" onClick={() => { loadCases(); loadBucketCounts(); }}>
              <RotateCcw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* DCCI Approval Hierarchy Indicator */}
        <div className="bg-white p-2 px-3 rounded shadow-sm border mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.78rem' }}>
            <span className="text-muted fw-bold">Approval Hierarchy:</span>
            <span className={`badge px-2 py-1 ${currentUser?.role === 'Initiator' ? 'bg-primary' : 'bg-light text-secondary border'}`}>
              ১. Initiator (Arman)
            </span>
            <ChevronRight size={13} className="text-muted" />
            <span 
              className={`badge px-2 py-1 ${currentUser?.role === 'Checker' ? 'text-white' : 'bg-light text-secondary border'}`}
              style={{ backgroundColor: currentUser?.role === 'Checker' ? '#059669' : undefined }}
            >
              Checker (Rahul)
            </span>
            <ChevronRight size={13} className="text-muted" />
            <span className={`badge px-2 py-1 ${currentUser?.role === 'Head of Department' ? 'bg-success' : 'bg-light text-secondary border'}`}>
              ২. HOD (Dilip Roy)
            </span>
            <ChevronRight size={13} className="text-muted" />
            <span className={`badge px-2 py-1 ${currentUser?.role === 'Accounts & Finance' ? 'bg-warning text-dark' : 'bg-light text-secondary border'}`}>
              ৩. Accounts & Finance (CFO)
            </span>
            <ChevronRight size={13} className="text-muted" />
            <span 
              className={`badge px-2 py-1 ${currentUser?.role === 'Secretary General' ? 'text-white' : 'bg-light text-secondary border'}`}
              style={{ backgroundColor: currentUser?.role === 'Secretary General' ? '#7c3aed' : undefined }}
            >
              ৪. Secretary General (SG)
            </span>
            <ChevronRight size={13} className="text-muted" />
            <span className={`badge px-2 py-1 ${currentUser?.role === 'President' ? 'bg-danger' : 'bg-light text-secondary border'}`}>
              ৫. President (চূড়ান্ত অনুমোদন)
            </span>
          </div>

          <div className="d-flex align-items-center gap-1">
            <small className="text-muted" style={{ fontSize: '0.75rem' }}>Active Desk:</small>
            <span className="badge" style={{ backgroundColor: currentUser?.color || '#0b7337', color: '#fff', fontSize: '0.75rem' }}>
              {currentUser?.name || 'Engr. Dilip K Roy'}
            </span>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading cases...</span>
            </div>
            <p className="mt-2 text-muted">Loading workflow cases...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && cases.length === 0 && (
          <div className="text-center py-5 bg-white rounded border p-4">
            <Inbox size={48} className="text-muted mb-2 opacity-50" />
            <h6 className="fw-semibold text-secondary">No cases in {activeBucket}</h6>
            <p className="small text-muted mb-3">You can submit a new proposal or select another bucket from the left sidebar.</p>
            {currentUser?.role === 'Initiator' ? (
              <button className="btn btn-sm btn-success" onClick={() => setShowCreateModal(true)}>
                <Plus size={14} className="me-1" /> New Application
              </button>
            ) : (
              <span className="badge bg-light text-secondary border p-2">
                Switch to Initiator desk to create a new application
              </span>
            )}
          </div>
        )}

        {/* Table of Cases (Dilip demo exact columns) */}
        {!loading && cases.length > 0 && (
          <div className="table-responsive bg-white rounded border shadow-sm">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small text-uppercase text-secondary">
                <tr>
                  <th style={{ width: '120px' }}>APP ID</th>
                  <th>DOCUMENT NAME</th>
                  <th>PROCESS NAME</th>
                  <th>CURRENT TASK / DESK</th>
                  <th>STATUS</th>
                  <th>SENT BY</th>
                  <th>INITIATOR</th>
                  <th>LAST MODIFIED</th>
                  <th className="text-end">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const attachments = getParsedAttachments(c);
                  const primaryDocTitle = c.FileName || c.Subject || 'Document';
                  const subText = c.Subject && c.Subject !== c.FileName ? c.Subject : (c.FileNumber ? `File: ${c.FileNumber}` : (attachments[0]?.name || ''));

                  return (
                    <tr key={c.Id} style={{ cursor: 'pointer' }} onClick={() => setSelectedCase(c)}>
                      <td className="fw-bold text-success text-nowrap">#{c.AppId}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2" style={{ minWidth: '200px', maxWidth: '280px' }}>
                          <FileText size={18} className="text-success flex-shrink-0" />
                          <div className="text-truncate">
                            <div className="d-flex align-items-center gap-1">
                              <span className="fw-semibold text-dark text-truncate" title={primaryDocTitle}>
                                {primaryDocTitle}
                              </span>
                              {attachments.length > 0 && (
                                <span 
                                  className="badge bg-light text-secondary border py-0 px-1 d-inline-flex align-items-center flex-shrink-0" 
                                  style={{ fontSize: '10px' }} 
                                  title={`${attachments.length} attachment(s)`}
                                >
                                  <Paperclip size={10} className="me-1" />{attachments.length}
                                </span>
                              )}
                            </div>
                            {subText && (
                              <small className="text-muted text-truncate d-block" style={{ fontSize: '11px' }} title={subText}>
                                {subText}
                              </small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">{c.ProcessName}</span>
                      </td>
                    <td>
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        <span className="fw-semibold text-dark d-flex align-items-center gap-1">
                          <User size={13} className="text-muted" />
                          {c.TaskName}
                        </span>
                        {(() => {
                          const isMyDesk = isMyTurnToAct(currentUser?.role, c.TaskName) || 
                            (currentUser?.role === 'Initiator' && c.AppStatus === 'Query');
                          return isMyDesk ? (
                            <span className="badge bg-warning text-dark border border-warning ms-1" style={{ fontSize: '0.65rem' }}>
                              Pending on Your Desk
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        c.AppStatus === 'Complete' ? 'bg-success' : 
                        c.AppStatus === 'Query' ? 'bg-warning text-dark' : 
                        c.AppStatus === 'Rejected' ? 'bg-danger' : 
                        'bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25'
                      }`}>
                        {c.AppStatus}
                      </span>
                    </td>
                    <td><small className="text-secondary">{c.SentBy || '—'}</small></td>
                    <td><small className="fw-semibold">{c.Initiator}</small></td>
                    <td><small className="text-muted">{c.LastModified}</small></td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="btn btn-sm btn-outline-success py-1 px-2"
                        onClick={() => setSelectedCase(c)}
                        title="Open E-Form Approval Sheet"
                      >
                        <Eye size={14} className="me-1" /> View Sheet
                      </button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Comprehensive E-Form Approval Sheet Modal */}
      {selectedCase && (
        <div 
          className={`modal show d-block ${showPrintModal ? 'd-print-none' : ''}`} 
          tabIndex="-1" 
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1050 }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedCase(null); }}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '94vw', height: '94vh' }}>
            <div className="modal-content h-100 d-flex flex-column border-0 shadow-lg">
              
              {/* Header Bar */}
              <div className="modal-header bg-dark text-white py-2 px-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <GitBranch size={20} className="text-success" />
                  <span className="fw-bold fs-6">E-Form Pre-Approval Sheet</span>
                  <span className="badge bg-success ms-2">APP ID: #{selectedCase.AppId}</span>
                  <span className={`badge ${selectedCase.AppStatus === 'Complete' ? 'bg-success' : selectedCase.AppStatus === 'Query' ? 'bg-warning text-dark' : 'bg-primary'}`}>
                    {selectedCase.AppStatus}
                  </span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button 
                    className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
                    onClick={() => setShowPrintModal(true)}
                    title="Open Official DCCI Note Sheet Print & PDF Preview"
                  >
                    <Printer size={14} /> Official Print Sheet
                  </button>
                  <button 
                    className="btn btn-sm btn-danger d-flex align-items-center gap-1 fw-bold"
                    onClick={() => setSelectedCase(null)}
                    title="Close (Esc)"
                  >
                    <X size={16} /> Close
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-light overflow-y-auto">
                
                {/* Query Alert Notice Banner */}
                {selectedCase.AppStatus === 'Query' && (
                  <div className="alert alert-warning border border-warning d-flex align-items-start gap-3 shadow-sm mb-3">
                    <HelpCircle size={24} className="text-warning flex-shrink-0 mt-1" />
                    <div>
                      <h6 className="fw-bold mb-1 text-dark">Action Required: Query / Clarification Raised by Reviewer</h6>
                      <p className="mb-0 small text-secondary">
                        An official query has been raised by the reviewing authority. Please check the comments in the approval history below, write your response in the <strong>Initiator Response & Clarification Desk</strong>, and submit to re-route for approval.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Visual Approval Chain Progress Stepper */}
                <div className="bg-white p-3 rounded shadow-sm border mb-3">
                  <small className="fw-bold text-muted text-uppercase d-block mb-2">Sequential Approval Chain Progress</small>
                  <div className="d-flex align-items-center justify-content-between position-relative px-2">
                    {approvalStages.map((stage, idx) => {
                      const activeIndex = getActiveStageIndex(selectedCase);
                      const isPassed = idx < activeIndex;
                      const isCurrent = idx === activeIndex;

                      return (
                        <div key={idx} className="d-flex flex-column align-items-center position-relative" style={{ zIndex: 2 }}>
                          <div 
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              background: isPassed ? '#10b981' : isCurrent ? '#0b7337' : '#e5e7eb',
                              color: isPassed || isCurrent ? '#ffffff' : '#6b7280',
                              border: isCurrent ? '3px solid #6ee7b7' : 'none'
                            }}
                          >
                            {isPassed ? <Check size={16} /> : idx + 1}
                          </div>
                          <span className={`small mt-1 text-center ${isCurrent ? 'fw-bold text-success' : 'text-muted'}`} style={{ fontSize: '0.72rem' }}>
                            {stage.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Initiator & Application Information Box */}
                <div className="bg-white p-3 rounded shadow-sm border mb-3">
                  <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
                    <h6 className="fw-bold text-success mb-0">Application Information</h6>
                    <span className="badge bg-light text-dark border">Process: {selectedCase.ProcessName}</span>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-3">
                      <small className="text-muted d-block">Initiator Name:</small>
                      <span className="fw-semibold text-dark">{selectedCase.Initiator}</span>
                    </div>
                    <div className="col-md-3">
                      <small className="text-muted d-block">Designation:</small>
                      <span className="fw-semibold text-dark">{selectedCase.Designation || 'Officer'}</span>
                    </div>
                    <div className="col-md-3">
                      <small className="text-muted d-block">Department Name:</small>
                      <span className="fw-semibold text-dark">{selectedCase.DepartmentName}</span>
                    </div>
                    <div className="col-md-3">
                      <small className="text-muted d-block">Office Name:</small>
                      <span className="fw-semibold text-dark">{selectedCase.OfficeName}</span>
                    </div>

                    <div className="col-md-3">
                      <small className="text-muted d-block">File Name:</small>
                      <span className="fw-semibold text-dark">{selectedCase.FileName || '—'}</span>
                    </div>
                    <div className="col-md-3">
                      <small className="text-muted d-block">File Number:</small>
                      <span className="fw-semibold text-dark">{selectedCase.FileNumber || '—'}</span>
                    </div>
                    <div className="col-md-3">
                      <small className="text-muted d-block">Note Number:</small>
                      <span className="fw-semibold text-dark">{selectedCase.NoteNumber || '—'}</span>
                    </div>
                    <div className="col-md-3">
                      <small className="text-muted d-block">Priority:</small>
                      <span className={`badge ${selectedCase.Priority === 'Urgent' ? 'bg-danger' : selectedCase.Priority === 'High' ? 'bg-warning text-dark' : 'bg-primary'}`}>
                        {selectedCase.Priority}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Proposal Subject & Description (Bangla Unicode Support) */}
                <div className="bg-white p-3 rounded shadow-sm border mb-3">
                  <h6 className="fw-bold text-dark border-bottom pb-2">Subject / প্রস্তাবনার বিষয়:</h6>
                  <p className="fw-semibold text-secondary mb-3">{selectedCase.Subject}</p>

                  <h6 className="fw-bold text-dark border-bottom pb-2">Description & Note Details / বিস্তারিত বিবরণ:</h6>
                  <div className="p-3 bg-light rounded text-dark lh-base" style={{ fontSize: '0.92rem', whiteSpace: 'pre-line' }}>
                    {selectedCase.Description}
                  </div>
                </div>

                {/* Financials & Assessment */}
                <div className="bg-white p-3 rounded shadow-sm border mb-3">
                  <div className="row g-2 align-items-center">
                    <div className="col-md-4">
                      <small className="text-muted d-block">Quotation Type:</small>
                      <span className="badge bg-primary px-3 py-1">{selectedCase.QuotationType}</span>
                    </div>
                    <div className="col-md-4">
                      <small className="text-muted d-block">Estimated Budget / Cost:</small>
                      <span className="fw-bold text-success fs-5">
                        ৳ {Number(selectedCase.EstimatedCost).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="col-md-4">
                      <small className="text-muted d-block">VAT / Tax Applicable:</small>
                      <span className="badge bg-info text-dark px-3 py-1">
                        {selectedCase.IsVatTaxApplicable ? 'Yes (Applicable)' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Linked EDMS Attachments */}
                <div className="bg-white p-3 rounded shadow-sm border mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-1">
                      <Paperclip size={16} className="text-success" />
                      <span>Linked Attachments from EDMS Repository:</span>
                    </h6>
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Click any attachment to open in in-browser Document Viewer
                    </small>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {(() => {
                      let attList = [];
                      if (selectedCase.AttachmentsJson) {
                        try {
                          attList = typeof selectedCase.AttachmentsJson === 'string' 
                            ? JSON.parse(selectedCase.AttachmentsJson) 
                            : selectedCase.AttachmentsJson;
                        } catch (e) {
                          attList = [];
                        }
                      }
                      if (!attList || attList.length === 0) {
                        if (selectedCase.AppId === '7566940683') {
                          attList = [
                            { name: 'Draft_Specifications.pdf', title: 'CCTV Technical Specifications', label: 'Attachment-1 (Specs)' },
                            { name: 'Vendor_Price_Quotation.pdf', title: 'Vendor Price Quotation Comparison', label: 'Attachment-2 (Price Quotation)' }
                          ];
                        }
                      }

                      if (!attList || attList.length === 0) {
                        return <span className="text-muted small fst-italic">No attached documents linked to this case.</span>;
                      }

                      return attList.map((att, idx) => {
                        const linkedDoc = findLinkedDoc(att);
                        const displayVersion = linkedDoc?.Version || att.version || '1.00';
                        const displayDocName = att.title || linkedDoc?.Name || att.name;

                        return (
                          <div
                            key={idx}
                            className="card border shadow-sm p-2 d-flex flex-row align-items-center justify-content-between"
                            style={{ 
                              minWidth: '330px', 
                              maxWidth: '480px',
                              backgroundColor: '#ffffff',
                              borderRadius: '8px',
                              borderColor: '#cbd5e1',
                              transition: 'all 0.15s ease-in-out' 
                            }}
                          >
                            <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                              <div className="bg-light p-2 rounded text-danger border flex-shrink-0">
                                <FileText size={20} />
                              </div>
                              <div className="text-truncate">
                                <div className="text-dark fw-bold text-truncate" style={{ fontSize: '0.85rem' }} title={displayDocName}>
                                  {displayDocName}
                                </div>
                                <div className="d-flex align-items-center gap-1 mt-1 text-truncate">
                                  <span className="badge bg-light text-secondary border text-truncate" style={{ fontSize: '0.7rem' }}>
                                    {att.name}
                                  </span>
                                  {att.label && (
                                    <span className="badge bg-light text-primary border" style={{ fontSize: '0.7rem' }}>
                                      {att.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Version Track Badge & Action */}
                            <div className="d-flex flex-column align-items-end gap-1 flex-shrink-0">
                              <span 
                                className="badge bg-success d-flex align-items-center gap-1 px-2 py-1" 
                                style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.3px' }}
                                title={`Document Version in EDMS Repository: v${displayVersion}`}
                              >
                                v{displayVersion}
                              </span>

                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm py-1 px-2 d-flex align-items-center gap-1"
                                style={{ fontSize: '0.75rem', borderRadius: '4px' }}
                                onClick={() => handleOpenAttachment(att)}
                                disabled={loadingAttachment}
                                title="Click to view file & version history in Document Viewer"
                              >
                                <Eye size={13} />
                                <span>Preview</span>
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Approval Comments & Audit Trail Timeline */}
                <div className="bg-white p-3 rounded shadow-sm border mb-3">
                  <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2 border-bottom pb-2">
                    <MessageSquare size={16} className="text-success" />
                    <span>Official Note Sheet & Approval History</span>
                  </h6>

                  {loadingHistory && <div className="text-muted small">Loading approval history...</div>}

                  {!loadingHistory && actionHistory.length === 0 && (
                    <div className="text-muted small fst-italic">No approval notes recorded yet.</div>
                  )}

                  {!loadingHistory && actionHistory.length > 0 && (
                    <div className="d-flex flex-column gap-2">
                      {actionHistory.map((item, idx) => (
                        <div key={idx} className="p-3 rounded border bg-light">
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-bold text-dark">{item.FromUser}</span>
                              <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>{item.FromRole}</span>
                              <span className={`badge ${item.ActionType === 'Approve' ? 'bg-success' : item.ActionType === 'Query' ? 'bg-warning text-dark' : item.ActionType === 'Reject' ? 'bg-danger' : item.ActionType === 'Review' ? 'bg-primary' : 'bg-info text-dark'}`} style={{ fontSize: '0.7rem' }}>
                                {item.ActionType}
                              </span>
                            </div>
                            <small className="text-muted">{item.ActionDate}</small>
                          </div>
                          <p className="small text-secondary mb-0 mt-1" style={{ whiteSpace: 'pre-line' }}>
                            {item.Comments}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 1. Initiator Response & Clarification Desk when AppStatus === 'Query' */}
                {selectedCase.AppStatus === 'Query' && (
                  <div className="bg-white p-3 rounded shadow-sm border border-warning">
                    <div className="d-flex align-items-center justify-content-between mb-2 border-bottom pb-2">
                      <h6 className="fw-bold text-warning-emphasis mb-0 d-flex align-items-center gap-2">
                        <HelpCircle size={18} className="text-warning" />
                        <span>Initiator Response & Clarification Desk ({selectedCase.Initiator})</span>
                      </h6>
                      <span className="badge bg-warning text-dark px-2 py-1">Query Active</span>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-bold">
                        Written Clarification / ব্যাখ্যামূলক জবাব ও সমাধান <span className="text-danger">*</span>:
                      </label>
                      <textarea 
                        rows="3"
                        className="form-control form-control-sm"
                        placeholder="Write your explanation or answer to the approver's query (e.g. Added the requested 3rd price quotation from vendor, verified floor camera maps, and resubmitted)..."
                        value={actionComments}
                        onChange={(e) => setActionComments(e.target.value)}
                        required
                      ></textarea>
                    </div>

                    <div className="d-flex justify-content-end gap-2">
                      <button 
                        type="button" 
                        className="btn btn-warning px-4 d-flex align-items-center gap-2 fw-bold text-dark shadow-sm"
                        onClick={() => handleExecuteAction('Clarify')}
                        disabled={isActing}
                      >
                        <Send size={15} />
                        <span>Submit Clarification & Re-route for Approval</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Live Approver Action Panel (Approve / Query / Forward / Reject) */}
                {selectedCase.AppStatus !== 'Complete' && selectedCase.AppStatus !== 'Rejected' && selectedCase.AppStatus !== 'Query' && (
                  actingRole === 'Initiator' ? (
                    <div className="bg-light p-3 rounded border border-primary border-opacity-25 d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div className="d-flex align-items-center gap-2">
                        <div className="bg-primary bg-opacity-10 text-primary p-2 rounded flex-shrink-0">
                          <Info size={22} />
                        </div>
                        <div>
                          <div className="fw-bold text-dark small">Initiator Desk ({selectedCase.Initiator || 'Md. Arman Hossen'})</div>
                          <div className="text-secondary small" style={{ fontSize: '0.78rem' }}>
                            এই প্রস্তাবনাটি আপনি ইতিমধ্যে দাখিল করেছেন এবং বর্তমানে <strong>{selectedCase.TaskName}</strong> ডেস্কে অনুমোদনাধীন রয়েছে। 
                            প্রশাসনিক নিয়ম অনুযায়ী আবেদনকারী (Initiator) নিজের দাখিলকৃত ফাইলে Reject, Query, Review বা Approve করতে পারেন না।
                          </div>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <small className="text-muted fw-semibold">Switch Desk:</small>
                        <select 
                          className="form-select form-select-sm"
                          style={{ width: '280px', fontWeight: 600 }}
                          value={actingRole}
                          onChange={(e) => {
                            const selRole = e.target.value;
                            setActingRole(selRole);
                            const matched = SYSTEM_USERS.find(usr => usr.role === selRole);
                            if (matched) setActingUser(matched.name);
                          }}
                        >
                          {SYSTEM_USERS.map((u) => (
                            <option key={u.id} value={u.role}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const isCurrentDeskOfficer = isMyTurnToAct(actingRole, selectedCase.TaskName);
                      return (
                        <div className={`p-3 rounded shadow-sm border ${isCurrentDeskOfficer ? 'bg-white border-success border-opacity-50' : 'bg-light border-secondary border-opacity-25'}`}>
                          <div className="d-flex align-items-center justify-content-between mb-2 border-bottom pb-2">
                            <h6 className="fw-bold text-success mb-0 d-flex align-items-center gap-1">
                              <ShieldCheck size={18} /> Approver Action Desk ({selectedCase.TaskName})
                            </h6>
                            <div className="d-flex align-items-center gap-2">
                              <small className="text-muted fw-semibold">Acting Desk:</small>
                              <select 
                                className="form-select form-select-sm"
                                style={{ width: '330px', fontWeight: 600 }}
                                value={actingRole}
                                onChange={(e) => {
                                  const selRole = e.target.value;
                                  setActingRole(selRole);
                                  const matched = SYSTEM_USERS.find(usr => usr.role === selRole);
                                  if (matched) setActingUser(matched.name);
                                }}
                              >
                                {SYSTEM_USERS.map((u) => (
                                  <option key={u.id} value={u.role}>
                                    {u.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {!isCurrentDeskOfficer && (
                            <div className="alert alert-warning py-2 px-3 d-flex align-items-center justify-content-between mb-3 border border-warning">
                              <div className="d-flex align-items-center gap-2">
                                <Clock size={16} className="text-warning-emphasis flex-shrink-0" />
                                <span className="small text-dark">
                                  <strong>ডেস্ক লক (Desk Lock):</strong> নথিটি বর্তমানে <strong>{selectedCase.TaskName}</strong> ডেস্কে অবস্থান করছে। 
                                  অন্য ডেস্কে থাকা অবস্থায় <strong>{actingRole}</strong>-এর জন্য অ্যাকশন বাটনসমূহ নিষ্ক্রিয় (Non-clickable)। নথিটি আপনার ডেস্কে আসলে বা রিভিউতে পাঠালে বাটনগুলো পুনরায় সক্রিয় হবে।
                                </span>
                              </div>
                              <span className="badge bg-warning text-dark flex-shrink-0 ms-2">Read-Only Mode</span>
                            </div>
                          )}

                          <div className="mb-3">
                            <label className="form-label small fw-bold">Official Note / Remarks (নোট বা মন্তব্য):</label>
                            <textarea 
                              rows="2"
                              className="form-control form-control-sm"
                              placeholder={!isCurrentDeskOfficer ? `নথিটি বর্তমানে ${selectedCase.TaskName} ডেস্কে পেন্ডিং। মন্তব্য লেখার অপশন লক করা রয়েছে।` : "Write your approval notes, query clarification, or observations..."}
                              value={actionComments}
                              onChange={(e) => setActionComments(e.target.value)}
                              disabled={!isCurrentDeskOfficer || isActing}
                            ></textarea>
                          </div>

                          <div className="d-flex justify-content-end gap-2 flex-wrap">
                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                              onClick={() => handleExecuteAction('Reject')}
                              disabled={isActing || !isCurrentDeskOfficer}
                              style={!isCurrentDeskOfficer ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                              title={!isCurrentDeskOfficer ? `Pending at ${selectedCase.TaskName}` : "Reject Proposal"}
                            >
                              <X size={14} /> Reject
                            </button>

                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline-warning text-dark d-flex align-items-center gap-1"
                              onClick={() => handleExecuteAction('Query')}
                              disabled={isActing || !isCurrentDeskOfficer}
                              style={!isCurrentDeskOfficer ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                              title={!isCurrentDeskOfficer ? `Pending at ${selectedCase.TaskName}` : "Query / Clarification"}
                            >
                              <HelpCircle size={14} /> Query / Clarification
                            </button>

                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                              onClick={handleReviewAction}
                              disabled={isActing || !isCurrentDeskOfficer}
                              style={!isCurrentDeskOfficer ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                              title={!isCurrentDeskOfficer ? `Pending at ${selectedCase.TaskName}` : "Send for Review"}
                            >
                              <Eye size={14} /> Review
                            </button>

                            <button 
                              type="button" 
                              className={`btn btn-sm ${actingRole === 'President' ? 'btn-danger' : selectedCase?.TaskName?.toLowerCase().startsWith('review') ? 'btn-primary' : 'btn-success'} px-3 d-flex align-items-center gap-1 fw-bold`}
                              onClick={() => handleExecuteAction('Approve')}
                              disabled={isActing || !isCurrentDeskOfficer}
                              style={!isCurrentDeskOfficer ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                              title={!isCurrentDeskOfficer ? `Pending at ${selectedCase.TaskName}. Action disabled.` : `Approve and forward according to DCCI workflow hierarchy`}
                            >
                              {selectedCase?.TaskName?.toLowerCase().startsWith('review') ? (
                                (() => {
                                  const lastRev = [...actionHistory].reverse().find(a => a.ActionType === 'Review');
                                  const returnTo = lastRev?.FromRole || (actingRole === 'Checker' ? 'Head of Department' : 'Secretary General');
                                  return (
                                    <>
                                      <Check size={16} /> Submit Review & Return to {returnTo}
                                    </>
                                  );
                                })()
                              ) : actingRole === 'President' ? (
                                <>
                                  <CheckCircle2 size={16} /> Final Approve & Complete (চূড়ান্ত অনুমোদন)
                                </>
                              ) : actingRole === 'Secretary General' ? (
                                <>
                                  <Check size={16} /> Approve & Forward &rarr; President
                                </>
                              ) : actingRole === 'Accounts & Finance' ? (
                                <>
                                  <Check size={16} /> Approve & Forward &rarr; Secretary General
                                </>
                              ) : actingRole === 'Head of Department' ? (
                                <>
                                  <Check size={16} /> Approve & Forward &rarr; Accounts & Finance
                                </>
                              ) : actingRole === 'Checker' ? (
                                <>
                                  <Check size={16} /> Technical Verification & Forward &rarr; Head of Department
                                </>
                              ) : (
                                <>
                                  <Check size={16} /> Approve & Forward
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  )
                )}

              </div>

              {/* Modal Footer */}
              <div className="modal-footer bg-white py-2 px-3">
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedCase(null)}>Close</button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Create New Application Modal */}
      {showCreateModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <form onSubmit={handleCreateSubmit}>
                
                <div className="modal-header bg-success text-white py-2 px-3">
                  <h6 className="modal-title fw-bold">New Workflow Proposal / Approval Sheet</h6>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowCreateModal(false)}></button>
                </div>

                <div className="modal-body p-4">
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Process Name</label>
                      <select 
                        className="form-select form-select-sm"
                        value={newApp.ProcessName}
                        onChange={(e) => setNewApp({ ...newApp, ProcessName: e.target.value })}
                      >
                        <option value="DCCI- Pre-Approval">DCCI- Pre-Approval</option>
                        <option value="DCCI- Bill-Approval">DCCI- Bill-Approval</option>
                        <option value="Store Requisition">Store Requisition</option>
                        <option value="Car Requisition">Car Requisition</option>
                        <option value="Conveyance">Conveyance Slip</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Priority</label>
                      <select 
                        className="form-select form-select-sm"
                        value={newApp.Priority}
                        onChange={(e) => setNewApp({ ...newApp, Priority: e.target.value })}
                      >
                        <option value="Normal">Normal</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">File Name <span className="text-danger">*</span></label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        placeholder="e.g. IT Equipment Purchase"
                        value={newApp.FileName}
                        onChange={(e) => setNewApp({ ...newApp, FileName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">File Number</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        placeholder="e.g. DCCI/IT/2026/10"
                        value={newApp.FileNumber}
                        onChange={(e) => setNewApp({ ...newApp, FileNumber: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Estimated Cost (BDT)</label>
                      <input 
                        type="number" 
                        className="form-control form-control-sm"
                        value={newApp.EstimatedCost}
                        onChange={(e) => setNewApp({ ...newApp, EstimatedCost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Subject / প্রস্তাবনার বিষয় <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      className="form-control form-control-sm"
                      placeholder="Proposal subject in Bangla or English..."
                      value={newApp.Subject}
                      onChange={(e) => setNewApp({ ...newApp, Subject: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Description / বিস্তারিত নোট ও বিবরণ</label>
                    <textarea 
                      rows="4" 
                      className="form-control form-control-sm"
                      placeholder="Detailed proposal description, justification, and note sheet..."
                      value={newApp.Description}
                      onChange={(e) => setNewApp({ ...newApp, Description: e.target.value })}
                      required
                    ></textarea>
                  </div>

                  {/* Linked EDMS Attachments Section */}
                  <div className="mb-3 p-3 bg-light rounded border">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <label className="form-label small fw-bold mb-0 d-flex align-items-center gap-1 text-dark">
                        <Paperclip size={15} className="text-success" />
                        <span>Link Documents from EDMS Repository ({selectedNewAttachments.length})</span>
                      </label>
                      <button 
                        type="button" 
                        className="btn btn-xs btn-outline-success py-1 px-2 d-flex align-items-center gap-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => setShowAttachmentPicker(!showAttachmentPicker)}
                      >
                        <Plus size={13} />
                        <span>{showAttachmentPicker ? 'Close Picker' : 'Browse Repository'}</span>
                      </button>
                    </div>

                    {/* Selected attachments pills */}
                    {selectedNewAttachments.length === 0 ? (
                      <small className="text-muted fst-italic d-block">
                        No documents attached yet. Click "Browse Repository" to attach quotations, specs, or proposals.
                      </small>
                    ) : (
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        {selectedNewAttachments.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="badge bg-white text-dark border p-2 d-flex align-items-center gap-2 shadow-sm"
                            style={{ fontSize: '0.75rem', fontWeight: 500 }}
                          >
                            <FileText size={14} className="text-danger flex-shrink-0" />
                            <div className="text-start">
                              <span className="fw-bold">{item.title || item.name}</span>
                              <span className="badge bg-success ms-1" style={{ fontSize: '0.65rem' }}>
                                v{item.version || '1.00'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-link text-danger p-0 ms-1"
                              onClick={() => {
                                setSelectedNewAttachments(selectedNewAttachments.filter((_, i) => i !== idx));
                              }}
                              title="Remove attachment"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Collapsible EDMS Repository Document Picker */}
                    {showAttachmentPicker && (
                      <div className="mt-2 p-2 bg-white rounded border shadow-sm">
                        <div className="d-flex align-items-center justify-content-between mb-2 gap-2">
                          <div className="input-group input-group-sm">
                            <span className="input-group-text bg-light"><Search size={13} /></span>
                            <input 
                              type="text" 
                              className="form-control form-control-sm"
                              placeholder="Search documents by name, file no, or tag..."
                              value={pickerSearch}
                              onChange={(e) => setPickerSearch(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.75rem' }}>
                            <thead className="table-light sticky-top">
                              <tr>
                                <th>Select</th>
                                <th>Document Name</th>
                                <th>Department</th>
                                <th>Version</th>
                                <th>Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {edmsDocuments
                                .filter(d => d.IsDeleted === 0)
                                .filter(d => {
                                  if (!pickerSearch.trim()) return true;
                                  const q = pickerSearch.toLowerCase();
                                  return (
                                    (d.Name && d.Name.toLowerCase().includes(q)) ||
                                    (d.OriginalFileName && d.OriginalFileName.toLowerCase().includes(q)) ||
                                    (d.FileNo && d.FileNo.toLowerCase().includes(q)) ||
                                    (d.FolderName && d.FolderName.toLowerCase().includes(q))
                                  );
                                })
                                .map(d => {
                                  const isSelected = selectedNewAttachments.some(a => a.name === d.OriginalFileName || a.title === d.Name);
                                  return (
                                    <tr key={d.Id} className={isSelected ? 'table-success bg-opacity-25' : ''}>
                                      <td style={{ width: '40px' }}>
                                        <input 
                                          type="checkbox" 
                                          className="form-check-input"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedNewAttachments([
                                                ...selectedNewAttachments,
                                                {
                                                  name: d.OriginalFileName,
                                                  title: d.Name,
                                                  label: `Attachment-${selectedNewAttachments.length + 1}`,
                                                  version: d.Version || '1.00',
                                                  docId: d.Id
                                                }
                                              ]);
                                            } else {
                                              setSelectedNewAttachments(selectedNewAttachments.filter(a => a.name !== d.OriginalFileName && a.title !== d.Name));
                                            }
                                          }}
                                        />
                                      </td>
                                      <td>
                                        <div className="fw-semibold text-dark">{d.Name}</div>
                                        <small className="text-muted">{d.OriginalFileName}</small>
                                      </td>
                                      <td>
                                        <span className="badge bg-light text-secondary border">{d.FolderName || 'IT'}</span>
                                      </td>
                                      <td>
                                        <span className="badge bg-success" style={{ fontSize: '0.68rem' }}>v{d.Version || '1.00'}</span>
                                      </td>
                                      <td>
                                        <span className="badge bg-primary-subtle text-primary border">{d.DocumentType || 'WORK ORDER'}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer bg-light py-2">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-sm btn-success px-4 fw-bold">Submit for Approval</button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

      {/* In-Browser Document Viewer Modal for Case Attachments */}
      {viewingAttachmentDoc && (
        <DocumentViewerModal 
          doc={viewingAttachmentDoc} 
          readOnly={true}
          onClose={() => {
            setViewingAttachmentDoc(null);
            loadEdmsDocuments();
          }} 
          onRefresh={() => {
            loadEdmsDocuments();
          }}
          zIndex={1065}
        />
      )}

      {/* Official DCCI Note Sheet Print & PDF Preview Modal */}
      {showPrintModal && selectedCase && (
        <DcciNoteSheetPrint
          caseData={selectedCase}
          actionHistory={actionHistory}
          attachments={getParsedAttachments(selectedCase)}
          onClose={() => setShowPrintModal(false)}
        />
      )}

    </div>
  );
}
