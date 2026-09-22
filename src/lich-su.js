// Lịch sử view của từng kênh, ghi kiểu JSONL (mỗi dòng một bản ghi JSON).
//
// Vì sao JSONL chứ không phải một tệp JSON lớn: ghi chỉ là nối thêm vào cuối
// tệp, nên app tắt đột ngột giữa lúc quét cũng chỉ mất đúng dòng đang ghi dở,
// không hỏng cả tệp. Và không cần module native nào (better-sqlite3 làm vỡ
// build Windows/macOS trên CI).
//
// Có lịch sử từ hai lần quét trở lên là tính được TĂNG TRƯỞNG THẬT giữa hai
// mốc — tín hiệu đáng tin hơn view/giờ, vì nó không phụ thuộc tuổi video.

const fs = require('fs')
const path = require('path')

function thuMucLichSu(thuMucDuLieu) {
  return path.join(thuMucDuLieu, 'lich-su')
}

function duongDanKenh(thuMucDuLieu, kenhId) {
  // kenhId của YouTube chỉ gồm chữ, số, gạch ngang và gạch dưới — nhưng vẫn
  // lọc lại, đừng bao giờ ghép thẳng chuỗi từ ngoài vào đường dẫn tệp.
  const an = String(kenhId || '').replace(/[^A-Za-z0-9_-]/g, '')
  return path.join(thuMucLichSu(thuMucDuLieu), `${an}.jsonl`)
}

// cacMoc = [{ videoId, views, ngayDang, tieuDe }]
function ghiMoc(thuMucDuLieu, kenhId, cacMoc, luc = Date.now()) {
  if (!kenhId || !Array.isArray(cacMoc) || !cacMoc.length) return 0
  const duongDan = duongDanKenh(thuMucDuLieu, kenhId)
  fs.mkdirSync(path.dirname(duongDan), { recursive: true })

  const dong = cacMoc.map((m) => JSON.stringify({
    luc,
    videoId: m.videoId,
    views: Number(m.views) || 0,
    ngayDang: m.ngayDang || '',
    tieuDe: m.tieuDe || ''
  })).join('\n') + '\n'

  fs.appendFileSync(duongDan, dong, 'utf8')
  return cacMoc.length
}

function docLichSu(thuMucDuLieu, kenhId) {
  const duongDan = duongDanKenh(thuMucDuLieu, kenhId)
  let tho
  try {
    tho = fs.readFileSync(duongDan, 'utf8')
  } catch (_) {
    return []
  }
  const ra = []
  for (const dong of tho.split('\n')) {
    if (!dong.trim()) continue
    try {
      ra.push(JSON.parse(dong))
    } catch (_) {
      // Dòng ghi dở vì app tắt đột ngột — bỏ đúng dòng đó, giữ phần còn lại.
      // Đây chính là lý do chọn JSONL.
    }
  }
  return ra
}

// Gom lịch sử theo videoId, sắp theo thời gian.
function gomTheoVideo(lichSu) {
  const bang = new Map()
  for (const m of lichSu) {
    if (!m || !m.videoId) continue
    if (!bang.has(m.videoId)) bang.set(m.videoId, [])
    bang.get(m.videoId).push(m)
  }
  for (const mang of bang.values()) mang.sort((a, b) => a.luc - b.luc)
  return bang
}

// Tăng trưởng giữa mốc mới nhất và mốc gần nhất cách đó ít nhất `cachToiThieuGio`.
//
// Bẫy: nếu chỉ lấy "mốc áp chót" thì hai lần quét cách nhau 10 phút sẽ cho ra
// tăng trưởng gần 0 và mọi video trông như đã nguội. Phải tìm ngược lại tới mốc
// đủ xa mới có ý nghĩa.
function tinhTangTruong(cacMoc, { cachToiThieuGio = 12, bayGio = Date.now() } = {}) {
  if (!Array.isArray(cacMoc) || cacMoc.length < 2) return null
  const xep = [...cacMoc].sort((a, b) => a.luc - b.luc)
  const moiNhat = xep[xep.length - 1]

  let truoc = null
  for (let i = xep.length - 2; i >= 0; i--) {
    const cach = (moiNhat.luc - xep[i].luc) / 3600000
    if (cach >= cachToiThieuGio) { truoc = xep[i]; break }
  }
  if (!truoc) return null

  const soGio = (moiNhat.luc - truoc.luc) / 3600000
  const tang = moiNhat.views - truoc.views
  return {
    tang,
    soGio: Math.round(soGio * 10) / 10,
    tangMoiGio: Math.round(tang / Math.max(1, soGio)),
    tuLuc: truoc.luc,
    denLuc: moiNhat.luc,
    tuoiGio: Math.round((bayGio - new Date(moiNhat.ngayDang).getTime()) / 3600000) || 0
  }
}

function tomTatKenh(thuMucDuLieu, kenhId, tuyChon) {
  const bang = gomTheoVideo(docLichSu(thuMucDuLieu, kenhId))
  const ra = new Map()
  for (const [videoId, moc] of bang) {
    ra.set(videoId, { soMoc: moc.length, tangTruong: tinhTangTruong(moc, tuyChon) })
  }
  return ra
}

module.exports = {
  thuMucLichSu,
  duongDanKenh,
  ghiMoc,
  docLichSu,
  gomTheoVideo,
  tinhTangTruong,
  tomTatKenh
}
