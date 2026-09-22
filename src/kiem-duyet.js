// Kiểm duyệt kịch bản — CHẠY HOÀN TOÀN CỤC BỘ, không gọi AI, không gọi mạng.
//
// Toàn bộ mô-đun là hàm thuần: chạy tức thì, miễn phí, và quan trọng nhất là
// cho ra cùng một kết quả mỗi lần chạy. Ba nhóm phép đo:
//
//   1. LẶP NỘI DUNG — thứ giết kịch bản 11.000 từ. Viết dài tới phần 6 là
//      người viết (hay AI) bắt đầu nói lại ý phần 2 bằng lời khác.
//   2. ĐỘ GIỐNG BẢN GỐC — vì kịch bản sinh ra TỪ lời thoại video người khác,
//      đây đúng là thứ chính sách "reused content" của YouTube nhắm tới.
//   3. QUÉT CHÍNH SÁCH — gắn cờ rủi ro theo bộ luật sửa được.
//
// Nói rõ giới hạn, không được ngụ ý ngược lại: quét từ khóa là GẮN CỜ RỦI RO,
// KHÔNG PHẢI xác nhận an toàn.

// ---------------------------------------------------------------------------
// Tách chữ
// ---------------------------------------------------------------------------

function chuanHoaTu(t) {
  return String(t || '').toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')
}

function tachTu(chu) {
  return String(chu || '')
    .split(/\s+/)
    .map(chuanHoaTu)
    .filter(Boolean)
}

function tachCau(chu) {
  return String(chu || '')
    // Tách ở . ! ? và xuống dòng, giữ lại dấu.
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((c) => c.replace(/\s+/g, ' ').trim())
    .filter((c) => c.length > 0)
}

function nGram(cacTu, n) {
  const ra = []
  for (let i = 0; i + n <= cacTu.length; i++) ra.push(cacTu.slice(i, i + n).join(' '))
  return ra
}

function demTu(chu) {
  return tachTu(chu).length
}

// ---------------------------------------------------------------------------
// 1a. Cụm từ lặp nguyên văn
// ---------------------------------------------------------------------------

function cumLap(chu, { n = 5, toiThieuLan = 2, boQuaThongDung = true } = {}) {
  const tu = tachTu(chu)
  const cum = nGram(tu, n)
  const dem = new Map()

  cum.forEach((c, i) => {
    if (!dem.has(c)) dem.set(c, [])
    dem.get(c).push(i)
  })

  const ra = []
  for (const [c, viTri] of dem) {
    if (viTri.length < toiThieuLan) continue
    // Cụm toàn từ chức năng ("of the in a") lặp là chuyện bình thường của mọi
    // văn bản tiếng Anh, gắn cờ chỉ tổ gây nhiễu.
    if (boQuaThongDung && toanTuChucNang(c)) continue
    ra.push({ cum: c, soLan: viTri.length, viTri })
  }
  return ra.sort((a, b) => b.soLan - a.soLan || b.cum.length - a.cum.length)
}

const TU_CHUC_NANG = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'but',
  'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'this', 'that',
  'these', 'those', 'he', 'she', 'they', 'we', 'you', 'i', 'his', 'her',
  'their', 'our', 'your', 'my', 'with', 'as', 'by', 'from', 'not', 'no',
  'so', 'if', 'then', 'than', 'there', 'here', 'what', 'which', 'who'
])

function toanTuChucNang(cum) {
  const tu = cum.split(' ')
  return tu.every((t) => TU_CHUC_NANG.has(t))
}

// ---------------------------------------------------------------------------
// 1b. Câu gần trùng — bắt cái lặp Ý đã đổi lời
//
// Đây mới là phép đo đáng giá. Lặp nguyên văn thì đọc lướt cũng thấy; còn ba
// đoạn nói cùng một ý bằng ba cách diễn đạt khác nhau thì máy dò chữ không
// thấy, mà người xem thì thấy ngay là nhàm.
// ---------------------------------------------------------------------------

// Bằm câu thành TẬP TỪ NỘI DUNG, không phải cụm 3 từ.
//
// Đã thử cụm 3 từ trước và nó hầu như không bắt được gì: hai câu nói cùng một ý
// nhưng đảo trật tự thì không có nổi một cụm 3 từ chung. Tập từ đơn cho độ nhạy
// cao hơn hẳn với đúng loại lặp hay gặp trong kịch bản dài — cùng ý, cùng vốn
// từ, đảo cách sắp.
function bamCau(cau) {
  return new Set(tachTu(cau).filter((t) => !TU_CHUC_NANG.has(t)))
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let chung = 0
  for (const x of a) if (b.has(x)) chung++
  return chung / (a.size + b.size - chung)
}

