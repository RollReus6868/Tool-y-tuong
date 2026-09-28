// Gọi Claude API (Messages) để tool TỰ viết kịch bản, không cần chép/dán.
//
// HỢP ĐỒNG ĐÃ ĐỐI CHIẾU TÀI LIỆU (platform.claude.com, 9/2026) — đừng "sửa cho đẹp":
//   POST https://api.anthropic.com/v1/messages
//   header: x-api-key, anthropic-version: 2023-06-01, content-type: application/json
//   body:   { model, max_tokens, system?, messages: [{ role: 'user', content }] }
//   trả về: content = mảng khối; CHỈ lấy khối type 'text' (Opus 5.5 bật suy nghĩ
//           thích ứng mặc định → có thể có khối 'thinking' đứng trước)
//   stop_reason: end_turn | max_tokens | refusal | …
//
// Khoá API là của người dùng, TRẢ TIỀN RIÊNG theo token — khác gói Claude trên
// claude.ai. Luôn hiện ước tính chi phí trước khi chạy.
//
// Mô-đun thuần + một hàm gọi mạng nhận fetch nhồi vào → kiểm thử tầng 1 được.

const URL_API = 'https://api.anthropic.com/v1/messages'
const PHIEN_BAN_API = '2023-06-01'

// Giá USD / 1 triệu token (vào, ra) — theo bảng giá 9/2026.
const MO_HINH = {
  'claude-opus-5-5': { ten: 'Claude Opus 5.5 (khuyến nghị — viết hay nhất trong mức giá vừa)', vao: 4, ra: 20 },
  'claude-sonnet-5': { ten: 'Claude Sonnet 5 (nhanh, rẻ bằng nửa)', vao: 2, ra: 10 },
  'claude-haiku-4-5-20251001': { ten: 'Claude Haiku 4.5 (rẻ nhất, văn kém hơn)', vao: 1, ra: 5 }
}
const MO_HINH_MAC_DINH = 'claude-opus-5-5'

function yeuCauClaude({ khoa, moHinh = MO_HINH_MAC_DINH, prompt, heThong = '', maxTokens = 16000 }) {
  const than = {
    model: moHinh,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  }
  if (heThong) than.system = heThong
  return {
    url: URL_API,
    tuyChon: {
      method: 'POST',
      headers: {
        'x-api-key': khoa,
        'anthropic-version': PHIEN_BAN_API,
        'content-type': 'application/json'
      },
      body: JSON.stringify(than)
    }
  }
}

function docTraLoiClaude(json) {
  const khoi = Array.isArray(json && json.content) ? json.content : []
  const chu = khoi.filter((k) => k && k.type === 'text').map((k) => k.text || '').join('')
  const u = (json && json.usage) || {}
  return {
    chu,
    lyDoDung: (json && json.stop_reason) || '',
    tokVao: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
    tokRa: u.output_tokens || 0
  }
}

// Mã lỗi → câu người dùng hiểu và biết làm gì.
function moTaLoiClaude(maHttp, than) {
  let kieu = ''
  let thongDiep = ''
  try {
    const j = typeof than === 'string' ? JSON.parse(than) : than
    kieu = (j && j.error && j.error.type) || ''
    thongDiep = (j && j.error && j.error.message) || ''
  } catch (_) {}
  if (maHttp === 401 || kieu === 'authentication_error') return 'Khoá Claude API sai hoặc đã bị thu hồi. Kiểm lại ở Cài đặt → Claude API.'
  if (maHttp === 403 || kieu === 'permission_error') return 'Khoá Claude API không có quyền dùng mô hình này.'
  if (/credit|billing|balance/i.test(thongDiep)) return 'Tài khoản Claude API hết tiền (credit). Nạp thêm ở console.anthropic.com → Billing.'
  if (maHttp === 429 || kieu === 'rate_limit_error') return 'Gọi quá nhanh / vượt hạn mức phút của tài khoản API — tool đã thử lại mà vẫn bị chặn. Đợi 1–2 phút rồi bấm chạy tiếp.'
  if (maHttp === 529 || kieu === 'overloaded_error') return 'Máy chủ Claude đang quá tải — tool đã thử lại mà vẫn chưa được. Đợi vài phút rồi bấm chạy tiếp.'
  if (maHttp === 400 || kieu === 'invalid_request_error') return 'Yêu cầu bị từ chối (lỗi của tool hoặc tên mô hình sai): ' + (thongDiep || 'HTTP 400')
  if (maHttp >= 500) return `Máy chủ Claude lỗi (HTTP ${maHttp}). Thử lại sau ít phút.`
  return thongDiep || `HTTP ${maHttp}`
}

