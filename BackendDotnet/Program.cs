using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.IO;
using System.Text.Json; // JsonDocument kullanıldığı için bu gereklidir.

var builder = WebApplication.CreateBuilder(args);

// CORS politikası adı tanımlama
var MyAllowSpecificOrigins = "_myCustomCorsPolicy";

// CORS ayarı → Angular'dan (Vercel'den) gelen isteklere izin ver
builder.Services.AddCors(options =>
{
    options.AddPolicy(MyAllowSpecificOrigins, policy =>
        // DİKKAT: Buradaki URL'yi Vercel'deki canlı uygulamanızın URL'siyle değiştirin.
        // ÖRNEK: "https://dikkat-deneyi.vercel.app"
        policy.WithOrigins("https://<VERCEL-CANLI-URL'NİZ>.vercel.app") 
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

// CORS kullanımını etkinleştirme
app.UseCors(MyAllowSpecificOrigins);

// Basit test endpoint
app.MapGet("/", () => "✅ .NET Backend aktif — /api/upload üzerinden veri alıyor");

// 📥 Katılımcı verilerini kaydet
app.MapPost("/api/upload", async (HttpRequest request) =>
{
    // Yükleme dizini kontrolü
    var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads");
    if (!Directory.Exists(uploadsDir))
        Directory.CreateDirectory(uploadsDir);

    // İstek gövdesini oku
    using var reader = new StreamReader(request.Body);
    var body = await reader.ReadToEndAsync();
    
    // Katılımcı ID'sini al
    string participantId = "unknown";
    try
    {
        var doc = JsonDocument.Parse(body);
        if (doc.RootElement.TryGetProperty("participantId", out var idElement))
        {
            participantId = idElement.GetString() ?? "unknown";
        }
    }
    catch (JsonException)
    {
        // JSON parsing hatası durumunda "unknown" olarak kalır
    }

    // Dosya yolunu oluştur
    var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
    var filePath = Path.Combine(uploadsDir, $"data_{participantId}_{timestamp}.json");
    
    // Dosyaya yaz
    await File.WriteAllTextAsync(filePath, body);

    Console.WriteLine($"✅ Veri kaydedildi: {filePath}");
    return Results.Ok(new { message = "Veri başarıyla kaydedildi (.NET)" });
});

app.Run();