// GIỚI HẠN THẬT, phải nói rõ chứ không được ngụ ý ngược lại: phép đo này bắt
// được câu lặp gần nguyên văn và câu đảo trật tự từ. Nó KHÔNG bắt được câu
// diễn đạt lại hoàn toàn bằng vốn từ khác ("nobody said a word" ↔ "no one
// dared to utter a sound") — muốn bắt loại đó phải có mô hình ngữ nghĩa, không
// làm được bằng thuật toán đếm chữ. Loại lặp ý ở tầm đoạn thì bản đồ nhiệt bắt
// được, vì cả khối văn bản dùng chung vốn từ.
function cauGanTrung(chu, { nguong = 0.45, toiThieuTu = 6 } = {}) {
  const cau = tachCau(chu).filter((c) => demTu(c) >= toiThieuTu)
  const bam = cau.map((c) => bamCau(c))
  const cum = []
  const daGan = new Set()

  for (let i = 0; i < cau.length; i++) {
    if (daGan.has(i)) continue
    const nhom = [i]
    for (let j = i + 1; j < cau.length; j++) {
      if (daGan.has(j)) continue
      if (jaccard(bam[i], bam[j]) >= nguong) { nhom.push(j); daGan.add(j) }
    }
    if (nhom.length > 1) {
      daGan.add(i)
      cum.push({
        soCau: nhom.length,
        viTri: nhom,
        cau: nhom.map((k) => cau[k]),
        doGiong: Math.round(jaccard(bam[nhom[0]], bam[nhom[1]]) * 100)
      })
    }
  }
  return cum.sort((a, b) => b.soCau - a.soCau)
}

// ---------------------------------------------------------------------------
// 1c. Câu mở đầu lặp — "And then... And then... And then..."
// ---------------------------------------------------------------------------

// Mặc định 2 từ chứ không phải 3. Với 3 từ thì "and then he / and then he /
// and then the" bị đếm thành hai nhóm khác nhau và không nhóm nào đủ ngưỡng —
// đúng cái tật "And then... And then... And then..." cần bắt thì lại lọt.
function moDauCauLap(chu, { soTuDau = 2, toiThieuLan = 3 } = {}) {
  const cau = tachCau(chu)
  const dem = new Map()
  for (const c of cau) {
    const dau = tachTu(c).slice(0, soTuDau).join(' ')
    if (!dau) continue
    dem.set(dau, (dem.get(dau) || 0) + 1)
  }
  return [...dem.entries()]
    .filter(([, n]) => n >= toiThieuLan)
    .map(([dau, soLan]) => ({ moDau: dau, soLan }))
    .sort((a, b) => b.soLan - a.soLan)
}

// ---------------------------------------------------------------------------
// 1d. Bản đồ nhiệt — thấy vòng lặp nằm ở ĐÂU trong kịch bản
// ---------------------------------------------------------------------------

function banDoNhiet(chu, { soKhoi = 40 } = {}) {
  const tu = tachTu(chu)
  if (tu.length < soKhoi * 5) soKhoi = Math.max(4, Math.floor(tu.length / 5))
  const coKhoi = Math.ceil(tu.length / soKhoi)

  const khoi = []
  for (let i = 0; i < tu.length; i += coKhoi) {
    const lat = tu.slice(i, i + coKhoi).filter((t) => !TU_CHUC_NANG.has(t))
    khoi.push(new Set(nGram(lat, 2)))
  }

  const ma = []
  for (let i = 0; i < khoi.length; i++) {
    const hang = []
    for (let j = 0; j < khoi.length; j++) {
      hang.push(i === j ? 1 : Math.round(jaccard(khoi[i], khoi[j]) * 100) / 100)
    }
    ma.push(hang)
  }

  // Cặp khối xa nhau mà vẫn giống nhau = vòng lặp thật.
  const diemNong = []
  for (let i = 0; i < ma.length; i++) {
    for (let j = i + 2; j < ma.length; j++) {
      if (ma[i][j] >= 0.18) diemNong.push({ khoiA: i, khoiB: j, doGiong: ma[i][j] })
    }
  }
  return { soKhoi: khoi.length, tuMoiKhoi: coKhoi, ma, diemNong: diemNong.sort((a, b) => b.doGiong - a.doGiong) }
}

