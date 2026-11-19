using Dapper;
using Microsoft.Data.Sqlite;
using EdmsApi.Models;

namespace EdmsApi.Data;

public static class DbInitializer
{
    public static void Initialize(string connectionString, string webRootPath)
    {
        using var conn = new SqliteConnection(connectionString);
        conn.Open();

        // 1. Create Tables
        conn.Execute(@"
            CREATE TABLE IF NOT EXISTS DepartmentFolders (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                ParentId INTEGER NULL,
                Code TEXT NOT NULL,
                FolderType TEXT NOT NULL,
                ArchiveProjectCode TEXT NULL,
                SortOrder INTEGER NOT NULL,
                IsRequired INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS Documents (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                OriginalFileName TEXT NOT NULL,
                FilePath TEXT NOT NULL,
                FileExtension TEXT NOT NULL,
                FileSizeBytes INTEGER NOT NULL,
                ContentType TEXT NOT NULL,
                DocumentType TEXT NOT NULL,
                DepartmentFolderId INTEGER NOT NULL,
                Version TEXT NOT NULL DEFAULT '1.00',
                IsCheckedOut INTEGER NOT NULL DEFAULT 0,
                CheckedOutBy TEXT NULL,
                CheckedOutAt TEXT NULL,
                ExpiryDate TEXT NULL,
                ActionUponExpiry TEXT NOT NULL DEFAULT 'NONE',
                Tags TEXT NOT NULL DEFAULT '',
                SupplierName TEXT NULL,
                FileNo TEXT NULL,
                NoteNo TEXT NULL,
                Notes TEXT NULL,
                ShareScope TEXT NOT NULL DEFAULT 'All Logged in Users',
                ShareGroups TEXT NULL,
                IsShareableLinkActive INTEGER NOT NULL DEFAULT 0,
                ShareableToken TEXT NULL,
                CreatedBy TEXT NOT NULL DEFAULT 'DILIP',
                CreatedAt TEXT NOT NULL,
                IsDeleted INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS DocumentVersions (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                DocumentId INTEGER NOT NULL,
                VersionNumber TEXT NOT NULL,
                FilePath TEXT NOT NULL,
                FileSizeBytes INTEGER NOT NULL,
                ChangedBy TEXT NOT NULL,
                ChangeSummary TEXT NOT NULL,
                CreatedAt TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS WorkflowCases (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                AppId TEXT NOT NULL,
                ProcessName TEXT NOT NULL,
                TaskName TEXT NOT NULL,
                AppStatus TEXT NOT NULL,
                SentBy TEXT NOT NULL,
                Initiator TEXT NOT NULL,
                Designation TEXT NOT NULL,
                DepartmentName TEXT NOT NULL,
                OfficeName TEXT NOT NULL,
                FileName TEXT NULL,
                FileNumber TEXT NULL,
                NoteNumber TEXT NULL,
                Priority TEXT NOT NULL,
                Subject TEXT NOT NULL,
                Description TEXT NOT NULL,
                QuotationType TEXT NOT NULL,
                EstimatedCost NUMERIC NOT NULL DEFAULT 0,
                HasChecker INTEGER NOT NULL DEFAULT 0,
                IsVatTaxApplicable INTEGER NOT NULL DEFAULT 1,
                AttachmentsJson TEXT NULL,
                LastModified TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS WorkflowActionHistory (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                CaseAppId TEXT NOT NULL,
                ActionType TEXT NOT NULL,
                FromUser TEXT NOT NULL,
                FromRole TEXT NOT NULL,
                Comments TEXT NOT NULL,
                ActionDate TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS DocumentActivityLogs (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                DocumentId INTEGER NOT NULL,
                DocumentName TEXT NOT NULL,
                ActionType TEXT NOT NULL,
                PerformedBy TEXT NOT NULL,
                UserRole TEXT NOT NULL,
                IpAddress TEXT NULL,
                Details TEXT NULL,
                CreatedAt TEXT NOT NULL
            );
        ");

        // 2. Cleanup non-DCCI event archive mockups and reassign any files to IT
        conn.Execute("UPDATE Documents SET DepartmentFolderId = 4 WHERE DepartmentFolderId IN (SELECT Id FROM DepartmentFolders WHERE FolderType IN ('ArchiveProject', 'ArchiveSubfolder'));");
        conn.Execute("DELETE FROM DepartmentFolders WHERE FolderType IN ('ArchiveProject', 'ArchiveSubfolder') OR Code LIKE 'BPC%';");
        conn.Execute("INSERT OR IGNORE INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired) SELECT 'Administration', 1, 'ADMIN', 'Department', 7, 0 WHERE NOT EXISTS (SELECT 1 FROM DepartmentFolders WHERE Code = 'ADMIN');");
        conn.Execute("INSERT OR IGNORE INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired) SELECT 'Accounts & Finance', 1, 'ACC', 'Department', 8, 0 WHERE NOT EXISTS (SELECT 1 FROM DepartmentFolders WHERE Code = 'ACC');");

        // Seed Standard Department Sub-Folders (Loophole 5)
        conn.Execute(@"
            INSERT OR IGNORE INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired) 
            SELECT '2026 Projects', 4, 'IT-2026', 'Subfolder', 1, 0 
            WHERE NOT EXISTS (SELECT 1 FROM DepartmentFolders WHERE Code = 'IT-2026');
        ");
        var it2026Id = conn.ExecuteScalar<int>("SELECT Id FROM DepartmentFolders WHERE Code = 'IT-2026'");
        if (it2026Id > 0)
        {
            conn.Execute(@"
                INSERT OR IGNORE INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired) 
                SELECT 'CCTV & Surveillance System', @ParentId, 'IT-CCTV', 'Subfolder', 1, 0 
                WHERE NOT EXISTS (SELECT 1 FROM DepartmentFolders WHERE Code = 'IT-CCTV');

                INSERT OR IGNORE INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired) 
                SELECT 'Network & Hardware Infrastructure', @ParentId, 'IT-NET', 'Subfolder', 2, 0 
                WHERE NOT EXISTS (SELECT 1 FROM DepartmentFolders WHERE Code = 'IT-NET');

                INSERT OR IGNORE INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired) 
                SELECT 'Software & Subscriptions', @ParentId, 'IT-SW', 'Subfolder', 3, 0 
                WHERE NOT EXISTS (SELECT 1 FROM DepartmentFolders WHERE Code = 'IT-SW');
            ", new { ParentId = it2026Id });
        }

        conn.Execute(@"
            INSERT OR IGNORE INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired) 
            SELECT 'Estate & Maintenance', 24, 'ADMIN-EST', 'Subfolder', 1, 0 
            WHERE NOT EXISTS (SELECT 1 FROM DepartmentFolders WHERE Code = 'ADMIN-EST');

            INSERT OR IGNORE INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired) 
            SELECT 'Store & Logistics', 24, 'ADMIN-STR', 'Subfolder', 2, 0 
            WHERE NOT EXISTS (SELECT 1 FROM DepartmentFolders WHERE Code = 'ADMIN-STR');

            INSERT OR IGNORE INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired) 
            SELECT 'Vendor Bills & Invoices', 25, 'ACC-BILLS', 'Subfolder', 1, 0 
            WHERE NOT EXISTS (SELECT 1 FROM DepartmentFolders WHERE Code = 'ACC-BILLS');

            INSERT OR IGNORE INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired) 
            SELECT 'Financial Audit Reports', 25, 'ACC-AUD', 'Subfolder', 2, 0 
            WHERE NOT EXISTS (SELECT 1 FROM DepartmentFolders WHERE Code = 'ACC-AUD');
        ");

        var itCctvId = conn.ExecuteScalar<int>("SELECT Id FROM DepartmentFolders WHERE Code = 'IT-CCTV'");
        if (itCctvId > 0)
        {
            conn.Execute("UPDATE Documents SET DepartmentFolderId = @CctvId WHERE OriginalFileName IN ('Draft_Specifications.pdf', 'Vendor_Price_Quotation.pdf');", new { CctvId = itCctvId });
        }
        var itNetId = conn.ExecuteScalar<int>("SELECT Id FROM DepartmentFolders WHERE Code = 'IT-NET'");
        if (itNetId > 0)
        {
            conn.Execute("UPDATE Documents SET DepartmentFolderId = @NetId WHERE OriginalFileName = 'Router_Switch_WorkOrder.pdf';", new { NetId = itNetId });
        }

        var historyCount = conn.ExecuteScalar<int>("SELECT COUNT(1) FROM WorkflowActionHistory WHERE CaseAppId = '7566940683'");
        if (historyCount == 0)
        {
            conn.Execute(@"
                INSERT INTO WorkflowActionHistory (CaseAppId, ActionType, FromUser, FromRole, Comments, ActionDate)
                VALUES 
                ('7566940683', 'Submitted', 'Md. Arman Hossen', 'Initiator (Senior Officer)', 'Application submitted for security review and CCTV procurement.', 'November 16, 2026, 11:30 AM'),
                ('7566940683', 'Checked', 'Rahul Acharjee', 'Checker (Officer IT)', 'Technical specification and floor map verified. Forwarded to Head of Department.', 'November 17, 2026, 10:52 AM');
            ");
        }

        // Ensure CCTV attachments exist in Documents table
        conn.Execute(@"
            INSERT INTO Documents (
                Name, OriginalFileName, FilePath, FileExtension, FileSizeBytes, ContentType,
                DocumentType, DepartmentFolderId, Version, IsCheckedOut, ExpiryDate,
                ActionUponExpiry, Tags, SupplierName, FileNo, NoteNo, Notes, ShareScope,
                CreatedBy, CreatedAt, IsDeleted
            ) 
            SELECT 
                'CCTV Technical Specifications', 'Draft_Specifications.pdf', '/media/documents/Draft_Specifications.pdf', '.pdf', 102400, 'application/pdf',
                'Proposal', 4, '1.00', 0, '2026-12-31',
                'Archive', 'CCTV, Security, Specs', 'Hikvision & Dahua Partners', 'DCCI/IT/2024/248-1', 'WO-CCTV-01', 'Technical specification and floor locations for 72 CCTV cameras', 'All Logged in Users',
                'DILIP', datetime('now'), 0
            WHERE NOT EXISTS (SELECT 1 FROM Documents WHERE OriginalFileName = 'Draft_Specifications.pdf');

            INSERT INTO Documents (
                Name, OriginalFileName, FilePath, FileExtension, FileSizeBytes, ContentType,
                DocumentType, DepartmentFolderId, Version, IsCheckedOut, ExpiryDate,
                ActionUponExpiry, Tags, SupplierName, FileNo, NoteNo, Notes, ShareScope,
                CreatedBy, CreatedAt, IsDeleted
            ) 
            SELECT 
                'Vendor Price Quotation Comparison', 'Vendor_Price_Quotation.pdf', '/media/documents/Vendor_Price_Quotation.pdf', '.pdf', 102400, 'application/pdf',
                'WORK ORDER', 4, '1.00', 0, '2026-12-31',
                'Archive', 'Quotation, Pricing, Vendor', 'Hikvision & Dahua Partners', 'DCCI/IT/2024/248-1-Q', 'WO-CCTV-02', 'Comparative quotation from 3 qualified vendors', 'All Logged in Users',
                'DILIP', datetime('now'), 0
            WHERE NOT EXISTS (SELECT 1 FROM Documents WHERE OriginalFileName = 'Vendor_Price_Quotation.pdf' OR Name = 'Vendor Price Quotation Comparison');

            -- Cleanup duplicate v1.00 entry if v3.00 exists
            DELETE FROM Documents 
            WHERE Name = 'Vendor Price Quotation Comparison' 
              AND Version = '1.00' 
              AND EXISTS (SELECT 1 FROM Documents WHERE Name = 'Vendor Price Quotation Comparison' AND Version = '3.00');

            UPDATE Documents 
            SET OriginalFileName = 'Vendor_Price_Quotation.pdf' 
            WHERE Name = 'Vendor Price Quotation Comparison' AND Version = '3.00';

            UPDATE WorkflowCases 
            SET AttachmentsJson = '[{""name"":""Draft_Specifications.pdf"",""title"":""CCTV Technical Specifications"",""label"":""Attachment-1 (Specs)""},{""name"":""Vendor_Price_Quotation.pdf"",""title"":""Vendor Price Quotation Comparison"",""label"":""Attachment-2 (Price Quotation)""}]'
            WHERE AppId = '7566940683';
        ");

        // Seed Initial Document Activity Logs (Loophole 6)
        var logCount = conn.ExecuteScalar<int>("SELECT COUNT(1) FROM DocumentActivityLogs");
        if (logCount == 0)
        {
            conn.Execute(@"
                INSERT INTO DocumentActivityLogs (DocumentId, DocumentName, ActionType, PerformedBy, UserRole, IpAddress, Details, CreatedAt)
                VALUES 
                (10, 'CCTV Technical Specifications', 'UPLOAD', 'Engr. Dilip K Roy', 'Head of IT', '192.168.10.45', 'Initial technical specification uploaded to repository (v1.00)', '2026-11-16 10:15:00'),
                (10, 'CCTV Technical Specifications', 'VIEW', 'Md. Arman Hossen', 'Senior Officer', '192.168.10.60', 'Document inspected and verified for CCTV NVR procurement proposal', '2026-11-16 11:10:00'),
                (10, 'CCTV Technical Specifications', 'WORKFLOW_ATTACH', 'Md. Arman Hossen', 'Senior Officer', '192.168.10.60', 'Linked as Attachment-1 to Pre-Approval Workflow Case #7566940683', '2026-11-16 11:30:00'),
                (10, 'CCTV Technical Specifications', 'VIEW', 'Rahul Acharjee', 'Checker (Officer IT)', '192.168.10.72', 'Technical specification reviewed during workflow check', '2026-11-17 10:50:00'),
                (11, 'Vendor Price Quotation Comparison', 'UPLOAD', 'Engr. Dilip K Roy', 'Head of IT', '192.168.10.45', 'Initial vendor comparative statement uploaded (v1.00)', '2026-11-16 10:30:00'),
                (11, 'Vendor Price Quotation Comparison', 'WORKFLOW_ATTACH', 'Md. Arman Hossen', 'Senior Officer', '192.168.10.60', 'Linked as Attachment-2 to Pre-Approval Workflow Case #7566940683', '2026-11-16 11:30:00'),
                (11, 'Vendor Price Quotation Comparison', 'NEW_VERSION', 'Engr. Dilip K Roy', 'Head of IT', '192.168.10.45', 'Updated to version v3.00 with finalized commercial rates from Hikvision & Dahua Partners', '2026-11-19 06:44:40'),
                (11, 'Vendor Price Quotation Comparison', 'DOWNLOAD', 'Md. Arman Hossen', 'Senior Officer', '192.168.10.60', 'Downloaded for audit records and accounts requisition sheet', '2026-11-19 09:20:00');
            ");
        }

        var folderCount = conn.ExecuteScalar<int>("SELECT COUNT(1) FROM DepartmentFolders WHERE FolderType = 'Department'");
        if (folderCount == 0)
        {
            // Root DCCI
            int rootId = conn.QuerySingle<int>(@"
                INSERT INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired)
                VALUES ('DCCI', NULL, 'DCCI', 'Root', 1, 0);
                SELECT last_insert_rowid();
            ");

            // Official DCCI Departments from SOW & Dilip's demo
            int itDeptId = 0;
            var depts = new[]
            {
                ("Common Service", "CS", 1),
                ("Human Resource Department", "HR", 2),
                ("Information and Technology", "IT", 3),
                ("PR", "PR", 4),
                ("Research and Development", "RND", 5),
                ("Security and Safety", "SEC", 6),
                ("Administration", "ADMIN", 7),
                ("Accounts & Finance", "ACC", 8)
            };

            foreach (var (name, code, sort) in depts)
            {
                int deptId = conn.QuerySingle<int>(@"
                    INSERT INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired)
                    VALUES (@Name, @ParentId, @Code, 'Department', @SortOrder, 0);
                    SELECT last_insert_rowid();
                ", new { Name = name, ParentId = rootId, Code = code, SortOrder = sort });

                if (code == "IT") itDeptId = deptId;
            }

            // Seed sample files into IT Department (matching Dilip's demo!)
            var sampleDocs = new[]
            {
                ("SMS Agreement 2025", "SMS_Agreement_2025.pdf", "Agreement", "Software Shop Limited", "SMS, Agreement", "DCCI/IT/2025/08", "PA-7550", "Agreement for push SMS service"),
                ("BDCOM Internet Workorder", "BDCOM_Internet_Workorder.pdf", "WORK ORDER", "BDCOM Online Ltd", "Internet, WorkOrder", "DCCI/IT/2025/12", "WO-101", "Primary optical fiber broadband connection"),
                ("Work Order for Microsoft Office365 for 2025", "Office365_Workorder.pdf", "WORK ORDER", "Flora Telecom", "Microsoft, License", "DCCI/IT/2025/22", "WO-104", "Enterprise E3 licenses for staff"),
                ("Work Order Router Switch Master", "Router_Switch_WorkOrder.pdf", "WORK ORDER", "Smart Technologies", "Hardware, Switch", "DCCI/IT/2024/99", "WO-089", "Core network switches for 4th floor"),
                ("Canon NPG 51 Drum Unit", "Canon_Drum_Unit.pdf", "WORK ORDER", "Canon Bangladesh", "Photocopier, Maintenance", "DCCI/IT/2024/77", "WO-071", "Spare drum units for copier")
            };

            var storageDir = Path.Combine(webRootPath, "media", "documents");
            Directory.CreateDirectory(storageDir);

            foreach (var doc in sampleDocs)
            {
                var dummyPath = Path.Combine(storageDir, doc.Item2);
                if (!File.Exists(dummyPath))
                {
                    // Create a valid mini PDF placeholder if needed
                    File.WriteAllText(dummyPath, "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000108 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF");
                }

                int docId = conn.QuerySingle<int>(@"
                    INSERT INTO Documents (
                        Name, OriginalFileName, FilePath, FileExtension, FileSizeBytes, ContentType,
                        DocumentType, DepartmentFolderId, Version, IsCheckedOut, CheckedOutBy, ExpiryDate,
                        ActionUponExpiry, Tags, SupplierName, FileNo, NoteNo, Notes, ShareScope,
                        CreatedBy, CreatedAt, IsDeleted
                    ) VALUES (
                        @Name, @OriginalFileName, @FilePath, @FileExtension, @FileSizeBytes, @ContentType,
                        @DocumentType, @DepartmentFolderId, '1.00', 0, NULL, '2026-12-31',
                        'Archive', @Tags, @SupplierName, @FileNo, @NoteNo, @Notes, 'All Logged in Users',
                        'DILIP', datetime('now'), 0
                    );
                    SELECT last_insert_rowid();
                ", new
                {
                    Name = doc.Item1,
                    OriginalFileName = doc.Item2,
                    FilePath = $"/media/documents/{doc.Item2}",
                    FileExtension = ".pdf",
                    FileSizeBytes = 102400,
                    ContentType = "application/pdf",
                    DocumentType = doc.Item3,
                    DepartmentFolderId = itDeptId,
                    Tags = doc.Item5,
                    SupplierName = doc.Item4,
                    FileNo = doc.Item6,
                    NoteNo = doc.Item7,
                    Notes = doc.Item8
                });

                // Add version 1.00
                conn.Execute(@"
                    INSERT INTO DocumentVersions (DocumentId, VersionNumber, FilePath, FileSizeBytes, ChangedBy, ChangeSummary, CreatedAt)
                    VALUES (@DocumentId, '1.00', @FilePath, @FileSizeBytes, 'DILIP', 'Initial Document Upload', datetime('now'));
                ", new { DocumentId = docId, FilePath = $"/media/documents/{doc.Item2}", FileSizeBytes = 102400 });
            }

            // Seed sample Workflow Case (from Dilip's demo: APP ID 7566940683)
            conn.Execute(@"
                INSERT INTO WorkflowCases (
                    AppId, ProcessName, TaskName, AppStatus, SentBy, Initiator, Designation, DepartmentName,
                    OfficeName, FileName, FileNumber, NoteNumber, Priority, Subject, Description, QuotationType,
                    EstimatedCost, HasChecker, IsVatTaxApplicable, LastModified
                ) VALUES (
                    '7566940683', 'DCCI- Pre-Approval', 'Head of Department', 'In Progress', 'Rahul Acharjee',
                    'Md. Arman Hossen', 'Senior Officer', 'IT', 'DCCI', 'CCTV Access Control', 'DCCI/IT/2024/248-1',
                    'DCCI/IT/2024/248-1 PA44270', 'High',
                    'Proposal for the Purchase and Installation of CCTV Cameras and a 36-Channel NVR for Strengthening the Security System of DCCI Building.',
                    'বর্তমানে DCCI Building-এর নিরাপত্তা ব্যবস্থার আওতায় মোট ৭২টি CCTV Camera স্থাপিত রয়েছে, যা ২(দুই)টি NVR-এর মাধ্যমে পরিচালিত হচ্ছে। অতিরিক্ত IP Camera ও NVR স্থাপনের প্রয়োজনীয় অনুমোদন প্রদান প্রসঙ্গে।',
                    'RFQ', 309500, 1, 1, 'November 17th 2026, 10:52 am'
                ),
                (
                    '1169587939', 'Store Requisition', 'Head of Department', 'In Progress', 'Md. Arman Hossen',
                    'Md. Arman Hossen', 'Senior Officer', 'IT', 'DCCI', 'Stationery Request', 'DCCI/STORE/2026/01',
                    'SR-112', 'Normal', 'Requisition for printer toner and A4 paper', 'General office supplies for IT cell', 'Direct', 15000, 0, 1, 'November 17th 2026, 10:52 am'
                ),
                (
                    '996917717', 'DCCI- Bill-Approval', 'Head of Department', 'In Progress', 'Md. Abu Nawim',
                    'Nurul Amin sabbir', 'Executive', 'Admin', 'DCCI', 'Monthly Internet Bill', 'DCCI/FIN/2026/89',
                    'BA-991', 'High', 'Internet service provider payment clearance', 'Payment of primary ISP bandwidth invoice', 'Invoice', 45000, 1, 1, 'November 16th 2026, 3:24 pm'
                );
            ");

            conn.Execute(@"
                INSERT OR IGNORE INTO WorkflowActionHistory (CaseAppId, ActionType, FromUser, FromRole, Comments, ActionDate)
                VALUES 
                ('7566940683', 'Submitted', 'Md. Arman Hossen', 'Initiator (Senior Officer)', 'Application submitted for security review and CCTV procurement.', 'November 16, 2026, 11:30 AM'),
                ('7566940683', 'Checked', 'Rahul Acharjee', 'Checker (Officer IT)', 'Technical specification and floor map verified. Forwarded to Head of Department.', 'November 17, 2026, 10:52 AM');
            ");
        }
    }
}
