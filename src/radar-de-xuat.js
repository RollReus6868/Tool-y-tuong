// Radar đề xuất — đo "video nào đang được thuật toán YouTube đẩy mạnh".
//
// YouTube Data API KHÔNG cho biết video nào đang được đề xuất. Thứ duy nhất
// phản ánh điều đó là chính giao diện YouTube: cột "video tiếp theo" bên phải
// trang xem, và trang chủ của một tài khoản.
//
// Cách đo:
//   1. Lấy 5–10 video HẠT GIỐNG của lĩnh vực (trang tìm kiếm YouTube — miễn
//      phí, không tốn quota; hoặc từ danh sách video đã chọn).
//   2. Mở từng hạt giống, đọc cột đề xuất bên cạnh.
//   3. (Tuỳ chọn) đọc trang chủ của tài khoản đã đăng nhập.
//   4. Video nào xuất hiện trong NHIỀU cột đề xuất khác nhau = đang được đẩy
//      mạnh trong lĩnh vực đó. Một video được gợi ý cạnh 6/8 video hàng đầu
//      của lĩnh vực là tín hiệu rất khác với một video chỉ hiện một lần.
//
// Dữ liệu đọc từ `ytInitialData` — khối JSON YouTube nhúng sẵn trong trang —
// chứ không dò từng thẻ HTML. Khối JSON này đổi tên trường chậm hơn nhiều so
// với giao diện, và quan trọng hơn: phân tích nó là hàm THUẦN, kiểm thử tầng 1
// chạy được trên dữ liệu mẫu, không cần mạng, không cần Electron.
//
// Mọi URL gắn `hl=en&gl=US` để YouTube trả đề xuất theo người xem MỸ, không
// theo vị trí thật của máy (Việt Nam).

const { chuanHoa, tachHatGiong } = require('./tu-khoa')

const GOC = 'https://www.youtube.com'
const MY = 'hl=en&gl=US'

// ---------------------------------------------------------------------------
// Bộ lọc trang tìm kiếm (tham số `sp`).
//
// `sp` là protobuf mã hoá base64: trường 1 = cách sắp xếp, trường 2 = khối bộ
// lọc (trường 1 = thời gian đăng, trường 2 = loại). Dựng từ byte chứ không chép
// chuỗi có sẵn trên mạng — chép nhầm một ký tự là YouTube lặng lẽ bỏ qua bộ lọc
// và trả kết quả mặc định, không báo lỗi gì.
// ---------------------------------------------------------------------------
const THOI_GIAN = { 'gio': 1, 'hom-nay': 2, 'tuan': 3, 'thang': 4, 'nam': 5 }
const SAP_XEP = { 'lien-quan': 0, 'ngay-dang': 2, 'luot-xem': 3 }

function spTimKiem({ thoiGian = 'thang', sapXep = 'luot-xem' } = {}) {
  const bocLoc = []
  if (THOI_GIAN[thoiGian]) bocLoc.push(0x08, THOI_GIAN[thoiGian])
  bocLoc.push(0x10, 0x01) // loại: chỉ video (không kênh, không playlist)
  const bytes = []
  if (SAP_XEP[sapXep]) bytes.push(0x08, SAP_XEP[sapXep])
  bytes.push(0x12, bocLoc.length, ...bocLoc)
  return Buffer.from(bytes).toString('base64')
}

function urlTimKiem(tuKhoa, tuyChon = {}) {
  const q = encodeURIComponent(String(tuKhoa || '').trim())
  const sp = encodeURIComponent(spTimKiem(tuyChon))
  return `${GOC}/results?search_query=${q}&sp=${sp}&${MY}`
}

function urlXem(videoId) {
  return `${GOC}/watch?v=${videoId}&${MY}`
}

function urlTrangChu() {
  return `${GOC}/?${MY}`
}

// ---------------------------------------------------------------------------
// Đọc số view dạng chữ: "1,234,567 views", "1.2M views", "12K views",
// "No views". Trang ép hl=en nên chỉ cần hiểu tiếng Anh.
// ---------------------------------------------------------------------------
function docSoView(chu) {
  const s = String(chu || '').replace(/,/g, '').trim()
  if (!s || /^no views/i.test(s)) return 0
  const m = s.match(/([\d.]+)\s*([KMB])?/i)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return 0
  const nhan = { K: 1e3, M: 1e6, B: 1e9 }[String(m[2] || '').toUpperCase()] || 1
  return Math.round(n * nhan)
}

