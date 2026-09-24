// Xuất danh sách cảnh ra Excel, lọc cảnh footage, dựng chuỗi số cho Flow và
// kiểm thư mục dựng trước khi đưa sang CapCut.
//
// NGUYÊN TẮC GIỮ ĐÚNG THỨ TỰ — đọc trước khi sửa bất cứ dòng nào ở đây:
//
// Số cảnh là "số căn cước". Nó được đánh MỘT LẦN lúc cắt cảnh và KHÔNG BAO GIỜ
// đánh lại. Lọc bỏ cảnh footage thì danh sách còn lại bị hở số (1, 2, 4, 5, 7…)
// — chỗ hở đó là ĐÚNG. Đánh lại 1, 2, 3… là ảnh Flow và footage đè nhau, CapCut
// ghép lệch cả video mà không báo lỗi gì.
//
// Ba tool nối nhau đều theo số:
//   · Flow nhận prompts.txt ĐẦY ĐỦ + chuỗi số "1-3,5-11" ở ô "Dùng danh sách số
//     tuỳ chọn" → chỉ chạy các số đó và đặt tên tệp theo số gốc.
//   · CapCut Draft Studio ghép Audio/5.mp3 với Videos/5.mp4 hoặc Images/5.jpg
//     (tên tệp phải là CHỈ CHỮ SỐ — "005" được, "05_1" thì không).

const fs = require('fs')
const path = require('path')
const ExcelJS = require('exceljs')

const DUOI_VIDEO = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v']
const DUOI_ANH = ['.png', '.jpg', '.jpeg', '.webp', '.bmp']
const DUOI_AUDIO = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.wma']

// ---------------------------------------------------------------------------
// Chuỗi số cho Flow
// ---------------------------------------------------------------------------

