# Tool Ý Tưởng

Tìm ý tưởng, viết kịch bản và tạo prompt ảnh cho kênh YouTube.
Chạy trên Windows và macOS. Toàn bộ giao diện tiếng Việt.

Đây là khâu đầu của dây chuyền: **Tool Ý Tưởng** → *Flow Automation Studio*
(Veo 3) → *CapCut Draft Studio*. Ba tool nối với nhau bằng file, mỗi tool vẫn
chạy độc lập được.

---

## Có gì mới

### 0.4.0 — thumbnail, ô tick "Video đã chọn", màn Đề xuất video, ưu tiên kênh nhỏ Mỹ

**Thumbnail + ô tick ở mọi bảng kết quả** (Ý tưởng, Đề xuất video, Kênh theo dõi).
Tick ô đầu dòng là video vào danh sách **Video đã chọn** — số đếm hiện ở thanh
bên trái, và cả 4 màn Sản xuất đều có khối Video đã chọn với nút riêng:

| Màn | Dùng video đã chọn để làm gì |
|---|---|
| Lời thoại | Nạp link vào ô, hoặc lấy lời thoại ngay |
| Kịch bản | Đưa tiêu đề + số liệu vào prompt dàn ý làm "video tham khảo" (prompt dặn rõ không chép tiêu đề, không bám cấu trúc) |
| Kiểm duyệt | Lấy lời thoại video gốc làm **bản so độ giống** — trước đây ô này có trong code nhưng giao diện luôn gửi rỗng |
| Prompt ảnh | Tải thumbnail vào `<dự án>/anh-tham-chieu` làm ảnh tham chiếu phong cách |

Danh sách lưu ở tệp **riêng** `video-da-chon.json`, không nhét vào tệp cài đặt:
nó đổi sau mỗi cú tick, trộn chung thì mỗi cú tick lại ghi đè cả tệp cài đặt —
một lần ghi hỏng là mất luôn khoá API.

**Tải thumbnail** (từng video bằng nút ⬇ trên ảnh, hoặc cả loạt đã tick). Ảnh ở
`i.ytimg.com`, không tốn quota. Cỡ lùi dần 1280 → 640 → 480 px vì không phải
video nào cũng có bản 1280. Hai bẫy đã xử lý:

- Video không có bản 1280px thì YouTube trả **ảnh xám 120×90** — nhiều lúc kèm
  mã 200 chứ không phải 404. Chỉ xét mã HTTP là lưu về cả trăm ảnh xám mà không
  ai biết. Tool xét thêm kích thước tệp.
- Tên tệp an toàn trên Windows (bỏ `<>:"/\|?*`, bỏ dấu chấm cuối tên), đánh số
  `001 - <tiêu đề> [mã video].jpg`.

Giao diện phải mở thêm `img-src https://i.ytimg.com` trong Content-Security-Policy
— thiếu dòng đó thì **mọi thumbnail vỡ im lặng**, không lỗi, không log. Kiểm thử
tầng 1 soi CSP, tầng 2 kiểm từng ảnh có thật sự vẽ ra không (`naturalWidth`).

**Màn Đề xuất video, hai thẻ:**

- **Radar đề xuất (trình duyệt).** YouTube Data API không cho biết video nào
  đang được thuật toán đẩy. Radar đọc chính giao diện YouTube: tìm theo từ khóa
  lĩnh vực trên trang tìm kiếm thật (không tốn quota), lấy các video nhiều view
  nhất làm hạt giống, mở từng video bằng một cửa sổ ẩn **đã tắt tiếng**, đọc cột
  "video tiếp theo", cộng thêm trang chủ của tài khoản. Video được gợi ý cạnh
  **nhiều** hạt giống khác nhau = đang được đẩy mạnh (nhãn **ĐẨY MẠNH** khi có
  mặt ở ≥ 35% số nguồn, ít nhất 3). Quota chỉ ~2 đơn vị/50 video để ghép số view
  và sub; không có khoá API vẫn chạy được, chỉ thiếu sub và view/giờ.
  Dữ liệu đọc từ khối `ytInitialData` YouTube nhúng sẵn trong trang (đọc cả dạng
  renderer cũ lẫn `lockupViewModel` mới), có đường lùi đọc thẳng link trên trang
  nếu YouTube đổi cấu trúc.
