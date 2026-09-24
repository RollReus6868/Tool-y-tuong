// Điều phối: tìm footage cho từng cảnh FOOTAGE, tải bản tốt nhất, đặt tên theo
// SỐ CẢNH GỐC, ghi kế hoạch ra tệp để mở lại app vẫn còn.
//
// Bố cục thư mục dựng (một video = một thư mục):
//
//   <thư mục dựng>/
//     canh.xlsx                 ← bước 1, đủ mọi cảnh (dùng cho TTS)
//     footage-ke-hoach.json     ← nhãn FOOTAGE/AI, từ khóa, tệp đã chọn
//     Videos/004.mp4            ← footage video của cảnh 4
//     Images/012.jpg            ← footage ảnh của cảnh 12
//     _footage-da-bo/           ← tệp bị thay/bị trả về AI (không xoá hẳn)
//     canh-cho-flow.xlsx        ← bước 5, chỉ còn cảnh AI, GIỮ SỐ GỐC
//     chuoi-so-flow.txt         ← "1-3,5-11,…" dán vào Flow
//     ghi-cong-footage.txt      ← dán vào mô tả video
//
// Thư mục này chính là thư mục INPUT của CapCut Draft Studio (nó đọc Audio/,
// Videos/, Images/ đánh số).
//
// Mọi hàm nhận hàm mạng nhồi vào → kiểm thử tầng 1 chạy được cả chuỗi.

const fs = require('fs')
const path = require('path')
const { tenSo } = require('./xuat-canh')

const TEN_KE_HOACH = 'footage-ke-hoach.json'
const THU_MUC_BO = '_footage-da-bo'

// Tệp nhỏ hơn mức này gần như chắc chắn là trang lỗi / ảnh giữ chỗ, không phải
// footage thật (bài học ảnh xám 120×90 của YouTube: có lúc trả mã 200).
const BYTE_TOI_THIEU = { video: 150 * 1024, anh: 12 * 1024 }

function duongDanTep(so, uv, doRong = 3) {
  const duoi = uv.loai === 'video' ? 'mp4' : (uv.duoi || 'jpg')
  return path.join(uv.loai === 'video' ? 'Videos' : 'Images', `${tenSo(so, doRong)}.${duoi}`)
}

// Không xoá hẳn: chuyển vào _footage-da-bo/ (CapCut không quét thư mục này).
function dayRaBo(thuMuc, rel) {
  if (!rel) return null
  const tu = path.join(thuMuc, rel)
  if (!fs.existsSync(tu)) return null
  const bo = path.join(thuMuc, THU_MUC_BO)
  fs.mkdirSync(bo, { recursive: true })
  const den = path.join(bo, `${Date.now()}-${path.basename(rel)}`)
  fs.renameSync(tu, den)
  return den
}

function docKeHoach(thuMuc) {
  const dd = path.join(thuMuc, TEN_KE_HOACH)
  if (!fs.existsSync(dd)) return null
  const chu = fs.readFileSync(dd, 'utf8')
  try {
    return JSON.parse(chu)
  } catch (e) {
    // JSON vỡ thì BÁO VỠ, không âm thầm coi như chưa có kế hoạch (sẽ tải lại
    // và đè hết lựa chọn người dùng đã duyệt).
    const loi = new Error(`Tệp ${TEN_KE_HOACH} bị hỏng (${e.message}). Đổi tên tệp đó rồi mở lại để làm kế hoạch mới.`)
    loi.hong = true
    throw loi
  }
}

function ghiKeHoach(thuMuc, keHoach) {
  fs.mkdirSync(thuMuc, { recursive: true })
  const dd = path.join(thuMuc, TEN_KE_HOACH)
  const tam = dd + '.tam'
  fs.writeFileSync(tam, JSON.stringify({ ...keHoach, capNhatLuc: new Date().toISOString() }, null, 2), 'utf8')
  fs.renameSync(tam, dd)
  return dd
}

function rutGon(uv) {
  return {
    id: uv.id, nguon: uv.nguon, loai: uv.loai, tieuDe: uv.tieuDe, trang: uv.trang,
    taiVe: uv.taiVe, duoi: uv.duoi, rong: uv.rong, cao: uv.cao, thoiLuong: uv.thoiLuong,
    tacGia: uv.tacGia, giayPhep: uv.giayPhep, thumb: uv.thumb, diem: uv.diem
  }
}

