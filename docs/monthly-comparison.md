# Aylık karşılaştırma revizyonu

Takvim ızgarası kaldırıldı. Antrenman (yürüyüş hariç), yürüyüş, kilo ve bel için
önceki dönem / seçili dönem / fark ve kayda dayalı açıklama gösterilir.

Devam eden ay önceki ayın aynı gün aralığıyla karşılaştırılır. Kısa aylarda
dönemin son günü aşılmaz; geçmiş aylar tam ay olarak karşılaştırılır.
Kilo ve bel farkı ay içindeki ilk-son farkı değil, iki dönemin son geçerli
ölçümleri arasındaki farktır. Ölçüm tarihleri değerlerin altında görünür.
Önceki dönemde ölçüm yoksa daha eski aydan değer taşınmaz; eksik uyarısı gösterilir.
Eksik süreler ve ölçümler sıfır sayılmaz; hareket kayıtlarının yokluğu hareketsizlik
olarak yorumlanmaz. Kilo/bel değişimi için sağlık veya başarı yargısı verilmez.

## Tasarım ve test

- Native month input yerine etiketli standart select, dar ekranda tek sütun.
- 44 px dokunma hedefleri, minmax(0,1fr), normal akış ve kapsamlı CSS seçicileri.
- Aydınlık/karanlık tema; mevcut haftalık grafikler korunur.
- tests/fixtures/monthly-preview.html yalnızca sentetik örnek kayıtlarla çalışır;
  oturum açmaz, gerçek hesaba veya Supabase'e bağlanmaz. Tasarım kontrolü içindir.
- 320 / 390 / 430 / 1280 px genişlikte ay seçici, dört kart ve temalar kontrol edilmeli.
- Antrenman 2→3, yürüyüş 1→2; kilo 102,5→100,8 ve bel 108→106 örnekleriyle
  yönler ve farklar kontrol edilmeli. Boş ay, tek taraflı ölçüm ve ay geçişleri denenmeli.
- Yeni sürüm worker önbelleği güncellendi. Supabase kurulumu yok; kayıtlar değiştirilmez.