// "1:02:03" / "12:34" → giây. Không đọc được → 0 (không phải Shorts, chỉ là
// không biết).
function docThoiLuong(chu) {
  const m = String(chu || '').trim().match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
  if (!m) return 0
  return m[3] != null
    ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
    : Number(m[1]) * 60 + Number(m[2])
}

function chuTu(o) {
  if (!o) return ''
  if (typeof o === 'string') return o
  if (o.simpleText) return o.simpleText
  if (o.content) return o.content
  if (Array.isArray(o.runs)) return o.runs.map((r) => r.text || '').join('')
  return ''
}

const LA_ID = /^[A-Za-z0-9_-]{11}$/

// Dạng renderer cũ: videoRenderer (tìm kiếm, trang chủ), compactVideoRenderer
// (cột đề xuất), gridVideoRenderer.
function tuRendererCu(r) {
  const thoiLuong = chuTu(r.lengthText) ||
    ((r.thumbnailOverlays || []).map((o) => chuTu(o.thumbnailOverlayTimeStatusRenderer?.text)).find(Boolean) || '')
  return {
    videoId: r.videoId,
    tieuDe: chuTu(r.title) || chuTu(r.headline),
    tenKenh: chuTu(r.longBylineText) || chuTu(r.ownerText) || chuTu(r.shortBylineText),
    kenhId: r.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
      r.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '',
    viewChu: chuTu(r.viewCountText) || chuTu(r.shortViewCountText),
    ngayChu: chuTu(r.publishedTimeText),
    thoiLuongChu: thoiLuong
  }
}

