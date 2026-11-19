# DCCI EDMS (Electronic Document Management System) & Workflow Prototype

A dedicated standalone implementation of the **DCCI EDMS & Workflow System** built at `D:\KIRON\DCCI_EDMS`.
Built to 1:1 match the live production screens demonstrated by **Engr. Dilip K Roy** and the SRS specifications.

---

## Architecture & Tech Stack (Option A)

- **Backend (`/edms_api`)**:
  - ASP.NET Core Web API targeting **.NET 8.0** (`net8.0`).
  - Architecture: Controller pattern with Dapper and SQLite.
  - Follows DCCI ERP API rules: all GET methods return `Task<ApiResponse<List<object>>>` with `conn.QueryAsync<object>`.
  - Configured for multi-file multipart uploads up to **200 MB** per file.
  - Auto-initializes SQLite database (`edms.db`) and seeds DCCI departments & sample documents.
  - Swagger UI available at `http://localhost:5162/swagger`.

- **Frontend (`/edms_react`)**:
  - React 18 with Vite, Bootstrap 5, Lucide Icons, and Axios.
  - Runs on `http://localhost:3000`.

---

## Implemented Screens & Features

1. **Document Explorer (Tree View)**:
   - DCCI Department Tree: `DCCI` -> `Common Service`, `HR`, `IT`, `PR`, `R&D`, `Security & Safety`.
   - Toggle between **Grid View** (document cards with file type icons, tags, version, share icon) and **Table View**.
   - Filter by Document Type (`WORK ORDER`, `Agreement`, `IT_OFFICE FILE`, etc.) and search.

2. **Standard Upload Dropzone & Metadata Indexing**:
   - Multi-file drag & drop zone supporting files up to 200 MB.
   - Staged files cards with Preview, Remove, and `REMOVE ALL`.
   - Comprehensive metadata indexing form:
     - Document Name
     - Department / Target Folder selection
     - Document Type (`WORK ORDER`, `Agreement`, etc.)
     - Expiry Date & Action Upon Expiry (`NONE`, `Archive`, `Delete`)
     - Supplier / Vendor Name
     - File Number & Note Number
     - Tags (Comma-separated)
     - Sharing Scope (`All Logged in Users`, `Public`, `Groups`)
     - Shareable link generator toggle

3. **Embedded Document Viewer & Inspector Modal**:
   - Embedded preview window with streaming API.
   - Right-side properties sidebar showing full metadata.
   - **Version History Drawer**: Displays version history (`v1.00`, `v2.00`) and includes an inline modal to upload new document versions.
   - Check-Out / Check-In document locking mechanism.
   - Archive / Trash soft-delete and restore.

4. **Event Archive Management (15 Standard Folders)**:
   - Demonstrates the standard event archive structure shown in the meeting:
     - Project: *SAARC Tourism Ministers' Meeting 2025* (`BPC-2026-0011`).
     - 3-step lifecycle: `Initiated` -> `Review` -> `Archived`.
     - 15 standard event subfolders (`01 Proposal`, `02 Approval`, `03 Budget`, etc.) with `REQUIRED` badges for mandatory folders.

5. **Workflow Cases & E-Form Approval Sheet**:
   - Case buckets: `Inbox`, `Draft`, `Query`, `Risk`, `OverDue`, `Process Status (2661)`.
   - Participated Cases table (`APP ID`, `PROCESS NAME`, `TASK`, `STATUS`, `SENT BY`, `INITIATOR`, `LAST MODIFIED`).
   - Interactive **E-Form for Pre-Approval Sheet** pre-populated with the exact CCTV proposal demonstrated by Dilip with attachment links to EDMS files.
   - "New Application" create modal for initiating proposals.

---

## How to Run

### Option 1: 1-Click Launch
Double-click `start_all.bat` in `D:\KIRON\DCCI_EDMS`.

### Option 2: Manual Terminal Commands
- **Backend API**:
  ```powershell
  cd D:\KIRON\DCCI_EDMS\edms_api
  dotnet run --urls "http://localhost:5162"
  ```
- **Frontend UI**:
  ```powershell
  cd D:\KIRON\DCCI_EDMS\edms_react
  npm run dev
  ```
  Then open [http://localhost:3000](http://localhost:3000) in your browser.