- **Đang hot (API).** Bảng Thịnh hành Mỹ theo danh mục (1 đơn vị/50 video, tối
  đa 200) và tìm video **đang lên 72 giờ** theo từ khóa lĩnh vực.

**Mặc định Mỹ và ưu tiên kênh vừa & nhỏ.**

- Gợi ý từ khóa thêm `gl=us`. Trước đây chỉ có `hl=en` — Google trả gợi ý tiếng
  Anh nhưng **theo vị trí thật của máy**, tức là theo người xem Việt Nam.
- Radar mở mọi trang với `hl=en&gl=US`.
- Bỏ video khai ngôn ngữ thoại khác tiếng Anh; trừ 0,4 điểm kênh khai quốc gia
  khác Mỹ. Kênh **để trống** hai mục này thì không bị trừ — rất nhiều kênh Mỹ
  không điền.
- Kênh **1.000–100.000 sub** được +0,5 điểm, kênh lớn hơn −0,6, dưới 1.000 −0,2,
  kênh ẩn sub không cộng không trừ. Là cộng/trừ điểm chứ không loại hẳn (có công
  tắc loại hẳn trong Cài đặt). Có nút lọc nhanh "Chỉ kênh vừa & nhỏ".
- Khoá cài đặt cũ `subToiDaTrieu` bị bỏ khi đọc: ô sửa nó không còn trên giao
  diện, để nguyên là nó **lọc ngầm** kết quả mà không ai biết vì sao.

**Hai lỗi bắt được trong lúc làm:**

- `404` của bảng Thịnh hành khi danh mục không có bảng ở Mỹ (`videoChartNotFound`)
  sẽ bị luật "404 là lỗi của tool" (từ bản 0.3.1) dịch nhầm thành lỗi của tool.
  Nay nhận riêng mã này và bảo chọn danh mục khác.
- Radar: từ khóa "bible **stories**" không khớp tiêu đề có "bible **story**" vì
  chỉ xử lý thêm "s" vào cuối từ. Nay so theo gốc từ (`stories → story`). Ca
  kiểm thử bắt được trước khi giao.

**Màn Trình duyệt** nay có khối giải thích nó nối với các màn khác thế nào, kèm
nút mở nhanh YouTube (Mỹ), claude.ai và sang Radar. Bấm thumbnail ở bất kỳ bảng
nào là video mở ngay trong trình duyệt của tool.

**Giới hạn phải nói thẳng:** API **không** cho biết khán giả của kênh người khác
ở nước nào — tool chỉ dùng được các dấu hiệu gần nhất (tìm theo khu vực Mỹ, gợi
ý theo người xem Mỹ, ngôn ngữ và quốc gia chủ kênh tự khai). Radar phụ thuộc giao
diện YouTube: YouTube đổi cấu trúc trang là phải sửa, và mở nhiều trang liên tục
có thể bị hỏi xác minh — tool dừng lại, báo rõ và bảo mở màn Trình duyệt để xác
minh bằng tay.

### 0.3.1 — sửa lỗi làm màn Ý tưởng tìm gì cũng ra 0 video

Từ bản 0.1.0 tới 0.3.0, **màn Ý tưởng chưa bao giờ tìm được video nào**. Mọi
lời gọi đều bị YouTube trả về `HTTP 404`.

**Nguyên nhân.** Trong tài liệu của Google, các lời gọi được đặt tên theo kiểu
`resource.method` — `search.list`, `videos.list`. Đó là **tên phương thức**,
dùng để tra bảng giá quota. **Đường dẫn HTTP** thì chỉ có tên tài nguyên:
`/youtube/v3/search`. Tool ghép thẳng tên phương thức vào URL, thành
`/youtube/v3/search.list` — một địa chỉ không tồn tại.

**Vì sao ba bản liền không bắt được.** Ca kiểm thử tầng 1 có nhồi hàm mạng giả
và có soi URL, nhưng chỉ soi các **tham số**: `q`, `type`, `publishedAfter`,
`key`. Tức là kiểm đúng những gì mình đã nghĩ tới, còn chỗ sai lại nằm ở phần
đường dẫn không ai soi. Nay có bốn ca khẳng định **nguyên văn đường dẫn**, và
một ca quét toàn bộ bảng giá quota để bảo đảm không lời gọi nào để lọt `.list`
vào URL.

