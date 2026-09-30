// Tra cứu TỪ KHÓA HOT theo lĩnh vực, chấm điểm 0–100 (0.7.0).
//
// CHỌN NGUỒN — nói thẳng vì sao:
//   · vidIQ, TubeBuddy: KHÔNG có API công khai. Không nối được.
//   · Google Trends: KHÔNG có API công khai (bản "alpha" 2025 chỉ cấp theo lời
//     mời). Nhưng trang Trends tự tải số liệu qua các đường nội bộ
//     /trends/api/explore → /trends/api/widgetdata/{multiline,relatedsearches}.
//     Tool mở trang Trends trong CỬA SỔ ẨN của trình duyệt trong app (như radar)
//     và gọi đúng các đường đó từ bên trong trang — đi bằng phiên đăng nhập
//     Google của tài khoản đã chọn, chọn thuộc tính "YouTube Search" (gprop=
//     youtube): mức quan tâm TÌM KIẾM TRÊN YOUTUBE, đúng thứ kênh cần.
//   · Gợi ý tìm kiếm YouTube (autocomplete, miễn phí): từ khóa nào YouTube tự
//     gợi ý, ở vị trí nào, xuất hiện qua bao nhiêu tiền tố.
//   · Trang tìm kiếm YouTube (lọc "tháng này", xếp theo lượt xem; miễn phí):
//     video mới về từ khóa đó đang ăn view tới đâu.
//   · (Tuỳ chọn) YouTube Data API: sub kênh của các video đó (~2 đơn vị/từ khóa)
//     → kênh vừa & nhỏ có đang thắng không.
//
// ĐIỂM (0–100) = trọng số × ba điểm thành phần:
//   Nhu cầu  — người ta có tìm không (Trends trung bình + sức gợi ý).
//   Xu hướng — đang lên hay đang xuống (Trends gần đây so với trước đó; "Breakout").
//   Cơ hội   — video MỚI về từ khóa có ăn view không, kênh nhỏ có thắng không.
// Là điểm TƯƠNG ĐỐI trong lĩnh vực, không phải số lượt tìm tuyệt đối.
//
// Mô-đun thuần — kiểm thử tầng 1 bằng dữ liệu mẫu.

const { chuanHoa } = require('./tu-khoa')

// ---------------------------------------------------------------------------
// Google Trends — URL và cách đọc
// ---------------------------------------------------------------------------

const GOC_TRENDS = 'https://trends.google.com'

// Khoảng thời gian Trends nhận (chuỗi đúng như trang Trends dùng).
const THOI_GIAN_TRENDS = {
  '7-ngay': 'now 7-d',
  '30-ngay': 'today 1-m',
  '90-ngay': 'today 3-m',
  '12-thang': 'today 12-m'
}

function urlTrangTrends(tuKhoa, { geo = 'US', thoiGian = '90-ngay' } = {}) {
  const t = THOI_GIAN_TRENDS[thoiGian] || THOI_GIAN_TRENDS['90-ngay']
  return `${GOC_TRENDS}/trends/explore?date=${encodeURIComponent(t)}&geo=${encodeURIComponent(geo)}` +
    `&gprop=youtube&q=${encodeURIComponent(tuKhoa)}&hl=en-US`
}

// Một lượt explore so sánh tối đa 5 từ khóa (giới hạn của Trends).
function yeuCauExplore(cacTuKhoa, { geo = 'US', thoiGian = '90-ngay' } = {}) {
  const t = THOI_GIAN_TRENDS[thoiGian] || THOI_GIAN_TRENDS['90-ngay']
  return {
    comparisonItem: cacTuKhoa.slice(0, 5).map((k) => ({ keyword: k, geo, time: t })),
    category: 0,
    property: 'youtube'
  }
}

function urlExplore(cacTuKhoa, tuyChon = {}) {
  return `${GOC_TRENDS}/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(yeuCauExplore(cacTuKhoa, tuyChon)))}`
}

// Token gắn với ĐÚNG chuỗi request của widget — đổi một trường là 401. Dùng
// nguyên đối tượng widget.request trả về từ explore.
function urlWidget(loai, widget) {
  return `${GOC_TRENDS}/trends/api/widgetdata/${loai}?hl=en-US&tz=0` +
    `&req=${encodeURIComponent(JSON.stringify(widget.request))}&token=${encodeURIComponent(widget.token)}`
}

