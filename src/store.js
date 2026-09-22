// Lưu trữ: JSON ghi ra file, KHÔNG dùng module native (better-sqlite3 làm vỡ
// build Windows/macOS trên CI). Ghi kiểu nguyên tử: ghi tệp tạm rồi đổi tên,
// để app tắt đột ngột giữa lúc ghi cũng không mất tệp cài đặt.

const fs = require('fs')
const path = require('path')

// Các khoá là MẢNG hoặc ĐỐI TƯỢNG có giao diện riêng, không phải một ô nhập
// đơn giản. Kiểm thử tầng 2 bỏ qua chúng khi dò "mọi khoá cài đặt có ô tương
// ứng không" — thiếu danh sách này là smoke báo đỏ oan.
const KHOA_PHUC_TAP = [
  'khoaApi', 'kenhTheoDoi', 'khoSkill', 'taiKhoan',
  'khoNhanVat', 'khoBoiCanh', 'oPrompt'
]

const CAI_DAT_MAC_DINH = {
  khoaApi: [],              // [{ id, ten, khoa }]
  kenhTheoDoi: [],          // [{ kenhId, ten, dinhDanh, subKenh }]
  khoSkill: [],             // [{ id, ten, noiDung, soTu }]
  taiKhoan: [],             // [{ id, ten }] — KHÔNG bao giờ chứa mật khẩu
  khoNhanVat: [],           // [{ ten, moTa, tuKhoa: [] }]
  khoBoiCanh: [],
  oPrompt: {},              // ô thay thế của template prompt ảnh

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
  tuDongKiemCapNhat: true,

  // Kênh theo dõi
  soVideoMoiKenh: 20,
  nguongNoView: 3,          // vượt trung vị kênh bao nhiêu lần thì gắn NỔ VIEW
  nguongTot: 1.8,

  // Lời thoại
  dungCookie: false,        // dùng cookie tài khoản khi YouTube đòi đăng nhập

  // Prompt ảnh
  gopCanh: 1,               // 2 = gộp 2 cảnh một ảnh, còn nửa số ảnh phải render
  templatePrompt: '',       // rỗng = dùng template mặc định trong prompt-anh.js
  soCanhMoiLo: 50           // số cảnh mỗi lô khi xin Claude mô tả
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

module.exports = { taoKho, docJSON, ghiJSON, CAI_DAT_MAC_DINH, KHOA_PHUC_TAP }
