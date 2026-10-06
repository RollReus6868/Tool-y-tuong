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
// 2b. Độ giống KỊCH BẢN CŨ của chính kênh
//
// "Nội dung không chân thực" là lỗi xét trên CẢ KÊNH: các video na ná nhau,
// cùng một khuôn chỉ đổi danh từ. Soi một kịch bản riêng lẻ thì không thấy —
// phải so nó với các kịch bản đã viết trước đó.
// ---------------------------------------------------------------------------

// Che tên riêng và con số rồi mới so. Hai video làm từ MỘT KHUÔN chỉ đổi tên
// nhân vật, địa danh, năm tháng thì gần như không trùng cụm 5 từ nào (cụm nào
// cũng dính một cái tên) — đo chữ thô báo xanh trong khi đây đúng là thứ YouTube
// gọi là "format sao chép tới mức các video thay thế được cho nhau".
const TU_CHE = 'tenrieng'
function cheTenRieng(chu) {
  return tachCau(chu).map((cau) => cau.split(/\s+/).map((tu, i) => {
    if (/\d/.test(tu)) return TU_CHE
    // Từ mở ngoặc kép ("Run,") là đầu câu thoại, không phải tên riêng.
    if (i > 0 && /^\p{Lu}/u.test(tu) && !/^I(['’]\w+)?[.,!?;:]*$/.test(tu)) return TU_CHE
    return tu
  }).join(' ').replace(new RegExp(`(${TU_CHE}\\s+)+${TU_CHE}`, 'g'), TU_CHE)).join(' ')
}

// Độ cụ thể: số tên riêng + con số trên mỗi 1.000 từ. Kịch bản AI làm từ khuôn
// thường "a poor boy", "a small town", "one day" — không tên, không năm, không
// nơi chốn. Đó là mặt chữ của "nội dung chung chung".
function doCuThe(chu, { soTuToiThieu = 400, nguong = 8 } = {}) {
  const soTu = demTu(chu)
  if (soTu < soTuToiThieu) return { soTu, moi1000: null, mucDo: 'CHƯA ĐO', nguong }
  const soChiTiet = cheTenRieng(chu).split(/\s+/).filter((t) => t === TU_CHE).length
  const moi1000 = Math.round((soChiTiet / soTu) * 10000) / 10
  return {
    soTu, soChiTiet, moi1000, nguong,
    mucDo: moi1000 < nguong ? 'VÀNG' : 'XANH',
    ghiChuNguong: `Ngưỡng ${nguong} chi tiết / 1.000 từ là do tool này đặt ra, không phải con số YouTube công bố.`
  }
}

function giongKichBanCu(kichBan, cacBanCu = []) {
  const che = cheTenRieng(kichBan)
  const tatCa = cacBanCu
    .map((b) => ({
      ten: b.ten,
      tyLe: doGiongBanGoc(kichBan, b.vanBan).tyLe,
      tyLeKhuon: doGiongBanGoc(che, cheTenRieng(b.vanBan)).tyLe
    }))
    .sort((a, b) => Math.max(b.tyLe, b.tyLeKhuon) - Math.max(a.tyLe, a.tyLeKhuon))
  // Trùng từ 90% trở lên là CHÍNH kịch bản này (dán vào kiểm mà không chọn dự
  // án của nó) chứ không phải "cùng khuôn" — tính vào là báo đỏ oan.
  const ds = tatCa.filter((d) => d.tyLe < 90)
  const caoNhat = ds.reduce((m, d) => Math.max(m, d.tyLe), 0)
  const khuonCaoNhat = ds.reduce((m, d) => Math.max(m, d.tyLeKhuon), 0)
  const muc = (v, vang, do_) => (v >= do_ ? 2 : (v >= vang ? 1 : 0))
  return {
    soBanSo: ds.length,
    boQuaYHet: tatCa.length - ds.length,
    caoNhat,
    khuonCaoNhat,
    mucDo: ['XANH', 'VÀNG', 'ĐỎ'][Math.max(muc(caoNhat, 10, 25), muc(khuonCaoNhat, 15, 35))],
    ds: ds.filter((d) => d.tyLe > 0 || d.tyLeKhuon > 0).slice(0, 5),
    ghiChuNguong: 'Ngưỡng do tool này đặt ra, không phải con số YouTube công bố: trùng chữ 10% / 25%, trùng khuôn (đã che tên riêng và con số) 15% / 35%. Mở đầu và kết thúc giống nhau giữa các video thì YouTube cho phép — đáng lo là khi phần thân cũng trùng.'
  }
}

// ---------------------------------------------------------------------------
// 3. Quét chính sách
// ---------------------------------------------------------------------------

const SO_TU_MO_DAU = 75   // ≈ 30 giây đầu ở 150 từ/phút

// Word và trình duyệt tự đổi ' thành ’ — không quy về một dạng thì "won't"
// trong bộ luật không bao giờ khớp "won’t" trong kịch bản.
function chuanHoaDeQuet(chu) {
  return String(chu || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase()
}

function mauCuaLuat(l) {
  const mau = []
  // Ranh giới viết bằng "không đứng cạnh chữ/số" thay cho \b, vì \b hỏng với
  // từ khóa bắt đầu hoặc kết thúc bằng ký tự không phải chữ ("9/11").
  for (const tu of (l.tuKhoa || [])) {
    mau.push(new RegExp(`(?<![\\p{L}\\p{N}])${thoatRegex(chuanHoaDeQuet(tu))}(?![\\p{L}\\p{N}])`, 'gu'))
  }
  for (const m of (l.mau || [])) {
    try { mau.push(new RegExp(m, 'gi')) } catch (_) { /* skill-kiem-duyet.js đã báo lỗi cú pháp lúc nạp */ }
  }
  return mau
}

function quetChinhSach(chu, boLuat) {
  const luat = (boLuat && boLuat.luat) || []
  const thap = chuanHoaDeQuet(chu)
  const moDau = thap.split(/\s+/).filter(Boolean).slice(0, SO_TU_MO_DAU).join(' ')
  const cau = tachCau(chu)
  const cauThap = cau.map(chuanHoaDeQuet)
  const soTu = demTu(chu)
  const co = []
  const chuaXet = []   // luật "phải có" bị bỏ qua vì văn bản quá ngắn

  for (const l of luat) {
    const vung = l.phamVi === 'mo-dau' ? moDau : thap
    const trung = []
    for (const mau of mauCuaLuat(l)) {
      let m
      while ((m = mau.exec(vung)) !== null) {
        if (m[0] === '') { mau.lastIndex++; continue }
        trung.push(m[0].trim())
        if (trung.length > 200) break
      }
    }

    const chung = {
      ma: l.ma, ten: l.ten, mucDo: l.mucDo, nhom: l.nhom || 'quang-cao', nhomCon: l.nhomCon || '',
      giaiThich: l.giaiThich, huongSua: l.huongSua, nguonSkill: l.nguonSkill || ''
    }

    // Luật "phải có": gắn cờ khi THIẾU. Văn bản quá ngắn thì không xét, kẻo
    // đoạn thử 50 từ nào cũng bị báo thiếu.
    if (l.loai === 'phai-co') {
      if (soTu < (l.soTuToiThieu || 300)) { chuaXet.push({ ma: l.ma, nhomCon: l.nhomCon || '' }); continue }
      const moi1000 = (trung.length / soTu) * 1000
      if (moi1000 >= (l.toiThieuMoi1000Tu || 1)) continue
      co.push({
        ...chung, soLan: trung.length, tuTrung: [], viDu: [],
        chiTiet: `Thấy ${trung.length} dấu hiệu trong ${soTu.toLocaleString('vi-VN')} từ, cần ít nhất ${Math.ceil((l.toiThieuMoi1000Tu || 1) * soTu / 1000)}.`
      })
      continue
    }

    if (trung.length < (l.toiThieuLan || 1)) continue
    // Ngưỡng MẬT ĐỘ: "died" xuất hiện 5 lần trong 11.000 từ là kể chuyện bình
    // thường; 150 lần là cả video xoay quanh mất mát. Đếm tuyệt đối không phân
    // biệt được hai trường hợp đó.
    const moi1000 = soTu ? (trung.length / soTu) * 1000 : 0
    if (l.nguongMoi1000Tu && moi1000 < l.nguongMoi1000Tu) continue
    const tuTrung = [...new Set(trung)]
    co.push({
      ...chung,
      soLan: trung.length,
      tuTrung,
      viDu: cau.filter((_, i) => tuTrung.some((t) => cauThap[i].includes(t))).slice(0, 3),
      chiTiet: l.phamVi === 'mo-dau' ? `Nằm trong ${SO_TU_MO_DAU} từ đầu.`
        : (l.nguongMoi1000Tu ? `${Math.round(moi1000 * 10) / 10} lần / 1.000 từ (ngưỡng ${l.nguongMoi1000Tu}).` : '')
    })
  }

  // Đỏ trước vàng; trong cùng mức thì lỗi cấp kênh lên đầu.
  const hang = (c) => (c.mucDo === 'đỏ' ? 0 : 10) + (c.nhom === 'kenh' ? 0 : c.nhom === 'cong-dong' ? 1 : 2)
  co.sort((a, b) => hang(a) - hang(b))

  const soDo = co.filter((c) => c.mucDo === 'đỏ').length
  const soVang = co.filter((c) => c.mucDo === 'vàng').length
  return {
    co,
    chuaXet,
    soDo,
    soVang,
    soLuat: luat.length,
    ketLuan: soDo ? 'CÓ CỜ ĐỎ' : (soVang ? 'CÓ CỜ VÀNG' : 'KHÔNG GẮN CỜ NÀO'),
    canhBao: 'Quét từ khóa là GẮN CỜ RỦI RO, không phải xác nhận an toàn. Không có cờ nào không có nghĩa là kịch bản chắc chắn qua được chính sách.'
  }
}

function thoatRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------------------------------------------------------------------------
// 4. Bảng rủi ro kiếm tiền — gom mọi phép đo về đúng câu người dùng hỏi:
//    "kịch bản này có làm kênh bị tắt kiếm tiền không, vì cái gì?"
// ---------------------------------------------------------------------------

function ruiRoKiemTien({ lap, giong, giongCu, chinhSach, cuThe }) {
  const co = (ma) => ((chinhSach && chinhSach.co) || []).find((c) => c.ma === ma)
  const muc = []
  const them = (kieu, ten, mucDo, lyDo) => muc.push({ kieu, ten, mucDo, lyDo })

  // A — tắt kiếm tiền cả kênh
  if (!giong) them('A', 'Nội dung dùng lại (so với lời thoại gốc)', 'CHƯA ĐO', 'Chưa có bản gốc để so. Với kênh viết lại video người khác, đây là phép đo quan trọng nhất.')
  else them('A', 'Nội dung dùng lại (so với lời thoại gốc)', giong.mucDo, `Trùng ${giong.tyLe}% cụm 5 từ với bản gốc.`)

  const soNong = (lap.banDoNhiet.diemNong || []).length
  const mucLap = lap.tyLeLap >= 6 ? 'ĐỎ' : (lap.tyLeLap >= 2 || lap.cauGanTrung.length >= 5 || soNong >= 3 ? 'VÀNG' : 'XANH')
  them('A', 'Lặp ý trong bài (kéo dài thời lượng)', mucLap,
    `${lap.tyLeLap}% nội dung nằm trong cụm lặp · ${lap.cauGanTrung.length} nhóm câu gần trùng · ${soNong} cặp đoạn xa nhau mà giống nhau.`)

  if (!giongCu || !giongCu.soBanSo) them('A', 'Cùng khuôn với kịch bản cũ của kênh', 'CHƯA ĐO', 'Chưa có kịch bản của dự án nào khác để so.')
  else them('A', 'Cùng khuôn với kịch bản cũ của kênh', giongCu.mucDo,
    `So với ${giongCu.soBanSo} kịch bản khác: trùng chữ cao nhất ${giongCu.caoNhat}%, trùng khuôn (đã che tên riêng, con số) cao nhất ${giongCu.khuonCaoNhat}%` +
    (giongCu.ds[0] ? ` — với "${giongCu.ds[0].ten}".` : '.'))

  if (cuThe) them('A', 'Chi tiết cụ thể (tên riêng, con số)', cuThe.mucDo,
    cuThe.moi1000 === null ? 'Kịch bản quá ngắn để xét.'
      : `${cuThe.moi1000} chi tiết / 1.000 từ (ngưỡng ${cuThe.nguong}).` + (cuThe.mucDo === 'VÀNG' ? ' Ít tên người, nơi chốn, năm tháng — đọc lên giống truyện làm từ khuôn.' : ''))

  // Ba nhóm của chính sách "nội dung không chân thực" (YouTube nêu rõ 7/2026).
  // Gom theo trường nhomCon của luật chứ không theo mã cứng, để skill thêm sau
  // tự rơi đúng dòng.
  if (chinhSach) {
    const nhomCon = [
      ['chung-chung', 'Chung chung hoặc lặp lại (dấu hiệu làm từ khuôn)'],
      ['kho-chiu', 'Không thoả mãn hoặc gây khó chịu'],
      ['ai-chuyen-gia', 'Nhân vật AI đóng vai chuyên gia']
    ]
    for (const [ma, ten] of nhomCon) {
      const ds = chinhSach.co.filter((c) => c.nhomCon === ma)
      const chuaXet = (chinhSach.chuaXet || []).some((c) => c.nhomCon === ma)
      const mucDo = ds.some((c) => c.mucDo === 'đỏ') ? 'ĐỎ' : (ds.length ? 'VÀNG' : (chuaXet ? 'CHƯA ĐO' : 'XANH'))
      them('A', ten, mucDo, ds.length
        ? ds.map((c) => c.ten + (c.tuTrung.length ? ` (${c.tuTrung.slice(0, 3).join(', ')})` : '')).join(' · ')
        : (chuaXet ? 'Kịch bản quá ngắn để xét đủ.' : 'Không thấy dấu hiệu (máy chỉ đếm cụm từ — vẫn nên tự đọc lại).'))
    }
  }

  // B, C — từng video
  if (chinhSach) {
    for (const [nhom, kieu, ten] of [['quang-cao', 'B', 'Giới hạn hoặc mất quảng cáo video'], ['cong-dong', 'C', 'Nguy cơ gỡ video']]) {
      const ds = chinhSach.co.filter((c) => c.nhom === nhom)
      const do_ = ds.filter((c) => c.mucDo === 'đỏ')
      them(kieu, ten, do_.length ? 'ĐỎ' : (ds.length ? 'VÀNG' : 'XANH'),
        ds.length ? ds.map((c) => c.ten).join(' · ') : 'Không gắn cờ nào.')
    }
  }

  const coDo = muc.some((m) => m.mucDo === 'ĐỎ')
  const coVang = muc.some((m) => m.mucDo === 'VÀNG')
  const chuaDo = muc.some((m) => m.mucDo === 'CHƯA ĐO')
  return {
    muc,
    // Còn mục chưa đo thì KHÔNG được kết luận sạch: phép đo quan trọng nhất
    // (giống bản gốc) vắng mặt mà báo xanh là báo sai.
    ketLuan: coDo ? 'RỦI RO CAO — SỬA TRƯỚC KHI SẢN XUẤT'
      : (coVang ? 'CÓ ĐIỂM CẦN SỬA' : (chuaDo ? 'CHƯA ĐO ĐỦ — CHƯA KẾT LUẬN ĐƯỢC' : 'CHƯA THẤY RỦI RO')),
    mucDo: coDo ? 'ĐỎ' : (coVang || chuaDo ? 'VÀNG' : 'XANH'),
    ghiChu: 'A = tắt kiếm tiền cả kênh · B = video bị giới hạn/mất quảng cáo · C = gỡ video. Tool chỉ soi được CHỮ của kịch bản: không thấy hình ảnh, thumbnail, tiêu đề, giọng đọc.'
  }
}

// ---------------------------------------------------------------------------
// Báo cáo tổng
// ---------------------------------------------------------------------------

function baoCao(kichBan, {
  banGoc = '',
  boLuat = null,
  kichBanCu = null,
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
  const giongCu = kichBanCu ? giongKichBanCu(kichBan, kichBanCu) : null
  const cuThe = doCuThe(kichBan)
  const lap = {
    tyLeLap,
    cum4: cum4.slice(0, 40),
    cum8: cum8.slice(0, 25),
    cauGanTrung: ganTrung.slice(0, 20),
    moDauCauLap: moDau.slice(0, 12),
    banDoNhiet: nhiet
  }

  return {
    ruiRo: ruiRoKiemTien({ lap, giong, giongCu, chinhSach, cuThe }),
    cuThe,
    giongKichBanCu: giongCu,
    tongQuan: {
      soTu,
      soCau: cau.length,
      soTuMoiCau: cau.length ? Math.round(soTu / cau.length) : 0,
      phutDocUoc: Math.round((soTu / Math.max(1, tuMoiPhut)) * 10) / 10,
      doPhongPhuTu: soTu ? Math.round((new Set(tachTu(kichBan)).size / soTu) * 1000) / 10 : 0
    },
    lap,
    giongBanGoc: giong,
    chinhSach,
    huongSua: goiYSua({ tyLeLap, ganTrung, moDau, giong, nhiet, giongCu, chinhSach })
  }
}

// Gợi ý sửa phải CỤ THỂ, không được là câu chung chung kiểu "nên viết đa dạng
// hơn" — người dùng đọc xong không biết phải mở đoạn nào ra sửa.
function goiYSua({ tyLeLap, ganTrung, moDau, giong, nhiet, giongCu, chinhSach }) {
  const y = []

  // Lỗi cấp kênh và cờ đỏ lên đầu: đó là thứ làm mất tiền, lặp chữ chỉ là thứ
  // làm video nhàm.
  for (const c of ((chinhSach && chinhSach.co) || [])) {
    if (c.mucDo !== 'đỏ' && c.nhom !== 'kenh') continue
    y.push({
      mucDo: c.mucDo === 'đỏ' ? 'đỏ' : 'vàng',
      viec: `${c.ten}${c.tuTrung.length ? ' ("' + c.tuTrung.slice(0, 3).join('", "') + '")' : ''} — ${c.huongSua}`
    })
  }
  if (giongCu && giongCu.mucDo !== 'XANH' && giongCu.ds[0]) {
    y.push({
      mucDo: giongCu.mucDo === 'ĐỎ' ? 'đỏ' : 'vàng',
      viec: `Trùng ${giongCu.caoNhat}% với kịch bản "${giongCu.ds[0].ten}" — hai video đang dùng chung một khuôn. Đổi cấu trúc và cách dẫn dắt phần thân, không chỉ đổi tên nhân vật.`
    })
  }

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
  giongKichBanCu,
  cheTenRieng,
  doCuThe,
  ruiRoKiemTien,
  SO_TU_MO_DAU,
  mucDoGiong,
  gopCumLienTiep,
  quetChinhSach,
  baoCao,
  TU_CHUC_NANG
}
