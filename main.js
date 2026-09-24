// Tiến trình chính của Tool Ý Tưởng.
//
// Quy ước: mọi thứ tiếng Việt. Mọi việc chạy lâu đều phát sự kiện 'tien-do' về
// giao diện (phần trăm + việc đang làm + số lỗi), không có việc nào chạy âm thầm.

const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron')
const electron = require('electron')
const path = require('path')
const fs = require('fs')

const nhatKy = require('./src/nhat-ky')
const { taoKho } = require('./src/store')
const { taoBoDem, uocChiPhi } = require('./src/quota')
const { ghepTuKhoa } = require('./src/tu-khoa')
const { layGoiY, layJSON, layNhiPhan } = require('./src/goi-mang')
const { timYTuong } = require('./src/tim-y-tuong')
const { xuatExcel } = require('./src/xuat-excel')
const { taoKhachHang } = require('./src/youtube-api')
const kenhTheoDoi = require('./src/kenh-theo-doi')
const ytDlp = require('./src/yt-dlp')
const phuDe = require('./src/phu-de')
const kichBan = require('./src/kich-ban')
const kiemDuyet = require('./src/kiem-duyet')
const promptAnh = require('./src/prompt-anh')
const { taoKhoDuAn } = require('./src/du-an')
const trinhDuyet = require('./src/trinh-duyet')
const docTep = require('./src/doc-tep')
const thumbnail = require('./src/thumbnail')
const videoDaChon = require('./src/video-da-chon')
const { chayRadar, ghepSoLieuApi } = require('./src/chay-radar')
const radar = require('./src/radar-de-xuat')
const chamDiem = require('./src/cham-diem')
const xuatCanh = require('./src/xuat-canh')
const phanLoaiFt = require('./src/footage-phan-loai')
const nguonFt = require('./src/footage-nguon')
const taiFt = require('./src/footage-tai')
const { taiVeTep } = require('./src/goi-mang')

const LA_SMOKE = !!process.env.YT_SMOKE
let cuaSo = null
let kho = null
let boDem = null
let khoDuAn = null
let quanLyDuyet = null

// ---------------------------------------------------------------------------
// Khởi tạo
// ---------------------------------------------------------------------------

function thuMucDuLieu() {
  if (LA_SMOKE) {
    const t = path.join(app.getPath('temp'), 'tool-y-tuong-smoke')
    fs.mkdirSync(t, { recursive: true })
    return t
  }
  return app.getPath('userData')
}

function taoCuaSo() {
  cuaSo = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#0f1420',
    title: 'Tool Ý Tưởng',
    show: !LA_SMOKE,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  cuaSo.removeMenu && cuaSo.removeMenu()
  cuaSo.loadFile(path.join(__dirname, 'ui', 'index.html'))

  cuaSo.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  quanLyDuyet = trinhDuyet.taoQuanLy({
    electron,
    cuaSo,
    nhatKy,
    baoSuKien: (tt) => guiVeGiaoDien('duyet-thay-doi', tt)
  })

  // Cửa sổ đổi kích thước thì khung trình duyệt phải đổi theo, nếu không nó
  // nằm lệch hẳn ra ngoài và người dùng tưởng tab bị mất.
  cuaSo.on('resize', () => guiVeGiaoDien('cua-so-doi-co', {}))

  if (LA_SMOKE) {
    cuaSo.webContents.once('did-finish-load', () => chaySmoke().catch((loi) => {
      nhatKy.loi('Smoke vỡ:', loi.stack || loi.message)
      app.exit(1)
    }))
  }
}

function guiVeGiaoDien(kenh, duLieu) {
  if (cuaSo && !cuaSo.isDestroyed()) cuaSo.webContents.send(kenh, duLieu)
}

function baoTienDo(duLieu) {
  guiVeGiaoDien('tien-do', duLieu)
}

// ---------------------------------------------------------------------------
// Tự cập nhật
//
// NÓI THẲNG BA GIỚI HẠN THẬT, đừng để người dùng bấm nút rồi ngồi đợi vô ích:
//
// 1. Bản chạy từ mã nguồn không cập nhật được — electron-updater chỉ làm việc
//    với bản đã đóng gói.
// 2. Bản macOS CHƯA KÝ SỐ không tự cài được. Squirrel.Mac bắt buộc app phải có
//    chữ ký hợp lệ mới thay thế được chính nó; app của mình dựng với
//    `identity: null` nên không có. Trên Mac vẫn tải được tệp về, nhưng bước
//    cài phải làm tay.
// 3. Bản Windows PORTABLE không tự cài được, vì nó không có trình cài đặt để
//    chạy. Chỉ bản Setup (NSIS) mới tự thay thế được.
// ---------------------------------------------------------------------------

let boCapNhat = null
let daTaiXongBanMoi = false

function laBanPortable() {
  return process.platform === 'win32' && !!process.env.PORTABLE_EXECUTABLE_DIR
}

function khaNangCapNhat() {
  if (!app.isPackaged) {
    return {
      kiemTraDuoc: false, taiDuoc: false, caiDuoc: false,
      lyDo: 'Đang chạy bản mã nguồn (chưa đóng gói) nên không kiểm tra cập nhật được.'
    }
  }
  if (laBanPortable()) {
    return {
      kiemTraDuoc: true, taiDuoc: true, caiDuoc: false,
      lyDo: 'Bản portable không tự cài được vì không có trình cài đặt. Tool sẽ tải tệp về rồi anh tự thay.'
    }
  }
  if (process.platform === 'darwin') {
    return {
      kiemTraDuoc: true, taiDuoc: true, caiDuoc: false,
      lyDo: 'Bản macOS chưa mua chữ ký số nên không tự cài được — macOS bắt buộc app phải có chữ ký hợp lệ mới thay thế được chính nó. Tải xong anh tự kéo vào Applications.'
    }
  }
  return { kiemTraDuoc: true, taiDuoc: true, caiDuoc: true, lyDo: '' }
}

function layBoCapNhat() {
  if (boCapNhat) return boCapNhat
  const { autoUpdater } = require('electron-updater')
  boCapNhat = autoUpdater

  const caiDat = kho ? kho.docCaiDat() : {}
  autoUpdater.autoDownload = !!caiDat.tuDongTaiBanMoi
  autoUpdater.autoInstallOnAppQuit = !!caiDat.tuDongCaiKhiThoat
  autoUpdater.logger = { info: nhatKy.tin, warn: nhatKy.canhBao, error: nhatKy.loi, debug: () => {} }

  autoUpdater.on('checking-for-update', () => guiVeGiaoDien('cap-nhat', { giaiDoan: 'dang-kiem' }))

  autoUpdater.on('update-available', (tt) => {
    nhatKy.tin(`Có bản mới: ${tt.version}`)
    guiVeGiaoDien('cap-nhat', { giaiDoan: 'co-ban-moi', phienBan: tt.version })
  })

  autoUpdater.on('update-not-available', () =>
    guiVeGiaoDien('cap-nhat', { giaiDoan: 'khong-co', phienBan: app.getVersion() }))

  autoUpdater.on('download-progress', (t) => {
    guiVeGiaoDien('cap-nhat', {
      giaiDoan: 'dang-tai',
      phanTram: Math.round(t.percent || 0),
      daTai: t.transferred,
      tong: t.total,
      tocDo: t.bytesPerSecond
    })
    baoTienDo({
      phanTram: Math.round(t.percent || 0),
      viec: 'Tải bản cập nhật',
      chiTiet: `${(t.transferred / 1048576).toFixed(1)}/${(t.total / 1048576).toFixed(1)} MB · ${(t.bytesPerSecond / 1048576).toFixed(1)} MB/s`,
      khu: 'capnhat'
    })
  })

  autoUpdater.on('update-downloaded', (tt) => {
    daTaiXongBanMoi = true
    nhatKy.tin(`Đã tải xong bản ${tt.version}.`)
    guiVeGiaoDien('cap-nhat', { giaiDoan: 'da-tai-xong', phienBan: tt.version, khaNang: khaNangCapNhat() })
    baoTienDo({ phanTram: 100, viec: 'Tải bản cập nhật xong', chiTiet: `bản ${tt.version}`, trangThai: 'xong', khu: 'capnhat' })
  })

  autoUpdater.on('error', (loi) => {
    nhatKy.loi('Bộ cập nhật lỗi:', loi.message)
    guiVeGiaoDien('cap-nhat', { giaiDoan: 'loi', loi: loi.message })
    baoTienDo({ phanTram: 100, viec: 'Cập nhật lỗi', chiTiet: loi.message, soLoi: 1, trangThai: 'loi', khu: 'capnhat' })
  })

  return autoUpdater
}

