using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// CORS ayarı → Angular'dan gelen isteklere izin ver
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
        policy.WithOrigins("http://localhost:4200") // Angular'ın çalıştığı port
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

app.UseCors("AllowAngular");

// Basit test endpoint
app.MapGet("/", () => "✅ .NET Backend aktif — /api/upload üzerinden veri alıyor");

// 📥 Katılımcı verilerini kaydet
app.MapPost("/api/upload", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var body = await reader.ReadToEndAsync();

    var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads");
    if (!Directory.Exists(uploadsDir))
        Directory.CreateDirectory(uploadsDir);

    var participantId = System.Text.Json.JsonDocument.Parse(body)
        .RootElement.GetProperty("participantId").GetString();

    var filePath = Path.Combine(uploadsDir, $"data_{participantId}.json");
    await File.WriteAllTextAsync(filePath, body);

    Console.WriteLine($"✅ Veri kaydedildi: {filePath}");
    return Results.Ok(new { message = "Veri başarıyla kaydedildi (.NET)" });
});

app.Run();
