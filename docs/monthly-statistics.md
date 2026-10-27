# Aylık istatistikler

İlerleme sekmesinin üstünde ay seçimi ve aylık özet bulunur. Mevcut haftalık
raporlar “Haftalık detayları göster” bölümünde korunur.

## Hesaplama

- Aktif gün: seçili ayda antrenman kaydı bulunan farklı günler.
- Antrenman: ayrı seansların sayısı; aynı günün seansları birleştirilmez.
- Süre: yalnızca geçerli, pozitif süreler. Eksik süre yok sayılır.
- Uyku: yalnızca kayıtlı günler üzerinden ortalama; boş günler sıfır değildir.
- Kilo ve bel: ayın son geçerli ölçümü; fark için iki farklı günün ölçümü gerekir.
  Profil başlangıç değerleri aylık ölçüm gibi uydurulmaz.
- Devam eden ay önceki ayın aynı gün aralığıyla karşılaştırılır; kısa ayın
  son günü aşılmaz. Geçmiş aylar tam ay olarak karşılaştırılır.
- Gelecek tarihli ve geçersiz tarihli kayıtlar hesaba katılmaz.
- Kayıt olmayan günlere başarısızlık, puan veya tahmini kalori atanmaz.

Yeni tablo, ağ isteği veya kalıcı veri değişikliği yoktur. Hesaba ait mevcut
cihaz verileri hesaplanır. Eşitlenmemiş çevrimdışı kayıtlar cihazlar arasında
eşitleme tamamlanana kadar farklı görünebilir.

## Manuel test (web ve PWA)

1. İlerleme'yi aç: bu ay varsayılan görünmeli, kartlar taşmamalı.
2. Önceki aya geç, ay seçiciden başka ay seç, “Bu ay” ile geri dön.
3. Boş ayda ölçüm ve uyku için çizgi, anlaşılır boş durum mesajı görünmeli.
4. Aynı güne iki antrenman ekle: seans 2 artmalı, aktif gün yalnızca 1 artmalı.
5. Kaydı düzenle/sil: aylık toplamlar değişmeli; diğer hesap etkilenmemeli.
6. Bir ve iki farklı güne ölçüm ekle: fark yalnızca ikinci durumda görünmeli.
7. Haftalık detayları aç: mevcut grafikler ve listeler görünmeli.
8. Koyu/açık tema ve dar telefon ekranını kontrol et; yatay taşma olmamalı.
9. Yeni sürümü çevrimiçi bir kez yükledikten sonra çevrimdışı aç; aylık ekran
   cihazda bulunan kayıtlarla çalışmalı. Tekrar çevrimiçi eşitlemeyi kontrol et.

Otomatik doğrulama: node --test tests/*.test.mjs
