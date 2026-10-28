# Safari ve ay seçimi düzeltmesi

- Ay seçici tam genişlikte tek satırdadır; gezinme düğmeleri ayrı satırdadır.
- Ekran görüntüsündeki eski native month alanı son karşılaştırma ekranında yoktur.
- Harici Google Fonts ve jsDelivr istekleri ilk HTML'den çıkarıldı. Aynı DM Sans
  ve DM Mono yazı tiplerinin Latin/Türkçe woff2 alt kümeleri uygulamaya alındı
  (@fontsource-variable/dm-sans 5.3.0, @fontsource/dm-mono 5.3.0, SIL OFL).
- Chart.js 4.5.1 resmi npm paketinden aynı kökene alındı; grafik ve fallback korunur.
- Yeni dosyalar worker'ın atomik önbelleğine eklenir. Paket lisansları dahildir.
- Worker kaydı window.load olayını beklemez. Ön planda kontrollü güncelleme kontrolü
  yapılır; yeni worker açıldığında yenileme teklifi gösterilir. Kullanıcı onayı
  olmadan otomatik sayfa yenilemesi veya veri/oturum/önbellek sıfırlaması yapılmaz.

Bu, bekleyebilen harici kaynakları giderir; kullanıcının Safari ağ izine erişim
olmadan yarıda kalan yükleme göstergesinin kesin nedeni kanıtlanmış değildir.

## Telefonda test

1. Birleştirme ve canlı yayın sonrası Safari'de normal uygulama adresini açın.
2. Eski sürüm görünürse sekmeyi kapatıp yeniden açın; yeni sürüm teklifi varsa
   formları kaydedip yeni sürümü açın. Site verilerini silmek gerekmez.
3. Yükleme göstergesini, grafik ve Türkçe harfleri kontrol edin.
4. İlerleme'de ay seçici ve önceki/sonraki düğmelerinin ayrı satırlarda olduğunu
   dar ekran, yatay yön ve büyük metin ayarlarıyla kontrol edin.
5. Safari Paylaş → Ana Ekrana Ekle → Ekle yolunu deneyin. İşlem görünmüyorsa
   Paylaş listesinin altındaki Eylemleri Düzenle bölümünden eklenebilir.
6. PWA'yı bir kez güncel dosyalarla açıp çevrimdışı deneyin. Kayıtlar korunmalı.

Kaynaklar:
- https://www.chartjs.org/docs/latest/getting-started/installation.html
- https://support.apple.com/guide/iphone/iphea86e5236/ios

Supabase değişikliği yoktur. Fiziksel iPhone doğrulaması kullanıcıyla yapılmalıdır.
