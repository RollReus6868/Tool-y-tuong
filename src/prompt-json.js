// Prompt ảnh DẠNG JSON theo mẫu của người dùng (0.6.1).
//
// LỖI CŨ (0.6.0): người dùng dán một prompt mẫu dạng JSON vào ô "Prompt mẫu",
// nhưng bước "Sinh toàn bộ prompt" vẫn ghép kiểu chuỗi phẩy qua template
// {style}, {camera}, {canh}… — ô prompt mẫu KHÔNG hề được dùng khi sinh, chỉ
// được chèn vào lời nhờ Claude. Kết quả ra chuỗi phẳng, không phải JSON.
//
// Nay: mẫu là JSON thì MỌI prompt sinh ra là JSON CÙNG CẤU TRÚC, CÙNG TÊN KHOÁ:
//   · khoá "theo cảnh" (scene, subject, action, setting, characters…) được thay
//     bằng nội dung của từng cảnh;
//   · khoá "phong cách" (style, lighting, camera, color, aspect_ratio,
//     negative…) giữ NGUYÊN giá trị của mẫu.
// Mỗi prompt ghi ra một dòng (JSON thu gọn) — prompts.txt vẫn đúng bất biến
// "một dòng một prompt" mà Flow Automation Studio cần.
//
// Toàn bộ mô-đun là hàm thuần.

// Tên khoá chứa NỘI DUNG CẢNH (so theo chữ thường, bỏ _ - khoảng trắng).
// KHÔNG có "shot": mẫu hay có camera.shot = "wide shot" — nhận nhầm làm khoá
// nội dung là nhét câu kịch bản vào chỗ góc máy.
const KHOA_CHINH = ['scene', 'scenedescription', 'subject', 'mainsubject', 'description', 'prompt', 'content',
  'shotdescription', 'visual', 'imagedescription', 'narrative', 'moment']
const KHOA_HANH_DONG = ['action', 'actions', 'activity', 'pose', 'event']
const KHOA_BOI_CANH = ['setting', 'environment', 'location', 'background', 'place', 'backdrop', 'scenery']
const KHOA_NHAN_VAT = ['character', 'characters', 'people', 'person', 'figures', 'figure', 'cast']
const KHOA_ANH_SANG = ['lighting', 'light', 'lights']
const KHOA_KHONG_KHI = ['mood', 'atmosphere', 'emotion', 'tone', 'feeling']
const KHOA_GOC_MAY = ['camera', 'cameraangle', 'shottype', 'angle', 'framing', 'composition', 'lens']

function chuanKhoa(k) {
  return String(k || '').toLowerCase().replace(/[\s_\-.]/g, '')
}

function thuoc(k, ds) {
  return ds.includes(chuanKhoa(k))
}

// Bóc JSON khỏi khối mã / lời dẫn. Trả { ok, mau, loi }.
function docMauJson(chu) {
  let s = String(chu || '').trim()
  if (!s) return { ok: false, loi: '' }
  const khoiMa = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (khoiMa) s = khoiMa[1].trim()
  if (!s.startsWith('{')) {
    const dau = s.indexOf('{'); const cuoi = s.lastIndexOf('}')
    if (dau < 0 || cuoi <= dau) return { ok: false, loi: '' }
    s = s.slice(dau, cuoi + 1)
  }
  try {
    const mau = JSON.parse(s)
    if (!mau || typeof mau !== 'object' || Array.isArray(mau)) return { ok: false, loi: 'Prompt mẫu JSON phải là MỘT đối tượng { … }, không phải mảng.' }
    return { ok: true, mau }
  } catch (e) {
    return { ok: false, loi: 'Prompt mẫu trông như JSON nhưng bị lỗi cú pháp: ' + e.message + ' (thiếu dấu phẩy, thừa dấu phẩy cuối, hay dùng dấu nháy đơn?)' }
  }
}

