using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using EdmsApi.Common;
using EdmsApi.Models;

namespace EdmsApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FolderController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly string _connectionString;

    public FolderController(IConfiguration config)
    {
        _config = config;
        _connectionString = _config.GetConnectionString("DefaultConnection") ?? "Data Source=edms.db";
    }

    // Following DCCI ERP rule: GET method returns Task<ApiResponse<List<object>>>
    [HttpGet("GetTree")]
    public async Task<ApiResponse<List<object>>> GetTree([FromQuery] string? folderType = null)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            string sql = @"
                SELECT f.Id, f.Name, f.ParentId, f.Code, f.FolderType, f.SortOrder, f.IsRequired,
                       CASE 
                           WHEN f.ParentId IS NULL THEN (SELECT COUNT(1) FROM Documents d WHERE d.IsDeleted = 0)
                           ELSE (
                               WITH RECURSIVE SubFolderTree AS (
                                   SELECT Id FROM DepartmentFolders WHERE Id = f.Id
                                   UNION ALL
                                   SELECT sf.Id FROM DepartmentFolders sf INNER JOIN SubFolderTree sft ON sf.ParentId = sft.Id
                               )
                               SELECT COUNT(1) FROM Documents d 
                               WHERE (d.DepartmentFolderId IN (SELECT Id FROM SubFolderTree) 
                                      OR LOWER(d.DocumentType) = LOWER(f.Code) 
                                      OR LOWER(d.DocumentType) = LOWER(f.Name))
                                 AND d.IsDeleted = 0
                           )
                       END AS DocumentCount,
                       CASE 
                           WHEN f.ParentId IS NULL THEN (SELECT COUNT(1) FROM Documents d WHERE d.IsDeleted = 1)
                           ELSE (
                               WITH RECURSIVE SubFolderTree AS (
                                   SELECT Id FROM DepartmentFolders WHERE Id = f.Id
                                   UNION ALL
                                   SELECT sf.Id FROM DepartmentFolders sf INNER JOIN SubFolderTree sft ON sf.ParentId = sft.Id
                               )
                               SELECT COUNT(1) FROM Documents d 
                               WHERE (d.DepartmentFolderId IN (SELECT Id FROM SubFolderTree) 
                                      OR LOWER(d.DocumentType) = LOWER(f.Code) 
                                      OR LOWER(d.DocumentType) = LOWER(f.Name))
                                 AND d.IsDeleted = 1
                           )
                       END AS DeletedCount
                FROM DepartmentFolders f
                ORDER BY f.SortOrder ASC, f.Name ASC";

            var rows = await conn.QueryAsync<object>(sql);
            return ApiResponse<List<object>>.Success(rows.AsList(), "Folders fetched successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<List<object>>.Fail($"Error fetching folders: {ex.Message}");
        }
    }

    [HttpPost("CreateSubfolder")]
    public async Task<ApiResponse<object>> CreateSubfolder([FromBody] CreateSubfolderRequest req)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(req.Name))
            {
                return ApiResponse<object>.Fail("Folder name is required");
            }

            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var parent = await conn.QueryFirstOrDefaultAsync<DepartmentFolder>(
                "SELECT * FROM DepartmentFolders WHERE Id = @ParentId",
                new { req.ParentId }
            );

            if (parent == null)
            {
                return ApiResponse<object>.Fail("Parent folder does not exist");
            }

            var code = string.IsNullOrWhiteSpace(req.Code) 
                ? $"{parent.Code}-SUB-{DateTime.UtcNow.Ticks % 10000}" 
                : req.Code.Trim();

            var maxSort = await conn.ExecuteScalarAsync<int?>(
                "SELECT MAX(SortOrder) FROM DepartmentFolders WHERE ParentId = @ParentId",
                new { req.ParentId }
            ) ?? 0;

            var id = await conn.QuerySingleAsync<int>(@"
                INSERT INTO DepartmentFolders (Name, ParentId, Code, FolderType, SortOrder, IsRequired)
                VALUES (@Name, @ParentId, @Code, 'Subfolder', @SortOrder, 0);
                SELECT last_insert_rowid();
            ", new { 
                Name = req.Name.Trim(), 
                ParentId = req.ParentId, 
                Code = code, 
                SortOrder = maxSort + 1 
            });

            return ApiResponse<object>.Success(new { Id = id, Name = req.Name.Trim(), ParentId = req.ParentId, Code = code }, "Subfolder created successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<object>.Fail($"Error creating subfolder: {ex.Message}");
        }
    }

    [HttpDelete("DeleteFolder")]
    public async Task<ApiResponse<bool>> DeleteFolder([FromQuery] int folderId)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var folder = await conn.QueryFirstOrDefaultAsync<DepartmentFolder>(
                "SELECT * FROM DepartmentFolders WHERE Id = @Id", 
                new { Id = folderId }
            );

            if (folder == null) return ApiResponse<bool>.Fail("Folder not found");
            if (folder.FolderType == "Root" || folder.FolderType == "Department")
            {
                return ApiResponse<bool>.Fail("Core departments cannot be deleted.");
            }

            // Check if documents exist in this folder or any child subfolder
            var docCount = await conn.ExecuteScalarAsync<int>(@"
                WITH RECURSIVE SubFolderTree AS (
                    SELECT Id FROM DepartmentFolders WHERE Id = @FolderId
                    UNION ALL
                    SELECT f.Id FROM DepartmentFolders f
                    INNER JOIN SubFolderTree sft ON f.ParentId = sft.Id
                )
                SELECT COUNT(1) FROM Documents WHERE DepartmentFolderId IN (SELECT Id FROM SubFolderTree) AND IsDeleted = 0;
            ", new { FolderId = folderId });

            if (docCount > 0)
            {
                return ApiResponse<bool>.Fail($"Cannot delete folder because it contains {docCount} active document(s). Please move or archive them first.");
            }

            await conn.ExecuteAsync("DELETE FROM DepartmentFolders WHERE Id = @Id", new { Id = folderId });
            return ApiResponse<bool>.Success(true, "Folder deleted successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<bool>.Fail($"Error deleting folder: {ex.Message}");
        }
    }

    [HttpPut("RenameFolder")]
    public async Task<ApiResponse<bool>> RenameFolder([FromBody] RenameFolderRequest req)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(req.NewName)) return ApiResponse<bool>.Fail("New folder name is required");
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            await conn.ExecuteAsync("UPDATE DepartmentFolders SET Name = @Name WHERE Id = @Id", new { Name = req.NewName.Trim(), Id = req.Id });
            return ApiResponse<bool>.Success(true, "Folder renamed successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<bool>.Fail($"Error renaming folder: {ex.Message}");
        }
    }

    [HttpPost("CreateFolder")]
    public async Task<ApiResponse<int>> CreateFolder([FromBody] DepartmentFolder folder)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var id = await conn.QuerySingleAsync<int>(@"
                INSERT INTO DepartmentFolders (Name, ParentId, Code, FolderType, ArchiveProjectCode, SortOrder, IsRequired)
                VALUES (@Name, @ParentId, @Code, @FolderType, @ArchiveProjectCode, @SortOrder, @IsRequired);
                SELECT last_insert_rowid();
            ", folder);

            return ApiResponse<int>.Success(id, "Folder created successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<int>.Fail($"Error creating folder: {ex.Message}");
        }
    }
}

public class CreateSubfolderRequest
{
    public string Name { get; set; } = string.Empty;
    public int ParentId { get; set; }
    public string? Code { get; set; }
}

public class RenameFolderRequest
{
    public int Id { get; set; }
    public string NewName { get; set; } = string.Empty;
}
