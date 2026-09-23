// Chấm điểm video: phát hiện "nổ view".
//
// View thô KHÔNG phải tín hiệu — kênh 10 triệu sub video nào cũng nhiều view.
// Ba chỉ số dưới đây mới nói được "video này bất thường so với chính nó":
//   VPH            = view mỗi giờ, chuẩn hoá theo tuổi video
//   tỷ lệ view/sub = vượt quy mô kênh
//   vượt trung vị  = so với 20 video gần nhất của CHÍNH kênh đó (đáng tin nhất)
//
// Toàn bộ mô-đun là hàm thuần.

// Đọc thời lượng ISO-8601 của YouTube: PT1H2M3S, PT45S, P1DT2H...
function giayTuISO(iso) {
  if (typeof iso !== 'string') return 0
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/)
  if (!m) return 0
  const [, ngay, gio, phut, giay] = m
  return (Number(ngay || 0) * 86400) + (Number(gio || 0) * 3600) +
         (Number(phut || 0) * 60) + Math.round(Number(giay || 0))
}

function trungVi(mang) {
  const so = mang.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!so.length) return 0
  const giua = Math.floor(so.length / 2)
  return so.length % 2 ? so[giua] : (so[giua - 1] + so[giua]) / 2
}

function zScore(mang) {
  const so = mang.map((n) => (Number.isFinite(n) ? n : 0))
  if (so.length < 2) return so.map(() => 0)
  const tb = so.reduce((a, b) => a + b, 0) / so.length
  const phuongSai = so.reduce((a, b) => a + (b - tb) ** 2, 0) / so.length
  const lech = Math.sqrt(phuongSai)
  if (lech === 0) return so.map(() => 0)
  return so.map((n) => (n - tb) / lech)
}

function viewMoiGio(views, ngayDang, bayGio = Date.now()) {
  const dang = new Date(ngayDang).getTime()
  if (!Number.isFinite(dang)) return 0
  const gio = Math.max(1, (bayGio - dang) / 3600000) // tối thiểu 1 giờ, tránh chia cho ~0
  return views / gio
}

const TRONG_SO = { vph: 0.40, tyLeSub: 0.25, vuotTrungVi: 0.35 }

// ---------------------------------------------------------------------------
// Ưu tiên kênh VỪA VÀ NHỎ (mặc định 1.000–100.000 sub).
//
// Lý do: kênh nhỏ mà video nổ view nghĩa là CHỦ ĐỀ và CÁCH LÀM đang ăn khách —
// thứ học lại được. Kênh 5 triệu sub nổ view thì phần lớn là nhờ sẵn khán giả,
// học theo cũng không ra kết quả đó.
//
// Là CỘNG/TRỪ ĐIỂM chứ không loại hẳn: một video kênh lớn vượt trung vị 6 lần
// vẫn đáng xem. Muốn loại hẳn thì bật chiKenhVuaNho ở locVideo.
// ---------------------------------------------------------------------------
const KHOANG_KENH_MAC_DINH = { subToiThieu: 1000, subToiDa: 100000 }

const THUONG_CO_KENH = {
  vuaNho: 0.5,   // đúng khoảng cần tìm
  tiHon: -0.2,   // dưới 1.000 sub: số liệu quá ít, một video lạ là lệch hết
  lon: -0.6,     // trên 100.000 sub
  an: 0          // kênh ẩn số sub: không biết thì không cộng không trừ
}

// Kênh tự khai quốc gia khác Mỹ thì trừ điểm. Kênh để trống KHÔNG bị trừ —
// rất nhiều kênh Mỹ không điền mục này.
const TRU_KENH_NGOAI_MY = 0.4

function coKenh(subKenh, { subToiThieu, subToiDa } = {}, anSub = false) {
  const min = Number(subToiThieu) > 0 ? Number(subToiThieu) : KHOANG_KENH_MAC_DINH.subToiThieu
  const max = Number(subToiDa) > 0 ? Number(subToiDa) : KHOANG_KENH_MAC_DINH.subToiDa
  if (anSub || !(subKenh > 0)) return 'an'
  if (subKenh < min) return 'tiHon'
  if (subKenh <= max) return 'vuaNho'
  return 'lon'
}

// Video tiếng Anh? Chỉ dựa vào ngôn ngữ chủ kênh TỰ KHAI. Không khai thì coi
// như đạt — loại video không khai là loại gần nửa số video tiếng Anh thật.
function laTiengAnh(d) {
  const l = String(d.ngonNguAm || d.ngonNgu || '').toLowerCase()
  return !l || l === 'en' || l.startsWith('en-') || l.startsWith('en_')
}

function laKenhNgoaiMy(d) {
  return !!d.quocGia && String(d.quocGia).toUpperCase() !== 'US'
}

