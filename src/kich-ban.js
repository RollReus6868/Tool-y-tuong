// Ghép prompt để đưa sang Claude viết kịch bản, và phân tích kết quả dán về.
//
// Toàn bộ mô-đun là hàm thuần: nó chỉ NỐI CHUỖI, không gọi mạng, không gọi AI.
// Người dùng tự dán sang Claude và dán kết quả về.
//
// CỘT TRỤ: kịch bản 10.000-12.000 từ KHÔNG BAO GIỜ xin một phát.
//
// Xin một phát thì gặp đủ ba chuyện cùng lúc: câu trả lời bị cắt giữa chừng,
// nửa sau nhạt dần, và phần 6 bắt đầu nói lại ý phần 2 bằng lời khác. Nên quy
// trình là: xin DÀN Ý trước, rồi xin từng phần một, và mỗi phần đều kèm SỔ
// CHỐNG LẶP rút ra từ các phần đã viết.

const { tachTu, tachCau, nGram, demTu, cumLap, moDauCauLap, TU_CHUC_NANG } = require('./kiem-duyet')

const YEU_CAU_MAC_DINH = {
  soTuMucTieu: 11000,
  soPhan: 8,
  ngonNgu: 'tiếng Anh Mỹ',
  giongKe: 'kể chuyện trầm, chậm, dành cho người xem lớn tuổi',
  doiTuong: 'khán giả Mỹ trên 45 tuổi',
  hook: 'mở đầu 15 giây đầu phải nêu được câu hỏi khiến người ta ở lại',
  cta: 'nhắc đăng ký một lần duy nhất, đặt ở khoảng 70% thời lượng',
  dieuCam: 'không dùng câu mở kiểu template, không liệt kê khô khan, không nhại lại lời thoại gốc'
}

function chiaPhan(soTuMucTieu, soPhan) {
  const coBan = Math.floor(soTuMucTieu / soPhan)
  const du = soTuMucTieu - coBan * soPhan
  const ra = []
  for (let i = 0; i < soPhan; i++) {
    ra.push({ so: i + 1, soTuMucTieu: coBan + (i < du ? 1 : 0) })
  }
  return ra
}

// ---------------------------------------------------------------------------
// Bước 1 — prompt xin dàn ý
// ---------------------------------------------------------------------------