// Dựng khách hàng API kèm khoá còn quota. Trả { khach, khoa } hoặc { loi }.
function taoKhachCoKhoa(canBaoNhieu) {
  const caiDat = kho.docCaiDat()
  const khoa = boDem.chonKhoa(caiDat.khoaApi || [], canBaoNhieu)
  if (!khoa) {
    const coKhoa = (caiDat.khoaApi || []).length > 0
    return {
      loi: coKhoa
        ? `Không khoá nào còn đủ ${Number(canBaoNhieu || 0).toLocaleString('vi-VN')} đơn vị quota hôm nay. Quota reset 0h giờ Pacific (khoảng 14-15h giờ Việt Nam).`
        : 'Chưa có khoá API. Vào Cài đặt → thêm khoá (miễn phí, không cần thẻ — xem Hướng dẫn).'
    }
  }
  return {
    khoa,
    caiDat,
    khach: taoKhachHang({
      layJSONHam: layJSON,
      boDem,
      idKhoa: khoa.id,
      khoa: khoa.khoa,
      nhatKy
    })
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function dangKyIPC() {
  // --- Cài đặt ---------------------------------------------------------------
  ipcMain.handle('caidat:doc', () => {
    const caiDat = kho.docCaiDat()
    return {
      caiDat,
      phienBan: app.getVersion(),
      duongDanNhatKy: nhatKy.duongDan(),
      thuMucDuLieu: kho.thuMuc,
      coYtDlp: ytDlp.daCo(kho.thuMuc),
      quota: (caiDat.khoaApi || []).map((k) => ({
        id: k.id,
        ten: k.ten,
        daDung: boDem.daDung(k.id),
        conLai: boDem.conLai(k.id)
      })),
      ngayQuota: boDem.ngayHomNay()
    }
  })

  ipcMain.handle('caidat:ghi', (_su, caiDat) => {
    kho.ghiCaiDat(caiDat)
    nhatKy.tin('Đã lưu cài đặt.')
    return { ok: true }
  })

  // --- Màn Ý tưởng -----------------------------------------------------------
  ipcMain.handle('tukhoa:ghep', async (_su, { chuNhap, soLuong }) => {
    nhatKy.tin(`Ghép từ khóa từ: ${chuNhap}`)
    const cache = kho.docCache()
    const kq = await ghepTuKhoa(chuNhap, {
      // Gợi ý theo người xem MỸ (gl=us), không theo vị trí thật của máy.
      layGoiYHam: (cum) => layGoiY(cum, {
        hl: 'en',
        gl: String(kho.docCaiDat().regionCode || 'US').toLowerCase()
      }),
      soLuong: soLuong || 5,
      lichSu: cache.muc || {},
      baoTienDo: (t) => baoTienDo({ ...t, khu: 'tukhoa' })
    })
    nhatKy.tin(`Chọn ${kq.chon.length} từ khóa. Gọi được gợi ý: ${kq.coMang ? 'có' : 'KHÔNG'}`)
    return kq
  })

  ipcMain.handle('quota:uoc', (_su, thamSo) => uocChiPhi(thamSo))

  // ghiDe: màn Đề xuất dùng lại đúng hàm này để tìm video "đang lên 72 giờ"
  // (soNgay = 3) mà không đụng tới cài đặt của màn Ý tưởng.
  ipcMain.handle('ytuong:tim', async (_su, { tuKhoa, ghiDe }) => {
    const caiDat = { ...kho.docCaiDat(), ...(ghiDe || {}) }
    const can = uocChiPhi({
      soTuKhoa: tuKhoa.length,
      soVideoMoiTuKhoa: caiDat.soVideoMoiTuKhoa,
      tinhVuotTrungViKenh: caiDat.tinhVuotTrungViKenh
    })
    const { khach, khoa, loi } = taoKhachCoKhoa(can)
    if (loi) return { ok: false, loi }

    nhatKy.tin(`Bắt đầu tìm: ${tuKhoa.join(' | ')} — ước ${can} đơn vị, khoá "${khoa.ten}"`)
    try {
      const kq = await timYTuong({
        tuKhoa, caiDat, khoa, boDem, layJSONHam: layJSON, nhatKy,
        baoTienDo: (t) => baoTienDo({ ...t, khu: ghiDe ? 'dexuat' : 'ytuong' })
      })
      const cache = kho.docCache()
      cache.muc = cache.muc || {}
      for (const tk of tuKhoa) cache.muc[tk.toLowerCase()] = Date.now()
      kho.ghiCache(cache)

      nhatKy.tin(`Xong: ${kq.dong.length} video, ${kq.soNoView} nổ view, dùng ${kq.quotaDaDung} đơn vị.`)
      return { ok: true, ...kq, conLai: boDem.conLai(khoa.id), tenKhoa: khoa.ten }
    } catch (e) {
      nhatKy.loi(`Tìm thất bại: ${e.message}`)
      return { ok: false, loi: e.message, laLoiQuota: !!e.laLoiQuota }
    }
  })

  ipcMain.handle('xuat:excel', async (_su, { dong, tuKhoa }) => {
    const caiDat = kho.docCaiDat()
    const ten = `y-tuong-${new Date().toISOString().slice(0, 10)}.xlsx`
    const { canceled, filePath } = await dialog.showSaveDialog(cuaSo, {
      title: 'Lưu bảng ý tưởng',
      defaultPath: path.join(app.getPath('downloads'), ten),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (canceled || !filePath) return { ok: false, huy: true }
    await xuatExcel(filePath, dong, { tuKhoa, caiDat })
    nhatKy.tin(`Đã xuất Excel: ${filePath}`)
    return { ok: true, duongDan: filePath }
  })

  // --- Màn Kênh theo dõi -----------------------------------------------------
  ipcMain.handle('kenh:them', async (_su, { dinhDanh }) => {
    const { khach, loi } = taoKhachCoKhoa(2)
    if (loi) return { ok: false, loi }
    try {
      const kenh = await khach.kenhTheoDinhDanh(dinhDanh)
      if (!kenh) return { ok: false, loi: `Không tìm được kênh từ "${dinhDanh}". Dán link kênh hoặc @handle.` }

      const caiDat = kho.docCaiDat()
      const ds = caiDat.kenhTheoDoi || []
      if (ds.some((k) => k.kenhId === kenh.kenhId)) {
        return { ok: false, loi: `Kênh "${kenh.tenKenh}" đã có trong danh sách.` }
      }
      ds.push({ kenhId: kenh.kenhId, ten: kenh.tenKenh, dinhDanh, subKenh: kenh.subKenh, themLuc: Date.now() })
      kho.ghiCaiDat({ ...caiDat, kenhTheoDoi: ds })
      nhatKy.tin(`Thêm kênh theo dõi: ${kenh.tenKenh} (${kenh.kenhId})`)
      return { ok: true, kenh }
    } catch (e) {
      return { ok: false, loi: e.message }
    }
  })

  ipcMain.handle('kenh:xoa', (_su, { kenhId }) => {
    const caiDat = kho.docCaiDat()
    kho.ghiCaiDat({ ...caiDat, kenhTheoDoi: (caiDat.kenhTheoDoi || []).filter((k) => k.kenhId !== kenhId) })
    return { ok: true }
  })

  ipcMain.handle('kenh:quet', async () => {
    const caiDat = kho.docCaiDat()
    const ds = caiDat.kenhTheoDoi || []
    if (!ds.length) return { ok: false, loi: 'Chưa theo dõi kênh nào. Dán link kênh vào ô bên trên.' }

    // 3 đơn vị mỗi kênh: channels.list + playlistItems.list + videos.list
    const { khach, loi } = taoKhachCoKhoa(ds.length * 3)
    if (loi) return { ok: false, loi }

    try {
      const kq = await kenhTheoDoi.quetDanhSach({
        khach,
        danhSach: ds,
        thuMucDuLieu: kho.thuMuc,
        caiDat,
        nhatKy,
        baoTienDo: (t) => baoTienDo({ ...t, khu: 'kenh' })
      })
      return {
        ok: true,
        ...kq,
        bangGop: kenhTheoDoi.gopNoView(kq.ketQua, { chiNoView: false })
      }
    } catch (e) {
      return { ok: false, loi: e.message, laLoiQuota: !!e.laLoiQuota }
    }
  })

  ipcMain.handle('kenh:thinh-hanh', async () => {
    const caiDat = kho.docCaiDat()
    const { khach, loi } = taoKhachCoKhoa(1)
    if (loi) return { ok: false, loi }
    try {
      baoTienDo({ phanTram: 40, viec: 'Lấy bảng thịnh hành', khu: 'kenh' })
      let dong = await khach.videoThinhHanh({ regionCode: caiDat.regionCode || 'US', soLuong: 50 })
      if (caiDat.boShorts !== false) dong = dong.filter((d) => !(d.thoiLuongGiay > 0 && d.thoiLuongGiay < 61))
      baoTienDo({ phanTram: 100, viec: 'Xong', chiTiet: `${dong.length} video`, trangThai: 'xong', khu: 'kenh' })
      return { ok: true, dong }
    } catch (e) {
      return { ok: false, loi: e.message, laLoiQuota: !!e.laLoiQuota }
    }
  })


  // --- Video đã chọn (dùng chung cho mọi màn) -----------------------------
  ipcMain.handle('chon:doc', () => videoDaChon.doc(kho.thuMuc))
  ipcMain.handle('chon:ghi', (_su, { ds }) => videoDaChon.ghi(kho.thuMuc, ds))

  // --- Tải thumbnail ---------------------------------------------------------
  // duAnMa có thì lưu vào <dự án>/anh-tham-chieu (màn Prompt ảnh), không thì
  // hỏi thư mục. Ảnh ở i.ytimg.com: KHÔNG tốn quota API.
  ipcMain.handle('thumb:tai', async (_su, { videos, duAnMa }) => {
    const ds = (videos || []).filter(videoDaChon.hopLe)
    if (!ds.length) return { ok: false, loi: 'Chưa có video nào để tải thumbnail.' }

    let thuMuc
    if (duAnMa) {
      thuMuc = path.join(khoDuAn.duongDan(duAnMa), 'anh-tham-chieu')
    } else {
      const { canceled, filePaths } = await dialog.showOpenDialog(cuaSo, {
        title: `Chọn thư mục lưu ${ds.length} thumbnail`,
        defaultPath: app.getPath('downloads'),
        properties: ['openDirectory', 'createDirectory']
      })
      if (canceled || !filePaths.length) return { ok: false, huy: true }
      thuMuc = filePaths[0]
    }

    const kq = await thumbnail.taiNhieuThumbnail(ds, thuMuc, {
      layNhiPhanHam: layNhiPhan,
      baoTienDo: (t) => baoTienDo({ ...t, khu: 'thumbnail' })
    })
    baoTienDo({
      phanTram: 100, viec: 'Tải thumbnail xong',
      chiTiet: `${kq.ketQua.length}/${ds.length} ảnh · ${thuMuc}`,
      soLoi: kq.loi.length, trangThai: kq.loi.length ? 'loi' : 'xong', khu: 'thumbnail'
    })
    nhatKy.tin(`Tải thumbnail: ${kq.ketQua.length}/${ds.length} ảnh vào ${thuMuc}`)
    for (const l of kq.loi) nhatKy.loi(`Thumbnail ${l.videoId}: ${l.loi}`)
    return { ok: kq.ketQua.length > 0, thuMuc, soTai: kq.ketQua.length, loi: kq.loi }
  })

  // --- Đề xuất video: Radar (đọc giao diện YouTube bằng cửa sổ ẩn) ----------
  let dangChayRadar = false
  ipcMain.handle('dexuat:radar', async (_su, thamSo = {}) => {
    if (dangChayRadar) return { ok: false, loi: 'Radar đang chạy rồi — chờ lượt này xong đã.' }
    const caiDat = kho.docCaiDat()
    const {
      tuKhoa = '', taiKhoanId = '', dungVideoDaChon = false,
      soHatGiong = caiDat.soVideoHatGiong || 8,
      docTrangChu = caiDat.radarDocTrangChu !== false,
      thoiGian = caiDat.radarThoiGian || 'thang'
    } = thamSo

    const hatGiongCo = dungVideoDaChon ? videoDaChon.doc(kho.thuMuc).map((v) => v.videoId) : []
    if (!String(tuKhoa).trim() && !hatGiongCo.length && !docTrangChu) {
      return { ok: false, loi: 'Nhập từ khóa lĩnh vực, hoặc bật "dùng video đã chọn làm hạt giống".' }
    }

    dangChayRadar = true
    const trinhDoc = quanLyDuyet.taoTrinhDoc(taiKhoanId)
    nhatKy.tin(`Radar bắt đầu: "${tuKhoa}" · tài khoản ${taiKhoanId || 'khách'} · ${soHatGiong} hạt giống`)
    try {
      const kq = await chayRadar({
        tuKhoaLinhVuc: tuKhoa,
        docTrang: (url, tuyChon) => trinhDoc.doc(url, tuyChon),
        soHatGiong: Math.max(2, Math.min(20, Number(soHatGiong) || 8)),
        hatGiongCo,
        timTrenYouTube: !!String(tuKhoa).trim(),
        docTrangChu,
        thoiGian,
        nhatKy,
        baoTienDo: (t) => baoTienDo({ ...t, khu: 'dexuat' })
      })

      // Ghép số liệu API cho 150 video đứng đầu: 2 đơn vị mỗi 50 video
      // (videos.list + channels.list). Không có khoá thì vẫn trả bảng radar.
      let dong = kq.dong
      let ghiChuApi = ''
      const top = dong.slice(0, 150)
      const can = Math.ceil(top.length / 50) * 2
      const { khach, loi } = top.length ? taoKhachCoKhoa(can) : { loi: 'không có video' }
      if (khach) {
        baoTienDo({ phanTram: 96, viec: 'Lấy số liệu video (API)', chiTiet: `${top.length} video · ~${can} đơn vị`, khu: 'dexuat' })
        try {
          const api = await khach.soLieuVideo(top.map((d) => d.videoId))
          const bangKenh = await khach.soLieuKenh(api.map((d) => d.kenhId))
          dong = [...ghepSoLieuApi(top, api, bangKenh, caiDat), ...dong.slice(150)]
          ghiChuApi = `Đã ghép số liệu API (${khach.daDungPhien()} đơn vị quota).`
        } catch (e) {
          ghiChuApi = `Không ghép được số liệu API: ${e.message}`
          nhatKy.canhBao('Radar: ' + ghiChuApi)
        }
      } else {
        ghiChuApi = `Chưa ghép số liệu API (${loi}) — view là số ƯỚC đọc từ trang YouTube, chưa có sub và view/giờ.`
      }

      baoTienDo({
        phanTram: 100, viec: 'Radar xong',
        chiTiet: `${dong.length} video · ${dong.filter((d) => d.nhanDeXuat === 'ĐẨY MẠNH').length} đẩy mạnh`,
        soLoi: kq.canhBao.length, trangThai: 'xong', khu: 'dexuat'
      })
      nhatKy.tin(`Radar xong: ${dong.length} video từ ${kq.cacLanDoc.length} nguồn. ${ghiChuApi}`)
      return { ok: true, ...kq, dong, ghiChuApi, soNguon: kq.cacLanDoc.length }
    } catch (e) {
      nhatKy.loi('Radar lỗi: ' + e.message)
      baoTienDo({ phanTram: 100, viec: 'Radar lỗi', chiTiet: e.message, soLoi: 1, trangThai: 'loi', khu: 'dexuat' })
      return { ok: false, loi: e.message }
    } finally {
      trinhDoc.dong()
      dangChayRadar = false
    }
  })

  // --- Đề xuất video: bảng Thịnh hành theo danh mục (API) -------------------
  ipcMain.handle('dexuat:hot', async (_su, { danhMuc = '', soLuong = 100, tuKhoaLoc = '' } = {}) => {
    const caiDat = kho.docCaiDat()
    const soTrang = Math.ceil(Math.min(200, Math.max(50, soLuong)) / 50)
    // soTrang cho videos.list + tối đa soTrang cho channels.list
    const { khach, loi } = taoKhachCoKhoa(soTrang * 2)
    if (loi) return { ok: false, loi }
    try {
      baoTienDo({ phanTram: 20, viec: 'Lấy bảng Thịnh hành Mỹ', chiTiet: danhMuc ? `danh mục ${danhMuc}` : 'tất cả', khu: 'dexuat' })
      let dong = await khach.videoThinhHanh({ regionCode: caiDat.regionCode || 'US', soLuong, danhMuc })
      baoTienDo({ phanTram: 60, viec: 'Lấy số liệu kênh', chiTiet: `${dong.length} video`, khu: 'dexuat' })
      const bangKenh = await khach.soLieuKenh(dong.map((d) => d.kenhId))
      for (const d of dong) {
        const k = bangKenh.get(d.kenhId)
        d.subKenh = k ? k.subKenh : 0
        d.quocGia = k ? k.quocGia : ''
        d.anSub = k ? k.anSub : false
      }
      const truoc = dong.length
      dong = chamDiem.locVideo(dong, { ...caiDat, viewToiThieu: 0 })
      const tuLinhVuc = radar.tachTuLinhVuc(tuKhoaLoc)
      for (const d of dong) d.khopLinhVuc = radar.khopLinhVuc(d.tieuDe, tuLinhVuc)
      dong = chamDiem.chamDiem(dong, { caiDat })
      baoTienDo({
        phanTram: 100, viec: 'Bảng Thịnh hành xong',
        chiTiet: `${dong.length}/${truoc} video sau lọc · ${khach.daDungPhien()} đơn vị`, trangThai: 'xong', khu: 'dexuat'
      })
      return { ok: true, dong, truocLoc: truoc, quotaDaDung: khach.daDungPhien() }
    } catch (e) {
      baoTienDo({ phanTram: 100, viec: 'Bảng Thịnh hành lỗi', chiTiet: e.message, soLoi: 1, trangThai: 'loi', khu: 'dexuat' })
      return { ok: false, loi: e.message, laLoiQuota: !!e.laLoiQuota }
    }
  })

  // --- yt-dlp ----------------------------------------------------------------
  ipcMain.handle('ytdlp:trang-thai', () => ({
    daCo: ytDlp.daCo(kho.thuMuc),
    duongDan: ytDlp.duongDanBinary(kho.thuMuc),
    url: ytDlp.urlTaiVe()
  }))

  ipcMain.handle('ytdlp:tai', async () => {
    try {
      const dd = await ytDlp.taiBinary(kho.thuMuc, {
        baoTienDo: (t) => baoTienDo({ ...t, khu: 'loithoai' })
      })
      nhatKy.tin(`Đã tải yt-dlp: ${dd}`)
      return { ok: true, duongDan: dd }
    } catch (e) {
      nhatKy.loi(`Tải yt-dlp lỗi: ${e.message}`)
      return { ok: false, loi: e.message }
    }
  })

  // --- Dự án -----------------------------------------------------------------
  ipcMain.handle('duan:danh-sach', () => khoDuAn.danhSach())
  ipcMain.handle('duan:tao', (_su, { ten }) => khoDuAn.tao(ten))
  ipcMain.handle('duan:xoa', (_su, { ma }) => ({ ok: khoDuAn.xoa(ma) }))
  ipcMain.handle('duan:doc', (_su, { ma }) => ({
    hoSo: khoDuAn.doc(ma),
    loiThoai: khoDuAn.docLoiThoai(ma),
    danY: khoDuAn.docDanY(ma),
    cacPhan: khoDuAn.docCacPhan(ma),
    banKichBan: khoDuAn.cacBanKichBan(ma),
    kichBan: khoDuAn.docKichBan(ma)
  }))
  ipcMain.handle('duan:mo-thu-muc', (_su, { ma }) => {
    shell.openPath(khoDuAn.duongDan(ma))
    return { ok: true }
  })

  // --- Lời thoại -------------------------------------------------------------
  ipcMain.handle('loithoai:lay', async (_su, { chuNhap, duAnMa, taiKhoanId }) => {
    const caiDat = kho.docCaiDat()
    const ids = ytDlp.tachNhieuVideoId(chuNhap)
    if (!ids.length) return { ok: false, loi: 'Không đọc được link video nào. Dán link YouTube đầy đủ.' }
    if (!ytDlp.daCo(kho.thuMuc)) {
      return { ok: false, loi: 'Chưa có yt-dlp. Bấm nút "Tải yt-dlp" ở ngay trên (khoảng 17MB, chỉ tải một lần).', thieuYtDlp: true }
    }

    const thuMucTam = path.join(kho.thuMuc, 'tam-phu-de')
    fs.rmSync(thuMucTam, { recursive: true, force: true })
    fs.mkdirSync(thuMucTam, { recursive: true })

    // Cookie: chỉ xuất khi người dùng bật, và XOÁ NGAY sau khi xong — tệp này
    // chứa phiên đăng nhập thật.
    let duongDanCookie = null
    if (caiDat.dungCookie && taiKhoanId && quanLyDuyet) {
      try {
        const ck = await quanLyDuyet.layCookie(taiKhoanId)
        duongDanCookie = path.join(thuMucTam, 'cookies.txt')
        fs.writeFileSync(duongDanCookie, ytDlp.dinhDangCookieNetscape(ck), 'utf8')
        nhatKy.tin(`Dùng cookie của tài khoản ${taiKhoanId} (${ck.length} cookie).`)
      } catch (e) {
        nhatKy.canhBao(`Không lấy được cookie: ${e.message}`)
        duongDanCookie = null
      }
    }

    const ketQua = []
    const loiVideo = []

    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]
        baoTienDo({
          phanTram: Math.round((i / ids.length) * 100),
          viec: 'Lấy lời thoại',
          chiTiet: `${i + 1}/${ids.length} · ${id}`,
          daXong: i, tong: ids.length, khu: 'loithoai'
        })
        try {
          const tho = await ytDlp.layPhuDe({
            thuMucDuLieu: kho.thuMuc,
            thuMucTam,
            videoId: id,
            ngonNgu: (caiDat.relevanceLanguage || 'en').slice(0, 2),
            duongDanCookie,
            baoTienDo: (t) => baoTienDo({ ...t, khu: 'loithoai' })
          })
          const sach = phuDe.chuyenThanhVanBan(tho.tho, { dinhDang: tho.dinhDang })
          ketQua.push({
            videoId: id,
            tieuDe: tho.tieuDe,
            tenKenh: tho.tenKenh,
            thoiLuongGiay: tho.thoiLuongGiay,
            dinhDang: tho.dinhDang,
            ...sach
          })
          nhatKy.tin(`Lời thoại ${id}: ${sach.soTu} từ, bỏ ${sach.tyLeBoLap}% cue lặp cuộn (${tho.dinhDang})`)
        } catch (e) {
          loiVideo.push({ videoId: id, loi: e.message })
          nhatKy.loi(`Lời thoại ${id} lỗi: ${e.message}`)
        }
      }
    } finally {
      if (duongDanCookie) { try { fs.unlinkSync(duongDanCookie) } catch (_) {} }
    }

    baoTienDo({
      phanTram: 100, viec: 'Lấy lời thoại xong',
      chiTiet: `${ketQua.length}/${ids.length} video`,
      soLoi: loiVideo.length,
      trangThai: loiVideo.length ? 'loi' : 'xong', khu: 'loithoai'
    })

    // Gộp nhiều nguồn vào một dự án: kịch bản 11.000 từ cần nhiều tư liệu hơn
    // một video, và trộn nhiều nguồn cũng xa "reused content" hơn hẳn.
    if (duAnMa && ketQua.length) {
      const gop = ketQua.map((k) =>
        `## ${k.tieuDe || k.videoId} — ${k.tenKenh || ''}\n` +
        `(nguồn: https://www.youtube.com/watch?v=${k.videoId} · ${k.soTu} từ)\n\n${k.vanBan}`
      ).join('\n\n---\n\n')
      khoDuAn.ghiLoiThoai(duAnMa, gop, {
        nguon: ketQua.map((k) => ({ videoId: k.videoId, tieuDe: k.tieuDe, soTu: k.soTu }))
      })
    }

    return { ok: ketQua.length > 0, ketQua, loiVideo }
  })

  ipcMain.handle('tep:luu', async (_su, { chu, tenGoiY }) => {
    const { canceled, filePath } = await dialog.showSaveDialog(cuaSo, {
      title: 'Lưu thành tệp',
      defaultPath: path.join(app.getPath('downloads'), tenGoiY || 'noi-dung.md'),
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Văn bản', extensions: ['txt'] }
      ]
    })
    if (canceled || !filePath) return { ok: false, huy: true }
    fs.writeFileSync(filePath, String(chu || ''), 'utf8')
    nhatKy.tin(`Đã lưu: ${filePath}`)
    return { ok: true, duongDan: filePath }
  })

  // Lấy lời thoại MỘT video, không cần dự án — chế độ nhanh của màn Lời thoại.
  ipcMain.handle('loithoai:mot-video', async (_su, { link, taiKhoanId }) => {
    const caiDat = kho.docCaiDat()
    const id = ytDlp.tachVideoId(link)
    if (!id) return { ok: false, loi: 'Không đọc được link. Dán link YouTube đầy đủ hoặc mã video 11 ký tự.' }
    if (!ytDlp.daCo(kho.thuMuc)) {
      return { ok: false, loi: 'Chưa có yt-dlp. Bấm nút "Tải yt-dlp" ở khối Công cụ bên dưới (khoảng 17MB, chỉ tải một lần).', thieuYtDlp: true }
    }

    const thuMucTam = path.join(kho.thuMuc, 'tam-phu-de-nhanh')
    fs.rmSync(thuMucTam, { recursive: true, force: true })
    fs.mkdirSync(thuMucTam, { recursive: true })

    let duongDanCookie = null
    if (caiDat.dungCookie && taiKhoanId && quanLyDuyet) {
      try {
        const ck = await quanLyDuyet.layCookie(taiKhoanId)
        duongDanCookie = path.join(thuMucTam, 'cookies.txt')
        fs.writeFileSync(duongDanCookie, ytDlp.dinhDangCookieNetscape(ck), 'utf8')
      } catch (e) {
        nhatKy.canhBao('Không lấy được cookie: ' + e.message)
      }
    }

    try {
      const tho = await ytDlp.layPhuDe({
        thuMucDuLieu: kho.thuMuc,
        thuMucTam,
        videoId: id,
        ngonNgu: (caiDat.relevanceLanguage || 'en').slice(0, 2),
        duongDanCookie,
        baoTienDo: (t) => baoTienDo({ ...t, khu: 'loithoai' })
      })
      const sach = phuDe.chuyenThanhVanBan(tho.tho, { dinhDang: tho.dinhDang })
      baoTienDo({
        phanTram: 100, viec: 'Lấy lời thoại xong',
        chiTiet: `${sach.soTu} từ`, trangThai: 'xong', khu: 'loithoai'
      })
      nhatKy.tin(`Lời thoại nhanh ${id}: ${sach.soTu} từ, bỏ ${sach.tyLeBoLap}% cue lặp cuộn`)
      return {
        ok: true,
        videoId: id,
        tieuDe: tho.tieuDe,
        tenKenh: tho.tenKenh,
        thoiLuongGiay: tho.thoiLuongGiay,
        dinhDang: tho.dinhDang,
        ...sach
      }
    } catch (e) {
      baoTienDo({ phanTram: 100, viec: 'Lấy lời thoại lỗi', chiTiet: e.message, soLoi: 1, trangThai: 'loi', khu: 'loithoai' })
      return { ok: false, loi: e.message }
    } finally {
      if (duongDanCookie) { try { fs.unlinkSync(duongDanCookie) } catch (_) {} }
    }
  })

  // --- Kho skill -------------------------------------------------------------
  ipcMain.handle('skill:them', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(cuaSo, {
      title: 'Chọn tệp SKILL.md',
      properties: ['openFile'],
      filters: [{ name: 'Markdown / văn bản', extensions: ['md', 'txt', 'markdown'] }]
    })
    if (canceled || !filePaths.length) return { ok: false, huy: true }

    const noiDung = fs.readFileSync(filePaths[0], 'utf8')
    const caiDat = kho.docCaiDat()
    const ds = caiDat.khoSkill || []
    ds.push({
      id: 'sk' + Date.now().toString(36),
      ten: path.basename(filePaths[0]),
      noiDung,
      soTu: (noiDung.match(/\S+/g) || []).length,
      themLuc: Date.now()
    })
    kho.ghiCaiDat({ ...caiDat, khoSkill: ds })
    nhatKy.tin(`Thêm skill: ${path.basename(filePaths[0])} (${ds[ds.length - 1].soTu} từ)`)
    return { ok: true, skill: ds[ds.length - 1] }
  })

  ipcMain.handle('skill:xoa', (_su, { id }) => {
    const caiDat = kho.docCaiDat()
    kho.ghiCaiDat({ ...caiDat, khoSkill: (caiDat.khoSkill || []).filter((s) => s.id !== id) })
    return { ok: true }
  })

  // --- Kịch bản --------------------------------------------------------------
  ipcMain.handle('kichban:prompt-dan-y', (_su, { duAnMa, skillId, yeuCau }) => {
    const caiDat = kho.docCaiDat()
    const skill = (caiDat.khoSkill || []).find((s) => s.id === skillId)
    return {
      ok: true,
      prompt: kichBan.taoPromptDanY({
        skill: skill ? skill.noiDung : '',
        loiThoai: duAnMa ? khoDuAn.docLoiThoai(duAnMa) : '',
        yeuCau: { soTuMucTieu: caiDat.soTuMucTieu, soPhan: caiDat.soPhanKichBan, ...yeuCau }
      })
    }
  })

  ipcMain.handle('kichban:luu-dan-y', (_su, { duAnMa, chu }) => {
    const phan = kichBan.phanTichDanY(chu)
    if (duAnMa) khoDuAn.ghiDanY(duAnMa, chu, phan)
    return { ok: true, phan, soPhan: phan.length }
  })

  ipcMain.handle('kichban:prompt-phan', (_su, { duAnMa, phanSo, skillId, yeuCau }) => {
    const caiDat = kho.docCaiDat()
    const skill = (caiDat.khoSkill || []).find((s) => s.id === skillId)
    const danY = duAnMa ? (khoDuAn.docDanY(duAnMa).phan || []) : []
    const cacPhan = duAnMa ? khoDuAn.docCacPhan(duAnMa) : []
    return {
      ok: true,
      prompt: kichBan.taoPromptPhan({
        skill: skill ? skill.noiDung : '',
        danY,
        phanSo,
        cacPhanDaViet: cacPhan.slice(0, phanSo - 1),
        loiThoai: duAnMa ? khoDuAn.docLoiThoai(duAnMa) : '',
        yeuCau: { soTuMucTieu: caiDat.soTuMucTieu, soPhan: caiDat.soPhanKichBan, ...yeuCau }
      })
    }
  })

  ipcMain.handle('kichban:luu-phan', (_su, { duAnMa, phanSo, chu }) => {
    const cacPhan = khoDuAn.docCacPhan(duAnMa)
    cacPhan[phanSo - 1] = chu
    khoDuAn.ghiCacPhan(duAnMa, cacPhan)
    const caiDat = kho.docCaiDat()
    return {
      ok: true,
      cacPhan,
      thongKe: kichBan.phanTichKichBan(chu, {
        tuMoiPhut: caiDat.tuMoiPhut, tuMoiCanh: caiDat.tuMoiCanh
      })
    }
  })

  ipcMain.handle('kichban:gop', (_su, { duAnMa }) => {
    const cacPhan = khoDuAn.docCacPhan(duAnMa)
    const gop = kichBan.gopKichBan(cacPhan)
    if (!gop.trim()) return { ok: false, loi: 'Chưa có phần nào được dán về.' }
    const luu = khoDuAn.ghiKichBan(duAnMa, gop)
    const caiDat = kho.docCaiDat()
    nhatKy.tin(`Gộp kịch bản dự án ${duAnMa}: ${luu.ten}`)
    return {
      ok: true, ...luu, chu: gop,
      thongKe: kichBan.phanTichKichBan(gop, {
        tuMoiPhut: caiDat.tuMoiPhut,
        tuMoiCanh: caiDat.tuMoiCanh,
        soTuMucTieu: caiDat.soTuMucTieu
      })
    }
  })

  ipcMain.handle('kichban:luu-truc-tiep', (_su, { duAnMa, chu }) => {
    if (!chu || !chu.trim()) return { ok: false, loi: 'Chưa có nội dung.' }
    const luu = khoDuAn.ghiKichBan(duAnMa, chu)
    return { ok: true, ...luu }
  })

  // --- Kiểm duyệt ------------------------------------------------------------
  ipcMain.handle('kiemduyet:chay', (_su, { chu, banGoc, duAnMa }) => {
    const caiDat = kho.docCaiDat()
    const vanBan = chu && chu.trim() ? chu : (duAnMa ? khoDuAn.docKichBan(duAnMa) : '')
    if (!vanBan.trim()) return { ok: false, loi: 'Chưa có kịch bản để kiểm. Dán vào ô, hoặc mở tệp, hoặc chọn dự án đã có kịch bản.' }

    const goc = banGoc != null && banGoc !== ''
      ? banGoc
      : (duAnMa ? khoDuAn.docLoiThoai(duAnMa) : '')

    let boLuat = null
    try {
      boLuat = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'bo-luat-chinh-sach.json'), 'utf8'))
    } catch (e) {
      nhatKy.loi('Không đọc được bộ luật chính sách: ' + e.message)
    }

    baoTienDo({ phanTram: 50, viec: 'Kiểm duyệt kịch bản', khu: 'kiemduyet' })
    const bc = kiemDuyet.baoCao(vanBan, { banGoc: goc, boLuat, tuMoiPhut: caiDat.tuMoiPhut })
    baoTienDo({
      phanTram: 100, viec: 'Kiểm duyệt xong',
      chiTiet: `${bc.tongQuan.soTu} từ · lặp ${bc.lap.tyLeLap}%` +
        (bc.giongBanGoc ? ` · giống gốc ${bc.giongBanGoc.tyLe}%` : ''),
      trangThai: 'xong', khu: 'kiemduyet'
    })
    nhatKy.tin(`Kiểm duyệt: ${bc.tongQuan.soTu} từ, lặp ${bc.lap.tyLeLap}%, chính sách ${bc.chinhSach ? bc.chinhSach.ketLuan : '—'}`)
    return { ok: true, baoCao: bc, coBanGoc: !!goc.trim() }
  })

  // Một cửa mở tệp DÙNG CHUNG cho Lời thoại, Kiểm duyệt và Prompt ảnh — cả ba
  // màn đều nhận Word, văn bản thuần và phụ đề, không màn nào đọc được ít hơn
  // màn nào.
  ipcMain.handle('tep:doc', async (_su, { tieuDe } = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(cuaSo, {
      title: tieuDe || 'Mở tệp từ máy',
      properties: ['openFile'],
      filters: docTep.BO_LOC_HOP_THOAI
    })
    if (canceled || !filePaths.length) return { ok: false, huy: true }

    try {
      const kq = await docTep.docTep(filePaths[0])
      nhatKy.tin(`Đọc tệp ${kq.ten}: ${kq.soTu} từ (${kq.ghiChu})`)
      return { ok: true, ...kq }
    } catch (e) {
      nhatKy.loi(`Đọc tệp lỗi: ${e.message}`)
      return { ok: false, loi: e.message }
    }
  })

  ipcMain.handle('kiemduyet:xuat-bao-cao', async (_su, { html }) => {
    const { canceled, filePath } = await dialog.showSaveDialog(cuaSo, {
      title: 'Lưu báo cáo kiểm duyệt',
      defaultPath: path.join(app.getPath('downloads'), `bao-cao-kiem-duyet-${new Date().toISOString().slice(0, 10)}.html`),
      filters: [{ name: 'HTML', extensions: ['html'] }]
    })
    if (canceled || !filePath) return { ok: false, huy: true }
    fs.writeFileSync(filePath, html, 'utf8')
    return { ok: true, duongDan: filePath }
  })

  // --- Prompt ảnh ------------------------------------------------------------
  ipcMain.handle('promptanh:cat-canh', (_su, { chu, duAnMa, gopCanh }) => {
    const caiDat = kho.docCaiDat()
    const vanBan = chu && chu.trim() ? chu : (duAnMa ? khoDuAn.docKichBan(duAnMa) : '')
    if (!vanBan.trim()) return { ok: false, loi: 'Chưa có kịch bản. Chọn dự án đã có kịch bản, hoặc dán vào ô.' }

    const canh = promptAnh.catCanh(vanBan, {
      tuMoiCanh: caiDat.tuMoiCanh || 27,
      gopCanh: gopCanh || caiDat.gopCanh || 1
    })
    return { ok: true, canh, thongKe: promptAnh.thongKeCanh(canh) }
  })

  // boSo: số cảnh đã có footage — không xin Claude mô tả nữa (đỡ lượt dán).
  // Số trong ngoặc vuông vẫn là SỐ GỐC nên câu trả lời ghép đúng chỗ.
  ipcMain.handle('promptanh:prompt-mo-ta', (_su, { canh, loThu, moiLo, kieu, boSo }) => {
    const caiDat = kho.docCaiDat()
    const bo = new Set(boSo || [])
    const lo = promptAnh.chiaLo((canh || []).filter((c) => !bo.has(c.so)), moiLo || 50)
    const i = Math.min(Math.max(1, loThu || 1), lo.length) - 1
    const tuyChon = {
      style: (caiDat.oPrompt && caiDat.oPrompt.style) || promptAnh.MAC_DINH_O.style,
      khoNhanVat: caiDat.khoNhanVat || [],
      loThu: i + 1,
      tongLo: lo.length
    }
    const ham = kieu === 'thuong' ? promptAnh.taoPromptMoTaCanhThuong : promptAnh.taoPromptMoTaCanh
    return {
      ok: true,
      kieu: kieu === 'thuong' ? 'thuong' : 'json',
      tongLo: lo.length,
      loThu: i + 1,
      soCanhTrongLo: lo[i] ? lo[i].length : 0,
      prompt: lo[i] ? ham(lo[i], tuyChon) : ''
    }
  })

  // Tự nhận dạng JSON hay prompt thường — người dùng khỏi phải nhớ đã xin kiểu nào.
  ipcMain.handle('promptanh:doc-mo-ta', (_su, { chu }) => promptAnh.phanTichTraVe(chu))

  ipcMain.handle('promptanh:tao', (_su, { canh, moTaTheoCanh, promptThang }) => {
    const caiDat = kho.docCaiDat()
    const cacPrompt = promptAnh.taoTatCaPromptHonHop(canh, {
      template: caiDat.templatePrompt || promptAnh.TEMPLATE_MAC_DINH,
      o: caiDat.oPrompt || {},
      khoNhanVat: caiDat.khoNhanVat || [],
      khoBoiCanh: caiDat.khoBoiCanh || [],
      moTaTheoCanh: moTaTheoCanh || {},
      promptThang: promptThang || {}
    })
    return {
      ok: true,
      cacPrompt,
      kiemTra: promptAnh.kiemTraLienTuc(cacPrompt),
      soNguyenVan: cacPrompt.filter((p) => p.dungNguyenVan).length
    }
  })

  ipcMain.handle('promptanh:xuat', async (_su, { canh, cacPrompt, duAnMa, keHoachFootage }) => {
    // Có kế hoạch footage KHỚP bộ cảnh này và đã có tệp footage → ghi thêm chuỗi
    // số cho Flow. Không khớp thì thôi: chuỗi số lệch còn tệ hơn không có.
    let chuoiSoFlow = ''
    if (keHoachFootage && phanLoaiFt.kiemKhopKeHoach(canh, keHoachFootage).khop &&
        xuatCanh.soCoFootage(keHoachFootage).size) {
      chuoiSoFlow = xuatCanh.nenChuoiSo(xuatCanh.canhConLai(canh, keHoachFootage).map((c) => c.so))
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(cuaSo, {
      title: 'Chọn thư mục để xuất prompt',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: app.getPath('downloads')
    })
    if (canceled || !filePaths.length) return { ok: false, huy: true }

    const thuMuc = filePaths[0]
    const caiDat = kho.docCaiDat()
    const daGhi = []

    const ghi = (ten, noiDung) => {
      const dd = path.join(thuMuc, ten)
      fs.writeFileSync(dd, noiDung, 'utf8')
      daGhi.push(dd)
    }

    // prompts.txt LUÔN ĐỦ mọi cảnh, kể cả cảnh footage — Flow tra prompts[index-1]
    // theo số gốc. Cảnh footage bị bỏ qua nhờ chuỗi số, không phải nhờ xoá dòng.
    ghi('prompts.txt', promptAnh.xuatPromptsTxt(cacPrompt))
    if (chuoiSoFlow) ghi('chuoi-so-flow.txt', chuoiSoFlow + '\n')
    ghi('ten-anh.txt', promptAnh.xuatTenAnh(cacPrompt))
    ghi('scenes.json', promptAnh.xuatScenesJson(canh, cacPrompt, {
      duAn: duAnMa || '', tuMoiCanh: caiDat.tuMoiCanh
    }))

    // Bảng Excel để rà bằng mắt và sửa tay.
    const duongDanXlsx = path.join(thuMuc, 'prompts.xlsx')
    await xuatExcelPrompt(duongDanXlsx, canh, cacPrompt)
    daGhi.push(duongDanXlsx)

    nhatKy.tin(`Xuất ${cacPrompt.length} prompt ra ${thuMuc}` + (chuoiSoFlow ? ` · chuỗi số Flow ${chuoiSoFlow}` : ''))
    return { ok: true, thuMuc, daGhi, soPrompt: cacPrompt.length, chuoiSoFlow }
  })

  // --- Footage thật ----------------------------------------------------------
  // Một video = một "thư mục dựng" (cũng là thư mục INPUT của CapCut Draft
  // Studio). Kế hoạch footage lưu ngay trong thư mục đó, sau MỖI cảnh.
  let dangChayFootage = false
  let huyFootage = false
  const duongDanCacheFt = () => path.join(kho.thuMuc, 'cache-footage.json')
  let cacheFt = null
  const layCacheFt = () => {
    if (cacheFt) return cacheFt
    let duLieu = {}
    try { duLieu = JSON.parse(fs.readFileSync(duongDanCacheFt(), 'utf8')) } catch (_) {}
    cacheFt = nguonFt.taoCache(duLieu)
    return cacheFt
  }
  const luuCacheFt = () => {
    try { fs.writeFileSync(duongDanCacheFt(), JSON.stringify(layCacheFt().xuat())) } catch (e) { nhatKy.canhBao('Không ghi được cache footage: ' + e.message) }
  }

  function trangThaiNguon(caiDat) {
    return {
      pexels: !!(caiDat.footageDungPexels && String(caiDat.khoaPexels || '').trim()),
      pixabay: !!(caiDat.footageDungPixabay && String(caiDat.khoaPixabay || '').trim()),
      wikimedia: caiDat.footageDungWikimedia !== false,
      loc: caiDat.footageDungLoc !== false
    }
  }

  ipcMain.handle('footage:nguon', () => {
    const caiDat = kho.docCaiDat()
    return {
      bat: trangThaiNguon(caiDat),
      coKhoaPexels: !!String(caiDat.khoaPexels || '').trim(),
      coKhoaPixabay: !!String(caiDat.khoaPixabay || '').trim()
    }
  })

  ipcMain.handle('footage:thu-muc', async (_su, { duAnMa, chonMoi } = {}) => {
    let thuMuc = null
    if (!chonMoi && duAnMa) thuMuc = path.join(khoDuAn.duongDan(duAnMa), 'san-xuat')
    if (!thuMuc) {
      const { canceled, filePaths } = await dialog.showOpenDialog(cuaSo, {
        title: 'Chọn THƯ MỤC DỰNG cho video này (cũng là thư mục INPUT của CapCut Draft Studio)',
        defaultPath: app.getPath('downloads'),
        properties: ['openDirectory', 'createDirectory']
      })
      if (canceled || !filePaths.length) return { ok: false, huy: true }
      thuMuc = filePaths[0]
    }
    fs.mkdirSync(thuMuc, { recursive: true })
    try {
      return { ok: true, thuMuc, keHoach: taiFt.docKeHoach(thuMuc) }
    } catch (e) {
      return { ok: true, thuMuc, keHoach: null, loiKeHoach: e.message }
    }
  })

  ipcMain.handle('footage:xuat-canh', async (_su, { thuMuc, canh }) => {
    if (!thuMuc) return { ok: false, loi: 'Chưa chọn thư mục dựng.' }
    if (!(canh || []).length) return { ok: false, loi: 'Chưa có cảnh nào. Cắt cảnh trước đã.' }
    const dd = path.join(thuMuc, 'canh.xlsx')
    try {
      await xuatCanh.xuatExcelCanh(dd, canh)
    } catch (e) {
      // Hay gặp nhất: tệp đang mở trong Excel (Windows khoá tệp).
      return { ok: false, loi: `Không ghi được ${dd}: ${e.message}. Tệp đang mở trong Excel thì đóng lại rồi bấm lại.` }
    }
    nhatKy.tin(`Xuất ${canh.length} cảnh ra ${dd}`)
    return { ok: true, duongDan: dd }
  })

  ipcMain.handle('footage:lap-ke-hoach', (_su, { canh, thuMuc }) => {
    // Kế hoạch mới thay kế hoạch cũ: tệp footage của kế hoạch cũ mang số cảnh
    // CŨ — để nguyên trong Videos/ Images/ là CapCut ghép nhầm vào cảnh mới
    // trùng số. Chuyển hết vào _footage-da-bo.
    let soDon = 0
    if (thuMuc) {
      let cu = null
      try { cu = taiFt.docKeHoach(thuMuc) } catch (_) {}
      for (const c of (cu && cu.canh) || []) {
        if (c.chon && c.chon.tep && taiFt.dayRaBo(thuMuc, c.chon.tep)) soDon++
      }
    }
    const keHoach = phanLoaiFt.taoKeHoach(canh, phanLoaiFt.locSo(canh))
    if (thuMuc) taiFt.ghiKeHoach(thuMuc, keHoach)
    return { ok: true, keHoach, soDon }
  })

  ipcMain.handle('footage:kiem-khop', (_su, { canh, keHoach }) => phanLoaiFt.kiemKhopKeHoach(canh, keHoach))

  ipcMain.handle('footage:luu', (_su, { thuMuc, keHoach }) => {
    if (!thuMuc || !keHoach) return { ok: false }
    taiFt.ghiKeHoach(thuMuc, keHoach)
    return { ok: true }
  })

  ipcMain.handle('footage:prompt-phan-loai', (_su, { keHoach, loThu, moiLo }) => {
    const caiDat = kho.docCaiDat()
    const can = (keHoach.canh || []).filter((c) => c.canHoi)
    if (!can.length) return { ok: true, tongLo: 0, prompt: '', soCanh: 0 }
    const lo = promptAnh.chiaLo(can, moiLo || caiDat.soCanhMoiLo || 50)
    const i = Math.min(Math.max(1, loThu || 1), lo.length) - 1
    return {
      ok: true,
      tongLo: lo.length,
      loThu: i + 1,
      soCanh: lo[i].length,
      tongCanHoi: can.length,
      prompt: phanLoaiFt.taoPromptPhanLoai(lo[i], { loThu: i + 1, tongLo: lo.length })
    }
  })

  ipcMain.handle('footage:doc-phan-loai', (_su, { chu, keHoach, thuMuc }) => {
    const kq = phanLoaiFt.docTraLoiPhanLoai(chu)
    if (!kq.soDoc) return { ok: false, loi: kq.loi.join(' · ') || 'Không đọc được dòng nào.' }
    // Cảnh Claude đổi sang AI mà đã có tệp tải về → chuyển tệp vào _bo, không
    // thì cảnh đó vừa có footage vừa đi Flow.
    const coTep = new Map(keHoach.canh.filter((c) => c.chon && c.chon.tep).map((c) => [c.so, c.chon.tep]))
    const soDoi = phanLoaiFt.apDungClaude(keHoach, kq.ketQua)
    for (const c of keHoach.canh) {
      if (c.loai === 'AI' && coTep.has(c.so) && thuMuc) { taiFt.dayRaBo(thuMuc, coTep.get(c.so)); c.chon = null }
    }
    if (thuMuc) taiFt.ghiKeHoach(thuMuc, keHoach)
    return { ok: true, keHoach, soDoc: kq.soDoc, soDoi, canhBao: kq.loi.join(' · ') }
  })

  ipcMain.handle('footage:tim-tai', async (_su, { thuMuc, keHoach, chiSo }) => {
    if (dangChayFootage) return { ok: false, loi: 'Đang tìm/tải footage rồi — chờ lượt này xong hoặc bấm Dừng.' }
    if (!thuMuc) return { ok: false, loi: 'Chưa chọn thư mục dựng.' }
    const caiDat = kho.docCaiDat()
    const bat = trangThaiNguon(caiDat)
    if (!Object.values(bat).some(Boolean)) return { ok: false, loi: 'Chưa bật nguồn footage nào. Vào Cài đặt → Footage thật.' }

    dangChayFootage = true
    huyFootage = false
    const tim = nguonFt.taoTimKiem({
      layJSONHam: layJSON,
      khoa: { pexels: String(caiDat.khoaPexels || '').trim(), pixabay: String(caiDat.khoaPixabay || '').trim() },
      bat,
      cache: layCacheFt(),
      choBySa: !!caiDat.footageChoCcBySa,
      nhatKy
    })
    const giayTheoSo = Object.fromEntries(keHoach.canh.map((c) => [c.so, c.giayUoc || 9]))
    try {
      const kq = await taiFt.chayTimVaTai(keHoach, {
        thuMuc,
        timChoCanh: tim.timChoCanh,
        taiVeTepHam: (url, dich, tuyChon) => taiVeTep(url, dich, { ...tuyChon, tieuDe: { 'User-Agent': nguonFt.USER_AGENT } }),
        giayTheoSo,
        chiSo: chiSo && chiSo.length ? chiSo : null,
        soUngVien: Number(caiDat.footageSoUngVien) || 6,
        baoTienDo: (t) => baoTienDo({ ...t, khu: 'footage' }),
        daHuy: () => huyFootage,
        luu: (kh) => taiFt.ghiKeHoach(thuMuc, kh)
      })
      luuCacheFt()
      baoTienDo({
        phanTram: 100, viec: 'Tìm & tải footage xong',
        chiTiet: `${kq.soTai}/${kq.soCan} cảnh có tệp · ${kq.soKhongThay} cảnh không tìm ra`,
        soLoi: kq.loi.length, trangThai: kq.loi.length ? 'loi' : 'xong', khu: 'footage'
      })
      nhatKy.tin(`Footage: tải ${kq.soTai}/${kq.soCan} cảnh vào ${thuMuc}`)
      for (const l of kq.loi) nhatKy.canhBao(`Footage cảnh ${l.so ?? '-'}: ${l.loi}`)
      return { ok: true, keHoach, ...kq }
    } catch (e) {
      nhatKy.loi('Footage vỡ:', e.stack || e.message)
      baoTienDo({ phanTram: 100, viec: 'Footage lỗi', chiTiet: e.message, soLoi: 1, trangThai: 'loi', khu: 'footage' })
      return { ok: false, loi: e.message, keHoach }
    } finally {
      dangChayFootage = false
    }
  })

  ipcMain.handle('footage:dung', () => { huyFootage = true; return { ok: true } })

  ipcMain.handle('footage:chon-ung-vien', async (_su, { thuMuc, keHoach, so, id }) => {
    const c = keHoach.canh.find((x) => x.so === so)
    const uv = c && (c.ungVien || []).find((x) => x.id === id)
    if (!uv) return { ok: false, loi: 'Không thấy ứng viên này nữa — bấm "Tìm lại".' }
    const daDung = keHoach.canh.find((x) => x.so !== so && x.chon && x.chon.id === id)
    if (daDung) return { ok: false, loi: `Footage này đang dùng ở cảnh ${daDung.so} rồi — chọn cái khác để video không lặp hình.` }
    try {
      baoTienDo({ phanTram: 10, viec: `Tải footage cảnh ${so}`, chiTiet: uv.nguon, khu: 'footage' })
      await taiFt.taiChoCanh(c, uv, {
        thuMuc,
        taiVeTepHam: (url, dich, t) => taiVeTep(url, dich, { ...t, tieuDe: { 'User-Agent': nguonFt.USER_AGENT } })
      })
      c.loai = 'FOOTAGE'
      taiFt.ghiKeHoach(thuMuc, keHoach)
      baoTienDo({ phanTram: 100, viec: `Đã đổi footage cảnh ${so}`, chiTiet: c.chon.tep, trangThai: 'xong', khu: 'footage' })
      return { ok: true, keHoach }
    } catch (e) {
      baoTienDo({ phanTram: 100, viec: `Tải footage cảnh ${so} lỗi`, chiTiet: e.message, soLoi: 1, trangThai: 'loi', khu: 'footage' })
      return { ok: false, loi: e.message, keHoach }
    }
  })

  ipcMain.handle('footage:doi-loai', (_su, { thuMuc, keHoach, so, loai, tuKhoaTim, kieu }) => {
    const c = keHoach.canh.find((x) => x.so === so)
    if (!c) return { ok: false, loi: 'Không thấy cảnh ' + so }
    if (loai === 'AI') taiFt.traVeAi(keHoach, so, thuMuc)
    else {
      c.loai = 'FOOTAGE'
      c.nguonPhanLoai = 'tay'
      c.canHoi = false
      if (tuKhoaTim !== undefined) c.tuKhoaTim = String(tuKhoaTim).trim()
      if (kieu) c.kieu = kieu
    }
    if (thuMuc) taiFt.ghiKeHoach(thuMuc, keHoach)
    return { ok: true, keHoach }
  })

  ipcMain.handle('footage:xuat-loc', async (_su, { thuMuc, keHoach }) => {
    if (!thuMuc || !keHoach) return { ok: false, loi: 'Chưa có thư mục dựng hoặc kế hoạch.' }
    const dd = path.join(thuMuc, 'canh-cho-flow.xlsx')
    let kq
    try {
      kq = await xuatCanh.xuatExcelLoc(dd, keHoach.canh, keHoach)
    } catch (e) {
      return { ok: false, loi: `Không ghi được ${dd}: ${e.message}. Tệp đang mở trong Excel thì đóng lại.` }
    }
    fs.writeFileSync(path.join(thuMuc, 'chuoi-so-flow.txt'), kq.chuoi + '\n', 'utf8')
    fs.writeFileSync(path.join(thuMuc, 'ghi-cong-footage.txt'), xuatCanh.vanBanGhiCong(keHoach), 'utf8')
    nhatKy.tin(`Xuất Excel đã lọc: ${kq.soConLai} cảnh cho Flow · chuỗi số ${kq.chuoi}`)
    return { ok: true, ...kq, soFootage: xuatCanh.soCoFootage(keHoach).size }
  })

  function thuMucAudio(thuMuc) {
    for (const ten of ['Audio', 'audio', 'Voice', 'voice', 'Voices', 'voices']) {
      const d = path.join(thuMuc, ten)
      if (fs.existsSync(d)) return d
    }
    return path.join(thuMuc, 'Audio')
  }

  function kiemDuThuMuc(thuMuc, soCanh) {
    return xuatCanh.kiemDu(soCanh, {
      Videos: xuatCanh.docTenTrongThuMuc(path.join(thuMuc, 'Videos')),
      Images: xuatCanh.docTenTrongThuMuc(path.join(thuMuc, 'Images')),
      Audio: xuatCanh.docTenTrongThuMuc(thuMucAudio(thuMuc))
    })
  }

  ipcMain.handle('footage:gom-flow', async (_su, { thuMuc, keHoach }) => {
    if (!thuMuc || !keHoach) return { ok: false, loi: 'Chưa có thư mục dựng hoặc kế hoạch.' }
    const { canceled, filePaths } = await dialog.showOpenDialog(cuaSo, {
      title: 'Chọn thư mục Flow đã tải ảnh/video về',
      defaultPath: app.getPath('downloads'),
      properties: ['openDirectory']
    })
    if (canceled || !filePaths.length) return { ok: false, huy: true }
    const tuThuMuc = filePaths[0]
    if (path.resolve(tuThuMuc) === path.resolve(thuMuc)) return { ok: false, loi: 'Thư mục Flow trùng thư mục dựng — chọn thư mục Flow tải về.' }
    const gom = xuatCanh.keHoachGom(xuatCanh.docTenTrongThuMuc(tuThuMuc), { soFootage: xuatCanh.soCoFootage(keHoach) })
    const thua = gom.lenh.filter((l) => l.so > keHoach.canh.length)
    const lenh = gom.lenh.filter((l) => l.so <= keHoach.canh.length)
    let da = 0
    for (const l of lenh) {
      const dich = path.join(thuMuc, l.den)
      fs.mkdirSync(path.dirname(dich), { recursive: true })
      // Cùng số mà đã có tệp khác đuôi ở thư mục kia (ảnh → video) thì chuyển tệp
      // cũ vào _bo, để một số chỉ còn một hình.
      const khac = path.join(thuMuc, l.loai === 'video' ? 'Images' : 'Videos')
      for (const ten of xuatCanh.docTenTrongThuMuc(khac)) {
        if (/^\d+$/.test(path.parse(ten).name) && Number(path.parse(ten).name) === l.so) {
          taiFt.dayRaBo(thuMuc, path.join(l.loai === 'video' ? 'Images' : 'Videos', ten))
        }
      }
      for (const ten of xuatCanh.docTenTrongThuMuc(path.dirname(dich))) {
        if (ten !== path.basename(dich) && /^\d+$/.test(path.parse(ten).name) && Number(path.parse(ten).name) === l.so) {
          taiFt.dayRaBo(thuMuc, path.join(path.dirname(l.den), ten))
        }
      }
      fs.copyFileSync(path.join(tuThuMuc, l.tu), dich)
      da++
      baoTienDo({ phanTram: Math.round((da / lenh.length) * 100), viec: 'Gom tệp Flow', chiTiet: `${da}/${lenh.length}`, khu: 'footage' })
    }
    const kiem = kiemDuThuMuc(thuMuc, keHoach.canh.length)
    baoTienDo({ phanTram: 100, viec: 'Gom tệp Flow xong', chiTiet: `${da} tệp · thiếu hình ${kiem.thieuHinh.length} cảnh`, trangThai: kiem.ok ? 'xong' : 'loi', soLoi: kiem.thieuHinh.length, khu: 'footage' })
    nhatKy.tin(`Gom ${da} tệp Flow từ ${tuThuMuc} vào ${thuMuc}`)
    return { ok: true, soChep: da, boQua: gom.boQua, nhieuTep: gom.nhieuTep, thua: thua.map((l) => l.tu), kiem }
  })

  ipcMain.handle('footage:kiem-du', (_su, { thuMuc, soCanh }) => {
    if (!thuMuc) return { ok: false, loi: 'Chưa chọn thư mục dựng.' }
    return { ok: true, kiem: kiemDuThuMuc(thuMuc, soCanh) }
  })

  // --- Kho nhân vật / bối cảnh ----------------------------------------------
  ipcMain.handle('kho:ghi', (_su, { loai, danhSach }) => {
    const caiDat = kho.docCaiDat()
    const khoa = loai === 'boiCanh' ? 'khoBoiCanh' : 'khoNhanVat'
    kho.ghiCaiDat({ ...caiDat, [khoa]: danhSach })
    return { ok: true }
  })

  // --- Tài khoản + trình duyệt ----------------------------------------------
  ipcMain.handle('taikhoan:them', (_su, { ten }) => {
    const caiDat = kho.docCaiDat()
    const ds = caiDat.taiKhoan || []
    const tk = { id: trinhDuyet.taoIdTaiKhoan(), ten: ten || `tài khoản ${ds.length + 1}`, taoLuc: Date.now() }
    ds.push(tk)
    kho.ghiCaiDat({ ...caiDat, taiKhoan: ds })
    nhatKy.tin(`Thêm tài khoản: ${tk.ten} (${trinhDuyet.tenPhanVung(tk.id)})`)
    return { ok: true, taiKhoan: tk }
  })

  ipcMain.handle('taikhoan:xoa', async (_su, { id }) => {
    const caiDat = kho.docCaiDat()
    kho.ghiCaiDat({ ...caiDat, taiKhoan: (caiDat.taiKhoan || []).filter((t) => t.id !== id) })
    if (quanLyDuyet) await quanLyDuyet.xoaPhien(id)
    nhatKy.tin(`Xoá tài khoản ${id} và toàn bộ phiên đăng nhập của nó.`)
    return { ok: true }
  })

  ipcMain.handle('duyet:mo-tab', (_su, { taiKhoanId, url }) => {
    if (!quanLyDuyet) return { ok: false }
    const id = quanLyDuyet.moTab({ taiKhoanId, url })
    return { ok: true, tabId: id }
  })
  // Mở nhanh một link trong trình duyệt của app (bấm thumbnail ở các bảng).
  // Có tab đang hiện thì đi tới đó; chưa có thì mở tab mới bằng tài khoản đầu
  // tiên, không có tài khoản nào thì bằng phiên khách.
  ipcMain.handle('duyet:mo-nhanh', (_su, { url }) => {
    if (!trinhDuyet.duocPhepMo(url)) return { ok: false }
    const tt = quanLyDuyet.trangThai()
    if (tt.tabDangHien) {
      quanLyDuyet.dieuHuong(tt.tabDangHien, url)
      return { ok: true, tabId: tt.tabDangHien }
    }
    const ds = kho.docCaiDat().taiKhoan || []
    return { ok: true, tabId: quanLyDuyet.moTab({ taiKhoanId: ds.length ? ds[0].id : 'khach', url }) }
  })
  ipcMain.handle('duyet:chon-tab', (_su, { tabId }) => ({ ok: quanLyDuyet.chonTab(tabId) }))
  ipcMain.handle('duyet:dong-tab', (_su, { tabId }) => ({ ok: quanLyDuyet.dongTab(tabId) }))
  ipcMain.handle('duyet:dieu-huong', (_su, { tabId, url }) => ({ ok: quanLyDuyet.dieuHuong(tabId, url) }))
  ipcMain.handle('duyet:khung', (_su, khung) => {
    if (quanLyDuyet) quanLyDuyet.datKhung(khung)
    return { ok: true }
  })
  ipcMain.handle('duyet:hien', () => { quanLyDuyet.hien(); return quanLyDuyet.trangThai() })
  ipcMain.handle('duyet:an', () => { quanLyDuyet.an(); return quanLyDuyet.trangThai() })
  ipcMain.handle('duyet:trang-thai', () => quanLyDuyet.trangThai())

  // --- Tiện ích --------------------------------------------------------------
  ipcMain.handle('chep', (_su, { chu }) => {
    clipboard.writeText(String(chu || ''))
    return { ok: true, soKyTu: String(chu || '').length }
  })

  ipcMain.handle('nhatky:doc', () => nhatKy.cacDong(500))
  ipcMain.handle('mo-ngoai', (_su, url) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { ok: true }
  })
  ipcMain.handle('mo-thu-muc', (_su, duongDan) => {
    shell.showItemInFolder(duongDan || nhatKy.duongDan() || kho.thuMuc)
    return { ok: true }
  })

  ipcMain.handle('capnhat:kha-nang', () => khaNangCapNhat())

  ipcMain.handle('capnhat:kiem-tra', async () => {
    const kn = khaNangCapNhat()
    if (!kn.kiemTraDuoc) return { ok: false, lyDo: kn.lyDo, khaNang: kn }
    try {
      const bo = layBoCapNhat()
      const kq = await bo.checkForUpdates()
      const moi = kq && kq.updateInfo ? kq.updateInfo.version : null
      const coBanMoi = !!moi && moi !== app.getVersion()
      return {
        ok: true,
        phienBanHienTai: app.getVersion(),
        phienBanMoi: moi,
        coBanMoi,
        khaNang: kn,
        ghiChuPhatHanh: kq && kq.updateInfo ? (kq.updateInfo.releaseNotes || '') : ''
      }
    } catch (e) {
      nhatKy.loi('Kiểm tra cập nhật lỗi:', e.message)
      return { ok: false, lyDo: e.message, khaNang: kn }
    }
  })

  ipcMain.handle('capnhat:tai', async () => {
    const kn = khaNangCapNhat()
    if (!kn.taiDuoc) return { ok: false, lyDo: kn.lyDo, khaNang: kn }
    try {
      nhatKy.tin('Bắt đầu tải bản cập nhật…')
      await layBoCapNhat().downloadUpdate()
      return { ok: true }
    } catch (e) {
      nhatKy.loi('Tải bản cập nhật lỗi:', e.message)
      return { ok: false, lyDo: e.message }
    }
  })

  ipcMain.handle('capnhat:cai', () => {
    const kn = khaNangCapNhat()
    if (!kn.caiDuoc) return { ok: false, lyDo: kn.lyDo, khaNang: kn }
    if (!daTaiXongBanMoi) {
      return { ok: false, lyDo: 'Chưa tải xong bản mới. Bấm "Tải bản mới" trước đã.' }
    }
    nhatKy.tin('Đóng app và cài bản mới…')
    // Hoãn một nhịp để giao diện kịp vẽ dòng thông báo trước khi app đóng.
    setTimeout(() => layBoCapNhat().quitAndInstall(false, true), 400)
    return { ok: true }
  })
}

