// Đọc và làm sạch phụ đề YouTube. Toàn bộ mô-đun là HÀM THUẦN — kiểm thử tầng
// 1 gọi thẳng với chuỗi mẫu, không cần mạng, không cần yt-dlp.
//
// BẪY LỚN NHẤT CỦA CẢ MÔ-ĐUN: phụ đề TỰ ĐỘNG của YouTube chạy kiểu CUỘN
// (rolling). Mỗi khung hình mới lặp lại nguyên văn dòng trước rồi nối thêm vài
// chữ, để chữ trôi mượt trên màn hình. Parse thô kiểu "nối hết các cue lại" sẽ
// ra văn bản lặp 2-3 lần, và cái lặp đó đi thẳng vào kịch bản.
//
// Vì vậy ưu tiên `json3` hơn `vtt`: json3 đánh dấu rõ sự kiện nối thêm bằng
// `aAppend: 1`, bỏ đúng những sự kiện đó là sạch. Với `vtt` thì không có dấu
// hiệu nào, phải tự dò dòng trùng.

// ---------------------------------------------------------------------------
// json3 — định dạng nên dùng
// ---------------------------------------------------------------------------

function phanTichJson3(chuoi) {
  let duLieu
  try {
    duLieu = typeof chuoi === 'string' ? JSON.parse(chuoi) : chuoi
  } catch (_) {
    return []
  }
  const sk = (duLieu && duLieu.events) || []
  const ra = []

  for (const e of sk) {
    // aAppend = 1 nghĩa là sự kiện này chỉ vẽ lại chữ cũ cho hiệu ứng cuộn.
    // Giữ lại là lặp ngay.
    if (e.aAppend === 1) continue
    if (!Array.isArray(e.segs)) continue

    const chu = e.segs.map((s) => s.utf8 || '').join('')
    if (!chu.trim()) continue

    ra.push({
      batDauMs: Number(e.tStartMs) || 0,
      keoDaiMs: Number(e.dDurationMs) || 0,
      chu: chu.replace(/\n/g, ' ').trim()
    })
  }
  return ra
}

// ---------------------------------------------------------------------------
// WebVTT — dự phòng khi không có json3
// ---------------------------------------------------------------------------

function msTuMocVtt(moc) {
  // 00:01:02.345 hoặc 01:02.345
  const m = String(moc).trim().match(/^(?:(\d+):)?(\d+):(\d+)[.,](\d+)$/)
  if (!m) return 0
  const [, gio, phut, giay, mili] = m
  return (Number(gio || 0) * 3600 + Number(phut) * 60 + Number(giay)) * 1000 +
         Number(String(mili).padEnd(3, '0').slice(0, 3))
}

function boTheVtt(dong) {
  return String(dong)
    // Mốc thời gian nội dòng của phụ đề tự động: <00:00:01.234>
    .replace(/<\d{2}:\d{2}:\d{2}[.,]\d{3}>/g, '')
    // Thẻ <c>, </c>, <c.colorE5E5E5>...
    .replace(/<\/?c[^>]*>/g, '')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
}

function phanTichVtt(chuoi) {
  const dong = String(chuoi || '').split(/\r?\n/)
  const ra = []
  let i = 0

  while (i < dong.length) {
    const d = dong[i]
    const m = d.match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/)
    if (!m) { i++; continue }

    const batDauMs = msTuMocVtt(m[1])
    const ketThucMs = msTuMocVtt(m[2])
    i++

    const chuDong = []
    while (i < dong.length && dong[i].trim() !== '' && !/-->/.test(dong[i])) {
      const sach = boTheVtt(dong[i]).trim()
      if (sach) chuDong.push(sach)
      i++
    }
    if (!chuDong.length) continue

    ra.push({
      batDauMs,
      keoDaiMs: Math.max(0, ketThucMs - batDauMs),
      chu: chuDong.join(' ').replace(/\s+/g, ' ').trim()
    })
  }
  return ra
}

// ---------------------------------------------------------------------------
// Bỏ lặp kiểu cuộn — bắt buộc chạy với vtt, chạy thêm với json3 cũng không hại
// ---------------------------------------------------------------------------

function boLapCuon(cacCue) {
  const ra = []
  for (const c of cacCue) {
    const chu = String(c.chu || '').trim()
    if (!chu) continue

    const truoc = ra.length ? ra[ra.length - 1].chu : ''

    // Trùng y hệt dòng trước.
    if (chu === truoc) continue

    // Dòng trước là phần đầu của dòng này (kiểu cuộn điển hình):
    // "he walked into"  →  "he walked into the room"
    // Giữ dòng dài, bỏ dòng ngắn đi.
    if (truoc && chu.startsWith(truoc)) {
      ra[ra.length - 1] = { ...c, chu }
      continue
    }

    // Dòng này nằm gọn trong dòng trước — đã có rồi, bỏ.
    if (truoc && truoc.endsWith(chu)) continue

    // Chồng lấn một phần ở mép: "...into the room" rồi "the room and sat".
    //
    // Phải đếm theo TỪ chứ không theo ký tự. Đếm ký tự thì phải đặt ngưỡng, mà
    // ngưỡng nào cũng sai: để 12 ký tự thì lọt "the room" (8 ký tự) và câu ra
    // thành "...into the room the room and sat"; hạ ngưỡng xuống thì lại cắt
    // nhầm những mẩu chữ trùng nhau ngẫu nhiên.
    const chong = soTuChongLan(tachTu(truoc), tachTu(chu))
    if (chong >= 2) {
      const moi = tachTu(chu).slice(chong).join(' ').trim()
      if (!moi) continue
      ra.push({ ...c, chu: moi })
      continue
    }

    ra.push({ ...c, chu })
  }
  return ra
}