function taoPromptDanY({ skill = '', loiThoai = '', yeuCau = {} } = {}) {
  const y = { ...YEU_CAU_MAC_DINH, ...yeuCau }
  const phan = chiaPhan(y.soTuMucTieu, y.soPhan)

  const khoi = []

  if (skill.trim()) {
    khoi.push('===== SKILL VIẾT KỊCH BẢN =====\n' + skill.trim())
  }

  khoi.push([
    '===== TƯ LIỆU GỐC =====',
    'Đây là lời thoại đã bóc từ video tham khảo. Dùng làm TƯ LIỆU để hiểu chủ đề,',
    'KHÔNG phải bản mẫu để viết lại theo.',
    '',
    loiThoai.trim() || '(chưa có lời thoại — viết dựa trên yêu cầu bên dưới)'
  ].join('\n'))

  // Video đã chọn ở màn Ý tưởng / Đề xuất: đưa vào như TÍN HIỆU THỊ TRƯỜNG
  // (chủ đề nào đang được xem), không phải khuôn để chép. Nói rõ điều đó trong
  // prompt — nội dung bám sát một video khác là đúng thứ YouTube không cho
  // bật tiền.
  const thamKhao = Array.isArray(y.videoThamKhao) ? y.videoThamKhao.filter((v) => v && v.tieuDe) : []
  if (thamKhao.length) {
    khoi.push([
      '===== VIDEO THAM KHẢO ĐANG CHẠY TỐT TRONG LĨNH VỰC (khán giả Mỹ) =====',
      'Đây là các video đang được xem nhiều / được đề xuất mạnh. Dùng để hiểu người xem',
      'đang quan tâm GÓC NÀO của chủ đề. TUYỆT ĐỐI không chép tiêu đề, không bám cấu trúc',
      'của video nào — dàn ý phải có góc nhìn và trình tự riêng.',
      '',
      ...thamKhao.slice(0, 15).map((v, i) => {
        const phu = [v.tenKenh, v.views ? `${Number(v.views).toLocaleString('en-US')} views` : '',
          v.subKenh ? `${Number(v.subKenh).toLocaleString('en-US')} subs` : '', v.phut ? `${v.phut} min` : '']
          .filter(Boolean).join(' · ')
        return `${i + 1}. "${v.tieuDe}"${phu ? ' — ' + phu : ''}`
      })
    ].join('\n'))
  }

  khoi.push([
    '===== VIỆC CẦN LÀM: CHỈ DÀN Ý, CHƯA VIẾT KỊCH BẢN =====',
    `Lập dàn ý ${y.soPhan} phần cho một kịch bản ${y.soTuMucTieu.toLocaleString('vi-VN')} từ bằng ${y.ngonNgu}.`,
    '',
    `Giọng kể: ${y.giongKe}`,
    `Đối tượng: ${y.doiTuong}`,
    `Mở đầu: ${y.hook}`,
    `Kêu gọi: ${y.cta}`,
    `Điều cấm: ${y.dieuCam}`,
    '',
    'Hạn mức từ của từng phần:',
    ...phan.map((p) => `  Phần ${p.so}: ${p.soTuMucTieu.toLocaleString('vi-VN')} từ`),
    '',
    'Trả lời ĐÚNG định dạng sau, mỗi phần một khối, không thêm lời dẫn:',
    '',
    'PHẦN 1 | <tiêu đề phần> | <số từ>',
    '- <ý chính 1>',
    '- <ý chính 2>',
    '- <ý chính 3>',
    '',
    'PHẦN 2 | <tiêu đề phần> | <số từ>',
    '...',
    '',
    'Yêu cầu riêng về dàn ý:',
    '- Mỗi phần phải có một chuyển biến riêng, không phần nào lặp chức năng của phần khác.',
    '- Ghi rõ phần nào chứa GÓC NHÌN RIÊNG của người làm kênh (bắt buộc có ít nhất hai phần),',
    '  vì nội dung chỉ thuật lại mà không có nhận định riêng thì YouTube không cho bật tiền.',
    '- Không phần nào được chỉ tóm tắt lại tư liệu gốc.'
  ].join('\n'))

  return khoi.join('\n\n')
}

// Phân tích dàn ý Claude trả về. Chấp nhận cả khi người dùng sửa tay lem nhem.
function phanTichDanY(chu) {
  const dong = String(chu || '').split(/\r?\n/)
  const phan = []
  let hienTai = null

  for (const d of dong) {
    const dau = d.match(/^\s*(?:PHẦN|PHAN|PART)\s*(\d+)\s*[|:–-]\s*(.*)$/i)
    if (dau) {
      if (hienTai) phan.push(hienTai)
      const con = dau[2].split('|').map((s) => s.trim())
      const soTu = Number(String(con[1] || '').replace(/[^\d]/g, '')) || 0
      hienTai = { so: Number(dau[1]), tieuDe: con[0] || `Phần ${dau[1]}`, soTuMucTieu: soTu, y: [] }
      continue
    }
    const gach = d.match(/^\s*[-*•]\s*(.+)$/)
    if (gach && hienTai) hienTai.y.push(gach[1].trim())
  }
  if (hienTai) phan.push(hienTai)
  return phan.sort((a, b) => a.so - b.so)
}

