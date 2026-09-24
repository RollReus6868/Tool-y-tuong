// Phân loại cảnh: cảnh nào tìm được ảnh/video THẬT (FOOTAGE), cảnh nào phải
// dựng bằng AI (Flow).
//
// Hai tầng, đúng như người dùng đã chọn:
//   1. LỌC SƠ bằng luật (miễn phí, tức thì). Chỉ để quyết định cảnh nào
//      ĐÁNG hỏi Claude — cảnh chắc chắn là AI (thoại, cảm xúc nhân vật, cảnh
//      siêu nhiên, cảnh Kinh Thánh) thì khỏi tốn lượt dán.
//   2. CLAUDE xác nhận theo lô và viết từ khóa tìm kiếm tiếng Anh cụ thể.
//
// Luật lọc sơ CỐ Ý nghiêng về "hỏi Claude": bỏ sót một cảnh footage chỉ tốn
// thêm một cảnh Flow, còn gắn nhầm FOOTAGE thì ra một clip lạc đề giữa video.
//
// Toàn bộ mô-đun là hàm thuần.

const TU_DUNG = new Set(('a an the and or but if then so of to in on at by for with from into onto over under ' +
  'as is are was were be been being am do does did done have has had having it its it\'s this that these those ' +
  'he she they we you i me him her them us my his their our your mine who whom whose which what when where why how ' +
  'not no yes all any some every each more most much many few little very just only also even still yet ' +
  'there here than too can could would should will shall may might must said says say told tell ' +
  'one two three up down out off again once about after before because while until through during ' +
  'like upon without within against among toward towards across behind beyond around near ' +
  'went came come go goes going got get gets made make makes saw see seen looked look knew know ' +
  'thing things something nothing everything anything way ways day days time times').split(/\s+/))

// Dấu hiệu cảnh có hình ảnh THẬT tìm được: nơi chốn, thiên nhiên, đô thị, sự
// kiện lịch sử, đồ vật cụ thể.
const TU_FOOTAGE = [
  // thiên nhiên, cảnh quan
  'ocean', 'sea', 'river', 'lake', 'mountain', 'mountains', 'desert', 'forest', 'field', 'fields', 'valley',
  'storm', 'rain', 'snow', 'sunset', 'sunrise', 'sky', 'clouds', 'stars', 'waves', 'beach', 'island', 'volcano',
  'earthquake', 'flood', 'wildfire', 'drought', 'harvest', 'farm', 'wheat', 'vineyard', 'olive',
  // đô thị, đời sống hiện đại
  'city', 'cities', 'street', 'streets', 'downtown', 'skyline', 'highway', 'traffic', 'airport', 'train', 'subway',
  'factory', 'factories', 'office', 'hospital', 'school', 'classroom', 'university', 'courthouse', 'prison',
  'church', 'cathedral', 'chapel', 'museum', 'library', 'market', 'crowd', 'crowds', 'protest', 'protests',
  'march', 'rally', 'parade', 'election', 'vote', 'voters', 'congress', 'senate', 'capitol', 'white house',
  'newspaper', 'headline', 'headlines', 'television', 'news', 'money', 'dollar', 'dollars', 'stock market', 'bank',
  // lịch sử, tư liệu
  'war', 'soldiers', 'army', 'navy', 'battlefield', 'troops', 'tanks', 'bomb', 'civil rights', 'segregation',
  'slavery', 'plantation', 'depression', 'immigrants', 'ellis island', 'archive', 'photograph', 'photographs',
  'president', 'presidents', 'map', 'maps', 'ruins', 'excavation', 'archaeologists', 'artifact', 'artifacts',
  'manuscript', 'scroll', 'scrolls', 'museum', 'pyramid', 'pyramids', 'temple ruins'
]

// Dấu hiệu cảnh CHỈ dựng được bằng AI: thoại, nội tâm, siêu nhiên, nhân vật
// Kinh Thánh / hư cấu, hành động riêng của một nhân vật cụ thể.
const TU_AI = [
  'god', 'lord', 'jesus', 'christ', 'moses', 'abraham', 'david', 'goliath', 'noah', 'elijah', 'samuel', 'isaiah',
  'jeremiah', 'daniel', 'joseph', 'mary', 'paul', 'peter', 'john the baptist', 'pharaoh', 'angel', 'angels',
  'demon', 'demons', 'satan', 'devil', 'heaven', 'hell', 'miracle', 'miracles', 'prophet', 'prophecy', 'vision',
  'dream', 'dreamed', 'spirit', 'holy', 'sacred', 'prayed', 'whispered', 'wept', 'cried', 'screamed', 'smiled',
  'felt', 'feel', 'feeling', 'thought', 'remembered', 'wondered', 'heart', 'soul', 'tears', 'afraid', 'fear',
  'love', 'loved', 'hated', 'imagine', 'imagined', 'suddenly', 'whisper', 'voice'
]

