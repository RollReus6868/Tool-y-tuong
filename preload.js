// Cầu nối giữa tiến trình chính và giao diện. contextIsolation bật, nên giao
// diện chỉ thấy đúng những hàm liệt kê ở đây — không thấy require, không thấy fs.

const { contextBridge, ipcRenderer } = require('electron')

const goi = (kenh, thamSo) => ipcRenderer.invoke(kenh, thamSo)

contextBridge.exposeInMainWorld('api', {
  // Cài đặt
  docCaiDat: () => goi('caidat:doc'),
  ghiCaiDat: (caiDat) => goi('caidat:ghi', caiDat),

  // Ý tưởng
  ghepTuKhoa: (chuNhap, soLuong) => goi('tukhoa:ghep', { chuNhap, soLuong }),
  uocQuota: (thamSo) => goi('quota:uoc', thamSo),
  timYTuong: (tuKhoa, ghiDe) => goi('ytuong:tim', { tuKhoa, ghiDe }),
  xuatExcel: (dong, tuKhoa) => goi('xuat:excel', { dong, tuKhoa }),

  // Video đã chọn + thumbnail
  docVideoDaChon: () => goi('chon:doc'),
  ghiVideoDaChon: (ds) => goi('chon:ghi', { ds }),
  taiThumbnail: (videos, duAnMa) => goi('thumb:tai', { videos, duAnMa }),

  // Đề xuất video
  chayRadar: (thamSo) => goi('dexuat:radar', thamSo),
  layVideoHot: (thamSo) => goi('dexuat:hot', thamSo),

  // Kênh theo dõi
  themKenh: (dinhDanh) => goi('kenh:them', { dinhDanh }),
  xoaKenh: (kenhId) => goi('kenh:xoa', { kenhId }),
  quetKenh: () => goi('kenh:quet'),
  thinhHanh: () => goi('kenh:thinh-hanh'),

  // yt-dlp + lời thoại
  trangThaiYtDlp: () => goi('ytdlp:trang-thai'),
  taiYtDlp: () => goi('ytdlp:tai'),
  layLoiThoai: (chuNhap, duAnMa, taiKhoanId) => goi('loithoai:lay', { chuNhap, duAnMa, taiKhoanId }),
  layLoiThoaiMotVideo: (link, taiKhoanId) => goi('loithoai:mot-video', { link, taiKhoanId }),
  luuTep: (chu, tenGoiY) => goi('tep:luu', { chu, tenGoiY }),

  // Dự án
  danhSachDuAn: () => goi('duan:danh-sach'),
  taoDuAn: (ten) => goi('duan:tao', { ten }),
  xoaDuAn: (ma) => goi('duan:xoa', { ma }),
  docDuAn: (ma) => goi('duan:doc', { ma }),
  moThuMucDuAn: (ma) => goi('duan:mo-thu-muc', { ma }),

  // Kho skill
  themSkill: () => goi('skill:them'),
  xoaSkill: (id) => goi('skill:xoa', { id }),

  // Kịch bản
  promptDanY: (duAnMa, skillId, yeuCau) => goi('kichban:prompt-dan-y', { duAnMa, skillId, yeuCau }),
  luuDanY: (duAnMa, chu) => goi('kichban:luu-dan-y', { duAnMa, chu }),
  promptPhan: (duAnMa, phanSo, skillId, yeuCau) => goi('kichban:prompt-phan', { duAnMa, phanSo, skillId, yeuCau }),
  luuPhan: (duAnMa, phanSo, chu) => goi('kichban:luu-phan', { duAnMa, phanSo, chu }),
  gopKichBan: (duAnMa) => goi('kichban:gop', { duAnMa }),
  luuKichBanTrucTiep: (duAnMa, chu) => goi('kichban:luu-truc-tiep', { duAnMa, chu }),

  // Mở tệp từ máy — dùng chung cho Lời thoại, Kiểm duyệt và Prompt ảnh
  moTep: (tieuDe) => goi('tep:doc', { tieuDe }),

  // Kiểm duyệt
  kiemDuyet: (chu, banGoc, duAnMa) => goi('kiemduyet:chay', { chu, banGoc, duAnMa }),
  xuatBaoCao: (html) => goi('kiemduyet:xuat-bao-cao', { html }),

  // Prompt ảnh
  catCanh: (chu, duAnMa, gopCanh) => goi('promptanh:cat-canh', { chu, duAnMa, gopCanh }),
  promptMoTa: (canh, loThu, moiLo, kieu) => goi('promptanh:prompt-mo-ta', { canh, loThu, moiLo, kieu }),
  docMoTa: (chu) => goi('promptanh:doc-mo-ta', { chu }),
  taoPromptAnh: (canh, moTaTheoCanh, promptThang) =>
    goi('promptanh:tao', { canh, moTaTheoCanh, promptThang }),
  xuatPromptAnh: (canh, cacPrompt, duAnMa) => goi('promptanh:xuat', { canh, cacPrompt, duAnMa }),
  ghiKho: (loai, danhSach) => goi('kho:ghi', { loai, danhSach }),

  // Tài khoản + trình duyệt trong app
  themTaiKhoan: (ten) => goi('taikhoan:them', { ten }),
  xoaTaiKhoan: (id) => goi('taikhoan:xoa', { id }),
  moTab: (taiKhoanId, url) => goi('duyet:mo-tab', { taiKhoanId, url }),
  chonTab: (tabId) => goi('duyet:chon-tab', { tabId }),
  moNhanhTrongApp: (url) => goi('duyet:mo-nhanh', { url }),
  dongTab: (tabId) => goi('duyet:dong-tab', { tabId }),
  dieuHuong: (tabId, url) => goi('duyet:dieu-huong', { tabId, url }),
  datKhungDuyet: (khung) => goi('duyet:khung', khung),
  hienDuyet: () => goi('duyet:hien'),
  anDuyet: () => goi('duyet:an'),
  trangThaiDuyet: () => goi('duyet:trang-thai'),

  // Tiện ích
  chep: (chu) => goi('chep', { chu }),
  docNhatKy: () => goi('nhatky:doc'),
  moNgoai: (url) => goi('mo-ngoai', url),
  moThuMuc: (duongDan) => goi('mo-thu-muc', duongDan),
  kiemCapNhat: () => goi('capnhat:kiem-tra'),
  khaNangCapNhat: () => goi('capnhat:kha-nang'),
  taiBanMoi: () => goi('capnhat:tai'),
  caiBanMoi: () => goi('capnhat:cai'),

  // Sự kiện đẩy từ tiến trình chính
  nhanTienDo: (ham) => ipcRenderer.on('tien-do', (_su, duLieu) => ham(duLieu)),
  nhanDuyetThayDoi: (ham) => ipcRenderer.on('duyet-thay-doi', (_su, duLieu) => ham(duLieu)),
  nhanCuaSoDoiCo: (ham) => ipcRenderer.on('cua-so-doi-co', () => ham()),
  nhanCapNhat: (ham) => ipcRenderer.on('cap-nhat', (_su, duLieu) => ham(duLieu))
})
