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
const { layGoiY, layJSON } = require('./src/goi-mang')
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
      layGoiYHam: (cum) => layGoiY(cum, { hl: 'en' }),
      soLuong: soLuong || 5,
      lichSu: cache.muc || {},
      baoTienDo: (t) => baoTienDo({ ...t, khu: 'tukhoa' })
    })
    nhatKy.tin(`Chọn ${kq.chon.length} từ khóa. Gọi được gợi ý: ${kq.coMang ? 'có' : 'KHÔNG'}`)
    return kq
  })

  ipcMain.handle('quota:uoc', (_su, thamSo) => uocChiPhi(thamSo))

  ipcMain.handle('ytuong:tim', async (_su, { tuKhoa }) => {
    const caiDat = kho.docCaiDat()
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
        baoTienDo: (t) => baoTienDo({ ...t, khu: 'ytuong' })
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

  ipcMain.handle('kiemduyet:mo-tep', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(cuaSo, {
      title: 'Mở tệp kịch bản có sẵn',
      properties: ['openFile'],
      filters: [{ name: 'Kịch bản', extensions: ['txt', 'md', 'markdown', 'srt', 'vtt'] }]
    })
    if (canceled || !filePaths.length) return { ok: false, huy: true }

    const duongDan = filePaths[0]
    const tho = fs.readFileSync(duongDan, 'utf8')
    // .srt/.vtt là phụ đề chứ không phải văn xuôi — bóc lấy chữ, bỏ mốc giờ.
    const chu = /\.(srt|vtt)$/i.test(duongDan)
      ? phuDe.chuyenThanhVanBan(tho, { dinhDang: 'vtt' }).vanBan
      : tho
    return { ok: true, chu, ten: path.basename(duongDan) }
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

  ipcMain.handle('promptanh:prompt-mo-ta', (_su, { canh, loThu, moiLo }) => {
    const caiDat = kho.docCaiDat()
    const lo = promptAnh.chiaLo(canh, moiLo || 50)
    const i = Math.min(Math.max(1, loThu || 1), lo.length) - 1
    return {
      ok: true,
      tongLo: lo.length,
      loThu: i + 1,
      soCanhTrongLo: lo[i] ? lo[i].length : 0,
      prompt: lo[i] ? promptAnh.taoPromptMoTaCanh(lo[i], {
        style: (caiDat.oPrompt && caiDat.oPrompt.style) || promptAnh.MAC_DINH_O.style,
        khoNhanVat: caiDat.khoNhanVat || [],
        loThu: i + 1,
        tongLo: lo.length
      }) : ''
    }
  })

  ipcMain.handle('promptanh:doc-mo-ta', (_su, { chu }) => promptAnh.phanTichMoTaCanh(chu))

  ipcMain.handle('promptanh:tao', (_su, { canh, moTaTheoCanh }) => {
    const caiDat = kho.docCaiDat()
    const cacPrompt = promptAnh.taoTatCaPrompt(canh, {
      template: caiDat.templatePrompt || promptAnh.TEMPLATE_MAC_DINH,
      o: caiDat.oPrompt || {},
      khoNhanVat: caiDat.khoNhanVat || [],
      khoBoiCanh: caiDat.khoBoiCanh || [],
      moTaTheoCanh: moTaTheoCanh || {}
    })
    return { ok: true, cacPrompt, kiemTra: promptAnh.kiemTraLienTuc(cacPrompt) }
  })

  ipcMain.handle('promptanh:xuat', async (_su, { canh, cacPrompt, duAnMa }) => {
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

    ghi('prompts.txt', promptAnh.xuatPromptsTxt(cacPrompt))
    ghi('ten-anh.txt', promptAnh.xuatTenAnh(cacPrompt))
    ghi('scenes.json', promptAnh.xuatScenesJson(canh, cacPrompt, {
      duAn: duAnMa || '', tuMoiCanh: caiDat.tuMoiCanh
    }))

    // Bảng Excel để rà bằng mắt và sửa tay.
    const duongDanXlsx = path.join(thuMuc, 'prompts.xlsx')
    await xuatExcelPrompt(duongDanXlsx, canh, cacPrompt)
    daGhi.push(duongDanXlsx)

    nhatKy.tin(`Xuất ${cacPrompt.length} prompt ra ${thuMuc}`)
    return { ok: true, thuMuc, daGhi, soPrompt: cacPrompt.length }
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

  ipcMain.handle('capnhat:kiem-tra', async () => {
    if (!app.isPackaged) {
      return { ok: false, lyDo: 'Đang chạy bản mã nguồn (chưa đóng gói) nên không kiểm tra cập nhật.' }
    }
    try {
      const { autoUpdater } = require('electron-updater')
      autoUpdater.autoDownload = false
      autoUpdater.logger = { info: nhatKy.tin, warn: nhatKy.canhBao, error: nhatKy.loi, debug: () => {} }
      const kq = await autoUpdater.checkForUpdates()
      const moi = kq && kq.updateInfo ? kq.updateInfo.version : null
      return { ok: true, phienBanHienTai: app.getVersion(), phienBanMoi: moi, coBanMoi: !!moi && moi !== app.getVersion() }
    } catch (e) {
      nhatKy.loi('Kiểm tra cập nhật lỗi:', e.message)
      return { ok: false, lyDo: e.message }
    }
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

  const cacMan = ['y-tuong', 'kenh', 'loi-thoai', 'kich-ban', 'kiem-duyet', 'prompt-anh', 'trinh-duyet', 'cai-dat', 'huong-dan', 'nhat-ky']
  const thieu = []

  for (const man of cacMan) {
    const ok = await cuaSo.webContents.executeJavaScript(`window.smokeMoMan('${man}')\n;undefined;`)
      .then(() => true).catch(() => false)
    await new Promise((r) => setTimeout(r, 420))
    const anh = await cuaSo.webContents.capturePage()
    fs.writeFileSync(path.join(thuMucAnh, `${man}.png`), anh.toPNG())
    nhatKy.tin(`Smoke: chụp màn ${man} — ${ok ? 'mở được' : 'KHÔNG mở được'}`)
    if (!ok) thieu.push(man)
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
    '#danh-sach-tai-khoan', '#nut-them-tai-khoan', '#khung-duyet'
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

  const ketQua = { thieuMan: thieu, thieuPhanTu, thieuKhoaCaiDat: thieuKhoa, bicHe }
  fs.writeFileSync(path.join(thuMucAnh, 'ket-qua-smoke.json'), JSON.stringify(ketQua, null, 2))
  nhatKy.tin('Smoke kết quả:', JSON.stringify(ketQua))

  const vo = thieu.length || thieuPhanTu.length || (thieuKhoa && thieuKhoa.length) || bicHe.bi
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
