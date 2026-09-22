// Giao diện Tool Ý Tưởng. Chạy trong renderer, chỉ nói chuyện với tiến trình
// chính qua window.api (khai báo ở preload.js).

const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]

let caiDatHienTai = null
let khoaApi = []
let deXuat = []          // 5 từ khóa đang hiện trong ô sửa
let ungVienTatCa = []
let ketQua = []          // dòng video sau khi tìm
let locHienTai = 'tat-ca'

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
    chiTiet: d.chiTiet || (d.tong ? `${d.daXong}/${d.tong}` : '')
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
  return true
}
window.smokeMoMan = (ten) => { if (!moMan(ten)) throw new Error('Không có màn ' + ten) }

$$('.muc').forEach((b) => { b.onclick = () => moMan(b.dataset.man) })

// Mở link ra trình duyệt ngoài (CSP không cho inline onclick).
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
  capNhatUocKichBan()

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

function thoat(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
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

// Ước lượng cho kịch bản dài — hiện ngay trong Cài đặt để thấy con số thật.
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
// Ghép từ khóa
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

// ---------------------------------------------------------------------------
// Tìm video
// ---------------------------------------------------------------------------
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
    $$('.chip').forEach((c) => c.classList.toggle('chip-chon', c.dataset.loc === 'tat-ca'))
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

$$('.chip').forEach((c) => {
  c.onclick = () => {
    locHienTai = c.dataset.loc
    $$('.chip').forEach((x) => x.classList.toggle('chip-chon', x === c))
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
// Đây là loại lỗi im lặng nhất: giao diện ghi tên khoá khác với tên mà engine
// đọc, không ai ném lỗi, chỉ là cài đặt "bấm xong không có tác dụng gì".
// ---------------------------------------------------------------------------
window.smokeKiemKhoaCaiDat = function () {
  if (!caiDatHienTai) return ['chưa tải được cài đặt']
  const boQua = new Set(['khoaApi'])
  return Object.keys(caiDatHienTai)
    .filter((k) => !boQua.has(k))
    .filter((k) => !document.querySelector(`[data-khoa="${k}"]`))
}

// ---------------------------------------------------------------------------
taiCaiDat()
  .then(() => moMan('y-tuong'))
  .catch((loi) => { datTienDo({ phanTram: 100, viec: 'Không tải được cài đặt', chiTiet: loi.message, soLoi: 1, trangThai: 'loi' }) })
