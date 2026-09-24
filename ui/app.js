// Giao diện Tool Ý Tưởng. Chạy trong renderer, chỉ nói chuyện với tiến trình
// chính qua window.api (khai báo ở preload.js).

const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]

let caiDatHienTai = null
let khoaApi = []
let deXuat = []
let ungVienTatCa = []
let ketQua = []
let locHienTai = 'tat-ca'

let bangKenhHienTai = []
let locKenh = 'tat-ca'
let duAnHienTai = ''
let danhSachDuAnHienTai = []
let danYHienTai = []
let cacPhanHienTai = []

let canhHienTai = []
let moTaTheoCanh = {}
let promptThangHienTai = {}
let cacPromptHienTai = []
let thuMucDung = ''            // thư mục dựng của video (= INPUT của CapCut Draft Studio)
let keHoachFt = null           // kế hoạch footage: nhãn FOOTAGE/AI, từ khóa, tệp đã tải
let locFt = 'footage'
let baoCaoHienTai = null

let videoDaChon = []          // danh sách "Video đã chọn" — lưu ở tiến trình chính
let bangRadar = []
let locRadar = 'tat-ca'
let bangHot = []
let locHot = 'tat-ca'
const boTickTaiMan = {}       // màn sản xuất → Set mã video anh BỎ tick trong khối Video đã chọn

// ---------------------------------------------------------------------------
// Hộp thoại tự dựng — Electron không có window.prompt/confirm dùng được.
// ---------------------------------------------------------------------------
function hoiCo(chu, tenNutOk = 'Đồng ý') {
  return new Promise((xong) => {
    $('#hop-thoai-chu').textContent = chu
    const nut = $('#hop-thoai-nut')
    nut.innerHTML = ''
    const huy = document.createElement('button')
    huy.className = 'nut nut-phu'
    huy.textContent = 'Huỷ'
    huy.onclick = () => { $('#man-che').hidden = true; xong(false) }
    const ok = document.createElement('button')
    ok.className = 'nut nut-chinh'
    ok.textContent = tenNutOk
    ok.onclick = () => { $('#man-che').hidden = true; xong(true) }
    nut.append(huy, ok)
    $('#man-che').hidden = false
    ok.focus()
  })
}

function baoTin(chu) {
  return new Promise((xong) => {
    $('#hop-thoai-chu').textContent = chu
    const nut = $('#hop-thoai-nut')
    nut.innerHTML = ''
    const ok = document.createElement('button')
    ok.className = 'nut nut-chinh'
    ok.textContent = 'Đã hiểu'
    ok.onclick = () => { $('#man-che').hidden = true; xong(true) }
    nut.append(ok)
    $('#man-che').hidden = false
    ok.focus()
  })
}