function thuong(s) { return String(s || '').toLowerCase() }

function coCum(chuThap, cum) {
  // Ranh giới từ — /age/ đã từng khớp luôn "webpage".
  const s = cum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z])${s}([^a-z]|$)`).test(chuThap)
}

function demKhop(chuThap, ds) {
  return ds.filter((t) => coCum(chuThap, t))
}

// Tên riêng giữa câu (không phải chữ đầu câu): "Martin Luther King", "Chicago".
function tenRieng(chu) {
  const ra = []
  const cau = String(chu || '').split(/(?<=[.!?])\s+/)
  for (const c of cau) {
    const tu = c.split(/\s+/)
    for (let i = 1; i < tu.length; i++) {
      const w = tu[i].replace(/[^A-Za-z'-]/g, '')
      if (/^[A-Z][a-z]{2,}/.test(w) && !TU_DUNG.has(w.toLowerCase())) ra.push(w)
    }
  }
  return [...new Set(ra)]
}

function coNam(chu) {
  return /\b(1[5-9]\d\d|20[0-2]\d)s?\b/.test(String(chu || ''))
}

function coThoai(chu) {
  return /["“”]/.test(String(chu || '')) || /\b(i|we)\b/i.test(String(chu || ''))
}

// Từ khóa tìm kiếm thô (dùng khi không qua Claude): cụm footage khớp + danh từ
// dài nhất trong câu. Claude viết tốt hơn nhiều — đây chỉ là phương án lùi.
function tuKhoaTuCau(chu, toiDa = 5) {
  const thap = thuong(chu)
  const khop = demKhop(thap, TU_FOOTAGE)
  const ten = tenRieng(chu).filter((t) => !TU_AI.includes(t.toLowerCase()))
  const tu = thap.replace(/[^a-z\s'-]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !TU_DUNG.has(w) && !TU_AI.includes(w))
  const ra = []
  for (const x of [...ten, ...khop, ...tu]) {
    const k = x.toLowerCase()
    if (!ra.some((r) => r.toLowerCase() === k || r.toLowerCase().includes(k))) ra.push(x)
    if (ra.length >= toiDa) break
  }
  return ra.join(' ')
}

// Kết quả: goiY = 'FOOTAGE' (luật khá chắc), 'CAN_HOI' (nên hỏi Claude),
// 'AI' (chắc là AI, không cần hỏi).
function locSo(canh) {
  return (canh || []).map((c) => {
    const thap = thuong(c.chu)
    const footage = demKhop(thap, TU_FOOTAGE)
    const ai = demKhop(thap, TU_AI)
    const ten = tenRieng(c.chu).filter((t) => !TU_AI.includes(t.toLowerCase()))
    let diem = footage.length * 1.0 + ten.length * 0.6 + (coNam(c.chu) ? 1.2 : 0)
    diem -= ai.length * 0.9 + (coThoai(c.chu) ? 1.0 : 0)
    const goiY = diem >= 2 ? 'FOOTAGE' : diem >= 0.5 ? 'CAN_HOI' : 'AI'
    const lyDo = [
      footage.length ? `cảnh vật: ${footage.slice(0, 3).join(', ')}` : '',
      ten.length ? `tên riêng: ${ten.slice(0, 3).join(', ')}` : '',
      coNam(c.chu) ? 'có năm' : '',
      ai.length ? `yếu tố AI: ${ai.slice(0, 3).join(', ')}` : '',
      coThoai(c.chu) ? 'có thoại/ngôi thứ nhất' : ''
    ].filter(Boolean).join(' · ')
    return {
      so: c.so,
      goiY,
      diem: Math.round(diem * 10) / 10,
      lyDo,
      tuKhoaTim: tuKhoaTuCau(c.chu),
      // Trước 1990, ảnh tư liệu dễ tìm hơn video nhiều.
      kieu: coNam(c.chu) && /\b1[5-8]\d\d|19[0-8]\d\b/.test(c.chu) ? 'anh' : 'video'
    }
  })
}

// ---------------------------------------------------------------------------
// Prompt cho Claude
// ---------------------------------------------------------------------------

function taoPromptPhanLoai(loCanh, { loThu = 1, tongLo = 1, giayMoiCanh = 9 } = {}) {
  return [
    `===== LÔ ${loThu}/${tongLo} — CẢNH NÀO DÙNG ĐƯỢC FOOTAGE THẬT? =====`,
    '',
    'Đây là các cảnh trong kịch bản một video YouTube kể chuyện (tiếng Anh, khán giả Mỹ).',
    `Mỗi cảnh hiện trên màn hình khoảng ${giayMoiCanh} giây. Với TỪNG cảnh, quyết định:`,
    '',
    'FOOTAGE — khi một đoạn video stock hoặc ảnh tư liệu CÓ THẬT sẽ minh hoạ đúng câu này:',
    '  · địa danh, thành phố, cảnh quan, thời tiết, thiên nhiên có thật',
    '  · sự kiện / thời kỳ lịch sử có ảnh hoặc phim tư liệu (chiến tranh, phong trào dân quyền, Đại suy thoái…)',
    '  · người thật nổi tiếng có ảnh chân dung chính thức hoặc ảnh tư liệu',
    '  · đồ vật, hoạt động đời thường (đám đông, tờ báo, lớp học, cánh đồng, bản đồ cũ, di tích khảo cổ)',
    '',
    'AI — khi footage thật sẽ SAI hoặc LẠC ĐỀ:',
    '  · nhân vật hư cấu, nhân vật Kinh Thánh, cảnh Kinh Thánh (không có ảnh thật nào)',
    '  · hành động riêng của một nhân vật cụ thể, nét mặt, cảm xúc, suy nghĩ, lời thoại',
    '  · siêu nhiên, phép lạ, giấc mơ, thiên thần',
    '  · bất cứ cảnh nào mà clip stock chung chung sẽ mâu thuẫn với câu chuyện',
    '',
    'Khi phân vân, chọn AI.',
    '',
    '===== CÁC CẢNH =====',
    ...loCanh.map((c) => `[${c.so}] ${c.chu}`),
    '',
    '===== ĐỊNH DẠNG TRẢ VỀ =====',
    'Mỗi cảnh MỘT dòng, không lời dẫn, không bọc khối mã, ngăn bằng dấu |',
    '',
    '  <số> | FOOTAGE | video hoặc photo | <từ khóa tìm kiếm tiếng Anh> | <lý do ngắn>',
    '  <số> | AI | <lý do ngắn>',
    '',
    'Ví dụ:',
    '  12 | FOOTAGE | video | aerial view manhattan skyline dusk | nói về New York về đêm',
    '  13 | AI | cảnh nhân vật cầu nguyện',
    '  14 | FOOTAGE | photo | 1930s dust bowl farm family | thời Đại suy thoái',
    '',
    'Từ khóa tìm kiếm: 2–6 từ tiếng Anh, là thứ NHÌN THẤY được (danh từ + tính từ),',
    'không dùng tên nhân vật hư cấu. Người thật thì ghi tên + "portrait" hoặc "photo".',
    'Chọn "photo" cho người thật và sự kiện trước năm 1960; "video" cho cảnh quan,',
    'thành phố, thiên nhiên, đời sống hiện đại.',
    '',
    `Đủ ${loCanh.length} dòng, số ở đầu dòng đúng bằng số trong ngoặc vuông ở trên.`
  ].join('\n')
}

// Đọc câu trả lời. Chịu được: lời dẫn trước/sau, khối ``` , gạch đầu dòng,
// "[12]" thay cho "12", "photo"/"image"/"ảnh".
function docTraLoiPhanLoai(chu) {
  const ketQua = {}
  const loi = []
  const dong = String(chu || '').replace(/```[a-z]*\n?/gi, '').split(/\r?\n/)
  for (const d of dong) {
    const s = d.trim().replace(/^[-*•·]\s*/, '')
    const m = s.match(/^\[?(\d+)\]?\s*[|:.)-]\s*(FOOTAGE|AI)\b\s*\|?\s*(.*)$/i)
    if (!m) continue
    const so = Number(m[1])
    const loai = m[2].toUpperCase()
    const phan = m[3].split('|').map((x) => x.trim())
    if (loai === 'AI') {
      ketQua[so] = { loai: 'AI', lyDo: phan.filter(Boolean).join(' · ') }
      continue
    }
    let kieu = 'video'
    if (phan.length && /^(photo|image|picture|ảnh|anh)$/i.test(phan[0])) { kieu = 'anh'; phan.shift() }
    else if (phan.length && /^(video|footage|clip)$/i.test(phan[0])) phan.shift()
    const tuKhoaTim = (phan.shift() || '').replace(/["“”]/g, '').trim()
    if (!tuKhoaTim) { loi.push(`Cảnh ${so}: gắn FOOTAGE nhưng không có từ khóa tìm kiếm`); continue }
    ketQua[so] = { loai: 'FOOTAGE', kieu, tuKhoaTim, lyDo: phan.filter(Boolean).join(' · ') }
  }
  const soDoc = Object.keys(ketQua).length
  if (!soDoc && String(chu || '').trim()) loi.unshift('Không đọc được dòng nào. Mỗi dòng phải bắt đầu bằng "<số> | FOOTAGE" hoặc "<số> | AI".')
  return { ketQua, soDoc, loi }
}

// ---------------------------------------------------------------------------
// Kế hoạch
// ---------------------------------------------------------------------------

// Dựng kế hoạch từ kết quả lọc sơ. Cảnh luật gắn FOOTAGE vẫn giữ nhãn đó (có
// thể được Claude sửa lại); cảnh CAN_HOI tạm tính là AI cho tới khi Claude
// trả lời — để bấm "Tìm" trước khi hỏi Claude cũng không tải bừa.
function taoKeHoach(canh, loc) {
  const theoSo = new Map((loc || []).map((l) => [l.so, l]))
  return {
    phienBan: 1,
    taoLuc: new Date().toISOString(),
    soCanh: (canh || []).length,
    canh: (canh || []).map((c) => {
      const l = theoSo.get(c.so) || { goiY: 'AI', tuKhoaTim: '', kieu: 'video', lyDo: '' }
      return {
        so: c.so,
        ten: c.ten,
        // Giữ luôn chữ của cảnh: mở lại app không cần cắt lại vẫn xuất được
        // Excel, và kiemKhopKeHoach() so được cảnh hiện tại có đúng là cảnh
        // lúc lập kế hoạch không.
        chu: c.chu,
        soTu: c.soTu,
        giayUoc: c.giayUoc,
        loai: l.goiY === 'FOOTAGE' ? 'FOOTAGE' : 'AI',
        canHoi: l.goiY === 'CAN_HOI' || l.goiY === 'FOOTAGE',
        kieu: l.kieu,
        tuKhoaTim: l.tuKhoaTim,
        lyDo: l.lyDo,
        nguonPhanLoai: 'luat',
        chon: null,
        ungVien: []
      }
    })
  }
}

// Ghép câu trả lời của Claude vào kế hoạch. Cảnh đã có tệp tải về mà Claude
// đổi sang AI thì giữ tệp trong kế hoạch để tầng trên dọn (không tự xoá ở đây).
function apDungClaude(keHoach, ketQua) {
  let soDoi = 0
  for (const c of keHoach.canh) {
    const k = ketQua[c.so]
    if (!k) continue
    c.canHoi = false
    c.nguonPhanLoai = 'claude'
    if (k.loai === 'AI') {
      if (c.loai !== 'AI') soDoi++
      c.loai = 'AI'
      c.lyDo = k.lyDo || c.lyDo
    } else {
      if (c.loai !== 'FOOTAGE' || c.tuKhoaTim !== k.tuKhoaTim) soDoi++
      c.loai = 'FOOTAGE'
      c.kieu = k.kieu
      c.tuKhoaTim = k.tuKhoaTim
      c.lyDo = k.lyDo || c.lyDo
    }
  }
  return soDoi
}

// Kế hoạch làm với MỘT bộ cảnh. Cắt lại (đổi số từ/cảnh, gộp cảnh, sửa kịch
// bản) là số cảnh dịch đi — dùng kế hoạch cũ thì footage cảnh 12 rơi vào chỗ
// của câu khác, và KHÔNG có lỗi nào hiện ra. Phải so từng cảnh.
function kiemKhopKeHoach(canh, keHoach) {
  if (!keHoach || !Array.isArray(keHoach.canh)) return { khop: false, lyDo: 'Chưa có kế hoạch.' }
  if ((canh || []).length !== keHoach.canh.length) {
    return { khop: false, lyDo: `Kế hoạch lập với ${keHoach.canh.length} cảnh, giờ có ${(canh || []).length} cảnh.` }
  }
  const chuan = (x) => String(x || '').replace(/\s+/g, ' ').trim()
  for (let i = 0; i < canh.length; i++) {
    const a = canh[i]; const b = keHoach.canh[i]
    if (a.so !== b.so || (b.chu !== undefined && chuan(a.chu) !== chuan(b.chu))) {
      return { khop: false, lyDo: `Cảnh ${a.so} khác với lúc lập kế hoạch (kịch bản đã sửa hoặc cắt cảnh khác cách).`, soLech: a.so }
    }
  }
  return { khop: true, lyDo: '' }
}

module.exports = {
  kiemKhopKeHoach,
  TU_FOOTAGE,
  TU_AI,
  tenRieng,
  tuKhoaTuCau,
  locSo,
  taoPromptPhanLoai,
  docTraLoiPhanLoai,
  taoKeHoach,
  apDungClaude
}
