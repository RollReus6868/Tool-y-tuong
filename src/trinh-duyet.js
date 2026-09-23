// Trình duyệt ngay trong app, mỗi tài khoản YouTube một phiên riêng biệt.
//
// BẤT BIẾN CỦA CẢ MÔ-ĐUN: mọi thứ theo TỪNG TÀI KHOẢN, không có biến toàn cục
// nào. Mỗi tài khoản là một `session.fromPartition('persist:yt-<id>')` — cookie
// tách biệt hoàn toàn, đăng nhập tài khoản A không ảnh hưởng tài khoản B.
//
// Thêm tính năng mới vào đây thì luôn tự hỏi: ba tab của hai tài khoản mở cùng
// lúc thì cái này có lẫn vào nhau không?
//
// RANH GIỚI KHÔNG BAO GIỜ VƯỢT: app không nhận, không nhập, không lưu mật khẩu.
// Người dùng TỰ đăng nhập trong cửa sổ, y như đăng nhập trên trình duyệt thường.

const path = require('path')

// Hàm thuần — kiểm thử tầng 1 gọi thẳng.
function tenPhanVung(idTaiKhoan) {
  const an = String(idTaiKhoan || '').replace(/[^A-Za-z0-9_-]/g, '')
  return `persist:yt-${an || 'mac-dinh'}`
}

function taoIdTaiKhoan(bayGio = Date.now(), ngauNhien = Math.random()) {
  return 'tk' + bayGio.toString(36) + Math.floor(ngauNhien * 1e4).toString(36)
}

// Chỉ cho mở các trang liên quan tới công việc. Không phải để chặn người dùng,
// mà để một cú bấm nhầm vào quảng cáo trong trang không kéo cả phiên đăng nhập
// sang một trang lạ.
function duocPhepMo(url) {
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol)) return false
    return /(^|\.)(youtube\.com|youtu\.be|google\.com|googleusercontent\.com|gstatic\.com|ggpht\.com|claude\.ai|anthropic\.com)$/i
      .test(u.hostname)
  } catch (_) {
    return false
  }
}

// Script tiêm vào trang để lấy dữ liệu cho radar. Viết theo đúng các luật đã
// trả giá với executeJavaScript: hàm tự gọi, KHÔNG arrow, KHÔNG 'use strict',
// và trả về CHUỖI JSON — trả thẳng đối tượng lồng sâu của YouTube là có lúc
// Electron không nhân bản được, lời gọi ném lỗi mà không nói vì sao.
//
// Trả về cả `idDom` (các link /watch?v= đang hiện trên trang) làm đường dự
// phòng: nếu YouTube đổi cấu trúc ytInitialData thì vẫn còn danh sách mã video.
function scriptDocTrang(loai) {
  const l = loai === 'xem' ? 'xem' : (loai === 'trangChu' ? 'trangChu' : 'tim')
  return `(function () {
  var d = window.ytInitialData;
  var loai = '${l}';
  var khoi = null;
  if (d) {
    if (loai === 'xem') {
      khoi = (d.contents && d.contents.twoColumnWatchNextResults &&
              d.contents.twoColumnWatchNextResults.secondaryResults) || null;
    } else {
      khoi = d.contents || d;
    }
  }
  var chon = loai === 'xem' ? '#secondary a[href*="/watch?v="]' : 'a#thumbnail[href*="/watch?v="], a[href*="/watch?v="]';
  var cac = document.querySelectorAll(chon);
  var idDom = [];
  for (var i = 0; i < cac.length && idDom.length < 80; i++) {
    var m = /[?&]v=([A-Za-z0-9_-]{11})/.exec(cac[i].getAttribute('href') || '');
    if (m && idDom.indexOf(m[1]) < 0) idDom.push(m[1]);
  }
  return JSON.stringify({ coDuLieu: !!d, url: location.href, khoi: khoi, idDom: idDom });
})()`
}