function thoat(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

async function chepVaBao(chu, nhan) {
  const kq = await window.api.chep(chu)
  if (nhan) {
    nhan.textContent = `Đã chép ${kq.soKyTu.toLocaleString('vi-VN')} ký tự — dán sang Claude`
    nhan.className = 'ghi-chu ghi-chu-xanh'
    setTimeout(() => { nhan.className = 'ghi-chu' }, 6000)
  }
}

// ---------------------------------------------------------------------------
// Thanh tiến độ 3 tầng
// ---------------------------------------------------------------------------
function datTienDo({ phanTram = 0, viec = '', chiTiet = '', soLoi = 0, trangThai = '' }) {
  $('#tien-do-viec').textContent = viec || 'Sẵn sàng'
  $('#tien-do-day').style.width = Math.max(0, Math.min(100, phanTram)) + '%'
  $('#tien-do-phan-tram').textContent = Math.round(phanTram) + '%'
  $('#tien-do-chi-tiet').textContent = chiTiet || ''
  $('#tien-do-loi').textContent = soLoi ? `${soLoi} lỗi` : ''
  const day = $('#tien-do-day')
  day.classList.toggle('xong', trangThai === 'xong')
  day.classList.toggle('loi', trangThai === 'loi')
}

window.api.nhanTienDo((d) => {
  datTienDo({
    phanTram: d.phanTram || 0,
    viec: d.viec || '',
    chiTiet: d.chiTiet || (d.tong ? `${d.daXong}/${d.tong}` : ''),
    soLoi: d.soLoi || 0,
    trangThai: d.trangThai || ''
  })
})

// ---------------------------------------------------------------------------
// Chuyển màn
// ---------------------------------------------------------------------------
function moMan(ten) {
  const man = $(`#man-${ten}`)
  if (!man) return false
  $$('.man').forEach((m) => m.classList.remove('hien'))
  man.classList.add('hien')
  $$('.muc').forEach((b) => b.classList.toggle('chon', b.dataset.man === ten))

  if (ten === 'nhat-ky') taiNhatKy()
  if (ten === 'footage') { veNguonFootage(); veFootage() }

  // Trình duyệt là một lớp phủ THẬT nằm đè lên cửa sổ, không phải phần tử HTML.
  // Rời màn là phải ẩn đi, nếu không nó che mất màn khác và người dùng tưởng
  // app treo.
  if (ten === 'trinh-duyet') { capNhatKhungDuyet(); window.api.hienDuyet() }
  else window.api.anDuyet()

  return true
}
window.smokeMoMan = (ten) => { if (!moMan(ten)) throw new Error('Không có màn ' + ten) }

$$('.muc').forEach((b) => { b.onclick = () => moMan(b.dataset.man) })

document.addEventListener('click', (su) => {
  const a = su.target.closest('[data-ngoai]')
  if (a) { su.preventDefault(); window.api.moNgoai(a.dataset.ngoai) }
})

// ---------------------------------------------------------------------------
// Cài đặt
// ---------------------------------------------------------------------------
async function taiCaiDat() {
  const g = await window.api.docCaiDat()
  caiDatHienTai = g.caiDat
  khoaApi = g.caiDat.khoaApi || []

  $('#hieu-phien-ban').textContent = 'v' + g.phienBan
  $('#quota-ngay').textContent = 'Ngày Pacific: ' + g.ngayQuota

  for (const o of $$('[data-khoa]')) {
    const khoa = o.dataset.khoa
    const gt = caiDatHienTai[khoa]
    if (o.type === 'checkbox') o.checked = !!gt
    else o.value = gt ?? ''
  }

  // Ô điều khiển của Radar lấy MẶC ĐỊNH từ Cài đặt. Thiếu bước này thì ô
  // "video đăng trong" hiện lựa chọn đầu tiên (1 tuần) dù cài đặt là 1 tháng —
  // người dùng tưởng đã chạy theo cài đặt mà thật ra không.
  if (!taiCaiDat.daDatRadar) {
    taiCaiDat.daDatRadar = true
    $('#o-so-hat-giong').value = caiDatHienTai.soVideoHatGiong || 8
    $('#o-radar-thoi-gian').value = caiDatHienTai.radarThoiGian || 'thang'
    $('#o-radar-trang-chu').checked = caiDatHienTai.radarDocTrangChu !== false
  }

  veDanhSachKhoa(g.quota)
  veQuotaSidebar(g.quota)
  veDanhSachKenh()
  veTaiKhoan()
  veSkill()
  veKhoNhanVat()
  capNhatUocKichBan()
  capNhatTrangThaiYtDlp(g.coYtDlp)

  $('#thong-tin-tep').innerHTML = `
    <div class="ghi-chu">Thư mục dữ liệu: <code>${thoat(g.thuMucDuLieu)}</code></div>
    <div class="ghi-chu">Nhật ký: <code>${thoat(g.duongDanNhatKy || '—')}</code></div>`
  $('#duong-dan-nhat-ky').textContent = g.duongDanNhatKy || ''
}

function veQuotaSidebar(quota) {
  if (!quota || !quota.length) {
    $('#quota-con-lai').textContent = 'chưa có khoá'
    $('#quota-con-lai').style.color = 'var(--vang)'
    return
  }
  const tong = quota.reduce((a, k) => a + k.conLai, 0)
  $('#quota-con-lai').textContent = tong.toLocaleString('vi-VN') + ' đơn vị'
  $('#quota-con-lai').style.color = tong < 600 ? 'var(--do)' : (tong < 2000 ? 'var(--vang)' : 'var(--ngoc)')
}

function veDanhSachKhoa(quota) {
  const hop = $('#danh-sach-khoa')
  hop.innerHTML = ''
  if (!khoaApi.length) {
    hop.innerHTML = '<div class="ghi-chu">Chưa có khoá nào. Thêm ở dòng dưới — miễn phí, không cần thẻ.</div>'
    return
  }
  for (const k of khoaApi) {
    const q = (quota || []).find((x) => x.id === k.id)
    const dong = document.createElement('div')
    dong.className = 'dong-khoa'
    const con = q ? q.conLai : 10000
    const mau = con < 600 ? 'var(--do)' : (con < 2000 ? 'var(--vang)' : 'var(--ngoc)')
    dong.innerHTML = `
      <span class="ten-khoa">${thoat(k.ten)}</span>
      <span class="che">${thoat(cheKhoa(k.khoa))}</span>
      <span class="con" style="color:${mau}">còn ${con.toLocaleString('vi-VN')}/10.000</span>`
    const xoa = document.createElement('button')
    xoa.className = 'nut nut-do'
    xoa.textContent = 'Xoá'
    xoa.onclick = async () => {
      if (!(await hoiCo(`Xoá khoá "${k.ten}"?`, 'Xoá'))) return
      khoaApi = khoaApi.filter((x) => x.id !== k.id)
      await luuCaiDat(true)
    }
    dong.append(xoa)
    hop.append(dong)
  }
}

function cheKhoa(k) {
  if (!k) return ''
  return k.length <= 10 ? k : k.slice(0, 6) + '…' + k.slice(-4)
}

function thuCaiDatTuGiaoDien() {
  const moi = { ...caiDatHienTai, khoaApi }
  for (const o of $$('[data-khoa]')) {
    const khoa = o.dataset.khoa
    if (o.type === 'checkbox') moi[khoa] = o.checked
    else if (o.type === 'number') moi[khoa] = Number(o.value || 0)
    else moi[khoa] = o.value
  }
  return moi
}

async function luuCaiDat(imLang = false) {
  caiDatHienTai = thuCaiDatTuGiaoDien()
  await window.api.ghiCaiDat(caiDatHienTai)
  await taiCaiDat()
  if (!imLang) {
    $('#ghi-chu-luu').textContent = 'Đã lưu ' + new Date().toLocaleTimeString('vi-VN')
    setTimeout(() => { $('#ghi-chu-luu').textContent = '' }, 4000)
  }
}

$('#nut-luu-cai-dat').onclick = () => luuCaiDat()

$('#nut-them-khoa').onclick = async () => {
  const ten = $('#nhap-ten-khoa').value.trim() || `khoá ${khoaApi.length + 1}`
  const khoa = $('#nhap-khoa').value.trim()
  if (!khoa) { await baoTin('Chưa dán khoá API vào ô bên cạnh.'); return }
  if (khoaApi.some((k) => k.khoa === khoa)) { await baoTin('Khoá này đã có trong danh sách.'); return }
  khoaApi.push({ id: 'k' + Date.now().toString(36), ten, khoa })
  $('#nhap-ten-khoa').value = ''
  $('#nhap-khoa').value = ''
  await luuCaiDat(true)
}

$('#nut-mo-thu-muc').onclick = () => window.api.moThuMuc()

$('#nut-kiem-cap-nhat').onclick = async () => {
  $('#ket-qua-cap-nhat').textContent = 'Đang kiểm tra…'
  const kq = await window.api.kiemCapNhat()
  $('#ket-qua-cap-nhat').textContent = kq.ok
    ? (kq.coBanMoi ? `Có bản mới: ${kq.phienBanMoi} (đang dùng ${kq.phienBanHienTai})` : `Đang dùng bản mới nhất (${kq.phienBanHienTai})`)
    : kq.lyDo
}

function capNhatUocKichBan() {
  const c = thuCaiDatTuGiaoDien()
  const soTu = Number(c.soTuMucTieu) || 0
  const tuPhut = Number(c.tuMoiPhut) || 150
  const tuCanh = Number(c.tuMoiCanh) || 27
  const soPhan = Number(c.soPhanKichBan) || 8
  if (!soTu) { $('#uoc-kich-ban').textContent = ''; return }
  const phut = soTu / tuPhut
  const soCanh = Math.ceil(soTu / tuCanh)
  $('#uoc-kich-ban').innerHTML = `
    ${soTu.toLocaleString('vi-VN')} từ ≈ <b>${phut.toFixed(0)} phút video</b>
    · chia ${soPhan} phần, mỗi phần ≈ ${Math.round(soTu / soPhan).toLocaleString('vi-VN')} từ
    · <b>${soCanh} cảnh</b> nếu 1 ảnh/cảnh, hoặc <b>${Math.ceil(soCanh / 2)} ảnh</b> nếu gộp 2 cảnh một ảnh.`
}
$$('[data-khoa]').forEach((o) => o.addEventListener('input', capNhatUocKichBan))

// ---------------------------------------------------------------------------
// Ghép từ khóa + tìm ý tưởng
// ---------------------------------------------------------------------------
$('#nut-ghep').onclick = async () => {
  const chu = $('#nhap-tu-khoa').value.trim()
  if (!chu) { await baoTin('Nhập ít nhất 2 từ khóa, cách nhau bằng dấu phẩy.'); return }

  $('#nut-ghep').disabled = true
  $('#ghi-chu-ghep').textContent = 'Đang hỏi gợi ý của YouTube (miễn phí, không tốn quota)…'
  datTienDo({ phanTram: 5, viec: 'Ghép từ khóa' })

  try {
    const kq = await window.api.ghepTuKhoa(chu, 5)
    deXuat = kq.chon
    ungVienTatCa = kq.tatCa
    veDeXuat()
    $('#the-de-xuat').hidden = false
    $('#ghi-chu-ghep').textContent = kq.coMang
      ? `Đã chấm ${kq.tatCa.length} ứng viên bằng gợi ý thật của YouTube.`
      : 'KHÔNG gọi được gợi ý của YouTube (mất mạng hoặc bị chặn) — điểm dưới đây chỉ là chấm cục bộ, nên tự xem lại 5 cụm trước khi tìm.'
    datTienDo({ phanTram: 100, viec: 'Ghép từ khóa xong', chiTiet: `${kq.chon.length} từ khóa`, trangThai: 'xong' })
  } catch (loi) {
    $('#ghi-chu-ghep').textContent = 'Lỗi: ' + loi.message
    datTienDo({ phanTram: 100, viec: 'Ghép từ khóa lỗi', chiTiet: loi.message, soLoi: 1, trangThai: 'loi' })
  } finally {
    $('#nut-ghep').disabled = false
  }
}

function veDeXuat() {
  const hop = $('#danh-sach-de-xuat')
  hop.innerHTML = ''
  deXuat.forEach((uv, i) => {
    const dong = document.createElement('div')
    dong.className = 'dong-de-xuat'
    const so = document.createElement('div')
    so.className = 'so'
    so.textContent = i + 1
    const o = document.createElement('input')
    o.value = uv.cum
    o.oninput = () => { deXuat[i] = { ...deXuat[i], cum: o.value } }
    const diem = document.createElement('span')
    diem.className = 'diem-nhan'
    diem.textContent = 'điểm ' + (uv.diem ?? 0)
    dong.append(so, o, diem)
    hop.append(dong)

    if (uv.viSao && uv.viSao.length) {
      const vs = document.createElement('div')
      vs.className = 'vi-sao'
      vs.textContent = uv.viSao.join(' · ')
      hop.append(vs)
    }
  })
  capNhatChiPhi()

  const bang = $('#bang-ung-vien')
  bang.innerHTML = ''
  for (const uv of ungVienTatCa.slice(0, 40)) {
    const d = document.createElement('div')
    d.className = 'dong-uv'
    d.innerHTML = `<b>${uv.diem}</b><span>${thoat(uv.cum)}</span><span class="ghi-chu">${thoat((uv.viSao || []).join(' · '))}</span>`
    bang.append(d)
  }
}

async function capNhatChiPhi() {
  const uoc = await window.api.uocQuota({
    soTuKhoa: deXuat.length,
    soVideoMoiTuKhoa: Number(caiDatHienTai.soVideoMoiTuKhoa) || 25,
    tinhVuotTrungViKenh: !!caiDatHienTai.tinhVuotTrungViKenh
  })
  $('#chi-phi-uoc').textContent = uoc.toLocaleString('vi-VN')
  const g = await window.api.docCaiDat()
  const tong = (g.quota || []).reduce((a, k) => a + k.conLai, 0)
  $('#chi-phi-con-lai').textContent = g.quota && g.quota.length
    ? `Còn ${tong.toLocaleString('vi-VN')} đơn vị hôm nay (≈ ${Math.floor(tong / Math.max(1, uoc))} lượt nữa)`
    : 'Chưa có khoá API — vào Cài đặt để thêm (miễn phí).'
}

$('#nut-xem-tat-ca').onclick = () => { $('#chi-tiet-ung-vien').open = true }

$('#nut-tim').onclick = async () => {
  const tuKhoa = deXuat.map((d) => d.cum.trim()).filter(Boolean)
  if (!tuKhoa.length) { await baoTin('Chưa có từ khóa nào.'); return }

  const uoc = $('#chi-phi-uoc').textContent
  if (!(await hoiCo(`Tìm ${tuKhoa.length} từ khóa, tốn khoảng ${uoc} đơn vị quota. Tiếp tục?`, 'Tìm video'))) return

  $('#nut-tim').disabled = true
  datTienDo({ phanTram: 2, viec: 'Bắt đầu tìm' })

  try {
    const kq = await window.api.timYTuong(tuKhoa)
    if (!kq.ok) {
      datTienDo({ phanTram: 100, viec: 'Không tìm được', chiTiet: kq.loi, soLoi: 1, trangThai: 'loi' })
      await baoTin(kq.loi)
      return
    }
    ketQua = kq.dong
    locHienTai = 'tat-ca'
    $$('#man-y-tuong .loc-nhanh .chip').forEach((c) => c.classList.toggle('chip-chon', c.dataset.loc === 'tat-ca'))
    veBang()
    $('#the-ket-qua').hidden = false
    $('#tom-tat-ket-qua').textContent =
      `${kq.dong.length} video · ${kq.soNoView} nổ view · dùng ${kq.quotaDaDung} đơn vị · khoá "${kq.tenKhoa}" còn ${kq.conLai.toLocaleString('vi-VN')}`
    datTienDo({
      phanTram: 100, viec: 'Tìm xong',
      chiTiet: `${kq.dong.length} video, ${kq.soNoView} nổ view`,
      soLoi: (kq.loiTuKhoa || []).length, trangThai: 'xong'
    })
    await taiCaiDat()
    $('#the-ket-qua').scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (loi) {
    datTienDo({ phanTram: 100, viec: 'Tìm lỗi', chiTiet: loi.message, soLoi: 1, trangThai: 'loi' })
    await baoTin('Lỗi: ' + loi.message)
  } finally {
    $('#nut-tim').disabled = false
  }
}

const LOP_NHAN = {
  'NỔ VIEW': 'nhan-no-view',
  'TỐT': 'nhan-tot',
  'KHÁ': 'nhan-kha',
  'BÌNH THƯỜNG': 'nhan-thuong'
}

function soGon(n) {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'tr'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'k'
  return String(n)
}

function phutGiay(giay) {
  if (!giay) return '—'
  const p = Math.floor(giay / 60)
  const g = giay % 60
  return `${p}:${String(g).padStart(2, '0')}`
}

function soGioTruoc(ngay) {
  const t = new Date(ngay).getTime()
  if (!Number.isFinite(t)) return '—'
  const gio = Math.round((Date.now() - t) / 3600000)
  return gio < 48 ? `${gio} giờ` : `${Math.round(gio / 24)} ngày`
}

function locDongYTuong() {
  if (locHienTai === 'tat-ca') return ketQua
  if (locHienTai === 'TỐT') return ketQua.filter((d) => d.nhan === 'TỐT' || d.nhan === 'NỔ VIEW')
  if (locHienTai === 'VUA-NHO') return ketQua.filter((d) => d.coKenh === 'vuaNho')
  return ketQua.filter((d) => d.nhan === locHienTai)
}

function veBang() {
  veBangVideo($('#bang-ket-qua'), locDongYTuong(),
    ['tick', 'thumb', 'nhan', 'diem', 'tieuDe', 'kenh', 'views', 'vph', 'tyLeSub', 'vuotTV', 'sub', 'dai', 'dang'],
    { nguon: 'Ý tưởng' })
}

$$('.loc-nhanh .chip').forEach((c) => {
  if (c.classList.contains('chip-kenh') || c.classList.contains('chip-radar') || c.classList.contains('chip-hot')) return
  c.onclick = () => {
    locHienTai = c.dataset.loc
    $$('#man-y-tuong .loc-nhanh .chip').forEach((x) => x.classList.toggle('chip-chon', x === c))
    veBang()
  }
})

$('#nut-xuat-excel').onclick = async () => {
  if (!ketQua.length) { await baoTin('Chưa có kết quả để xuất.'); return }
  datTienDo({ phanTram: 40, viec: 'Đang xuất Excel' })
  const kq = await window.api.xuatExcel(ketQua, deXuat.map((d) => d.cum))
  if (kq.huy) { datTienDo({ phanTram: 0, viec: 'Đã huỷ xuất Excel' }); return }
  datTienDo({ phanTram: 100, viec: 'Xuất Excel xong', chiTiet: kq.duongDan, trangThai: 'xong' })
}

// ---------------------------------------------------------------------------
// Kênh theo dõi
// ---------------------------------------------------------------------------
function veDanhSachKenh() {
  const hop = $('#danh-sach-kenh')
  const ds = (caiDatHienTai && caiDatHienTai.kenhTheoDoi) || []
  hop.innerHTML = ''
  if (!ds.length) {
    hop.innerHTML = '<div class="ghi-chu">Chưa theo dõi kênh nào.</div>'
    $('#uoc-quota-kenh').textContent = ''
    return
  }
  for (const k of ds) {
    const dong = document.createElement('div')
    dong.className = 'dong-khoa'
    dong.innerHTML = `<span class="ten-khoa">${thoat(k.ten)}</span>
      <span class="che">${thoat(k.kenhId)}</span>
      <span class="con">${soGon(k.subKenh)} sub</span>`
    const xoa = document.createElement('button')
    xoa.className = 'nut nut-do'
    xoa.textContent = 'Bỏ theo dõi'
    xoa.onclick = async () => {
      if (!(await hoiCo(`Bỏ theo dõi "${k.ten}"?`, 'Bỏ theo dõi'))) return
      await window.api.xoaKenh(k.kenhId)
      await taiCaiDat()
    }
    dong.append(xoa)
    hop.append(dong)
  }
  $('#uoc-quota-kenh').textContent = `${ds.length} kênh × 3 đơn vị = ${ds.length * 3} đơn vị quota mỗi lần quét`
}

$('#nut-them-kenh').onclick = async () => {
  const dd = $('#nhap-kenh').value.trim()
  if (!dd) { await baoTin('Dán link kênh, @handle hoặc kenhId vào ô.'); return }
  $('#nut-them-kenh').disabled = true
  $('#ghi-chu-kenh').textContent = 'Đang tra kênh (1 đơn vị quota)…'
  try {
    const kq = await window.api.themKenh(dd)
    if (!kq.ok) { $('#ghi-chu-kenh').textContent = kq.loi; return }
    $('#nhap-kenh').value = ''
    $('#ghi-chu-kenh').textContent = `Đã thêm "${kq.kenh.tenKenh}" — ${soGon(kq.kenh.subKenh)} sub, ${kq.kenh.tongVideo} video`
    await taiCaiDat()
  } finally {
    $('#nut-them-kenh').disabled = false
  }
}

$('#nut-quet-kenh').onclick = async () => {
  const ds = (caiDatHienTai && caiDatHienTai.kenhTheoDoi) || []
  if (!ds.length) { await baoTin('Chưa theo dõi kênh nào.'); return }
  if (!(await hoiCo(`Quét ${ds.length} kênh, tốn khoảng ${ds.length * 3} đơn vị quota. Tiếp tục?`, 'Quét'))) return

  $('#nut-quet-kenh').disabled = true
  try {
    const kq = await window.api.quetKenh()
    if (!kq.ok) { await baoTin(kq.loi); return }
    bangKenhHienTai = kq.bangGop || []
    veBangKenh()
    $('#the-ket-qua-kenh').hidden = false
    const soNo = bangKenhHienTai.filter((v) => v.nhan === 'NỔ VIEW').length
    $('#tom-tat-kenh').textContent =
      `${kq.ketQua.length} kênh · ${bangKenhHienTai.length} video · ${soNo} nổ view · dùng ${kq.quotaDaDung} đơn vị` +
      (kq.hetQuota ? ' · DỪNG VÌ HẾT QUOTA' : '')
    await taiCaiDat()
  } finally {
    $('#nut-quet-kenh').disabled = false
  }
}

$('#nut-thinh-hanh').onclick = async () => {
  $('#nut-thinh-hanh').disabled = true
  try {
    const kq = await window.api.thinhHanh()
    if (!kq.ok) { await baoTin(kq.loi); return }
    bangKenhHienTai = kq.dong.map((d) => ({ ...d, nhan: 'BÌNH THƯỜNG', vuotTrungVi: 0 }))
    veBangKenh()
    $('#the-ket-qua-kenh').hidden = false
    $('#tom-tat-kenh').textContent = `Bảng Thịnh hành — ${kq.dong.length} video (1 đơn vị quota)`
    await taiCaiDat()
  } finally {
    $('#nut-thinh-hanh').disabled = false
  }
}

$$('.chip-kenh').forEach((c) => {
  c.onclick = () => {
    locKenh = c.dataset.loc
    $$('.chip-kenh').forEach((x) => x.classList.toggle('chip-chon', x === c))
    veBangKenh()
  }
})

function veBangKenh() {
  const dong = locKenh === 'tat-ca'
    ? bangKenhHienTai
    : bangKenhHienTai.filter((d) => d.nhan === locKenh)
  veBangVideo($('#bang-kenh'), dong,
    ['tick', 'thumb', 'nhan', 'vuotTV', 'tieuDe', 'kenh', 'views', 'tang', 'dai', 'dang'],
    { nguon: 'Kênh theo dõi', rong: 'Chưa có dòng nào.' })
}

// ---------------------------------------------------------------------------
// Dự án (dùng chung cho 4 màn sản xuất)
// ---------------------------------------------------------------------------
async function taiDuAn() {
  danhSachDuAnHienTai = await window.api.danhSachDuAn()
  for (const sel of $$('.chon-du-an')) {
    sel.innerHTML = '<option value="">— chưa chọn dự án —</option>' +
      danhSachDuAnHienTai.map((d) =>
        `<option value="${thoat(d.ma)}">${thoat(d.ten)} · ${d.soTuLoiThoai || 0} từ tư liệu</option>`).join('')
    sel.value = duAnHienTai
    sel.onchange = async () => { duAnHienTai = sel.value; await chonDuAn() }
  }
  await chonDuAn()
}

async function chonDuAn() {
  for (const sel of $$('.chon-du-an')) sel.value = duAnHienTai
  const noi = [$('#thong-tin-du-an'), ...$$('.thong-tin-du-an')].filter(Boolean)

  if (!duAnHienTai) {
    for (const n of noi) n.textContent = 'Chưa chọn dự án. Tạo một dự án cho mỗi video sẽ làm.'
    danYHienTai = []
    cacPhanHienTai = []
    veDanhSachPhan()
    return
  }

  const d = await window.api.docDuAn(duAnHienTai)
  danYHienTai = (d.danY && d.danY.phan) || []
  cacPhanHienTai = d.cacPhan || []

  const h = d.hoSo || {}
  const chu = `${h.ten || duAnHienTai} · tư liệu ${(h.soTuLoiThoai || 0).toLocaleString('vi-VN')} từ` +
    ` · dàn ý ${danYHienTai.length} phần · đã viết ${cacPhanHienTai.filter(Boolean).length} phần` +
    ` · ${(d.banKichBan || []).length} bản kịch bản`
  for (const n of noi) n.textContent = chu

  if (d.danY && d.danY.chuTho && !$('#o-dan-y').value) $('#o-dan-y').value = d.danY.chuTho
  veDanhSachPhan()
}

$('#nut-tao-du-an').onclick = async () => {
  const ten = $('#nhap-ten-du-an').value.trim()
  if (!ten) { await baoTin('Đặt tên cho dự án đã.'); return }
  const d = await window.api.taoDuAn(ten)
  $('#nhap-ten-du-an').value = ''
  duAnHienTai = d.ma
  await taiDuAn()
}

$('#nut-mo-thu-muc-du-an').onclick = async () => {
  if (!duAnHienTai) { await baoTin('Chưa chọn dự án.'); return }
  await window.api.moThuMucDuAn(duAnHienTai)
}

// ---------------------------------------------------------------------------
// Lời thoại
// ---------------------------------------------------------------------------
function capNhatTrangThaiYtDlp(daCo) {
  $('#trang-thai-ytdlp').textContent = daCo
    ? 'yt-dlp đã có — bấm lại nút này để cập nhật bản mới nhất.'
    : 'CHƯA CÓ yt-dlp. Bấm nút bên trái để tải (khoảng 17MB, chỉ một lần).'
  $('#trang-thai-ytdlp').className = daCo ? 'ghi-chu ghi-chu-xanh' : 'ghi-chu ghi-chu-vang'
}

$('#nut-tai-ytdlp').onclick = async () => {
  $('#nut-tai-ytdlp').disabled = true
  try {
    const kq = await window.api.taiYtDlp()
    if (!kq.ok) { await baoTin('Tải yt-dlp thất bại: ' + kq.loi); return }
    await taiCaiDat()
  } finally {
    $('#nut-tai-ytdlp').disabled = false
  }
}

$('#nut-lay-loi-thoai').onclick = async () => {
  const chu = $('#nhap-link-video').value.trim()
  if (!chu) { await baoTin('Dán ít nhất một link video YouTube.'); return }
  if (!duAnHienTai) {
    if (!(await hoiCo('Chưa chọn dự án — lời thoại sẽ không được lưu vào đâu cả. Vẫn lấy?', 'Vẫn lấy'))) return
  }

  $('#nut-lay-loi-thoai').disabled = true
  try {
    const tk = $('#chon-tai-khoan-cookie').value
    const kq = await window.api.layLoiThoai(chu, duAnHienTai, tk)
    if (!kq.ok && kq.loi) { await baoTin(kq.loi); return }
    veLoiThoai(kq)
    $('#the-ket-qua-loi-thoai').hidden = false
    await taiDuAn()
  } finally {
    $('#nut-lay-loi-thoai').disabled = false
  }
}

function veLoiThoai(kq) {
  const hop = $('#danh-sach-loi-thoai')
  hop.innerHTML = ''

  for (const k of (kq.ketQua || [])) {
    const the = document.createElement('div')
    the.className = 'the-con'
    the.innerHTML = `
      <div class="hang-dau-bang">
        <b>${thoat(k.tieuDe || k.videoId)}</b>
        <span class="ghi-chu">${thoat(k.tenKenh || '')}</span>
      </div>
      <div class="ghi-chu">
        ${k.soTu.toLocaleString('vi-VN')} từ · ${phutGiay(k.thoiLuongGiay)} ·
        định dạng <b>${thoat(k.dinhDang)}</b> ·
        bỏ <b>${k.tyLeBoLap}%</b> cue lặp cuộn (${k.soCue} → ${k.soCueSauKhiBoLap})
      </div>
      <div class="xem-truoc">${thoat((k.vanBan || '').slice(0, 400))}…</div>`
    hop.append(the)
  }

  for (const l of (kq.loiVideo || [])) {
    const the = document.createElement('div')
    the.className = 'the-con the-loi'
    the.innerHTML = `<b>${thoat(l.videoId)}</b><div class="ghi-chu">${thoat(l.loi)}</div>`
    hop.append(the)
  }
}

// ---------------------------------------------------------------------------
// Kho skill
// ---------------------------------------------------------------------------
function veSkill() {
  const ds = (caiDatHienTai && caiDatHienTai.khoSkill) || []
  const sel = $('#chon-skill')
  const cu = sel.value
  sel.innerHTML = '<option value="">— không dùng skill —</option>' +
    ds.map((s) => `<option value="${thoat(s.id)}">${thoat(s.ten)} (${s.soTu} từ)</option>`).join('')
  sel.value = cu

  const hop = $('#danh-sach-skill')
  hop.innerHTML = ds.length ? '' : '<div class="ghi-chu">Chưa có skill nào. Tải tệp SKILL.md của anh lên.</div>'
  for (const s of ds) {
    const dong = document.createElement('div')
    dong.className = 'dong-khoa'
    dong.innerHTML = `<span class="ten-khoa">${thoat(s.ten)}</span><span class="con">${s.soTu} từ</span>`
    const xoa = document.createElement('button')
    xoa.className = 'nut nut-do'
    xoa.textContent = 'Xoá'
    xoa.onclick = async () => {
      if (!(await hoiCo(`Xoá skill "${s.ten}"?`, 'Xoá'))) return
      await window.api.xoaSkill(s.id)
      await taiCaiDat()
    }
    dong.append(xoa)
    hop.append(dong)
  }
}

$('#nut-them-skill').onclick = async () => {
  const kq = await window.api.themSkill()
  if (kq.huy) return
  if (!kq.ok) { await baoTin('Không đọc được tệp.'); return }
  await taiCaiDat()
}

// ---------------------------------------------------------------------------
// Kịch bản
// ---------------------------------------------------------------------------
$('#nut-prompt-dan-y').onclick = async () => {
  const yeuCau = {}
  const dung = $('#o-dung-video-tham-khao')
  const ds = dsDangTick('kich-ban')
  if (dung && dung.checked && ds.length) yeuCau.videoThamKhao = choPromptKichBan(ds)
  const kq = await window.api.promptDanY(duAnHienTai, $('#chon-skill').value, yeuCau)
  await chepVaBao(kq.prompt, $('#ghi-chu-dan-y'))
  if (yeuCau.videoThamKhao) {
    $('#ghi-chu-dan-y').textContent += ` · kèm ${yeuCau.videoThamKhao.length} video tham khảo`
  }
}

$('#nut-luu-dan-y').onclick = async () => {
  const chu = $('#o-dan-y').value.trim()
  if (!chu) { await baoTin('Chưa dán dàn ý vào ô.'); return }
  if (!duAnHienTai) { await baoTin('Chọn dự án trước đã, để dàn ý được lưu lại.'); return }
  const kq = await window.api.luuDanY(duAnHienTai, chu)
  danYHienTai = kq.phan
  $('#ket-qua-dan-y').textContent = kq.soPhan
    ? `Đọc được ${kq.soPhan} phần.`
    : 'KHÔNG đọc được phần nào — dàn ý phải có dòng dạng "PHẦN 1 | Tiêu đề | 1375".'
  $('#ket-qua-dan-y').className = kq.soPhan ? 'ghi-chu ghi-chu-xanh' : 'ghi-chu ghi-chu-vang'
  veDanhSachPhan()
}

function veDanhSachPhan() {
  const hop = $('#danh-sach-phan')
  hop.innerHTML = ''

  const soPhan = danYHienTai.length || (caiDatHienTai ? Number(caiDatHienTai.soPhanKichBan) || 8 : 8)
  let tongTu = 0

  for (let i = 1; i <= soPhan; i++) {
    const muc = danYHienTai.find((p) => p.so === i)
    const daViet = cacPhanHienTai[i - 1] || ''
    const soTu = (daViet.match(/\S+/g) || []).length
    tongTu += soTu

    const the = document.createElement('div')
    the.className = 'the-con' + (daViet ? ' the-xong' : '')
    the.innerHTML = `
      <div class="hang-dau-bang">
        <b>Phần ${i}${muc ? ' — ' + thoat(muc.tieuDe) : ''}</b>
        <span class="ghi-chu">${daViet ? soTu.toLocaleString('vi-VN') + ' từ đã dán' : 'chưa viết'}
          ${muc && muc.soTuMucTieu ? '· mục tiêu ' + muc.soTuMucTieu.toLocaleString('vi-VN') : ''}</span>
      </div>`

    const hang = document.createElement('div')
    hang.className = 'hang-nut'

    const chep = document.createElement('button')
    chep.className = 'nut nut-chinh'
    chep.textContent = i === 1 ? 'Chép prompt phần 1' : `Chép prompt phần ${i} (kèm sổ chống lặp)`
    const nhan = document.createElement('span')
    nhan.className = 'ghi-chu'
    chep.onclick = async () => {
      const kq = await window.api.promptPhan(duAnHienTai, i, $('#chon-skill').value, {})
      await chepVaBao(kq.prompt, nhan)
    }

    const o = document.createElement('textarea')
    o.rows = 3
    o.placeholder = `Dán phần ${i} Claude viết về đây`
    o.value = daViet

    const luu = document.createElement('button')
    luu.className = 'nut nut-xanh'
    luu.textContent = 'Lưu phần ' + i
    luu.onclick = async () => {
      if (!duAnHienTai) { await baoTin('Chọn dự án trước đã.'); return }
      if (!o.value.trim()) { await baoTin('Ô dán còn trống.'); return }
      const kq = await window.api.luuPhan(duAnHienTai, i, o.value)
      cacPhanHienTai = kq.cacPhan
      veDanhSachPhan()
    }

    hang.append(chep, luu, nhan)
    the.append(hang, o)
    hop.append(the)
  }

  const mucTieu = caiDatHienTai ? Number(caiDatHienTai.soTuMucTieu) || 0 : 0
  $('#tien-do-kich-ban').textContent = mucTieu
    ? `${tongTu.toLocaleString('vi-VN')} / ${mucTieu.toLocaleString('vi-VN')} từ (${Math.round((tongTu / mucTieu) * 100)}%)`
    : `${tongTu.toLocaleString('vi-VN')} từ`
}

$('#nut-gop-kich-ban').onclick = async () => {
  if (!duAnHienTai) { await baoTin('Chọn dự án trước đã.'); return }
  const kq = await window.api.gopKichBan(duAnHienTai)
  if (!kq.ok) { await baoTin(kq.loi); return }
  $('#ket-qua-gop').textContent =
    `Đã lưu ${kq.ten} · ${kq.thongKe.soTu.toLocaleString('vi-VN')} từ · ${kq.thongKe.phutUoc} phút · ${kq.thongKe.soCanh} cảnh`
  $('#ket-qua-gop').className = 'ghi-chu ghi-chu-xanh'
  $('#o-kiem-duyet').value = kq.chu
  await taiDuAn()
}

// ---------------------------------------------------------------------------
// Kiểm duyệt
// ---------------------------------------------------------------------------
$('#nut-lay-tu-du-an').onclick = async () => {
  if (!duAnHienTai) { await baoTin('Chọn dự án trước đã.'); return }
  const d = await window.api.docDuAn(duAnHienTai)
  if (!d.kichBan) { await baoTin('Dự án này chưa có bản kịch bản nào. Vào màn Kịch bản bấm "Gộp thành kịch bản hoàn chỉnh".'); return }
  $('#o-kiem-duyet').value = d.kichBan
  $('#ghi-chu-nguon-kiem').textContent = `Lấy từ dự án · ${(d.banKichBan || []).length} bản`
}

$('#nut-mo-tep').onclick = async () => {
  const kq = await window.api.moTep('Mở kịch bản cần kiểm')
  if (kq.huy) return
  if (!kq.ok) { await baoTin(kq.loi || 'Không đọc được tệp.'); return }
  $('#o-kiem-duyet').value = kq.vanBan
  $('#ghi-chu-nguon-kiem').textContent = `Từ tệp ${kq.ten} · ${kq.soTu.toLocaleString('vi-VN')} từ · ${kq.ghiChu}`
  $('#ghi-chu-nguon-kiem').className = 'ghi-chu ghi-chu-xanh'
}

$('#nut-kiem-duyet').onclick = async () => {
  const chu = $('#o-kiem-duyet').value.trim()
  if (!chu && !duAnHienTai) { await baoTin('Chưa có kịch bản để kiểm.'); return }
  const banGoc = $('#o-ban-goc').value.trim()
  const kq = await window.api.kiemDuyet(chu, banGoc || null, duAnHienTai)
  if (!kq.ok) { await baoTin(kq.loi); return }
  baoCaoHienTai = kq.baoCao
  veBaoCao(kq.baoCao, kq.coBanGoc)
}

function veBaoCao(bc, coBanGoc) {
  const hop = $('#ket-qua-kiem-duyet')
  hop.innerHTML = ''

  const the = (tieuDe, noiDung, lop = '') => {
    const d = document.createElement('div')
    d.className = 'the ' + lop
    d.innerHTML = `<label class="nhan">${tieuDe}</label>` + noiDung
    hop.append(d)
  }

  const t = bc.tongQuan
  the('Tổng quan', `<div class="luoi-so">
      <div><span class="so-to">${t.soTu.toLocaleString('vi-VN')}</span><span>từ</span></div>
      <div><span class="so-to">${t.phutDocUoc}</span><span>phút video</span></div>
      <div><span class="so-to">${t.soCau.toLocaleString('vi-VN')}</span><span>câu</span></div>
      <div><span class="so-to">${t.soTuMoiCau}</span><span>từ/câu</span></div>
      <div><span class="so-to">${t.doPhongPhuTu}%</span><span>độ phong phú từ</span></div>
    </div>`)

  // Độ giống bản gốc — mục quan trọng nhất
  if (bc.giongBanGoc) {
    const g = bc.giongBanGoc
    const lop = g.mucDo === 'ĐỎ' ? 'the-do' : (g.mucDo === 'VÀNG' ? 'the-canh-bao' : '')
    the(`Độ giống lời thoại gốc — <span class="nhan-video ${g.mucDo === 'ĐỎ' ? 'nhan-do' : g.mucDo === 'VÀNG' ? 'nhan-vang' : 'nhan-tot'}">${g.mucDo}</span>`,
      `<div class="luoi-so">
        <div><span class="so-to">${g.tyLe}%</span><span>cụm 5 từ trùng bản gốc</span></div>
        <div><span class="so-to">${g.soCumTrung.toLocaleString('vi-VN')}</span><span>cụm trùng / ${g.tongCum.toLocaleString('vi-VN')}</span></div>
      </div>
      <p class="ghi-chu">${thoat(g.ghiChuNguong)}</p>
      ${g.cumTrung.length ? '<div class="danh-sach-cum">' + g.cumTrung.slice(0, 8).map((c) =>
        `<div class="cum-trung">${thoat(c.doan)}</div>`).join('') + '</div>' : ''}`, lop)
  } else {
    the('Độ giống lời thoại gốc',
      '<p class="ghi-chu">Chưa đo được: dự án này chưa có lời thoại gốc. Vào màn Lời thoại lấy phụ đề video tham khảo trước, rồi kiểm lại — đây là phép đo quan trọng nhất với kiểu kênh viết lại nội dung.</p>',
      'the-canh-bao')
  }

  // Lặp
  const l = bc.lap
  the('Lặp nội dung', `<div class="luoi-so">
      <div><span class="so-to">${l.tyLeLap}%</span><span>nội dung nằm trong cụm lặp</span></div>
      <div><span class="so-to">${l.cum8.length}</span><span>cụm 8 từ lặp</span></div>
      <div><span class="so-to">${l.cauGanTrung.length}</span><span>nhóm câu gần trùng</span></div>
      <div><span class="so-to">${l.moDauCauLap.length}</span><span>kiểu vào câu bị lặp</span></div>
    </div>
    ${l.cauGanTrung.length ? '<div class="danh-sach-cum">' + l.cauGanTrung.slice(0, 5).map((c) =>
      `<div class="cum-trung"><b>${c.soCau} câu giống nhau ${c.doGiong}%:</b><br>${c.cau.map(thoat).join('<br>')}</div>`).join('') + '</div>' : ''}
    ${l.moDauCauLap.length ? '<p class="ghi-chu">Vào câu lặp: ' + l.moDauCauLap.map((m) =>
      `"${thoat(m.moDau)}" ×${m.soLan}`).join(' · ') + '</p>' : ''}`)

  // Bản đồ nhiệt
  if (l.banDoNhiet && l.banDoNhiet.ma.length > 2) {
    const n = l.banDoNhiet
    let o = '<div class="ban-do-nhiet">'
    for (let i = 0; i < n.ma.length; i++) {
      for (let j = 0; j < n.ma.length; j++) {
        const v = n.ma[i][j]
        o += `<span class="o-nhiet" style="opacity:${0.12 + Math.min(1, v) * 0.88}" title="khối ${i + 1} ↔ ${j + 1}: ${Math.round(v * 100)}%"></span>`
      }
      o += '<br>'
    }
    o += '</div>'
    the('Bản đồ nhiệt — vòng lặp nằm ở đâu',
      o + `<p class="ghi-chu">Mỗi ô là một cặp khối văn bản (${n.tuMoiKhoi} từ/khối). Ô sáng nằm XA đường chéo
        nghĩa là hai đoạn cách nhau rất xa trong bài mà vẫn giống nhau — đó là vòng lặp thật.
        ${n.diemNong.length ? '<b>Có ' + n.diemNong.length + ' cặp đáng chú ý.</b>' : 'Không thấy cặp nào đáng chú ý.'}</p>`)
  }

  // Chính sách
  if (bc.chinhSach) {
    const c = bc.chinhSach
    const lop = c.soDo ? 'the-do' : (c.soVang ? 'the-canh-bao' : '')
    the(`Chính sách — ${thoat(c.ketLuan)}`,
      (c.co.length ? c.co.map((f) => `
        <div class="co-chinh-sach co-${f.mucDo === 'đỏ' ? 'do' : 'vang'}">
          <b>${thoat(f.ten)}</b> <span class="ghi-chu">${f.soLan} lần · ${thoat(f.tuTrung.slice(0, 6).join(', '))}</span>
          <div>${thoat(f.giaiThich)}</div>
          <div class="huong-sua">→ ${thoat(f.huongSua)}</div>
        </div>`).join('') : '<p class="ghi-chu">Không gắn cờ nào.</p>') +
      `<p class="ghi-chu canh-bao-manh">${thoat(c.canhBao)}</p>`, lop)
  }

  // Hướng sửa
  the('Hướng sửa cụ thể', bc.huongSua.length
    ? '<ol class="danh-sach-buoc">' + bc.huongSua.map((h) =>
        `<li class="sua-${h.mucDo}">${thoat(h.viec)}</li>`).join('') + '</ol>'
    : '<p class="ghi-chu">Không có gì phải sửa.</p>')

  hop.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

$('#nut-xuat-bao-cao').onclick = async () => {
  if (!baoCaoHienTai) { await baoTin('Chạy kiểm duyệt trước đã.'); return }
  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<title>Báo cáo kiểm duyệt</title><style>
body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1a1a1a}
h1{border-bottom:3px solid #ff7a1a;padding-bottom:8px}
.the{border:1px solid #ddd;border-radius:10px;padding:16px 20px;margin:16px 0}
.do{border-left:5px solid #ff4d4f;background:#fff5f5}
.vang{border-left:5px solid #d99a00;background:#fffbf0}
.cum{background:#fff3cd;padding:6px 10px;border-radius:6px;margin:6px 0;font-family:ui-monospace,monospace;font-size:13px}
</style></head><body>
<h1>Báo cáo kiểm duyệt kịch bản</h1>
<p>Lập lúc ${new Date().toLocaleString('vi-VN')} bằng Tool Ý Tưởng.</p>
<div class="the"><h2>Tổng quan</h2>
<p>${baoCaoHienTai.tongQuan.soTu.toLocaleString('vi-VN')} từ · ${baoCaoHienTai.tongQuan.soCau} câu ·
${baoCaoHienTai.tongQuan.phutDocUoc} phút video · độ phong phú từ ${baoCaoHienTai.tongQuan.doPhongPhuTu}%</p></div>
${baoCaoHienTai.giongBanGoc ? `<div class="the ${baoCaoHienTai.giongBanGoc.mucDo === 'ĐỎ' ? 'do' : baoCaoHienTai.giongBanGoc.mucDo === 'VÀNG' ? 'vang' : ''}">
<h2>Độ giống lời thoại gốc: ${baoCaoHienTai.giongBanGoc.tyLe}% (${baoCaoHienTai.giongBanGoc.mucDo})</h2>
<p>${thoat(baoCaoHienTai.giongBanGoc.ghiChuNguong)}</p>
${baoCaoHienTai.giongBanGoc.cumTrung.slice(0, 15).map((c) => `<div class="cum">${thoat(c.doan)}</div>`).join('')}
</div>` : ''}
<div class="the"><h2>Lặp nội dung: ${baoCaoHienTai.lap.tyLeLap}%</h2>
${baoCaoHienTai.lap.cauGanTrung.slice(0, 10).map((c) =>
  `<div class="cum"><b>${c.soCau} câu giống ${c.doGiong}%:</b><br>${c.cau.map(thoat).join('<br>')}</div>`).join('')}
</div>
${baoCaoHienTai.chinhSach ? `<div class="the ${baoCaoHienTai.chinhSach.soDo ? 'do' : baoCaoHienTai.chinhSach.soVang ? 'vang' : ''}">
<h2>Chính sách: ${thoat(baoCaoHienTai.chinhSach.ketLuan)}</h2>
${baoCaoHienTai.chinhSach.co.map((f) => `<p><b>${thoat(f.ten)}</b> (${f.mucDo}, ${f.soLan} lần) — ${thoat(f.giaiThich)}<br>→ ${thoat(f.huongSua)}</p>`).join('')}
<p><i>${thoat(baoCaoHienTai.chinhSach.canhBao)}</i></p></div>` : ''}
<div class="the"><h2>Hướng sửa</h2><ol>${baoCaoHienTai.huongSua.map((h) => `<li>${thoat(h.viec)}</li>`).join('')}</ol></div>
</body></html>`
  const kq = await window.api.xuatBaoCao(html)
  if (kq.ok) datTienDo({ phanTram: 100, viec: 'Đã xuất báo cáo', chiTiet: kq.duongDan, trangThai: 'xong' })
}

// ---------------------------------------------------------------------------
// Prompt ảnh
// ---------------------------------------------------------------------------
$('#nut-cat-canh').onclick = async () => {
  const gop = Number($('#o-gop-canh').value) || 1
  // Đọc ô kịch bản CỦA CHÍNH MÀN NÀY. Trước đây nó đọc ké ô của màn Kiểm duyệt,
  // nên muốn dùng Prompt ảnh là phải đi vòng qua Kiểm duyệt — đúng kiểu ràng
  // buộc chéo làm người dùng không dùng riêng được một tính năng.
  const chu = $('#o-kich-ban-anh').value.trim()
  const kq = await window.api.catCanh(chu, duAnHienTai, gop)
  if (!kq.ok) { await baoTin(kq.loi); return }
  canhHienTai = kq.canh
  moTaTheoCanh = {}
  promptThangHienTai = {}
  cacPromptHienTai = []
  veThongKeCanh(kq.thongKe)
  veBangCanh()
}

function veThongKeCanh(tk) {
  $('#thong-ke-canh').innerHTML = `
    <b>${tk.soCanh}</b> cảnh · ${tk.tongTu.toLocaleString('vi-VN')} từ ·
    trung bình <b>${tk.tuTrungBinh} từ/cảnh</b> · tổng ${tk.tongPhut} phút
    ${tk.canhQuaNgan ? ` · <span class="canh-bao-manh">${tk.canhQuaNgan} cảnh quá ngắn</span>` : ''}
    ${tk.canhQuaDai ? ` · <span class="canh-bao-manh">${tk.canhQuaDai} cảnh quá dài</span>` : ''}`
}

function veBangCanh() {
  const bang = $('#bang-canh')
  bang.innerHTML = `<thead><tr><th>STT</th><th>Tên ảnh</th><th>Câu trong kịch bản</th><th>Từ</th><th>Giây</th><th>Prompt</th></tr></thead>`
  const than = document.createElement('tbody')
  if (!canhHienTai.length) {
    than.innerHTML = '<tr><td colspan="6" class="ghi-chu" style="padding:18px">Chưa cắt cảnh.</td></tr>'
  }
  canhHienTai.slice(0, 200).forEach((c, i) => {
    const p = cacPromptHienTai[i]
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td class="so-lieu">${c.so}</td>
      <td class="so-lieu">${thoat(c.ten)}.png</td>
      <td>${thoat(c.chu)}</td>
      <td class="so-lieu">${c.soTu}</td>
      <td class="so-lieu">${c.giayUoc}</td>
      <td class="ghi-chu">${p ? thoat(p.prompt.slice(0, 160)) + '…' : '—'}</td>`
    than.append(tr)
  })
  bang.append(than)
  if (canhHienTai.length > 200) {
    const tr = document.createElement('tr')
    tr.innerHTML = `<td colspan="6" class="ghi-chu" style="padding:12px">…và ${canhHienTai.length - 200} cảnh nữa (bảng chỉ hiện 200 dòng đầu cho nhẹ, xuất Excel sẽ có đủ).</td>`
    than.append(tr)
  }
}

$('#nut-prompt-mo-ta').onclick = async () => {
  if (!canhHienTai.length) { await baoTin('Cắt cảnh trước đã.'); return }
  const lo = Number($('#o-lo-thu').value) || 1
  const moiLo = caiDatHienTai ? Number(caiDatHienTai.soCanhMoiLo) || 50 : 50
  const kieu = $('#o-kieu-mo-ta').value
  const boSo = $('#o-bo-canh-footage').checked ? soCoTepFootage() : []
  const kq = await window.api.promptMoTa(canhHienTai, lo, moiLo, kieu, boSo)
  if (!kq.prompt) { await baoTin('Không còn cảnh nào cần mô tả (mọi cảnh đã có footage?).'); return }
  await chepVaBao(kq.prompt, $('#ghi-chu-lo'))
  $('#ghi-chu-lo').textContent +=
    ` · lô ${kq.loThu}/${kq.tongLo} (${kq.soCanhTrongLo} cảnh, kiểu ${kq.kieu === 'thuong' ? 'prompt thường' : 'JSON'})`
  $('#o-lo-thu').max = kq.tongLo
}

// Tự nhận dạng JSON hay prompt thường — người dùng không phải nhớ đã xin kiểu nào.
$('#nut-doc-mo-ta').onclick = async () => {
  const chu = $('#o-mo-ta-tra-ve').value
  const kq = await window.api.docMoTa(chu)

  if (kq.loi) {
    $('#ket-qua-mo-ta').textContent = (kq.kieu === 'json' ? 'Đọc theo kiểu JSON nhưng hỏng: ' : '') + kq.loi
    $('#ket-qua-mo-ta').className = 'ghi-chu ghi-chu-vang'
    return
  }

  if (kq.kieu === 'json') Object.assign(moTaTheoCanh, kq.moTa)
  else Object.assign(promptThangHienTai, kq.prompt)

  const daCo = Object.keys(moTaTheoCanh).length + Object.keys(promptThangHienTai).length
  $('#ket-qua-mo-ta').textContent =
    `Nhận ra kiểu ${kq.kieu === 'json' ? 'JSON' : 'prompt thường'} · đọc được ${kq.soDoc} cảnh · ` +
    `tổng đã có: ${daCo}/${canhHienTai.length}` + (kq.canhBao ? ' · ' + kq.canhBao : '')
  $('#ket-qua-mo-ta').className = kq.canhBao ? 'ghi-chu ghi-chu-vang' : 'ghi-chu ghi-chu-xanh'
  $('#o-mo-ta-tra-ve').value = ''
  const lo = Number($('#o-lo-thu').value) || 1
  $('#o-lo-thu').value = lo + 1
}

// ---------------------------------------------------------------------------
// Nạp kịch bản cho màn Prompt ảnh — từ tệp trên máy hoặc từ dự án
// ---------------------------------------------------------------------------
$('#nut-mo-tep-anh').onclick = async () => {
  const kq = await window.api.moTep('Mở kịch bản để cắt cảnh')
  if (kq.huy) return
  if (!kq.ok) { await baoTin(kq.loi || 'Không đọc được tệp.'); return }
  $('#o-kich-ban-anh').value = kq.vanBan
  $('#ghi-chu-nguon-anh').textContent = `Từ tệp ${kq.ten} · ${kq.soTu.toLocaleString('vi-VN')} từ · ${kq.ghiChu}`
  $('#ghi-chu-nguon-anh').className = 'ghi-chu ghi-chu-xanh'
}

$('#nut-lay-kich-ban-du-an').onclick = async () => {
  if (!duAnHienTai) { await baoTin('Chưa chọn dự án. Hoặc dán thẳng kịch bản vào ô, hoặc mở tệp từ máy.'); return }
  const d = await window.api.docDuAn(duAnHienTai)
  if (!d.kichBan) { await baoTin('Dự án này chưa có bản kịch bản nào.'); return }
  $('#o-kich-ban-anh').value = d.kichBan
  $('#ghi-chu-nguon-anh').textContent = `Từ dự án · ${(d.kichBan.match(/\S+/g) || []).length.toLocaleString('vi-VN')} từ`
  $('#ghi-chu-nguon-anh').className = 'ghi-chu ghi-chu-xanh'
}

$('#nut-tao-prompt').onclick = async () => {
  if (!canhHienTai.length) { await baoTin('Cắt cảnh trước đã.'); return }
  const kq = await window.api.taoPromptAnh(canhHienTai, moTaTheoCanh, promptThangHienTai)
  cacPromptHienTai = kq.cacPrompt
  veBangCanh()
  $('#ghi-chu-xuat').textContent = kq.kiemTra.ok
    ? `Đã sinh ${cacPromptHienTai.length} prompt, số thứ tự liên tục` +
      (kq.soNguyenVan ? ` · ${kq.soNguyenVan} prompt dùng nguyên văn.` : '.')
    : 'LỖI đánh số: ' + kq.kiemTra.loi.slice(0, 3).join('; ')
  $('#ghi-chu-xuat').className = kq.kiemTra.ok ? 'ghi-chu ghi-chu-xanh' : 'ghi-chu ghi-chu-vang'
}

$('#nut-xuat-prompt').onclick = async () => {
  if (!cacPromptHienTai.length) { await baoTin('Bấm "Sinh toàn bộ prompt" trước đã.'); return }
  const kq = await window.api.xuatPromptAnh(canhHienTai, cacPromptHienTai, duAnHienTai, keHoachFt)
  if (kq.huy) return
  if (!kq.ok) { await baoTin('Xuất thất bại.'); return }
  $('#ghi-chu-xuat').textContent = `Đã xuất ${kq.soPrompt} prompt ra ${kq.thuMuc}` +
    (kq.chuoiSoFlow ? ` · chuoi-so-flow.txt: ${kq.chuoiSoFlow}` : '')
  $('#ghi-chu-xuat').className = 'ghi-chu ghi-chu-xanh'
  datTienDo({ phanTram: 100, viec: 'Xuất prompt xong', chiTiet: kq.thuMuc, trangThai: 'xong' })
}

// Kho nhân vật
function veKhoNhanVat() {
  const ds = (caiDatHienTai && caiDatHienTai.khoNhanVat) || []
  const hop = $('#kho-nhan-vat')
  hop.innerHTML = ds.length ? '' : '<div class="ghi-chu">Chưa khai nhân vật nào.</div>'
  ds.forEach((n, i) => {
    const dong = document.createElement('div')
    dong.className = 'dong-nhan-vat'
    dong.innerHTML = `<b>${thoat(n.ten)}</b><div class="ghi-chu">${thoat(n.moTa)}</div>`
    const xoa = document.createElement('button')
    xoa.className = 'nut nut-do'
    xoa.textContent = 'Xoá'
    xoa.onclick = async () => {
      const moi = ds.filter((_, j) => j !== i)
      await window.api.ghiKho('nhanVat', moi)
      await taiCaiDat()
    }
    dong.append(xoa)
    hop.append(dong)
  })
}

$('#nut-them-nhan-vat').onclick = async () => {
  const ten = $('#nhap-ten-nhan-vat').value.trim()
  const moTa = $('#nhap-mo-ta-nhan-vat').value.trim()
  if (!ten || !moTa) { await baoTin('Cần cả tên và đoạn mô tả cố định.'); return }
  const ds = [...((caiDatHienTai && caiDatHienTai.khoNhanVat) || []), { ten, moTa, tuKhoa: [ten] }]
  await window.api.ghiKho('nhanVat', ds)
  $('#nhap-ten-nhan-vat').value = ''
  $('#nhap-mo-ta-nhan-vat').value = ''
  await taiCaiDat()
}

// ---------------------------------------------------------------------------
// Trình duyệt trong app
// ---------------------------------------------------------------------------
function veTaiKhoan() {
  const ds = (caiDatHienTai && caiDatHienTai.taiKhoan) || []
  const hop = $('#danh-sach-tai-khoan')
  hop.innerHTML = ds.length ? '' : '<div class="ghi-chu">Chưa có tài khoản nào. Thêm một tài khoản rồi tự đăng nhập trong cửa sổ.</div>'

  for (const t of ds) {
    const dong = document.createElement('div')
    dong.className = 'dong-khoa'
    dong.innerHTML = `<span class="ten-khoa">${thoat(t.ten)}</span><span class="che">phiên riêng</span>`

    const mo = document.createElement('button')
    mo.className = 'nut nut-chinh'
    mo.textContent = 'Mở tab'
    mo.onclick = async () => {
      await window.api.moTab(t.id, $('#nhap-dia-chi').value || 'https://www.youtube.com')
      moMan('trinh-duyet')
    }

    const xoa = document.createElement('button')
    xoa.className = 'nut nut-do'
    xoa.textContent = 'Xoá'
    xoa.onclick = async () => {
      if (!(await hoiCo(`Xoá tài khoản "${t.ten}"? Toàn bộ phiên đăng nhập của nó sẽ bị xoá.`, 'Xoá'))) return
      await window.api.xoaTaiKhoan(t.id)
      await taiCaiDat()
    }
    dong.append(mo, xoa)
    hop.append(dong)
  }

  const selRadar = $('#chon-tai-khoan-radar')
  if (selRadar) {
    const cuRadar = selRadar.value
    selRadar.innerHTML = '<option value="">— không đăng nhập —</option>' +
      ds.map((t) => `<option value="${thoat(t.id)}">${thoat(t.ten)}</option>`).join('')
    selRadar.value = ds.some((t) => t.id === cuRadar) ? cuRadar : (ds[0] ? ds[0].id : '')
  }

  const sel = $('#chon-tai-khoan-cookie')
  const cu = sel.value
  sel.innerHTML = '<option value="">— không dùng cookie —</option>' +
    ds.map((t) => `<option value="${thoat(t.id)}">${thoat(t.ten)}</option>`).join('')
  sel.value = cu
}

$('#nut-them-tai-khoan').onclick = async () => {
  const ten = $('#nhap-ten-tai-khoan').value.trim()
  const kq = await window.api.themTaiKhoan(ten)
  $('#nhap-ten-tai-khoan').value = ''
  await taiCaiDat()
  await window.api.moTab(kq.taiKhoan.id, 'https://www.youtube.com')
  moMan('trinh-duyet')
}

window.api.nhanDuyetThayDoi((tt) => veThanhTab(tt))

function veThanhTab(tt) {
  const hop = $('#thanh-tab')
  if (!hop) return
  hop.innerHTML = ''
  const ds = (caiDatHienTai && caiDatHienTai.taiKhoan) || []
  for (const t of tt.tab) {
    const tk = ds.find((x) => x.id === t.taiKhoanId)
    const nut = document.createElement('button')
    nut.className = 'tab' + (t.dangHien ? ' tab-chon' : '')
    nut.textContent = `${tk ? tk.ten : '?'} · ${(t.tieuDe || t.url).slice(0, 26)}`
    nut.onclick = async () => { await window.api.chonTab(t.id); capNhatKhungDuyet() }
    const dong = document.createElement('span')
    dong.className = 'dong-tab'
    dong.textContent = '×'
    dong.onclick = async (su) => { su.stopPropagation(); await window.api.dongTab(t.id) }
    nut.append(dong)
    hop.append(nut)
    if (t.dangHien) $('#nhap-dia-chi').value = t.url || ''
  }
}

// Khung trình duyệt là một lớp THẬT nằm đè lên cửa sổ, không phải phần tử HTML
// — nên phải tự tính toạ độ và báo cho tiến trình chính mỗi khi bố cục đổi.
function capNhatKhungDuyet() {
  const o = $('#khung-duyet')
  if (!o) return
  const r = o.getBoundingClientRect()
  window.api.datKhungDuyet({
    x: Math.round(r.left),
    y: Math.round(r.top),
    width: Math.round(r.width),
    height: Math.round(r.height)
  })
}

window.addEventListener('resize', capNhatKhungDuyet)
window.api.nhanCuaSoDoiCo(() => capNhatKhungDuyet())
$('#noi-dung').addEventListener('scroll', capNhatKhungDuyet)

$('#nut-di').onclick = async () => {
  const tt = await window.api.trangThaiDuyet()
  if (!tt.tabDangHien) { await baoTin('Chưa có tab nào. Thêm tài khoản rồi bấm "Mở tab".'); return }
  const ok = await window.api.dieuHuong(tt.tabDangHien, $('#nhap-dia-chi').value.trim())
  if (!ok.ok) await baoTin('Chỉ mở được các trang YouTube, Google và Claude.')
}

$('#nut-an-duyet').onclick = async () => {
  await window.api.anDuyet()
  $('#nut-an-duyet').textContent = $('#nut-an-duyet').textContent.startsWith('Ẩn') ? 'Hiện trình duyệt' : 'Ẩn trình duyệt'
  if ($('#nut-an-duyet').textContent.startsWith('Hiện')) return
  capNhatKhungDuyet()
  await window.api.hienDuyet()
}

// ---------------------------------------------------------------------------
// Nhật ký
// ---------------------------------------------------------------------------
async function taiNhatKy() {
  const dong = await window.api.docNhatKy()
  const khung = $('#khung-nhat-ky')
  khung.textContent = (dong || []).join('\n')
  khung.scrollTop = khung.scrollHeight
}
$('#nut-tai-nhat-ky').onclick = taiNhatKy

// ---------------------------------------------------------------------------
// Lời thoại — CHẾ ĐỘ NHANH, không cần dự án
//
// Cả chuỗi sản xuất nối với nhau qua dự án, nhưng nhiều lúc chỉ cần đúng một
// việc: bóc lời thoại một video, hoặc mở sẵn một tệp kịch bản ra xem. Bắt tạo
// dự án cho những lúc đó là phiền vô ích.
// ---------------------------------------------------------------------------
function capNhatThongKeNhanh() {
  const chu = $('#o-loi-thoai-nhanh').value
  const soTu = (chu.match(/\S+/g) || []).length
  const tuPhut = caiDatHienTai ? Number(caiDatHienTai.tuMoiPhut) || 150 : 150
  $('#thong-ke-nhanh').textContent = soTu
    ? `${soTu.toLocaleString('vi-VN')} từ · đọc khoảng ${(soTu / tuPhut).toFixed(1)} phút`
    : ''
}
$('#o-loi-thoai-nhanh').addEventListener('input', capNhatThongKeNhanh)

$('#nut-lay-nhanh').onclick = async () => {
  const link = $('#nhap-link-nhanh').value.trim()
  if (!link) { await baoTin('Dán một link video YouTube vào ô.'); return }

  $('#nut-lay-nhanh').disabled = true
  $('#ghi-chu-nhanh').textContent = 'Đang lấy phụ đề…'
  $('#ghi-chu-nhanh').className = 'ghi-chu'
  try {
    const kq = await window.api.layLoiThoaiMotVideo(link, $('#chon-tai-khoan-cookie').value)
    if (!kq.ok) {
      $('#ghi-chu-nhanh').textContent = kq.loi
      $('#ghi-chu-nhanh').className = 'ghi-chu ghi-chu-vang'
      return
    }
    $('#o-loi-thoai-nhanh').value = kq.vanBan
    $('#ghi-chu-nhanh').textContent =
      `${kq.tieuDe || kq.videoId}${kq.tenKenh ? ' — ' + kq.tenKenh : ''} · ` +
      `định dạng ${kq.dinhDang} · bỏ ${kq.tyLeBoLap}% dòng lặp kiểu cuộn`
    $('#ghi-chu-nhanh').className = 'ghi-chu ghi-chu-xanh'
    capNhatThongKeNhanh()
  } finally {
    $('#nut-lay-nhanh').disabled = false
  }
}

$('#nut-mo-tep-loi-thoai').onclick = async () => {
  const kq = await window.api.moTep('Mở tệp tư liệu hoặc kịch bản')
  if (kq.huy) return
  if (!kq.ok) { await baoTin(kq.loi || 'Không đọc được tệp.'); return }
  $('#o-loi-thoai-nhanh').value = kq.vanBan
  $('#ghi-chu-nhanh').textContent = `Từ tệp ${kq.ten} · ${kq.ghiChu}`
  $('#ghi-chu-nhanh').className = 'ghi-chu ghi-chu-xanh'
  capNhatThongKeNhanh()
}

$('#nut-chep-loi-thoai').onclick = async () => {
  const chu = $('#o-loi-thoai-nhanh').value
  if (!chu.trim()) { await baoTin('Ô còn trống.'); return }
  await chepVaBao(chu, $('#ghi-chu-nhanh'))
}

$('#nut-luu-loi-thoai').onclick = async () => {
  const chu = $('#o-loi-thoai-nhanh').value
  if (!chu.trim()) { await baoTin('Ô còn trống.'); return }
  const kq = await window.api.luuTep(chu, 'loi-thoai.md')
  if (kq.huy) return
  $('#ghi-chu-nhanh').textContent = 'Đã lưu: ' + kq.duongDan
  $('#ghi-chu-nhanh').className = 'ghi-chu ghi-chu-xanh'
}

// Hai nút "đẩy sang" là cầu nối TUỲ CHỌN giữa các màn: dùng khi muốn nối, còn
// không dùng thì từng màn vẫn chạy riêng được.
$('#nut-day-sang-kiem-duyet').onclick = async () => {
  const chu = $('#o-loi-thoai-nhanh').value
  if (!chu.trim()) { await baoTin('Ô còn trống.'); return }
  $('#o-kiem-duyet').value = chu
  $('#ghi-chu-nguon-kiem').textContent = 'Từ chế độ nhanh của màn Lời thoại'
  $('#ghi-chu-nguon-kiem').className = 'ghi-chu ghi-chu-xanh'
  moMan('kiem-duyet')
}

$('#nut-day-sang-prompt').onclick = async () => {
  const chu = $('#o-loi-thoai-nhanh').value
  if (!chu.trim()) { await baoTin('Ô còn trống.'); return }
  $('#o-kich-ban-anh').value = chu
  $('#ghi-chu-nguon-anh').textContent = 'Từ chế độ nhanh của màn Lời thoại'
  $('#ghi-chu-nguon-anh').className = 'ghi-chu ghi-chu-xanh'
  moMan('prompt-anh')
}

// ---------------------------------------------------------------------------
// Cập nhật: kiểm tra → tải → cài
// ---------------------------------------------------------------------------
let khaNangCapNhatHienTai = null

async function veKhaNangCapNhat() {
  khaNangCapNhatHienTai = await window.api.khaNangCapNhat()
  const o = $('#gioi-han-cap-nhat')
  if (!khaNangCapNhatHienTai) { o.textContent = ''; return }
  o.textContent = khaNangCapNhatHienTai.lyDo || ''
  o.className = khaNangCapNhatHienTai.lyDo ? 'ghi-chu ghi-chu-vang' : 'ghi-chu'
}

$('#nut-kiem-cap-nhat').onclick = async () => {
  $('#ket-qua-cap-nhat').textContent = 'Đang kiểm tra…'
  $('#ket-qua-cap-nhat').className = 'ghi-chu'
  const kq = await window.api.kiemCapNhat()
  if (kq.khaNang) {
    khaNangCapNhatHienTai = kq.khaNang
    $('#gioi-han-cap-nhat').textContent = kq.khaNang.lyDo || ''
    $('#gioi-han-cap-nhat').className = kq.khaNang.lyDo ? 'ghi-chu ghi-chu-vang' : 'ghi-chu'
  }
  if (!kq.ok) {
    $('#ket-qua-cap-nhat').textContent = kq.lyDo
    $('#ket-qua-cap-nhat').className = 'ghi-chu ghi-chu-vang'
    return
  }
  if (kq.coBanMoi) {
    $('#ket-qua-cap-nhat').textContent = `Có bản mới ${kq.phienBanMoi} (đang dùng ${kq.phienBanHienTai})`
    $('#ket-qua-cap-nhat').className = 'ghi-chu ghi-chu-xanh'
    $('#nut-tai-ban-moi').hidden = !(kq.khaNang && kq.khaNang.taiDuoc)
  } else {
    $('#ket-qua-cap-nhat').textContent = `Đang dùng bản mới nhất (${kq.phienBanHienTai})`
    $('#nut-tai-ban-moi').hidden = true
  }
}

$('#nut-tai-ban-moi').onclick = async () => {
  $('#nut-tai-ban-moi').disabled = true
  $('#tien-do-cap-nhat').hidden = false
  const kq = await window.api.taiBanMoi()
  if (!kq.ok) {
    $('#chu-cap-nhat').textContent = kq.lyDo
    $('#chu-cap-nhat').className = 'ghi-chu ghi-chu-vang'
    $('#nut-tai-ban-moi').disabled = false
  }
}

$('#nut-cai-ban-moi').onclick = async () => {
  if (!(await hoiCo('Đóng app và cài bản mới ngay bây giờ?', 'Cài và khởi động lại'))) return
  const kq = await window.api.caiBanMoi()
  if (!kq.ok) await baoTin(kq.lyDo)
}

window.api.nhanCapNhat((d) => {
  const chu = $('#chu-cap-nhat')
  const day = $('#day-cap-nhat')

  if (d.giaiDoan === 'dang-kiem') {
    $('#ket-qua-cap-nhat').textContent = 'Đang kiểm tra…'
  } else if (d.giaiDoan === 'co-ban-moi') {
    $('#ket-qua-cap-nhat').textContent = `Có bản mới ${d.phienBan}`
    $('#ket-qua-cap-nhat').className = 'ghi-chu ghi-chu-xanh'
    $('#nut-tai-ban-moi').hidden = !(khaNangCapNhatHienTai && khaNangCapNhatHienTai.taiDuoc)
  } else if (d.giaiDoan === 'khong-co') {
    $('#ket-qua-cap-nhat').textContent = `Đang dùng bản mới nhất (${d.phienBan})`
  } else if (d.giaiDoan === 'dang-tai') {
    $('#tien-do-cap-nhat').hidden = false
    day.style.width = d.phanTram + '%'
    chu.textContent = `Đang tải ${d.phanTram}% · ${(d.daTai / 1048576).toFixed(1)}/${(d.tong / 1048576).toFixed(1)} MB` +
      (d.tocDo ? ` · ${(d.tocDo / 1048576).toFixed(1)} MB/s` : '')
    chu.className = 'ghi-chu'
  } else if (d.giaiDoan === 'da-tai-xong') {
    day.style.width = '100%'
    if (d.khaNang) khaNangCapNhatHienTai = d.khaNang
    const caiDuoc = khaNangCapNhatHienTai && khaNangCapNhatHienTai.caiDuoc
    chu.textContent = caiDuoc
      ? `Đã tải xong bản ${d.phienBan}. Bấm "Cài ngay và khởi động lại".`
      : `Đã tải xong bản ${d.phienBan}, nhưng bản này không tự cài được — ${khaNangCapNhatHienTai ? khaNangCapNhatHienTai.lyDo : ''}`
    chu.className = caiDuoc ? 'ghi-chu ghi-chu-xanh' : 'ghi-chu ghi-chu-vang'
    $('#nut-cai-ban-moi').hidden = !caiDuoc
    $('#nut-tai-ban-moi').hidden = true
  } else if (d.giaiDoan === 'loi') {
    chu.textContent = 'Lỗi: ' + d.loi
    chu.className = 'ghi-chu ghi-chu-vang'
    $('#tien-do-cap-nhat').hidden = false
    $('#nut-tai-ban-moi').disabled = false
  }
})

// ---------------------------------------------------------------------------
// VIDEO ĐÃ CHỌN — sợi dây nối phần Nghiên cứu với phần Sản xuất
//
// Tick ô đầu dòng ở bất kỳ bảng nào (Ý tưởng, Đề xuất, Kênh theo dõi) = đưa
// video vào danh sách. Danh sách lưu ở tiến trình chính (tệp riêng), nên tắt
// app mở lại vẫn còn. Cả 4 màn Sản xuất đều có khối "Video đã chọn".
// ---------------------------------------------------------------------------
function daChon(videoId) {
  return videoDaChon.some((v) => v.videoId === videoId)
}

async function taiVideoDaChon() {
  videoDaChon = await window.api.docVideoDaChon()
  capNhatMoiChoDaChon()
}

// co = true: thêm; false: bỏ. nguon: tên màn đã chọn video này.
async function datChon(cacVideo, co, nguon = '') {
  let ds = [...videoDaChon]
  if (co) {
    for (const v of cacVideo) {
      if (ds.some((x) => x.videoId === v.videoId)) continue
      // Dòng radar có trường `nguon` là MẢNG các hạt giống — ghi đè bằng tên màn,
      // nếu không danh sách đã chọn sẽ hiện nguồn là một chuỗi mã video vô nghĩa.
      ds.push({ ...v, nguon, nhan: v.nhanDeXuat || v.nhan || '', views: v.views || v.viewUoc || 0 })
    }
  } else {
    const bo = new Set(cacVideo.map((v) => v.videoId))
    ds = ds.filter((v) => !bo.has(v.videoId))
  }
  videoDaChon = await window.api.ghiVideoDaChon(ds)
  capNhatMoiChoDaChon()
}

function capNhatMoiChoDaChon() {
  $('#so-da-chon').textContent = `${videoDaChon.length} video`
  $('#hop-da-chon').classList.toggle('co-chon', videoDaChon.length > 0)

  // Cập nhật ô tick ở mọi bảng đang hiện — không vẽ lại cả bảng để khỏi mất
  // vị trí cuộn.
  for (const o of $$('.tick-video')) {
    o.checked = daChon(o.dataset.id)
    const tr = o.closest('tr')
    if (tr) tr.classList.toggle('dong-da-chon', o.checked)
  }
  for (const o of $$('.tick-tat-ca')) {
    const bang = o.closest('table')
    const cac = bang ? [...bang.querySelectorAll('.tick-video')] : []
    const soTick = cac.filter((x) => x.checked).length
    o.checked = cac.length > 0 && soTick === cac.length
    o.indeterminate = soTick > 0 && soTick < cac.length
  }
  for (const hop of $$('.hop-video-chon')) veHopVideoChon(hop)
}

// ---------------------------------------------------------------------------
// Bảng video dùng chung cho Ý tưởng, Kênh theo dõi, Radar, Đang hot
// ---------------------------------------------------------------------------
const LOP_DE_XUAT = { 'ĐẨY MẠNH': 'nhan-day-manh', 'MẠNH': 'nhan-tot', 'CÓ ĐỀ XUẤT': 'nhan-thuong' }

function anhNho(d) {
  return d.thumbnailNho || `https://i.ytimg.com/vi/${d.videoId}/mqdefault.jpg`
}

function huyHieu(d) {
  const h = []
  if (d.coKenh === 'vuaNho') h.push('<span class="huy-hieu huy-hieu-ngoc">kênh vừa &amp; nhỏ</span>')
  if (d.khopLinhVuc) h.push('<span class="huy-hieu huy-hieu-cam">khớp lĩnh vực</span>')
  if (d.laHatGiong) h.push('<span class="huy-hieu">hạt giống</span>')
  if (d.trenTrangChu) h.push('<span class="huy-hieu huy-hieu-tim">trang chủ</span>')
  if (d.quocGia && d.quocGia !== 'US') h.push(`<span class="huy-hieu huy-hieu-vang">kênh ${thoat(d.quocGia)}</span>`)
  if (d.coSoLieuApi === false) h.push('<span class="huy-hieu" title="Chưa ghép số liệu API — view là số ước đọc từ trang">số ước</span>')
  return h.length ? `<div class="hang-huy-hieu">${h.join('')}</div>` : ''
}

const COT_VIDEO = {
  tick: {
    dau: '<input type="checkbox" class="tick-tat-ca" title="Tick / bỏ tick mọi dòng đang hiện">',
    lop: 'o-tick',
    o: (d) => `<input type="checkbox" class="tick-video" data-id="${thoat(d.videoId)}"${daChon(d.videoId) ? ' checked' : ''}>`
  },
  thumb: {
    dau: 'Ảnh',
    lop: 'o-thumb-cot',
    o: (d) => `<div class="o-thumb"><img loading="lazy" src="${thoat(anhNho(d))}" alt="" data-mo-app="${thoat(d.lienKet)}" title="Mở trong trình duyệt của tool">` +
      `<button class="nut-tai-mot" data-tai-thumb="${thoat(d.videoId)}" title="Tải thumbnail cỡ lớn nhất có được">⬇</button></div>`
  },
  nhan: { dau: 'Nhãn', o: (d) => `<span class="nhan-video ${LOP_NHAN[d.nhan] || 'nhan-thuong'}">${thoat(d.nhan || '—')}</span>` },
  deXuat: {
    dau: 'Đề xuất',
    o: (d) => `<span class="nhan-video ${LOP_DE_XUAT[d.nhanDeXuat] || 'nhan-thuong'}">${thoat(d.nhanDeXuat || '—')}</span>` +
      `<div class="ghi-chu so-nguon">${d.soNguon}/${d.tongNguon} nguồn</div>`
  },
  diem: { dau: 'Điểm', lop: 'so-lieu', o: (d) => (d.diem != null ? d.diem : '—') },
  tieuDe: {
    dau: 'Tiêu đề',
    lop: 'tieu-de',
    o: (d) => `<a href="#" data-ngoai="${thoat(d.lienKet)}">${thoat(d.tieuDe || d.videoId)}</a>${huyHieu(d)}` +
      ((d.tuKhoaNguon || []).length ? `<div class="tu-khoa-nguon">từ khóa: ${thoat(d.tuKhoaNguon.join(', '))}</div>` : '')
  },
  kenh: { dau: 'Kênh', lop: 'o-kenh', o: (d) => thoat(d.tenKenh || '—') },
  views: { dau: 'View', lop: 'so-lieu', o: (d) => soGon(d.views || d.viewUoc || 0) },
  vph: { dau: 'View/giờ', lop: 'so-lieu', o: (d) => (d.vph ? soGon(d.vph) : '—') },
  tyLeSub: { dau: 'V/Sub', lop: 'so-lieu', o: (d) => `<span class="${d.tyLeSub >= 1 ? 'manh' : ''}">${d.tyLeSub || '—'}</span>` },
  vuotTV: { dau: '<span title="Vượt trung vị view 20 video gần nhất của chính kênh đó">Vượt TV</span>', lop: 'so-lieu', o: (d) => `<span class="${d.vuotTrungVi >= 3 ? 'manh' : ''}">${d.vuotTrungVi ? d.vuotTrungVi + '×' : '—'}</span>` },
  sub: {
    dau: 'Sub',
    lop: 'so-lieu',
    o: (d) => `<span class="${d.coKenh === 'vuaNho' ? 'sub-vua-nho' : ''}">${d.anSub ? 'ẩn' : (d.subKenh ? soGon(d.subKenh) : '—')}</span>`
  },
  dai: { dau: 'Dài', lop: 'so-lieu', o: (d) => phutGiay(d.thoiLuongGiay) },
  dang: { dau: 'Đăng', lop: 'so-lieu', o: (d) => (d.ngayDang ? soGioTruoc(d.ngayDang) : thoat(d.ngayChu || '—')) },
  tuKhoa: { dau: 'Từ khóa', lop: 'ghi-chu', o: (d) => thoat((d.tuKhoaNguon || []).join(', ')) },
  tang: {
    dau: 'Tăng từ lần quét trước',
    lop: 'ghi-chu',
    o: (d) => thoat(d.tangTruong
      ? `+${soGon(d.tangTruong.tang)} trong ${d.tangTruong.soGio}h (${soGon(d.tangTruong.tangMoiGio)}/giờ)`
      : (d.soMocLichSu > 1 ? 'chưa đủ cách nhau 12h' : 'lần quét đầu'))
  }
}

function veBangVideo(bang, dong, cacCot, { nguon = '', rong = 'Không có dòng nào khớp bộ lọc.' } = {}) {
  bang._dong = dong
  bang._nguon = nguon
  const cot = cacCot.map((k) => COT_VIDEO[k])
  bang.innerHTML = `<thead><tr>${cot.map((c) => `<th class="${c.lop || ''}">${c.dau}</th>`).join('')}</tr></thead>`
  const than = document.createElement('tbody')
  if (!dong.length) {
    than.innerHTML = `<tr><td colspan="${cot.length}" class="ghi-chu" style="padding:18px">${thoat(rong)}</td></tr>`
  }
  for (const d of dong) {
    const tr = document.createElement('tr')
    if (daChon(d.videoId)) tr.classList.add('dong-da-chon')
    tr.innerHTML = cot.map((c) => `<td class="${c.lop || ''}">${c.o(d)}</td>`).join('')
    than.append(tr)
  }
  bang.append(than)

  // Gắn sự kiện MỘT lần cho mỗi bảng (uỷ quyền) — vẽ lại bảng không gắn chồng.
  if (!bang.dataset.daGan) {
    bang.dataset.daGan = '1'
    bang.addEventListener('change', async (su) => {
      const o = su.target
      if (o.classList.contains('tick-video')) {
        const v = (bang._dong || []).find((x) => x.videoId === o.dataset.id)
        if (v) await datChon([v], o.checked, bang._nguon)
      } else if (o.classList.contains('tick-tat-ca')) {
        await datChon(bang._dong || [], o.checked, bang._nguon)
      }
    })
    bang.addEventListener('click', async (su) => {
      const anh = su.target.closest('[data-mo-app]')
      if (anh) { su.preventDefault(); await moTrongApp(anh.dataset.moApp); return }
      const tai = su.target.closest('[data-tai-thumb]')
      if (tai) {
        su.preventDefault()
        const v = (bang._dong || []).find((x) => x.videoId === tai.dataset.taiThumb)
        if (v) await taiThumb([v])
      }
    })
  }
  capNhatMoiChoDaChon()
}

async function moTrongApp(url) {
  const kq = await window.api.moNhanhTrongApp(url)
  if (!kq.ok) { await baoTin('Chỉ mở được các trang YouTube, Google và Claude trong trình duyệt của tool.'); return }
  moMan('trinh-duyet')
}

// Tải thumbnail. duAnMa có thì lưu vào thư mục ảnh tham chiếu của dự án.
async function taiThumb(ds, duAnMa = null) {
  if (!ds.length) { await baoTin('Chưa có video nào để tải thumbnail.'); return }
  const kq = await window.api.taiThumbnail(ds, duAnMa)
  if (kq.huy) return
  if (!kq.ok) {
    await baoTin((kq.loi && kq.loi.length ? `Không tải được thumbnail nào. ${kq.loi[0].loi}` : (kq.loi || 'Không tải được.')) +
      ' Xem màn Nhật ký để biết chi tiết.')
    return
  }
  const loi = (kq.loi || []).length ? `\n${kq.loi.length} video không tải được — xem màn Nhật ký.` : ''
  if (await hoiCo(`Đã tải ${kq.soTai}/${ds.length} thumbnail vào:\n${kq.thuMuc}${loi}`, 'Mở thư mục')) {
    await window.api.moThuMuc(kq.thuMuc)
  }
}

// Nút "Tải thumbnail video đã tick" của một bảng: lấy các dòng đang tick trong
// bảng đó; chưa tick dòng nào thì hỏi có tải hết các dòng đang hiện không.
async function taiThumbCuaBang(bang) {
  const dong = bang._dong || []
  if (!dong.length) { await baoTin('Bảng chưa có video nào.'); return }
  const daTick = dong.filter((d) => daChon(d.videoId))
  if (daTick.length) { await taiThumb(daTick); return }
  if (await hoiCo(`Chưa tick video nào trong bảng này. Tải thumbnail cho cả ${dong.length} video đang hiện?`, 'Tải hết')) {
    await taiThumb(dong)
  }
}
$('#nut-tai-thumb-y-tuong').onclick = () => taiThumbCuaBang($('#bang-ket-qua'))

// ---------------------------------------------------------------------------
// Khối "Video đã chọn" ở 4 màn Sản xuất
// ---------------------------------------------------------------------------
function dsDangTick(man) {
  const bo = boTickTaiMan[man] || new Set()
  return videoDaChon.filter((v) => !bo.has(v.videoId))
}

function choPromptKichBan(ds) {
  return ds.map((v) => ({
    tieuDe: v.tieuDe,
    tenKenh: v.tenKenh,
    views: v.views,
    subKenh: v.subKenh,
    phut: v.thoiLuongGiay ? Math.round(v.thoiLuongGiay / 60) : 0,
    lienKet: v.lienKet
  }))
}

function linkCua(ds) {
  return ds.map((v) => `https://www.youtube.com/watch?v=${v.videoId}`).join('\n')
}

const HANH_DONG_MAN = {
  'loi-thoai': {
    gioiThieu: 'Lấy lời thoại các video anh đã tick. Nên gộp 2–4 video vào một dự án.',
    nut: [
      {
        ten: 'Nạp link vào ô bên dưới', lop: 'nut-phu',
        lam: async (ds) => {
          $('#nhap-link-video').value = linkCua(ds)
          $('#nhap-link-video').scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      },
      {
        ten: 'Lấy lời thoại ngay', lop: 'nut-chinh',
        lam: async (ds) => {
          $('#nhap-link-video').value = linkCua(ds)
          $('#nut-lay-loi-thoai').click()
        }
      }
    ]
  },
  'kich-ban': {
    gioiThieu: 'Video đã tick đi vào prompt dàn ý như TÍN HIỆU THỊ TRƯỜNG (người xem Mỹ đang quan tâm góc nào) — prompt dặn rõ không chép tiêu đề, không bám cấu trúc.',
    tuyChon: '<label class="o-danh-dau"><input type="checkbox" id="o-dung-video-tham-khao" checked> Đưa các video đang tick vào prompt dàn ý (làm video tham khảo)</label>',
    nut: [
      {
        ten: 'Lấy lời thoại các video này vào dự án', lop: 'nut-phu',
        lam: async (ds) => {
          if (!duAnHienTai) { await baoTin('Chọn (hoặc tạo) dự án ở màn Lời thoại trước.'); return }
          $('#nhap-link-video').value = linkCua(ds)
          moMan('loi-thoai')
          $('#nut-lay-loi-thoai').click()
        }
      }
    ]
  },
  'kiem-duyet': {
    gioiThieu: 'Đo kịch bản của anh giống video gốc tới đâu — lấy lời thoại các video đã tick làm bản so.',
    nut: [
      {
        ten: 'Lấy lời thoại làm bản gốc để so', lop: 'nut-chinh',
        lam: async (ds) => {
          const lay = ds.slice(0, 4)
          if (ds.length > 4 && !(await hoiCo(`Đang tick ${ds.length} video — chỉ lấy 4 video đầu cho nhanh. Tiếp tục?`, 'Lấy 4 video'))) return
          const phan = []
          const loi = []
          for (let i = 0; i < lay.length; i++) {
            datTienDo({ phanTram: Math.round((i / lay.length) * 100), viec: 'Lấy lời thoại bản gốc', chiTiet: `${i + 1}/${lay.length} · ${lay[i].tieuDe}` })
            const kq = await window.api.layLoiThoaiMotVideo(lay[i].videoId, $('#chon-tai-khoan-cookie').value)
            if (kq.ok) phan.push(`## ${kq.tieuDe || lay[i].tieuDe}\n\n${kq.vanBan}`)
            else loi.push(`${lay[i].tieuDe}: ${kq.loi}`)
          }
          datTienDo({ phanTram: 100, viec: 'Lấy bản gốc xong', chiTiet: `${phan.length}/${lay.length} video`, soLoi: loi.length, trangThai: loi.length ? 'loi' : 'xong' })
          if (phan.length) {
            $('#o-ban-goc').value = phan.join('\n\n---\n\n')
            $('#chi-tiet-ban-goc').open = true
            capNhatTomTatBanGoc()
          }
          if (loi.length) await baoTin('Một số video không lấy được lời thoại:\n' + loi.join('\n'))
        }
      }
    ]
  },
  'prompt-anh': {
    gioiThieu: 'Thumbnail của video đang chạy tốt là tham chiếu phong cách hình ảnh (màu, bố cục, ánh sáng) — tải về để đưa cho Claude hoặc tự xem khi viết template.',
    nut: [
      {
        ten: 'Tải thumbnail làm ảnh tham chiếu', lop: 'nut-chinh',
        lam: async (ds) => taiThumb(ds, duAnHienTai || null)
      }
    ]
  }
}

function veHopVideoChon(hop) {
  const man = hop.dataset.man
  const cauHinh = HANH_DONG_MAN[man]
  if (!cauHinh) return
  // Giữ trạng thái ô tuỳ chọn khi vẽ lại.
  const tuyChonCu = hop.querySelector('input[id]')
  const daBat = tuyChonCu ? tuyChonCu.checked : true

  if (!videoDaChon.length) {
    hop.classList.add('hop-trong')
    hop.innerHTML = `
      <div class="hang-dau-bang">
        <label class="nhan">Video đã chọn <span class="dem-chon">0</span></label>
        <div class="hang-nut">
          <button class="nut nut-phu" data-sang="y-tuong">Sang màn Ý tưởng</button>
          <button class="nut nut-phu" data-sang="de-xuat">Sang Đề xuất video</button>
        </div>
      </div>
      <p class="ghi-chu">Chưa chọn video nào. Tick ô ☐ đầu mỗi dòng ở màn <b>Ý tưởng</b>, <b>Đề xuất video</b> hoặc
        <b>Kênh theo dõi</b> — video sẽ hiện ở đây để dùng cho màn này.</p>`
    for (const b of hop.querySelectorAll('[data-sang]')) b.onclick = () => moMan(b.dataset.sang)
    return
  }

  hop.classList.remove('hop-trong')
  const bo = boTickTaiMan[man] || (boTickTaiMan[man] = new Set())
  for (const id of [...bo]) if (!daChon(id)) bo.delete(id)
  const soTick = videoDaChon.length - bo.size

  hop.innerHTML = `
    <div class="hang-dau-bang">
      <label class="nhan">Video đã chọn <span class="dem-chon">${videoDaChon.length}</span>
        <span class="the-nho">đang tick ${soTick}/${videoDaChon.length} cho màn này</span></label>
      <div class="hang-nut">
        <button class="nut nut-phu nut-nho" data-lam="tick-het">Tick hết</button>
        <button class="nut nut-phu nut-nho" data-lam="bo-tick">Bỏ tick hết</button>
        <button class="nut nut-do" data-lam="xoa-het">Xoá cả danh sách</button>
      </div>
    </div>
    <p class="ghi-chu">${cauHinh.gioiThieu}</p>
    ${cauHinh.tuyChon || ''}
    <div class="luoi-video-chon"></div>
    <div class="hang-nut hang-hanh-dong"></div>`

  const tc = hop.querySelector('input[id]')
  if (tc) tc.checked = daBat

  const luoi = hop.querySelector('.luoi-video-chon')
  for (const v of videoDaChon) {
    const the = document.createElement('div')
    the.className = 'the-video-chon' + (bo.has(v.videoId) ? ' bo-tick' : '')
    the.innerHTML = `
      <label class="tick-goc"><input type="checkbox"${bo.has(v.videoId) ? '' : ' checked'}></label>
      <button class="xoa-chon" title="Gỡ khỏi danh sách đã chọn">×</button>
      <img loading="lazy" src="${thoat(anhNho(v))}" alt="" title="Mở trong trình duyệt của tool">
      <div class="tieu-de-chon" title="${thoat(v.tieuDe)}">${thoat(v.tieuDe || v.videoId)}</div>
      <div class="ghi-chu">${thoat(v.tenKenh || '—')} · ${soGon(v.views)} view${v.subKenh ? ' · ' + soGon(v.subKenh) + ' sub' : ''}${v.thoiLuongGiay ? ' · ' + phutGiay(v.thoiLuongGiay) : ''}</div>
      ${v.nguon ? `<div class="nguon-chon">từ ${thoat(v.nguon)}</div>` : ''}`
    the.querySelector('input').onchange = (su) => {
      if (su.target.checked) bo.delete(v.videoId)
      else bo.add(v.videoId)
      veHopVideoChon(hop)
    }
    the.querySelector('.xoa-chon').onclick = () => datChon([v], false)
    the.querySelector('img').onclick = () => moTrongApp(v.lienKet)
    luoi.append(the)
  }

  hop.querySelector('[data-lam="tick-het"]').onclick = () => { bo.clear(); veHopVideoChon(hop) }
  hop.querySelector('[data-lam="bo-tick"]').onclick = () => { for (const v of videoDaChon) bo.add(v.videoId); veHopVideoChon(hop) }
  hop.querySelector('[data-lam="xoa-het"]').onclick = async () => {
    if (!(await hoiCo(`Xoá cả ${videoDaChon.length} video khỏi danh sách đã chọn? (Chỉ xoá khỏi danh sách, không xoá gì trên máy.)`, 'Xoá hết'))) return
    await datChon(videoDaChon, false)
  }

  const hang = hop.querySelector('.hang-hanh-dong')
  for (const n of cauHinh.nut) {
    const b = document.createElement('button')
    b.className = `nut ${n.lop}`
    b.textContent = `${n.ten} (${soTick})`
    b.disabled = soTick === 0
    b.onclick = async () => {
      b.disabled = true
      try { await n.lam(dsDangTick(man)) } finally { b.disabled = false }
    }
    hang.append(b)
  }
}

function capNhatTomTatBanGoc() {
  const chu = $('#o-ban-goc').value.trim()
  const soTu = (chu.match(/\S+/g) || []).length
  $('#tom-tat-ban-goc').textContent = soTu
    ? `đang dùng bản gốc dán tay · ${soTu.toLocaleString('vi-VN')} từ`
    : 'đang dùng lời thoại của dự án'
}
$('#o-ban-goc').addEventListener('input', capNhatTomTatBanGoc)

// ---------------------------------------------------------------------------
// ĐỀ XUẤT VIDEO
// ---------------------------------------------------------------------------
$$('.tab-de-xuat').forEach((t) => {
  t.onclick = () => {
    $$('.tab-de-xuat').forEach((x) => x.classList.toggle('tab-de-xuat-chon', x === t))
    $('#khoi-radar').hidden = t.dataset.tab !== 'radar'
    $('#khoi-hot').hidden = t.dataset.tab !== 'hot'
    if (t.dataset.tab === 'hot') capNhatUoc72h()
  }
})

function linhVuc() {
  let chu = $('#nhap-linh-vuc').value.trim()
  // Chưa nhập thì mượn luôn từ khóa ở màn Ý tưởng — đỡ gõ lại hai lần.
  if (!chu && $('#nhap-tu-khoa').value.trim()) {
    chu = $('#nhap-tu-khoa').value.trim()
    $('#nhap-linh-vuc').value = chu
  }
  return chu
}

function tachLinhVuc(chu) {
  return [...new Set(String(chu || '').split(/[,;\n]+/).map((x) => x.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))]
}

function locDongRadar() {
  if (locRadar === 'ĐẨY MẠNH') return bangRadar.filter((d) => d.nhanDeXuat === 'ĐẨY MẠNH')
  if (locRadar === 'KHOP') return bangRadar.filter((d) => d.khopLinhVuc)
  if (locRadar === 'VUA-NHO') return bangRadar.filter((d) => d.coKenh === 'vuaNho')
  return bangRadar
}

function veBangRadar() {
  veBangVideo($('#bang-radar'), locDongRadar(),
    ['tick', 'thumb', 'deXuat', 'tieuDe', 'kenh', 'views', 'vph', 'sub', 'dai', 'dang'],
    { nguon: 'Radar đề xuất' })
}

$$('.chip-radar').forEach((c) => {
  c.onclick = () => {
    locRadar = c.dataset.loc
    $$('.chip-radar').forEach((x) => x.classList.toggle('chip-chon', x === c))
    veBangRadar()
  }
})

$('#nut-chay-radar').onclick = async () => {
  const tuKhoa = linhVuc()
  const dungVideoDaChon = $('#o-radar-da-chon').checked
  if (!tuKhoa && !dungVideoDaChon) {
    await baoTin('Nhập từ khóa lĩnh vực (tiếng Anh), hoặc bật "Dùng video đã chọn làm hạt giống".')
    return
  }
  if (dungVideoDaChon && !videoDaChon.length && !tuKhoa) {
    await baoTin('Danh sách video đã chọn đang trống. Tick vài video ở màn Ý tưởng trước, hoặc nhập từ khóa lĩnh vực.')
    return
  }

  $('#nut-chay-radar').disabled = true
  $('#ghi-chu-radar').textContent = 'Đang chạy radar — mở ngầm các trang YouTube (đã tắt tiếng), khoảng 1–2 phút…'
  $('#ghi-chu-radar').className = 'ghi-chu'
  datTienDo({ phanTram: 2, viec: 'Bắt đầu radar' })
  try {
    const kq = await window.api.chayRadar({
      tuKhoa,
      taiKhoanId: $('#chon-tai-khoan-radar').value,
      dungVideoDaChon,
      soHatGiong: Number($('#o-so-hat-giong').value) || 8,
      docTrangChu: $('#o-radar-trang-chu').checked,
      thoiGian: $('#o-radar-thoi-gian').value
    })
    if (!kq.ok) {
      $('#ghi-chu-radar').textContent = kq.loi
      $('#ghi-chu-radar').className = 'ghi-chu ghi-chu-vang'
      await baoTin(kq.loi)
      return
    }
    bangRadar = kq.dong || []
    locRadar = 'tat-ca'
    $$('.chip-radar').forEach((x) => x.classList.toggle('chip-chon', x.dataset.loc === 'tat-ca'))
    veBangRadar()
    $('#the-ket-qua-radar').hidden = false
    const soManh = bangRadar.filter((d) => d.nhanDeXuat === 'ĐẨY MẠNH').length
    $('#tom-tat-radar').textContent =
      `${bangRadar.length} video từ ${kq.soNguon} nguồn đã đọc (${kq.hatGiong.length} hạt giống` +
      `${kq.cacLanDoc.some((l) => l.loai === 'trangChu') ? ' + trang chủ' : ''}) · ${soManh} ĐẨY MẠNH`
    $('#canh-bao-radar').textContent = [kq.ghiChuApi, ...(kq.canhBao || [])].filter(Boolean).join(' · ')
    $('#ghi-chu-radar').textContent = kq.ghiChu || 'Xong.'
    $('#ghi-chu-radar').className = 'ghi-chu ghi-chu-xanh'
    await taiCaiDat()
    $('#the-ket-qua-radar').scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (loi) {
    datTienDo({ phanTram: 100, viec: 'Radar lỗi', chiTiet: loi.message, soLoi: 1, trangThai: 'loi' })
    await baoTin('Lỗi: ' + loi.message)
  } finally {
    $('#nut-chay-radar').disabled = false
  }
}
$('#nut-tai-thumb-radar').onclick = () => taiThumbCuaBang($('#bang-radar'))

// --- Đang hot (API) --------------------------------------------------------
function locDongHot() {
  if (locHot === 'KHOP') return bangHot.filter((d) => d.khopLinhVuc)
  if (locHot === 'VUA-NHO') return bangHot.filter((d) => d.coKenh === 'vuaNho')
  if (locHot === 'NỔ VIEW') return bangHot.filter((d) => d.nhan === 'NỔ VIEW')
  return bangHot
}

function veBangHot() {
  veBangVideo($('#bang-hot'), locDongHot(),
    ['tick', 'thumb', 'nhan', 'diem', 'tieuDe', 'kenh', 'views', 'vph', 'tyLeSub', 'sub', 'dai', 'dang'],
    { nguon: 'Đang hot' })
}

$$('.chip-hot').forEach((c) => {
  c.onclick = () => {
    locHot = c.dataset.loc
    $$('.chip-hot').forEach((x) => x.classList.toggle('chip-chon', x === c))
    veBangHot()
  }
})

function hienBangHot(dong, tomTat) {
  bangHot = dong
  locHot = 'tat-ca'
  $$('.chip-hot').forEach((x) => x.classList.toggle('chip-chon', x.dataset.loc === 'tat-ca'))
  veBangHot()
  $('#the-ket-qua-hot').hidden = false
  $('#tom-tat-hot').textContent = tomTat
  $('#the-ket-qua-hot').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

$('#nut-lay-hot').onclick = async () => {
  $('#nut-lay-hot').disabled = true
  try {
    const kq = await window.api.layVideoHot({
      danhMuc: $('#o-danh-muc').value,
      soLuong: Number($('#o-so-video-hot').value) || 100,
      tuKhoaLoc: linhVuc()
    })
    if (!kq.ok) { await baoTin(kq.loi); return }
    const soKhop = kq.dong.filter((d) => d.khopLinhVuc).length
    hienBangHot(kq.dong,
      `Thịnh hành Mỹ · ${$('#o-danh-muc').selectedOptions[0].textContent} · ${kq.dong.length}/${kq.truocLoc} video sau lọc` +
      ` · ${soKhop} khớp lĩnh vực · dùng ${kq.quotaDaDung} đơn vị`)
    await taiCaiDat()
  } finally {
    $('#nut-lay-hot').disabled = false
  }
}

async function capNhatUoc72h() {
  const tk = tachLinhVuc($('#nhap-linh-vuc').value || $('#nhap-tu-khoa').value).slice(0, 5)
  if (!tk.length) { $('#uoc-72h').textContent = 'Nhập từ khóa lĩnh vực ở trên trước.'; return }
  const c = caiDatHienTai || {}
  const uoc = await window.api.uocQuota({
    soTuKhoa: tk.length,
    soVideoMoiTuKhoa: Number(c.soVideoMoiTuKhoa) || 25,
    tinhVuotTrungViKenh: !!c.tinhVuotTrungViKenh
  })
  $('#uoc-72h').innerHTML = `${tk.length} từ khóa · tốn khoảng <b>${uoc.toLocaleString('vi-VN')}</b> đơn vị quota`
}
$('#nhap-linh-vuc').addEventListener('input', () => { if (!$('#khoi-hot').hidden) capNhatUoc72h() })

$('#nut-tim-72h').onclick = async () => {
  const tk = tachLinhVuc(linhVuc()).slice(0, 5)
  if (!tk.length) { await baoTin('Nhập từ khóa lĩnh vực (tiếng Anh) ở ô trên cùng.'); return }
  await capNhatUoc72h()
  const uoc = $('#uoc-72h').textContent
  if (!(await hoiCo(`Tìm video đăng trong 72 giờ qua cho ${tk.length} từ khóa: ${tk.join(', ')}.\n${uoc}. Tiếp tục?`, 'Tìm'))) return
  $('#nut-tim-72h').disabled = true
  try {
    const kq = await window.api.timYTuong(tk, { soNgay: 3 })
    if (!kq.ok) { await baoTin(kq.loi); return }
    // Tìm đúng bằng từ khóa lĩnh vực nên mọi dòng đều khớp lĩnh vực.
    for (const d of kq.dong) d.khopLinhVuc = true
    hienBangHot(kq.dong, `Đang lên 72 giờ · ${kq.dong.length} video · ${kq.soNoView} nổ view · dùng ${kq.quotaDaDung} đơn vị`)
    await taiCaiDat()
  } finally {
    $('#nut-tim-72h').disabled = false
  }
}
$('#nut-tai-thumb-hot').onclick = () => taiThumbCuaBang($('#bang-hot'))


// ---------------------------------------------------------------------------
// Footage thật
//
// Số cảnh là "số căn cước" — không bao giờ đánh lại. Mọi thao tác ở đây gửi
// cả kế hoạch sang tiến trình chính, bên đó ghi ra footage-ke-hoach.json trong
// thư mục dựng sau MỖI thay đổi.
// ---------------------------------------------------------------------------
function soCoTepFootage() {
  if (!keHoachFt) return []
  return keHoachFt.canh.filter((c) => c.loai === 'FOOTAGE' && c.chon && c.chon.tep).map((c) => c.so)
}

function canCoThuMuc() {
  if (thuMucDung) return true
  baoTin('Chưa chọn thư mục dựng (khối "Thư mục dựng của video này" ở đầu màn).')
  return false
}

async function napThuMucDung(kq) {
  if (!kq || kq.huy) return
  if (!kq.ok) { await baoTin(kq.loi || 'Không mở được thư mục.'); return }
  thuMucDung = kq.thuMuc
  keHoachFt = kq.keHoach || null
  $('#thu-muc-dung').innerHTML = `Thư mục dựng: <code>${thoat(thuMucDung)}</code>` +
    (keHoachFt ? ` · đã có kế hoạch ${keHoachFt.canh.length} cảnh` : ' · chưa có kế hoạch footage') +
    (kq.loiKeHoach ? `<div class="canh-bao-manh">${thoat(kq.loiKeHoach)}</div>` : '')
  // Mở lại app: khôi phục bộ cảnh từ kế hoạch để khỏi phải cắt lại.
  if (keHoachFt && !canhHienTai.length && keHoachFt.canh.every((c) => c.chu)) {
    canhHienTai = keHoachFt.canh.map((c) => ({ so: c.so, ten: c.ten, chu: c.chu, soTu: c.soTu, giayUoc: c.giayUoc }))
    veBangCanh()
    $('#ghi-chu-buoc1-ft').textContent = `Đã nạp lại ${canhHienTai.length} cảnh từ kế hoạch.`
    $('#ghi-chu-buoc1-ft').className = 'ghi-chu ghi-chu-xanh'
  }
  await kiemKhopFt()
  veFootage()
}

// Kế hoạch phải khớp đúng bộ cảnh đang có. Không khớp thì CHẶN xuất/tìm —
// footage cảnh 12 rơi vào chỗ câu khác là lỗi im lặng tệ nhất của cả chuỗi.
async function kiemKhopFt(imLang = false) {
  if (!keHoachFt || !canhHienTai.length) return true
  const r = await window.api.kiemKhopKeHoach(canhHienTai, keHoachFt)
  if (!r.khop && !imLang) {
    $('#ghi-chu-buoc1-ft').textContent = 'KẾ HOẠCH KHÔNG KHỚP bộ cảnh hiện tại: ' + r.lyDo + ' Bấm "Lọc sơ" để lập kế hoạch mới.'
    $('#ghi-chu-buoc1-ft').className = 'ghi-chu canh-bao-manh'
  }
  return r.khop
}

$('#nut-chon-thu-muc-dung').onclick = async () => {
  if (!duAnHienTai) { await napThuMucDung(await window.api.chonThuMucDung('', true)); return }
  await napThuMucDung(await window.api.chonThuMucDung(duAnHienTai, false))
}
$('#nut-chon-thu-muc-khac').onclick = async () => napThuMucDung(await window.api.chonThuMucDung(duAnHienTai, true))
$('#nut-mo-thu-muc-dung').onclick = async () => { if (canCoThuMuc()) await window.api.moThuMuc(thuMucDung) }

$('#nut-cat-canh-ft').onclick = async () => {
  const gop = Number($('#o-gop-canh').value) || 1
  const kq = await window.api.catCanh($('#o-kich-ban-anh').value.trim(), duAnHienTai, gop)
  if (!kq.ok) { await baoTin(kq.loi + ' (Kịch bản lấy từ ô của màn Prompt ảnh hoặc từ dự án.)'); return }
  canhHienTai = kq.canh
  moTaTheoCanh = {}
  promptThangHienTai = {}
  cacPromptHienTai = []
  veThongKeCanh(kq.thongKe)
  veBangCanh()
  $('#ghi-chu-buoc1-ft').textContent = `${kq.thongKe.soCanh} cảnh · ${kq.thongKe.tongPhut} phút`
  $('#ghi-chu-buoc1-ft').className = 'ghi-chu ghi-chu-xanh'
  await kiemKhopFt()
  veFootage()
}

$('#nut-xuat-canh-xlsx').onclick = async () => {
  if (!canhHienTai.length) { await baoTin('Cắt cảnh trước đã.'); return }
  if (!canCoThuMuc()) return
  const kq = await window.api.xuatCanhXlsx(thuMucDung, canhHienTai)
  if (!kq.ok) { await baoTin(kq.loi); return }
  $('#ghi-chu-buoc1-ft').textContent = `Đã ghi ${kq.duongDan} (${canhHienTai.length} dòng)`
  $('#ghi-chu-buoc1-ft').className = 'ghi-chu ghi-chu-xanh'
  datTienDo({ phanTram: 100, viec: 'Xuất canh.xlsx xong', chiTiet: kq.duongDan, trangThai: 'xong' })
}

$('#nut-loc-so').onclick = async () => {
  if (!canhHienTai.length) { await baoTin('Cắt cảnh trước đã.'); return }
  if (!canCoThuMuc()) return
  if (keHoachFt && (await kiemKhopFt(true))) {
    const daLam = keHoachFt.canh.filter((c) => (c.chon && c.chon.tep) || c.nguonPhanLoai !== 'luat').length
    if (daLam && !(await hoiCo(`Kế hoạch hiện tại đã có ${daLam} cảnh được Claude/anh sửa hoặc đã tải footage. ` +
      'Lọc lại sẽ lập kế hoạch MỚI và chuyển mọi tệp footage cũ vào _footage-da-bo. Làm lại?', 'Lập kế hoạch mới'))) return
  }
  const kq = await window.api.lapKeHoachFootage(canhHienTai, thuMucDung)
  keHoachFt = kq.keHoach
  const dem = (f) => keHoachFt.canh.filter(f).length
  $('#ghi-chu-phan-loai').textContent =
    `Lọc sơ xong: ${dem((c) => c.loai === 'FOOTAGE')} khá chắc FOOTAGE · ${dem((c) => c.canHoi)} cảnh cần hỏi Claude · ` +
    `${dem((c) => !c.canHoi)} cảnh chắc là AI` + (kq.soDon ? ` · dọn ${kq.soDon} tệp của kế hoạch cũ` : '')
  $('#ghi-chu-phan-loai').className = 'ghi-chu ghi-chu-xanh'
  $('#o-lo-phan-loai').value = 1
  locFt = 'can-hoi'
  veFootage()
}

$('#nut-prompt-phan-loai').onclick = async () => {
  if (!keHoachFt) { await baoTin('Bấm "Lọc sơ" trước đã.'); return }
  const lo = Number($('#o-lo-phan-loai').value) || 1
  const moiLo = caiDatHienTai ? Number(caiDatHienTai.soCanhMoiLo) || 50 : 50
  const kq = await window.api.promptPhanLoai(keHoachFt, lo, moiLo)
  if (!kq.tongLo) { await baoTin('Không còn cảnh nào chờ Claude xác nhận.'); return }
  await chepVaBao(kq.prompt, $('#ghi-chu-phan-loai'))
  $('#ghi-chu-phan-loai').textContent += ` · lô ${kq.loThu}/${kq.tongLo} (${kq.soCanh} cảnh, còn ${kq.tongCanHoi} cảnh chờ)`
  $('#o-lo-phan-loai').max = kq.tongLo
}

$('#nut-doc-phan-loai').onclick = async () => {
  if (!keHoachFt) { await baoTin('Bấm "Lọc sơ" trước đã.'); return }
  const kq = await window.api.docPhanLoai($('#o-tra-loi-phan-loai').value, keHoachFt, thuMucDung)
  if (!kq.ok) {
    $('#ket-qua-phan-loai').textContent = kq.loi
    $('#ket-qua-phan-loai').className = 'ghi-chu ghi-chu-vang'
    return
  }
  keHoachFt = kq.keHoach
  const conCho = keHoachFt.canh.filter((c) => c.canHoi).length
  $('#ket-qua-phan-loai').textContent = `Đọc ${kq.soDoc} cảnh · đổi ${kq.soDoi} nhãn · còn ${conCho} cảnh chờ Claude` +
    (kq.canhBao ? ' · ' + kq.canhBao : '')
  $('#ket-qua-phan-loai').className = kq.canhBao ? 'ghi-chu ghi-chu-vang' : 'ghi-chu ghi-chu-xanh'
  $('#o-tra-loi-phan-loai').value = ''
  // Cảnh vừa được xác nhận biến khỏi danh sách "chờ", nên lô kế tiếp lại là lô 1.
  $('#o-lo-phan-loai').value = 1
  if (!conCho) locFt = 'footage'
  veFootage()
}

async function veNguonFootage() {
  const n = await window.api.nguonFootage()
  const muc = [
    ['Pexels', n.bat.pexels, n.coKhoaPexels ? 'đã tắt trong Cài đặt' : 'chưa có khoá'],
    ['Pixabay', n.bat.pixabay, n.coKhoaPixabay ? 'đã tắt trong Cài đặt' : 'chưa có khoá'],
    ['Wikimedia Commons', n.bat.wikimedia, 'đã tắt'],
    ['Library of Congress', n.bat.loc, 'đã tắt']
  ]
  $('#trang-thai-nguon').innerHTML = 'Nguồn: ' + muc.map(([ten, bat, vi]) =>
    `<span class="${bat ? 'manh' : 'canh-bao-manh'}">${bat ? '✔' : '✘'} ${ten}${bat ? '' : ' (' + vi + ')'}</span>`).join(' · ') +
    (!n.bat.pexels && !n.bat.pixabay ? '<div class="canh-bao-manh">Không có Pexels/Pixabay thì gần như không có VIDEO — chỉ còn ảnh tư liệu. Lấy khoá miễn phí ở Cài đặt → Footage thật.</div>' : '')
}

$('#nut-tim-tai-ft').onclick = async () => {
  if (!keHoachFt) { await baoTin('Bấm "Lọc sơ" (và nên hỏi Claude) trước đã.'); return }
  if (!canCoThuMuc()) return
  if (!(await kiemKhopFt())) { await baoTin('Kế hoạch không khớp bộ cảnh hiện tại — xem dòng cảnh báo ở Bước 1.'); return }
  const conCho = keHoachFt.canh.filter((c) => c.canHoi).length
  if (conCho && !(await hoiCo(`Còn ${conCho} cảnh chưa qua Claude — các cảnh này sẽ KHÔNG được tìm (tạm tính là AI, trừ cảnh luật đã gắn FOOTAGE). Tìm luôn?`, 'Tìm luôn'))) return
  $('#nut-tim-tai-ft').disabled = true
  $('#ghi-chu-tim-tai').textContent = 'Đang tìm và tải…'
  try {
    const kq = await window.api.timTaiFootage(thuMucDung, keHoachFt)
    if (kq.keHoach) keHoachFt = kq.keHoach
    if (!kq.ok) { await baoTin(kq.loi); return }
    $('#ghi-chu-tim-tai').textContent = `Tải ${kq.soTai}/${kq.soCan} cảnh · ${kq.soKhongThay} cảnh không tìm ra` +
      (kq.loi.length ? ` · ${kq.loi.length} lỗi (xem Nhật ký)` : '')
    $('#ghi-chu-tim-tai').className = kq.loi.length ? 'ghi-chu ghi-chu-vang' : 'ghi-chu ghi-chu-xanh'
    locFt = 'footage'
  } finally {
    $('#nut-tim-tai-ft').disabled = false
    veFootage()
  }
}

$('#nut-dung-ft').onclick = () => window.api.dungFootage()

$$('#loc-footage .chip').forEach((b) => {
  b.onclick = () => { locFt = b.dataset.loc; veFootage() }
})

function locDongFootage() {
  if (!keHoachFt) return []
  const ds = keHoachFt.canh
  if (locFt === 'footage') return ds.filter((c) => c.loai === 'FOOTAGE')
  if (locFt === 'can-hoi') return ds.filter((c) => c.canHoi)
  if (locFt === 'khong-thay') return ds.filter((c) => c.loai === 'FOOTAGE' && !(c.chon && c.chon.tep))
  if (locFt === 'ai') return ds.filter((c) => c.loai === 'AI')
  return ds
}

function nhanFt(c) {
  if (c.loai === 'FOOTAGE' && c.chon && c.chon.tep) return '<span class="nhan-video nhan-ft-co">FOOTAGE</span>'
  if (c.loai === 'FOOTAGE') return `<span class="nhan-video nhan-ft-thieu">${c.khongThay ? 'KHÔNG THẤY' : 'CHƯA TẢI'}</span>`
  if (c.canHoi) return '<span class="nhan-video nhan-ft-cho">CHỜ CLAUDE</span>'
  return '<span class="nhan-video nhan-ft-ai">AI</span>'
}

function veFootage() {
  $$('#loc-footage .chip').forEach((b) => b.classList.toggle('chip-chon', b.dataset.loc === locFt))
  const soFt = soCoTepFootage().length
  $('#so-canh-footage-anh').textContent = soFt ? `(${soFt} cảnh có footage)` : '(chưa có kế hoạch footage)'

  const bang = $('#bang-footage')
  if (!keHoachFt) {
    $('#tom-tat-footage').innerHTML = ''
    bang.innerHTML = '<tbody><tr><td class="ghi-chu" style="padding:18px">Chưa có kế hoạch. Cắt cảnh → Lọc sơ.</td></tr></tbody>'
    return
  }
  const ds = keHoachFt.canh
  const dem = (f) => ds.filter(f).length
  $('#tom-tat-footage').innerHTML = [
    [ds.length, 'tổng cảnh'],
    [soFt, 'có footage'],
    [dem((c) => c.loai === 'FOOTAGE' && !(c.chon && c.chon.tep)), 'FOOTAGE chưa có tệp'],
    [dem((c) => c.canHoi), 'chờ Claude'],
    [ds.length - soFt, 'cảnh cho Flow']
  ].map(([so, chu]) => `<div><div class="so-to">${so}</div><span>${chu}</span></div>`).join('')

  const dong = locDongFootage()
  bang.innerHTML = `<thead><tr><th>STT</th><th>Nhãn</th><th>Cảnh</th><th>Tìm gì</th><th>Đang dùng</th><th>Bản khác (bấm để đổi)</th></tr></thead>`
  const than = document.createElement('tbody')
  if (!dong.length) than.innerHTML = '<tr><td colspan="6" class="ghi-chu" style="padding:18px">Không có cảnh nào trong nhóm này.</td></tr>'
  for (const c of dong.slice(0, 200)) {
    const tr = document.createElement('tr')
    tr.dataset.so = c.so
    const chon = c.chon
    const dangDung = chon && chon.tep
      ? `<div class="o-thumb-ft"><img src="${thoat(chon.thumb || '')}" alt="" loading="lazy"></div>
         <div class="ghi-chu"><b>${thoat(chon.tep)}</b><br>${thoat(chon.nguon)} · ${thoat(chon.giayPhep || '')}
         ${chon.loai === 'video' ? ` · ${chon.thoiLuong || '?'}s` : ''}${chon.rong ? ` · ${chon.rong}px` : ''}
         ${chon.trang ? `<br><a href="#" data-ngoai="${thoat(chon.trang)}">trang gốc</a>` : ''}</div>`
      : '<span class="ghi-chu">—</span>'
    const khac = (c.ungVien || []).filter((u) => !chon || u.id !== chon.id).map((u) =>
      `<button class="the-ung-vien" data-id="${thoat(u.id)}" title="${thoat(u.nguon + ' · ' + (u.tieuDe || '') + ' · điểm ' + u.diem)}">
         <img src="${thoat(u.thumb || '')}" alt="" loading="lazy"><span>${u.loai === 'video' ? '▶ ' + (u.thoiLuong || '?') + 's' : 'ảnh'}</span></button>`).join('')
    tr.innerHTML = `
      <td class="so-lieu">${c.so}</td>
      <td>${nhanFt(c)}</td>
      <td class="o-chu-canh">${thoat(c.chu || '')}${c.lyDo ? `<div class="ghi-chu">${thoat(c.lyDo)}</div>` : ''}</td>
      <td class="o-tim-ft">
        <input class="o-tu-khoa-ft" value="${thoat(c.tuKhoaTim || '')}" placeholder="từ khóa tiếng Anh">
        <select class="o-kieu-ft"><option value="video"${c.kieu !== 'anh' ? ' selected' : ''}>video</option><option value="anh"${c.kieu === 'anh' ? ' selected' : ''}>ảnh</option></select>
        <div class="hang-nut-nho">
          <button class="nut nut-phu nut-nho nut-tim-lai-ft">${c.loai === 'FOOTAGE' ? 'Tìm lại' : 'Đổi sang footage'}</button>
          ${c.loai === 'FOOTAGE' ? '<button class="nut nut-do nut-ve-ai">Trả về AI</button>' : ''}
        </div>
      </td>
      <td class="o-dang-dung">${dangDung}</td>
      <td class="o-ban-khac">${khac || '<span class="ghi-chu">—</span>'}</td>`
    than.append(tr)
  }
  if (dong.length > 200) {
    const tr = document.createElement('tr')
    tr.innerHTML = `<td colspan="6" class="ghi-chu" style="padding:12px">…và ${dong.length - 200} cảnh nữa — lọc theo nhóm để xem.</td>`
    than.append(tr)
  }
  bang.append(than)
}

$('#bang-footage').addEventListener('click', async (su) => {
  const tr = su.target.closest('tr[data-so]')
  if (!tr || !keHoachFt) return
  const so = Number(tr.dataset.so)

  const uv = su.target.closest('.the-ung-vien')
  if (uv) {
    if (!canCoThuMuc()) return
    const kq = await window.api.chonUngVien(thuMucDung, keHoachFt, so, uv.dataset.id)
    if (kq.keHoach) keHoachFt = kq.keHoach
    if (!kq.ok) await baoTin(kq.loi)
    veFootage()
    return
  }
  if (su.target.closest('.nut-ve-ai')) {
    const kq = await window.api.doiLoaiCanh(thuMucDung, keHoachFt, so, 'AI')
    keHoachFt = kq.keHoach
    veFootage()
    return
  }
  if (su.target.closest('.nut-tim-lai-ft')) {
    if (!canCoThuMuc()) return
    const tuKhoa = tr.querySelector('.o-tu-khoa-ft').value.trim()
    if (!tuKhoa) { await baoTin('Nhập từ khóa tìm kiếm tiếng Anh cho cảnh này đã.'); return }
    const kieu = tr.querySelector('.o-kieu-ft').value
    const doi = await window.api.doiLoaiCanh(thuMucDung, keHoachFt, so, 'FOOTAGE', tuKhoa, kieu)
    keHoachFt = doi.keHoach
    const kq = await window.api.timTaiFootage(thuMucDung, keHoachFt, [so])
    if (kq.keHoach) keHoachFt = kq.keHoach
    if (!kq.ok) await baoTin(kq.loi)
    else if (!kq.soTai) await baoTin(`Không tìm/tải được footage cho cảnh ${so}` + (kq.loi.length ? ': ' + kq.loi.map((l) => l.loi).join(' · ') : '. Thử từ khóa khác, ngắn hơn.'))
    veFootage()
  }
})

$('#nut-xuat-loc').onclick = async () => {
  if (!keHoachFt) { await baoTin('Chưa có kế hoạch footage.'); return }
  if (!canCoThuMuc()) return
  if (!(await kiemKhopFt())) { await baoTin('Kế hoạch không khớp bộ cảnh hiện tại — xem dòng cảnh báo ở Bước 1.'); return }
  const kq = await window.api.xuatExcelLoc(thuMucDung, keHoachFt)
  if (!kq.ok) { await baoTin(kq.loi); return }
  $('#o-chuoi-so-flow').value = kq.chuoi
  $('#ghi-chu-xuat-loc').textContent = `canh-cho-flow.xlsx: ${kq.soConLai} cảnh cho Flow · ${kq.soFootage} cảnh footage · kèm chuoi-so-flow.txt + ghi-cong-footage.txt`
  $('#ghi-chu-xuat-loc').className = 'ghi-chu ghi-chu-xanh'
  datTienDo({ phanTram: 100, viec: 'Xuất Excel đã lọc xong', chiTiet: thuMucDung, trangThai: 'xong' })
}

$('#nut-chep-chuoi-so').onclick = async () => {
  const v = $('#o-chuoi-so-flow').value
  if (!v) { await baoTin('Xuất Excel đã lọc trước để có chuỗi số.'); return }
  await chepVaBao(v, $('#ghi-chu-xuat-loc'))
}

function veKiemDu(k, them = '') {
  const ds = (arr, max = 40) => arr.length ? arr.slice(0, max).join(', ') + (arr.length > max ? ` … (+${arr.length - max})` : '') : ''
  const dong = []
  dong.push(k.ok
    ? `<div class="manh">✔ Đủ hình cho cả ${k.soCanh} cảnh${k.coAudio ? ' và đủ giọng đọc' : ''} — đưa thư mục này vào CapCut Draft Studio được.</div>`
    : `<div class="canh-bao-manh"><b>Chưa đủ để dựng.</b></div>`)
  if (k.thieuHinh.length) dong.push(`<div class="canh-bao-manh">Thiếu hình ${k.thieuHinh.length} cảnh: ${ds(k.thieuHinh)}</div>`)
  if (k.trungSo.length) dong.push(`<div class="canh-bao-manh">Một số có hai tệp trong cùng thư mục: ${ds(k.trungSo)}</div>`)
  if (k.thua.length) dong.push(`<div class="canh-bao-manh">Số vượt tổng ${k.soCanh} cảnh (nhầm dự án?): ${ds(k.thua)}</div>`)
  if (k.thieuAudio.length) dong.push(`<div class="canh-bao-manh">Thiếu giọng đọc: ${ds(k.thieuAudio)}</div>`)
  if (!k.coAudio) dong.push('<div class="ghi-chu">Chưa có thư mục Audio/ — thêm giọng đọc đánh số (1.mp3, 2.mp3…) rồi kiểm lại.</div>')
  if (k.haiHinh.length) dong.push(`<div class="ghi-chu">Có cả video lẫn ảnh (CapCut dùng video, ảnh làm dự phòng): ${ds(k.haiHinh)}</div>`)
  $('#ket-qua-kiem-du').innerHTML = them + dong.join('')
}

$('#nut-gom-flow').onclick = async () => {
  if (!keHoachFt) { await baoTin('Chưa có kế hoạch footage.'); return }
  if (!canCoThuMuc()) return
  const kq = await window.api.gomTepFlow(thuMucDung, keHoachFt)
  if (kq.huy) return
  if (!kq.ok) { await baoTin(kq.loi); return }
  const them = `<div>Đã chép <b>${kq.soChep}</b> tệp Flow.` +
    (kq.boQua.length ? ` Bỏ qua ${kq.boQua.length} tệp (không có số đầu tên / trùng cảnh footage).` : '') +
    (kq.nhieuTep.length ? ` ${kq.nhieuTep.length} cảnh Flow có nhiều bản — lấy bản đầu (${kq.nhieuTep.slice(0, 5).map((n) => n.chon).join(', ')}…).` : '') +
    (kq.thua.length ? ` <span class="canh-bao-manh">${kq.thua.length} tệp mang số lớn hơn tổng số cảnh, không chép.</span>` : '') + '</div>'
  veKiemDu(kq.kiem, them)
}

$('#nut-kiem-du').onclick = async () => {
  if (!canCoThuMuc()) return
  const soCanh = keHoachFt ? keHoachFt.canh.length : canhHienTai.length
  if (!soCanh) { await baoTin('Chưa biết tổng số cảnh — cắt cảnh hoặc mở thư mục có kế hoạch.'); return }
  const kq = await window.api.kiemDuThuMuc(thuMucDung, soCanh)
  if (!kq.ok) { await baoTin(kq.loi); return }
  veKiemDu(kq.kiem)
}

// ---------------------------------------------------------------------------
// Trình duyệt: nút mở nhanh
// ---------------------------------------------------------------------------
$$('.nut-mo-nhanh').forEach((b) => { b.onclick = () => moTrongApp(b.dataset.url) })
$('#nut-sang-radar').onclick = () => {
  moMan('de-xuat')
  $$('.tab-de-xuat').find((t) => t.dataset.tab === 'radar').click()
}
$('#hop-da-chon').onclick = () => moMan('loi-thoai')

// ---------------------------------------------------------------------------
// Kiểm thử tầng 2: nạp dữ liệu MẪU vào các bảng để ảnh chụp có cái mà xem.
// Bảng trống thì ảnh chụp không cho biết thumbnail có hiện không, ô tick có
// lệch không, tiêu đề dài có đè cột không. Ảnh mẫu là SVG nội tuyến vì máy
// kiểm thử không ra được mạng.
// ---------------------------------------------------------------------------
window.smokeDuLieuMau = async function () {
  const mau = (i, mauNen) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" x2="1">` +
    `<stop offset="0" stop-color="${mauNen}"/><stop offset="1" stop-color="#1a2132"/></linearGradient></defs>` +
    `<rect width="320" height="180" fill="url(#g)"/><text x="18" y="100" font-size="40" font-family="Arial" fill="#fff">#${i}</text></svg>`)
  const tieuDe = [
    'The Forgotten Prophet Nobody Talks About — The Full Story Of What Really Happened',
    'Why This Ancient City Vanished Overnight',
    'The Untold Story of the Last Kingdom (Full Documentary)',
    'She Was Written Out Of History. Here Is Why.',
    'Hidden History: 7 Places The Old Maps Got Wrong'
  ]
  const kenh = ['Old Scroll Stories', 'Quiet History', 'Deep Past Channel', 'Forgotten Pages', 'Map Room']
  const mauNen = ['#8b5cf6', '#ff7a1a', '#17c3b2', '#ffcc33', '#ff4d4f']
  const dong = tieuDe.map((t, i) => ({
    videoId: `mauVideo00${i}`,
    tieuDe: t,
    tenKenh: kenh[i],
    kenhId: `UCmau${i}`,
    views: [912000, 340000, 128000, 76000, 41000][i],
    vph: [5200, 2100, 800, 450, 190][i],
    tyLeSub: [18.2, 3.4, 0.6, 1.1, 0.4][i],
    vuotTrungVi: [7.1, 3.2, 1.4, 1.1, 0.9][i],
    subKenh: [50000, 100000, 2100000, 68000, 850][i],
    coKenh: ['vuaNho', 'vuaNho', 'lon', 'vuaNho', 'tiHon'][i],
    quocGia: i === 2 ? 'GB' : 'US',
    thoiLuongGiay: [3720, 2410, 5400, 1980, 1300][i],
    ngayDang: new Date(Date.now() - (i + 1) * 36 * 3600000).toISOString(),
    diem: [2.41, 1.62, 0.3, 0.9, -0.4][i],
    nhan: ['NỔ VIEW', 'NỔ VIEW', 'BÌNH THƯỜNG', 'KHÁ', 'BÌNH THƯỜNG'][i],
    tuKhoaNguon: ['bible stories'],
    lienKet: `https://www.youtube.com/watch?v=mauVideo00${i}`,
    thumbnailNho: mau(i + 1, mauNen[i]),
    // Trường của radar
    nhanDeXuat: ['ĐẨY MẠNH', 'ĐẨY MẠNH', 'MẠNH', 'CÓ ĐỀ XUẤT', 'CÓ ĐỀ XUẤT'][i],
    soNguon: [6, 4, 2, 1, 1][i],
    tongNguon: 9,
    khopLinhVuc: i !== 4,
    laHatGiong: i === 1,
    trenTrangChu: i === 0
  }))
  ketQua = dong
  veBang()
  $('#the-ket-qua').hidden = false
  $('#tom-tat-ket-qua').textContent = '5 video mẫu (kiểm thử giao diện)'
  bangRadar = dong
  veBangRadar()
  $('#the-ket-qua-radar').hidden = false
  $('#tom-tat-radar').textContent = '5 video mẫu từ 9 nguồn · 2 ĐẨY MẠNH'
  $('#nhap-linh-vuc').value = 'bible stories, old testament'
  await datChon(dong.slice(0, 3), true, 'Ý tưởng')

  // Footage mẫu: đủ bốn trạng thái nhãn + ảnh đang dùng + bản khác.
  const cauFt = [
    'In 1963, thousands of people marched on Washington for civil rights, filling the streets for miles.',
    '"Do not be afraid," she whispered, as the angel stepped out of the light.',
    'Aerial footage of the Mississippi River shows how wide the great flood really was that spring.',
    'The old city of Chicago burned for three days, and the smoke could be seen from the lake.',
    'Moses lifted his staff and the sea parted before the frightened crowd.'
  ]
  const uvMau = (i, loai, nguon) => ({ id: `mau-${i}`, nguon, loai, tieuDe: 'mẫu ' + i, thumb: mau(i, mauNen[i % 5]), thoiLuong: loai === 'video' ? 14 + i : 0, rong: 1920, diem: 3 - i / 10, giayPhep: nguon === 'Wikimedia Commons' ? 'Public domain' : nguon + ' License' })
  thuMucDung = '/may-kiem-thu/san-xuat'
  keHoachFt = {
    canh: cauFt.map((chu, i) => ({ so: i + 1, ten: String(i + 1).padStart(3, '0'), chu, soTu: 20, giayUoc: 9, loai: 'AI', canHoi: false, kieu: 'video', tuKhoaTim: '', lyDo: '', ungVien: [] }))
  }
  Object.assign(keHoachFt.canh[0], { loai: 'FOOTAGE', kieu: 'anh', tuKhoaTim: '1963 march on washington crowd', lyDo: 'sự kiện lịch sử có ảnh tư liệu',
    chon: { ...uvMau(1, 'anh', 'Wikimedia Commons'), tep: 'Images/001.jpg', trang: 'https://commons.wikimedia.org/' }, ungVien: [uvMau(1, 'anh', 'Wikimedia Commons'), uvMau(2, 'anh', 'Library of Congress'), uvMau(3, 'anh', 'Pexels')] })
  Object.assign(keHoachFt.canh[2], { loai: 'FOOTAGE', tuKhoaTim: 'mississippi river flood aerial',
    chon: { ...uvMau(4, 'video', 'Pexels'), tep: 'Videos/003.mp4' }, ungVien: [uvMau(4, 'video', 'Pexels'), uvMau(5, 'video', 'Pixabay'), uvMau(6, 'video', 'Pexels'), uvMau(7, 'anh', 'Pixabay')] })
  Object.assign(keHoachFt.canh[3], { loai: 'FOOTAGE', tuKhoaTim: 'great chicago fire 1871', khongThay: true })
  Object.assign(keHoachFt.canh[1], { canHoi: false, lyDo: 'yếu tố AI: angel, whispered · có thoại' })
  locFt = 'tat-ca'
  $('#thu-muc-dung').innerHTML = `Thư mục dựng: <code>${thoat(thuMucDung)}</code> · kế hoạch mẫu (kiểm thử giao diện)`
  $('#o-chuoi-so-flow').value = '2,4-5'
  veKiemDu({ ok: false, soCanh: 5, thieuHinh: [4], trungSo: [], thua: [], thieuAudio: [], haiHinh: [], coAudio: false })
  veFootage()
  return { soDong: dong.length, daChon: videoDaChon.length, canhFootage: keHoachFt.canh.length }
}

// ---------------------------------------------------------------------------
// Kiểm thử tầng 2: hợp đồng dữ liệu giữa giao diện và store.js.
//
// Đây là loại lỗi im lặng nhất: giao diện ghi tên khoá khác với tên mà bên kia
// đọc, không ai ném lỗi, chỉ là cài đặt "bấm xong không có tác dụng gì".
// ---------------------------------------------------------------------------
const KHOA_PHUC_TAP = ['khoaApi', 'kenhTheoDoi', 'khoSkill', 'taiKhoan', 'khoNhanVat', 'khoBoiCanh', 'oPrompt']

window.smokeKiemKhoaCaiDat = function () {
  if (!caiDatHienTai) return ['chưa tải được cài đặt']
  const boQua = new Set(KHOA_PHUC_TAP)
  return Object.keys(caiDatHienTai)
    .filter((k) => !boQua.has(k))
    .filter((k) => !document.querySelector(`[data-khoa="${k}"]`))
}

// ---------------------------------------------------------------------------
taiCaiDat()
  .then(() => taiVideoDaChon())
  .then(() => taiDuAn())
  .then(() => veKhaNangCapNhat())
  .then(() => moMan('y-tuong'))
  .catch((loi) => {
    datTienDo({ phanTram: 100, viec: 'Không tải được cài đặt', chiTiet: loi.message, soLoi: 1, trangThai: 'loi' })
  })