function tachTu(s) {
  return String(s || '').split(/\s+/).filter(Boolean)
}

// So khớp bỏ qua hoa thường và dấu câu — phụ đề tự động rắc dấu phẩy rất tuỳ hứng.
function chuanTu(t) {
  return String(t || '').toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')
}

// Số từ ở ĐUÔI của `tuTruoc` trùng với phần ĐẦU của `tuMoi`. Lấy đoạn trùng
// dài nhất, vì đoạn ngắn hơn bao giờ cũng cũng khớp theo.
function soTuChongLan(tuTruoc, tuMoi, toiDa = 15) {
  const n = Math.min(tuTruoc.length, tuMoi.length, toiDa)
  for (let k = n; k >= 1; k--) {
    let khop = true
    for (let i = 0; i < k; i++) {
      if (chuanTu(tuTruoc[tuTruoc.length - k + i]) !== chuanTu(tuMoi[i])) { khop = false; break }
    }
    if (khop) return k
  }
  return 0
}

// ---------------------------------------------------------------------------
// Làm sạch và ghép đoạn
// ---------------------------------------------------------------------------

const NHAN_AM_THANH = /\[(music|applause|laughter|sound effect|silence|nhạc|vỗ tay|cười)[^\]]*\]/gi

function lamSach(chu) {
  return String(chu || '')
    .replace(NHAN_AM_THANH, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Ghép các cue thành đoạn văn.
//
// Phụ đề tự động tiếng Anh gần như KHÔNG có dấu câu. Không có cách nào khôi
// phục dấu chấm cho đúng, nên ở đây chỉ ngắt đoạn theo hai dấu hiệu đo được:
// khoảng lặng giữa hai cue, và độ dài đoạn. Phần dấu câu để Claude tự xử lý
// khi viết lại kịch bản — nói rõ như vậy chứ không giả vờ là đã khôi phục được.
function ghepDoan(cacCue, { khoangLangGiay = 0.8, tuMoiDoan = 110 } = {}) {
  const doan = []
  let hienTai = []
  let soTu = 0
  let ketThucTruoc = null

  const chot = () => {
    if (hienTai.length) doan.push(hienTai.join(' ').replace(/\s{2,}/g, ' ').trim())
    hienTai = []
    soTu = 0
  }

  for (const c of cacCue) {
    const chu = lamSach(c.chu)
    if (!chu) continue

    const khoangLang = ketThucTruoc == null
      ? 0
      : (c.batDauMs - ketThucTruoc) / 1000

    if (hienTai.length && (khoangLang >= khoangLangGiay || soTu >= tuMoiDoan)) chot()

    hienTai.push(chu)
    soTu += demTu(chu)
    ketThucTruoc = c.batDauMs + (c.keoDaiMs || 0)
  }
  chot()
  return doan.filter(Boolean)
}

function demTu(chu) {
  const s = lamSach(chu)
  if (!s) return 0
  return s.split(/\s+/).filter(Boolean).length
}

// Đường chạy đầy đủ: chuỗi thô → văn bản sạch.
function chuyenThanhVanBan(tho, { dinhDang = 'json3', khoangLangGiay = 0.8, tuMoiDoan = 110 } = {}) {
  const cue = dinhDang === 'json3' ? phanTichJson3(tho) : phanTichVtt(tho)
  const sach = boLapCuon(cue)
  const doan = ghepDoan(sach, { khoangLangGiay, tuMoiDoan })
  const vanBan = doan.join('\n\n')

  return {
    vanBan,
    doan,
    soCue: cue.length,
    soCueSauKhiBoLap: sach.length,
    soTu: demTu(vanBan.replace(/\n+/g, ' ')),
    thoiLuongGiay: cue.length
      ? Math.round((cue[cue.length - 1].batDauMs + (cue[cue.length - 1].keoDaiMs || 0)) / 1000)
      : 0,
    // Tỷ lệ cue bị bỏ vì lặp cuộn. Gần 0 với phụ đề người làm, thường 40-65%
    // với phụ đề tự động. Hiện ra để thấy bước làm sạch có chạy thật không.
    tyLeBoLap: cue.length ? Math.round((1 - sach.length / cue.length) * 100) : 0
  }
}

module.exports = {
  phanTichJson3,
  phanTichVtt,
  msTuMocVtt,
  boTheVtt,
  boLapCuon,
  tachTu,
  chuanTu,
  soTuChongLan,
  lamSach,
  ghepDoan,
  demTu,
  chuyenThanhVanBan
}
