// Điều phối một lượt Radar đề xuất.
//
// Mô-đun này KHÔNG đụng tới Electron: việc mở trang được nhồi vào qua hàm
// `docTrang(url, { loai, kiemDu })`. Nhờ vậy kiểm thử tầng 1 chạy được cả
// chuỗi (tìm hạt giống → đọc cột đề xuất → tổng hợp → ghép số liệu API) bằng
// dữ liệu mẫu, không cần mạng, không cần cửa sổ.

const radar = require('./radar-de-xuat')
const { chamDiem, locVideo } = require('./cham-diem')

// Dữ liệu trang → danh sách video. Có ytInitialData thì phân tích nó; không
// có (YouTube đổi cấu trúc) thì lùi về danh sách mã video đọc từ thẻ <a>.
function videoTuTrang(tho, loai, { boQuaId = '' } = {}) {
  if (!tho) return []
  const tuDuLieu = tho.khoi ? radar.rutVideoTuDuLieu(tho.khoi, { boQuaId }) : []
  if (tuDuLieu.length) return tuDuLieu
  return (tho.idDom || [])
    .filter((id) => id !== boQuaId)
    .map((id, i) => ({
      videoId: id,
      tieuDe: '',
      tenKenh: '',
      viTri: i + 1,
      viewUoc: 0,
      thoiLuongGiay: 0,
      lienKet: `https://www.youtube.com/watch?v=${id}`,
      thumbnailNho: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      tuDom: true
    }))
}

async function chayRadar({
  tuKhoaLinhVuc = '',          // chuỗi người dùng nhập, cách nhau dấu phẩy
  docTrang,                    // async (url, { loai, kiemDu }) => { coDuLieu, url, khoi, idDom }
  soHatGiong = 8,
  hatGiongCo = [],             // mã video lấy từ danh sách "Video đã chọn"
  timTrenYouTube = true,
  docTrangChu = true,
  thoiGian = 'thang',
  soTuKhoaToiDa = 3,
  ngu = (ms) => new Promise((r) => setTimeout(r, ms)),
  nhatKy = { tin() {}, loi() {}, canhBao() {} },
  baoTienDo = () => {}
}) {
  const { cum } = radar.tachTuLinhVuc(tuKhoaLinhVuc)
  const tuKhoa = cum.slice(0, soTuKhoaToiDa)
  const canhBao = []
  const cacLanDoc = []

  // Nghỉ ngẫu nhiên giữa các trang: mở liền 15 trang trong 10 giây là kiểu
  // hành vi YouTube dễ bắt xác minh "bạn có phải người máy".
  const nghi = () => ngu(1200 + Math.floor(Math.random() * 1200))

  const tongBuoc = (timTrenYouTube ? tuKhoa.length : 0) + soHatGiong + (docTrangChu ? 1 : 0)
  let buoc = 0
  const bao = (viec, chiTiet) => {
    buoc += 1
    baoTienDo({
      phanTram: Math.min(95, Math.round((buoc / Math.max(1, tongBuoc)) * 95)),
      viec, chiTiet, daXong: buoc, tong: tongBuoc, soLoi: canhBao.length
    })
  }

  const kiemChan = (tho, mo) => {
    if (tho && radar.laTrangChan(tho.url)) {
      throw new Error(`YouTube chuyển sang trang xác minh khi mở ${mo}. Mở màn Trình duyệt bằng tài khoản này, ` +
        'đăng nhập / xác minh xong rồi chạy lại radar.')
    }
  }

  // --- 1. Hạt giống --------------------------------------------------------
  const cacTrangTim = []
  if (timTrenYouTube) {
    for (const tk of tuKhoa) {
      try {
        const tho = await docTrang(radar.urlTimKiem(tk, { thoiGian, sapXep: 'luot-xem' }), {
          loai: 'tim',
          kiemDu: (t) => videoTuTrang(t, 'tim').length >= 5
        })
        kiemChan(tho, `trang tìm "${tk}"`)
        const ds = videoTuTrang(tho, 'tim')
        cacTrangTim.push(ds)
        nhatKy.tin(`Radar: tìm "${tk}" → ${ds.length} video`)
        bao(`Tìm hạt giống: ${tk}`, `${ds.length} video`)
      } catch (e) {
        if (/xác minh/.test(e.message)) throw e
        canhBao.push(`Tìm "${tk}" lỗi: ${e.message}`)
        nhatKy.loi(`Radar: tìm "${tk}" lỗi: ${e.message}`)
        bao(`Tìm hạt giống: ${tk}`, 'LỖI')
      }
      await nghi()
    }
  }

  const hatGiong = radar.chonHatGiong(cacTrangTim, soHatGiong, { daCo: hatGiongCo.slice(0, soHatGiong) })
  if (!hatGiong.length && !docTrangChu) {
    return {
      dong: [], hatGiong, cacLanDoc, canhBao,
      ghiChu: 'Không có video hạt giống nào. Nhập từ khóa lĩnh vực, hoặc tick vài video ở màn Ý tưởng rồi bật "dùng video đã chọn".'
    }
  }

  // --- 2. Cột đề xuất của từng hạt giống ----------------------------------
  for (const id of hatGiong) {
    try {
      const tho = await docTrang(radar.urlXem(id), {
        loai: 'xem',
        kiemDu: (t) => videoTuTrang(t, 'xem', { boQuaId: id }).length >= 8
      })
      kiemChan(tho, 'trang xem video')
      const ds = videoTuTrang(tho, 'xem', { boQuaId: id })
      cacLanDoc.push({ loai: 'xem', nguon: id, video: ds })
      bao('Đọc cột đề xuất', `${cacLanDoc.length}/${hatGiong.length} · ${ds.length} video`)
      if (!ds.length) canhBao.push(`Video ${id}: không đọc được cột đề xuất.`)
    } catch (e) {
      if (/xác minh/.test(e.message)) throw e
      canhBao.push(`Video ${id}: ${e.message}`)
      nhatKy.loi(`Radar: đọc ${id} lỗi: ${e.message}`)
      bao('Đọc cột đề xuất', 'LỖI')
    }
    await nghi()
  }

  // --- 3. Trang chủ tài khoản ----------------------------------------------
  if (docTrangChu) {
    try {
      const tho = await docTrang(radar.urlTrangChu(), {
        loai: 'trangChu',
        kiemDu: (t) => videoTuTrang(t, 'trangChu').length >= 6
      })
      kiemChan(tho, 'trang chủ')
      const ds = videoTuTrang(tho, 'trangChu')
      if (ds.length) cacLanDoc.push({ loai: 'trangChu', nguon: 'trang-chu', video: ds })
      else {
        canhBao.push('Trang chủ trống — tài khoản chưa đăng nhập, chưa có lịch sử xem, hoặc đang tắt lịch sử xem. ' +
          'Muốn trang chủ ra đúng lĩnh vực thì dùng tài khoản đó xem vài video trong lĩnh vực trước.')
      }
      bao('Đọc trang chủ', `${ds.length} video`)
    } catch (e) {
      if (/xác minh/.test(e.message)) throw e
      canhBao.push(`Trang chủ: ${e.message}`)
      bao('Đọc trang chủ', 'LỖI')
    }
  }

  const dong = radar.tongHop(cacLanDoc, { tuKhoaLinhVuc, hatGiong })
  return { dong, hatGiong, cacLanDoc, canhBao, tuKhoa }
}

