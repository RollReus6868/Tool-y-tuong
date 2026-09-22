// Đếm quota YouTube Data API v3.
//
// BẪY QUAN TRỌNG: quota reset lúc 0h giờ Pacific (America/Los_Angeles), KHÔNG
// phải 0h giờ Việt Nam. Nếu đếm theo ngày địa phương thì cứ đến chiều là tool
// tưởng còn quota trong khi Google đã reset (hoặc ngược lại, tưởng hết trong
// khi còn). Vì vậy khoá của bảng đếm luôn là ngày theo giờ Pacific.

const path = require('path')
const { docJSON, ghiJSON } = require('./store')

const HAN_MUC_MOI_NGAY = 10000

// Giá quota từng lời gọi — con số của Google, không được đoán.
const GIA = {
  'search.list': 100,
  'videos.list': 1,
  'channels.list': 1,
  'playlistItems.list': 1
}

function ngayPacific(luc = new Date()) {
  // en-CA cho ra dạng YYYY-MM-DD, sắp xếp được bằng chuỗi.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(luc)
}

function taoBoDem(thuMuc) {
  const duongDan = path.join(thuMuc, 'quota.json')
  let duLieu = docJSON(duongDan, { theoNgay: {} })

  function bangHomNay() {
    const ngay = ngayPacific()
    if (!duLieu.theoNgay[ngay]) duLieu.theoNgay[ngay] = {}
    // Dọn các ngày cũ hơn 14 ngày cho tệp khỏi phình.
    for (const k of Object.keys(duLieu.theoNgay)) {
      if (k < ngay && Object.keys(duLieu.theoNgay).length > 14) delete duLieu.theoNgay[k]
    }
    return duLieu.theoNgay[ngay]
  }

  return {
    gia: GIA,
    hanMuc: HAN_MUC_MOI_NGAY,
    ngayHomNay: () => ngayPacific(),

    daDung(idKhoa) {
      return bangHomNay()[idKhoa] || 0
    },

    conLai(idKhoa) {
      return Math.max(0, HAN_MUC_MOI_NGAY - (bangHomNay()[idKhoa] || 0))
    },

    // Ghi nhận đã dùng. Trả về số còn lại sau khi trừ.
    dung(idKhoa, soDonVi) {
      const bang = bangHomNay()
      bang[idKhoa] = (bang[idKhoa] || 0) + soDonVi
      ghiJSON(duongDan, duLieu)
      return HAN_MUC_MOI_NGAY - bang[idKhoa]
    },

    // Đánh dấu khoá đã hết quota (khi Google trả 403 quotaExceeded) để lần sau
    // khỏi gọi lại vô ích.
    danhDauHet(idKhoa) {
      const bang = bangHomNay()
      bang[idKhoa] = HAN_MUC_MOI_NGAY
      ghiJSON(duongDan, duLieu)
    },

    // Chọn khoá còn quota nhiều nhất trong danh sách.
    chonKhoa(danhSachKhoa, canBaoNhieu) {
      const conDung = danhSachKhoa
        .map((k) => ({ ...k, conLai: HAN_MUC_MOI_NGAY - (bangHomNay()[k.id] || 0) }))
        .sort((a, b) => b.conLai - a.conLai)
      if (!conDung.length) return null
      if (canBaoNhieu != null && conDung[0].conLai < canBaoNhieu) return null
      return conDung[0]
    },

    toanBo: () => JSON.parse(JSON.stringify(duLieu))
  }
}

// Ước chi phí một lượt tìm ý tưởng, để hiện ra TRƯỚC khi người dùng bấm Tìm.
function uocChiPhi({ soTuKhoa, soVideoMoiTuKhoa, tinhVuotTrungViKenh }) {
  const trangMoiTuKhoa = Math.max(1, Math.ceil(soVideoMoiTuKhoa / 50))
  let tong = soTuKhoa * trangMoiTuKhoa * GIA['search.list']

  const tongVideo = soTuKhoa * soVideoMoiTuKhoa
  tong += Math.ceil(tongVideo / 50) * GIA['videos.list']

  // Ước số kênh riêng biệt ~ 70% số video (nhiều video cùng kênh).
  const soKenh = Math.ceil(tongVideo * 0.7)
  tong += Math.ceil(soKenh / 50) * GIA['channels.list']

  if (tinhVuotTrungViKenh) {
    // Mỗi kênh: playlistItems.list + videos.list = 2 đơn vị (channels.list đã tính ở trên).
    tong += soKenh * 2
  }
  return tong
}

module.exports = { taoBoDem, uocChiPhi, ngayPacific, GIA, HAN_MUC_MOI_NGAY }