// Mọi trả lời của Trends mở đầu bằng ")]}'" (chống JSON hijacking), có khi kèm
// dấu phẩy. Bóc đến dấu { đầu tiên.
function bocTrends(chu) {
  const s = String(chu || '')
  const i = s.indexOf('{')
  if (i < 0) throw new Error('Trends trả về không phải JSON (có thể bị chặn / hỏi xác minh).')
  return JSON.parse(s.slice(i))
}

function docExplore(json) {
  const widgets = (json && json.widgets) || []
  return {
    thoiGian: widgets.find((w) => w.id === 'TIMESERIES') || null,
    lienQuan: widgets.filter((w) => /^RELATED_QUERIES/.test(w.id || ''))
  }
}

// multiline → chuỗi giá trị theo từng từ khóa (đúng thứ tự so sánh).
function docMultiline(json, soTuKhoa) {
  const tl = (json && json.default && json.default.timelineData) || []
  const chuoi = Array.from({ length: soTuKhoa }, () => [])
  for (const d of tl) {
    // Điểm "isPartial" (ngày/tuần chưa hết) làm đuôi chuỗi tụt giả — bỏ.
    if (d.isPartial) continue
    for (let i = 0; i < soTuKhoa; i++) chuoi[i].push(Number((d.value || [])[i]) || 0)
  }
  return chuoi
}

// relatedsearches → { top: [{q, v}], rising: [{q, v, breakout}] }
function docLienQuan(json) {
  const ds = (json && json.default && json.default.rankedList) || []
  const lay = (k) => ((ds[k] && ds[k].rankedKeyword) || []).map((r) => ({
    q: String(r.query || '').trim(),
    v: Number(r.value) || 0,
    breakout: /breakout/i.test(String(r.formattedValue || ''))
  })).filter((r) => r.q)
  return { top: lay(0), rising: lay(1) }
}

// ---------------------------------------------------------------------------
// Chấm điểm
// ---------------------------------------------------------------------------

const kep = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x))
const tb = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const trungVi = (a) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Xu hướng từ chuỗi Trends: trung bình 25% cuối so với 75% trước.
// Tỉ lệ 1 = đứng yên → 50 điểm; ×2 → ~82; ×3 trở lên → 100; giảm một nửa → ~18.
function diemXuHuongChuoi(chuoi) {
  const s = (chuoi || []).filter((x) => Number.isFinite(x))
  if (s.length < 4) return null
  const cat = Math.max(1, Math.floor(s.length * 0.25))
  const sau = tb(s.slice(-cat))
  const truoc = tb(s.slice(0, -cat))
  if (truoc <= 0 && sau <= 0) return 0
  const tyLe = truoc <= 0 ? 3 : sau / truoc
  return Math.round(kep(50 + 46 * Math.log2(tyLe)))
}

// Autocomplete: xuất hiện qua nhiều tiền tố + đứng đầu danh sách = mạnh.
function diemGoiY({ soTienTo = 0, viTriTot = 0, tongTienTo = 1 } = {}) {
  if (!soTienTo) return 0
  const phu = kep((soTienTo / Math.max(1, tongTienTo)) * 100 * 3)       // có mặt ở 1/3 số tiền tố là tối đa
  const dung = viTriTot ? kep(100 - (viTriTot - 1) * 9) : 0              // vị trí 1 = 100, 10 = 19
  return Math.round(0.5 * phu + 0.5 * dung)
}

// Log view: 1k→20, 10k→40, 100k→60, 1M→80, 10M→100.
function diemView(v) {
  if (!v || v < 1) return 0
  return Math.round(kep((Math.log10(v) - 2) * 20))
}