// Tải MỘT ứng viên cho MỘT cảnh. Tệp cũ của cảnh (nếu có) chuyển vào _bo TRƯỚC
// khi tải — không thì đổi từ video sang ảnh sẽ để lại cả Videos/004.mp4 lẫn
// Images/004.jpg, CapCut lấy video cũ.
async function taiChoCanh(c, uv, { thuMuc, taiVeTepHam, baoByte = null, doRong = 3 }) {
  const rel = duongDanTep(c.so, uv, doRong)
  const dich = path.join(thuMuc, rel)
  fs.mkdirSync(path.dirname(dich), { recursive: true })
  if (c.chon && c.chon.tep) dayRaBo(thuMuc, c.chon.tep)
  if (fs.existsSync(dich)) dayRaBo(thuMuc, rel)

  const kq = await taiVeTepHam(uv.taiVe, dich, { baoByte })
  if (!kq || !kq.ok) throw new Error(`tải hỏng (HTTP ${kq ? kq.maHttp : '?'})`)
  const toiThieu = BYTE_TOI_THIEU[uv.loai] || 1
  if (kq.soByte < toiThieu) {
    dayRaBo(thuMuc, rel)
    throw new Error(`tệp chỉ ${kq.soByte} byte — không phải ${uv.loai === 'video' ? 'video' : 'ảnh'} thật`)
  }
  if (kq.kieu && /text\/html|application\/json/i.test(kq.kieu)) {
    dayRaBo(thuMuc, rel)
    throw new Error(`máy chủ trả ${kq.kieu}, không phải tệp phương tiện`)
  }
  c.chon = { ...rutGon(uv), tep: rel.split(path.sep).join('/'), soByte: kq.soByte, taiLuc: new Date().toISOString() }
  return c.chon
}

function idDaDung(keHoach, truSo = null) {
  return new Set((keHoach.canh || [])
    .filter((c) => c.chon && c.chon.id && c.so !== truSo)
    .map((c) => c.chon.id))
}

// Chạy cả loạt. chiSo: chỉ chạy các số này (nút "Tìm lại" từng cảnh); bỏ trống
// = mọi cảnh FOOTAGE chưa có tệp.
async function chayTimVaTai(keHoach, {
  thuMuc,
  timChoCanh,
  taiVeTepHam,
  giayTheoSo = {},
  chiSo = null,
  soUngVien = 6,
  baoTienDo = () => {},
  daHuy = () => false,
  luu = () => {},
  doRong = 3
}) {
  const can = keHoach.canh.filter((c) => c.loai === 'FOOTAGE' &&
    (chiSo ? chiSo.includes(c.so) : !(c.chon && c.chon.tep)))
  const loi = []
  let soTai = 0
  let soKhongThay = 0

  for (let i = 0; i < can.length; i++) {
    if (daHuy()) { loi.push({ so: null, loi: 'Đã dừng theo yêu cầu.' }); break }
    const c = can[i]
    const baoMoc = (chiTiet) => baoTienDo({
      phanTram: Math.round((i / Math.max(1, can.length)) * 100),
      viec: `Footage cảnh ${c.so} (${i + 1}/${can.length})`,
      chiTiet,
      soLoi: loi.length
    })
    baoMoc(`Tìm "${c.tuKhoaTim}"`)

    const daDung = idDaDung(keHoach, c.so)
    const { ungVien, loi: loiTim } = await timChoCanh(
      { tuKhoaTim: c.tuKhoaTim, kieu: c.kieu, giayCanh: giayTheoSo[c.so] || 9 },
      { soUngVien, daDung })
    c.ungVien = ungVien.map(rutGon)
    if (loiTim.length && !ungVien.length) loi.push({ so: c.so, loi: loiTim.join(' · ') })

    if (!ungVien.length) {
      soKhongThay++
      c.khongThay = true
      luu(keHoach)
      continue
    }
    c.khongThay = false

    // Tải hỏng thì thử ứng viên kế (tối đa 3) — một link chết không được làm
    // cảnh đó trống hình.
    let xong = false
    for (const uv of ungVien.slice(0, 3)) {
      try {
        await taiChoCanh(c, uv, {
          thuMuc,
          taiVeTepHam,
          doRong,
          baoByte: (da, tong) => baoMoc(`Tải ${uv.nguon} · ${(da / 1048576).toFixed(1)}${tong ? '/' + (tong / 1048576).toFixed(1) : ''} MB`)
        })
        xong = true
        soTai++
        break
      } catch (e) {
        loi.push({ so: c.so, loi: `${uv.nguon}: ${e.message}` })
      }
    }
    if (!xong) c.chon = null
    luu(keHoach)
  }

  return { soCan: can.length, soTai, soKhongThay, loi }
}

// "Trả về AI": cảnh không ưng footage → Flow làm. Tệp chuyển vào _bo.
function traVeAi(keHoach, so, thuMuc) {
  const c = keHoach.canh.find((x) => x.so === so)
  if (!c) return false
  if (c.chon && c.chon.tep) dayRaBo(thuMuc, c.chon.tep)
  c.chon = null
  c.loai = 'AI'
  c.nguonPhanLoai = 'tay'
  return true
}

module.exports = {
  TEN_KE_HOACH,
  THU_MUC_BO,
  BYTE_TOI_THIEU,
  duongDanTep,
  dayRaBo,
  docKeHoach,
  ghiKeHoach,
  taiChoCanh,
  chayTimVaTai,
  traVeAi
}
