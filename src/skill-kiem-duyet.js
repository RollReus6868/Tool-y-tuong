// Skill kiểm duyệt — chuẩn mực kiểm duyệt đóng thành MỘT TỆP thay được.
//
// Một skill là tệp .md (hoặc .json) gồm hai phần:
//   - khối ```json có khoá "luat": bộ luật để máy quét ngay trên máy;
//   - phần chữ còn lại: hướng dẫn cho Claude khi "nhờ soi lại bằng phán đoán".
//
// Chuẩn có sẵn của tool (skill-kiem-duyet-mac-dinh.md) cũng chỉ là một skill
// như vậy — không có đường riêng nào cho nó. Nhờ thế YouTube đổi chính sách
// thì thêm một tệp skill mới là xong, không phải chờ bản tool mới.

const fs = require('fs')
const path = require('path')

const MUC_DO = ['đỏ', 'vàng']
const NHOM = ['kenh', 'quang-cao', 'cong-dong']

function boBOM(s) {
  return String(s || '').replace(/^﻿/, '')
}

// Trả về danh sách lỗi của MỘT luật. Rỗng = dùng được.
function loiCuaLuat(l) {
  const loi = []
  if (!l || typeof l !== 'object') return ['không phải một đối tượng']
  if (!l.ma) loi.push('thiếu "ma"')
  if (!l.ten) loi.push('thiếu "ten"')
  if (!MUC_DO.includes(l.mucDo)) loi.push('"mucDo" phải là "đỏ" hoặc "vàng"')
  if (l.nhom && !NHOM.includes(l.nhom)) loi.push('"nhom" phải là kenh / quang-cao / cong-dong')
  const coTu = Array.isArray(l.tuKhoa) && l.tuKhoa.length
  const coMau = Array.isArray(l.mau) && l.mau.length
  if (!coTu && !coMau) loi.push('phải có "tuKhoa" hoặc "mau"')
  for (const m of (coMau ? l.mau : [])) {
    try { new RegExp(m, 'gi') } catch (e) { loi.push(`mẫu "${m}" sai cú pháp: ${e.message}`) }
  }
  return loi
}