// Có phải người dùng ĐỊNH dán JSON không (để báo lỗi cú pháp thay vì lặng lẽ
// coi như prompt chữ thường).
function trongNhuJson(chu) {
  const s = String(chu || '').replace(/```(?:json)?/gi, '').trim()
  return s.startsWith('{') && /"\s*:/.test(s)
}

// Đi qua mọi lá (giá trị chuỗi/số) của đối tượng. duongDan là mảng khoá.
function cacLa(obj, duongDan = [], ra = []) {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => cacLa(v, duongDan.concat(i), ra))
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) cacLa(v, duongDan.concat(k), ra)
  } else {
    ra.push({ duongDan, giaTri: obj })
  }
  return ra
}

// Khoá cuối cùng mang tên (bỏ chỉ số mảng).
function tenKhoa(duongDan) {
  for (let i = duongDan.length - 1; i >= 0; i--) if (typeof duongDan[i] === 'string') return duongDan[i]
  return ''
}

// Phân loại khoá của mẫu: khoá nào là nội dung cảnh, khoá nào là phong cách.
function phanTichMau(mau) {
  const la = cacLa(mau)
  const tim = (ds) => la.find((l) => typeof l.giaTri === 'string' && thuoc(tenKhoa(l.duongDan), ds))
  // Khoá chính: ưu tiên theo thứ tự trong KHOA_CHINH.
  let chinh = null
  for (const k of KHOA_CHINH) {
    chinh = la.find((l) => typeof l.giaTri === 'string' && chuanKhoa(tenKhoa(l.duongDan)) === k)
    if (chinh) break
  }
  return {
    chinh: chinh ? chinh.duongDan : null,
    hanhDong: (tim(KHOA_HANH_DONG) || {}).duongDan || null,
    boiCanh: (tim(KHOA_BOI_CANH) || {}).duongDan || null,
    nhanVat: (la.find((l) => thuoc(tenKhoa(l.duongDan), KHOA_NHAN_VAT)) || {}).duongDan || null,
    nhanVatLaMang: false,
    anhSang: (tim(KHOA_ANH_SANG) || {}).duongDan || null,
    khongKhi: (tim(KHOA_KHONG_KHI) || {}).duongDan || null,
    gocMay: (tim(KHOA_GOC_MAY) || {}).duongDan || null,
    soKhoa: la.length
  }
}

function datTheoDuongDan(obj, duongDan, giaTri) {
  let o = obj
  for (let i = 0; i < duongDan.length - 1; i++) o = o[duongDan[i]]
  o[duongDan[duongDan.length - 1]] = giaTri
}

// Khoá "nhân vật" trong mẫu có thể là chuỗi, mảng chuỗi hay mảng đối tượng —
// ghi lại đúng KIỂU của mẫu để cấu trúc không đổi.
function datNhanVat(obj, mau, moTa) {
  const k = Object.keys(obj).find((x) => thuoc(x, KHOA_NHAN_VAT))
  if (!k) return false
  const cu = mau[k]
  if (Array.isArray(cu)) {
    if (cu.length && cu[0] && typeof cu[0] === 'object') {
      const khoaMoTa = Object.keys(cu[0]).find((x) => /desc|appearance|look|detail/i.test(x)) || Object.keys(cu[0])[0]
      obj[k] = moTa.map((m) => ({ ...Object.fromEntries(Object.keys(cu[0]).map((x) => [x, ''])), [khoaMoTa]: m }))
    } else obj[k] = moTa
  } else obj[k] = moTa.join('; ')
  return true
}

// Ghép MỘT cảnh thành JSON theo mẫu. moTaCanh (từ Claude, kiểu JSON cũ) nếu có
// thì dùng để điền hành động / bối cảnh / ánh sáng / không khí / góc máy.
function ghepPromptJson(canh, mau, { moTaCanh = null, nhanVat = [], boiCanh = [] } = {}) {
  const cauTruc = phanTichMau(mau)
  const obj = JSON.parse(JSON.stringify(mau))
  const noiDung = (moTaCanh && [moTaCanh.subject, moTaCanh.action].filter(Boolean).join(' ')) || canh.chu

  if (cauTruc.chinh) datTheoDuongDan(obj, cauTruc.chinh, noiDung)
  else obj.scene = noiDung   // mẫu không có khoá nội dung nào — thêm một khoá rõ nghĩa

  if (cauTruc.hanhDong) datTheoDuongDan(obj, cauTruc.hanhDong, (moTaCanh && moTaCanh.action) || '')
  // Bối cảnh của MẪU không được lan sang mọi cảnh (mẫu tả "rocky hillside" thì
  // cảnh trong thành phố cũng thành đồi đá). Không biết bối cảnh thì để trống.
  if (cauTruc.boiCanh) {
    datTheoDuongDan(obj, cauTruc.boiCanh, (moTaCanh && moTaCanh.setting) || boiCanh.map((b) => b.moTa).filter(Boolean).join(', '))
  }
  if (moTaCanh && moTaCanh.lighting && cauTruc.anhSang) datTheoDuongDan(obj, cauTruc.anhSang, moTaCanh.lighting)
  if (moTaCanh && moTaCanh.mood && cauTruc.khongKhi) datTheoDuongDan(obj, cauTruc.khongKhi, moTaCanh.mood)
  if (moTaCanh && moTaCanh.camera && cauTruc.gocMay) datTheoDuongDan(obj, cauTruc.gocMay, moTaCanh.camera)

  // Nhân vật: mô tả cố định chèn NGUYÊN VĂN (bất biến của tool). Mẫu không có
  // khoá nhân vật thì nối vào khoá nội dung. Mẫu CÓ khoá nhân vật mà cảnh này
  // không có nhân vật nào trong kho → để trống, không giữ nhân vật của mẫu.
  const moTaNV = nhanVat.map((n) => n.moTa).filter(Boolean)
  if (!datNhanVat(obj, mau, moTaNV) && moTaNV.length) {
    if (cauTruc.chinh) datTheoDuongDan(obj, cauTruc.chinh, noiDung + '. ' + moTaNV.join('; '))
    else obj.scene = noiDung + '. ' + moTaNV.join('; ')
  }
  return obj
}

// Thu gọn MỘT dòng — prompts.txt một dòng một prompt.
function thuGon(obj) {
  return JSON.stringify(obj)
}

// ---------------------------------------------------------------------------
// Nhờ Claude viết JSON theo mẫu
// ---------------------------------------------------------------------------

function taoPromptJsonTheoMau(loCanh, mau, { loThu = 1, tongLo = 1, khoNhanVat = [], coAnhMau = false } = {}) {
  const cauTruc = phanTichMau(mau)
  const tenKhoaChinh = cauTruc.chinh ? cauTruc.chinh.join('.') : 'scene'
  const khoi = []
  khoi.push([
    `===== LÔ ${loThu}/${tongLo} — VIẾT PROMPT ẢNH DẠNG JSON THEO MẪU =====`,
    'Với mỗi cảnh dưới đây, viết MỘT prompt ảnh dạng JSON, CÙNG CẤU TRÚC và CÙNG TÊN',
    'KHOÁ với mẫu. Tiếng Anh. Chỉ tả thứ NHÌN THẤY ĐƯỢC.'
  ].join('\n'))
  khoi.push([
    '===== JSON MẪU =====',
    JSON.stringify(mau, null, 2),
    '',
    'Luật:',
    `- Khoá "${tenKhoaChinh}" (và các khoá hành động / bối cảnh / nhân vật nếu có): viết lại cho ĐÚNG từng cảnh.`,
    '- Các khoá phong cách (style, màu, chất liệu, ánh sáng, ống kính, tỉ lệ khung, negative…):',
    '  GIỮ NGUYÊN giá trị của mẫu, trừ khi cảnh bắt buộc khác (vd cảnh đêm thì ánh sáng đêm).',
    '- Không thêm khoá, không bớt khoá, không đổi tên khoá, không đổi kiểu giá trị.',
    '- Không chép chủ thể / bối cảnh của mẫu sang cảnh không có chúng.'
  ].join('\n'))
  if (coAnhMau) khoi.push('Ảnh ĐÍNH KÈM là ảnh mẫu về phong cách: bám theo màu, ánh sáng, chất liệu và bố cục của ảnh đó.')
  if (khoNhanVat.length) {
    khoi.push([
      '===== NHÂN VẬT CỐ ĐỊNH — chép NGUYÊN VĂN đoạn mô tả vào JSON =====',
      ...khoNhanVat.map((n) => `  · ${n.ten}: ${n.moTa}`),
      'Cảnh nào có các nhân vật này thì chép y nguyên đoạn mô tả, không diễn giải lại.'
    ].join('\n'))
  }
  khoi.push(['===== CÁC CẢNH =====', ...loCanh.map((c) => `[${c.so}] ${c.chu}`)].join('\n'))
  khoi.push([
    '===== ĐỊNH DẠNG TRẢ VỀ =====',
    'Mỗi cảnh MỘT dòng: số cảnh trong ngoặc vuông, một dấu cách, rồi JSON viết liền trên',
    'MỘT dòng (không xuống dòng bên trong JSON). Không lời dẫn, không khối mã:',
    '',
    `[${loCanh[0] ? loCanh[0].so : 1}] {"…": "…", …}`,
    `[${loCanh[1] ? loCanh[1].so : 2}] {"…": "…", …}`,
    '',
    `Đủ ${loCanh.length} dòng, số trong ngoặc đúng bằng số ở trên.`
  ].join('\n'))
  return khoi.join('\n\n')
}

// Tách "[n] { … }" — chịu được JSON xuống dòng (Claude hay in đẹp), khối mã,
// lời dẫn, và mảng JSON có trường số cảnh.
function docTraLoiJson(chu, mau) {
  let s = String(chu || '').trim()
  if (!s) return { prompt: {}, soDoc: 0, loi: 'Chưa dán gì vào.', loiCanh: [] }
  s = s.replace(/```(?:json)?/gi, '')

  const theo = {}
  const loiCanh = []
  const khoaMau = Object.keys(mau).map(chuanKhoa).sort().join(',')

  const kiemVaGhi = (so, obj, nguyen) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { loiCanh.push(`Cảnh ${so}: không phải đối tượng JSON`); return }
    const { so: _b1, scene_number: _b2, sceneNumber: _b3, ...conLai } = obj
    const sach = Object.keys(mau).some((k) => ['so', 'scene_number', 'sceneNumber'].includes(k)) ? obj : conLai
    const khoa = Object.keys(sach).map(chuanKhoa).sort().join(',')
    if (khoa !== khoaMau) {
      const thieu = Object.keys(mau).filter((k) => !(k in sach))
      const thua = Object.keys(sach).filter((k) => !(k in mau))
      loiCanh.push(`Cảnh ${so}: khác cấu trúc mẫu` + (thieu.length ? ` — thiếu ${thieu.join(', ')}` : '') + (thua.length ? ` — thừa ${thua.join(', ')}` : ''))
    }
    theo[so] = thuGon(sach)
  }

  // Dạng mảng [ {...}, {...} ] có trường số cảnh.
  const tron = s.trim()
  if (tron.startsWith('[') && !/^\[\d+\]/.test(tron)) {
    try {
      const mang = JSON.parse(tron.slice(0, tron.lastIndexOf(']') + 1))
      if (Array.isArray(mang)) {
        for (const o of mang) {
          const so = Number(o && (o.so ?? o.scene_number ?? o.sceneNumber ?? o.scene_id))
          if (Number.isInteger(so) && so > 0) kiemVaGhi(so, o)
          else loiCanh.push('Một phần tử trong mảng không có số cảnh (so / scene_number)')
        }
        return ketQua()
      }
    } catch (_) { /* không phải mảng hợp lệ → đọc kiểu [n] */ }
  }

  // Dạng "[n] {...}" — cắt theo mốc [n] ở ĐẦU dòng.
  const moc = [...s.matchAll(/(^|\n)\s*\[(\d+)\]\s*/g)]
  if (!moc.length) {
    return { prompt: {}, soDoc: 0, loi: 'Không thấy dòng nào dạng "[số] {JSON}". Xin Claude trả lời đúng định dạng của prompt đã chép.', loiCanh: [] }
  }
  for (let i = 0; i < moc.length; i++) {
    const so = Number(moc[i][2])
    const dau = moc[i].index + moc[i][0].length
    const cuoi = i + 1 < moc.length ? moc[i + 1].index : s.length
    const doan = s.slice(dau, cuoi)
    const a = doan.indexOf('{'); const b = doan.lastIndexOf('}')
    if (a < 0 || b <= a) { loiCanh.push(`Cảnh ${so}: không có JSON`); continue }
    try {
      kiemVaGhi(so, JSON.parse(doan.slice(a, b + 1)))
    } catch (e) {
      loiCanh.push(`Cảnh ${so}: JSON lỗi (${e.message})`)
    }
  }
  return ketQua()

  function ketQua() {
    const soDoc = Object.keys(theo).length
    return {
      prompt: theo,
      soDoc,
      loi: soDoc ? null : ('Không đọc được cảnh nào. ' + loiCanh.slice(0, 3).join(' · ')),
      loiCanh
    }
  }
}

module.exports = {
  docMauJson,
  trongNhuJson,
  phanTichMau,
  ghepPromptJson,
  thuGon,
  taoPromptJsonTheoMau,
  docTraLoiJson
}
