---
name: kiem-duyet-kiem-tien-youtube
description: Dùng khi cần soi một kịch bản video YouTube (tiếng Anh, video dài, kể chuyện) trước khi sản xuất để tìm rủi ro bị tắt kiếm tiền cả kênh hoặc bị giới hạn/tắt quảng cáo từng video, và đề xuất cách sửa cụ thể.
---

# Kiểm duyệt kịch bản theo chính sách kiếm tiền YouTube

Phiên bản chuẩn: **2026-10-06.2**. Chính sách YouTube đổi vài lần mỗi năm — xem
mục "Nguồn" cuối tệp và cập nhật lại khi có thông báo mới.

Tệp này dùng được ở hai nơi:

- **Trong Tool Ý Tưởng** (màn Kiểm duyệt → Thêm skill kiểm duyệt): tool đọc khối
  mã JSON có khoá `"luat"` ở mục 5 để quét kịch bản ngay trên máy, và chèn phần
  chữ còn lại vào prompt "nhờ Claude soi lại".
- **Trong Claude**: làm theo mục "Cách soi một kịch bản".

## 1. Ba kiểu "mất tiền" — phải phân biệt, vì cách sửa khác nhau

| Kiểu | Hậu quả | Do đâu |
|---|---|---|
| **A. Tắt kiếm tiền CẢ KÊNH** | Kênh bị loại khỏi (hoặc không vào được) Chương trình Đối tác | Chính sách kiếm tiền cấp kênh: nội dung không chân thực, nội dung dùng lại, nhân vật AI đóng vai chuyên gia |
| **B. Video bị vàng / không quảng cáo** | Một video mất phần lớn hoặc toàn bộ doanh thu quảng cáo | Nguyên tắc nội dung thân thiện với nhà quảng cáo (14 nhóm) |
| **C. Gỡ video / gậy** | Video bị xoá, kênh nhận cảnh cáo | Nguyên tắc cộng đồng |

Với kênh viết lại lời thoại video người khác bằng AI, **kiểu A là rủi ro lớn
nhất** và không sửa được bằng cách đổi vài từ: YouTube xét **cả kênh**, không xét
từng video.

## 2. Kiểu A — chính sách kiếm tiền cấp kênh

### A1. Nội dung không chân thực (inauthentic content — tên cũ "repetitious content")

Giữa tháng 7/2026 YouTube viết lại chính sách này thành ba nhóm có ví dụ cụ thể.
YouTube nói đây là **làm rõ luật cũ**, không phải luật mới — nhưng từ đợt này các
kênh AI làm hàng loạt bị gỡ khỏi Chương trình Đối tác theo đúng ba nhóm dưới đây.
Câu hỏi YouTube đặt ra không còn là "người hay máy làm" mà là **"phần lõi có khác
nhau thật từ video này sang video khác không, và người xem có nhận được gì
không"**.

#### Nhóm 1 — Chung chung hoặc lặp lại (generic or repetitive)

Video trông như làm từ khuôn, xem vài video liên tiếp thấy na ná nhau.

- Không được: nội dung giống nhau hoặc lặp lại, ít giá trị giáo dục, ít bình luận;
  nhân vật bị đặt vào **cùng một tình huống với cùng một kết cục** hết video này
  tới video khác; trình chiếu ảnh hoặc chữ chạy gần như không có lời dẫn; nội
  dung AI làm từ **template chung, không độc đáo**, không có góc nhìn gốc của
  người làm.
- Được: mở đầu và kết thúc giống nhau nhưng phần thân khác hẳn; loạt video cùng
  nhân vật mà **mỗi tập một cốt truyện riêng**; dùng AI để viết, lồng tiếng, dựng
  hình khi vẫn thấy rõ ý đồ sáng tạo của người làm.

Dấu hiệu soi được từ kịch bản:

- Cùng một ý nói lại nhiều lần (câu gần trùng, hai đoạn cách xa nhau mà chung vốn
  từ) — thường để kéo dài thời lượng.
- **Trùng khuôn với kịch bản cũ của kênh**: che hết tên riêng và con số đi thì
  hai kịch bản gần như là một. Đây là kiểu "một khuôn, đổi danh từ".
- **Cốt truyện đúc sẵn**: "người nghèo giúp người lạ, không biết ông ta là tỷ
  phú", "bị coi thường rồi hoá ra là chủ", "kẻ xấu nhận quả báo ngay".
- **Thiếu chi tiết cụ thể**: không tên người, không nơi chốn, không năm tháng —
  "a poor boy", "a small town", "one day".