// Đọc một tệp skill. KHÔNG bao giờ âm thầm bỏ qua JSON vỡ: khối luật hỏng thì
// trả lỗi nói rõ, để người dùng không tưởng skill đang chạy trong khi 0 luật
// được nạp.
function docSkill(noiDung, ten = 'skill') {
  const tho = boBOM(noiDung)
  const ra = { ten, phienBan: '', luat: [], loi: [], huongDan: '' }
  let khoiJson = []
  let chu = tho

  let nguyenTepLaJson = null
  if (/^\s*[{[]/.test(tho)) {
    try { nguyenTepLaJson = JSON.parse(tho) } catch (e) {
      if (/\.json$/i.test(ten)) { ra.loi.push('Tệp JSON vỡ: ' + e.message); return ra }
    }
  }

  if (nguyenTepLaJson) {
    khoiJson = [nguyenTepLaJson]
    chu = ''
  } else {
    chu = tho.replace(/```json\s*\n([\s\S]*?)```/gi, (ca, trong) => {
      if (!/"luat"\s*:/.test(trong)) return ca   // khối json ví dụ khác, để nguyên
      try { khoiJson.push(JSON.parse(trong)) } catch (e) { ra.loi.push('Khối JSON bộ luật vỡ: ' + e.message) }
      return ''
    })
    // Bỏ phần đầu tệp kiểu "--- name: ... ---" của SKILL.md
    chu = chu.replace(/^---\n[\s\S]*?\n---\n/, '')
  }

  const daCo = new Set()
  for (const k of khoiJson) {
    const ds = Array.isArray(k) ? k : (k && k.luat)
    if (!Array.isArray(ds)) { ra.loi.push('Khối JSON không có mảng "luat".'); continue }
    if (k.phienBan) ra.phienBan = String(k.phienBan)
    for (const l of ds) {
      const loi = loiCuaLuat(l)
      if (loi.length) { ra.loi.push(`Luật "${(l && (l.ma || l.ten)) || '?'}": ${loi.join('; ')}`); continue }
      if (daCo.has(l.ma)) { ra.loi.push(`Luật "${l.ma}" bị lặp mã trong cùng một skill — chỉ lấy bản đầu.`); continue }
      daCo.add(l.ma)
      ra.luat.push({ nhom: 'quang-cao', giaiThich: '', huongSua: '', ...l })
    }
  }

  ra.huongDan = chu.trim()
  if (!ra.luat.length && !ra.huongDan) ra.loi.push('Tệp trống: không có luật, cũng không có hướng dẫn.')
  return ra
}

let boNhoMacDinh = null
function docMacDinh() {
  if (!boNhoMacDinh) {
    const noiDung = fs.readFileSync(path.join(__dirname, 'skill-kiem-duyet-mac-dinh.md'), 'utf8')
    boNhoMacDinh = { ...docSkill(noiDung, 'Chuẩn kiếm tiền YouTube (có sẵn)'), noiDung }
  }
  return boNhoMacDinh
}

// Gộp nhiều skill thành một bộ luật. Skill đứng SAU thắng skill đứng trước khi
// trùng "ma" — đó là cách cập nhật một luật có sẵn mà không phải sửa tool.
function gopBoLuat(cacSkill) {
  const theoMa = new Map()
  for (const s of cacSkill) {
    for (const l of (s.luat || [])) theoMa.set(l.ma, { ...l, nguonSkill: s.ten })
  }
  return {
    phienBan: cacSkill.map((s) => s.phienBan).filter(Boolean).join(' + '),
    luat: [...theoMa.values()]
  }
}

// Prompt để dán vào Claude: máy chỉ đếm chữ, không phân biệt được "kể" với
// "tả", "tường thuật" với "cổ vũ" — phần đó phải nhờ phán đoán.
function taoPromptSoiLai({ kichBan = '', cacSkill = [], baoCao = null } = {}) {
  const khoi = []
  khoi.push('Bạn là người kiểm duyệt kịch bản video YouTube tiếng Anh trước khi sản xuất. ' +
    'Soi KỊCH BẢN bên dưới theo đúng CHUẨN KIỂM DUYỆT được cung cấp, trả lời bằng tiếng Việt.')

  const huongDan = cacSkill.filter((s) => s.huongDan).map((s) => `### ${s.ten}\n\n${s.huongDan}`)
  if (huongDan.length) khoi.push('===== CHUẨN KIỂM DUYỆT =====\n' + huongDan.join('\n\n'))

  if (baoCao) {
    const dong = []
    for (const r of (baoCao.ruiRo ? baoCao.ruiRo.muc : [])) dong.push(`- [${r.mucDo}] ${r.ten}: ${r.lyDo}`)
    for (const c of ((baoCao.chinhSach && baoCao.chinhSach.co) || [])) {
      dong.push(`- [cờ ${c.mucDo}] ${c.ten}${c.tuTrung.length ? ' — khớp: ' + c.tuTrung.slice(0, 8).join(', ') : ''}`)
    }
    if (dong.length) {
      khoi.push('===== MÁY QUÉT ĐÃ THẤY (chỉ đếm chữ, có thể báo oan hoặc bỏ sót) =====\n' + dong.join('\n') +
        '\n\nVới mỗi cờ: xác nhận là rủi ro thật hay báo oan, kèm lý do.')
    }
  }

  khoi.push('===== YÊU CẦU ĐẦU RA =====\n' +
    '1. Bảng rủi ro: mức (ĐỎ/VÀNG) · kiểu (A tắt kiếm tiền kênh / B mất quảng cáo video / C gỡ video) · trích đúng câu · vì sao · câu viết lại cụ thể.\n' +
    '2. Phần nào trong kịch bản là nhận định riêng của người kể? Nếu gần như không có, chỉ ra 5 chỗ nên chèn và viết mẫu.\n' +
    '3. Các đoạn lặp ý nên cắt.\n' +
    '4. Kết luận một dòng: AN TOÀN ĐỂ SẢN XUẤT / SỬA RỒI SẢN XUẤT / VIẾT LẠI.\n' +
    'Nói thẳng những gì KHÔNG soi được từ kịch bản (hình ảnh, thumbnail, tiêu đề, các video khác của kênh).')

  khoi.push('===== KỊCH BẢN =====\n' + String(kichBan).trim())
  return khoi.join('\n\n')
}

module.exports = { docSkill, docMacDinh, gopBoLuat, taoPromptSoiLai, loiCuaLuat, MUC_DO, NHOM }
