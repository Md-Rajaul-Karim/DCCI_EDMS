using EdmsApi.Data;
using Microsoft.AspNetCore.Http.Features;

var builder = WebApplication.CreateBuilder(args);

// Add Controllers and JSON settings
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

// Allow up to 200MB multipart body uploads (matching SRS specification)
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 209715200; // 200MB
});

// Add CORS for React Vite
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Ensure wwwroot and media directories exist
var webRoot = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
Directory.CreateDirectory(Path.Combine(webRoot, "media", "documents"));

// Initialize SQLite Database and Seed initial DCCI structure
var connectionString = app.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=edms.db";
DbInitializer.Initialize(connectionString, webRoot);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

// Loophole 7: Direct URL Security Guard - Block unauthenticated direct access to repository files
// All document retrieval must pass through authenticated DocumentController API endpoints (/api/Document/StreamPdf, /Download or /PublicStream)
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/media/documents"))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        context.Response.ContentType = "text/plain";
        await context.Response.WriteAsync("Forbidden: Direct repository file access is blocked by DCCI EDMS Security Policy. Access files via authorized API endpoints.");
        return;
    }
    await next();
});

app.UseStaticFiles();

app.MapControllers();

app.Run();
