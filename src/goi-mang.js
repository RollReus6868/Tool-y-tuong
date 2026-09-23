// Gọi mạng. Tách riêng để kiểm thử tầng 1 nhồi hàm giả vào được mà không cần
// mạng thật.

const THOI_CHO_MAC_DINH = 20000

async function layJSON(url, { thoiCho = THOI_CHO_MAC_DINH } = {}) {
  const huy = new AbortController()
  const hen = setTimeout(() => huy.abort(), thoiCho)
  try {
    const traLoi = await fetch(url, {
      signal: huy.signal,
      headers: { 'Accept-Language': 'en-US,en;q=0.9' }
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

module.exports = { layJSON, layChu, layGoiY, layNhiPhan, phanTichGoiY, urlGoiY }