// Cơ hội từ trang tìm kiếm YouTube (video đăng trong tháng, xếp theo lượt xem).
// cacVideo: [{ viewUoc, ngayTuoi (ngày), subKenh? }]
function diemCoHoi(cacVideo, { kenhNhoTu = 1000, kenhNhoDen = 100000 } = {}) {
  const v = (cacVideo || []).filter((x) => x && x.viewUoc >= 0).slice(0, 10)
  if (!v.length) return { diem: 0, viewTrungVi: 0, soVideo: 0, tyLeKenhNhoThang: null }
  const views = v.map((x) => x.viewUoc)
  const tv = trungVi(views)
  let diem = diemView(tv)
  // Tập trung vào 1–2 video viral (max ≫ trung vị) → khó ăn theo, trừ bớt.
  const max = Math.max(...views)
  if (tv > 0 && max / tv > 20) diem -= 10
  // Có đủ video mới ăn view = nhu cầu ổn định, không phải ăn may.
  const soTot = views.filter((x) => x >= 10000).length
  diem += Math.min(10, soTot * 2)
  let tyLeKenhNhoThang = null
  const coSub = v.filter((x) => Number.isFinite(x.subKenh) && x.subKenh > 0)
  if (coSub.length >= 3) {
    const nho = coSub.filter((x) => x.subKenh >= kenhNhoTu && x.subKenh <= kenhNhoDen && x.viewUoc >= tv)
    tyLeKenhNhoThang = nho.length / coSub.length
    diem += Math.round((tyLeKenhNhoThang - 0.2) * 40)   // ≥ 20% top video từ kênh nhỏ là dấu hiệu tốt
  }
  return { diem: Math.round(kep(diem)), viewTrungVi: Math.round(tv), soVideo: v.length, tyLeKenhNhoThang }
}

// Đọc "3 days ago", "2 weeks ago", "Streamed 5 hours ago" → số ngày.
function docTuoiNgay(chu) {
  const m = String(chu || '').match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago/i)
  if (!m) return null
  const n = Number(m[1])
  const heSo = { second: 1 / 86400, minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 }[m[2].toLowerCase()]
  return Math.round(n * heSo * 100) / 100
}

const TRONG_SO_MAC_DINH = { nhuCau: 35, xuHuong: 35, coHoi: 30 }

function diemTong({ nhuCau, xuHuong, coHoi }, trongSo = TRONG_SO_MAC_DINH) {
  const phan = [['nhuCau', nhuCau], ['xuHuong', xuHuong], ['coHoi', coHoi]]
    .filter(([, g]) => Number.isFinite(g))
  const tong = phan.reduce((s, [k]) => s + Math.max(0, Number(trongSo[k]) || 0), 0)
  if (!tong) return 0
  return Math.round(phan.reduce((s, [k, g]) => s + g * Math.max(0, Number(trongSo[k]) || 0), 0) / tong)
}

function nhanTuKhoa(diem, xuHuong) {
  const trend = Number.isFinite(xuHuong) && xuHuong >= 70
  let nhan = 'THƯỜNG'
  if (diem >= 80) nhan = 'RẤT HOT'
  else if (diem >= 65) nhan = 'HOT'
  else if (diem >= 50) nhan = 'KHÁ'
  return { nhan, dangTrend: trend }
}

// ---------------------------------------------------------------------------
// Gom ứng viên từ gợi ý YouTube + "liên quan" của Trends
// ---------------------------------------------------------------------------

function tachLinhVuc(chu) {
  return [...new Set(String(chu || '').split(/[,;\n]+/).map((s) => chuanHoa(s)).filter(Boolean))]
}

const TIEN_TO_AZ = 'abcdefghijklmnopqrstuvwxyz'.split('')

// Các chuỗi gõ thử vào ô tìm kiếm cho một hạt giống.
function cacTienTo(hatGiong, { moRongAZ = true } = {}) {
  const ra = [hatGiong]
  if (moRongAZ) for (const c of TIEN_TO_AZ) ra.push(`${hatGiong} ${c}`)
  return ra
}