function nhanTheoDiem(diem, vuotTrungVi) {
  // Vượt trung vị kênh từ 3 lần trở lên thì là nổ view, bất kể điểm tổng hợp:
  // đây là bằng chứng trực tiếp, không cần so với các video khác trong bảng.
  if (vuotTrungVi >= 3) return 'NỔ VIEW'
  if (diem >= 2) return 'NỔ VIEW'
  if (diem >= 1.2) return 'TỐT'
  if (diem >= 0.5) return 'KHÁ'
  return 'BÌNH THƯỜNG'
}

// dong = { videoId, tieuDe, kenhId, tenKenh, views, likes, binhLuan, ngayDang,
//          thoiLuongGiay, subKenh, trungViKenh? }
function chamDiem(cacDong, { bayGio = Date.now(), caiDat = {} } = {}) {
  if (!cacDong.length) return []

  const uuTienVuaNho = caiDat.uuTienKenhVuaNho !== false
  const uuTienMy = caiDat.uuTienKenhMy !== false

  const daTinh = cacDong.map((d) => {
    const vph = viewMoiGio(d.views, d.ngayDang, bayGio)
    const tyLeSub = d.subKenh > 0 ? d.views / d.subKenh : 0
    const vuotTrungVi = d.trungViKenh > 0 ? d.views / d.trungViKenh : 0
    return { ...d, vph, tyLeSub, vuotTrungVi }
  })

  const zVph = zScore(daTinh.map((d) => Math.log10(1 + d.vph)))
  const zSub = zScore(daTinh.map((d) => Math.log10(1 + d.tyLeSub)))
  const zTV = zScore(daTinh.map((d) => Math.log10(1 + d.vuotTrungVi)))

  return daTinh.map((d, i) => {
    const goc = zVph[i] * TRONG_SO.vph + zSub[i] * TRONG_SO.tyLeSub + zTV[i] * TRONG_SO.vuotTrungVi
    const loaiCo = coKenh(d.subKenh, caiDat, d.anSub)
    let thuong = 0
    const lyDo = []
    if (uuTienVuaNho && THUONG_CO_KENH[loaiCo]) {
      thuong += THUONG_CO_KENH[loaiCo]
      lyDo.push(loaiCo === 'vuaNho' ? 'kênh vừa & nhỏ +0,5' : (loaiCo === 'lon' ? 'kênh lớn −0,6' : 'kênh tí hon −0,2'))
    }
    if (uuTienMy && laKenhNgoaiMy(d)) {
      thuong -= TRU_KENH_NGOAI_MY
      lyDo.push(`kênh khai quốc gia ${d.quocGia} −0,4`)
    }
    const lamTron = Math.round((goc + thuong) * 100) / 100
    return {
      ...d,
      vph: Math.round(d.vph),
      tyLeSub: Math.round(d.tyLeSub * 100) / 100,
      vuotTrungVi: Math.round(d.vuotTrungVi * 100) / 100,
      diem: lamTron,
      coKenh: loaiCo,
      lyDoThuong: lyDo,
      nhan: nhanTheoDiem(lamTron, d.vuotTrungVi)
    }
  }).sort((a, b) => b.diem - a.diem)
}

// Lọc theo cài đặt. Mặc định của kênh này: KHÔNG Shorts, chỉ video dài.
function locVideo(cacDong, caiDat = {}) {
  const {
    boShorts = true,
    thoiLuongToiThieuGiay = 61,
    chiVideoDai = false,
    viewToiThieu = 0,
    subToiDaTrieu = 0,
    chiTiengAnh = true,       // tệp khán giả Mỹ: bỏ video khai ngôn ngữ thoại khác tiếng Anh
    chiKenhMy = false,        // loại hẳn kênh khai quốc gia khác Mỹ (mặc định chỉ trừ điểm)
    chiKenhVuaNho = false     // loại hẳn kênh ngoài khoảng sub (mặc định chỉ trừ điểm)
  } = caiDat

  const nguong = chiVideoDai ? Math.max(thoiLuongToiThieuGiay, 20 * 60) : thoiLuongToiThieuGiay

  return cacDong.filter((d) => {
    if (boShorts && d.thoiLuongGiay > 0 && d.thoiLuongGiay < 61) return false
    if (d.thoiLuongGiay > 0 && d.thoiLuongGiay < nguong) return false
    if (viewToiThieu > 0 && d.views < viewToiThieu) return false
    if (subToiDaTrieu > 0 && d.subKenh > subToiDaTrieu * 1e6) return false
    if (chiTiengAnh && !laTiengAnh(d)) return false
    if (chiKenhMy && laKenhNgoaiMy(d)) return false
    if (chiKenhVuaNho) {
      const c = coKenh(d.subKenh, caiDat, d.anSub)
      // Kênh ẩn số sub: không chứng minh được là to hay nhỏ → giữ lại.
      if (c === 'lon' || c === 'tiHon') return false
    }
    return true
  })
}

module.exports = {
  giayTuISO, trungVi, zScore, viewMoiGio, chamDiem, locVideo, nhanTheoDiem, TRONG_SO,
  coKenh, laTiengAnh, laKenhNgoaiMy, THUONG_CO_KENH, KHOANG_KENH_MAC_DINH
}
