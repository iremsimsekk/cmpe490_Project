using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.IO;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// =======================
// CORS AYARI
// =======================
var MyAllowSpecificOrigins = "_myCustomCorsPolicy";

builder.Services.AddCors(options =>
{
    options.AddPolicy(MyAllowSpecificOrigins, policy =>
        policy
            // Vercel frontend URL'ini BURAYA yaz
            .WithOrigins("https://SENIN-FRONTEND.vercel.app")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

app.UseCors(MyAllowSpecificOrigins);

// =======================
// PORT AYARI (RAILWAY İÇİN KRİTİK)
// =======================
var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Urls.Add($"http://0.0.0.0:{port}");

// =======================
// ENDPOINTLER
// =======================

// Test endpoint
app.MapGet("/", () => "✅ .NET Backend aktif — Railway üzerinde çalışıyor");

// Veri upload endpoint
app.MapPost("/api/upload", async (HttpRequest request) =>
{
    var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads");
    if (!Directory.Exists(uploadsDir))
        Directory.CreateDirectory(uploadsDir);

    using var reader = new StreamReader(request.Body);
    var body = await reader.ReadToEndAsync();

    string participantId = "unknown";
    try
    {
        var doc = JsonDocument.Parse(body);
        if (doc.RootElement.TryGetProperty("participantId", out var idElement))
            participantId = idElement.GetString() ?? "unknown";
    }
    catch (JsonException) { }

    var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
    var filePath = Path.Combine(uploadsDir, $"data_{participantId}_{timestamp}.json");

    await File.WriteAllTextAsync(filePath, body);

    Console.WriteLine($"✅ Veri kaydedildi: {filePath}");

    return Results.Ok(new { message = "Veri başarıyla kaydedildi (.NET)" });
});

app.Run();
