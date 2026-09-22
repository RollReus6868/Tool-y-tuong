// Cầu nối giữa tiến trình chính và giao diện. contextIsolation bật, nên giao
// diện chỉ thấy đúng những hàm liệt kê ở đây — không thấy require, không thấy fs.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  docCaiDat: () => ipcRenderer.invoke('caidat:doc'),
  ghiCaiDat: (caiDat) => ipcRenderer.invoke('caidat:ghi', caiDat),

  ghepTuKhoa: (chuNhap, soLuong) => ipcRenderer.invoke('tukhoa:ghep', { chuNhap, soLuong }),
  uocQuota: (thamSo) => ipcRenderer.invoke('quota:uoc', thamSo),
  timYTuong: (tuKhoa) => ipcRenderer.invoke('ytuong:tim', { tuKhoa }),

  xuatExcel: (dong, tuKhoa) => ipcRenderer.invoke('xuat:excel', { dong, tuKhoa }),
  docNhatKy: () => ipcRenderer.invoke('nhatky:doc'),
  moNgoai: (url) => ipcRenderer.invoke('mo-ngoai', url),
  moThuMuc: (duongDan) => ipcRenderer.invoke('mo-thu-muc', duongDan),
  kiemCapNhat: () => ipcRenderer.invoke('capnhat:kiem-tra'),

  nhanTienDo: (ham) => {
    ipcRenderer.on('tien-do', (_su, duLieu) => ham(duLieu))
  }
})
