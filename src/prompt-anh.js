// Cắt kịch bản thành cảnh và sinh prompt ảnh hàng loạt.
//
// CON SỐ PHẢI NHÌN THẲNG: 11.000 từ ÷ 27 từ/cảnh ≈ 408 cảnh. Bốn trăm lượt
// render là khối lượng rất lớn. Vì vậy có tuỳ chọn GỘP CẢNH: 2 cảnh một ảnh
// còn ~204 ảnh, mỗi ảnh ở trên màn hình ~18 giây — vẫn xem được nếu ảnh có
// chuyển động nhẹ, mà khối lượng giảm một nửa.
//
// CÁCH GIỮ NHÂN VẬT GIỐNG NHAU QUA 400 CẢNH: không trông chờ AI "nhớ" mặt.
// Mỗi nhân vật có MỘT đoạn mô tả cố định, và cảnh nào có nhân vật đó thì chèn
// NGUYÊN VĂN đoạn mô tả ấy vào prompt. Đó là thứ duy nhất thật sự hiệu quả.
//
// Toàn bộ mô-đun là hàm thuần.

const { demTu } = require('./kiem-duyet')

// ---------------------------------------------------------------------------
// Cắt cảnh
// ---------------------------------------------------------------------------

function tachCauGiuDau(chu) {
  return String(chu || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((c) => c.trim())
    .filter(Boolean)
}

// Câu dài quá thì cắt tiếp ở dấu phẩy — chứ đừng cắt giữa chừng cho đủ số từ,
// vì cảnh cụt nghĩa thì prompt ảnh sinh ra cũng vô nghĩa.
function cheNhoCau(cau, toiDaTu) {
  if (demTu(cau) <= toiDaTu) return [cau]
  const manh = cau.split(/(?<=,|;|—|–)\s+/)
  const ra = []
  let dem = []
  for (const m of manh) {
    dem.push(m)
    if (demTu(dem.join(' ')) >= toiDaTu) { ra.push(dem.join(' ')); dem = [] }
  }
  if (dem.length) ra.push(dem.join(' '))
  return ra.filter(Boolean)
}

function catCanh(kichBan, {
  tuMoiCanh = 27,
  toiDaTu = 40,
  giayMoiCanh = 9,
  gopCanh = 1
} = {}) {
  const cau = tachCauGiuDau(kichBan).flatMap((c) => cheNhoCau(c, toiDaTu))
  const canh = []
  let dem = []
  let soTu = 0

  const chot = () => {
    if (!dem.length) return
    const chu = dem.join(' ')
    canh.push({ chu, soTu: demTu(chu) })
    dem = []
    soTu = 0
  }

  for (const c of cau) {
    const n = demTu(c)
    // Thêm câu này vào có vượt xa mức mong muốn không? Nếu cảnh hiện tại đã
    // đủ dài rồi thì chốt trước, đừng nhồi.
    if (dem.length && soTu + n > toiDaTu) chot()
    dem.push(c)
    soTu += n
    if (soTu >= tuMoiCanh) chot()
  }
  chot()

  const sauGop = gopCanh > 1 ? gopNhieuCanh(canh, gopCanh) : canh

  return sauGop.map((c, i) => ({
    so: i + 1,                       // LIÊN TỤC TỪ 1 — xem ghi chú ở xuatPromptsTxt
    ten: String(i + 1).padStart(3, '0'),
    chu: c.chu,
    soTu: c.soTu,
    giayUoc: Math.round((c.soTu / Math.max(1, tuMoiCanh)) * giayMoiCanh * 10) / 10
  }))
}

function gopNhieuCanh(canh, moiNhom) {
  const ra = []
  for (let i = 0; i < canh.length; i += moiNhom) {
    const nhom = canh.slice(i, i + moiNhom)
    ra.push({
      chu: nhom.map((c) => c.chu).join(' '),
      soTu: nhom.reduce((a, c) => a + c.soTu, 0)
    })
  }
  return ra
}

function thongKeCanh(canh, { giayMoiCanh = 9 } = {}) {
  const tong = canh.reduce((a, c) => a + c.soTu, 0)
  const giay = canh.reduce((a, c) => a + c.giayUoc, 0)
  return {
    soCanh: canh.length,
    tongTu: tong,
    tuTrungBinh: canh.length ? Math.round(tong / canh.length) : 0,
    tongGiay: Math.round(giay),
    tongPhut: Math.round(giay / 60),
    canhQuaNgan: canh.filter((c) => c.soTu < 12).length,
    canhQuaDai: canh.filter((c) => c.soTu > 45).length
  }
}

// ---------------------------------------------------------------------------
// Kho nhân vật và bối cảnh
// ---------------------------------------------------------------------------

// muc = { ten, moTa, tuKhoa: [] }
function timTrongCanh(chuCanh, khoMuc) {
  const thap = String(chuCanh || '').toLowerCase()
  return (khoMuc || []).filter((m) => {
    const tu = [m.ten, ...(m.tuKhoa || [])].filter(Boolean)
    return tu.some((t) => {
      const s = String(t).toLowerCase().trim()
      return s.length >= 2 && thap.includes(s)
    })
  })
}

// ---------------------------------------------------------------------------
// Template prompt
// ---------------------------------------------------------------------------

const TEMPLATE_MAC_DINH = [
  '{style}',
  '{camera}',
  '{canh}',
  '{nhanVat}',
  '{boiCanh}',
  '{anhSang}',
  '{khongKhi}',
  '{duoi}'
].join(', ')

const MAC_DINH_O = {
  style: 'cinematic documentary still, photorealistic, 35mm film grain',
  camera: 'medium wide shot, eye level',
  anhSang: 'soft directional light, deep shadows',
  khongKhi: 'somber, contemplative',
  duoi: 'highly detailed, 16:9',
  amBan: 'text, watermark, logo, extra fingers, deformed hands, blurry, low quality'
}

function ghepPrompt(canh, {
  template = TEMPLATE_MAC_DINH,
  o = {},
  khoNhanVat = [],
  khoBoiCanh = [],
  moTaCanh = null
} = {}) {
  const gt = { ...MAC_DINH_O, ...o }
  const nhanVat = timTrongCanh(canh.chu, khoNhanVat)
  const boiCanh = timTrongCanh(canh.chu, khoBoiCanh)

  const thay = {
    style: gt.style,
    camera: (moTaCanh && moTaCanh.camera) || gt.camera,
    // Chế độ cục bộ: dùng thẳng câu của cảnh. Chế độ bàn giao Claude: dùng
    // phần mô tả Claude trả về.
    canh: (moTaCanh && [moTaCanh.subject, moTaCanh.action].filter(Boolean).join(' ')) || canh.chu,
    nhanVat: nhanVat.map((n) => n.moTa).filter(Boolean).join(', '),
    boiCanh: (moTaCanh && moTaCanh.setting) || boiCanh.map((b) => b.moTa).filter(Boolean).join(', '),
    anhSang: (moTaCanh && moTaCanh.lighting) || gt.anhSang,
    khongKhi: (moTaCanh && moTaCanh.mood) || gt.khongKhi,
    duoi: gt.duoi
  }

  const chu = template
    .replace(/\{(\w+)\}/g, (_, khoa) => thay[khoa] != null ? thay[khoa] : '')
    // Ô rỗng để lại dấu phẩy thừa — dọn cho sạch, prompt nhiều dấu phẩy liên
    // tiếp làm mô hình sinh ảnh hiểu sai trọng số.
    .replace(/\s*,\s*(?=,)/g, '')
    .replace(/,\s*,+/g, ',')
    .replace(/^\s*,\s*|\s*,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return {
    so: canh.so,
    ten: canh.ten,
    chuCanh: canh.chu,
    prompt: chu,
    amBan: gt.amBan,
    nhanVat: nhanVat.map((n) => n.ten),
    boiCanh: boiCanh.map((b) => b.ten)
  }
}

function taoTatCaPrompt(canh, tuyChon = {}) {
  const moTa = tuyChon.moTaTheoCanh || {}
  return canh.map((c) => ghepPrompt(c, { ...tuyChon, moTaCanh: moTa[c.so] || null }))
}

// ---------------------------------------------------------------------------
// Bàn giao Claude: xin mô tả cảnh dạng JSON, theo từng lô
// ---------------------------------------------------------------------------

function chiaLo(canh, moiLo = 50) {
  const ra = []
  for (let i = 0; i < canh.length; i += moiLo) ra.push(canh.slice(i, i + moiLo))
  return ra
}

function taoPromptMoTaCanh(loCanh, { style = MAC_DINH_O.style, khoNhanVat = [], loThu = 1, tongLo = 1 } = {}) {
  const khoi = []

  khoi.push([
    `===== LÔ ${loThu}/${tongLo} — MÔ TẢ CẢNH CHO PROMPT ẢNH =====`,
    `Phong cách ảnh chung: ${style}`,
    '',
    'Với mỗi cảnh dưới đây, mô tả thành hình ảnh cụ thể để đưa cho mô hình sinh ảnh.',
    'Chỉ tả thứ NHÌN THẤY ĐƯỢC. Không tả cảm xúc trừu tượng, không tả điều đang nghĩ.'
  ].join('\n'))

  if (khoNhanVat.length) {
    khoi.push([
      '===== NHÂN VẬT CỐ ĐỊNH (đã có mô tả riêng, ĐỪNG tả lại ngoại hình) =====',
      ...khoNhanVat.map((n) => `  · ${n.ten}: ${n.moTa}`),
      '',
      'Nếu cảnh nào có các nhân vật này, chỉ cần nhắc tên trong trường subject.',
      'Tool sẽ tự chèn nguyên văn đoạn mô tả ngoại hình vào — đó là cách giữ cho',
      'mặt nhân vật giống nhau qua hàng trăm cảnh.'
    ].join('\n'))
  }

  khoi.push([
    '===== CÁC CẢNH =====',
    ...loCanh.map((c) => `[${c.so}] ${c.chu}`)
  ].join('\n'))

  khoi.push([
    '===== ĐỊNH DẠNG TRẢ VỀ =====',
    'Trả về DUY NHẤT một mảng JSON, không kèm lời dẫn, không bọc trong khối mã:',
    '',
    '[',
    '  {"so": 1, "subject": "...", "action": "...", "setting": "...", "lighting": "...", "mood": "...", "camera": "..."},',
    '  {"so": 2, ...}',
    ']',
    '',
    `Đủ ${loCanh.length} phần tử, trường "so" đúng bằng số trong ngoặc vuông ở trên.`
  ].join('\n'))

  return khoi.join('\n\n')
}

// Bản xin PROMPT THƯỜNG — dùng khi không muốn dính rủi ro JSON vỡ.
function taoPromptMoTaCanhThuong(loCanh, {
  style = MAC_DINH_O.style,
  khoNhanVat = [],
  loThu = 1,
  tongLo = 1,
  amBan = MAC_DINH_O.amBan
} = {}) {
  const khoi = []

  khoi.push([
    `===== LÔ ${loThu}/${tongLo} — VIẾT PROMPT ẢNH =====`,
    `Phong cách ảnh chung, đưa vào MỌI prompt: ${style}`,
    '',
    'Với mỗi cảnh dưới đây, viết MỘT prompt ảnh hoàn chỉnh bằng tiếng Anh.',
    'Chỉ tả thứ NHÌN THẤY ĐƯỢC. Không tả cảm xúc trừu tượng, không tả điều đang nghĩ.'
  ].join('\n'))

  if (khoNhanVat.length) {
    khoi.push([
      '===== NHÂN VẬT CỐ ĐỊNH — chép NGUYÊN VĂN đoạn mô tả vào prompt =====',
      ...khoNhanVat.map((n) => `  · ${n.ten}: ${n.moTa}`),
      '',
      'Cảnh nào có các nhân vật này thì chép y nguyên đoạn mô tả ngoại hình vào',
      'prompt, không diễn giải lại bằng lời khác — đó là cách giữ cho mặt nhân',
      'vật giống nhau qua hàng trăm cảnh.'
    ].join('\n'))
  }

  khoi.push(['===== CÁC CẢNH =====', ...loCanh.map((c) => `[${c.so}] ${c.chu}`)].join('\n'))

  khoi.push([
    '===== ĐỊNH DẠNG TRẢ VỀ =====',
    'Mỗi prompt một dòng, mở đầu bằng số cảnh trong ngoặc vuông. Không lời dẫn,',
    'không khối mã, không dòng trống giữa các prompt:',
    '',
    '[1] <prompt đầy đủ của cảnh 1>',
    '[2] <prompt đầy đủ của cảnh 2>',
    '',
    `Đủ ${loCanh.length} dòng, số trong ngoặc đúng bằng số ở trên.`,
    `Prompt đã gồm sẵn phong cách chung, tool sẽ dùng NGUYÊN VĂN chứ không ghép thêm.`,
    `(Phần loại trừ tool tự thêm, không cần viết: ${amBan})`
  ].join('\n'))

  return khoi.join('\n\n')
}

// Đọc JSON Claude trả về. Chịu được cả khi bị bọc trong khối mã hoặc kèm lời dẫn.
function phanTichMoTaCanh(chu) {
  const s = String(chu || '').trim()
  if (!s) return { moTa: {}, soDoc: 0, loi: 'Chưa dán gì vào.' }

  let than = s
  const khoiMa = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (khoiMa) than = khoiMa[1]

  const dau = than.indexOf('[')
  const cuoi = than.lastIndexOf(']')
  if (dau < 0 || cuoi <= dau) return { moTa: {}, soDoc: 0, loi: 'Không tìm thấy mảng JSON trong phần đã dán.' }

  let mang
  try {
    mang = JSON.parse(than.slice(dau, cuoi + 1))
  } catch (loi) {
    return { moTa: {}, soDoc: 0, loi: 'JSON hỏng: ' + loi.message }
  }
  if (!Array.isArray(mang)) return { moTa: {}, soDoc: 0, loi: 'Phần dán vào không phải một mảng.' }

  const moTa = {}
  for (const m of mang) {
    const so = Number(m && m.so)
    if (!Number.isFinite(so)) continue
    moTa[so] = {
      subject: m.subject || '',
      action: m.action || '',
      setting: m.setting || '',
      lighting: m.lighting || '',
      mood: m.mood || '',
      camera: m.camera || ''
    }
  }
  return { moTa, soDoc: Object.keys(moTa).length, loi: null }
}

// ---------------------------------------------------------------------------
// Kiểu PROMPT THƯỜNG — mỗi dòng một prompt, không cần JSON
//
// JSON gọn cho máy nhưng hay vỡ: Claude thêm một câu dẫn, bỏ một dấu phẩy, hay
// bị cắt giữa chừng là hỏng cả lô. Kiểu prompt thường chịu được hết những
// chuyện đó, đổi lại không mang theo được các trường riêng lẻ (lighting, mood…)
// nên prompt dùng nguyên văn chứ không ghép qua template.
// ---------------------------------------------------------------------------

function phanTichPromptThuong(chu, { soCanhToiDa = 0 } = {}) {
  const s = String(chu || '').trim()
  if (!s) return { prompt: {}, soDoc: 0, loi: 'Chưa dán gì vào.' }

  // Bỏ vỏ khối mã nếu có.
  let than = s
  const khoiMa = s.match(/```(?:\w+)?\s*([\s\S]*?)```/)
  if (khoiMa) than = khoiMa[1]

  const prompt = {}
  let tiepTheo = 1
  let coDanhSo = false

  for (const dongTho of than.split(/\r?\n/)) {
    const dong = dongTho.trim()
    if (!dong) continue
    // Bỏ dòng dẫn kiểu "Đây là kết quả:" — không có nội dung prompt thật.
    if (/^(đây là|here (is|are)|kết quả|result)\b[^,]*:?$/i.test(dong)) continue

    // Nhận các kiểu đánh số: "1." "1)" "[1]" "Cảnh 1:" "Scene 1 -"
    const danhSo = dong.match(/^(?:\[(\d+)\]|(?:cảnh|canh|scene)\s*(\d+)|(\d+))\s*[.)\-:–]\s*(.+)$/i)
      || dong.match(/^\[(\d+)\]\s*(.+)$/)

    if (danhSo) {
      const so = Number(danhSo[1] || danhSo[2] || danhSo[3])
      const noiDung = (danhSo[4] || danhSo[2] || '').trim()
      if (Number.isFinite(so) && so > 0 && noiDung) {
        prompt[so] = noiDung
        coDanhSo = true
        tiepTheo = so + 1
        continue
      }
    }

    // Không đánh số: xếp tuần tự. Đây là lý do phải giữ nguyên thứ tự dòng.
    prompt[tiepTheo] = dong
    tiepTheo++
  }

  const soDoc = Object.keys(prompt).length
  if (!soDoc) return { prompt: {}, soDoc: 0, loi: 'Không đọc được dòng prompt nào.' }

  let canhBao = null
  if (!coDanhSo) {
    canhBao = `Các dòng KHÔNG đánh số nên tool xếp tuần tự từ cảnh 1. ` +
      `Nếu lô này không bắt đầu từ cảnh 1 thì phải xin Claude đánh số lại.`
  }
  if (soCanhToiDa && soDoc > soCanhToiDa) {
    canhBao = `Đọc được ${soDoc} dòng nhưng chỉ có ${soCanhToiDa} cảnh — thừa ${soDoc - soCanhToiDa} dòng, nhiều khả năng lẫn lời dẫn.`
  }

  return { prompt, soDoc, loi: null, canhBao, coDanhSo }
}

// Tự nhận dạng: dán JSON thì đọc JSON, dán prompt thường thì đọc prompt thường.
// Người dùng không phải nhớ mình đã xin Claude kiểu nào.
function phanTichTraVe(chu) {
  const s = String(chu || '').trim()
  if (!s) return { kieu: null, loi: 'Chưa dán gì vào.', soDoc: 0 }

  // Có dấu hiệu của mảng JSON thì thử JSON trước.
  const coVeJSON = /\[\s*\{/.test(s) && /"so"\s*:/.test(s)
  if (coVeJSON) {
    const kq = phanTichMoTaCanh(s)
    if (!kq.loi) return { kieu: 'json', moTa: kq.moTa, soDoc: kq.soDoc, loi: null }
    // JSON hỏng thì nói rõ là hỏng JSON, đừng âm thầm hạ xuống đọc từng dòng —
    // làm vậy sẽ biến một lô JSON vỡ thành hàng chục prompt rác.
    return { kieu: 'json', loi: kq.loi, soDoc: 0 }
  }

  const kq = phanTichPromptThuong(s)
  return { kieu: 'thuong', prompt: kq.prompt, soDoc: kq.soDoc, loi: kq.loi, canhBao: kq.canhBao }
}

// Prompt thường dùng NGUYÊN VĂN, không ghép qua template — vì nó đã là prompt
// hoàn chỉnh rồi, ghép thêm lần nữa là chồng style hai lần.
function ghepPromptThuong(canh, chuPrompt, { khoNhanVat = [], amBan = MAC_DINH_O.amBan } = {}) {
  const nhanVat = timTrongCanh(canh.chu, khoNhanVat)
  return {
    so: canh.so,
    ten: canh.ten,
    chuCanh: canh.chu,
    prompt: String(chuPrompt || '').replace(/\s+/g, ' ').trim(),
    amBan,
    nhanVat: nhanVat.map((n) => n.ten),
    boiCanh: [],
    dungNguyenVan: true
  }
}

function taoTatCaPromptHonHop(canh, tuyChon = {}) {
  const moTa = tuyChon.moTaTheoCanh || {}
  const thang = tuyChon.promptThang || {}
  return canh.map((c) => {
    if (thang[c.so]) return ghepPromptThuong(c, thang[c.so], tuyChon)
    return ghepPrompt(c, { ...tuyChon, moTaCanh: moTa[c.so] || null })
  })
}

// ---------------------------------------------------------------------------
// Xuất tệp
// ---------------------------------------------------------------------------

// BẤT BIẾN: mỗi dòng một prompt, số thứ tự LIÊN TỤC TỪ 1, không bỏ số.
//
// Flow Automation Studio tra `prompts[index-1]` theo số thứ tự TOÀN CỤC. Thiếu
// một số là lệch tên tệp của cả mẻ — và nó sai im lặng, không báo lỗi gì.
function xuatPromptsTxt(cacPrompt) {
  return cacPrompt.map((p) => p.prompt.replace(/\r?\n/g, ' ')).join('\n') + '\n'
}

function xuatTenAnh(cacPrompt, duoi = 'png') {
  return cacPrompt.map((p) => `${p.ten}.${duoi}`).join('\n') + '\n'
}

function xuatScenesJson(canh, cacPrompt, sieuDuLieu = {}) {
  return JSON.stringify({
    taoLuc: new Date().toISOString(),
    ...sieuDuLieu,
    soCanh: canh.length,
    canh: canh.map((c, i) => ({
      so: c.so,
      ten: c.ten,
      chu: c.chu,
      soTu: c.soTu,
      giayUoc: c.giayUoc,
      prompt: cacPrompt[i] ? cacPrompt[i].prompt : '',
      nhanVat: cacPrompt[i] ? cacPrompt[i].nhanVat : []
    }))
  }, null, 2)
}

function kiemTraLienTuc(cacPrompt) {
  const loi = []
  for (let i = 0; i < cacPrompt.length; i++) {
    if (cacPrompt[i].so !== i + 1) loi.push(`Vị trí ${i + 1} mang số ${cacPrompt[i].so}`)
    if (!cacPrompt[i].prompt || !cacPrompt[i].prompt.trim()) loi.push(`Cảnh ${i + 1} có prompt rỗng`)
  }
  return { ok: loi.length === 0, loi }
}

module.exports = {
  TEMPLATE_MAC_DINH,
  MAC_DINH_O,
  tachCauGiuDau,
  cheNhoCau,
  catCanh,
  gopNhieuCanh,
  thongKeCanh,
  timTrongCanh,
  ghepPrompt,
  taoTatCaPrompt,
  chiaLo,
  taoPromptMoTaCanh,
  taoPromptMoTaCanhThuong,
  phanTichMoTaCanh,
  phanTichPromptThuong,
  phanTichTraVe,
  ghepPromptThuong,
  taoTatCaPromptHonHop,
  xuatPromptsTxt,
  xuatTenAnh,
  xuatScenesJson,
  kiemTraLienTuc
}