**Cách phân biệt về sau, để khỏi nghi oan cho khoá API:**

| Mã lỗi | Nghĩa thật |
|---|---|
| `404` | **Lỗi của tool** — gọi sai địa chỉ. Khoá vẫn nguyên, quota không bị trừ. |
| `403` + `quotaExceeded` | Hết quota hôm nay, chờ tới 0h giờ Pacific |
| `403` khác | Khoá sai, hoặc chưa bật YouTube Data API v3, hoặc đặt nhầm Application restrictions |
| `400` | Sai tham số |

Tool nay dịch riêng mã 404 thành câu nói rõ đây là lỗi của tool chứ không phải
lỗi khoá.

Hai lỗi nhỏ hơn cũng lộ ra trong cùng một nhật ký:

- **Từ khóa trùng bị chọn hai lần.** Gợi ý của YouTube trả về đủ kiểu hoa
  thường và khoảng trắng thừa, nên `"bible stories black"` và
  `"Bible Stories Black "` lọt qua phép so chuỗi thô thành hai từ khóa khác
  nhau — mỗi lần trùng là ném đi **100 đơn vị quota** để tìm lại y hệt. Nay so
  bằng dạng đã chuẩn hoá.
- **"undefined nổ view".** Khi không có video nào, hàm trả về thiếu hẳn trường
  đếm, giao diện in ra `undefined` — trông như hỏng nặng trong khi chỉ là không
  có kết quả. Nay luôn trả 0, và nếu mọi từ khóa đều lỗi thì ghi chú chỉ thẳng
  sang màn Nhật ký.

### 0.3.0 — chạy riêng từng tính năng, nhận tệp Word, tự cập nhật

**Từng màn dùng riêng được.** Trước đây muốn dùng Prompt ảnh là phải đi vòng
qua màn Kiểm duyệt, vì nó đọc ké ô nhập của màn đó — đúng kiểu ràng buộc chéo
làm người ta không dùng lẻ được một tính năng. Nay:

- **Lời thoại** có *Chế độ nhanh*: dán một link, lấy lời thoại, chép hoặc lưu
  ra tệp — không cần tạo dự án. Hai nút "Đẩy sang Kiểm duyệt / Prompt ảnh" là
  cầu nối **tuỳ chọn**, dùng khi muốn nối, không dùng thì mỗi màn vẫn chạy riêng.
- **Prompt ảnh** có ô kịch bản riêng của nó.
- Các khối chạy độc lập viền tím để nhìn ra ngay.

**Nhận tệp Word (.docx) ở cả ba màn** Lời thoại, Kiểm duyệt và Prompt ảnh, cộng
`.txt .md .srt .vtt .rtf`. Tự bóc chữ bằng `jszip` (thuần JavaScript, không có
module native nên không làm vỡ build CI) thay vì gọi thư viện chuyển đổi nặng.
Hai chỗ phải cẩn thận:

- **Không** lấy kiểu "xoá hết thẻ rồi giữ phần còn lại". Word nhét cả mã trường
  (số trang, mục lục, ngày tự động) vào cùng tài liệu, bóc kiểu đó là dính rác
  vào giữa kịch bản. Chỉ lấy đúng nội dung các thẻ `<w:t>`.
- Ngắt dòng mềm `<w:br/>` phải quét **cùng lượt** với chữ. Làm hai lượt thì cái
  xuống dòng vừa chèn nằm ngoài thẻ `<w:t>` và bị loại ở bước gom — hai dòng
  dính liền thành "Trướcsau khi xuống dòng", không lỗi, không log.

**Mô tả cảnh nhận cả JSON lẫn prompt thường.** JSON mang theo từng trường riêng
nên ghép được qua template và chèn mô tả nhân vật, nhưng hỏng một dấu phẩy là vỡ
cả lô. Prompt thường mỗi dòng một prompt, chịu được lời dẫn và cắt ngang, dùng
nguyên văn. Dán kiểu nào tool cũng tự nhận ra. Một điểm cố ý: **JSON vỡ thì báo
vỡ JSON**, không âm thầm hạ xuống đọc từng dòng — làm vậy sẽ biến một lô hỏng
thành hàng chục prompt rác mà người dùng không biết.