// ---------------------------------------------------------------------------
// 2. Độ giống bản gốc — mục quan trọng nhất của cả tool
// ---------------------------------------------------------------------------

function doGiongBanGoc(kichBan, banGoc, { n = 5 } = {}) {
  const tuKB = tachTu(kichBan)
  const tuBG = tachTu(banGoc)
  if (tuKB.length < n || tuBG.length < n) {
    return { tyLe: 0, soCumTrung: 0, tongCum: 0, cumTrung: [], mucDo: 'KHÔNG ĐỦ DỮ LIỆU' }
  }

  const tapGoc = new Set(nGram(tuBG, n))
  const cumKB = nGram(tuKB, n)
  const trung = []
  for (let i = 0; i < cumKB.length; i++) {
    if (tapGoc.has(cumKB[i])) trung.push({ cum: cumKB[i], viTri: i })
  }

  const tyLe = Math.round((trung.length / cumKB.length) * 1000) / 10
  return {
    tyLe,
    soCumTrung: trung.length,
    tongCum: cumKB.length,
    cumTrung: gopCumLienTiep(trung).slice(0, 60),
    mucDo: mucDoGiong(tyLe),
    // Nói rõ đây là ngưỡng do tool đặt ra, KHÔNG phải con số YouTube công bố.
    ghiChuNguong: 'Ngưỡng 8% và 20% là do tool này đặt ra để cảnh báo sớm, không phải con số YouTube công bố.'
  }
}

function mucDoGiong(tyLe) {
  if (tyLe >= 20) return 'ĐỎ'
  if (tyLe >= 8) return 'VÀNG'
  return 'XANH'
}

// Gộp các cụm trùng nằm liền nhau thành một đoạn dài, dễ đọc hơn là 40 cụm
// 5 từ chồng lên nhau.
function gopCumLienTiep(trung) {
  const ra = []
  for (const t of trung) {
    const cuoi = ra[ra.length - 1]
    if (cuoi && t.viTri <= cuoi.viTriCuoi + 1) {
      cuoi.viTriCuoi = t.viTri
      const themTu = t.cum.split(' ').slice(-1)[0]
      cuoi.doan += ' ' + themTu
    } else {
      ra.push({ viTriDau: t.viTri, viTriCuoi: t.viTri, doan: t.cum })
    }
  }
  return ra.sort((a, b) => b.doan.length - a.doan.length)
}

// ---------------------------------------------------------------------------
// 3. Quét chính sách
// ---------------------------------------------------------------------------

function quetChinhSach(chu, boLuat) {
  const luat = (boLuat && boLuat.luat) || []
  const thap = String(chu || '').toLowerCase()
  const cau = tachCau(chu)
  const co = []

  for (const l of luat) {
    const trung = []
    for (const tu of (l.tuKhoa || [])) {
      const mau = new RegExp(`\\b${thoatRegex(tu.toLowerCase())}\\b`, 'gi')
      let m
      while ((m = mau.exec(thap)) !== null) {
        trung.push({ tu, viTriKyTu: m.index })
        if (trung.length > 40) break
      }
    }
    if (!trung.length) continue

    co.push({
      ma: l.ma,
      ten: l.ten,
      mucDo: l.mucDo,
      giaiThich: l.giaiThich,
      huongSua: l.huongSua,
      soLan: trung.length,
      tuTrung: [...new Set(trung.map((t) => t.tu))],
      viDu: cau.filter((c) => trung.some((t) => c.toLowerCase().includes(t.tu.toLowerCase()))).slice(0, 3)
    })
  }

  const soDo = co.filter((c) => c.mucDo === 'đỏ').length
  const soVang = co.filter((c) => c.mucDo === 'vàng').length
  return {
    co,
    soDo,
    soVang,
    ketLuan: soDo ? 'CÓ CỜ ĐỎ' : (soVang ? 'CÓ CỜ VÀNG' : 'KHÔNG GẮN CỜ NÀO'),
    canhBao: 'Quét từ khóa là GẮN CỜ RỦI RO, không phải xác nhận an toàn. Không có cờ nào không có nghĩa là kịch bản chắc chắn qua được chính sách.'
  }
}

function thoatRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------------------------------------------------------------------------
// Báo cáo tổng
// ---------------------------------------------------------------------------

