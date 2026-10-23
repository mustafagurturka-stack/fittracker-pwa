# Yavaş bağlantıda güvenli başlangıç

## Ne değişir?

- HTML alınır alınmaz dış fonta/React'e ihtiyaç duymayan bir hazırlık ekranı bulunur. Dosyalar 8 saniyede yüklenmezse açıklama ve Yeniden dene gösterilir.
- Uygulama fontları açılışı engellemez. Üretim CSS'i de ilk hazırlık ekranının boyanmasını bloke etmeyecek biçimde yüklenir.
- Başarıyla kurulmuş PWA, kendi sürümüne ait kaydedilmiş HTML/JS/CSS dosyalarını ağ yanıtını beklemeden açar. Yeni SW ancak bütün aynı-sürüm dosyaları indiyse kurulur. Önceki bir statik önbellek açık eski sekmeler için tutulur; diğer uygulamaların önbellekleri silinmez.
- Bu, ilk kez açılan veya henüz dosyaları indirilmemiş bir uygulamanın internet tamamen engelliyken çalışacağını garanti etmez. HTML bile ulaşmıyorsa uygulama içindeki kod bağlantıyı onaramaz.
- Oturum ilk kontrolde 8 saniyede sonuçlanmazsa açıklama ve yeniden deneme gösterilir. Kayıtlar, bekleyen değişiklikler, şifre veya token silinmez. Yerel depodaki bir kullanıcı ID'si elle okunup doğrulanmış kullanıcı varsayılmaz; oturumu yalnız mevcut SDK belirler.
- Geç gelen eski başlangıç yanıtı yeni giriş/çıkış olayının üzerine yazamaz. Geç gelen geçerli SDK oturum olayı ekranı toparlayabilir. Şifre yenileme akışı korunur.
- Veritabanı, RLS, bildirim göndericileri/izinleri, kullanıcı içerikleri ve hesap anahtarları değişmez. Service worker yalnız aynı uygulamanın statik dosyalarını saklar; Supabase/API/POST yanıtlarını saklamaz.

## Uygulamaya özel

- Notlar: mevcut hesap bazlı yerel veri ve eşitleme kuyruğu korunur. Sürüm kontrolü app-version.json ve sw.js için ağdan/no-store sürer. Bildirim ve ikon sayaç işlemleri korunur.
- Bütçe: ilk kayıt okuması 8 saniyede kesilir. Başarısız okuma sıfır bakiye veya boş hesap gibi gösterilmez. Sonraki başarısız yenileme önceden yüklenen kayıtları boşaltmaz. Yazma işlemleri otomatik iptal/tekrar edilmez. Yeni worker açık formu zorla yeniden yüklemez.
- Kitaplık: mevcut hesap bazlı cache/çakışma/kuyruk mantığı korunur. İlk bulut READ isteğine süre sınırı eklenir; başarısız okumada yerel kitaplık sıfırlanmaz. Mevcut kullanıcı onaylı sürüm güncelleme akışı korunur.
- Fittracker: Supabase SDK 2.112.3 MIT lisansıyla uygulama içinde sabit sürüm olarak taşınır. CDN'den ilk SDK yüklemesi beklenmez. Grafik kütüphanesi isteğe bağlı/asenkron yüklenir; gelmezse mevcut yerel grafik yedeği kullanılır. SDK oturumu doğrulamadan yerel sağlık verisi açılmaz. Cloud verileri yerel görünümü bekletmeden arkadan yenilenir.

## Test ve yayın

1. Normal internetle uygulamayı açıp bir kez tam yüklenmesini bekleyin. PWA kurulumu henüz bitmediyse çevrimdışı hazır saymayın.
2. Web ve PWA'yı yeniden açın; hazırlık/oturum ekranı görünmeli, uzun beyaz ekran olmamalı.
3. Aynı cihazda Wi-Fi yavaşken veya internet kapalıyken yeniden açın. Kurulu kabuk açılmalı; oturum yenilenemiyorsa anlaşılır hata/yeniden deneme görünmeli. Giriş yapılmış gibi yanlış kullanıcı/cache gösterilmemeli.
4. Bağlantıyı geri getirin, yeniden deneyin. Aynı hesap verileri gelmeli; bekleyen kayıtlar ve bildirim ayarları korunmalı.
5. Açık form varken yeni sürüm indirilsin: otomatik sayfa yenilenmesi olmamalı. Yeni sürümü bilinçli yenileme/Kitaplık güncelleme düğmesiyle açın.
6. Bir hatırlatıcıya dokunma, ikon sayacı, şifre yenileme ve başka hesaba geçişi kısa regresyon kontrolünden geçirin. PWA'yı silmeyin veya site verilerini temizlemeyin.

Otomatik testler asılı ağ isteği, cache-first gezinme, tamamlanmamış kurulum, cache namespace ayrımı, API yanıtlarını saklamama, auth timeout/geç yanıt/çıkış yarışlarını sınar. Bu testler evdeki sağlayıcı/rota sorununu düzelttiğimizi veya gerçek iPhone teslim testini yaptığımızı kanıtlamaz.