// ---------------------------------------------------------------------------
// SỔ CHỐNG LẶP — tính năng then chốt của cả module
//
// Rút từ các phần ĐÃ viết ra ba thứ, nhét vào prompt của phần tiếp theo kèm
// lệnh cấm dùng lại. Không có bước này thì tới phần 5-6 là bắt đầu lặp, và
// module Kiểm duyệt sẽ đỏ rực — sửa lúc đó đắt hơn nhiều.
// ---------------------------------------------------------------------------

function soChongLap(cacPhanDaViet, { soCum = 22, soMoDau = 10, soTuRieng = 24 } = {}) {
  const gop = (cacPhanDaViet || []).filter(Boolean).join('\n\n')
  if (!gop.trim()) return { cum: [], moDau: [], tuRieng: [], rong: true }

  const cum = cumLap(gop, { n: 4, toiThieuLan: 1 })
    .filter((c) => c.soLan >= 1)
    .slice(0, 400)

  // Các cụm 4 từ xuất hiện từ 2 lần trở lên là đã lặp sẵn rồi — ưu tiên cấm.
  const daLap = cum.filter((c) => c.soLan >= 2).map((c) => c.cum)

  // Cụm 4 từ "đặc trưng": không phải từ chức năng, xuất hiện một lần nhưng
  // đáng nhớ — cấm dùng lại để phần sau không mượn lại lối diễn đạt cũ.
  const dacTrung = cum
    .filter((c) => c.soLan === 1 && c.cum.split(' ').filter((t) => !TU_CHUC_NANG.has(t)).length >= 3)
    .map((c) => c.cum)

  const moDau = moDauCauLap(gop, { soTuDau: 2, toiThieuLan: 1 })
    .slice(0, soMoDau)
    .map((m) => m.moDau)

  // Danh từ/động từ hiếm đã dùng — dấu hiệu của ẩn dụ và hình ảnh đã xài.
  const dem = new Map()
  for (const t of tachTu(gop)) {
    if (TU_CHUC_NANG.has(t) || t.length < 6) continue
    dem.set(t, (dem.get(t) || 0) + 1)
  }
  const tuRieng = [...dem.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, soTuRieng)
    .map(([t, n]) => `${t} (${n} lần)`)

  return {
    cum: [...daLap, ...dacTrung].slice(0, soCum),
    cumDaLap: daLap.slice(0, soCum),
    moDau,
    tuRieng,
    rong: false
  }
}

// ---------------------------------------------------------------------------
// Bước 2 — prompt cho từng phần
// ---------------------------------------------------------------------------