// Bảng Excel cho prompt — để rà bằng mắt và sửa tay trước khi đưa sang Flow.
async function xuatExcelPrompt(duongDan, canh, cacPrompt) {
  const ExcelJS = require('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Prompt ảnh')

  ws.columns = [
    { header: 'STT', key: 'so', width: 7 },
    { header: 'Tên ảnh', key: 'ten', width: 12 },
    { header: 'Câu trong kịch bản', key: 'chu', width: 60 },
    { header: 'Số từ', key: 'soTu', width: 8 },
    { header: 'Giây ước', key: 'giay', width: 10 },
    { header: 'Prompt', key: 'prompt', width: 90 },
    { header: 'Nhân vật', key: 'nhanVat', width: 24 }
  ]
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2132' } }
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFF7A1A' } }

  canh.forEach((c, i) => {
    ws.addRow({
      so: c.so,
      ten: c.ten,
      chu: c.chu,
      soTu: c.soTu,
      giay: c.giayUoc,
      prompt: cacPrompt[i] ? cacPrompt[i].prompt : '',
      nhanVat: cacPrompt[i] ? cacPrompt[i].nhanVat.join(', ') : ''
    })
  })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  await wb.xlsx.writeFile(duongDan)
}

// ---------------------------------------------------------------------------
// Kiểm thử tầng 2
// ---------------------------------------------------------------------------

