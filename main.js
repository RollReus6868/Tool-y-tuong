// Tiến trình chính của Tool Ý Tưởng.
//
// Quy ước: mọi thứ tiếng Việt. Mọi việc chạy lâu đều phát sự kiện 'tien-do' về
// giao diện (phần trăm + việc đang làm + số lỗi), không có việc nào chạy âm thầm.

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const nhatKy = require('./src/nhat-ky')
const { taoKho } = require('./src/store')
const { taoBoDem, uocChiPhi } = require('./src/quota')
const { ghepTuKhoa } = require('./src/tu-khoa')
const { layGoiY, layJSON } = require('./src/goi-mang')
const { timYTuong } = require('./src/tim-y-tuong')
const { xuatExcel } = require('./src/xuat-excel')

const LA_SMOKE = !!process.env.YT_SMOKE
let cuaSo = null
let kho = null
let boDem = null

// ---------------------------------------------------------------------------
// Khởi tạo
// ---------------------------------------------------------------------------

function thuMucDuLieu() {
  // Trong chế độ smoke thì ghi vào thư mục tạm riêng để không đụng dữ liệu thật.
  if (LA_SMOKE) {
    const t = path.join(app.getPath('temp'), 'tool-y-tuong-smoke')
    fs.mkdirSync(t, { recursive: true })
    return t
  }
  return app.getPath('userData')
}

function taoCuaSo() {
  cuaSo = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 660,
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

  if (LA_SMOKE) {
    cuaSo.webContents.once('did-finish-load', () => chaySmoke().catch((loi) => {
      nhatKy.loi('Smoke vỡ:', loi.stack || loi.message)
      app.exit(1)
    }))
  }
}

function baoTienDo(duLieu) {
  if (cuaSo && !cuaSo.isDestroyed()) cuaSo.webContents.send('tien-do', duLieu)
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function dangKyIPC() {
  ipcMain.handle('caidat:doc', () => {
    const caiDat = kho.docCaiDat()
    return {
      caiDat,
      phienBan: app.getVersion(),
      duongDanNhatKy: nhatKy.duongDan(),
      thuMucDuLieu: kho.thuMuc,
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
    const khoa = boDem.chonKhoa(caiDat.khoaApi || [], can)

    if (!khoa) {
      const coKhoa = (caiDat.khoaApi || []).length > 0
      return {
        ok: false,
        loi: coKhoa
          ? `Không khoá nào còn đủ ${can.toLocaleString('vi-VN')} đơn vị quota hôm nay. Quota reset 0h giờ Pacific (khoảng 14-15h giờ Việt Nam).`
          : 'Chưa có khoá API. Vào Cài đặt → thêm khoá (miễn phí, không cần thẻ — xem Hướng dẫn).'
      }
    }

    nhatKy.tin(`Bắt đầu tìm: ${tuKhoa.join(' | ')} — ước ${can} đơn vị, khoá "${khoa.ten}" còn ${boDem.conLai(khoa.id)}`)

    try {
      const kq = await timYTuong({
        tuKhoa,
        caiDat,
        khoa,
        boDem,
        layJSONHam: layJSON,
        nhatKy,
        baoTienDo: (t) => baoTienDo({ ...t, khu: 'ytuong' })
      })

      // Ghi lịch sử để lần sau trừ điểm từ khóa vừa tìm (khỏi tốn quota lặp).
      const cache = kho.docCache()
      cache.muc = cache.muc || {}
      for (const tk of tuKhoa) cache.muc[tk.toLowerCase()] = Date.now()
      kho.ghiCache(cache)

      nhatKy.tin(`Xong: ${kq.dong.length} video, ${kq.soNoView} nổ view, dùng ${kq.quotaDaDung} đơn vị.`)
      return { ok: true, ...kq, conLai: boDem.conLai(khoa.id), tenKhoa: khoa.ten }
    } catch (loi) {
      nhatKy.loi(`Tìm thất bại: ${loi.message}`)
      return { ok: false, loi: loi.message, laLoiQuota: !!loi.laLoiQuota }
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
    // electron-updater chỉ chạy được trong bản đã đóng gói. Trong lúc phát triển
    // nó ném lỗi "dev-app-update.yml not found" — đừng để lỗi đó nổi lên giao
    // diện thành "không kiểm tra được cập nhật".
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
    } catch (loi) {
      nhatKy.loi('Kiểm tra cập nhật lỗi:', loi.message)
      return { ok: false, lyDo: loi.message }
    }
  })
}

// ---------------------------------------------------------------------------
// Kiểm thử tầng 2: đi hết các màn, chụp ảnh từng màn ra shots/
// Bắt buộc phải MỞ ẢNH RA XEM sau khi chạy: nút bị cắt, chữ vỡ dấu, khoảng
// trống lệch đều không ném exception.
// ---------------------------------------------------------------------------

async function chaySmoke() {
  // Bản đã đóng gói chạy từ TRONG app.asar — đó là một tệp, không phải thư mục,
  // nên mkdir cạnh __dirname ném ENOTDIR và cả lượt smoke chết trước khi chụp
  // được tấm ảnh nào. Đóng gói xong vẫn phải smoke được trên máy Windows/macOS
  // thật, nên khi đã đóng gói thì ghi ảnh vào thư mục dữ liệu.
  const thuMucAnh = app.isPackaged
    ? path.join(app.getPath('userData'), 'shots')
    : path.join(__dirname, 'shots')
  fs.mkdirSync(thuMucAnh, { recursive: true })
  nhatKy.tin(`Smoke ghi ảnh vào: ${thuMucAnh}`)

  const cacMan = ['y-tuong', 'kenh', 'loi-thoai', 'kich-ban', 'kiem-duyet', 'prompt-anh', 'cai-dat', 'huong-dan', 'nhat-ky']
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

  // Kiểm các phần tử then chốt có thật trong DOM không.
  const phanTuCanCo = [
    '#nhap-tu-khoa', '#nut-ghep', '#nut-tim', '#bang-ket-qua',
    '#nut-xuat-excel', '#danh-sach-khoa', '#nut-them-khoa',
    '#thanh-tien-do', '#tien-do-phan-tram', '#quota-con-lai'
  ]
  const thieuPhanTu = await cuaSo.webContents.executeJavaScript(`
    (function () {
      var can = ${JSON.stringify(phanTuCanCo)};
      return can.filter(function (s) { return !document.querySelector(s); });
    })()
  `)

  // Đủ khoá cài đặt: giao diện phải đọc/ghi đúng tên khoá mà store.js dùng.
  const thieuKhoa = await cuaSo.webContents.executeJavaScript(`window.smokeKiemKhoaCaiDat()\n`)

  // Có lớp nào đang phủ lên giao diện không?
  //
  // Lỗi đã gặp thật: #man-che (nền mờ của hộp thoại) đặt display:flex ở bộ chọn
  // #id, thắng luật [hidden]{display:none} của trình duyệt → lớp phủ hiện suốt,
  // cả app bị làm mờ và KHÔNG BẤM ĐƯỢC NÚT NÀO. Ảnh chụp trông "hơi tối" chứ
  // không vỡ, và không có exception nào cả. Kiểm bằng cách hỏi thẳng trình
  // duyệt: bấm vào giữa màn hình thì trúng phần tử nào?
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
