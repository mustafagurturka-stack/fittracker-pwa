# PWA CacheStorage açılış onarımı – 2026.10.28.3

## Kanıtlanan hata

Önceki worker gezinme isteğinde caches.open / cache.match işlemlerini try/catch
ve süre sınırı dışında bekliyordu. CacheStorage hata verdiğinde event.respondWith
reddediliyordu; ağ denemesi ve okunabilir hata sayfası devreye girmiyordu.
Aynı hata Fittracker, Notlar ve Bütçe kaynaklarıyla VM testinde yeniden üretildi:
"navigation rejected, network calls=0, CacheStorage unavailable".
Bu, fiziksel iPhone'daki siyah ekranın nedeninin kesin doğrulandığı anlamına gelmez.

## Değişiklik

- Cache API okuma/yazmalarına süre sınırı ve hata yakalama.
- Bozuk/erişilemeyen önbellekte ağdan açılış; ikisi de başarısızsa okunabilir HTML.
- Boş/HTML olmayan cache yanıtı açılış belgesi sayılmaz.
- HTML yanıtı yönlendirme bayrağı taşımayan yeni Response olarak kurulur;
  CSP dahil güvenlik başlıkları korunur, eski sıkıştırma/uzunluk başlıkları çıkarılır.
- Kaynak teslimi, isteğe bağlı cache.put işlemine takılmaz.
- Kurulumda CacheStorage hatası onarım worker'ının kurulmasını sonsuza dek engellemez.
  addAll başarılıysa aynı-sürüm kabuk atomiktir; başarısızsa ağ/önceki kabuk kullanılır.
- Aktivasyonda eski uygulama önbellekleri temizlenmez; IndexedDB, localStorage,
  auth oturumları ve push abonelikleri silinmez.
- Supabase/API/yazma istekleri cache'e alınmaz.
- Bildirim ve ikon sayacı işleyicileri aynen korunur.
- Kitaplık uygulaması değiştirilmedi.

## Doğrulama

Her uygulamada 15 hedefli worker testi:
normal önbellek; CacheStorage throw/hang; match throw/hang; cache+ağ hatası;
AbortSignal'ı yok sayan istek; boş HTML; header/CSP korunması;
gövde okumasının takılması; cache.put takılması; eksik kurulumda onarım;
hesap/başka uygulama cache'lerinin korunması; private API ayrımı; sürüm bypass.

Telefon doğrulaması yapılmadı. Canlı siteye erişim test ortamında zaman aşımına
uğradığından iOS kabul testi birleştirme/yayın sonrası kullanıcıyla yapılmalıdır.

## Tek telefon kabul testi

1. Önce yalnız bir uygulamanın PR'ını birleştirin (Notlar).
2. Yayın Ready olduğunda aynı canlı adresi Safari'de açıp yenileyin;
   worker güncellemesinin alınmasına izin verin. Açık formları önceden kaydedin.
3. PWA'yı uygulama değiştiricisinden kapatıp ikonundan yeniden açın.
4. Normal uygulama, giriş ekranı veya yeni "Uygulama açılamadı / Yeniden dene"
   sayfasından hangisinin geldiğini kaydedin. Siyah ekran sürüyorsa bu düzeltme
   kullanıcıdaki sorunu çözmüş sayılmaz; diğer uygulamaları yayımlamadan önce
   iOS sürümü ve görsel/açılış teşhisiyle devam edilmelidir.
5. Açılış doğrulanınca mevcut bir kaydı kontrol edin ve bildirim merkezine bakın.
6. Notlar'da sonuç alındıktan sonra Bütçe ve Fittracker PR'larını ayrı ayrı deneyin.

Uygulama kaldırma, site verilerini temizleme, oturum silme veya veritabanı işlemi gerekmez.

