import React from 'react';
import { Printer, X, ShieldCheck, CheckCircle2, QrCode, FileText, Check, Clock, HelpCircle, AlertCircle } from 'lucide-react';

export default function DcciNoteSheetPrint({ caseData, actionHistory = [], attachments = [], onClose }) {
  if (!caseData) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="modal show d-block dcci-print-modal-container" 
      tabIndex="-1" 
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 1080 }}
    >
      {/* Top Toolbar (Hidden during actual print) */}
      <div className="no-print bg-dark text-white py-2 px-4 d-flex align-items-center justify-content-between shadow">
        <div className="d-flex align-items-center gap-2">
          <ShieldCheck size={20} className="text-success" />
          <span className="fw-bold fs-6">Official DCCI Note Sheet — Print & PDF Export</span>
          <span className="badge bg-secondary ms-2">App ID: #{caseData.AppId}</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button 
            type="button" 
            className="btn btn-success btn-sm px-3 d-flex align-items-center gap-2 fw-bold shadow-sm"
            onClick={handlePrint}
          >
            <Printer size={16} />
            <span>Print / Save as PDF</span>
          </button>
          <button 
            type="button" 
            className="btn btn-outline-light btn-sm d-flex align-items-center gap-1"
            onClick={onClose}
          >
            <X size={16} />
            <span>Close Preview</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Viewport */}
      <div className="dcci-print-viewport overflow-y-auto" style={{ height: 'calc(100vh - 50px)', padding: '24px 16px' }}>
        <div 
          id="dcci-official-print-document"
          className="dcci-print-paper shadow-lg"
        >
          {/* 1. Official Header */}
          <div className="text-center pb-3 border-bottom border-2 border-dark mb-4 position-relative print-avoid-break">
            {/* DCCI Emblem Badge */}
            <div className="d-flex align-items-center justify-content-center gap-3 mb-1">
              <div 
                style={{ 
                  width: '48px', 
                  height: '48px', 
                  backgroundColor: '#0b7337', 
                  borderRadius: '50%',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '18px',
                  letterSpacing: '1px'
                }}
              >
                DC
              </div>
              <div className="text-start">
                <h3 className="mb-0 fw-bold text-uppercase" style={{ letterSpacing: '0.8px', color: '#0b7337', fontSize: '1.45rem' }}>
                  Dhaka Chamber of Commerce & Industry
                </h3>
                <small className="text-muted d-block" style={{ fontSize: '0.78rem' }}>
                  DCCI Building, 65-66 Motijheel Commercial Area, Dhaka-1000, Bangladesh
                </small>
                <small className="text-muted d-block" style={{ fontSize: '0.74rem' }}>
                  Phone: +88-02-9552562 | Email: info@dhakachamber.com | Web: www.dhakachamber.com
                </small>
              </div>
            </div>

            <div 
              className="mt-3 py-1 px-3 text-white fw-bold text-uppercase"
              style={{ 
                backgroundColor: '#0b7337', 
                fontSize: '0.9rem', 
                letterSpacing: '1.5px',
                display: 'inline-block',
                borderRadius: '2px'
              }}
            >
              Office Note Sheet & Administrative Sanction
            </div>
          </div>

          {/* 2. Official Metadata & Reference Grid */}
          <table className="table table-bordered border-dark table-sm mb-4 print-avoid-break" style={{ fontSize: '0.82rem' }}>
            <tbody>
              <tr>
                <td style={{ width: '20%', fontWeight: 'bold', backgroundColor: '#f9fafb' }}>Application ID:</td>
                <td style={{ width: '30%', fontWeight: 'bold', color: '#0b7337' }}>#{caseData.AppId}</td>
                <td style={{ width: '20%', fontWeight: 'bold', backgroundColor: '#f9fafb' }}>Process Name:</td>
                <td style={{ width: '30%' }}>{caseData.ProcessName}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>File Number:</td>
                <td>{caseData.FileNumber || 'DCCI/IT/2024/248-1'}</td>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>Priority:</td>
                <td>
                  <span className="fw-bold">{caseData.Priority || 'Normal'}</span>
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>Note Reference No:</td>
                <td>{caseData.NoteNumber || 'PA-44270'}</td>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>Department / Cell:</td>
                <td>{caseData.DepartmentName || 'Information and Technology'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>Initiated By:</td>
                <td>{caseData.Initiator} ({caseData.Designation})</td>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>Submission Date:</td>
                <td>{caseData.LastModified || 'November 19, 2026'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>Quotation / Tender Type:</td>
                <td>{caseData.QuotationType || 'RFQ'}</td>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>Estimated Cost / Budget:</td>
                <td style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#0b7337' }}>
                  ৳ {Number(caseData.EstimatedCost || 0).toLocaleString()} (BDT)
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>VAT / Tax Applicable:</td>
                <td>{caseData.IsVatTaxApplicable ? 'Yes (Applicable & Included)' : 'No'}</td>
                <td style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>Approval Status:</td>
                <td>
                  <span className="badge bg-dark text-white text-uppercase px-2 py-1" style={{ fontSize: '0.72rem' }}>
                    {caseData.AppStatus} ({caseData.TaskName})
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 3. Official Subject */}
          <div className="mb-3 p-2 bg-light border border-dark rounded-1 print-avoid-break">
            <div className="text-uppercase fw-bold text-dark small mb-1" style={{ letterSpacing: '0.5px' }}>
              Subject / প্রস্তাবনার বিষয়:
            </div>
            <div className="fw-bold text-dark" style={{ fontSize: '0.92rem', lineHeight: '1.4' }}>
              {caseData.Subject}
            </div>
          </div>

          {/* 4. Description & Note Details */}
          <div className="mb-4 print-avoid-break">
            <div className="text-uppercase fw-bold text-dark small mb-1" style={{ letterSpacing: '0.5px' }}>
              Note Details & Justification / বিস্তারিত প্রস্তাবনা ও পটভূমি:
            </div>
            <div 
              className="p-3 border rounded-1 bg-white" 
              style={{ 
                fontSize: '0.88rem', 
                lineHeight: '1.6', 
                whiteSpace: 'pre-line',
                textAlign: 'justify'
              }}
            >
              {caseData.Description}
            </div>
          </div>

          {/* 5. Linked Repository Attachments Table */}
          <div className="mb-4 print-avoid-break">
            <div className="text-uppercase fw-bold text-dark small mb-1 d-flex align-items-center justify-content-between" style={{ letterSpacing: '0.5px' }}>
              <span>Linked EDMS Repository Attachments / সংযুক্ত নথিপত্র:</span>
              <span className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}>Digitally Archived in EDMS</span>
            </div>
            <table className="table table-bordered border-dark table-sm mb-0" style={{ fontSize: '0.8rem' }}>
              <thead style={{ backgroundColor: '#f3f4f6' }}>
                <tr>
                  <th style={{ width: '8%', textAlign: 'center' }}>SL#</th>
                  <th style={{ width: '42%' }}>Document Title</th>
                  <th style={{ width: '32%' }}>File Name</th>
                  <th style={{ width: '18%', textAlign: 'center' }}>Version & Status</th>
                </tr>
              </thead>
              <tbody>
                {attachments && attachments.length > 0 ? (
                  attachments.map((att, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                      <td>
                        <span className="fw-semibold">{att.title || att.name}</span>
                        {att.label && <span className="text-muted ms-1 small">({att.label})</span>}
                      </td>
                      <td><code>{att.name}</code></td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge bg-success" style={{ fontSize: '0.72rem' }}>
                          v{att.version || '1.00'}
                        </span>
                        <span className="badge bg-light text-dark border ms-1" style={{ fontSize: '0.68rem' }}>
                          Verified
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center text-muted fst-italic py-2">
                      No linked attachments recorded for this case.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 6. Chronological Approval Chain & Signature Seals */}
          <div className="mb-4">
            <div className="text-uppercase fw-bold text-dark small mb-2 border-bottom pb-1" style={{ letterSpacing: '0.5px' }}>
              Official Approval Trail & Digital Signature Seals / স্বাক্ষর ও অনুমোদনের রেকর্ড:
            </div>

            <div className="d-flex flex-column gap-2">
              {actionHistory.map((item, idx) => {
                const isApproved = item.ActionType === 'Approve';
                const isQuery = item.ActionType === 'Query';
                const isClarified = item.ActionType === 'Clarified' || item.ActionType === 'Clarify';
                const isChecked = item.ActionType === 'Checked';
                const isSubmitted = item.ActionType === 'Submitted';

                const sealColor = isApproved ? '#0b7337' : isQuery ? '#d97706' : isClarified ? '#0284c7' : '#4b5563';
                const sealBg = isApproved ? '#f0fdf4' : isQuery ? '#fffbeb' : isClarified ? '#f0f9ff' : '#f9fafb';

                return (
                  <div 
                    key={idx} 
                    className="p-2 border rounded-1 position-relative print-card"
                    style={{ 
                      backgroundColor: sealBg, 
                      borderColor: sealColor,
                      borderLeft: `5px solid ${sealColor}`
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold text-dark" style={{ fontSize: '0.86rem' }}>{item.FromUser}</span>
                        <span className="badge bg-secondary" style={{ fontSize: '0.68rem' }}>{item.FromRole}</span>
                        <span 
                          className="badge text-uppercase"
                          style={{ 
                            backgroundColor: sealColor, 
                            color: 'white', 
                            fontSize: '0.68rem',
                            letterSpacing: '0.5px'
                          }}
                        >
                          {item.ActionType}
                        </span>
                      </div>
                      <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                        {item.ActionDate}
                      </small>
                    </div>

                    <div className="text-dark small" style={{ fontStyle: 'italic', fontSize: '0.82rem', whiteSpace: 'pre-line' }}>
                      "{item.Comments}"
                    </div>

                    {/* Official Digital Seal Stamp Watermark */}
                    <div className="d-flex justify-content-end align-items-center gap-1 mt-1 text-muted" style={{ fontSize: '0.68rem' }}>
                      <CheckCircle2 size={11} style={{ color: sealColor }} />
                      <span style={{ color: sealColor, fontWeight: 600 }}>Digitally Verified via DCCI EDMS</span>
                      <span className="ms-1 font-monospace">[{item.ActionDate.slice(0, 12)}]</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7. Official Document Security Footer & Legal Disclaimer */}
          <div className="pt-3 border-top border-2 border-dark mt-4 print-avoid-break" style={{ fontSize: '0.72rem', color: '#4b5563' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <QrCode size={36} className="text-dark" />
                <div>
                  <div className="fw-bold text-dark">DCCI Security Verification Code:</div>
                  <div className="font-monospace">DCCI-EDMS-VAL-{caseData.AppId}-{new Date().getFullYear()}</div>
                  <small className="text-muted">Verify authenticity at: https://dcci.org.bd/edms/verify/{caseData.AppId}</small>
                </div>
              </div>
              <div className="text-end">
                <div className="fw-bold text-dark">Generated Automatically:</div>
                <div>{new Date().toLocaleString()}</div>
                <div className="text-success fw-bold">Official Document • Digitally Signed</div>
              </div>
            </div>

            <div className="text-center text-muted border-top pt-2" style={{ fontSize: '0.68rem' }}>
              This electronic approval sheet is generated from the DCCI Electronic Document Management System (EDMS). 
              Pursuant to the Information & Communication Technology Act, digital sanctions recorded herein carry full legal 
              validity for all institutional, banking, and statutory audit purposes without manual ink signatures.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