// [1,2,3,5,7,8,9] → "1-3,5,7-9". Đúng cú pháp ô "Dùng danh sách số tuỳ chọn"
// của Flow Automation Studio (parseIndexList trong src/ui/app.js bên đó).
function nenChuoiSo(cacSo) {
  const so = [...new Set((cacSo || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    .sort((a, b) => a - b)
  const ra = []
  let dau = null
  let truoc = null
  for (const n of so) {
    if (dau === null) { dau = truoc = n; continue }
    if (n === truoc + 1) { truoc = n; continue }
    ra.push(dau === truoc ? `${dau}` : `${dau}-${truoc}`)
    dau = truoc = n
  }
  if (dau !== null) ra.push(dau === truoc ? `${dau}` : `${dau}-${truoc}`)
  return ra.join(',')
}

// Ngược lại — dùng để kiểm thử và để đọc lại chuỗi người dùng tự sửa.
function tachChuoiSo(chuoi) {
  const ra = new Set()
  for (const phan of String(chuoi || '').split(',')) {
    const s = phan.trim()
    const m = s.match(/^(\d+)\s*-\s*(\d+)$/)
    if (m) {
      let a = Number(m[1]); let b = Number(m[2])
      if (a > b) [a, b] = [b, a]
      for (let i = a; i <= b; i++) ra.add(i)
    } else if (/^\d+$/.test(s)) ra.add(Number(s))
  }
  return [...ra].sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------
// Kế hoạch footage → danh sách cảnh còn lại cho Flow
// ---------------------------------------------------------------------------

// Cảnh nào ĐÃ CÓ tệp footage thì mới bỏ khỏi danh sách Flow. Cảnh được gắn
// FOOTAGE mà tìm không ra (hoặc tải hỏng) vẫn phải đi Flow — không thì video
// có lỗ hổng hình.
function soCoFootage(keHoach) {
  return new Set(((keHoach && keHoach.canh) || [])
    .filter((c) => c.loai === 'FOOTAGE' && c.chon && c.chon.tep)
    .map((c) => c.so))
}

function canhConLai(canh, keHoach) {
  const bo = soCoFootage(keHoach)
  return (canh || []).filter((c) => !bo.has(c.so))
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

function kieuTieuDe(ws) {
  const h = ws.getRow(1)
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2132' } }
  h.alignment = { vertical: 'middle' }
  h.height = 22
}

function trangHaiCot(wb, ten, cacCanh) {
  const ws = wb.addWorksheet(ten, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'STT', key: 'so', width: 8 },
    { header: 'Cảnh', key: 'chu', width: 110 }
  ]
  kieuTieuDe(ws)
  for (const c of cacCanh) {
    const h = ws.addRow({ so: c.so, chu: c.chu })
    h.getCell('chu').alignment = { wrapText: true, vertical: 'top' }
    h.getCell('so').alignment = { horizontal: 'center', vertical: 'top' }
  }
  return ws
}

// Bước 1: đúng 2 cột, đủ mọi cảnh. Tệp này còn dùng để đọc giọng (TTS) cho TẤT
// CẢ cảnh — kể cả cảnh footage — nên không bao giờ bị sửa ở các bước sau.
async function xuatExcelCanh(duongDan, canh) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tool Ý Tưởng'
  wb.created = new Date()
  trangHaiCot(wb, 'Cảnh', canh)
  await wb.xlsx.writeFile(duongDan)
  return duongDan
}

// Bước 5: trang đầu vẫn đúng 2 cột (STT gốc + Cảnh), chỉ còn cảnh làm bằng Flow.
// Trang phụ ghi nguồn + giấy phép từng footage — bị hỏi bản quyền còn tra được.
async function xuatExcelLoc(duongDan, canh, keHoach) {
  const conLai = canhConLai(canh, keHoach)
  const chuoi = nenChuoiSo(conLai.map((c) => c.so))
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tool Ý Tưởng'
  wb.created = new Date()

  trangHaiCot(wb, 'Cảnh cho Flow', conLai)

  const ws2 = wb.addWorksheet('Footage', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws2.columns = [
    { header: 'STT', key: 'so', width: 8 },
    { header: 'Tệp', key: 'tep', width: 20 },
    { header: 'Loại', key: 'loai', width: 8 },
    { header: 'Nguồn', key: 'nguon', width: 16 },
    { header: 'Tác giả', key: 'tacGia', width: 26 },
    { header: 'Giấy phép', key: 'giayPhep', width: 22 },
    { header: 'Trang gốc', key: 'trang', width: 60 },
    { header: 'Cảnh', key: 'chu', width: 80 }
  ]
  kieuTieuDe(ws2)
  const chuTheoSo = new Map((canh || []).map((c) => [c.so, c.chu]))
  for (const c of (keHoach && keHoach.canh) || []) {
    if (!(c.loai === 'FOOTAGE' && c.chon && c.chon.tep)) continue
    const h = ws2.addRow({
      so: c.so,
      tep: c.chon.tep,
      loai: c.chon.loai === 'video' ? 'Video' : 'Ảnh',
      nguon: c.chon.nguon,
      tacGia: c.chon.tacGia || '',
      giayPhep: c.chon.giayPhep || '',
      trang: c.chon.trang || '',
      chu: chuTheoSo.get(c.so) || ''
    })
    if (c.chon.trang) {
      h.getCell('trang').value = { text: c.chon.trang, hyperlink: c.chon.trang }
      h.getCell('trang').font = { color: { argb: 'FF1D4ED8' }, underline: true }
    }
  }

  const ws3 = wb.addWorksheet('Dán vào Flow')
  ws3.columns = [{ header: 'Mục', key: 'muc', width: 34 }, { header: 'Giá trị', key: 'gt', width: 100 }]
  kieuTieuDe(ws3)
  ws3.addRow({ muc: 'Chuỗi số cho ô "Dùng danh sách số tuỳ chọn"', gt: chuoi })
  ws3.addRow({ muc: 'Số cảnh làm bằng Flow', gt: conLai.length })
  ws3.addRow({ muc: 'Số cảnh đã có footage', gt: (canh || []).length - conLai.length })
  ws3.addRow({ muc: 'Lưu ý', gt: 'Nạp prompts.txt ĐẦY ĐỦ vào Flow (không cắt dòng nào), rồi dán chuỗi số trên. Flow sẽ đặt tên tệp theo số gốc.' })
  ws3.getCell('B2').font = { bold: true, color: { argb: 'FF7C3AED' } }

  await wb.xlsx.writeFile(duongDan)
  return { duongDan, chuoi, soConLai: conLai.length }
}

// Dòng ghi công để dán vào mô tả video. Pexels/Pixabay không bắt buộc nhưng
// khuyến khích; CC BY thì BẮT BUỘC ghi tác giả + giấy phép.
function vanBanGhiCong(keHoach) {
  const dong = []
  for (const c of (keHoach && keHoach.canh) || []) {
    if (!(c.loai === 'FOOTAGE' && c.chon && c.chon.tep)) continue
    const x = c.chon
    const tacGia = x.tacGia ? ` — ${x.tacGia}` : ''
    dong.push(`Cảnh ${c.so}: ${x.nguon}${tacGia} · ${x.giayPhep || 'không rõ giấy phép'} · ${x.trang || ''}`.trim())
  }
  return dong.join('\n') + (dong.length ? '\n' : '')
}

// ---------------------------------------------------------------------------
// Gom tệp Flow vào thư mục dựng + kiểm đủ trước khi sang CapCut
// ---------------------------------------------------------------------------

// Flow đặt tên kiểu "05.png", "05_1.mp4", "12_ten-tuy-chon.png". Số đứng đầu
// tên là số cảnh gốc.
function laySoTuTen(ten) {
  const m = String(ten || '').match(/^(\d+)(?=$|[^0-9])/)
  return m ? Number(m[1]) : null
}

function phanLoaiDuoi(ten) {
  const d = path.extname(String(ten || '')).toLowerCase()
  if (DUOI_VIDEO.includes(d)) return 'video'
  if (DUOI_ANH.includes(d)) return 'anh'
  if (DUOI_AUDIO.includes(d)) return 'audio'
  return null
}

function tenSo(so, doRong = 3) {
  return String(so).padStart(doRong, '0')
}

// Hàm thuần: danh sách tên tệp trong thư mục Flow → các lệnh chép.
// Không chép đè cảnh footage (Flow lỡ chạy số đó thì bỏ qua và báo).
// Một số có nhiều tệp (Flow tạo 2 biến thể) thì lấy tệp tên ngắn nhất rồi theo
// chữ cái — giống quy tắc chọn của CapCut Draft Studio, và báo lại.
function keHoachGom(cacTen, { soFootage = new Set(), doRong = 3 } = {}) {
  const theoSo = new Map()
  const boQua = []
  for (const ten of cacTen) {
    const so = laySoTuTen(ten)
    const loai = phanLoaiDuoi(ten)
    if (so === null || !loai || loai === 'audio') { boQua.push({ ten, lyDo: 'không có số đầu tên hoặc không phải ảnh/video' }); continue }
    if (soFootage.has(so)) { boQua.push({ ten, lyDo: `cảnh ${so} đã dùng footage` }); continue }
    if (!theoSo.has(so)) theoSo.set(so, [])
    theoSo.get(so).push({ ten, loai })
  }
  const lenh = []
  const nhieuTep = []
  for (const [so, ds] of [...theoSo.entries()].sort((a, b) => a[0] - b[0])) {
    // Video thắng ảnh — cùng quy tắc CapCut Draft Studio (có Videos/n thì dùng nó).
    ds.sort((a, b) => (a.loai === b.loai ? 0 : a.loai === 'video' ? -1 : 1) ||
      a.ten.length - b.ten.length || a.ten.localeCompare(b.ten))
    const chon = ds[0]
    if (ds.length > 1) nhieuTep.push({ so, chon: chon.ten, bo: ds.slice(1).map((x) => x.ten) })
    const duoi = path.extname(chon.ten).toLowerCase()
    lenh.push({
      so,
      tu: chon.ten,
      den: path.join(chon.loai === 'video' ? 'Videos' : 'Images', tenSo(so, doRong) + duoi),
      loai: chon.loai
    })
  }
  return { lenh, boQua, nhieuTep }
}

// Hàm thuần: nội dung thư mục dựng → cảnh nào thiếu hình, cảnh nào hai hình.
// cacThuMuc = { Videos: [tên…], Images: [tên…], Audio: [tên…] }
function kiemDu(soCanh, cacThuMuc) {
  const dem = (ds) => {
    const m = new Map()
    for (const ten of ds || []) {
      if (!/^\d+$/.test(path.parse(ten).name)) continue
      const so = Number(path.parse(ten).name)
      m.set(so, (m.get(so) || []).concat(ten))
    }
    return m
  }
  const v = dem(cacThuMuc.Videos)
  const a = dem(cacThuMuc.Images)
  const am = dem(cacThuMuc.Audio)
  const coAudio = (cacThuMuc.Audio || []).length > 0

  const thieuHinh = []
  const haiHinh = []
  const trungSo = []
  const thieuAudio = []
  for (let so = 1; so <= soCanh; so++) {
    const cv = v.get(so) || []
    const ca = a.get(so) || []
    if (!cv.length && !ca.length) thieuHinh.push(so)
    if (cv.length && ca.length) haiHinh.push(so)
    if (cv.length > 1 || ca.length > 1) trungSo.push(so)
    if (coAudio && !(am.get(so) || []).length) thieuAudio.push(so)
  }
  const thua = [...new Set([...v.keys(), ...a.keys()])].filter((so) => so > soCanh).sort((x, y) => x - y)
  return {
    ok: !thieuHinh.length && !trungSo.length && !thua.length && !thieuAudio.length,
    soCanh,
    thieuHinh,
    haiHinh,       // có cả video lẫn ảnh — CapCut dùng video, ảnh làm dự phòng khi video ngắn
    trungSo,       // cùng số hai tệp trong một thư mục (vd 5.jpg và 005.png)
    thua,          // số lớn hơn tổng số cảnh — gần như chắc chắn nhầm dự án
    thieuAudio,
    coAudio
  }
}

function docTenTrongThuMuc(thuMuc) {
  try {
    return fs.readdirSync(thuMuc, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name)
  } catch (_) {
    return []
  }
}

module.exports = {
  DUOI_VIDEO,
  DUOI_ANH,
  nenChuoiSo,
  tachChuoiSo,
  soCoFootage,
  canhConLai,
  xuatExcelCanh,
  xuatExcelLoc,
  vanBanGhiCong,
  laySoTuTen,
  phanLoaiDuoi,
  tenSo,
  keHoachGom,
  kiemDu,
  docTenTrongThuMuc
}