// Có nên thử lại không: quá tải / hạn mức / lỗi máy chủ thì có; khoá sai thì không.
function nenThuLai(maHttp) {
  return maHttp === 429 || maHttp === 529 || (maHttp >= 500 && maHttp < 600)
}

function taoGoiClaude({ khoa, moHinh = MO_HINH_MAC_DINH, fetchHam = fetch, ngu = (ms) => new Promise((r) => setTimeout(r, ms)), soLanThu = 3, thoiCho = 600000 }) {
  return async function goi(prompt, { maxTokens = 16000, heThong = '' } = {}) {
    const { url, tuyChon } = yeuCauClaude({ khoa, moHinh, prompt, heThong, maxTokens })
    let loiCuoi = null
    for (let lan = 1; lan <= soLanThu; lan++) {
      const huy = typeof AbortController !== 'undefined' ? new AbortController() : null
      const hen = huy ? setTimeout(() => huy.abort(), thoiCho) : null
      let traLoi
      try {
        traLoi = await fetchHam(url, { ...tuyChon, signal: huy ? huy.signal : undefined })
      } catch (e) {
        loiCuoi = new Error(e && e.name === 'AbortError' ? 'Claude trả lời quá lâu (quá 10 phút), đã dừng.' : 'Không kết nối được Claude API: ' + (e && e.message))
        if (lan < soLanThu) { await ngu(4000 * lan); continue }
        throw loiCuoi
      } finally {
        if (hen) clearTimeout(hen)
      }
      const chu = await traLoi.text()
      if (traLoi.ok) {
        let json
        try { json = JSON.parse(chu) } catch (e) { throw new Error('Claude API trả về dữ liệu không đọc được: ' + e.message) }
        return docTraLoiClaude(json)
      }
      loiCuoi = new Error(moTaLoiClaude(traLoi.status, chu))
      loiCuoi.maHttp = traLoi.status
      if (!nenThuLai(traLoi.status) || lan === soLanThu) throw loiCuoi
      // 429 có header retry-after (giây) thì tôn trọng nó.
      const doiGiay = Number(traLoi.headers && traLoi.headers.get && traLoi.headers.get('retry-after')) || 0
      await ngu(doiGiay ? doiGiay * 1000 : 8000 * lan)
    }
    throw loiCuoi
  }
}

// Ước tính chi phí TRƯỚC khi chạy. Token ≈ 1,35 × số từ tiếng Anh.
// Mỗi lượt gọi đều mang skill + dàn ý; tư liệu gốc chỉ mang ở dàn ý và phần 1.
// Chưa tính phần "suy nghĩ" của mô hình (tính như token ra) — nói rõ trên giao diện.
function uocChiPhi({ moHinh = MO_HINH_MAC_DINH, soTuSkill = 0, soTuTuLieu = 0, soTuMucTieu = 11000, soPhan = 8 }) {
  const gia = MO_HINH[moHinh] || MO_HINH[MO_HINH_MAC_DINH]
  const tok = (tu) => Math.round(tu * 1.35)
  const khungMoiLuot = tok(soTuSkill) + 900
  const vaoDanY = khungMoiLuot + tok(soTuTuLieu)
  const vaoMoiPhan = khungMoiLuot + tok(600) + 700 // dàn ý + 200 từ cuối + sổ chống lặp
  const tokVao = vaoDanY + soPhan * vaoMoiPhan + tok(soTuTuLieu)
  const tokRa = tok(soTuMucTieu) + 900
  const usd = (tokVao * gia.vao + tokRa * gia.ra) / 1e6
  return { tokVao, tokRa, usd: Math.round(usd * 100) / 100, usdCoSuyNghi: Math.round(usd * 2 * 100) / 100, soLuot: soPhan + 1 }
}

function chiPhiThat(tokVao, tokRa, moHinh = MO_HINH_MAC_DINH) {
  const gia = MO_HINH[moHinh] || MO_HINH[MO_HINH_MAC_DINH]
  return Math.round(((tokVao * gia.vao + tokRa * gia.ra) / 1e6) * 100) / 100
}

module.exports = {
  URL_API,
  PHIEN_BAN_API,
  MO_HINH,
  MO_HINH_MAC_DINH,
  yeuCauClaude,
  docTraLoiClaude,
  moTaLoiClaude,
  nenThuLai,
  taoGoiClaude,
  uocChiPhi,
  chiPhiThat
}