// Dạng mới (2024 trở đi): lockupViewModel. Cột đề xuất và trang chủ đang dần
// chuyển hết sang dạng này.
function tuLockup(l) {
  const loai = String(l.contentType || '')
  if (loai && loai !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null // playlist, mix, podcast
  const meta = l.metadata?.lockupMetadataViewModel || {}
  const hang = meta.metadata?.contentMetadataViewModel?.metadataRows || []
  const cacChu = hang.flatMap((h) => (h.metadataParts || []).map((p) => chuTu(p.text)))
  const huyHieu = []
  const di = (n, sau) => {
    if (!n || typeof n !== 'object' || sau > 12) return
    if (n.thumbnailBadgeViewModel?.text) huyHieu.push(n.thumbnailBadgeViewModel.text)
    for (const v of Object.values(n)) if (v && typeof v === 'object') di(v, sau + 1)
  }
  di(l.contentImage, 0)
  return {
    videoId: l.contentId,
    tieuDe: chuTu(meta.title),
    tenKenh: cacChu[0] || '',
    kenhId: '',
    viewChu: cacChu.find((c) => /view/i.test(c)) || '',
    ngayChu: cacChu.find((c) => /ago/i.test(c)) || '',
    thoiLuongChu: huyHieu.find((c) => /^\d+:\d{2}/.test(c)) || ''
  }
}

// Các khoá renderer của Shorts — BỎ QUA hoàn toàn, kênh không làm Shorts.
const KHOA_SHORTS = new Set(['reelItemRenderer', 'shortsLockupViewModel', 'reelShelfRenderer'])
const KHOA_CU = new Set(['videoRenderer', 'compactVideoRenderer', 'gridVideoRenderer', 'videoWithContextRenderer'])

// Rút danh sách video (đúng thứ tự xuất hiện) từ một khối ytInitialData.
function rutVideoTuDuLieu(duLieu, { boQuaId = '' } = {}) {
  const ra = []
  const daCo = new Set()

  const them = (m) => {
    if (!m || !LA_ID.test(String(m.videoId || ''))) return
    if (m.videoId === boQuaId || daCo.has(m.videoId)) return
    daCo.add(m.videoId)
    const thoiLuongGiay = docThoiLuong(m.thoiLuongChu)
    ra.push({
      ...m,
      viTri: ra.length + 1,
      viewUoc: docSoView(m.viewChu),
      thoiLuongGiay,
      lienKet: `${GOC}/watch?v=${m.videoId}`,
      thumbnailNho: `https://i.ytimg.com/vi/${m.videoId}/mqdefault.jpg`
    })
  }

  const di = (nut, sau) => {
    if (!nut || typeof nut !== 'object' || sau > 80) return
    if (Array.isArray(nut)) { for (const x of nut) di(x, sau + 1); return }
    for (const [k, v] of Object.entries(nut)) {
      if (!v || typeof v !== 'object') continue
      if (KHOA_SHORTS.has(k)) continue
      if (KHOA_CU.has(k)) { them(tuRendererCu(v)); continue }
      if (k === 'lockupViewModel') { them(tuLockup(v)); continue }
      di(v, sau + 1)
    }
  }

  di(duLieu, 0)
  return ra
}

// Trên trang xem video, chỉ lấy CỘT ĐỀ XUẤT. Đi cả trang thì dính cả danh
// sách phát, màn hình cuối video… — không phải "YouTube đang gợi ý".
function khoiDeXuatTrangXem(ytData) {
  return ytData?.contents?.twoColumnWatchNextResults?.secondaryResults || null
}

// ---------------------------------------------------------------------------
// Tổng hợp nhiều lần đọc thành bảng xếp hạng.
//
// cacLanDoc = [{ loai: 'xem'|'trangChu', nguon: <videoId hạt giống | 'trang-chu'>, video: [...] }]
//
// Điểm đề xuất = cộng qua mọi lần xuất hiện, mỗi lần nặng hơn nếu ở vị trí
// cao (vị trí 1 nặng gấp ~3 lần vị trí 20). Trang chủ nhân 1,5 vì đó là
// YouTube đề xuất THẲNG cho tài khoản, không qua video trung gian.
// ---------------------------------------------------------------------------
function trongSoViTri(viTri) {
  return 1 / (1 + (Math.max(1, viTri) - 1) / 10)
}

function nhanDeXuat(soNguon, tongNguon) {
  const nguongManh = Math.max(3, Math.ceil(tongNguon * 0.35))
  if (soNguon >= nguongManh) return 'ĐẨY MẠNH'
  if (soNguon >= 2) return 'MẠNH'
  return 'CÓ ĐỀ XUẤT'
}

function tongHop(cacLanDoc, { tuKhoaLinhVuc = '', hatGiong = [] } = {}) {
  const bang = new Map()
  const cacNguon = new Set()
  const hg = new Set(hatGiong)
  const tuLinhVuc = tachTuLinhVuc(tuKhoaLinhVuc)

  for (const lan of cacLanDoc || []) {
    cacNguon.add(lan.nguon)
    for (const v of lan.video || []) {
      if (!bang.has(v.videoId)) {
        bang.set(v.videoId, {
          videoId: v.videoId,
          tieuDe: v.tieuDe,
          tenKenh: v.tenKenh,
          kenhId: v.kenhId,
          viewUoc: v.viewUoc,
          thoiLuongGiay: v.thoiLuongGiay,
          ngayChu: v.ngayChu,
          lienKet: v.lienKet,
          thumbnailNho: v.thumbnailNho,
          nguon: new Set(),
          cacViTri: [],
          diemDeXuat: 0,
          trenTrangChu: false
        })
      }
      const m = bang.get(v.videoId)
      if (!m.tieuDe && v.tieuDe) m.tieuDe = v.tieuDe
      if (!m.tenKenh && v.tenKenh) m.tenKenh = v.tenKenh
      if (!m.thoiLuongGiay && v.thoiLuongGiay) m.thoiLuongGiay = v.thoiLuongGiay
      if (v.viewUoc > m.viewUoc) m.viewUoc = v.viewUoc
      // Cùng một nguồn liệt kê hai lần thì chỉ tính một.
      if (m.nguon.has(lan.nguon)) continue
      m.nguon.add(lan.nguon)
      m.cacViTri.push(v.viTri)
      const nhan = lan.loai === 'trangChu' ? 1.5 : 1
      if (lan.loai === 'trangChu') m.trenTrangChu = true
      m.diemDeXuat += trongSoViTri(v.viTri) * nhan
    }
  }

  const tongNguon = cacNguon.size
  return [...bang.values()]
    // Shorts lọt qua (thời lượng đọc được < 61 giây) thì bỏ.
    .filter((m) => !(m.thoiLuongGiay > 0 && m.thoiLuongGiay < 61))
    .map((m) => ({
      ...m,
      nguon: [...m.nguon],
      soNguon: m.nguon.size,
      tongNguon,
      viTriTrungBinh: Math.round(m.cacViTri.reduce((a, b) => a + b, 0) / m.cacViTri.length),
      diemDeXuat: Math.round(m.diemDeXuat * 100) / 100,
      nhanDeXuat: nhanDeXuat(m.nguon.size, tongNguon),
      laHatGiong: hg.has(m.videoId),
      khopLinhVuc: khopLinhVuc(m.tieuDe, tuLinhVuc)
    }))
    .sort((a, b) => b.diemDeXuat - a.diemDeXuat || b.soNguon - a.soNguon || b.viewUoc - a.viewUoc)
}

// ---------------------------------------------------------------------------
// Khớp lĩnh vực: tiêu đề có chứa từ khóa lĩnh vực không. Chỉ để GẮN CỜ và lọc
// nhanh — cột đề xuất của video trong lĩnh vực vốn đã gần lĩnh vực, loại cứng
// theo tiêu đề sẽ mất những video hay đặt tiêu đề lách từ khóa.
// ---------------------------------------------------------------------------
const TU_BO_QUA = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'to', 'for', 'is', 'are', 'was', 'with', 'how', 'why', 'what'])

