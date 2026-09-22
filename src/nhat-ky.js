// Nhật ký: ghi ra FILE bằng appendFileSync, không tin console.log.
// Lý do: khi tiến trình sập thì stdout mất, còn file thì còn dòng cuối cùng —
// dòng cuối là thứ định vị chính xác chỗ chết.

const fs = require('fs')
const path = require('path')

let duongDanTep = null
const boDem = [] // giữ các dòng gần nhất cho giao diện đọc
const GIOI_HAN_BO_DEM = 800

function datThuMuc(thuMuc) {
  try {
    fs.mkdirSync(thuMuc, { recursive: true })
    duongDanTep = path.join(thuMuc, 'nhat-ky.txt')
  } catch (loi) {
    duongDanTep = null
    console.error('Không tạo được thư mục nhật ký:', loi.message)
  }
}

function nhan() {
  const d = new Date()
  const hai = (n) => String(n).padStart(2, '0')
  return `${hai(d.getDate())}/${hai(d.getMonth() + 1)} ${hai(d.getHours())}:${hai(d.getMinutes())}:${hai(d.getSeconds())}`
}

function ghi(muc, ...phan) {
  const dong = `[${nhan()}] [${muc}] ` + phan
    .map((p) => (typeof p === 'string' ? p : JSON.stringify(p)))
    .join(' ')

  boDem.push(dong)
  if (boDem.length > GIOI_HAN_BO_DEM) boDem.shift()

  if (duongDanTep) {
    try {
      fs.appendFileSync(duongDanTep, dong + '\n', 'utf8')
    } catch (_) {
      // Ổ đĩa đầy hoặc mất quyền ghi: không được để việc ghi log làm sập app.
    }
  }
  console.log(dong)
}

module.exports = {
  datThuMuc,
  duongDan: () => duongDanTep,
  tin: (...p) => ghi('TIN', ...p),
  canhBao: (...p) => ghi('CẢNH BÁO', ...p),
  loi: (...p) => ghi('LỖI', ...p),
  cacDong: (soDong = 400) => boDem.slice(-soDong)
}
