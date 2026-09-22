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
let cacPromptHienTai = []
let baoCaoHienTai = null

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
    $$('.loc-nhanh .chip:not(.chip-kenh)').forEach((c) => c.classList.toggle('chip-chon', c.dataset.loc === 'tat-ca'))
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

function veBang() {
  const dong = locHienTai === 'tat-ca'
    ? ketQua
    : (locHienTai === 'TỐT'
        ? ketQua.filter((d) => d.nhan === 'TỐT' || d.nhan === 'NỔ VIEW')
        : ketQua.filter((d) => d.nhan === locHienTai))

  const bang = $('#bang-ket-qua')
  bang.innerHTML = `
    <thead><tr>
      <th>Nhãn</th><th>Điểm</th><th>Tiêu đề</th><th>Kênh</th>
      <th>View</th><th>View/giờ</th><th>V/Sub</th><th>Vượt TV kênh</th>
      <th>Sub</th><th>Dài</th><th>Đăng</th><th>Từ khóa</th>
    </tr></thead>`
  const than = document.createElement('tbody')

  if (!dong.length) {
    than.innerHTML = '<tr><td colspan="12" class="ghi-chu" style="padding:18px">Không có dòng nào khớp bộ lọc.</td></tr>'
  }

  for (const d of dong) {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td><span class="nhan-video ${LOP_NHAN[d.nhan] || 'nhan-thuong'}">${thoat(d.nhan)}</span></td>
      <td class="so-lieu">${d.diem}</td>
      <td class="tieu-de"><a href="#" data-ngoai="${thoat(d.lienKet)}">${thoat(d.tieuDe)}</a></td>
      <td>${thoat(d.tenKenh)}</td>
      <td class="so-lieu">${soGon(d.views)}</td>
      <td class="so-lieu">${soGon(d.vph)}</td>
      <td class="so-lieu ${d.tyLeSub >= 1 ? 'manh' : ''}">${d.tyLeSub || '—'}</td>
      <td class="so-lieu ${d.vuotTrungVi >= 3 ? 'manh' : ''}">${d.vuotTrungVi ? d.vuotTrungVi + '×' : '—'}</td>
      <td class="so-lieu">${soGon(d.subKenh)}</td>
      <td class="so-lieu">${phutGiay(d.thoiLuongGiay)}</td>
      <td class="so-lieu">${soGioTruoc(d.ngayDang)}</td>
      <td class="ghi-chu">${thoat((d.tuKhoaNguon || []).join(', '))}</td>`
    than.append(tr)
  }
  bang.append(than)
}

$$('.loc-nhanh .chip').forEach((c) => {
  if (c.classList.contains('chip-kenh')) return
  c.onclick = () => {
    locHienTai = c.dataset.loc
    $$('.loc-nhanh .chip:not(.chip-kenh)').forEach((x) => x.classList.toggle('chip-chon', x === c))
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

  const bang = $('#bang-kenh')
  bang.innerHTML = `<thead><tr>
      <th>Nhãn</th><th>Vượt TV kênh</th><th>Tiêu đề</th><th>Kênh</th>
      <th>View</th><th>Tăng từ lần quét trước</th><th>Dài</th><th>Đăng</th>
    </tr></thead>`
  const than = document.createElement('tbody')
  if (!dong.length) {
    than.innerHTML = '<tr><td colspan="8" class="ghi-chu" style="padding:18px">Chưa có dòng nào.</td></tr>'
  }
  for (const d of dong) {
    const tt = d.tangTruong
      ? `+${soGon(d.tangTruong.tang)} trong ${d.tangTruong.soGio}h (${soGon(d.tangTruong.tangMoiGio)}/giờ)`
      : (d.soMocLichSu > 1 ? 'chưa đủ cách nhau 12h' : 'lần quét đầu')
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td><span class="nhan-video ${LOP_NHAN[d.nhan] || 'nhan-thuong'}">${thoat(d.nhan)}</span></td>
      <td class="so-lieu ${d.vuotTrungVi >= 3 ? 'manh' : ''}">${d.vuotTrungVi ? d.vuotTrungVi + '×' : '—'}</td>
      <td class="tieu-de"><a href="#" data-ngoai="${thoat(d.lienKet)}">${thoat(d.tieuDe)}</a></td>
      <td>${thoat(d.tenKenh)}</td>
      <td class="so-lieu">${soGon(d.views)}</td>
      <td class="ghi-chu">${thoat(tt)}</td>
      <td class="so-lieu">${phutGiay(d.thoiLuongGiay)}</td>
      <td class="so-lieu">${soGioTruoc(d.ngayDang)}</td>`
    than.append(tr)
  }
  bang.append(than)
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
  const kq = await window.api.promptDanY(duAnHienTai, $('#chon-skill').value, {})
  await chepVaBao(kq.prompt, $('#ghi-chu-dan-y'))
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
  const kq = await window.api.moTepKichBan()
  if (kq.huy) return
  if (!kq.ok) { await baoTin('Không đọc được tệp.'); return }
  $('#o-kiem-duyet').value = kq.chu
  $('#ghi-chu-nguon-kiem').textContent = 'Từ tệp: ' + kq.ten
}

