// Giao diện: chủ đề màu, sáng/tối, thu gọn thanh bên.
//
// Tệp này nạp ở <head> và chạy TRƯỚC khi trang vẽ: đặt thuộc tính lên <html>
// ngay, nên mở app không bị chớp từ tối sang sáng. Toàn bộ màu nằm trong
// style.css — ở đây chỉ đặt ba thuộc tính, không ghi màu nào cả.
;(function () {
  var KHOA = 'tool-y-tuong'
  var CHU_DE = [
    ['sunset', 'Hoàng hôn'], ['ocean', 'Đại dương'], ['midnight', 'Nửa đêm'],
    ['aurora', 'Cực quang'], ['forest', 'Rừng'], ['candy', 'Kẹo ngọt']
  ]
  var goc = document.documentElement

  // localStorage có thể ném lỗi (hồ sơ hỏng, hết chỗ) — giao diện vẫn phải chạy.
  function doc(ten, macDinh) {
    try { return localStorage.getItem(KHOA + '-' + ten) || macDinh } catch (_) { return macDinh }
  }
  function ghi(ten, giaTri) {
    try { localStorage.setItem(KHOA + '-' + ten, giaTri) } catch (_) {}
  }

  var trangThai = {
    chuDe: doc('chu-de', 'sunset'),
    cheDo: doc('che-do', 'toi'),
    thanhBen: doc('thanh-ben', 'day')
  }
  if (!CHU_DE.some(function (c) { return c[0] === trangThai.chuDe })) trangThai.chuDe = 'sunset'

  function apDung() {
    goc.classList.toggle('dark', trangThai.cheDo !== 'sang')
    goc.setAttribute('data-chu-de', trangThai.chuDe)
    goc.setAttribute('data-thanh-ben', trangThai.thanhBen)
    var luoi = document.getElementById('luoi-chu-de')
    if (luoi) {
      Array.prototype.forEach.call(luoi.children, function (o) {
        o.classList.toggle('dang-chon', o.dataset.chuDe === trangThai.chuDe)
      })
    }
    var cheDo = document.getElementById('nut-che-do')
    if (cheDo) cheDo.title = trangThai.cheDo === 'sang' ? 'Đang sáng — bấm để chuyển sang tối' : 'Đang tối — bấm để chuyển sang sáng'
    // Trình duyệt trong app là một lớp phủ đặt theo toạ độ: thanh bên đổi bề
    // rộng thì phải báo để lớp đó dời theo, nếu không nó đè lệch lên giao diện.
    setTimeout(function () { window.dispatchEvent(new Event('resize')) }, 230)
  }

  function dat(thayDoi) {
    for (var k in thayDoi) trangThai[k] = thayDoi[k]
    ghi('chu-de', trangThai.chuDe); ghi('che-do', trangThai.cheDo); ghi('thanh-ben', trangThai.thanhBen)
    apDung()
  }

  apDung()

  document.addEventListener('DOMContentLoaded', function () {
    var luoi = document.getElementById('luoi-chu-de')
    if (luoi) {
      CHU_DE.forEach(function (c) {
        var o = document.createElement('button')
        o.type = 'button'
        o.className = 'o-chu-de'
        o.dataset.chuDe = c[0]
        o.innerHTML = '<span class="cham cham-' + c[0] + '"></span><span></span>'
        o.lastChild.textContent = c[1]
        o.onclick = function () { dat({ chuDe: c[0] }) }
        luoi.appendChild(o)
      })
    }
    var cheDo = document.getElementById('nut-che-do')
    if (cheDo) cheDo.onclick = function () { dat({ cheDo: trangThai.cheDo === 'sang' ? 'toi' : 'sang' }) }
    var thuGon = document.getElementById('nut-thu-gon')
    if (thuGon) thuGon.onclick = function () { dat({ thanhBen: trangThai.thanhBen === 'gon' ? 'day' : 'gon' }) }
    apDung()
  })

  window.giaoDien = { dat: dat, trangThai: trangThai, CHU_DE: CHU_DE }
})()