function taoPromptPhan({
  skill = '',
  danY = [],
  phanSo = 1,
  cacPhanDaViet = [],
  loiThoai = '',
  yeuCau = {},
  soTuDuoiCuoi = 200
} = {}) {
  const y = { ...YEU_CAU_MAC_DINH, ...yeuCau }
  const muc = danY.find((p) => p.so === phanSo)
  const soTuMuc = (muc && muc.soTuMucTieu) || Math.round(y.soTuMucTieu / y.soPhan)
  const so = soChongLap(cacPhanDaViet)

  const khoi = []

  if (skill.trim()) khoi.push('===== SKILL VIẾT KỊCH BẢN =====\n' + skill.trim())

  if (danY.length) {
    khoi.push([
      '===== DÀN Ý TOÀN BÀI =====',
      ...danY.map((p) => `PHẦN ${p.so} | ${p.tieuDe} | ${p.soTuMucTieu} từ` +
        (p.y.length ? '\n' + p.y.map((i) => '  - ' + i).join('\n') : ''))
    ].join('\n'))
  }

  if (phanSo === 1 && loiThoai.trim()) {
    khoi.push('===== TƯ LIỆU GỐC (chỉ để hiểu chủ đề, KHÔNG viết lại theo) =====\n' + loiThoai.trim())
  }

  // Nối liền mạch: đưa đoạn cuối của phần trước để giọng và mạch không đứt.
  const truoc = cacPhanDaViet.filter(Boolean)
  if (truoc.length) {
    const cuoi = truoc[truoc.length - 1]
    const tu = cuoi.split(/\s+/)
    khoi.push([
      `===== ${soTuDuoiCuoi} TỪ CUỐI CỦA PHẦN ${phanSo - 1} (để viết nối liền mạch) =====`,
      tu.slice(Math.max(0, tu.length - soTuDuoiCuoi)).join(' ')
    ].join('\n'))
  }

  if (!so.rong) {
    khoi.push([
      '===== SỔ CHỐNG LẶP — KHÔNG ĐƯỢC DÙNG LẠI =====',
      'Những thứ dưới đây đã xuất hiện ở các phần trước. Phần này phải nói bằng',
      'cách khác hoàn toàn: khác cụm từ, khác cách vào câu, khác hình ảnh so sánh.',
      '',
      so.cumDaLap.length
        ? 'Các cụm ĐÃ LẶP (nguy hiểm nhất, tuyệt đối tránh):\n' + so.cumDaLap.map((c) => `  · ${c}`).join('\n')
        : '',
      so.cum.length ? 'Các cụm đã dùng:\n' + so.cum.map((c) => `  · ${c}`).join('\n') : '',
      so.moDau.length ? 'Các cách vào câu đã dùng:\n' + so.moDau.map((m) => `  · "${m}..."`).join('\n') : '',
      so.tuRieng.length ? 'Các từ đã dùng nhiều lần:\n  ' + so.tuRieng.join(', ') : ''
    ].filter(Boolean).join('\n'))
  }

  khoi.push([
    `===== VIỆC CẦN LÀM: VIẾT PHẦN ${phanSo}${muc ? ' — ' + muc.tieuDe : ''} =====`,
    `Độ dài: ${soTuMuc.toLocaleString('vi-VN')} từ (± 10%). Ngôn ngữ: ${y.ngonNgu}.`,
    muc && muc.y.length ? 'Bám các ý sau:\n' + muc.y.map((i) => '  - ' + i).join('\n') : '',
    '',
    `Giọng kể: ${y.giongKe}`,
    phanSo === 1 ? `Mở đầu: ${y.hook}` : 'Vào thẳng mạch, KHÔNG chào lại, KHÔNG tóm tắt phần trước.',
    `Điều cấm: ${y.dieuCam}`,
    '',
    'Chỉ trả về đúng văn kịch bản của phần này. Không tiêu đề, không ghi chú,',
    'không viết "Phần N" ở đầu, không giải thích gì thêm.'
  ].filter(Boolean).join('\n'))

  return khoi.join('\n\n')
}

// ---------------------------------------------------------------------------
// Sau khi dán kết quả về
// ---------------------------------------------------------------------------

function phanTichKichBan(chu, { tuMoiPhut = 150, tuMoiCanh = 27, soTuMucTieu = 0 } = {}) {
  const soTu = demTu(chu)
  const cau = tachCau(chu)
  const phut = soTu / Math.max(1, tuMoiPhut)
  const soCanh = Math.ceil(soTu / Math.max(1, tuMoiCanh))

  return {
    soTu,
    soCau: cau.length,
    soTuMoiCau: cau.length ? Math.round(soTu / cau.length) : 0,
    phutUoc: Math.round(phut * 10) / 10,
    soCanh,
    soAnhNeuGop2: Math.ceil(soCanh / 2),
    datMucTieu: soTuMucTieu ? Math.round((soTu / soTuMucTieu) * 100) : null,
    thieuTu: soTuMucTieu ? Math.max(0, soTuMucTieu - soTu) : 0
  }
}

function gopKichBan(cacPhan) {
  return (cacPhan || []).filter(Boolean).map((p) => p.trim()).join('\n\n')
}

module.exports = {
  YEU_CAU_MAC_DINH,
  chiaPhan,
  taoPromptDanY,
  phanTichDanY,
  soChongLap,
  taoPromptPhan,
  phanTichKichBan,
  gopKichBan
}
