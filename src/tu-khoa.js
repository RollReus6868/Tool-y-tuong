// Ghép từ khóa rời rạc thành 5 từ khóa đáng tìm nhất.
//
// Cột trụ: KHÔNG được đem hàng chục ứng viên đi gọi search.list để thử, vì mỗi
// lời gọi tốn 100 đơn vị quota (ngày chỉ có 10.000). Việc sàng lọc làm bằng
// autocomplete của YouTube — miễn phí, không tốn quota, và phản ánh nhu cầu tìm
// kiếm THẬT của người xem.
//
// Toàn bộ mô-đun này là hàm thuần: kiểm thử tầng 1 chạy được không cần mạng.

function chuanHoa(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function tachHatGiong(chuNhap) {
  // Nhận cả dấu phẩy, dấu chấm phẩy và xuống dòng.
  return [...new Set(
    String(chuNhap || '')
      .split(/[,;\n]+/)
      .map(chuanHoa)
      .filter(Boolean)
  )]
}

function toHop(mang, k) {
  const ketQua = []
  const deQuy = (batDau, hienTai) => {
    if (hienTai.length === k) {
      ketQua.push([...hienTai])
      return
    }
    for (let i = batDau; i < mang.length; i++) {
      hienTai.push(mang[i])
      deQuy(i + 1, hienTai)
      hienTai.pop()
    }
  }
  deQuy(0, [])
  return ketQua
}

// Bước 1 — sinh ứng viên, hoàn toàn cục bộ, miễn phí.
function sinhUngVien(hatGiong) {
  const hg = hatGiong.map(chuanHoa).filter(Boolean)
  const ra = []

  for (const t of hg) ra.push({ cum: t, tuGoc: [t], loai: 'don' })

  for (const [a, b] of toHop(hg, 2)) {
    ra.push({ cum: `${a} ${b}`, tuGoc: [a, b], loai: 'cap' })
  }

  // Tam chỉ sinh khi ít hạt giống, nếu không số ứng viên bùng nổ vô ích.
  if (hg.length <= 6) {
    for (const [a, b, c] of toHop(hg, 3)) {
      ra.push({ cum: `${a} ${b} ${c}`, tuGoc: [a, b, c], loai: 'tam' })
    }
  }
  return ra
}

// Bước 2 — chấm điểm một ứng viên dựa trên gợi ý autocomplete của chính nó.
//
// goiY = null  → không gọi được mạng, chỉ chấm cục bộ (và phải nói cho người
//                dùng biết là đang chấm mù).
// goiY = []    → YouTube không gợi ý gì: gần như không ai tìm cụm này.
function chamDiemUngVien(ungVien, goiY, { lichSu = {}, bayGio = Date.now() } = {}) {
  let diem = 0
  const vi = []

  if (ungVien.loai === 'cap') { diem += 0.3; vi.push('ghép 2 từ') }
  else if (ungVien.loai === 'tam') { diem += 0.1; vi.push('ghép 3 từ') }

  if (goiY === null) {
    vi.push('chưa chấm được nhu cầu (không gọi được gợi ý)')
  } else if (goiY.length === 0) {
    diem -= 1.5
    vi.push('YouTube không gợi ý cụm này')
  } else {
    diem += 2
    diem += Math.min(goiY.length, 5) * 0.3
    vi.push(`${goiY.length} gợi ý thật`)

    const cum = chuanHoa(ungVien.cum)
    if (goiY.some((g) => g.startsWith(cum))) {
      diem += 1
      vi.push('gợi ý bắt đầu đúng bằng cụm này')
    }
  }

  // Trừ điểm nếu đã tìm trong 24h qua — khỏi tốn quota tìm lại cái vừa tìm.
  const lanTruoc = lichSu[chuanHoa(ungVien.cum)]
  if (lanTruoc && bayGio - lanTruoc < 24 * 3600 * 1000) {
    diem -= 1.5
    vi.push('đã tìm trong 24h qua')
  }

  return { ...ungVien, diem: Math.round(diem * 100) / 100, viSao: vi }
}

// Các gợi ý long-tail lấy được từ autocomplete cũng là ứng viên — thường là
// những cụm giá trị nhất, vì chúng không nằm trong danh sách ghép máy móc.
function ungVienTuGoiY(cumGoc, goiY, hatGiong) {
  if (!Array.isArray(goiY)) return []
  const hg = hatGiong.map(chuanHoa)
  return goiY.slice(0, 5).map((g, i) => ({
    cum: g,
    tuGoc: hg.filter((t) => g.includes(t)),
    loai: 'goiY',
    diem: Math.round((3 + (5 - i) * 0.4) * 100) / 100,
    viSao: [`gợi ý thật của YouTube (vị trí ${i + 1}) cho "${cumGoc}"`]
  }))
}

// Bước 3 — chọn 5, ưu tiên điểm cao nhưng bắt buộc đa dạng: hai từ khóa trùng
// cả 2 hạt giống thì tìm ra kết quả gần y nhau, tốn 100 đơn vị quota vô ích.
function chonNamTuKhoa(daChamDiem, soLuong = 5) {
  const xep = [...daChamDiem].sort((a, b) => b.diem - a.diem || a.cum.localeCompare(b.cum))
  const chon = []

  const trungNhieu = (a, b) => {
    const ta = new Set(a.tuGoc || [])
    const chung = (b.tuGoc || []).filter((t) => ta.has(t))
    return chung.length >= 2
  }

  for (const uv of xep) {
    if (chon.length >= soLuong) break
    if (chon.some((c) => c.cum === uv.cum)) continue
    if (chon.some((c) => trungNhieu(c, uv))) continue
    chon.push(uv)
  }

  // Nếu luật đa dạng làm thiếu chỉ tiêu thì nới ra, thiếu từ khóa còn tệ hơn.
  if (chon.length < soLuong) {
    for (const uv of xep) {
      if (chon.length >= soLuong) break
      if (!chon.some((c) => c.cum === uv.cum)) chon.push(uv)
    }
  }
  return chon
}

// Chạy cả ba bước. layGoiYHam là hàm bất đồng bộ (cum) => mảng gợi ý | null,
// nhồi được hàm giả khi kiểm thử.
async function ghepTuKhoa(chuNhap, {
  layGoiYHam,
  soLuong = 5,
  lichSu = {},
  bayGio = Date.now(),
  gioiHanGoiMang = 14,
  baoTienDo = () => {}
} = {}) {
  const hatGiong = tachHatGiong(chuNhap)
  if (hatGiong.length === 0) {
    return { hatGiong: [], chon: [], tatCa: [], coMang: false }
  }

  const ungVien = sinhUngVien(hatGiong)

  // Chỉ hỏi autocomplete cho một số ứng viên hợp lý: hạt giống đơn trước, rồi
  // cặp, rồi tam. Mỗi lần hỏi rất nhẹ nhưng không nên hỏi 50 lần liền.
  const uuTien = [
    ...ungVien.filter((u) => u.loai === 'don'),
    ...ungVien.filter((u) => u.loai === 'cap'),
    ...ungVien.filter((u) => u.loai === 'tam')
  ].slice(0, gioiHanGoiMang)

  const daCham = []
  const themTuGoiY = []
  let coMang = false

  for (let i = 0; i < uuTien.length; i++) {
    const uv = uuTien[i]
    baoTienDo({ phanTram: Math.round(((i + 1) / uuTien.length) * 100), viec: `Hỏi gợi ý: ${uv.cum}` })
    const goiY = layGoiYHam ? await layGoiYHam(uv.cum) : null
    if (Array.isArray(goiY)) coMang = true
    daCham.push(chamDiemUngVien(uv, goiY, { lichSu, bayGio }))
    if (Array.isArray(goiY) && goiY.length) {
      themTuGoiY.push(...ungVienTuGoiY(uv.cum, goiY, hatGiong))
    }
  }

  // Các ứng viên không được hỏi mạng vẫn giữ lại, chấm cục bộ.
  for (const uv of ungVien) {
    if (!daCham.some((d) => d.cum === uv.cum)) {
      daCham.push(chamDiemUngVien(uv, null, { lichSu, bayGio }))
    }
  }

  // Gộp ứng viên từ gợi ý, bỏ trùng cụm.
  const gop = [...daCham]
  for (const g of themTuGoiY) {
    if (!gop.some((x) => chuanHoa(x.cum) === chuanHoa(g.cum))) gop.push(g)
  }

  return {
    hatGiong,
    chon: chonNamTuKhoa(gop, soLuong),
    tatCa: gop.sort((a, b) => b.diem - a.diem),
    coMang
  }
}

module.exports = {
  chuanHoa,
  tachHatGiong,
  toHop,
  sinhUngVien,
  chamDiemUngVien,
  ungVienTuGoiY,
  chonNamTuKhoa,
  ghepTuKhoa
}
