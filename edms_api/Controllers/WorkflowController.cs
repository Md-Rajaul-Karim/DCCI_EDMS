using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using EdmsApi.Common;
using EdmsApi.Models;

namespace EdmsApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorkflowController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly string _connectionString;

    public WorkflowController(IConfiguration config)
    {
        _config = config;
        _connectionString = _config.GetConnectionString("DefaultConnection") ?? "Data Source=edms.db";
    }

    // Following DCCI ERP rule: GET method returns Task<ApiResponse<List<object>>>
    [HttpGet("GetParticipatedList")]
    public async Task<ApiResponse<List<object>>> GetParticipatedList(
        [FromQuery] string? status = null, 
        [FromQuery] string? search = null,
        [FromQuery] string? bucket = null)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var sql = "SELECT * FROM WorkflowCases WHERE 1=1";

            if (!string.IsNullOrEmpty(bucket))
            {
                if (bucket.Equals("Inbox", StringComparison.OrdinalIgnoreCase))
                {
                    sql += " AND AppStatus = 'In Progress'";
                }
                else if (bucket.Equals("Draft", StringComparison.OrdinalIgnoreCase))
                {
                    sql += " AND AppStatus = 'Draft'";
                }
                else if (bucket.Equals("Query", StringComparison.OrdinalIgnoreCase))
                {
                    sql += " AND AppStatus = 'Query'";
                }
                else if (bucket.Equals("Risk", StringComparison.OrdinalIgnoreCase))
                {
                    sql += " AND Priority = 'Urgent' AND AppStatus = 'In Progress'";
                }
                else if (bucket.Equals("OverDue", StringComparison.OrdinalIgnoreCase))
                {
                    sql += " AND Priority IN ('High', 'Urgent') AND AppStatus = 'In Progress'";
                }
                // 'Process Status' returns all
            }
            else if (!string.IsNullOrEmpty(status))
            {
                sql += " AND LOWER(AppStatus) = LOWER(@Status)";
            }

            if (!string.IsNullOrEmpty(search))
            {
                sql += @" AND (
                    LOWER(AppId) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(ProcessName) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(FileName) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(FileNumber) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(Subject) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(Initiator) LIKE LOWER('%' || @Search || '%') OR
                    LOWER(TaskName) LIKE LOWER('%' || @Search || '%')
                )";
            }

            sql += " ORDER BY Id DESC";

            var rows = await conn.QueryAsync<object>(sql, new { Status = status, Search = search });
            return ApiResponse<List<object>>.Success(rows.AsList(), "Cases loaded successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<List<object>>.Fail(ex.Message);
        }
    }

    [HttpGet("GetBucketCounts")]
    public async Task<ApiResponse<object>> GetBucketCounts()
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var inbox = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM WorkflowCases WHERE AppStatus = 'In Progress'");
            var draft = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM WorkflowCases WHERE AppStatus = 'Draft'");
            var query = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM WorkflowCases WHERE AppStatus = 'Query'");
            var risk = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM WorkflowCases WHERE Priority = 'Urgent' AND AppStatus = 'In Progress'");
            var overdue = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM WorkflowCases WHERE Priority IN ('High', 'Urgent') AND AppStatus = 'In Progress'");
            var processStatus = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM WorkflowCases");

            return ApiResponse<object>.Success(new
            {
                Inbox = inbox,
                Draft = draft,
                Query = query,
                Risk = risk,
                OverDue = overdue,
                ProcessStatus = processStatus
            });
        }
        catch (Exception ex)
        {
            return ApiResponse<object>.Fail(ex.Message);
        }
    }

    [HttpGet("GetActionHistory")]
    public async Task<ApiResponse<List<object>>> GetActionHistory([FromQuery] string appId)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var rows = await conn.QueryAsync<object>(
                "SELECT * FROM WorkflowActionHistory WHERE CaseAppId = @AppId ORDER BY Id ASC",
                new { AppId = appId }
            );

            return ApiResponse<List<object>>.Success(rows.AsList(), "History retrieved");
        }
        catch (Exception ex)
        {
            return ApiResponse<List<object>>.Fail(ex.Message);
        }
    }

    [HttpGet("GetNotifications")]
    public async Task<ApiResponse<List<object>>> GetNotifications(
        [FromQuery] string? userRole = null, 
        [FromQuery] string? userName = null)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var notifications = new List<object>();
            string role = userRole ?? "";
            string name = userName ?? "";

            // 1. Workflow Cases Actionable for Current Desk
            var allCases = await conn.QueryAsync<dynamic>(@"
                SELECT AppId, ProcessName, Subject, TaskName, AppStatus, SentBy, Initiator, Priority, LastModified
                FROM WorkflowCases
                ORDER BY Id DESC
            ");

            foreach (var c in allCases)
            {
                string task = ((string)(c.TaskName ?? "")).Trim();
                string status = ((string)(c.AppStatus ?? "")).Trim();
                string appId = (string)c.AppId;
                string process = (string)c.ProcessName;
                string subject = (string)(c.Subject ?? process);
                string initiator = (string)(c.Initiator ?? "");
                string sentBy = (string)(c.SentBy ?? "");
                string time = (string)(c.LastModified ?? "Just now");

                bool isMyDesk = false;
                string notifTitle = "";
                string notifDesc = "";

                if (role.Contains("President", StringComparison.OrdinalIgnoreCase))
                {
                    if (task.Contains("President", StringComparison.OrdinalIgnoreCase) && status == "In Progress")
                    {
                        isMyDesk = true;
                        notifTitle = "Action Required: Final Approval";
                        notifDesc = $"Proposal #{appId} ({subject}) forwarded by {sentBy} is awaiting your final approval.";
                    }
                }
                else if (role.Contains("Secretary General", StringComparison.OrdinalIgnoreCase))
                {
                    if (task.Contains("Secretary General", StringComparison.OrdinalIgnoreCase) && status == "In Progress")
                    {
                        isMyDesk = true;
                        notifTitle = "Action Required: SG Review & Forward";
                        notifDesc = $"Proposal #{appId} ({subject}) is pending on your desk for recommendation.";
                    }
                }
                else if (role.Contains("Accounts", StringComparison.OrdinalIgnoreCase))
                {
                    if (task.Contains("Accounts", StringComparison.OrdinalIgnoreCase) && status == "In Progress")
                    {
                        isMyDesk = true;
                        notifTitle = "Action Required: Accounts & Budget Check";
                        notifDesc = $"Proposal #{appId} ({subject}) submitted for budget & financial vetting.";
                    }
                }
                else if (role.Contains("Head of Department", StringComparison.OrdinalIgnoreCase) || role.Equals("HOD", StringComparison.OrdinalIgnoreCase))
                {
                    if (task.Contains("Head of Department", StringComparison.OrdinalIgnoreCase) && status == "In Progress")
                    {
                        isMyDesk = true;
                        notifTitle = "Action Required: HOD Review & Endorsement";
                        notifDesc = $"Proposal #{appId} ({subject}) submitted by {initiator} is pending your review.";
                    }
                }
                else if (role.Contains("Checker", StringComparison.OrdinalIgnoreCase) || role.Contains("Reviewer", StringComparison.OrdinalIgnoreCase))
                {
                    if (task.Contains("Review", StringComparison.OrdinalIgnoreCase) || task.Contains("Checker", StringComparison.OrdinalIgnoreCase))
                    {
                        isMyDesk = true;
                        notifTitle = "Action Required: Technical Review / Checker";
                        notifDesc = $"Proposal #{appId} ({subject}) has been assigned to you for review.";
                    }
                }
                else if (role.Contains("Initiator", StringComparison.OrdinalIgnoreCase))
                {
                    if (status == "Query")
                    {
                        isMyDesk = true;
                        notifTitle = "Clarification / Query Requested";
                        notifDesc = $"Query raised on your case #{appId} ({subject}). Please provide clarification.";
                    }
                    else if (status == "Complete" && (string.IsNullOrEmpty(name) || initiator.Contains(name, StringComparison.OrdinalIgnoreCase)))
                    {
                        isMyDesk = true;
                        notifTitle = "Proposal Approved & Complete";
                        notifDesc = $"Your proposal #{appId} ({subject}) has received final approval from President.";
                    }
                }

                if (isMyDesk)
                {
                    notifications.Add(new
                    {
                        id = $"wf-{appId}",
                        type = "workflow",
                        title = notifTitle,
                        description = notifDesc,
                        time = time,
                        read = false,
                        targetView = "workflow",
                        targetId = appId
                    });
                }
            }

            // 2. Document Expiration Warnings (Expiring within 30 days or expired)
            var expiringDocs = await conn.QueryAsync<dynamic>(@"
                SELECT Id, Name, SupplierName, ExpiryDate, ActionUponExpiry 
                FROM Documents 
                WHERE IsDeleted = 0 
                  AND ExpiryDate IS NOT NULL 
                  AND ExpiryDate != ''
                  AND date(ExpiryDate) <= date('now', '+30 day')
                ORDER BY ExpiryDate ASC 
                LIMIT 5
            ");

            foreach (var doc in expiringDocs)
            {
                string expDate = (string)(doc.ExpiryDate ?? "");
                string docName = (string)(doc.Name ?? "Document");
                string supplier = (string)(doc.SupplierName ?? "General");
                string actionExpiry = (string)(doc.ActionUponExpiry ?? "RENEW");

                notifications.Add(new
                {
                    id = $"exp-{doc.Id}",
                    type = "expiry",
                    title = "Contract Expiration Warning",
                    description = $"{docName} ({supplier}) expires on {expDate}. Action: {actionExpiry}.",
                    time = expDate,
                    read = false,
                    targetView = "explorer",
                    targetId = doc.Id.ToString()
                });
            }

            // 3. Recent Document Upload / Revisions
            var recentDocs = await conn.QueryAsync<dynamic>(@"
                SELECT d.Id, d.Name, d.OriginalFileName, d.Version, d.CreatedAt, f.Name AS FolderName
                FROM Documents d
                LEFT JOIN DepartmentFolders f ON d.DepartmentFolderId = f.Id
                WHERE d.IsDeleted = 0
                ORDER BY d.Id DESC
                LIMIT 3
            ");

            foreach (var rdoc in recentDocs)
            {
                string rName = (string)(rdoc.Name ?? "");
                string folder = (string)(rdoc.FolderName ?? "Archive");
                string ver = (string)(rdoc.Version ?? "1.00");
                string created = (string)(rdoc.CreatedAt ?? "Recently");

                notifications.Add(new
                {
                    id = $"doc-{rdoc.Id}",
                    type = "document",
                    title = "Recent Document Activity",
                    description = $"{rName} (v{ver}) is active in '{folder}'.",
                    time = created,
                    read = false,
                    targetView = "explorer",
                    targetId = rdoc.Id.ToString()
                });
            }

            return ApiResponse<List<object>>.Success(notifications, "Notifications loaded successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<List<object>>.Fail($"Error loading notifications: {ex.Message}");
        }
    }

    [HttpPost("ExecuteAction")]
    public async Task<ApiResponse<object>> ExecuteAction([FromBody] WorkflowActionRequest req)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var caseItem = await conn.QueryFirstOrDefaultAsync<WorkflowCase>(
                "SELECT * FROM WorkflowCases WHERE AppId = @AppId",
                new { req.AppId }
            );

            if (caseItem == null) return ApiResponse<object>.Fail("Workflow case not found");

            // Initiator RBAC: Initiators cannot Reject, Query, Review, or Approve proposals
            if (req.Role.Contains("Initiator", StringComparison.OrdinalIgnoreCase) && 
                (req.Action.Equals("Reject", StringComparison.OrdinalIgnoreCase) || 
                 req.Action.Equals("Query", StringComparison.OrdinalIgnoreCase) || 
                 req.Action.Equals("Review", StringComparison.OrdinalIgnoreCase) ||
                 req.Action.Equals("Forward", StringComparison.OrdinalIgnoreCase) ||
                 req.Action.Equals("Approve", StringComparison.OrdinalIgnoreCase)))
            {
                return ApiResponse<object>.Fail("Initiators are not authorized to Reject, Query, Review, or Approve submitted proposals.");
            }

            // Desk Custody Lock: Only the officer whose desk matches the current task can act
            if (!req.Action.Equals("Clarify", StringComparison.OrdinalIgnoreCase))
            {
                bool isCustodian = false;
                string currentTask = caseItem.TaskName.ToLower().Trim();
                string actingRole = req.Role.ToLower().Trim();

                if (currentTask.StartsWith("review"))
                {
                    if (currentTask.Contains("head of department") && actingRole.Contains("head of department")) isCustodian = true;
                    else if (currentTask.Contains("accounts") && actingRole.Contains("accounts")) isCustodian = true;
                    else if (currentTask.Contains("secretary general") && actingRole.Contains("secretary general")) isCustodian = true;
                    else if (currentTask.Contains("president") && actingRole.Contains("president")) isCustodian = true;
                    else if (currentTask.Contains("checker") && actingRole.Contains("checker")) isCustodian = true;
                    else if (currentTask.Contains("internal reviewer") || currentTask.Equals("reviewer review")) isCustodian = true;
                }
                else
                {
                    if (currentTask.Contains("checker") && actingRole.Contains("checker")) isCustodian = true;
                    else if (currentTask.Contains("head of department") && actingRole.Contains("head of department")) isCustodian = true;
                    else if (currentTask.Contains("accounts") && actingRole.Contains("accounts")) isCustodian = true;
                    else if (currentTask.Contains("secretary general") && actingRole.Contains("secretary general")) isCustodian = true;
                    else if (currentTask.Contains("president") && actingRole.Contains("president")) isCustodian = true;
                }

                if (!isCustodian)
                {
                    return ApiResponse<object>.Fail($"Desk Custody Lock: Case is currently pending at '{caseItem.TaskName}'. '{req.Role}' cannot act on this case until it is at their desk.");
                }
            }

            string newTaskName = caseItem.TaskName;
            string newStatus = caseItem.AppStatus;
            string timeStr = DateTime.Now.ToString("MMMM dd, yyyy, h:mm tt");

            if (req.Action.Equals("Approve", StringComparison.OrdinalIgnoreCase) || 
                req.Action.Equals("ReturnReview", StringComparison.OrdinalIgnoreCase))
            {
                // RULE 1: If current case is under Review, return directly to the Authority who requested the Review!
                if (caseItem.TaskName.StartsWith("Review", StringComparison.OrdinalIgnoreCase))
                {
                    var reviewRequester = await conn.QueryFirstOrDefaultAsync<string>(@"
                        SELECT FromRole FROM WorkflowActionHistory 
                        WHERE CaseAppId = @AppId AND ActionType = 'Review' 
                        ORDER BY Id DESC LIMIT 1
                    ", new { AppId = req.AppId });

                    if (!string.IsNullOrWhiteSpace(reviewRequester))
                    {
                        if (reviewRequester.Contains("Secretary General", StringComparison.OrdinalIgnoreCase))
                            newTaskName = "Secretary General";
                        else if (reviewRequester.Contains("President", StringComparison.OrdinalIgnoreCase))
                            newTaskName = "President Approval";
                        else if (reviewRequester.Contains("Accounts", StringComparison.OrdinalIgnoreCase))
                            newTaskName = "Accounts & Finance";
                        else if (reviewRequester.Contains("Head of Department", StringComparison.OrdinalIgnoreCase))
                            newTaskName = "Head of Department";
                        else
                            newTaskName = reviewRequester;

                        newStatus = "In Progress";
                    }
                    else
                    {
                        newTaskName = "Secretary General";
                        newStatus = "In Progress";
                    }
                }
                else
                {
                    // Strict 5-step DCCI Approval Chain:
                    // 1. Initiator (Md. Arman Hossen) -> 2. Head of Department
                    // 2. Head of Department (Engr. Dilip K Roy) -> 3. Accounts & Finance
                    // 3. Accounts & Finance (CFO / CAO) -> 4. Secretary General
                    // 4. Secretary General (SG) -> 5. President Approval
                    // 5. President of DCCI -> Completed (Final Approval)

                    if (req.Role.Contains("President", StringComparison.OrdinalIgnoreCase))
                    {
                        newTaskName = "Completed";
                        newStatus = "Complete";
                    }
                    else if (req.Role.Contains("Secretary General", StringComparison.OrdinalIgnoreCase))
                    {
                        newTaskName = "President Approval";
                        newStatus = "In Progress";
                    }
                    else if (req.Role.Contains("Accounts", StringComparison.OrdinalIgnoreCase))
                    {
                        newTaskName = "Secretary General";
                        newStatus = "In Progress";
                    }
                    else if (req.Role.Contains("Head of Department", StringComparison.OrdinalIgnoreCase))
                    {
                        newTaskName = "Accounts & Finance";
                        newStatus = "In Progress";
                    }
                    else if (req.Role.Contains("Checker", StringComparison.OrdinalIgnoreCase) || caseItem.TaskName.Contains("Checker", StringComparison.OrdinalIgnoreCase))
                    {
                        newTaskName = "Head of Department";
                        newStatus = "In Progress";
                    }
                    else if (req.Role.Contains("Initiator", StringComparison.OrdinalIgnoreCase))
                    {
                        newTaskName = "Head of Department";
                        newStatus = "In Progress";
                    }
                    else
                    {
                        // Fallback to check current task if role is generic
                        if (caseItem.TaskName.Contains("President", StringComparison.OrdinalIgnoreCase))
                        {
                            newTaskName = "Completed";
                            newStatus = "Complete";
                        }
                        else if (caseItem.TaskName.Contains("Secretary General", StringComparison.OrdinalIgnoreCase))
                        {
                            newTaskName = "President Approval";
                            newStatus = "In Progress";
                        }
                        else if (caseItem.TaskName.Contains("Accounts", StringComparison.OrdinalIgnoreCase))
                        {
                            newTaskName = "Secretary General";
                            newStatus = "In Progress";
                        }
                        else
                        {
                            newTaskName = "Accounts & Finance";
                            newStatus = "In Progress";
                        }
                    }
                }
            }
            else if (req.Action.Equals("Query", StringComparison.OrdinalIgnoreCase))
            {
                newTaskName = "Initiator Clarification";
                newStatus = "Query";
            }
            else if (req.Action.Equals("Clarify", StringComparison.OrdinalIgnoreCase) || req.Action.Equals("RespondQuery", StringComparison.OrdinalIgnoreCase))
            {
                newTaskName = "Head of Department";
                newStatus = "In Progress";
            }
            else if (req.Action.Equals("Review", StringComparison.OrdinalIgnoreCase) || req.Action.Equals("Forward", StringComparison.OrdinalIgnoreCase))
            {
                string target = !string.IsNullOrWhiteSpace(req.TargetRole) ? req.TargetRole : "Internal Reviewer";
                newTaskName = $"Review ({target})";
                newStatus = "In Progress";
            }
            else if (req.Action.Equals("Reject", StringComparison.OrdinalIgnoreCase))
            {
                newTaskName = "Rejected";
                newStatus = "Rejected";
            }

            await conn.ExecuteAsync(@"
                UPDATE WorkflowCases 
                SET TaskName = @TaskName, AppStatus = @AppStatus, SentBy = @SentBy, LastModified = @LastModified 
                WHERE AppId = @AppId;
            ", new
            {
                TaskName = newTaskName,
                AppStatus = newStatus,
                SentBy = req.PerformedBy,
                LastModified = timeStr,
                AppId = req.AppId
            });

            if (!string.IsNullOrEmpty(req.AttachmentsJson))
            {
                await conn.ExecuteAsync(@"
                    UPDATE WorkflowCases 
                    SET AttachmentsJson = @AttachmentsJson 
                    WHERE AppId = @AppId;
                ", new { AttachmentsJson = req.AttachmentsJson, AppId = req.AppId });
            }

            string commentText = req.Comments;
            if (req.Action.Equals("Review", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(req.TargetRole))
            {
                commentText = string.IsNullOrWhiteSpace(commentText)
                    ? $"Forwarded for Review to {req.TargetRole}"
                    : $"[Forwarded for Review to {req.TargetRole}] {commentText}";
            }
            else if (caseItem.TaskName.StartsWith("Review", StringComparison.OrdinalIgnoreCase) && 
                     (req.Action.Equals("Approve", StringComparison.OrdinalIgnoreCase) || req.Action.Equals("ReturnReview", StringComparison.OrdinalIgnoreCase)))
            {
                commentText = string.IsNullOrWhiteSpace(commentText)
                    ? $"Review completed and returned to {newTaskName}"
                    : $"[Review Feedback to {newTaskName}] {commentText}";
            }
            else if (string.IsNullOrEmpty(commentText))
            {
                commentText = $"{req.Action} without additional remarks";
            }

            await conn.ExecuteAsync(@"
                INSERT INTO WorkflowActionHistory (CaseAppId, ActionType, FromUser, FromRole, Comments, ActionDate)
                VALUES (@CaseAppId, @ActionType, @FromUser, @FromRole, @Comments, @ActionDate);
            ", new
            {
                CaseAppId = req.AppId,
                ActionType = req.Action,
                FromUser = req.PerformedBy,
                FromRole = req.Role,
                Comments = commentText,
                ActionDate = timeStr
            });

            return ApiResponse<object>.Success(new
            {
                AppId = req.AppId,
                NewTaskName = newTaskName,
                NewStatus = newStatus
            }, $"Action '{req.Action}' recorded successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<object>.Fail(ex.Message);
        }
    }

    [HttpGet("GetCaseById")]
    public async Task<ApiResponse<object>> GetCaseById([FromQuery] string appId)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            var caseItem = await conn.QueryFirstOrDefaultAsync<object>(
                "SELECT * FROM WorkflowCases WHERE AppId = @AppId",
                new { AppId = appId }
            );

            if (caseItem == null) return ApiResponse<object>.Fail("Case not found");
            return ApiResponse<object>.Success(caseItem);
        }
        catch (Exception ex)
        {
            return ApiResponse<object>.Fail(ex.Message);
        }
    }

    [HttpDelete("DeleteCase")]
    public async Task<ApiResponse<bool>> DeleteCase([FromQuery] string appId)
    {
        try
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            await conn.ExecuteAsync("DELETE FROM WorkflowCases WHERE AppId = @AppId", new { AppId = appId });
            await conn.ExecuteAsync("DELETE FROM WorkflowActionHistory WHERE CaseAppId = @AppId", new { AppId = appId });

            return ApiResponse<bool>.Success(true, $"Case #{appId} deleted successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<bool>.Fail(ex.Message);
        }
    }

    [HttpPost("CreateApplication")]
    public async Task<ApiResponse<string>> CreateApplication([FromBody] WorkflowCase model)
    {
        try
        {
            // Only Initiators can create proposals
            if (!string.IsNullOrEmpty(model.Designation) && 
                (model.Designation.Contains("President", StringComparison.OrdinalIgnoreCase) || 
                 model.Designation.Contains("Secretary General", StringComparison.OrdinalIgnoreCase) ||
                 model.Designation.Contains("Chief Accounts", StringComparison.OrdinalIgnoreCase)))
            {
                return ApiResponse<string>.Fail("Only Initiators are authorized to draft and submit new applications.");
            }
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            // Generate an App ID similar to DCCI (e.g. 10 digits)
            var randomAppId = new Random().Next(100000000, 999999999).ToString();
            model.AppId = randomAppId;
            model.LastModified = DateTime.Now.ToString("MMMM dd, yyyy, h:mm tt");

            await conn.ExecuteAsync(@"
                INSERT INTO WorkflowCases (
                    AppId, ProcessName, TaskName, AppStatus, SentBy, Initiator, Designation,
                    DepartmentName, OfficeName, FileName, FileNumber, NoteNumber, Priority,
                    Subject, Description, QuotationType, EstimatedCost, HasChecker,
                    IsVatTaxApplicable, AttachmentsJson, LastModified
                ) VALUES (
                    @AppId, @ProcessName, 'Head of Department', 'In Progress', @Initiator,
                    @Initiator, @Designation, @DepartmentName, @OfficeName, @FileName,
                    @FileNumber, @NoteNumber, @Priority, @Subject, @Description,
                    @QuotationType, @EstimatedCost, @HasChecker, @IsVatTaxApplicable,
                    @AttachmentsJson, @LastModified
                );

                INSERT INTO WorkflowActionHistory (CaseAppId, ActionType, FromUser, FromRole, Comments, ActionDate)
                VALUES (@AppId, 'Submitted', @Initiator, @Designation, 'Initial Application Submission', @LastModified);
            ", model);

            return ApiResponse<string>.Success(randomAppId, "Application submitted successfully");
        }
        catch (Exception ex)
        {
            return ApiResponse<string>.Fail(ex.Message);
        }
    }
}

public class WorkflowActionRequest
{
    public string AppId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; // "Approve", "Query", "Clarify", "Review", "Forward", "Reject"
    public string PerformedBy { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Comments { get; set; } = string.Empty;
    public string? AttachmentsJson { get; set; } = null;
    public string? TargetRole { get; set; } = null;
}
