namespace EdmsApi.Models;

public class DocumentItem
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string FileExtension { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public string DocumentType { get; set; } = "WORK ORDER";
    public int DepartmentFolderId { get; set; }
    public string Version { get; set; } = "1.00";
    public bool IsCheckedOut { get; set; } = false;
    public string? CheckedOutBy { get; set; }
    public string? CheckedOutAt { get; set; }
    public string? ExpiryDate { get; set; }
    public string ActionUponExpiry { get; set; } = "NONE";
    public string Tags { get; set; } = string.Empty;
    public string? SupplierName { get; set; }
    public string? FileNo { get; set; }
    public string? NoteNo { get; set; }
    public string? Notes { get; set; }
    public string ShareScope { get; set; } = "All Logged in Users";
    public string? ShareGroups { get; set; }
    public bool IsShareableLinkActive { get; set; } = false;
    public string? ShareableToken { get; set; }
    public string CreatedBy { get; set; } = "DILIP";
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
    public bool IsDeleted { get; set; } = false;
}

public class DocumentVersion
{
    public int Id { get; set; }
    public int DocumentId { get; set; }
    public string VersionNumber { get; set; } = "1.00";
    public string FilePath { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string ChangedBy { get; set; } = "DILIP";
    public string ChangeSummary { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
}

public class DepartmentFolder
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? ParentId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string FolderType { get; set; } = "Department";
    public string? ArchiveProjectCode { get; set; }
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; } = false;
}

public class WorkflowCase
{
    public int Id { get; set; }
    public string AppId { get; set; } = string.Empty;
    public string ProcessName { get; set; } = string.Empty;
    public string TaskName { get; set; } = string.Empty;
    public string AppStatus { get; set; } = "In Progress";
    public string SentBy { get; set; } = string.Empty;
    public string Initiator { get; set; } = string.Empty;
    public string Designation { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public string OfficeName { get; set; } = "DCCI";
    public string? FileName { get; set; }
    public string? FileNumber { get; set; }
    public string? NoteNumber { get; set; }
    public string Priority { get; set; } = "Medium";
    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string QuotationType { get; set; } = "RFQ";
    public decimal EstimatedCost { get; set; } = 0;
    public bool HasChecker { get; set; } = false;
    public bool IsVatTaxApplicable { get; set; } = true;
    public string? AttachmentsJson { get; set; }
    public string LastModified { get; set; } = DateTime.Now.ToString("MMMM dd, yyyy, h:mm tt");
}

public class UpdateMetadataRequest
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string? ExpiryDate { get; set; }
    public string ActionUponExpiry { get; set; } = "NONE";
    public string Tags { get; set; } = string.Empty;
    public string? SupplierName { get; set; }
    public string? FileNo { get; set; }
    public string? NoteNo { get; set; }
    public string? Notes { get; set; }
    public string ShareScope { get; set; } = "All Logged in Users";
    public string? ShareGroups { get; set; }
    public bool IsShareableLinkActive { get; set; }
    public int? DepartmentFolderId { get; set; }
}

public class DocumentActivityLog
{
    public int Id { get; set; }
    public int DocumentId { get; set; }
    public string DocumentName { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty; // "UPLOAD", "VIEW", "DOWNLOAD", "NEW_VERSION", "CHECKOUT", "CHECKIN", "TRASH", "RESTORE", "UPDATE_META", "SHARE_LINK_TOGGLE"
    public string PerformedBy { get; set; } = string.Empty;
    public string UserRole { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? Details { get; set; }
    public string CreatedAt { get; set; } = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
}

public class RecordActivityRequest
{
    public int DocumentId { get; set; }
    public string DocumentName { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string PerformedBy { get; set; } = "Engr. Dilip K Roy";
    public string UserRole { get; set; } = "Head of IT";
    public string? IpAddress { get; set; }
    public string? Details { get; set; }
}