**Tự tải và tự cài bản cập nhật**, có thanh tiến độ theo phần trăm và MB/s, cùng
hai tuỳ chọn: tự tải ngầm khi thấy bản mới, và tự cài lúc đóng app. Ba giới hạn
thật, tool nói thẳng ngay trên màn Cài đặt chứ không để bấm nút rồi ngồi đợi:

| Trường hợp | Kiểm tra | Tải | Tự cài |
|---|---|---|---|
| Windows bản Setup | ✔ | ✔ | ✔ |
| Windows bản Portable | ✔ | ✔ | ✘ không có trình cài đặt |
| macOS (chưa ký số) | ✔ | ✔ | ✘ macOS bắt buộc chữ ký hợp lệ mới thay được chính nó |
| Chạy từ mã nguồn | ✘ | ✘ | ✘ |

Kiểm thử tầng 2 nay **cuộn tới và chụp riêng các khối nằm dưới tầm nhìn** — nút
bị cắt ở cuối trang cũng không ném exception nào.

### 0.2.0 — đủ cả sáu màn, chạy hết chuỗi sản xuất

Bản 0.1.x mới chỉ có màn Ý tưởng. Bản này làm nốt năm màn còn lại.

**Kênh theo dõi.** Quét một kênh tốn đúng **3 đơn vị quota**
(`channels.list` + `playlistItems.list` + `videos.list`), nên theo 100 kênh mỗi
ngày chỉ mất 300 đơn vị — rẻ hơn một lượt tìm ở màn Ý tưởng tới hơn hai lần.
Mỗi lần quét ghi một mốc vào `lich-su/<kenhId>.jsonl`; có hai mốc cách nhau từ
12 giờ là tính được **tăng trưởng thật**, tín hiệu đáng tin hơn view/giờ vì
không phụ thuộc tuổi video. Trung vị của kênh tính **bỏ chính video đang xét ra
ngoài** — kênh mới ít video mà có một video nổ mạnh thì chính nó kéo trung vị
lên và tự che mất mình.

**Trình duyệt trong app.** Mỗi tài khoản là một
`session.fromPartition('persist:yt-<id>')`, cookie tách biệt hoàn toàn. Người
dùng **tự đăng nhập trong cửa sổ** — app không nhận, không lưu, không thấy mật
khẩu. Chỉ mở được YouTube, Google và Claude.

**Lời thoại.** yt-dlp tải theo yêu cầu (không đóng gói kèm, vì YouTube đổi giao
diện là bản cũ chết — có nút cập nhật riêng). Ưu tiên `json3` hơn `vtt`:
phụ đề tự động chạy **kiểu cuộn**, mỗi khung hình lặp lại nguyên văn dòng trước
rồi nối thêm vài chữ, parse thô là ra văn bản lặp 2–3 lần và cái lặp đó đi
thẳng vào kịch bản. Chỗ chồng lấn đếm **theo từ, không theo ký tự** — đếm ký tự
với ngưỡng 12 thì cụm "the room" (8 ký tự) lọt lưới.

**Kịch bản.** 11.000 từ **không xin một phát**: xin dàn ý 8 phần trước, rồi
từng phần một, mỗi phần kèm **sổ chống lặp** rút từ các phần đã viết (các cụm
4 từ đã dùng, các cách vào câu, các từ lặp nhiều) cộng 200 từ cuối của phần
trước để giọng không đứt mạch.

**Kiểm duyệt.** Chạy cục bộ, không gọi AI: cụm 4/8 từ lặp, câu gần trùng, bản
đồ nhiệt 40 khối để thấy **vòng lặp nằm ở đâu**, và **% trùng cụm 5 từ với lời
thoại gốc** — phép đo quan trọng nhất với kiểu kênh viết lại nội dung. Kèm bộ
luật chính sách sửa được (`src/bo-luat-chinh-sach.json`).