async function chaySmoke() {
  const thuMucAnh = app.isPackaged
    ? path.join(app.getPath('userData'), 'shots')
    : path.join(__dirname, 'shots')
  fs.mkdirSync(thuMucAnh, { recursive: true })
  nhatKy.tin(`Smoke ghi ảnh vào: ${thuMucAnh}`)

  const cacMan = ['y-tuong', 'de-xuat', 'kenh', 'loi-thoai', 'kich-ban', 'kiem-duyet', 'prompt-anh', 'footage', 'trinh-duyet', 'cai-dat', 'huong-dan', 'nhat-ky']
  const thieu = []

  // Nạp dữ liệu mẫu TRƯỚC khi chụp: bảng trống thì ảnh chụp không cho biết
  // thumbnail có hiện không, ô tick có lệch không.
  const mau = await cuaSo.webContents.executeJavaScript('window.smokeDuLieuMau()')
    .catch((e) => ({ loi: e.message }))
  nhatKy.tin('Smoke: dữ liệu mẫu — ' + JSON.stringify(mau))

  for (const man of cacMan) {
    const ok = await cuaSo.webContents.executeJavaScript(`window.smokeMoMan('${man}')\n;undefined;`)
      .then(() => true).catch(() => false)
    await new Promise((r) => setTimeout(r, 420))
    const anh = await cuaSo.webContents.capturePage()
    fs.writeFileSync(path.join(thuMucAnh, `${man}.png`), anh.toPNG())
    nhatKy.tin(`Smoke: chụp màn ${man} — ${ok ? 'mở được' : 'KHÔNG mở được'}`)
    if (!ok) thieu.push(man)
  }

  // Khối nằm DƯỚI TẦM NHÌN thì ảnh chụp màn không tới, mà nút bị cắt hay chữ
  // vỡ dấu ở đó cũng chẳng ném exception nào. Cuộn tới rồi chụp riêng.
  const khoiDuoiTamNhin = [
    ['cai-dat', '#gioi-han-cap-nhat', 'cai-dat-cap-nhat'],
    ['prompt-anh', '#o-mo-ta-tra-ve', 'prompt-anh-mo-ta'],
    ['kich-ban', '#danh-sach-phan', 'kich-ban-cac-phan'],
    ['y-tuong', '#bang-ket-qua', 'y-tuong-bang'],
    ['de-xuat', '#bang-radar', 'de-xuat-bang-radar'],
    ['trinh-duyet', '#the-cong-dung-duyet', 'trinh-duyet-cong-dung'],
    ['cai-dat', '[data-khoa="subToiThieu"]', 'cai-dat-kenh-my'],
    ['footage', '#bang-footage', 'footage-bang-duyet'],
    ['footage', '#nut-gom-flow', 'footage-gom-kiem'],
    ['cai-dat', '[data-khoa="khoaPexels"]', 'cai-dat-footage']
  ]
  for (const [man, chon, tenAnh] of khoiDuoiTamNhin) {
    await cuaSo.webContents.executeJavaScript(`window.smokeMoMan('${man}')\n;undefined;`).catch(() => {})
    await cuaSo.webContents.executeJavaScript(`
      (function () {
        var o = document.querySelector('${chon}');
        if (o) o.scrollIntoView({ block: 'center' });
      })()
    `).catch(() => {})
    await new Promise((r) => setTimeout(r, 360))
    const anh = await cuaSo.webContents.capturePage()
    fs.writeFileSync(path.join(thuMucAnh, `${tenAnh}.png`), anh.toPNG())
    nhatKy.tin(`Smoke: chụp riêng khối dưới tầm nhìn — ${tenAnh}`)
  }

  const phanTuCanCo = [
    '#nhap-tu-khoa', '#nut-ghep', '#nut-tim', '#bang-ket-qua',
    '#nut-xuat-excel', '#danh-sach-khoa', '#nut-them-khoa',
    '#thanh-tien-do', '#tien-do-phan-tram', '#quota-con-lai',
    '#nhap-kenh', '#nut-them-kenh', '#nut-quet-kenh', '#bang-kenh',
    '#nhap-link-video', '#nut-lay-loi-thoai', '#nut-tai-ytdlp',
    '#chon-du-an', '#nut-tao-du-an',
    '#nut-prompt-dan-y', '#o-dan-y', '#nut-luu-dan-y', '#danh-sach-phan',
    '#o-kiem-duyet', '#nut-kiem-duyet', '#ket-qua-kiem-duyet',
    '#nut-cat-canh', '#bang-canh', '#nut-xuat-prompt', '#kho-nhan-vat',
    '#danh-sach-tai-khoan', '#nut-them-tai-khoan', '#khung-duyet',
    // 0.3.0: chế độ chạy độc lập, nạp tệp Word, mô tả cảnh hai kiểu, tự cập nhật
    '#nhap-link-nhanh', '#nut-lay-nhanh', '#nut-mo-tep-loi-thoai', '#o-loi-thoai-nhanh',
    '#o-kich-ban-anh', '#nut-mo-tep-anh', '#o-kieu-mo-ta',
    '#nut-tai-ban-moi', '#nut-cai-ban-moi', '#day-cap-nhat',
    // 0.4.0: thumbnail + tick, Video đã chọn, Đề xuất video, công dụng trình duyệt
    '#hop-da-chon', '#so-da-chon', '#nut-tai-thumb-y-tuong',
    '#bang-ket-qua .tick-tat-ca', '#bang-ket-qua .tick-video', '#bang-ket-qua .o-thumb img',
    '#nhap-linh-vuc', '#nut-chay-radar', '#chon-tai-khoan-radar', '#bang-radar', '#nut-lay-hot', '#nut-tim-72h', '#bang-hot',
    '.hop-video-chon[data-man="loi-thoai"] .the-video-chon',
    '.hop-video-chon[data-man="kich-ban"] #o-dung-video-tham-khao',
    '.hop-video-chon[data-man="kiem-duyet"] .hang-hanh-dong button',
    '.hop-video-chon[data-man="prompt-anh"] .hang-hanh-dong button',
    '#o-ban-goc', '#the-cong-dung-duyet', '#nut-sang-radar',
    // 0.5.0: Footage thật
    '#man-footage', '#nut-chon-thu-muc-dung', '#nut-cat-canh-ft', '#nut-xuat-canh-xlsx', '#nut-loc-so',
    '#nut-prompt-phan-loai', '#o-tra-loi-phan-loai', '#nut-doc-phan-loai', '#nut-tim-tai-ft', '#nut-dung-ft',
    '#bang-footage', '#bang-footage .the-ung-vien img', '#nut-xuat-loc', '#o-chuoi-so-flow', '#nut-gom-flow', '#nut-kiem-du',
    '#o-bo-canh-footage', '[data-khoa="khoaPexels"]', '[data-khoa="khoaPixabay"]'
  ]
  const thieuPhanTu = await cuaSo.webContents.executeJavaScript(`
    (function () {
      var can = ${JSON.stringify(phanTuCanCo)};
      return can.filter(function (s) { return !document.querySelector(s); });
    })()
  `)

  const thieuKhoa = await cuaSo.webContents.executeJavaScript(`window.smokeKiemKhoaCaiDat()\n`)

  // Có lớp nào phủ lên giao diện không? Lỗi đã gặp thật: #man-che đặt
  // display:flex ở bộ chọn #id, thắng luật [hidden]{display:none} → lớp phủ
  // hiện suốt, cả app bị làm mờ và KHÔNG BẤM ĐƯỢC NÚT NÀO, mà không exception.
  const bicHe = await cuaSo.webContents.executeJavaScript(`
    (function () {
      var diem = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      var che = document.getElementById('man-che');
      var bi = !!(diem && che && (diem === che || che.contains(diem)));
      return { bi: bi, trungPhanTu: diem ? (diem.id || diem.tagName) : 'không có' };
    })()
  `)

  // Ảnh thumbnail có THẬT SỰ vẽ ra không (CSP chặn img-src là ảnh vỡ im lặng,
  // không exception nào). naturalWidth = 0 nghĩa là ảnh không tải được.
  const anhVo = await cuaSo.webContents.executeJavaScript(`
    (function () {
      window.smokeMoMan('y-tuong');
      var cac = document.querySelectorAll('#bang-ket-qua .o-thumb img');
      var vo = 0;
      for (var i = 0; i < cac.length; i++) if (!cac[i].complete || cac[i].naturalWidth === 0) vo++;
      return { tong: cac.length, vo: vo };
    })()
  `)

  // Ảnh xem trước ở bảng Footage cũng phải vẽ ra thật (CSP img-src).
  const anhFootage = await cuaSo.webContents.executeJavaScript(`
    (function () {
      window.smokeMoMan('footage');
      var cac = document.querySelectorAll('#bang-footage img');
      var vo = 0;
      for (var i = 0; i < cac.length; i++) if (!cac[i].complete || cac[i].naturalWidth === 0) vo++;
      return { tong: cac.length, vo: vo };
    })()
  `)

  const ketQua = { thieuMan: thieu, thieuPhanTu, thieuKhoaCaiDat: thieuKhoa, bicHe, anhThumbnail: anhVo, anhFootage }
  fs.writeFileSync(path.join(thuMucAnh, 'ket-qua-smoke.json'), JSON.stringify(ketQua, null, 2))
  nhatKy.tin('Smoke kết quả:', JSON.stringify(ketQua))

  const vo = thieu.length || thieuPhanTu.length || (thieuKhoa && thieuKhoa.length) || bicHe.bi ||
    !anhVo.tong || anhVo.vo > 0 || !anhFootage.tong || anhFootage.vo > 0
  app.exit(vo ? 1 : 0)
}