function baoCao(kichBan, {
  banGoc = '',
  boLuat = null,
  tuMoiPhut = 150,
  nguongCauGanTrung = 0.5
} = {}) {
  const soTu = demTu(kichBan)
  const cau = tachCau(kichBan)

  const cum4 = cumLap(kichBan, { n: 4, toiThieuLan: 2 })
  const cum8 = cumLap(kichBan, { n: 8, toiThieuLan: 2 })
  const ganTrung = cauGanTrung(kichBan, { nguong: nguongCauGanTrung })
  const moDau = moDauCauLap(kichBan)
  const nhiet = banDoNhiet(kichBan)

  // Phần trăm nội dung nằm trong một cụm lặp nào đó.
  const tuTrongCumLap = new Set()
  for (const c of cum8) for (const v of c.viTri) for (let i = 0; i < 8; i++) tuTrongCumLap.add(v + i)
  const tyLeLap = soTu ? Math.round((tuTrongCumLap.size / soTu) * 1000) / 10 : 0

  const giong = banGoc ? doGiongBanGoc(kichBan, banGoc) : null
  const chinhSach = boLuat ? quetChinhSach(kichBan, boLuat) : null

  return {
    tongQuan: {
      soTu,
      soCau: cau.length,
      soTuMoiCau: cau.length ? Math.round(soTu / cau.length) : 0,
      phutDocUoc: Math.round((soTu / Math.max(1, tuMoiPhut)) * 10) / 10,
      doPhongPhuTu: soTu ? Math.round((new Set(tachTu(kichBan)).size / soTu) * 1000) / 10 : 0
    },
    lap: {
      tyLeLap,
      cum4: cum4.slice(0, 40),
      cum8: cum8.slice(0, 25),
      cauGanTrung: ganTrung.slice(0, 20),
      moDauCauLap: moDau.slice(0, 12),
      banDoNhiet: nhiet
    },
    giongBanGoc: giong,
    chinhSach,
    huongSua: goiYSua({ tyLeLap, ganTrung, moDau, giong, nhiet })
  }
}

// Gợi ý sửa phải CỤ THỂ, không được là câu chung chung kiểu "nên viết đa dạng
// hơn" — người dùng đọc xong không biết phải mở đoạn nào ra sửa.
function goiYSua({ tyLeLap, ganTrung, moDau, giong, nhiet }) {
  const y = []

  if (giong && giong.mucDo === 'ĐỎ') {
    y.push({
      mucDo: 'đỏ',
      viec: `Kịch bản trùng ${giong.tyLe}% cụm 5 từ với lời thoại gốc — phải viết lại các đoạn được tô cam trước khi đăng.`
    })
  } else if (giong && giong.mucDo === 'VÀNG') {
    y.push({
      mucDo: 'vàng',
      viec: `Trùng ${giong.tyLe}% với bản gốc. Viết lại ${Math.min(5, giong.cumTrung.length)} đoạn trùng dài nhất bằng lời của mình.`
    })
  }

  for (const c of ganTrung.slice(0, 3)) {
    y.push({
      mucDo: 'vàng',
      viec: `${c.soCau} câu (vị trí ${c.viTri.join(', ')}) nói cùng một ý, giống nhau ${c.doGiong}%. Giữ câu đầu, thay câu thứ hai bằng ví dụ cụ thể, cắt các câu còn lại.`
    })
  }

  for (const m of moDau.slice(0, 2)) {
    y.push({ mucDo: 'vàng', viec: `${m.soLan} câu cùng mở đầu bằng "${m.moDau}". Đổi cách vào câu cho ít nhất một nửa.` })
  }

  for (const d of (nhiet.diemNong || []).slice(0, 2)) {
    y.push({
      mucDo: 'vàng',
      viec: `Khối ${d.khoiA + 1} và khối ${d.khoiB + 1} (cách nhau xa trong bài) lặp lại nhau — đây là vòng lặp thật, không phải trùng ngẫu nhiên.`
    })
  }

  if (tyLeLap < 2 && !y.length) {
    y.push({ mucDo: 'xanh', viec: 'Không thấy lặp đáng kể. Vẫn nên tự đọc lại phần mở đầu và phần kết.' })
  }
  return y
}

module.exports = {
  chuanHoaTu,
  tachTu,
  tachCau,
  nGram,
  demTu,
  cumLap,
  toanTuChucNang,
  bamCau,
  jaccard,
  cauGanTrung,
  moDauCauLap,
  banDoNhiet,
  doGiongBanGoc,
  mucDoGiong,
  gopCumLienTiep,
  quetChinhSach,
  baoCao,
  TU_CHUC_NANG
}
