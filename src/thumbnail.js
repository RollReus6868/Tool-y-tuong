// Tải thumbnail video YouTube về máy.
//
// Ảnh nằm ở i.ytimg.com, KHÔNG tốn quota API. Cỡ ảnh lùi dần:
//   maxresdefault 1280×720 → sddefault 640×480 → hqdefault 480×360
// Không phải video nào cũng có bản maxres; thiếu thì Google trả 404 kèm một
// ảnh xám 120×90. Vì vậy phải xét CẢ mã HTTP lẫn kích thước tệp — chỉ xét
// mã HTTP là có ngày lưu về cả trăm tấm ảnh xám mà không ai biết.

const fs = require('fs')
const path = require('path')

const CO_ANH = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault']

// Ảnh xám "không có ảnh" của YouTube nặng khoảng 1 KB; thumbnail thật nhỏ
// nhất (mqdefault) cũng trên 5 KB.
const KICH_THUOC_TOI_THIEU = 2500

function urlThumbnail(videoId, co = 'maxresdefault') {
  return `https://i.ytimg.com/vi/${videoId}/${co}.jpg`
}

// Danh sách URL sẽ thử, theo thứ tự. URL lấy từ API (nếu có) thử trước vì nó
// chắc chắn tồn tại.
function cacUrlThu(video) {
  const ds = []
  if (video.thumbnail && /^https:\/\/i\d?\.ytimg\.com\//.test(video.thumbnail)) ds.push(video.thumbnail)
  for (const co of CO_ANH) ds.push(urlThumbnail(video.videoId, co))
  return [...new Set(ds)]
}

// Tên tệp an toàn trên Windows: bỏ <>:"/\|?* và ký tự điều khiển, bỏ dấu chấm
// và khoảng trắng cuối (Windows cấm), cắt ngắn để đường dẫn không vượt 260 ký
// tự. Giữ mã video trong ngoặc vuông để hai video trùng tiêu đề không đè nhau.
function tenTepThumbnail(video, stt, tong = 0) {
  const doRong = Math.max(3, String(tong || stt).length)
  const so = String(stt).padStart(doRong, '0')
  let ten = String(video.tieuDe || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .replace(/[. ]+$/, '')
  if (!ten) ten = 'video'
  return `${so} - ${ten} [${video.videoId}].jpg`
}

// layNhiPhanHam(url) → { ok, maHttp, du } — nhồi được hàm giả để kiểm thử.
async function taiMotThumbnail(video, thuMuc, stt, { tong = 0, layNhiPhanHam } = {}) {
  let lanCuoi = ''
  for (const url of cacUrlThu(video)) {
    try {
      const kq = await layNhiPhanHam(url)
      if (kq.ok && kq.du && kq.du.length >= KICH_THUOC_TOI_THIEU) {
        const dich = path.join(thuMuc, tenTepThumbnail(video, stt, tong))
        fs.writeFileSync(dich, kq.du)
        return { ok: true, duongDan: dich, url, soByte: kq.du.length }
      }
      lanCuoi = `HTTP ${kq.maHttp}${kq.du ? ` · ${kq.du.length} byte` : ''}`
    } catch (loi) {
      lanCuoi = loi.message
    }
  }
  return { ok: false, loi: `Không tải được thumbnail nào (lần thử cuối: ${lanCuoi})` }
}

async function taiNhieuThumbnail(cacVideo, thuMuc, { layNhiPhanHam, baoTienDo = () => {} } = {}) {
  fs.mkdirSync(thuMuc, { recursive: true })
  const ketQua = []
  const loi = []
  for (let i = 0; i < cacVideo.length; i++) {
    const v = cacVideo[i]
    baoTienDo({
      phanTram: Math.round((i / cacVideo.length) * 100),
      viec: 'Tải thumbnail',
      chiTiet: `${i + 1}/${cacVideo.length} · ${(v.tieuDe || v.videoId).slice(0, 60)}`,
      daXong: i,
      tong: cacVideo.length,
      soLoi: loi.length
    })
    const kq = await taiMotThumbnail(v, thuMuc, i + 1, { tong: cacVideo.length, layNhiPhanHam })
    if (kq.ok) ketQua.push({ videoId: v.videoId, ...kq })
    else loi.push({ videoId: v.videoId, tieuDe: v.tieuDe, loi: kq.loi })
  }
  return { ketQua, loi }
}

module.exports = {
  urlThumbnail,
  cacUrlThu,
  tenTepThumbnail,
  taiMotThumbnail,
  taiNhieuThumbnail,
  KICH_THUOC_TOI_THIEU,
  CO_ANH
}