function taoQuanLy({ electron, cuaSo, nhatKy = { tin() {}, loi() {} }, baoSuKien = () => {} }) {
  const { WebContentsView, session, BrowserWindow } = electron

  // Mọi trạng thái nằm trong hai bảng này, khoá theo id — không có biến rời rạc.
  const tab = new Map()          // tabId -> { view, taiKhoanId, url, tieuDe }
  let tabDangHien = null
  let khungHienTai = { x: 0, y: 0, width: 0, height: 0 }
  let dangHien = false

  function phienCuaTaiKhoan(taiKhoanId) {
    return session.fromPartition(tenPhanVung(taiKhoanId))
  }

  function bao() {
    baoSuKien({
      tab: [...tab.entries()].map(([id, t]) => ({
        id,
        taiKhoanId: t.taiKhoanId,
        url: t.url,
        tieuDe: t.tieuDe,
        dangHien: id === tabDangHien
      })),
      tabDangHien,
      dangHien
    })
  }

  function datKhung(khung) {
    khungHienTai = khung
    const t = tab.get(tabDangHien)
    if (t && dangHien) t.view.setBounds(khung)
  }

  function an() {
    dangHien = false
    for (const t of tab.values()) t.view.setVisible(false)
    bao()
  }

  function hien() {
    dangHien = true
    for (const [id, t] of tab) {
      const la = id === tabDangHien
      t.view.setVisible(la)
      if (la) t.view.setBounds(khungHienTai)
    }
    bao()
  }

  function moTab({ taiKhoanId, url = 'https://www.youtube.com' }) {
    const id = 'tab' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36)
    const view = new WebContentsView({
      webPreferences: {
        session: phienCuaTaiKhoan(taiKhoanId),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    cuaSo.contentView.addChildView(view)
    view.setBounds(khungHienTai)
    view.setVisible(false)

    const muc = { view, taiKhoanId, url, tieuDe: 'Đang tải…' }
    tab.set(id, muc)

    const wc = view.webContents

    // YouTube là SPA: sau khi đăng nhập nó đổi màn bằng pushState, không bắn
    // lại did-finish-load. Phải nghe thêm did-navigate-in-page, nếu không
    // thanh địa chỉ đứng yên ở trang đăng nhập trong khi trang đã đi tiếp.
    const capNhat = () => {
      muc.url = wc.getURL()
      muc.tieuDe = wc.getTitle() || muc.url
      bao()
    }
    wc.on('did-finish-load', capNhat)
    wc.on('did-navigate', capNhat)
    wc.on('did-navigate-in-page', capNhat)
    wc.on('page-title-updated', capNhat)

    wc.setWindowOpenHandler(({ url: u }) => {
      // Mở trong tab mới của chính app, giữ nguyên phiên đăng nhập, thay vì
      // ném ra trình duyệt ngoài (ở đó là tài khoản khác).
      if (duocPhepMo(u)) moTab({ taiKhoanId, url: u })
      return { action: 'deny' }
    })

    wc.loadURL(url).catch((loi) => nhatKy.loi(`Tab ${id} không tải được ${url}: ${loi.message}`))
    chonTab(id)
    return id
  }

  function chonTab(id) {
    if (!tab.has(id)) return false
    tabDangHien = id
    if (dangHien) hien()
    else bao()
    return true
  }

  function dongTab(id) {
    const t = tab.get(id)
    if (!t) return false
    try {
      cuaSo.contentView.removeChildView(t.view)
      t.view.webContents.close()
    } catch (loi) {
      nhatKy.loi(`Đóng tab ${id} lỗi: ${loi.message}`)
    }
    tab.delete(id)
    if (tabDangHien === id) {
      tabDangHien = tab.size ? [...tab.keys()][0] : null
      if (dangHien) hien()
    }
    bao()
    return true
  }

  function dieuHuong(id, url) {
    const t = tab.get(id)
    if (!t) return false
    if (!duocPhepMo(url)) return false
    t.view.webContents.loadURL(url)
    return true
  }

  // Đóng mọi tab của một tài khoản — gọi khi người dùng xoá tài khoản đó.
  function dongTheoTaiKhoan(taiKhoanId) {
    for (const [id, t] of [...tab]) {
      if (t.taiKhoanId === taiKhoanId) dongTab(id)
    }
  }

  // Cookie của một tài khoản, để yt-dlp dùng khi YouTube đòi đăng nhập.
  async function layCookie(taiKhoanId) {
    const phien = phienCuaTaiKhoan(taiKhoanId)
    const c1 = await phien.cookies.get({ domain: '.youtube.com' })
    const c2 = await phien.cookies.get({ domain: '.google.com' })
    return [...c1, ...c2]
  }

  // Trình đọc ẨN cho Radar đề xuất: một cửa sổ không hiện, dùng ĐÚNG phiên
  // của tài khoản đã chọn (đề xuất của YouTube phụ thuộc lịch sử xem của tài
  // khoản đó). Không chọn tài khoản thì dùng phiên khách riêng — không bao giờ
  // mượn phiên của tài khoản khác.
  //
  // Tắt tiếng: mở trang xem là video tự phát, không tắt thì loa máy người
  // dùng tự nhiên kêu mà không thấy cửa sổ nào.
  function taoTrinhDoc(taiKhoanId) {
    const phien = phienCuaTaiKhoan(taiKhoanId || 'khach-radar')
    const win = new BrowserWindow({
      show: false,
      width: 1366,
      height: 900,
      webPreferences: {
        session: phien,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false
      }
    })
    const wc = win.webContents
    wc.setAudioMuted(true)
    wc.setWindowOpenHandler(() => ({ action: 'deny' }))

    // Đọc một trang. kiemDu(ketQua) → true khi dữ liệu đã đủ dùng; chưa đủ thì
    // đợi thêm (cột đề xuất có lúc vẽ chậm hơn phần còn lại của trang).
    async function doc(url, { loai = 'tim', kiemDu = () => true, thoiCho = 25000 } = {}) {
      if (win.isDestroyed()) throw new Error('Trình đọc đã đóng')
      const hanChot = Date.now() + thoiCho
      try {
        await Promise.race([
          wc.loadURL(url),
          new Promise((_, loi) => setTimeout(() => loi(new Error('quá thời gian tải trang')), thoiCho))
        ])
      } catch (e) {
        // loadURL ném ERR_ABORTED khi YouTube tự chuyển hướng trong trang —
        // không phải lỗi thật, trang vẫn đọc được. Lỗi khác thì báo lên.
        if (!/ERR_ABORTED|\(-3\)/.test(String(e.message))) throw e
      }
      let cuoi = null
      while (Date.now() < hanChot) {
        try {
          const chu = await wc.executeJavaScript(scriptDocTrang(loai))
          cuoi = JSON.parse(chu)
          if (cuoi.coDuLieu && kiemDu(cuoi)) return cuoi
        } catch (e) {
          nhatKy.canhBao(`Radar: đọc trang chưa được (${e.message}), thử lại…`)
        }
        await new Promise((r) => setTimeout(r, 800))
      }
      return cuoi || { coDuLieu: false, url: wc.getURL(), khoi: null, idDom: [] }
    }

    function dong() {
      try { if (!win.isDestroyed()) win.destroy() } catch (_) {}
    }

    return { doc, dong }
  }

  async function xoaPhien(taiKhoanId) {
    dongTheoTaiKhoan(taiKhoanId)
    const phien = phienCuaTaiKhoan(taiKhoanId)
    await phien.clearStorageData()
  }

  return {
    moTab,
    chonTab,
    dongTab,
    dieuHuong,
    dongTheoTaiKhoan,
    datKhung,
    an,
    hien,
    layCookie,
    xoaPhien,
    taoTrinhDoc,
    soTab: () => tab.size,
    dangHienKhong: () => dangHien,
    trangThai: () => ({
      tab: [...tab.entries()].map(([id, t]) => ({
        id, taiKhoanId: t.taiKhoanId, url: t.url, tieuDe: t.tieuDe, dangHien: id === tabDangHien
      })),
      tabDangHien,
      dangHien
    })
  }
}

module.exports = { tenPhanVung, taoIdTaiKhoan, duocPhepMo, taoQuanLy, scriptDocTrang }