// Ghép số liệu API (view, sub, ngày đăng…) vào bảng radar rồi chấm thêm điểm
// nổ view. Radar vẫn là thứ tự CHÍNH (đang được đề xuất mạnh tới đâu); điểm nổ
// view chỉ để phân hạng những video được đề xuất như nhau.
function ghepSoLieuApi(dongRadar, dongApi, bangKenh, caiDat = {}, { bayGio = Date.now() } = {}) {
  const theoId = new Map((dongApi || []).map((d) => [d.videoId, d]))
  const coApi = []
  const khongApi = []
  for (const r of dongRadar) {
    const a = theoId.get(r.videoId)
    if (!a) { khongApi.push({ ...r, views: r.viewUoc, coSoLieuApi: false }); continue }
    const k = bangKenh ? bangKenh.get(a.kenhId) : null
    coApi.push({
      ...r,
      ...a,
      // Giữ các trường của radar, API không có.
      nguon: r.nguon, soNguon: r.soNguon, tongNguon: r.tongNguon, diemDeXuat: r.diemDeXuat,
      nhanDeXuat: r.nhanDeXuat, khopLinhVuc: r.khopLinhVuc, laHatGiong: r.laHatGiong,
      trenTrangChu: r.trenTrangChu, viTriTrungBinh: r.viTriTrungBinh,
      subKenh: k ? k.subKenh : 0,
      quocGia: k ? k.quocGia : '',
      anSub: k ? k.anSub : false,
      coSoLieuApi: true
    })
  }

  // Lọc Shorts / không phải tiếng Anh / kênh ngoài Mỹ (nếu bật) — chỉ lọc được
  // những dòng có số liệu API; dòng không có thì giữ, gắn cờ là "chưa kiểm".
  const daLoc = locVideo(coApi, { ...caiDat, viewToiThieu: 0 })
  const daCham = chamDiem(daLoc, { bayGio, caiDat })
  const tatCa = [...daCham, ...khongApi]
  return tatCa.sort((a, b) => b.diemDeXuat - a.diemDeXuat || (b.diem || 0) - (a.diem || 0))
}

module.exports = { chayRadar, videoTuTrang, ghepSoLieuApi }