- Câu sáo của template AI ("let's dive in", "little did they know", "but here's
  the thing"…).
- Cả bài chỉ thuật lại, không có câu nào là nhận định, bài học, câu hỏi của riêng
  người kể.

Cách sửa: mỗi phần có ít nhất một đoạn nhận định riêng; đặt tên, nơi chốn, mốc
thời gian thật cho câu chuyện; cắt hẳn đoạn lặp ý chứ không diễn đạt lại; mỗi
video một cấu trúc mở bài và một kiểu kết khác nhau.

#### Nhóm 2 — Không thoả mãn hoặc gây khó chịu (unsatisfying or off-putting)

YouTube mô tả: nội dung **dựa nặng vào công thức thao túng cảm xúc**, **sao chép
format có sẵn tới mức các video thay thế được cho nhau**, hoặc **dùng gây sốc,
bất ngờ chỉ để kéo view**; nói rộng hơn là nội dung "thao túng cảm xúc, gây rối
loạn, vô nghĩa, gây sốc, hay theo cách tương tự làm người xem không thoả mãn mà
không đem lại giá trị sáng tạo, giáo dục hay giá trị khác đáng kể".

- Không được: chủ đề **bạo lực, mất mát lặp đi lặp lại mà không có mạch truyện**;
  khuôn mẫu **động vật gặp nạn, đau đớn kiểu cường điệu**; ghép các clip AI không
  liên quan, không nhất quán để gây sốc; hình ảnh, tình tiết **lừa người xem về
  sự kiện không có thật** — tin người nổi tiếng qua đời, thiên tai bịa.
- Được: cốt truyện liền mạch không sống nhờ gây sốc; góc nhìn riêng trên một
  format đang thịnh; giọng sáng tạo riêng dù có dùng công cụ AI; có giá trị giáo
  dục.

Dấu hiệu soi được từ kịch bản:

- Mật độ dày các câu ép cảm xúc ("this will break your heart", "you will cry",
  "restore your faith in humanity").
- Từ ngữ mất mát, chết chóc dày đặc suốt bài — phải tự hỏi câu chuyện có nguyên
  nhân, diễn biến, ý nghĩa không, hay chỉ xếp nỗi đau cạnh nhau.
- Động vật hoặc trẻ nhỏ bị bỏ rơi, đói, bị nhốt làm mồi cảm xúc.
- Mở bài hứa một điều ("you won't believe what happened next") mà thân bài không
  trả, hoặc trả rất muộn; các câu câu giờ ("more on that later", "stick around",
  "before we continue").
- Tin "vừa qua đời", "breaking news", "leaked footage" về người thật mà không có
  nguồn.

Cách sửa: trả lời lời hứa ở mở bài ngay trong 1–2 phút đầu; cho mỗi biến cố một
nguyên nhân và một hệ quả; bỏ câu ép cảm xúc, để chính chi tiết làm việc đó; mọi
tin về người thật phải có nguồn và ngày tháng; bỏ hết câu câu giờ.

#### Nhóm 3 — Nhân vật AI trong chủ đề nhạy cảm

AI tự nhận là người thật có chuyên môn về y tế, pháp lý, tài chính hoặc chính trị
("bác sĩ" AI chẩn bệnh, khuyên chữa; "host podcast" AI khuyên đầu tư; "luật sư" AI
tư vấn, diễn giải luật) thì kênh không được kiếm tiền.

Dấu hiệu: người kể xưng danh nghề nghiệp ("As a doctor, I…", "I'm a licensed…"),
hoặc ra lời khuyên trực tiếp ("you should stop taking…", "you should invest…").

Cách sửa: kể ở vai người dẫn chuyện, dẫn nguồn có tên ("theo bác sĩ X", "nghiên
cứu năm Y"), chuyển lời khuyên thành tường thuật.

### A2. Nội dung dùng lại (reused content)

Dùng nội dung đã có trên YouTube hoặc nơi khác **mà không thêm bình luận gốc
đáng kể, không biến đổi thực chất, không thêm giá trị giáo dục/giải trí**.

- Không được: sao chép hoặc tải lại nội dung nơi khác mà không biến đổi thực
  chất; ghép các khoảnh khắc lại gần như không có lời dẫn; **đọc lại văn bản, tin
  tức không phải của mình mà không thêm gì**; quảng bá nội dung của người khác.
- Được: dùng tư liệu để phân tích, phê bình; dựng lại có **cốt truyện và bình
  luận của mình**.

**Dấu hiệu soi được từ kịch bản**: tỷ lệ cụm 5 từ trùng với lời thoại gốc; trình
tự ý bám sát từng đoạn của một video gốc duy nhất; ví dụ, câu đùa, phép so sánh
lấy nguyên từ bản gốc.

**Cách sửa**: trộn 2–4 nguồn; dựng dàn ý theo trình tự của mình; thêm tư liệu tự
tra (mốc thời gian, số liệu, nguồn); viết lại các đoạn trùng bằng lời mình và
thêm nhận định.

## 3. Kiểu B — 14 nhóm nội dung không thân thiện với nhà quảng cáo

Quy tắc chung: **tả chi tiết, cổ vũ, hướng dẫn** thì mất quảng cáo; **nhắc tới,
tường thuật, giáo dục, phim tài liệu, không tả chi tiết** thì thường vẫn có.
Tiêu đề và thumbnail bị xét chặt hơn thân video.

| Nhóm | Vẫn đủ quảng cáo | Giới hạn | Không quảng cáo |
|---|---|---|---|
| Ngôn từ | Chửi nhẹ ("hell", "damn"), chửi vừa, chửi nặng cả ở 7 giây đầu (nới từ 7/2025) | Chửi vừa trong tiêu đề/thumbnail; chửi là trọng tâm suốt video | Chửi nặng trong tiêu đề/thumbnail; từ miệt thị, thù hận |
| Bạo lực | Bạo lực nhẹ, ít máu; tường thuật, tài liệu, tin tức | Thi thể có thương tích trong ngữ cảnh giáo dục | Tả cực kỳ ghê rợn; kích động, ca ngợi bạo lực; nội dung khủng bố |
| Người lớn | Lãng mạn, hôn; giáo dục giới tính không tả | Trò đùa chủ đề tình dục | Hành vi tình dục (kể cả ám chỉ), lời thoại khiêu dâm, đồ chơi tình dục |
| Gây sốc | Có ngữ cảnh giáo dục, không tả vết thương | Hình ảnh bộ phận cơ thể người/động vật có ngữ cảnh | Mục đích cả video là gây sốc |
| Hành vi nguy hiểm, thông tin không đáng tin | Pha nguy hiểm có kiểm soát | Tường thuật có thương tích nặng | Thử thách chết người; **thông tin y tế trái khoa học, bài vắc-xin** |
| Thù ghét, hạ thấp | Phê bình quan điểm, hành động; giáo dục | Dùng từ miệt thị nguyên văn để giáo dục | Hạ thấp một nhóm được bảo vệ; ca ngợi bạo lực với người khác; quảng bá nhóm thù hận |
| Ma tuý | Nhắc tới trong giáo dục, tài liệu, kịch bản hư cấu (nới từ 9/2026) | Kịch hoá tập trung vào việc dùng | Cổ vũ, hướng dẫn dùng hoặc điều chế, chỉ chỗ mua |
| Súng | Thảo luận luật súng; súng trong môi trường an toàn | Dùng súng ngoài môi trường kiểm soát | Chế, độ súng; hỗ trợ mua bán; trẻ em dùng súng |
| Vấn đề gây tranh cãi (xâm hại trẻ em, xâm hại tình dục, tự hại, tự tử, rối loạn ăn uống, bạo hành gia đình, phá thai) | Phòng ngừa; nhắc lướt; **kể hoặc kịch hoá KHÔNG tả chi tiết** (nới từ 1/2026, trừ xâm hại trẻ em và rối loạn ăn uống) | Xâm hại trẻ em là chủ đề chính dù không tả | Tả chi tiết; xâm hại trẻ em tả chi tiết; rối loạn ăn uống có chi tiết bắt chước được |
| Sự kiện nhạy cảm | Tường thuật, tài liệu, không khai thác | — | Trục lợi từ thảm kịch; nhồi từ khóa sự kiện để kéo view |
| Hỗ trợ hành vi gian dối | Báo chí, giáo dục | — | Dạy xâm nhập trái phép, nghe lén, làm giấy tờ giả, viết luận thuê |
| Không phù hợp trẻ em/gia đình | — | — | Nội dung người lớn trong video nhắm tới trẻ em |
| Thuốc lá | — | Nhắc tới | Quảng bá thuốc lá, vape |
| Khiêu khích, hạ nhục | Phê bình hành động | — | Bêu xấu, lăng mạ, quấy rối, vu khống một người hoặc một nhóm |

**Ghi chú riêng cho chính trị, chủng tộc, tôn giáo**: ba chủ đề này **không**
nằm trong danh sách cấm quảng cáo. Rủi ro nằm ở cách viết: cáo buộc không nguồn,
khái quát hoá cả một nhóm người (rơi vào "thù ghét"), lăng mạ cá nhân (rơi vào
"khiêu khích, hạ nhục"), hoặc nhân vật AI đóng vai nhà bình luận chính trị (rơi
vào A1). Từ 10/2026, tư liệu vì lợi ích công như phiên họp quốc hội, tranh luận
của chính phủ được nới để có quảng cáo.

## 4. Cách soi một kịch bản

1. Đọc cả bài một lượt, ghi **chủ đề chính** và **giọng kể** (ai đang nói, có
   xưng danh nghề nghiệp không).
2. Xét kiểu A trước (mục 2), lần lượt đủ ba nhóm: (1) chung chung hoặc lặp
   lại — lặp ý, cốt truyện đúc sẵn, thiếu chi tiết cụ thể, thiếu góc nhìn riêng;
   (2) không thoả mãn hoặc gây khó chịu — ép cảm xúc, đau thương không mạch
   truyện, lời hứa không trả, tin bịa; (3) AI đóng vai chuyên gia. Rồi tới nội
   dung dùng lại.
3. Xét kiểu B (mục 3): với mỗi đoạn chạm chủ đề nhạy cảm, hỏi *"đoạn này nhắc
   tới hay tả chi tiết? tường thuật hay cổ vũ, hướng dẫn?"*.
4. Xét riêng **75 từ đầu** (≈ 30 giây) và câu nào có thể thành tiêu đề.
5. Báo cáo theo bảng: `mức (ĐỎ/VÀNG) · kiểu (A/B/C) · trích đúng câu · vì sao ·
   viết lại thế nào`. Đề xuất phải là **câu viết lại cụ thể**, không phải lời
   khuyên chung.
6. Kết luận một dòng: `AN TOÀN ĐỂ SẢN XUẤT` / `SỬA RỒI SẢN XUẤT` / `VIẾT LẠI`.

**Giới hạn phải nói thẳng**: soi kịch bản không thấy được hình ảnh, thumbnail,
tiêu đề, giọng đọc, cũng không thấy được các video khác của kênh. Không có cờ
nào **không** có nghĩa là chắc chắn giữ được kiếm tiền.

## 5. Bộ luật cho máy quét

Mỗi luật: `ma` (duy nhất — skill thêm sau trùng `ma` sẽ **thay** luật cũ),
`ten`, `nhom` (`kenh` = kiểu A, `quang-cao` = kiểu B, `cong-dong` = kiểu C),
`nhomCon` (chỉ cho kiểu A: `chung-chung` / `kho-chiu` / `ai-chuyen-gia` — quyết
định cờ rơi vào dòng nào của bảng rủi ro),
`mucDo` (`đỏ` / `vàng`), `tuKhoa` (khớp nguyên cụm, không phân biệt hoa thường)
và/hoặc `mau` (biểu thức chính quy), `giaiThich`, `huongSua`. Tuỳ chọn:
`toiThieuLan` (ít hơn số lần này thì không gắn cờ), `nguongMoi1000Tu` (mật độ
dưới mức này thì không gắn cờ), `phamVi: "mo-dau"` (chỉ xét
75 từ đầu), `loai: "phai-co"` (gắn cờ khi **thiếu** — kèm `toiThieuMoi1000Tu` và
`soTuToiThieu`).

```json
{
  "phienBan": "2026-10-06.2",
  "luat": [
    {
      "ma": "thieu-goc-nhin",
      "nhomCon": "chung-chung",
      "ten": "Không thấy dấu hiệu nhận định riêng của người kể",
      "nhom": "kenh",
      "mucDo": "vàng",
      "loai": "phai-co",
      "toiThieuMoi1000Tu": 0.5,
      "soTuToiThieu": 400,
      "tuKhoa": ["i think", "i believe", "i suspect", "i've always", "in my view", "in my opinion", "my take", "what strikes me", "what stands out", "what this means", "what this tells us", "what most people miss", "the lesson", "this matters because", "why does this matter", "why it matters", "ask yourself", "consider this", "notice how", "think about that", "here's what"],
      "giaiThich": "YouTube tắt kiếm tiền nội dung AI làm từ khuôn 'không có góc nhìn gốc, chân thực của người làm'. Kịch bản chỉ thuật lại sự việc thì rơi đúng vào đó. Đây là phép đếm cụm từ nên chỉ là tín hiệu: bài có nhận định nhưng diễn đạt kiểu khác vẫn có thể bị gắn cờ.",
      "huongSua": "Mỗi phần thêm ít nhất một đoạn là nhận định của riêng anh: chuyện này nói lên điều gì, vì sao hôm nay còn đáng kể, điều các video khác bỏ sót."
    },
    {
      "ma": "khuon-mau",
      "nhomCon": "chung-chung",
      "ten": "Câu sáo của kịch bản AI làm theo khuôn",
      "nhom": "kenh",
      "mucDo": "vàng",
      "toiThieuLan": 2,
      "tuKhoa": ["in this video we will explore", "in today's video", "let's dive in", "let's dive into", "without further ado", "buckle up", "stay tuned till the end", "stick around until the end", "little did they know", "little did he know", "little did she know", "but here's the thing", "here's the kicker", "the rest is history", "in a world where", "it's important to note", "delve into", "a testament to", "rich tapestry", "embark on a journey", "smash that like button", "don't forget to like and subscribe"],
      "giaiThich": "Các cụm này xuất hiện y hệt trong hàng loạt video AI. Một câu thì không sao; nhiều câu, lặp qua nhiều video, là dấu hiệu 'làm hàng loạt từ khuôn' — nhóm 1 của chính sách nội dung không chân thực.",
      "huongSua": "Xoá hẳn, vào thẳng câu chuyện. Đổi cách mở bài giữa các video."
    },
    {
      "ma": "gay-soc",
      "nhomCon": "kho-chiu",
      "ten": "Công thức câu view, thao túng cảm xúc",
      "nhom": "kenh",
      "mucDo": "vàng",
      "tuKhoa": ["you won't believe", "you will not believe", "shocking truth", "they don't want you to see", "they don't want you to know", "what happened next", "gone wrong", "banned video", "deleted footage", "nobody is talking about", "before it's deleted", "watch until the end"],
      "giaiThich": "Nhóm 2 của chính sách nội dung không chân thực: nội dung 'dựa vào công thức thao túng cảm xúc' hoặc 'dựng để gây sốc chỉ nhằm câu view'. Lời hứa ở mở bài mà thân bài không trả cũng làm người xem bỏ sớm.",
      "huongSua": "Thay lời hứa mơ hồ bằng chính chi tiết cụ thể của câu chuyện."
    },
    {
      "ma": "cot-truyen-khuon",
      "nhomCon": "chung-chung",
      "ten": "Cốt truyện đúc sẵn kiểu video AI hàng loạt",
      "nhom": "kenh",
      "mucDo": "vàng",
      "tuKhoa": ["instantly regretted", "instantly regrets", "instant karma", "taught him a lesson", "taught her a lesson", "taught them a lesson", "what happens next will", "then this happened", "undercover boss", "had no idea who he was", "had no idea who she was", "had no idea who they were", "you won't believe who", "everyone was shocked when", "the whole room went silent", "left everyone speechless", "moments later"],
      "mau": ["\\b(unaware|not knowing|without knowing|never knowing|had no idea) (that )?(he|she|they|the \\w+) (is|was|were) (a|an|the) (billionaire|millionaire|ceo|owner|judge|boss|general|king|prince|princess|heir|famous)", "\\b(poor|homeless|simple|humble) (boy|girl|man|woman|waitress|janitor|maid|farmer|mechanic)\\b.{0,80}\\b(billionaire|millionaire|ceo)\\b"],
      "giaiThich": "Nhóm 1 (chung chung hoặc lặp lại): 'nhân vật bị đặt vào cùng một tình huống với cùng một kết cục' và 'cốt truyện theo khuôn'. Các cụm này là dấu vân tay của loại truyện AI sản xuất hàng loạt — kênh nào cũng kể đúng một chuyện với tên khác.",
      "huongSua": "Giữ sự kiện thật, bỏ bộ khung. Đặt tên, nơi chốn, năm tháng cho câu chuyện, và cho nó một kết cục mà người xem không đoán được từ tiêu đề."
    },
    {
      "ma": "keu-goi-tuong-tac",
      "nhomCon": "chung-chung",
      "ten": "Câu xin tương tác lặp lại",
      "nhom": "kenh",
      "mucDo": "vàng",
      "toiThieuLan": 3,
      "tuKhoa": ["type amen", "comment amen", "write amen", "type yes if", "comment yes if", "comment below where you", "comment where you are watching", "let me know in the comments", "share this video with", "like if you", "hit the like button", "subscribe if you", "before you scroll"],
      "giaiThich": "Mức này do tool tự đặt, YouTube không nêu riêng cụm nào. Câu xin tương tác chèn đều đặn và y hệt nhau giữa các video là một trong những thứ làm kịch bản 'đọc như hàng loạt' — và không đem lại gì cho người xem.",
      "huongSua": "Giữ nhiều nhất một lời mời ở cuối, viết riêng cho đúng video này."
    },
    {
      "ma": "thao-tung-cam-xuc",
      "nhomCon": "kho-chiu",
      "ten": "Câu ép cảm xúc dày đặc",
      "nhom": "kenh",
      "mucDo": "vàng",
      "toiThieuLan": 3,
      "tuKhoa": ["will break your heart", "will make you cry", "will leave you speechless", "broke everyone's heart", "heartbreaking", "heart-wrenching", "gut-wrenching", "you will cry", "bring you to tears", "brought everyone to tears", "tears streaming down", "burst into tears", "sobbing uncontrollably", "couldn't hold back the tears", "restore your faith in humanity", "faith in humanity", "will give you chills", "gave everyone chills", "wait for it", "what he did next", "what she did next", "nobody expected", "no one saw this coming", "prepare yourself"],
      "giaiThich": "Nhóm 2 (không thoả mãn hoặc gây khó chịu): nội dung 'dựa nặng vào công thức thao túng cảm xúc'. Một hai câu thì là văn kể chuyện; lặp đều suốt bài là công thức.",
      "huongSua": "Xoá câu bảo người xem phải cảm thấy gì. Kể chi tiết cụ thể rồi để họ tự cảm."
    },
    {
      "ma": "dau-thuong-lap-lai",
      "nhomCon": "kho-chiu",
      "ten": "Mất mát, chết chóc dày đặc suốt bài",
      "nhom": "kenh",
      "mucDo": "vàng",
      "toiThieuLan": 8,
      "nguongMoi1000Tu": 15,
      "mau": ["\\b(died|dies|dying|dead|death|deaths|funeral|coffin|grave|buried|orphan\\w*|widow\\w*|abandon\\w*|starv\\w*|grief|griev\\w*|mourn\\w*|tragedy|tragic|suffer\\w*|agony|weeping|wept)\\b"],
      "giaiThich": "Nhóm 2: 'chủ đề gây rối loạn như bạo lực, mất mát lặp đi lặp lại mà không có mạch truyện liền lạc'. Máy chỉ đo được MẬT ĐỘ, không đo được có mạch truyện hay không — ngưỡng 15 lần / 1.000 từ là do tool đặt.",
      "huongSua": "Tự hỏi với từng biến cố: nguyên nhân là gì, dẫn tới đâu, câu chuyện muốn nói gì. Biến cố nào chỉ để thêm nỗi đau thì cắt."
    },
    {
      "ma": "dong-vat-gap-nan",
      "nhomCon": "kho-chiu",
      "ten": "Động vật gặp nạn làm mồi cảm xúc",
      "nhom": "kenh",
      "mucDo": "vàng",
      "mau": ["\\b(dog|puppy|puppies|cat|kitten|horse|pony|animal|bird|elephant|bear|cub|deer|fawn|lamb|calf)s?\\b.{0,60}\\b(abandoned|starving|starved|chained|trapped|drowning|beaten|dying|left to die|crying|begging|whimper\\w*|shivering|bleeding|screaming)\\b", "\\b(abandoned|starving|chained|trapped|drowning|beaten|dying|shivering|bleeding)\\b.{0,30}\\b(dog|puppy|puppies|cat|kitten|horse|pony|animal|elephant|bear|cub|fawn|lamb)s?\\b"],
      "giaiThich": "Nhóm 2 nêu đích danh: 'khuôn mẫu chung chung hoặc chủ đề thao túng cảm xúc như động vật gặp nạn, hiểm nguy kiểu cường điệu'.",
      "huongSua": "Nếu là chuyện có thật thì nêu nguồn, nơi, ngày và kể cả kết cục. Nếu là tình tiết thêm vào để lấy nước mắt thì bỏ."
    },
    {
      "ma": "su-kien-bia",
      "nhomCon": "kho-chiu",
      "ten": "Tin về người thật hoặc sự kiện cần kiểm chứng",
      "nhom": "kenh",
      "mucDo": "vàng",
      "tuKhoa": ["breaking news", "just announced", "has just passed away", "confirmed dead", "found dead", "sad news about", "tragic news", "leaked footage", "leaked video", "caught on camera", "arrested live", "exposed on live tv", "minutes ago", "this just happened"],
      "giaiThich": "Nhóm 2: 'hình ảnh lừa người xem về sự kiện không có thật' — YouTube lấy ví dụ tin giả người nổi tiếng qua đời và thiên tai bịa. Máy không biết tin thật hay bịa; cờ này chỉ nhắc anh kiểm lại nguồn.",
      "huongSua": "Mỗi tin về người thật phải có nguồn và ngày tháng ngay trong lời dẫn. Không có nguồn thì bỏ. Truyện hư cấu thì nói rõ là hư cấu và đừng dùng tên người thật."
    },
    {
      "ma": "keo-dai-thoi-luong",
      "nhomCon": "kho-chiu",
      "ten": "Câu câu giờ, hứa mà chưa trả",
      "nhom": "kenh",
      "mucDo": "vàng",
      "toiThieuLan": 4,
      "tuKhoa": ["as i mentioned earlier", "as i said before", "as i said earlier", "like i said", "as we discussed", "as we saw earlier", "let's recap", "to recap", "before we continue", "before we get into", "before we begin", "but first", "we'll get to that", "we will get to that", "more on that later", "more on that in a moment", "stick around", "keep watching", "coming up", "later in this video", "at the end of this video", "i'll reveal", "i will reveal"],
      "giaiThich": "Mức này do tool tự đặt. Kéo dài thời lượng bằng nhắc lại và hoãn trả lời là thứ làm người xem bỏ giữa chừng — đúng nghĩa 'không thoả mãn'. Đọc kèm mục Lặp nội dung và bản đồ nhiệt.",
      "huongSua": "Trả lời lời hứa ở mở bài trong 1–2 phút đầu. Xoá các câu nhắc lại; nếu cần nối mạch thì nối bằng chi tiết mới."
    },
    {
      "ma": "ai-chuyen-gia",
      "nhomCon": "ai-chuyen-gia",
      "ten": "Người kể tự nhận là chuyên gia y tế, pháp lý, tài chính, chính trị",
      "nhom": "kenh",
      "mucDo": "đỏ",
      "tuKhoa": ["my medical advice", "my legal advice", "my patients", "my clients", "in my practice", "in my clinic", "as your financial advisor"],
      "mau": ["(?<=^|[.!?,;:\"]\\s*|\\band |\\bspeaking )as (a|an) (doctor|physician|surgeon|nurse|pharmacist|therapist|psychologist|psychiatrist|lawyer|attorney|financial advis[eo]r|accountant|cpa|political analyst)\\b", "\\bas your (doctor|physician|therapist|lawyer|attorney|accountant)\\b", "\\bi(?:'m| am) (a|an) (licensed|board[- ]certified|certified|practicing|registered|trained) ", "\\bi(?:'ve| have) been (a|an) (doctor|physician|nurse|lawyer|attorney|therapist|financial advis[eo]r)\\b", "\\bdr\\.? \\w+ here\\b"],
      "giaiThich": "Nhóm 3 của chính sách nội dung không chân thực: nhân vật AI đóng vai người thật có chuyên môn trong chủ đề y tế, pháp lý, tài chính, chính trị thì kênh không được kiếm tiền.",
      "huongSua": "Bỏ mọi câu xưng danh nghề nghiệp. Kể ở vai người dẫn chuyện và dẫn nguồn: 'theo bác sĩ X', 'nghiên cứu năm Y cho thấy'."
    },
    {
      "ma": "loi-khuyen-nhay-cam",
      "nhomCon": "ai-chuyen-gia",
      "ten": "Lời khuyên trực tiếp về sức khoẻ, tiền bạc, pháp lý",
      "nhom": "kenh",
      "mucDo": "vàng",
      "tuKhoa": ["guaranteed returns", "guaranteed profit", "get rich quick", "double your money", "risk-free investment", "this is not financial advice", "stop taking your medication", "you don't need a lawyer", "you don't need a doctor"],
      "mau": ["\\byou should (buy|sell|invest in|stop taking|start taking|sue)\\b"],
      "giaiThich": "Kênh AI mà ra lời khuyên y tế, tài chính, pháp lý trực tiếp là sát vạch 'nhân vật AI đóng vai chuyên gia'. Lời khuyên y tế trái khoa học còn mất quảng cáo theo nhóm 'thông tin không đáng tin'.",
      "huongSua": "Chuyển từ 'anh nên làm X' sang 'chuyện đã xảy ra là X', có nguồn."
    },
    {
      "ma": "tu-miet-thi",
      "ten": "Từ miệt thị, thù hận",
      "nhom": "quang-cao",
      "mucDo": "đỏ",
      "mau": ["\\bnigg(er|a)s?\\b", "\\bfaggots?\\b", "\\bkikes?\\b", "\\bspics?\\b", "\\bchinks?\\b", "\\bwetbacks?\\b", "\\btrann(y|ies)\\b", "\\bretards?\\b"],
      "giaiThich": "'Chửi cực nặng, gồm ngôn từ thù hận hoặc từ miệt thị' là không quảng cáo. Dùng nguyên văn để giáo dục, lịch sử thì ở mức giới hạn.",
      "huongSua": "Viết 'a racial slur' hoặc che bớt chữ, kể cả khi trích lời nhân vật lịch sử."
    },
    {
      "ma": "chui-the",
      "ten": "Chửi thề dày đặc",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "toiThieuLan": 6,
      "mau": ["\\bfuck\\w*", "\\bshit\\w*", "\\bbitch\\w*", "\\basshole\\w*", "\\bbastards?\\b", "\\bmotherfuck\\w*", "\\bcunts?\\b"],
      "giaiThich": "Chửi thề lác đác không còn bị phạt, kể cả ở 7 giây đầu (nới từ 7/2025). Cờ này bật khi chửi thành 'trọng tâm suốt video' — mức giới hạn quảng cáo. Chửi nặng trong TIÊU ĐỀ hoặc thumbnail thì mất hẳn quảng cáo.",
      "huongSua": "Giữ vài chỗ thật cần, bỏ phần còn lại. Tuyệt đối không đưa vào tiêu đề."
    },
    {
      "ma": "bao-luc",
      "ten": "Tả bạo lực ghê rợn",
      "nhom": "quang-cao",
      "mucDo": "đỏ",
      "tuKhoa": ["beheading", "graphic footage", "severed head", "blood spurted", "blood gushed", "pool of blood", "ripped apart", "torn to pieces", "skinned alive", "burned alive"],
      "mau": ["\\b(decapitat|mutilat|dismember|disembowel|eviscerat)\\w*", "(?<!\\bal )\\bgore\\b"],
      "giaiThich": "'Hành vi bạo lực và thương tích tả cực kỳ ghê rợn' là không quảng cáo; nặng hơn có thể bị gỡ. Nói CÓ chuyện gì xảy ra thì được — kể cả cái chết trong ngữ cảnh giáo dục, tài liệu, tin tức (làm rõ 8/2026).",
      "huongSua": "Nói kết cục, đừng tả cảnh: 'he was executed' thay cho mô tả từng chi tiết. Bỏ tính từ tả thương tích."
    },
    {
      "ma": "bao-luc-chung",
      "ten": "Bạo lực là chủ đề xuyên suốt",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "toiThieuLan": 12,
      "mau": ["\\b(murder|slaughter|massacre|tortur|stabb|strangl|butcher)\\w*", "\\bbloodbath\\b"],
      "giaiThich": "Từng từ thì không sao. Mật độ dày cho thấy bạo lực là trọng tâm của video — người xét duyệt sẽ nhìn kỹ cách tả. Chủ đề đau thương lặp đi lặp lại mà thiếu mạch truyện còn rơi vào nhóm 'gây khó chịu' của chính sách cấp kênh.",
      "huongSua": "Giữ sự kiện, cắt phần tả. Cho câu chuyện một mạch rõ: nguyên nhân, hậu quả, ý nghĩa."
    },
    {
      "ma": "kich-dong-bao-luc",
      "ten": "Kích động hoặc ca ngợi bạo lực",
      "nhom": "cong-dong",
      "mucDo": "đỏ",
      "tuKhoa": ["they deserve to die", "deserved to die", "should be shot", "should be hanged", "should be executed", "kill them all", "wipe them out", "had it coming"],
      "giaiThich": "'Kích động hoặc ca ngợi bạo lực' là không quảng cáo và có thể bị gỡ theo nguyên tắc cộng đồng.",
      "huongSua": "Thuật lại việc đã xảy ra, không phán ai đáng bị gì."
    },
    {
      "ma": "tinh-duc",
      "ten": "Nội dung tình dục",
      "nhom": "quang-cao",
      "mucDo": "đỏ",
      "tuKhoa": ["sex toy", "sex tape", "porn", "pornography", "orgasm", "blowjob", "handjob", "genitals", "erotic"],
      "mau": ["\\bmasturbat\\w*", "\\bhad sex\\b", "\\bhaving sex\\b"],
      "giaiThich": "'Hành vi tình dục, kể cả làm mờ hoặc ám chỉ' và lời thoại khiêu dâm là không quảng cáo. Lãng mạn, hôn, nói về quan hệ tình cảm thì bình thường.",
      "huongSua": "Dùng cách nói gián tiếp ('they became lovers', 'an affair') và không tả."
    },
    {
      "ma": "ghe-ron",
      "ten": "Chi tiết ghê rợn gây sốc",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "tuKhoa": ["rotting corpse", "decomposing body", "maggots", "entrails", "intestines spilled", "brain matter", "vomit", "feces", "pus"],
      "giaiThich": "Hình ảnh, mô tả bộ phận cơ thể để gây sốc: có ngữ cảnh thì giới hạn quảng cáo, mục đích cả video là gây sốc thì mất hẳn.",
      "huongSua": "Bỏ chi tiết, giữ sự việc."
    },
    {
      "ma": "y-te-sai",
      "ten": "Thông tin y tế trái khoa học",
      "nhom": "quang-cao",
      "mucDo": "đỏ",
      "tuKhoa": ["miracle cure", "cures cancer", "cure cancer naturally", "doctors don't want you to know", "big pharma hiding", "big pharma is hiding", "vaccine causes autism", "vaccines cause autism", "don't vaccinate", "natural remedy cures", "covid is a hoax", "detox cures", "reverses diabetes"],
      "giaiThich": "Khẳng định y tế trái với đồng thuận khoa học và nội dung bài vắc-xin là không quảng cáo; có thể bị gỡ.",
      "huongSua": "Bỏ khẳng định, hoặc tường thuật 'có người tin rằng…' kèm kết luận của cơ quan y tế."
    },
    {
      "ma": "thu-ghet",
      "ten": "Hạ thấp một nhóm người",
      "nhom": "quang-cao",
      "mucDo": "đỏ",
      "tuKhoa": ["inferior race", "master race", "subhuman", "white genocide", "great replacement", "go back to where they came from", "go back to where you came from"],
      "mau": ["\\b(all|those|these) (blacks|whites|jews|muslims|christians|mexicans|asians|immigrants|gays|women|men) (are|is)\\b", "\\b(jews|muslims|blacks|whites|immigrants|gays) are (the problem|to blame|destroying|taking over|ruining)\\b"],
      "giaiThich": "'Phát ngôn nhằm hạ thấp một nhóm được bảo vệ' (chủng tộc, tôn giáo, giới, xu hướng tính dục, quốc tịch…) là không quảng cáo và có thể bị gỡ.",
      "huongSua": "Nói về người cụ thể và hành động cụ thể, không khái quát cả nhóm."
    },
    {
      "ma": "cong-kich-ca-nhan",
      "ten": "Lăng mạ, bêu xấu cá nhân",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "toiThieuLan": 3,
      "tuKhoa": ["idiot", "moron", "scumbag", "lowlife", "degenerate", "piece of trash", "piece of garbage", "pathetic loser", "disgusting human", "clown", "imbecile", "dumbest"],
      "giaiThich": "Nhóm 'khiêu khích, hạ nhục': nội dung tập trung bêu xấu, lăng mạ một người hay một nhóm, công kích cá nhân ác ý, vu khống. Hay gặp nhất ở kịch bản chính trị.",
      "huongSua": "Phê bình việc họ làm, kèm dẫn chứng. Bỏ tính từ gán cho con người."
    },
    {
      "ma": "chinh-tri",
      "ten": "Chính trị và bầu cử",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "tuKhoa": ["trump", "biden", "harris", "obama", "election", "elections", "democrat", "democrats", "republican", "republicans", "congress", "senate", "white house", "impeachment", "ballot", "voter fraud", "rigged election", "stolen election", "deep state"],
      "giaiThich": "Chính trị không nằm trong danh sách cấm quảng cáo. Rủi ro nằm ở ba chỗ: cáo buộc không nguồn (thông tin không đáng tin), lăng mạ cá nhân (khiêu khích, hạ nhục), và nhân vật AI đóng vai nhà bình luận chính trị (tắt kiếm tiền kênh).",
      "huongSua": "Tường thuật có mốc thời gian và nguồn. Tách rõ sự việc với nhận định. Tránh cáo buộc gian lận không bằng chứng."
    },
    {
      "ma": "chung-toc",
      "ten": "Chủng tộc và sắc tộc",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "tuKhoa": ["black america", "african american", "racism", "racist", "segregation", "slavery", "civil rights", "white supremacy", "jim crow", "apartheid", "lynching", "ku klux klan"],
      "giaiThich": "Lịch sử chủng tộc đăng và kiếm tiền được như nội dung giáo dục, tài liệu. Thành vấn đề khi kịch bản khái quát hoá hoặc hạ thấp một nhóm, hoặc tả bạo lực chi tiết.",
      "huongSua": "Bám sự kiện và con người cụ thể. Không so sánh hơn kém giữa các nhóm. Bạo lực thì nói kết cục, không tả."
    },
    {
      "ma": "ton-giao",
      "ten": "Công kích tín ngưỡng",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "tuKhoa": ["blasphemy", "heresy", "infidel", "infidels", "false prophet", "false religion", "cult", "apostate", "devil worshippers", "going to hell"],
      "giaiThich": "Kể chuyện Kinh Thánh là bình thường. Cờ này bật khi kịch bản phán xét hoặc công kích một tín ngưỡng — tôn giáo là nhóm được bảo vệ.",
      "huongSua": "Kể chuyện và nêu các cách diễn giải khác nhau, thay vì tuyên bố bên nào sai."
    },
    {
      "ma": "tu-hai",
      "ten": "Cổ vũ hoặc hướng dẫn tự hại",
      "nhom": "cong-dong",
      "mucDo": "đỏ",
      "tuKhoa": ["kill yourself", "how to end my life", "how to commit suicide", "painless way to die", "overdose on", "ways to kill yourself"],
      "giaiThich": "Cổ vũ, hướng dẫn tự hại là không quảng cáo và bị gỡ theo nguyên tắc cộng đồng.",
      "huongSua": "Bỏ hoàn toàn chi tiết về cách thức."
    },
    {
      "ma": "van-de-gay-tranh-cai",
      "ten": "Tự tử, tự hại, xâm hại, bạo hành, phá thai",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "tuKhoa": ["suicide", "self-harm", "took his own life", "took her own life", "hanged himself", "hanged herself", "domestic abuse", "domestic violence", "sexual abuse", "sexual assault", "rape", "raped", "abortion", "molested"],
      "giaiThich": "Từ 1/2026, kể hoặc kịch hoá các chủ đề này KHÔNG tả chi tiết thì vẫn đủ quảng cáo. Tả chi tiết thì mất. Máy không phân biệt được 'kể' với 'tả' — phải tự đọc lại các câu được trích.",
      "huongSua": "Nhắc sự việc trong một câu, không tả diễn biến, không tả cách thức."
    },
    {
      "ma": "tre-em",
      "ten": "Xâm hại trẻ em",
      "nhom": "quang-cao",
      "mucDo": "đỏ",
      "tuKhoa": ["child abuse", "child sexual abuse", "child trafficking", "child sex trafficking", "minor victim", "underage", "child bride", "child molester"],
      "mau": ["\\bpa?edophil\\w*", "\\bmolest\\w* (a|the|her|his) (child|boy|girl|son|daughter)"],
      "giaiThich": "Ngoại lệ của đợt nới 1/2026: xâm hại trẻ em là chủ đề chính thì bị giới hạn quảng cáo dù không tả; có tả hoặc kịch hoá thì mất hẳn.",
      "huongSua": "Nếu không phải trọng tâm câu chuyện thì nhắc lướt một câu. Nếu là trọng tâm, cân nhắc đổi đề tài."
    },
    {
      "ma": "roi-loan-an-uong",
      "ten": "Rối loạn ăn uống",
      "nhom": "quang-cao",
      "mucDo": "đỏ",
      "tuKhoa": ["pro-ana", "thinspo", "lowest bmi", "how to starve", "purging", "starve yourself", "eating disorder"],
      "giaiThich": "Ngoại lệ thứ hai của đợt nới 1/2026: nội dung rối loạn ăn uống có chi tiết bắt chước được (cân nặng, BMI thấp nhất, cách nhịn, nôn) là không quảng cáo.",
      "huongSua": "Bỏ con số và cách thức. Chỉ giữ câu chuyện hồi phục."
    },
    {
      "ma": "ma-tuy",
      "ten": "Cổ vũ hoặc hướng dẫn dùng ma tuý",
      "nhom": "quang-cao",
      "mucDo": "đỏ",
      "tuKhoa": ["how to cook meth", "buy drugs online", "where to buy weed", "best way to get high", "how to smoke crack", "how to grow weed", "dispensary tour"],
      "giaiThich": "Cổ vũ, mẹo dùng hoặc điều chế, chỉ chỗ mua là không quảng cáo. Nhắc tới trong giáo dục, tài liệu, truyện hư cấu thì được (nới thêm 9/2026).",
      "huongSua": "Kể hậu quả và bối cảnh, bỏ mọi chi tiết 'làm thế nào'."
    },
    {
      "ma": "vu-khi",
      "ten": "Chế tạo, độ, mua bán súng và chất nổ",
      "nhom": "quang-cao",
      "mucDo": "đỏ",
      "tuKhoa": ["how to make a bomb", "build a bomb", "build a gun", "3d printed gun", "ghost gun", "bump stock", "auto sear", "convert to full auto", "silencer tutorial", "buy a gun without"],
      "giaiThich": "Chế, độ súng và hỗ trợ mua bán là không quảng cáo; hướng dẫn làm chất nổ bị gỡ. Thảo luận luật súng thì bình thường.",
      "huongSua": "Bỏ chi tiết kỹ thuật."
    },
    {
      "ma": "khung-bo",
      "ten": "Tổ chức khủng bố, cực đoan",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "tuKhoa": ["isis", "al-qaeda", "al qaeda", "taliban", "hamas", "hezbollah", "boko haram", "terrorist attack", "suicide bomber"],
      "giaiThich": "Nhắc tới ngắn, không bạo lực thì vẫn đủ quảng cáo. Hình ảnh thoáng qua thì giới hạn. Nội dung ghê rợn hoặc ca ngợi, tuyển mộ thì mất hẳn và bị gỡ.",
      "huongSua": "Tường thuật trung tính, không trích khẩu hiệu, không tả cảnh tấn công."
    },
    {
      "ma": "su-kien-nhay-cam",
      "ten": "Thảm kịch và sự kiện nhạy cảm",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "tuKhoa": ["mass shooting", "school shooting", "9/11", "september 11", "holocaust", "genocide", "war in ukraine", "gaza", "plane crash victims", "earthquake victims", "hurricane victims"],
      "giaiThich": "Bàn về mất mát, thảm kịch mà không khai thác, không coi nhẹ thì vẫn đủ quảng cáo. 'Trục lợi từ sự kiện nhạy cảm' và nhồi từ khóa sự kiện để kéo view là không quảng cáo.",
      "huongSua": "Giữ giọng tường thuật, có nguồn. Không dùng tên thảm kịch làm mồi ở tiêu đề khi video không thật sự nói về nó."
    },
    {
      "ma": "gian-doi",
      "ten": "Dạy hành vi gian dối",
      "nhom": "quang-cao",
      "mucDo": "đỏ",
      "tuKhoa": ["how to hack into", "hack someone's", "bypass the paywall", "crack the password", "fake id", "wiretap", "track someone's phone", "essay writing service", "forge a signature"],
      "giaiThich": "Nhóm 'hỗ trợ hành vi gian dối': dạy xâm nhập trái phép, nghe lén, làm giả là không quảng cáo. Báo chí tường thuật vụ việc thì được.",
      "huongSua": "Kể vụ việc, không kể cách làm."
    },
    {
      "ma": "thuoc-la",
      "ten": "Thuốc lá, vape",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "toiThieuLan": 3,
      "tuKhoa": ["vape", "vaping", "e-cigarette", "juul", "cigar review", "best cigarettes", "chewing tobacco"],
      "giaiThich": "Quảng bá thuốc lá và sản phẩm liên quan bị giới hạn hoặc mất quảng cáo.",
      "huongSua": "Nhắc như chi tiết bối cảnh thì được; đừng khen hay giới thiệu sản phẩm."
    },
    {
      "ma": "mo-dau-nhay-cam",
      "ten": "Từ nhạy cảm ngay ở 75 từ đầu",
      "nhom": "quang-cao",
      "mucDo": "vàng",
      "phamVi": "mo-dau",
      "mau": ["\\b(murder|rape|slaughter|massacre|tortur|suicide|behead|stabb|corpse|bloodbath)\\w*"],
      "giaiThich": "Đây là mức tool tự đặt, không phải con số YouTube công bố. Mở bài thường được lấy làm tiêu đề và thumbnail — hai chỗ bị xét chặt hơn thân video — và là đoạn đầu tiên người xét duyệt nghe.",
      "huongSua": "Mở bằng câu hỏi hoặc nhân vật; để chi tiết nặng ra sau, ở dạng kể chứ không tả."
    }
  ]
}
```

## Nguồn

- Chính sách kiếm tiền cấp kênh: https://support.google.com/youtube/answer/1311392
- Nội dung thân thiện với nhà quảng cáo: https://support.google.com/youtube/answer/6162278
- Các lần cập nhật nguyên tắc quảng cáo: https://support.google.com/youtube/answer/9725604
- YouTube làm rõ "nội dung không chân thực", 7/2026: https://www.tubefilter.com/2026/07/13/youtube-inauthentic-content-monetization-policy-update/
- Nới quy định với chủ đề gây tranh cãi, 1/2026: https://techcrunch.com/2026/01/16/youtube-relaxes-monetization-guidelines-for-some-controversial-topics/
