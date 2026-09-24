// Gọi mạng. Tách riêng để kiểm thử tầng 1 nhồi hàm giả vào được mà không cần
// mạng thật.

const THOI_CHO_MAC_DINH = 20000

// tieuDe: header thêm (Pexels đòi khoá ở header Authorization, Wikimedia đòi
// User-Agent có địa chỉ liên hệ).
async function layJSON(url, { thoiCho = THOI_CHO_MAC_DINH, tieuDe = {} } = {}) {
  const huy = new AbortController()
  const hen = setTimeout(() => huy.abort(), thoiCho)
  try {
    const traLoi = await fetch(url, {
      signal: huy.signal,
      headers: { 'Accept-Language': 'en-US,en;q=0.9', ...tieuDe }
    })
    const chu = await docChu(traLoi)
    if (!traLoi.ok) {
      const loi = new Error(`HTTP ${traLoi.status}`)
      loi.maHttp = traLoi.status
      loi.than = chu
      throw loi
    }
    return JSON.parse(chu)
  } finally {
    clearTimeout(hen)
  }
}

// Autocomplete của Google đôi khi trả về latin-1 chứ không phải utf-8. Đọc thô
// rồi tự giải mã, không tin traLoi.json().
async function docChu(traLoi) {
  const đem = await traLoi.arrayBuffer()
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(đem)
  if (!utf8.includes('�')) return utf8
  return new TextDecoder('windows-1252').decode(đem)
}

async function layChu(url, { thoiCho = THOI_CHO_MAC_DINH } = {}) {
  const huy = new AbortController()
  const hen = setTimeout(() => huy.abort(), thoiCho)
  try {
    const traLoi = await fetch(url, { signal: huy.signal })
    return await docChu(traLoi)
  } finally {
    clearTimeout(hen)
  }
}

// ---------------------------------------------------------------------------
// Gợi ý tìm kiếm của YouTube (MIỄN PHÍ, không tốn quota API).
//
// Dùng client=firefox vì nó trả JSON thuần: ["query",["gợi ý 1","gợi ý 2",...]]
// client=youtube trả JSONP kiểu window.google.ac.h([...]) phải bóc vỏ, dễ vỡ.
// ---------------------------------------------------------------------------

// gl=us: gợi ý theo người xem MỸ. Chỉ có hl=en thì Google trả gợi ý tiếng Anh
// nhưng theo vị trí của máy đang gọi — tức là theo người xem Việt Nam, lệch
// hẳn tệp khách hàng của kênh.
function urlGoiY(cum, hl = 'en', gl = 'us') {
  const q = encodeURIComponent(cum)
  return `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=${hl}&gl=${gl}&q=${q}`
}

// Hàm thuần — kiểm thử tầng 1 gọi trực tiếp với chuỗi mẫu.
function phanTichGoiY(chu) {
  if (typeof chu !== 'string' || !chu.trim()) return []
  let duLieu
  try {
    duLieu = JSON.parse(chu)
  } catch (_) {
    // Dự phòng: nếu Google đổi sang JSONP thì bóc phần trong ngoặc ngoài cùng.
    const dau = chu.indexOf('(')
    const cuoi = chu.lastIndexOf(')')
    if (dau < 0 || cuoi <= dau) return []
    try {
      duLieu = JSON.parse(chu.slice(dau + 1, cuoi))
    } catch (_) {
      return []
    }
  }
  if (!Array.isArray(duLieu) || !Array.isArray(duLieu[1])) return []
  return duLieu[1]
    .map((m) => (Array.isArray(m) ? m[0] : m))
    .filter((m) => typeof m === 'string' && m.trim())
    .map((m) => m.trim().toLowerCase())
}

async function layGoiY(cum, { hl = 'en', gl = 'us', layChuHam = layChu } = {}) {
  try {
    const chu = await layChuHam(urlGoiY(cum, hl, gl))
    return phanTichGoiY(chu)
  } catch (_) {
    // Mất mạng hoặc bị chặn: trả rỗng, phía trên tự hạ xuống chấm điểm cục bộ.
    return null
  }
}

// Tải tệp nhị phân (thumbnail). Trả về { ok, maHttp, du } — KHÔNG ném lỗi khi
// 404, vì với thumbnail 404 là chuyện bình thường (video không có bản 1280px)
// và phía trên cần biết để thử cỡ nhỏ hơn.
async function layNhiPhan(url, { thoiCho = THOI_CHO_MAC_DINH } = {}) {
  const huy = new AbortController()
  const hen = setTimeout(() => huy.abort(), thoiCho)
  try {
    const traLoi = await fetch(url, { signal: huy.signal })
    const du = Buffer.from(await traLoi.arrayBuffer())
    return { ok: traLoi.ok, maHttp: traLoi.status, du }
  } finally {
    clearTimeout(hen)
  }
}

// Tải tệp LỚN (video footage 20–150 MB) thẳng xuống đĩa theo từng khúc — không
// dồn cả tệp vào bộ nhớ như layNhiPhan. Ghi ra "<đích>.dang-tai" rồi mới đổi
// tên: tải hỏng giữa chừng thì không để lại tệp cụt mang tên số cảnh (CapCut sẽ
// nhận nhầm tệp cụt đó là hình của cảnh).
async function taiVeTep(url, dich, { thoiCho = 300000, tieuDe = {}, baoByte = null } = {}) {
  const fs = require('fs')
  const huy = new AbortController()
  const hen = setTimeout(() => huy.abort(), thoiCho)
  const tam = dich + '.dang-tai'
  try {
    const traLoi = await fetch(url, { signal: huy.signal, headers: tieuDe, redirect: 'follow' })
    if (!traLoi.ok || !traLoi.body) return { ok: false, maHttp: traLoi.status, soByte: 0 }
    const tong = Number(traLoi.headers.get('content-length')) || 0
    const kieu = traLoi.headers.get('content-type') || ''
    const ghi = fs.createWriteStream(tam)
    let da = 0
    try {
      for await (const khuc of traLoi.body) {
        da += khuc.length
        if (!ghi.write(khuc)) await new Promise((r) => ghi.once('drain', r))
        if (baoByte) baoByte(da, tong)
      }
    } finally {
      await new Promise((r) => ghi.end(r))
    }
    fs.renameSync(tam, dich)
    return { ok: true, maHttp: traLoi.status, soByte: da, kieu }
  } catch (e) {
    try { require('fs').unlinkSync(tam) } catch (_) {}
    throw e
  } finally {
    clearTimeout(hen)
  }
}

module.exports = { layJSON, layChu, layGoiY, layNhiPhan, taiVeTep, phanTichGoiY, urlGoiY }
