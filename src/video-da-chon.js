// Danh sách "Video đã chọn" — cầu nối giữa phần Nghiên cứu và phần Sản xuất.
//
// Người dùng tick ô đầu dòng ở màn Ý tưởng / Đề xuất / Kênh theo dõi → video
// vào danh sách này → bốn màn sản xuất (Lời thoại, Kịch bản, Kiểm duyệt, Prompt
// ảnh) đều đọc được nó.
//
// Lưu ra tệp RIÊNG `video-da-chon.json`, không nhét vào cài đặt: nó thay đổi
// sau mỗi cú tick, còn cài đặt thì chỉ đổi khi bấm Lưu — trộn chung là mỗi cú
// tick lại ghi đè cả tệp cài đặt, và một lần ghi hỏng mất luôn khoá API.
//
// Toàn bộ mô-đun là hàm thuần trừ hai hàm đọc/ghi tệp ở cuối.

const path = require('path')
const { docJSON, ghiJSON } = require('./store')

const TOI_DA = 300

// Chỉ giữ những trường các màn sau cần. Không giữ cả dòng bảng kết quả (vài
// chục trường, có mảng lồng) cho tệp khỏi phình.
function rutGon(v, nguon = '') {
  return {
    videoId: String(v.videoId || ''),
    tieuDe: String(v.tieuDe || ''),
    tenKenh: String(v.tenKenh || ''),
    kenhId: String(v.kenhId || ''),
    views: Number(v.views || 0),
    subKenh: Number(v.subKenh || 0),
    thoiLuongGiay: Number(v.thoiLuongGiay || 0),
    ngayDang: String(v.ngayDang || ''),
    lienKet: v.lienKet || `https://www.youtube.com/watch?v=${v.videoId}`,
    thumbnail: String(v.thumbnail || ''),
    thumbnailNho: String(v.thumbnailNho || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`),
    nhan: String(v.nhan || ''),
    nguon: String(v.nguon || nguon || ''),
    themLuc: Number(v.themLuc || Date.now())
  }
}

function hopLe(v) {
  return !!v && /^[A-Za-z0-9_-]{11}$/.test(String(v.videoId || ''))
}

// Thêm, bỏ trùng theo videoId. Video đã có thì GIỮ vị trí cũ nhưng cập nhật
// số liệu mới (view tăng theo thời gian).
function themVao(ds, cacVideo, nguon = '') {
  const ra = [...(ds || [])]
  for (const v of cacVideo || []) {
    if (!hopLe(v)) continue
    const i = ra.findIndex((x) => x.videoId === v.videoId)
    if (i >= 0) ra[i] = { ...ra[i], ...rutGon(v, nguon), themLuc: ra[i].themLuc, nguon: ra[i].nguon || nguon }
    else ra.push(rutGon(v, nguon))
  }
  // Vượt trần thì bỏ những video thêm sớm nhất.
  return ra.length > TOI_DA ? ra.slice(ra.length - TOI_DA) : ra
}

function boKhoi(ds, ids) {
  const bo = new Set(ids || [])
  return (ds || []).filter((v) => !bo.has(v.videoId))
}

function coTrong(ds, videoId) {
  return (ds || []).some((v) => v.videoId === videoId)
}

function chuanHoaDanhSach(ds) {
  return themVao([], (ds || []).filter(hopLe))
}

// Mỗi dòng một link — dán thẳng vào ô link của màn Lời thoại được.
function danhSachLink(ds) {
  return (ds || []).map((v) => `https://www.youtube.com/watch?v=${v.videoId}`).join('\n')
}

function soGon(n) {
  if (!(n > 0)) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

// Dữ liệu cho khối "VIDEO THAM KHẢO" trong prompt dàn ý kịch bản.
function choPromptKichBan(ds) {
  return (ds || []).map((v) => ({
    tieuDe: v.tieuDe,
    tenKenh: v.tenKenh,
    views: v.views,
    subKenh: v.subKenh,
    phut: v.thoiLuongGiay ? Math.round(v.thoiLuongGiay / 60) : 0,
    lienKet: v.lienKet
  }))
}

function moTaNgan(v) {
  const phan = [v.tenKenh || '—', `${soGon(v.views)} view`]
  if (v.subKenh) phan.push(`${soGon(v.subKenh)} sub`)
  if (v.thoiLuongGiay) phan.push(`${Math.round(v.thoiLuongGiay / 60)} phút`)
  return phan.join(' · ')
}

// --- Đọc/ghi tệp -----------------------------------------------------------
function duongDanTep(thuMuc) {
  return path.join(thuMuc, 'video-da-chon.json')
}

function doc(thuMuc) {
  return chuanHoaDanhSach(docJSON(duongDanTep(thuMuc), { ds: [] }).ds)
}

function ghi(thuMuc, ds) {
  const sach = chuanHoaDanhSach(ds)
  ghiJSON(duongDanTep(thuMuc), { ds: sach, capNhat: Date.now() })
  return sach
}

module.exports = {
  rutGon,
  hopLe,
  themVao,
  boKhoi,
  coTrong,
  chuanHoaDanhSach,
  danhSachLink,
  choPromptKichBan,
  moTaNgan,
  doc,
  ghi,
  TOI_DA
}