// goiY: [{ tienTo, ds: [chuỗi gợi ý theo thứ tự] }]
// lienQuan: [{ hatGiong, top, rising }]
function gomUngVien({ hatGiong = [], goiY = [], lienQuan = [] }, {
  soTuToiThieu = 2, tuLoaiTru = [], batBuocChuaLinhVuc = true
} = {}) {
  const bang = new Map()
  const lay = (k) => {
    const kk = chuanHoa(k)
    if (!bang.has(kk)) bang.set(kk, { tuKhoa: kk, soTienTo: 0, viTriTot: 0, nguon: new Set(), rising: null, breakout: false })
    return bang.get(kk)
  }
  for (const g of goiY) {
    (g.ds || []).forEach((k, i) => {
      const u = lay(k)
      u.soTienTo++
      u.viTriTot = u.viTriTot ? Math.min(u.viTriTot, i + 1) : i + 1
      u.nguon.add('gợi ý YouTube')
    })
  }
  for (const l of lienQuan) {
    for (const r of l.rising || []) {
      const u = lay(r.q)
      u.nguon.add('Trends đang lên')
      u.rising = Math.max(u.rising || 0, r.v)
      if (r.breakout) u.breakout = true
    }
    for (const r of l.top || []) lay(r.q).nguon.add('Trends phổ biến')
  }

  const loai = tuLoaiTru.map((t) => chuanHoa(t)).filter(Boolean)
  const tuLinhVuc = new Set(hatGiong.flatMap((h) => chuanHoa(h).split(' ')).filter((w) => w.length > 2))
  const tongTienTo = Math.max(1, goiY.length)

  return [...bang.values()]
    .filter((u) => u.tuKhoa.split(' ').length >= soTuToiThieu)
    .filter((u) => !loai.some((t) => u.tuKhoa.includes(t)))
    .filter((u) => !batBuocChuaLinhVuc || u.tuKhoa.split(' ').some((w) => tuLinhVuc.has(w) ||
      [...tuLinhVuc].some((l) => w.replace(/s$/, '') === l.replace(/s$/, ''))))
    .map((u) => ({ ...u, nguon: [...u.nguon], diemGoiY: diemGoiY({ ...u, tongTienTo }) }))
    // Xếp sơ để chọn N từ khóa đi chấm kỹ: breakout trước, rồi độ mạnh gợi ý.
    .sort((a, b) => (b.breakout - a.breakout) || ((b.rising ? 1 : 0) - (a.rising ? 1 : 0)) || (b.diemGoiY - a.diemGoiY))
}

// Chia từ khóa thành lô 4 + 1 "mỏ neo" (hạt giống đầu) để so sánh CHÉO giữa các
// lô: Trends chuẩn hoá 0–100 trong TỪNG lô, nên phải quy về cùng mỏ neo.
function chiaLoTrends(cacTuKhoa, moNeo) {
  const ds = cacTuKhoa.filter((k) => k !== moNeo)
  const lo = []
  for (let i = 0; i < ds.length; i += 4) lo.push([moNeo, ...ds.slice(i, i + 4)])
  return lo
}

// Quy mức quan tâm các lô về cùng thang: giá trị × (mỏ neo chung / mỏ neo lô).
// Sau đó chia cho mức cao nhất → 0–100.
function quyVeMotThang(cacLo) {
  const ket = new Map()
  const neoChung = tb(cacLo.map((l) => l.tbMoNeo).filter((x) => x > 0)) || 1
  for (const l of cacLo) {
    const heSo = l.tbMoNeo > 0 ? neoChung / l.tbMoNeo : 1
    l.tuKhoa.forEach((k, i) => {
      const gt = l.trungBinh[i] * heSo
      if (!ket.has(k) || i > 0) ket.set(k, gt)
    })
  }
  const max = Math.max(1, ...ket.values())
  const ra = {}
  for (const [k, v] of ket) ra[k] = Math.round((v / max) * 100)
  return ra
}

module.exports = {
  THOI_GIAN_TRENDS,
  TRONG_SO_MAC_DINH,
  urlTrangTrends,
  yeuCauExplore,
  urlExplore,
  urlWidget,
  bocTrends,
  docExplore,
  docMultiline,
  docLienQuan,
  diemXuHuongChuoi,
  diemGoiY,
  diemView,
  diemCoHoi,
  docTuoiNgay,
  diemTong,
  nhanTuKhoa,
  tachLinhVuc,
  cacTienTo,
  gomUngVien,
  chiaLoTrends,
  quyVeMotThang,
  trungVi
}