**Prompt ảnh.** 11.000 ÷ 27 ≈ **408 cảnh**, nên có tuỳ chọn gộp 2 cảnh một ảnh
(còn ~204 ảnh). Kho nhân vật chèn **nguyên văn** đoạn mô tả cố định vào mọi cảnh
có nhân vật đó — thứ duy nhất thật sự giữ được mặt giống nhau qua hàng trăm
cảnh. Xuất `prompts.txt`, `prompts.xlsx`, `scenes.json`, `ten-anh.txt`.

Hai lỗi bắt được khi soi ảnh chụp giao diện và một lỗi bắt được nhờ kiểm thử:

- `/age/i` trong phần dịch lỗi yt-dlp khớp luôn vào chữ "web**page**", nên mọi
  lỗi tải trang đều bị báo nhầm thành "video giới hạn độ tuổi" — người dùng đi
  tìm cookie trong khi thật ra chỉ cần cập nhật yt-dlp.
- Ô chọn "Gộp cảnh" bị ép rộng 92px nên "1 cảnh = 1 ảnh" hiện ra thành "1 cảnh :".
- Khung trình duyệt lúc chưa có tab là một ô đen trống trơn, trông như đã hỏng.

### 0.1.1 — sửa khâu đóng gói, chưa đổi gì trong tool

Bản 0.1.0 dựng được `.exe` nhưng không phát hành lên Releases được. Hai nguyên
nhân, cả hai đều nằm ở cấu hình chứ không phải ở mã của tool:

- **Hai bản build ghi đè lên nhau.** `artifactName` khai chung một dòng cho mọi
  target, mà `nsis` (bản cài) và `portable` (bản chạy thẳng) đều ra đuôi `.exe`
  → cùng tên `Tool Y Tuong-0.1.0-x64.exe`. Bản portable đè bản Setup ngay trên
  đĩa, rồi lúc tải lên GitHub phải xoá file cũ tải lại, và chết giữa chừng ở đó
  (`already exists on GitHub` → `Request timed out`). Nay mỗi target có tên
  riêng: `...-Setup.exe` và `...-Portable.exe`.
- **Thiếu `--publish` ghi rõ.** Bỏ trống thì electron-builder tự phát hiện đang
  chạy trong CI rồi ngầm bật chế độ publish (*"Implicit publishing triggered by
  CI detection"*) và chết vì không thấy `GH_TOKEN` — build đúng mà vẫn đỏ, log
  thì toàn stack trace của `PublishManager` nên rất dễ đổ oan cho khâu đóng gói.

Workflow cũng được bọc vòng lặp thử lại 3 lần cho khâu tải lên, phòng khi mạng
của máy chủ GitHub chập chờn thật.

**Bản nháp trên Releases.** electron-builder mặc định tạo Release ở dạng
**nháp** (`releaseType` mặc định là `draft`). Bản nháp chỉ chủ repo mới thấy và
**không hiện ở mục Releases ngoài trang chủ**, nên xong build mà nhìn vào thấy
trống trơn như chưa có gì — trong khi file `.exe` đã nằm sẵn trong đó. Từ bản
này trở đi cấu hình đặt `"releaseType": "release"` để phát hành thẳng, khỏi phải
vào bấm Publish tay.

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
| 1. Logic thuần | `node tests/run.js` | ghép từ khóa, đếm quota, chấm điểm, lọc Shorts, hợp đồng API, store, xuất Excel, thumbnail, video đã chọn, radar đề xuất (URL nguyên văn + đọc ytInitialData mẫu) |
| 2. Giao diện | `YT_SMOKE=1 npx electron --no-sandbox .` | thiếu màn, thiếu phần tử, **thiếu khoá cài đặt**, lớp phủ che giao diện, **thumbnail có vẽ ra không**; nạp dữ liệu mẫu rồi chụp ảnh từng màn vào `shots/` |

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
- **Radar đề xuất trên YouTube thật** — tầng 1 chạy bằng dữ liệu `ytInitialData`
  mẫu dựng theo cấu trúc YouTube đang dùng; cấu trúc thật có thể lệch, và chưa
  biết YouTube có hỏi xác minh sau bao nhiêu trang
- Tải thumbnail từ `i.ytimg.com` thật (tầng 1 dùng hàm mạng giả)

Khi có lỗi: mở màn **Nhật ký**, gửi nguyên file log. **Dòng cuối cùng** định vị
chính xác chỗ chết — ảnh chụp màn hình thường không đủ.
