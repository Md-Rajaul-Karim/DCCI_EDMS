using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using EdmsApi.Common;
using EdmsApi.Models;

namespace EdmsApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DocumentController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly string _connectionString;

    public DocumentController(IConfiguration config, IWebHostEnvironment env)
    {
        _config = config;
        _env = env;
        _connectionString = _config.GetConnectionString("DefaultConnection") ?? "Data Source=edms.db";
    }

    private async Task LogActivityAsync(
        SqliteConnection conn, 
        int documentId, 
        string documentName, 
        string actionType, 
        string performedBy, 
        string userRole, 
        string? details, 
        string? ipAddress = null)
    {
        try
        {
            var ip = ipAddress ?? HttpContext?.Connection?.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            var user = string.IsNullOrWhiteSpace(performedBy) ? "Engr. Dilip K Roy" : performedBy;
            var role = string.IsNullOrWhiteSpace(userRole) ? "Head of IT" : userRole;
            
            await conn.ExecuteAsync(@"
                INSERT INTO DocumentActivityLogs (DocumentId, DocumentName, ActionType, PerformedBy, UserRole, IpAddress, Details, CreatedAt)
                VALUES (@DocumentId, @DocumentName, @ActionType, @PerformedBy, @UserRole, @IpAddress, @Details, @CreatedAt)
            ", new {
                DocumentId = documentId,
                DocumentName = string.IsNullOrWhiteSpace(documentName) ? "Document" : documentName,
                ActionType = actionType,
                PerformedBy = user,
                UserRole = role,
                IpAddress = ip,
                Details = details,
                CreatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
            });
        }
        catch { /* fail-safe */ }
    }

    // Following DCCI ERP rule: GET method returns Task<ApiResponse<List<object>>>
    [HttpGet("GetActivityLogs")]
    public async Task<ApiResponse<List<object>>> GetActivityLogs([FromQuery] int? documentId = null)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            string sql;
            object param;
            if (documentId.HasValue && documentId.Value > 0)
            {
                sql = "SELECT * FROM DocumentActivityLogs WHERE DocumentId = @DocId ORDER BY Id DESC";
                param = new { DocId = documentId.Value };
            }
            else
            {
                sql = "SELECT * FROM DocumentActivityLogs ORDER BY Id DESC LIMIT 100";
                param = new { };
            }

            var list = (await conn.QueryAsync<object>(sql, param)).ToList();
            return ApiResponse<List<object>>.Success(list);
        }
        catch (Exception ex)
        {
            return ApiResponse<List<object>>.Fail(ex.Message);
        }
    }

    [HttpGet("GetServerNetworkInfo")]
    public ApiResponse<object> GetServerNetworkInfo()
    {
        try
        {
            var hostName = System.Net.Dns.GetHostName();
            var ips = System.Net.Dns.GetHostEntry(hostName).AddressList
                .Where(a => a.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && !System.Net.IPAddress.IsLoopback(a))
                .Select(a => a.ToString())
                .ToList();
            var lanIp = ips.FirstOrDefault() ?? "127.0.0.1";
            return ApiResponse<object>.Success(new { HostName = hostName, LanIp = lanIp, Port = 5162, AllIps = ips });
        }
        catch (Exception ex)
        {
            return ApiResponse<object>.Fail(ex.Message);
        }
    }

    [HttpPost("RecordActivity")]
    public async Task<ApiResponse<bool>> RecordActivity([FromBody] RecordActivityRequest req)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            await LogActivityAsync(
                conn, 
                req.DocumentId, 
                req.DocumentName, 
                req.ActionType, 
                req.PerformedBy, 
                req.UserRole, 
                req.Details, 
                req.IpAddress
            );

            return ApiResponse<bool>.Success(true, "Activity logged");
        }
        catch (Exception ex)
        {
            return ApiResponse<bool>.Fail(ex.Message);
        }
    }

    // Following DCCI ERP rule: GET method returns Task<ApiResponse<List<object>>>
    [HttpGet("GetDocumentList")]
    public async Task<ApiResponse<List<object>>> GetDocumentList(
        [FromQuery] int? folderId = null,
        [FromQuery] string? docType = null,
        [FromQuery] string? search = null,
        [FromQuery] string? supplierName = null,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] bool onlyDeleted = false)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var sql = "";
            if (folderId.HasValue && folderId.Value > 0)
            {
                sql = @"
                    WITH RECURSIVE SubFolderTree AS (
                        SELECT Id FROM DepartmentFolders WHERE Id = @FolderId
                        UNION ALL
                        SELECT f.Id FROM DepartmentFolders f
                        INNER JOIN SubFolderTree sft ON f.ParentId = sft.Id
                    )
                    SELECT d.*, f.Name AS FolderName, f.Code AS FolderCode, f.ArchiveProjectCode,
                           CASE WHEN EXISTS (
                               SELECT 1 FROM WorkflowCases wc 
                               WHERE wc.AppStatus NOT IN ('Complete', 'Rejected') 
                                 AND (
                                   LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.OriginalFileName) || '%'
                                   OR LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.Name) || '%'
                                   OR LOWER(wc.FileName) = LOWER(d.Name)
                                 )
                           ) THEN 1 ELSE 0 END AS IsLockedByWorkflow,
                           (
                               SELECT wc.AppId FROM WorkflowCases wc 
                               WHERE wc.AppStatus NOT IN ('Complete', 'Rejected') 
                                 AND (
                                   LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.OriginalFileName) || '%'
                                   OR LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.Name) || '%'
                                   OR LOWER(wc.FileName) = LOWER(d.Name)
                                 )
                               LIMIT 1
                           ) AS LockedByCaseAppId
                    FROM Documents d
                    LEFT JOIN DepartmentFolders f ON d.DepartmentFolderId = f.Id
                    WHERE d.DepartmentFolderId IN (SELECT Id FROM SubFolderTree)";
            }
            else
            {
                sql = @"
                    SELECT d.*, f.Name AS FolderName, f.Code AS FolderCode, f.ArchiveProjectCode,
                           CASE WHEN EXISTS (
                               SELECT 1 FROM WorkflowCases wc 
                               WHERE wc.AppStatus NOT IN ('Complete', 'Rejected') 
                                 AND (
                                   LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.OriginalFileName) || '%'
                                   OR LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.Name) || '%'
                                   OR LOWER(wc.FileName) = LOWER(d.Name)
                                 )
                           ) THEN 1 ELSE 0 END AS IsLockedByWorkflow,
                           (
                               SELECT wc.AppId FROM WorkflowCases wc 
                               WHERE wc.AppStatus NOT IN ('Complete', 'Rejected') 
                                 AND (
                                   LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.OriginalFileName) || '%'
                                   OR LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.Name) || '%'
                                   OR LOWER(wc.FileName) = LOWER(d.Name)
                                 )
                               LIMIT 1
                           ) AS LockedByCaseAppId
                    FROM Documents d
                    LEFT JOIN DepartmentFolders f ON d.DepartmentFolderId = f.Id
                    WHERE 1=1";
            }

            if (onlyDeleted)
            {
                sql += " AND d.IsDeleted = 1";
            }
            else if (!includeDeleted)
            {
                sql += " AND d.IsDeleted = 0";
            }

            if (!string.IsNullOrEmpty(docType))
            {
                sql += " AND LOWER(d.DocumentType) = LOWER(@DocType)";
            }

            if (!string.IsNullOrEmpty(supplierName))
            {
                sql += " AND LOWER(d.SupplierName) LIKE LOWER('%' || @SupplierName || '%')";
            }

            if (!string.IsNullOrEmpty(search))
            {
                sql += @" AND (
                    LOWER(d.Name) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(d.OriginalFileName) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(d.SupplierName) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(d.DocumentType) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(d.Tags) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(d.FileNo) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(d.NoteNo) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(d.Notes) LIKE LOWER('%' || @Search || '%')
                )";
            }

            sql += " ORDER BY d.Id DESC";

            var rows = await conn.QueryAsync<object>(sql, new
            {
                FolderId = folderId,
                DocType = docType,
                SupplierName = supplierName,
                Search = search,
                IncludeDeleted = includeDeleted ? 1 : 0
            });

            return ApiResponse<List<object>>.Success(rows.AsList(), "Documents retrieved successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<List<object>>.Fail($"Error fetching documents: {ex.Message}");
        }
    }

    [HttpGet("GetArchiveStats")]
    public async Task<ApiResponse<object>> GetArchiveStats([FromQuery] int? folderId = null)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            string activeSql;
            string archivedSql;

            if (folderId.HasValue && folderId.Value > 0)
            {
                activeSql = @"
                    WITH RECURSIVE SubFolderTree AS (
                        SELECT Id FROM DepartmentFolders WHERE Id = @FolderId
                        UNION ALL
                        SELECT f.Id FROM DepartmentFolders f
                        INNER JOIN SubFolderTree sft ON f.ParentId = sft.Id
                    )
                    SELECT COUNT(1) FROM Documents d 
                    WHERE d.DepartmentFolderId IN (SELECT Id FROM SubFolderTree) AND d.IsDeleted = 0";

                archivedSql = @"
                    WITH RECURSIVE SubFolderTree AS (
                        SELECT Id FROM DepartmentFolders WHERE Id = @FolderId
                        UNION ALL
                        SELECT f.Id FROM DepartmentFolders f
                        INNER JOIN SubFolderTree sft ON f.ParentId = sft.Id
                    )
                    SELECT COUNT(1) FROM Documents d 
                    WHERE d.DepartmentFolderId IN (SELECT Id FROM SubFolderTree) AND d.IsDeleted = 1";
            }
            else
            {
                activeSql = "SELECT COUNT(1) FROM Documents WHERE IsDeleted = 0";
                archivedSql = "SELECT COUNT(1) FROM Documents WHERE IsDeleted = 1";
            }

            var active = await conn.ExecuteScalarAsync<int>(activeSql, new { FolderId = folderId });
            var archived = await conn.ExecuteScalarAsync<int>(archivedSql, new { FolderId = folderId });
            var globalArchived = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Documents WHERE IsDeleted = 1");

            return ApiResponse<object>.Success(new { 
                ActiveCount = active, 
                ArchivedCount = archived,
                GlobalArchivedCount = globalArchived
            });
        }
        catch (Exception ex)
        {
            return ApiResponse<object>.Fail(ex.Message);
        }
    }

    [HttpGet("GetDocumentById")]
    public async Task<ApiResponse<object>> GetDocumentById([FromQuery] int id)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var sql = @"
                SELECT d.*, f.Name AS FolderName, f.Code AS FolderCode,
                       CASE WHEN EXISTS (
                           SELECT 1 FROM WorkflowCases wc 
                           WHERE wc.AppStatus NOT IN ('Complete', 'Rejected') 
                             AND (
                               LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.OriginalFileName) || '%'
                               OR LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.Name) || '%'
                               OR LOWER(wc.FileName) = LOWER(d.Name)
                             )
                       ) THEN 1 ELSE 0 END AS IsLockedByWorkflow,
                       (
                           SELECT wc.AppId FROM WorkflowCases wc 
                           WHERE wc.AppStatus NOT IN ('Complete', 'Rejected') 
                             AND (
                               LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.OriginalFileName) || '%'
                               OR LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.Name) || '%'
                               OR LOWER(wc.FileName) = LOWER(d.Name)
                             )
                           LIMIT 1
                       ) AS LockedByCaseAppId
                FROM Documents d
                LEFT JOIN DepartmentFolders f ON d.DepartmentFolderId = f.Id
                WHERE d.Id = @Id";

            var doc = await conn.QueryFirstOrDefaultAsync<object>(sql, new { Id = id });
            if (doc == null)
            {
                return ApiResponse<object>.Fail("Document not found");
            }

            return ApiResponse<object>.Success(doc);
        }
        catch (Exception ex)
        {
            return ApiResponse<object>.Fail($"Error: {ex.Message}");
        }
    }

    [HttpGet("GetDocumentByName")]
    public async Task<ApiResponse<object>> GetDocumentByName([FromQuery] string name, [FromQuery] string? title = null)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var sql = @"
                SELECT d.*, f.Name AS FolderName, f.Code AS FolderCode,
                       CASE WHEN EXISTS (
                           SELECT 1 FROM WorkflowCases wc 
                           WHERE wc.AppStatus NOT IN ('Complete', 'Rejected') 
                             AND (
                               LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.OriginalFileName) || '%'
                               OR LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.Name) || '%'
                               OR LOWER(wc.FileName) = LOWER(d.Name)
                             )
                       ) THEN 1 ELSE 0 END AS IsLockedByWorkflow,
                       (
                           SELECT wc.AppId FROM WorkflowCases wc 
                           WHERE wc.AppStatus NOT IN ('Complete', 'Rejected') 
                             AND (
                               LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.OriginalFileName) || '%'
                               OR LOWER(wc.AttachmentsJson) LIKE '%' || LOWER(d.Name) || '%'
                               OR LOWER(wc.FileName) = LOWER(d.Name)
                             )
                           LIMIT 1
                       ) AS LockedByCaseAppId
                FROM Documents d
                LEFT JOIN DepartmentFolders f ON d.DepartmentFolderId = f.Id
                WHERE LOWER(d.OriginalFileName) = LOWER(@Name) 
                   OR LOWER(d.Name) = LOWER(@Name)
                   OR (@Title IS NOT NULL AND LOWER(d.Name) = LOWER(@Title))
                   OR LOWER(d.FilePath) LIKE '%' || LOWER(@Name) || '%'
                ORDER BY d.Id DESC
                LIMIT 1";

            var doc = await conn.QueryFirstOrDefaultAsync<object>(sql, new { Name = name, Title = title });
            if (doc == null)
            {
                return ApiResponse<object>.Fail("Document not found");
            }

            return ApiResponse<object>.Success(doc);
        }
        catch (Exception ex)
        {
            return ApiResponse<object>.Fail($"Error: {ex.Message}");
        }
    }

    [HttpGet("GetVersions")]
    public async Task<ApiResponse<List<object>>> GetVersions([FromQuery] int documentId)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var sql = "SELECT * FROM DocumentVersions WHERE DocumentId = @DocId ORDER BY Id DESC";
            var rows = await conn.QueryAsync<object>(sql, new { DocId = documentId });
            return ApiResponse<List<object>>.Success(rows.AsList());
        }
        catch (Exception ex)
        {
            return ApiResponse<List<object>>.Fail(ex.Message);
        }
    }

    [HttpPost("Upload")]
    [RequestSizeLimit(209715200)] // 200 MB limit from SRS
    public async Task<ApiResponse<object>> Upload([FromForm] IFormFile file, [FromForm] string metadataJson)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return ApiResponse<object>.Fail("No file was uploaded.");
            }

            var meta = System.Text.Json.JsonSerializer.Deserialize<DocumentItem>(
                metadataJson,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            ) ?? new DocumentItem();

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var uploadDir = Path.Combine(webRoot, "media", "documents");
            Directory.CreateDirectory(uploadDir);

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var uniqueFileName = $"{Guid.NewGuid():N}_{Path.GetFileName(file.FileName)}";
            var savePath = Path.Combine(uploadDir, uniqueFileName);

            using (var stream = new FileStream(savePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var relativePath = $"/media/documents/{uniqueFileName}";
            var docName = string.IsNullOrWhiteSpace(meta.Name) ? Path.GetFileNameWithoutExtension(file.FileName) : meta.Name;

            var docId = await conn.QuerySingleAsync<int>(@"
                INSERT INTO Documents (
                    Name, OriginalFileName, FilePath, FileExtension, FileSizeBytes, ContentType,
                    DocumentType, DepartmentFolderId, Version, IsCheckedOut, CheckedOutBy, ExpiryDate,
                    ActionUponExpiry, Tags, SupplierName, FileNo, NoteNo, Notes, ShareScope,
                    ShareGroups, IsShareableLinkActive, ShareableToken, CreatedBy, CreatedAt, IsDeleted
                ) VALUES (
                    @Name, @OriginalFileName, @FilePath, @FileExtension, @FileSizeBytes, @ContentType,
                    @DocumentType, @DepartmentFolderId, '1.00', 0, NULL, @ExpiryDate,
                    @ActionUponExpiry, @Tags, @SupplierName, @FileNo, @NoteNo, @Notes, @ShareScope,
                    @ShareGroups, @IsShareableLinkActive, @ShareableToken, @CreatedBy, datetime('now'), 0
                );
                SELECT last_insert_rowid();
            ", new
            {
                Name = docName,
                OriginalFileName = file.FileName,
                FilePath = relativePath,
                FileExtension = ext,
                FileSizeBytes = file.Length,
                ContentType = file.ContentType ?? "application/octet-stream",
                DocumentType = string.IsNullOrEmpty(meta.DocumentType) ? "WORK ORDER" : meta.DocumentType,
                DepartmentFolderId = meta.DepartmentFolderId > 0 ? meta.DepartmentFolderId : 1,
                ExpiryDate = meta.ExpiryDate,
                ActionUponExpiry = string.IsNullOrEmpty(meta.ActionUponExpiry) ? "NONE" : meta.ActionUponExpiry,
                Tags = meta.Tags ?? "",
                SupplierName = meta.SupplierName,
                FileNo = meta.FileNo,
                NoteNo = meta.NoteNo,
                Notes = meta.Notes,
                ShareScope = string.IsNullOrEmpty(meta.ShareScope) ? "All Logged in Users" : meta.ShareScope,
                ShareGroups = meta.ShareGroups,
                IsShareableLinkActive = meta.IsShareableLinkActive ? 1 : 0,
                ShareableToken = meta.IsShareableLinkActive ? Guid.NewGuid().ToString("N") : null,
                CreatedBy = "DILIP"
            });

            // Version 1.00 record
            await conn.ExecuteAsync(@"
                INSERT INTO DocumentVersions (DocumentId, VersionNumber, FilePath, FileSizeBytes, ChangedBy, ChangeSummary, CreatedAt)
                VALUES (@DocumentId, '1.00', @FilePath, @FileSizeBytes, 'DILIP', 'Initial Document Upload', datetime('now'));
            ", new { DocumentId = docId, FilePath = relativePath, FileSizeBytes = file.Length });

            await LogActivityAsync(conn, docId, meta.Name, "UPLOAD", "Engr. Dilip K Roy", "Head of IT", $"Initial document upload with version v1.00 ({meta.DocumentType})");

            return ApiResponse<object>.Success(new { DocumentId = docId, FilePath = relativePath }, "Document uploaded successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<object>.Fail($"Upload failed: {ex.Message}");
        }
    }

    [HttpPost("UploadNewVersion")]
    [RequestSizeLimit(209715200)]
    public async Task<ApiResponse<object>> UploadNewVersion([FromForm] IFormFile file, [FromForm] int documentId, [FromForm] string changeSummary)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var current = await conn.QueryFirstOrDefaultAsync<DocumentItem>("SELECT * FROM Documents WHERE Id = @Id", new { Id = documentId });
            if (current == null) return ApiResponse<object>.Fail("Document not found");

            // Calculate new version number: 1.00 -> 2.00 or +0.10
            var vNum = 1.0;
            if (double.TryParse(current.Version, out var curV))
            {
                vNum = curV + 1.0;
            }
            var newVersionStr = vNum.ToString("0.00");

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var uploadDir = Path.Combine(webRoot, "media", "documents");
            var uniqueFileName = $"{Guid.NewGuid():N}_{Path.GetFileName(file.FileName)}";
            var savePath = Path.Combine(uploadDir, uniqueFileName);

            using (var stream = new FileStream(savePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var relativePath = $"/media/documents/{uniqueFileName}";

            // Update document current version and file
            await conn.ExecuteAsync(@"
                UPDATE Documents
                SET Version = @Version,
                    FilePath = @FilePath,
                    OriginalFileName = @OriginalFileName,
                    FileSizeBytes = @FileSizeBytes,
                    IsCheckedOut = 0,
                    CheckedOutBy = NULL
                WHERE Id = @Id
            ", new
            {
                Version = newVersionStr,
                FilePath = relativePath,
                OriginalFileName = file.FileName,
                FileSizeBytes = file.Length,
                Id = documentId
            });

            // Insert new version history record
            await conn.ExecuteAsync(@"
                INSERT INTO DocumentVersions (DocumentId, VersionNumber, FilePath, FileSizeBytes, ChangedBy, ChangeSummary, CreatedAt)
                VALUES (@DocumentId, @VersionNumber, @FilePath, @FileSizeBytes, 'DILIP', @Summary, datetime('now'));
            ", new
            {
                DocumentId = documentId,
                VersionNumber = newVersionStr,
                FilePath = relativePath,
                FileSizeBytes = file.Length,
                Summary = string.IsNullOrWhiteSpace(changeSummary) ? "Version update" : changeSummary
            });

            await LogActivityAsync(conn, documentId, current.Name, "NEW_VERSION", "Engr. Dilip K Roy", "Head of IT", $"New version v{newVersionStr} uploaded: {changeSummary}");

            return ApiResponse<object>.Success(new { Version = newVersionStr, FilePath = relativePath }, "New version uploaded successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<object>.Fail($"Version update failed: {ex.Message}");
        }
    }

    [HttpPost("UpdateMetadata")]
    public async Task<ApiResponse<bool>> UpdateMetadata([FromBody] UpdateMetadataRequest request)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            await conn.ExecuteAsync(@"
                UPDATE Documents
                SET Name = @Name,
                    DocumentType = @DocumentType,
                    ExpiryDate = @ExpiryDate,
                    ActionUponExpiry = @ActionUponExpiry,
                    Tags = @Tags,
                    SupplierName = @SupplierName,
                    FileNo = @FileNo,
                    NoteNo = @NoteNo,
                    Notes = @Notes,
                    ShareScope = @ShareScope,
                    ShareGroups = @ShareGroups,
                    IsShareableLinkActive = @IsShareableLinkActive
                WHERE Id = @Id
            ", new
            {
                request.Name,
                request.DocumentType,
                request.ExpiryDate,
                request.ActionUponExpiry,
                request.Tags,
                request.SupplierName,
                request.FileNo,
                request.NoteNo,
                request.Notes,
                request.ShareScope,
                request.ShareGroups,
                IsShareableLinkActive = request.IsShareableLinkActive ? 1 : 0,
                request.Id
            });

            await LogActivityAsync(conn, request.Id, request.Name, "UPDATE_META", "Engr. Dilip K Roy", "Head of IT", "Document properties and metadata updated");

            return ApiResponse<bool>.Success(true, "Metadata updated successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<bool>.Fail($"Update failed: {ex.Message}");
        }
    }

    [HttpPost("CheckOut")]
    public async Task<ApiResponse<bool>> CheckOut([FromBody] int id)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var doc = await conn.QueryFirstOrDefaultAsync<DocumentItem>("SELECT * FROM Documents WHERE Id = @Id", new { Id = id });

            await conn.ExecuteAsync(@"
                UPDATE Documents
                SET IsCheckedOut = 1,
                    CheckedOutBy = 'DILIP',
                    CheckedOutAt = datetime('now')
                WHERE Id = @Id
            ", new { Id = id });

            if (doc != null)
            {
                await LogActivityAsync(conn, doc.Id, doc.Name, "CHECKOUT", "Engr. Dilip K Roy", "Head of IT", "Document checked out for editing (locked)");
            }

            return ApiResponse<bool>.Success(true, "Document checked out successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<bool>.Fail(ex.Message);
        }
    }

    [HttpPost("CheckIn")]
    public async Task<ApiResponse<bool>> CheckIn([FromBody] int id)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var doc = await conn.QueryFirstOrDefaultAsync<DocumentItem>("SELECT * FROM Documents WHERE Id = @Id", new { Id = id });

            await conn.ExecuteAsync(@"
                UPDATE Documents
                SET IsCheckedOut = 0,
                    CheckedOutBy = NULL,
                    CheckedOutAt = NULL
                WHERE Id = @Id
            ", new { Id = id });

            if (doc != null)
            {
                await LogActivityAsync(conn, doc.Id, doc.Name, "CHECKIN", "Engr. Dilip K Roy", "Head of IT", "Document checked in and unlocked");
            }

            return ApiResponse<bool>.Success(true, "Document checked in successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<bool>.Fail(ex.Message);
        }
    }

    [HttpPost("Delete")]
    public async Task<ApiResponse<bool>> Delete([FromBody] int id)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var doc = await conn.QueryFirstOrDefaultAsync<DocumentItem>(
                "SELECT * FROM Documents WHERE Id = @Id", new { Id = id });
            if (doc == null) return ApiResponse<bool>.Fail("Document not found");

            // Check if document is linked to any active workflow case
            var activeCase = await conn.QueryFirstOrDefaultAsync<WorkflowCase>(@"
                SELECT * FROM WorkflowCases 
                WHERE AppStatus NOT IN ('Complete', 'Rejected') 
                  AND (
                    LOWER(AttachmentsJson) LIKE '%' || LOWER(@FileName) || '%'
                    OR LOWER(AttachmentsJson) LIKE '%' || LOWER(@DocName) || '%'
                    OR LOWER(FileName) = LOWER(@DocName)
                  )
                LIMIT 1", 
                new { 
                    FileName = doc.OriginalFileName, 
                    DocName = doc.Name 
                });

            if (activeCase != null)
            {
                return ApiResponse<bool>.Fail(
                    $"Deletion Locked: This document is currently attached to an active Workflow Case (#{activeCase.AppId}: {activeCase.ProcessName}). " +
                    "To ensure audit compliance and prevent broken approval sheets, it cannot be deleted while under review."
                );
            }

            await conn.ExecuteAsync("UPDATE Documents SET IsDeleted = 1 WHERE Id = @Id", new { Id = id });
            await LogActivityAsync(conn, doc.Id, doc.Name, "TRASH", "Engr. Dilip K Roy", "Head of IT", "Document moved to Archive / Trash");

            return ApiResponse<bool>.Success(true, "Document moved to archive/trash");
        }
        catch (Exception ex)
        {
            return ApiResponse<bool>.Fail(ex.Message);
        }
    }

    [HttpPost("Restore")]
    public async Task<ApiResponse<bool>> Restore([FromBody] int id)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var doc = await conn.QueryFirstOrDefaultAsync<DocumentItem>("SELECT * FROM Documents WHERE Id = @Id", new { Id = id });
            await conn.ExecuteAsync("UPDATE Documents SET IsDeleted = 0 WHERE Id = @Id", new { Id = id });

            if (doc != null)
            {
                await LogActivityAsync(conn, doc.Id, doc.Name, "RESTORE", "Engr. Dilip K Roy", "Head of IT", "Document restored from Archive / Trash to active folders");
            }

            return ApiResponse<bool>.Success(true, "Document restored successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<bool>.Fail(ex.Message);
        }
    }

    [HttpGet("StreamPdf")]
    public async Task<IActionResult> StreamPdf([FromQuery] int id)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var doc = await conn.QueryFirstOrDefaultAsync<DocumentItem>("SELECT * FROM Documents WHERE Id = @Id", new { Id = id });
            if (doc == null) return NotFound("Document not found");

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var relative = doc.FilePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.Combine(webRoot, relative);

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound("Physical file does not exist on server.");
            }

            var ext = Path.GetExtension(fullPath).ToLowerInvariant();
            var contentType = ext switch
            {
                ".pdf" => "application/pdf",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls" => "application/vnd.ms-excel",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".doc" => "application/msword",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                _ => string.IsNullOrEmpty(doc.ContentType) ? "application/octet-stream" : doc.ContentType
            };

            var bytes = await System.IO.File.ReadAllBytesAsync(fullPath);
            Response.Headers["Content-Disposition"] = $"inline; filename=\"{doc.OriginalFileName}\"";

            var user = Request.Query["user"].FirstOrDefault() ?? Request.Headers["X-User"].FirstOrDefault() ?? "Engr. Dilip K Roy";
            var role = Request.Query["role"].FirstOrDefault() ?? Request.Headers["X-User-Role"].FirstOrDefault() ?? "Head of IT";
            await LogActivityAsync(conn, doc.Id, doc.Name, "VIEW", user, role, "Previewed in secure document viewer");

            return File(bytes, contentType);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("StreamVersion")]
    public async Task<IActionResult> StreamVersion([FromQuery] int versionId)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var version = await conn.QueryFirstOrDefaultAsync<DocumentVersion>("SELECT * FROM DocumentVersions WHERE Id = @Id", new { Id = versionId });
            if (version == null) return NotFound("Version not found");

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var relative = version.FilePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.Combine(webRoot, relative);

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound("Physical file for this version does not exist on server.");
            }

            var ext = Path.GetExtension(fullPath).ToLowerInvariant();
            var contentType = ext switch
            {
                ".pdf" => "application/pdf",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls" => "application/vnd.ms-excel",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".doc" => "application/msword",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                _ => "application/octet-stream"
            };

            var bytes = await System.IO.File.ReadAllBytesAsync(fullPath);
            var fileName = Path.GetFileName(version.FilePath);
            Response.Headers["Content-Disposition"] = $"inline; filename=\"{fileName}\"";

            var user = Request.Query["user"].FirstOrDefault() ?? Request.Headers["X-User"].FirstOrDefault() ?? "Engr. Dilip K Roy";
            var role = Request.Query["role"].FirstOrDefault() ?? Request.Headers["X-User-Role"].FirstOrDefault() ?? "Head of IT";
            await LogActivityAsync(conn, version.DocumentId, "Document Version", "VIEW_VERSION", user, role, $"Inspected past version v{version.VersionNumber}");

            return File(bytes, contentType);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("Download")]
    public async Task<IActionResult> Download([FromQuery] int id)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var doc = await conn.QueryFirstOrDefaultAsync<DocumentItem>("SELECT * FROM Documents WHERE Id = @Id", new { Id = id });
            if (doc == null) return NotFound("Document not found");

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var relative = doc.FilePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.Combine(webRoot, relative);

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound("Physical file does not exist on server.");
            }

            var ext = Path.GetExtension(fullPath).ToLowerInvariant();
            var contentType = ext switch
            {
                ".pdf" => "application/pdf",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls" => "application/vnd.ms-excel",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".doc" => "application/msword",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                _ => string.IsNullOrEmpty(doc.ContentType) ? "application/octet-stream" : doc.ContentType
            };

            var bytes = await System.IO.File.ReadAllBytesAsync(fullPath);
            Response.Headers["Content-Disposition"] = $"attachment; filename=\"{doc.OriginalFileName}\"";

            var user = Request.Query["user"].FirstOrDefault() ?? Request.Headers["X-User"].FirstOrDefault() ?? "Engr. Dilip K Roy";
            var role = Request.Query["role"].FirstOrDefault() ?? Request.Headers["X-User-Role"].FirstOrDefault() ?? "Head of IT";
            await LogActivityAsync(conn, doc.Id, doc.Name, "DOWNLOAD", user, role, $"Downloaded file binary: {doc.OriginalFileName}");

            return File(bytes, contentType, doc.OriginalFileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("DownloadVersion")]
    public async Task<IActionResult> DownloadVersion([FromQuery] int versionId)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var version = await conn.QueryFirstOrDefaultAsync<DocumentVersion>("SELECT * FROM DocumentVersions WHERE Id = @Id", new { Id = versionId });
            if (version == null) return NotFound("Version not found");

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var relative = version.FilePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.Combine(webRoot, relative);

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound("Physical file for this version does not exist on server.");
            }

            var ext = Path.GetExtension(fullPath).ToLowerInvariant();
            var contentType = ext switch
            {
                ".pdf" => "application/pdf",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls" => "application/vnd.ms-excel",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".doc" => "application/msword",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                _ => "application/octet-stream"
            };

            var bytes = await System.IO.File.ReadAllBytesAsync(fullPath);
            var fileName = Path.GetFileName(version.FilePath);
            Response.Headers["Content-Disposition"] = $"attachment; filename=\"{fileName}\"";

            var user = Request.Query["user"].FirstOrDefault() ?? Request.Headers["X-User"].FirstOrDefault() ?? "Engr. Dilip K Roy";
            var role = Request.Query["role"].FirstOrDefault() ?? Request.Headers["X-User-Role"].FirstOrDefault() ?? "Head of IT";
            await LogActivityAsync(conn, version.DocumentId, "Document Version", "DOWNLOAD_VERSION", user, role, $"Downloaded past version v{version.VersionNumber}");

            return File(bytes, contentType, fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("PublicStream")]
    public async Task<IActionResult> PublicStream([FromQuery] string token)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var doc = await conn.QueryFirstOrDefaultAsync<DocumentItem>(
                "SELECT * FROM Documents WHERE ShareableToken = @Token AND IsShareableLinkActive = 1 AND IsDeleted = 0",
                new { Token = token });

            if (doc == null)
            {
                return NotFound("This shareable link is invalid, expired, or has been deactivated.");
            }

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var relative = doc.FilePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.Combine(webRoot, relative);

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound("Physical file does not exist on server.");
            }

            var ext = Path.GetExtension(fullPath).ToLowerInvariant();
            var contentType = ext switch
            {
                ".pdf" => "application/pdf",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls" => "application/vnd.ms-excel",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".doc" => "application/msword",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                _ => string.IsNullOrEmpty(doc.ContentType) ? "application/octet-stream" : doc.ContentType
            };

            var bytes = await System.IO.File.ReadAllBytesAsync(fullPath);
            Response.Headers["Content-Disposition"] = $"inline; filename=\"{doc.OriginalFileName}\"";

            await LogActivityAsync(conn, doc.Id, doc.Name, "PUBLIC_VIEW", "External Guest", "Public Share Link", "Document viewed via external public token link");

            return File(bytes, contentType);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpPost("ToggleShareableLink")]
    public async Task<ApiResponse<object>> ToggleShareableLink([FromBody] int id)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var doc = await conn.QueryFirstOrDefaultAsync<DocumentItem>("SELECT * FROM Documents WHERE Id = @Id", new { Id = id });
            if (doc == null) return ApiResponse<object>.Fail("Document not found");

            bool newStatus = !doc.IsShareableLinkActive;
            string? token = doc.ShareableToken;
            if (newStatus && string.IsNullOrEmpty(token))
            {
                token = Guid.NewGuid().ToString("N");
            }

            await conn.ExecuteAsync(@"
                UPDATE Documents 
                SET IsShareableLinkActive = @Status, ShareableToken = @Token 
                WHERE Id = @Id
            ", new { Status = newStatus ? 1 : 0, Token = token, Id = id });

            await LogActivityAsync(conn, doc.Id, doc.Name, "SHARE_LINK_TOGGLE", "Engr. Dilip K Roy", "Head of IT", newStatus ? "Public share link generated" : "Public share link revoked");

            return ApiResponse<object>.Success(new { IsShareableLinkActive = newStatus, ShareableToken = token }, "Shareable link status updated");
        }
        catch (Exception ex)
        {
            return ApiResponse<object>.Fail(ex.Message);
        }
    }
}