// ---------------------------------------------------------------------------

const khoaMotBan = app.requestSingleInstanceLock()
if (!khoaMotBan && !LA_SMOKE) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (cuaSo) { cuaSo.show(); cuaSo.focus() }
  })

  app.whenReady().then(() => {
    const thuMuc = thuMucDuLieu()
    nhatKy.datThuMuc(thuMuc)
    nhatKy.tin(`Tool Ý Tưởng ${app.getVersion()} khởi động. Dữ liệu: ${thuMuc}`)
    kho = taoKho(thuMuc)
    boDem = taoBoDem(thuMuc)
    khoDuAn = taoKhoDuAn(thuMuc)
    dangKyIPC()
    taoCuaSo()

    // Tự kiểm bản mới khi mở app. Chờ 4 giây cho giao diện vẽ xong đã — kiểm
    // ngay lúc khởi động thì cửa sổ đứng hình mấy giây, trông như treo.
    const cd = kho.docCaiDat()
    if (cd.tuDongKiemCapNhat && khaNangCapNhat().kiemTraDuoc) {
      setTimeout(() => {
        layBoCapNhat().checkForUpdates().catch((loi) =>
          nhatKy.canhBao('Tự kiểm cập nhật lúc mở app không thành: ' + loi.message))
      }, 4000)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) taoCuaSo()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  process.on('uncaughtException', (loi) => {
    nhatKy.loi('Lỗi không bắt được:', loi.stack || loi.message)
  })
}
