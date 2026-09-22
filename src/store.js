// Lưu trữ: JSON ghi ra file, KHÔNG dùng module native (better-sqlite3 làm vỡ
// build Windows/macOS trên CI). Ghi kiểu nguyên tử: ghi tệp tạm rồi đổi tên,
// để app tắt đột ngột giữa lúc ghi cũng không mất tệp cài đặt.

const fs = require('fs')
const path = require('path')

const CAI_DAT_MAC_DINH = {
  khoaApi: [],              // [{ id, ten, khoa }]
  soVideoMoiTuKhoa: 25,
  soNgay: 14,
  boShorts: true,           // luôn bật: kênh này chỉ làm video dài
  thoiLuongToiThieuGiay: 61,
  chiVideoDai: false,       // preset "cùng hạng với mình": chỉ >= 20 phút
  viewToiThieu: 10000,
  subToiDaTrieu: 0,         // 0 = không loại kênh lớn
  tinhVuotTrungViKenh: true,
  regionCode: 'US',
  relevanceLanguage: 'en',
  tuMoiPhut: 150,           // để ước thời lượng kịch bản
  tuMoiCanh: 27,            // 25-30 từ mỗi cảnh
  soTuMucTieu: 11000,       // 10.000 - 12.000 từ
  soPhanKichBan: 8,
  tuDongKiemCapNhat: true
}

function docJSON(duongDan, macDinh) {
  try {
    const tho = fs.readFileSync(duongDan, 'utf8')
    const duLieu = JSON.parse(tho)
    return { ...macDinh, ...duLieu }
  } catch (_) {
    return { ...macDinh }
  }
}

function ghiJSON(duongDan, duLieu) {
  fs.mkdirSync(path.dirname(duongDan), { recursive: true })
  const tam = duongDan + '.tam'
  fs.writeFileSync(tam, JSON.stringify(duLieu, null, 2), 'utf8')
  fs.renameSync(tam, duongDan)
}

function taoKho(thuMuc) {
  const duongDanCaiDat = path.join(thuMuc, 'cai-dat.json')
  const duongDanCache = path.join(thuMuc, 'cache-tim-kiem.json')

  return {
    thuMuc,
    docCaiDat: () => docJSON(duongDanCaiDat, CAI_DAT_MAC_DINH),
    ghiCaiDat: (caiDat) => ghiJSON(duongDanCaiDat, caiDat),
    docCache: () => docJSON(duongDanCache, { muc: {} }),
    ghiCache: (cache) => ghiJSON(duongDanCache, cache),
    duongDanCaiDat
  }
}

module.exports = { taoKho, docJSON, ghiJSON, CAI_DAT_MAC_DINH }