$('#nut-kiem-duyet').onclick = async () => {
  const chu = $('#o-kiem-duyet').value.trim()
  if (!chu && !duAnHienTai) { await baoTin('Chưa có kịch bản để kiểm.'); return }
  const kq = await window.api.kiemDuyet(chu, null, duAnHienTai)
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
  const chu = $('#o-kiem-duyet').value.trim()
  const kq = await window.api.catCanh(chu, duAnHienTai, gop)
  if (!kq.ok) { await baoTin(kq.loi); return }
  canhHienTai = kq.canh
  moTaTheoCanh = {}
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
  const kq = await window.api.promptMoTa(canhHienTai, lo, moiLo)
  await chepVaBao(kq.prompt, $('#ghi-chu-lo'))
  $('#ghi-chu-lo').textContent += ` · lô ${kq.loThu}/${kq.tongLo} (${kq.soCanhTrongLo} cảnh)`
  $('#o-lo-thu').max = kq.tongLo
}

$('#nut-doc-mo-ta').onclick = async () => {
  const chu = $('#o-mo-ta-tra-ve').value
  const kq = await window.api.docMoTa(chu)
  if (kq.loi) {
    $('#ket-qua-mo-ta').textContent = kq.loi
    $('#ket-qua-mo-ta').className = 'ghi-chu ghi-chu-vang'
    return
  }
  Object.assign(moTaTheoCanh, kq.moTa)
  $('#ket-qua-mo-ta').textContent = `Đọc được ${kq.soDoc} cảnh · tổng đã có mô tả: ${Object.keys(moTaTheoCanh).length}/${canhHienTai.length}`
  $('#ket-qua-mo-ta').className = 'ghi-chu ghi-chu-xanh'
  $('#o-mo-ta-tra-ve').value = ''
  const lo = Number($('#o-lo-thu').value) || 1
  $('#o-lo-thu').value = lo + 1
}

$('#nut-tao-prompt').onclick = async () => {
  if (!canhHienTai.length) { await baoTin('Cắt cảnh trước đã.'); return }
  const kq = await window.api.taoPromptAnh(canhHienTai, moTaTheoCanh)
  cacPromptHienTai = kq.cacPrompt
  veBangCanh()
  $('#ghi-chu-xuat').textContent = kq.kiemTra.ok
    ? `Đã sinh ${cacPromptHienTai.length} prompt, số thứ tự liên tục.`
    : 'LỖI đánh số: ' + kq.kiemTra.loi.slice(0, 3).join('; ')
  $('#ghi-chu-xuat').className = kq.kiemTra.ok ? 'ghi-chu ghi-chu-xanh' : 'ghi-chu ghi-chu-vang'
}

$('#nut-xuat-prompt').onclick = async () => {
  if (!cacPromptHienTai.length) { await baoTin('Bấm "Sinh toàn bộ prompt" trước đã.'); return }
  const kq = await window.api.xuatPromptAnh(canhHienTai, cacPromptHienTai, duAnHienTai)
  if (kq.huy) return
  if (!kq.ok) { await baoTin('Xuất thất bại.'); return }
  $('#ghi-chu-xuat').textContent = `Đã xuất ${kq.soPrompt} prompt ra ${kq.thuMuc}`
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
  .then(() => taiDuAn())
  .then(() => moMan('y-tuong'))
  .catch((loi) => {
    datTienDo({ phanTram: 100, viec: 'Không tải được cài đặt', chiTiet: loi.message, soLoi: 1, trangThai: 'loi' })
  })
