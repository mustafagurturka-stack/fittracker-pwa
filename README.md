# FitTracker

Kilo, bel, uyku ve antrenman takibi. Web ve iPhone PWA aynı Supabase hesabıyla senkron çalışır.

## Yapı
- `index.html` — tek sayfa, 5 ekran (Özet, Kilo, Kayıt, İlerleme, Profil)
- `scripts/app.js` — veri, senkron ve ekran çizimi
- `styles/main.css` — sade tasarım; açık/koyu tema, mobil + geniş ekran
- `fonts/` — gömülü DM Sans (OFL); internet olmadan da aynı görünüm
- `service-worker.js` — uygulama kabuğunu önbellekte tutar
- `supabase/migrations/` — veritabanına uygulanmış değişikliklerin kaydı

## Senkron kuralı
Bulut tek doğru kaynaktır. Cihazda bekleyen (henüz gönderilmemiş) değişiklikler buluttaki sürümün önüne geçer;
başka cihazda silinen kayıt geri yüklenmez. Antrenman ve notlar cihazda üretilen UUID ile kaydedilir, tekrar gönderim kopya oluşturmaz.

## Test
```bash
node --test tests/*.test.mjs
```

## Yayın
Vercel, `main` dalını otomatik yayınlar (derleme adımı yok).
