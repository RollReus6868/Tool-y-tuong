# Tool Ý Tưởng

Tìm ý tưởng, viết kịch bản và tạo prompt ảnh cho kênh YouTube.
Chạy trên Windows và macOS. Toàn bộ giao diện tiếng Việt.

Đây là khâu đầu của dây chuyền: **Tool Ý Tưởng** → *Flow Automation Studio*
(Veo 3) → *CapCut Draft Studio*. Ba tool nối với nhau bằng file, mỗi tool vẫn
chạy độc lập được.

---

## Có gì mới

### 0.1.0 — bản đầu tiên

- **Màn Ý tưởng chạy được trọn vẹn**: ghép từ khóa rời rạc thành 5 cụm đáng
  tìm nhất, tìm video nổ view trong 14 ngày, chấm điểm, lọc, xuất Excel.
- **Ghép từ khóa không tốn một đơn vị quota nào.** Việc sàng lọc làm bằng gợi ý
  tìm kiếm thật của YouTube (autocomplete) chứ không phải bằng `search.list` —
  mỗi lời gọi `search.list` tốn 100 đơn vị trong khi ngày chỉ có 10.000, đem 30
  ứng viên đi thử là hết sạch quota trong một lần bấm.
- **Đếm quota theo giờ Pacific.** Google reset lúc 0h giờ Los Angeles chứ không
  phải 0h giờ Việt Nam; đếm theo ngày địa phương thì cứ đến chiều là tool báo sai.
- **Phân biệt "hết quota" với "khoá sai".** Google trả 403 cho cả hai; báo nhầm
  thì mất công đi xin khoá mới trong khi chỉ cần chờ tới 0h giờ Pacific.
- Sửa lỗi lớp phủ hộp thoại hiện suốt làm **cả giao diện không bấm được**.
  Nguyên nhân: `#man-che { display:flex }` ở bộ chọn `#id` thắng luật
  `[hidden]{display:none}` của trình duyệt. Không có exception nào, ảnh chụp chỉ
  trông hơi tối — nên đã thêm hẳn một phép kiểm tự động vào tầng 2: hỏi trình
  duyệt "bấm vào giữa màn hình thì trúng phần tử nào".

Các màn **Kênh theo dõi / Lời thoại / Kịch bản / Kiểm duyệt / Prompt ảnh** đã có
trong giao diện nhưng chưa làm — mỗi màn ghi rõ sẽ có ở bản nào.

---

## Cài đặt

### Windows

Tải `Tool Y Tuong-<phiên bản>-x64.exe` ở mục **Releases**.

- Bản `Setup` là bản cài đặt bình thường.
- Bản `portable` chạy thẳng, không cài.

Lần đầu mở, Windows SmartScreen sẽ báo "Windows protected your PC" vì file chưa
mua chữ ký số (~400 USD/năm). Bấm **More info → Run anyway**.

### macOS

Tải `.dmg` đúng loại máy: `arm64` cho Mac chip M1/M2/M3/M4, `x64` cho Mac Intel.

App chưa ký số nên macOS sẽ báo *"Tool Y Tuong is damaged and can't be opened"*.
Đó **không phải** file hỏng — mở Terminal và chạy một lần:

```bash
xattr -dr com.apple.quarantine "/Applications/Tool Y Tuong.app"
```

Sau đó mở bình thường.

---

## Lấy khoá API YouTube — miễn phí, không cần thẻ

Có sẵn trong app ở màn **Hướng dẫn**. Tóm tắt:

1. [console.cloud.google.com](https://console.cloud.google.com) → đăng nhập Gmail bất kỳ
2. **New Project** → đặt tên `tool-y-tuong`
3. **APIs & Services → Library** → tìm `YouTube Data API v3` → **Enable**
4. **APIs & Services → Credentials → Create credentials → API key** → copy
5. Bấm **Edit** khoá → **API restrictions** → chọn riêng `YouTube Data API v3`
6. Dán vào **Cài đặt → Thêm khoá**

Không bật billing, không tạo OAuth consent screen. Nếu màn hình đang hỏi thẻ tín
dụng thì đó là trang khác — khoá API không đi qua bước đó.

**Chưa có khoá vẫn dùng được nửa tool**: bước ghép 5 từ khóa chạy bằng
autocomplete của YouTube, không cần khoá. Chỉ bước *Tìm video* mới cần.

---

## Quota — đọc trước khi dùng

| | |
|---|---|
| Hạn mức | 10.000 đơn vị/ngày cho mỗi khoá |
| `search.list` | **100 đơn vị** mỗi trang |
| `videos.list`, `channels.list`, `playlistItems.list` | 1 đơn vị (tối đa 50 mục) |
| Một lượt tìm 5 từ khóa × 25 video | ≈ 500–900 đơn vị |
| Tức là | **khoảng 12–19 lượt tìm mỗi ngày** |
| Reset | 0h giờ Pacific ≈ 14–15h giờ Việt Nam |
| Mua thêm | **Không bán.** Chỉ xin tăng qua form audit của Google, xét vài tuần |

Tạo nhiều project Google chỉ để nhân quota là **vi phạm điều khoản** và có thể bị
khoá toàn bộ project. Cách đúng khi thiếu quota: tắt bớt *Tính vượt trung vị
kênh*, giảm số video mỗi từ khóa, hoặc xin tăng quota.

---

## Chạy từ mã nguồn

```bash
npm ci
npm start
```

## Tự đóng gói

```bash
npm run dist:win     # chạy trên Windows → dist/*.exe
npm run dist:mac     # chạy trên macOS  → dist/*.dmg, dist/*.zip
```

Không dựng được bản Windows từ máy Mac hay ngược lại. Cách tiện nhất là để
GitHub dựng hộ cả hai:

```bash
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/build.yml` sẽ chạy tầng 1 trên cả Windows lẫn macOS, dựng
`.exe` + `.dmg` + `.zip` rồi đẩy lên Releases. Từ đó tính năng **Kiểm tra bản
mới** trong app tự thấy bản mới.

---

## Kiểm thử

| Tầng | Lệnh | Bắt được gì |
|---|---|---|
| 1. Logic thuần | `node tests/run.js` | ghép từ khóa, đếm quota, chấm điểm, lọc Shorts, hợp đồng API, store, xuất Excel |
| 2. Giao diện | `YT_SMOKE=1 npx electron --no-sandbox .` | thiếu màn, thiếu phần tử, **thiếu khoá cài đặt**, lớp phủ che giao diện; chụp ảnh từng màn vào `shots/` |

Tầng 2 chụp ảnh xong **phải mở ảnh ra xem bằng mắt**. Nút bị cắt, chữ vỡ dấu,
khoảng trống lệch — không thứ nào ném exception.

---

## Chưa nghiệm thu được

Những phần dưới đây chưa từng chạy thử lần nào, vì cần thứ mà môi trường phát
triển không có. Không được hiểu là "đã chạy tốt":

- Gọi YouTube Data API bằng **khoá thật** (toàn bộ tầng 1 chạy bằng hàm mạng giả)
- Gợi ý autocomplete với **mạng thật**
- Bản `.exe` trên **Windows thật** và bản `.dmg` trên **macOS thật**
- Tính năng tự cập nhật (chỉ chạy được khi đã đóng gói và đã có Release)

Khi có lỗi: mở màn **Nhật ký**, gửi nguyên file log. **Dòng cuối cùng** định vị
chính xác chỗ chết — ảnh chụp màn hình thường không đủ.
