// Xuất bảng kết quả ra .xlsx. Dùng exceljs (JavaScript thuần, không phải module
// native) nên đóng gói cho Windows/macOS không vỡ.

const ExcelJS = require('exceljs')

const MAU = {
  'NỔ VIEW': 'FF8B5CF6',
  'TỐT': 'FFFF7A1A',
  'KHÁ': 'FFFFCC33',
  'BÌNH THƯỜNG': 'FF9AA4B2'
}

function soGio(ngayDang) {
  const t = new Date(ngayDang).getTime()
  if (!Number.isFinite(t)) return ''
  return Math.round((Date.now() - t) / 3600000)
}

function phutGiay(giay) {
  if (!giay) return ''
  const p = Math.floor(giay / 60)
  const g = giay % 60
  return `${p}:${String(g).padStart(2, '0')}`
}

async function xuatExcel(duongDan, cacDong, { tuKhoa = [], caiDat = {} } = {}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tool Ý Tưởng'
  wb.created = new Date()

  const ws = wb.addWorksheet('Video nổ view', {
    views: [{ state: 'frozen', ySplit: 1 }]
  })

  ws.columns = [
    { header: 'Nhãn', key: 'nhan', width: 14 },
    { header: 'Điểm', key: 'diem', width: 8 },
    { header: 'Tiêu đề', key: 'tieuDe', width: 62 },
    { header: 'Kênh', key: 'tenKenh', width: 26 },
    { header: 'View', key: 'views', width: 12 },
    { header: 'View/giờ', key: 'vph', width: 11 },
    { header: 'View/Sub', key: 'tyLeSub', width: 10 },
    { header: 'Vượt trung vị kênh', key: 'vuotTrungVi', width: 18 },
    { header: 'Sub kênh', key: 'subKenh', width: 13 },
    { header: 'Thời lượng', key: 'thoiLuong', width: 11 },
    { header: 'Đăng cách đây (giờ)', key: 'gio', width: 18 },
    { header: 'Like', key: 'likes', width: 10 },
    { header: 'Bình luận', key: 'binhLuan', width: 11 },
    { header: 'Từ khóa tìm ra', key: 'tuKhoaNguon', width: 34 },
    { header: 'Link', key: 'lienKet', width: 45 }
  ]

  const hang1 = ws.getRow(1)
  hang1.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  hang1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2132' } }
  hang1.alignment = { vertical: 'middle' }
  hang1.height = 22

  for (const d of cacDong) {
    const hang = ws.addRow({
      nhan: d.nhan,
      diem: d.diem,
      tieuDe: d.tieuDe,
      tenKenh: d.tenKenh,
      views: d.views,
      vph: d.vph,
      tyLeSub: d.tyLeSub,
      vuotTrungVi: d.vuotTrungVi || '',
      subKenh: d.subKenh,
      thoiLuong: phutGiay(d.thoiLuongGiay),
      gio: soGio(d.ngayDang),
      likes: d.likes,
      binhLuan: d.binhLuan,
      tuKhoaNguon: (d.tuKhoaNguon || []).join(' · '),
      lienKet: d.lienKet
    })

    const o = hang.getCell('nhan')
    o.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    o.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAU[d.nhan] || MAU['BÌNH THƯỜNG'] } }
    o.alignment = { horizontal: 'center' }

    hang.getCell('views').numFmt = '#,##0'
    hang.getCell('vph').numFmt = '#,##0'
    hang.getCell('subKenh').numFmt = '#,##0'
    hang.getCell('likes').numFmt = '#,##0'
    hang.getCell('binhLuan').numFmt = '#,##0'
    hang.getCell('lienKet').value = { text: d.lienKet, hyperlink: d.lienKet }
    hang.getCell('lienKet').font = { color: { argb: 'FF1D4ED8' }, underline: true }
  }

  ws.autoFilter = { from: 'A1', to: 'O1' }

  // Trang thứ hai ghi lại điều kiện tìm — để sau này mở file còn biết bảng này
  // ra từ đâu, tránh chuyện so hai file khác điều kiện mà tưởng cùng điều kiện.
  const ws2 = wb.addWorksheet('Điều kiện tìm')
  ws2.columns = [{ header: 'Mục', key: 'muc', width: 30 }, { header: 'Giá trị', key: 'gt', width: 60 }]
  ws2.getRow(1).font = { bold: true }
  const dong2 = [
    ['Thời điểm tìm', new Date().toLocaleString('vi-VN')],
    ['5 từ khóa', tuKhoa.join(' · ')],
    ['Khoảng thời gian', `${caiDat.soNgay || 14} ngày gần nhất`],
    ['Số video mỗi từ khóa', caiDat.soVideoMoiTuKhoa || 25],
    ['Quốc gia / ngôn ngữ', `${caiDat.regionCode || 'US'} / ${caiDat.relevanceLanguage || 'en'}`],
    ['Bỏ Shorts', caiDat.boShorts === false ? 'Không' : 'Có'],
    ['Chỉ video ≥ 20 phút', caiDat.chiVideoDai ? 'Có' : 'Không'],
    ['View tối thiểu', caiDat.viewToiThieu || 0],
    ['Tính vượt trung vị kênh', caiDat.tinhVuotTrungViKenh ? 'Có' : 'Không'],
    ['Tổng số video trong bảng', cacDong.length]
  ]
  for (const [muc, gt] of dong2) ws2.addRow({ muc, gt })

  await wb.xlsx.writeFile(duongDan)
  return duongDan
}

module.exports = { xuatExcel }