function tachTuLinhVuc(chuNhap) {
  const cum = tachHatGiong(chuNhap)
  const tu = new Set()
  for (const c of cum) {
    for (const t of c.split(' ')) if (t.length >= 3 && !TU_BO_QUA.has(t)) tu.add(t)
  }
  return { cum, tu: [...tu] }
}

// Gốc từ tiếng Anh rất thô: stories → story, kings → king, prophets → prophet.
// Đủ cho việc gắn cờ "khớp lĩnh vực"; KHÔNG dùng cho việc gì cần chính xác.
// Lỗi đã bắt được nhờ kiểm thử: chỉ thêm "s?" vào cuối từ khóa thì "stories"
// không bao giờ khớp "story" — mà với kênh kể chuyện đó là trường hợp hay gặp nhất.
function gocTu(w) {
  const t = String(w || '').toLowerCase()
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y'
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) return t.slice(0, -1)
  return t
}

function khopLinhVuc(tieuDe, { cum = [], tu = [] } = {}) {
  if (!cum.length) return false
  const t = ' ' + chuanHoa(tieuDe).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' '
  if (cum.some((c) => t.includes(' ' + c + ' '))) return true
  // Không trùng nguyên cụm thì cần ít nhất 2 từ khóa riêng lẻ (hoặc 1 nếu
  // lĩnh vực chỉ có 1 từ) — một chữ "story" không đủ nói là cùng lĩnh vực.
  const gocTieuDe = new Set(t.trim().split(' ').map(gocTu))
  const soKhop = new Set(tu.map(gocTu).filter((g) => gocTieuDe.has(g))).size
  return soKhop >= Math.min(2, tu.length)
}

// Chọn hạt giống từ nhiều trang tìm kiếm: xen kẽ giữa các từ khóa (từ khóa 1
// video 1, từ khóa 2 video 1, …) để không từ khóa nào chiếm hết suất.
function chonHatGiong(cacTrangTim, soLuong = 8, { daCo = [] } = {}) {
  const chon = [...daCo]
  const co = new Set(daCo)
  const doDai = Math.max(0, ...cacTrangTim.map((t) => t.length))
  for (let i = 0; i < doDai && chon.length < soLuong; i++) {
    for (const trang of cacTrangTim) {
      const v = trang[i]
      if (!v || co.has(v.videoId)) continue
      if (v.thoiLuongGiay > 0 && v.thoiLuongGiay < 61) continue
      chon.push(v.videoId)
      co.add(v.videoId)
      if (chon.length >= soLuong) break
    }
  }
  return chon.slice(0, soLuong)
}

// Nhận ra trang YouTube chặn/đòi xác minh thay vì nội dung thật.
function laTrangChan(url) {
  return /consent\.(youtube|google)\.com|google\.com\/sorry|accounts\.google\.com\/(v3\/)?signin/i.test(String(url || ''))
}

module.exports = {
  spTimKiem,
  urlTimKiem,
  urlXem,
  urlTrangChu,
  docSoView,
  docThoiLuong,
  rutVideoTuDuLieu,
  khoiDeXuatTrangXem,
  tongHop,
  nhanDeXuat,
  trongSoViTri,
  tachTuLinhVuc,
  khopLinhVuc,
  gocTu,
  chonHatGiong,
  laTrangChan,
  THOI_GIAN,
  SAP_XEP
}
