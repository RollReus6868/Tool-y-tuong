// Tìm footage ở các nguồn DÙNG THƯƠNG MẠI ĐƯỢC cho kênh YouTube kiếm tiền.
//
// Người dùng đã chốt: stock + lưu trữ công. KHÔNG tải video YouTube, KHÔNG
// clip tin tức — kênh kiếm tiền dính Content ID / chính sách "nội dung dùng
// lại" là mất cả kênh.
//
// | Nguồn            | Khoá      | Giới hạn                       | Giấy phép                          |
// |------------------|-----------|--------------------------------|------------------------------------|
// | Pexels           | có (free) | 200 lượt/giờ, 20.000/tháng     | Pexels License — dùng thương mại   |
// | Pixabay          | có (free) | 100 lượt/phút, PHẢI cache 24h  | Pixabay Content License            |
// | Wikimedia Commons| không     | lịch sự: có User-Agent         | từng tệp một — lọc PD / CC0 / CC BY|
// | Library of Congress | không  | lịch sự                        | từng mục — thường "no known restrictions" |
//
// ĐƯỜNG DẪN ĐÃ ĐỐI CHIẾU TÀI LIỆU (9/2026) — đừng "sửa cho đẹp":
//   https://api.pexels.com/v1/search           (ảnh)
//   https://api.pexels.com/v1/videos/search    (video)
//   https://pixabay.com/api/                   (ảnh)   per_page 3–200, q ≤ 100 ký tự
//   https://pixabay.com/api/videos/            (video)
//   https://commons.wikimedia.org/w/api.php    generator=search, namespace 6 (File:)
//   https://www.loc.gov/photos/?fo=json&c=…    c = số kết quả mỗi trang
//
// Mô-đun thuần: nhận hàm lấy JSON nhồi vào, kiểm thử tầng 1 không cần mạng.

const USER_AGENT = 'ToolYTuong/0.5 (https://github.com/RollReus6868/Tool-y-tuong)'

const NGUON = {
  pexels: 'Pexels',
  pixabay: 'Pixabay',
  wikimedia: 'Wikimedia Commons',
  loc: 'Library of Congress'
}

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

function catQ(q, toiDa = 100) {
  return String(q || '').replace(/\s+/g, ' ').trim().slice(0, toiDa)
}

function urlPexels(loai, q, soLuong = 10) {
  const n = Math.min(80, Math.max(1, soLuong))
  const goc = loai === 'video' ? 'https://api.pexels.com/v1/videos/search' : 'https://api.pexels.com/v1/search'
  return `${goc}?query=${encodeURIComponent(catQ(q, 200))}&per_page=${n}&orientation=landscape`
}

function urlPixabay(loai, q, khoa, soLuong = 10) {
  const n = Math.min(200, Math.max(3, soLuong))
  const goc = loai === 'video' ? 'https://pixabay.com/api/videos/' : 'https://pixabay.com/api/'
  const them = loai === 'video' ? '&video_type=film' : '&image_type=photo&orientation=horizontal&min_width=1280'
  return `${goc}?key=${encodeURIComponent(khoa)}&q=${encodeURIComponent(catQ(q))}&per_page=${n}&safesearch=true${them}`
}

function urlWikimedia(q, soLuong = 10) {
  const tim = `${catQ(q, 200)} filetype:bitmap`
  return 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2' +
    `&generator=search&gsrsearch=${encodeURIComponent(tim)}&gsrnamespace=6&gsrlimit=${Math.min(50, soLuong)}` +
    '&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=1920' +
    '&iiextmetadatafilter=LicenseShortName%7CArtist%7CUsageTerms%7CObjectName&origin=*'
}

function urlLoc(q, soLuong = 10) {
  return `https://www.loc.gov/photos/?q=${encodeURIComponent(catQ(q, 200))}&fo=json&c=${Math.min(100, soLuong)}` +
    '&fa=online-format:image%7Caccess-restricted:false'
}

// ---------------------------------------------------------------------------
// Đọc kết quả → ứng viên thống nhất
//
// { id, nguon, loai:'video'|'anh', tieuDe, trang, taiVe, duoi, rong, cao,
//   thoiLuong, tacGia, giayPhep, thumb }
// ---------------------------------------------------------------------------

function duoiTuUrl(url, macDinh) {
  const m = String(url || '').split(/[?#]/)[0].match(/\.([a-z0-9]{2,4})$/i)
  if (!m) return macDinh
  const d = m[1].toLowerCase()
  return d === 'jpeg' ? 'jpg' : d
}

// Chọn bản ~1920 px: 4K nặng gấp bốn mà CapCut dựng 1080p thì cũng bỏ phí.
function chonBanVideo(cacBan) {
  const mp4 = (cacBan || []).filter((b) => b && b.link && (!b.file_type || /mp4/i.test(b.file_type)) && b.width)
  if (!mp4.length) return null
  const vua = mp4.filter((b) => b.width <= 1920).sort((a, b) => b.width - a.width)
  if (vua.length && vua[0].width >= 1280) return vua[0]
  return mp4.sort((a, b) => a.width - b.width).find((b) => b.width >= 1280) || vua[0] || mp4[0]
}

function docPexelsVideo(json) {
  return ((json && json.videos) || []).map((v) => {
    const ban = chonBanVideo(v.video_files)
    if (!ban) return null
    return {
      id: `pexels-v-${v.id}`,
      nguon: NGUON.pexels,
      loai: 'video',
      tieuDe: tieuDeTuSlug(v.url),
      trang: v.url || '',
      taiVe: ban.link,
      duoi: 'mp4',
      rong: ban.width,
      cao: ban.height,
      thoiLuong: Number(v.duration) || 0,
      tacGia: (v.user && v.user.name) || '',
      giayPhep: 'Pexels License',
      thumb: v.image || ''
    }
  }).filter(Boolean)
}

function docPexelsAnh(json) {
  return ((json && json.photos) || []).map((p) => {
    const src = p.src || {}
    const taiVe = src.large2x || src.original || src.large
    if (!taiVe) return null
    return {
      id: `pexels-a-${p.id}`,
      nguon: NGUON.pexels,
      loai: 'anh',
      tieuDe: p.alt || tieuDeTuSlug(p.url),
      trang: p.url || '',
      taiVe,
      duoi: 'jpg',
      rong: p.width,
      cao: p.height,
      thoiLuong: 0,
      tacGia: p.photographer || '',
      giayPhep: 'Pexels License',
      thumb: src.medium || src.small || src.tiny || ''
    }
  }).filter(Boolean)
}

function docPixabayVideo(json) {
  return ((json && json.hits) || []).map((h) => {
    const v = h.videos || {}
    const ban = [v.large, v.medium, v.small].find((b) => b && b.url && b.width >= 1280) || v.medium || v.small
    if (!ban || !ban.url) return null
    return {
      id: `pixabay-v-${h.id}`,
      nguon: NGUON.pixabay,
      loai: 'video',
      tieuDe: h.tags || '',
      trang: h.pageURL || '',
      taiVe: ban.url,
      duoi: 'mp4',
      rong: ban.width,
      cao: ban.height,
      thoiLuong: Number(h.duration) || 0,
      tacGia: h.user || '',
      giayPhep: 'Pixabay Content License',
      thumb: ban.thumbnail || (v.tiny && v.tiny.thumbnail) || ''
    }
  }).filter(Boolean)
}

function docPixabayAnh(json) {
  return ((json && json.hits) || []).map((h) => {
    if (!h.largeImageURL) return null
    return {
      id: `pixabay-a-${h.id}`,
      nguon: NGUON.pixabay,
      loai: 'anh',
      tieuDe: h.tags || '',
      trang: h.pageURL || '',
      taiVe: h.largeImageURL,
      duoi: duoiTuUrl(h.largeImageURL, 'jpg'),
      rong: h.imageWidth,
      cao: h.imageHeight,
      thoiLuong: 0,
      tacGia: h.user || '',
      giayPhep: 'Pixabay Content License',
      thumb: h.webformatURL || h.previewURL || ''
    }
  }).filter(Boolean)
}

function boHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}

// Giấy phép Commons: chỉ nhận tệp dùng thương mại được VÀ sửa được (cắt, pan,
// chèn vào video). NC (phi thương mại) và ND (cấm sửa) loại thẳng. BY-SA mặc
// định loại: điều khoản "chia sẻ tương tự" với video YouTube là vùng xám.
function giayPhepChapNhan(ten, { choBySa = false } = {}) {
  const s = String(ten || '').toLowerCase()
  if (!s) return false
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv|fair use/.test(s)) return false
  if (/public domain|^pd\b|^pd-|cc0|no restrictions/.test(s)) return true
  if (/cc[ -]by[ -]sa|by-sa/.test(s)) return !!choBySa
  if (/cc[ -]by\b|cc-by-\d|^by\b/.test(s)) return true
  return false
}

function docWikimedia(json, { choBySa = false } = {}) {
  const trang = ((json && json.query && json.query.pages) || [])
  const ds = Array.isArray(trang) ? trang : Object.values(trang)
  return ds
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .map((p) => {
      const ii = (p.imageinfo || [])[0]
      if (!ii) return null
      if (!/^image\/(jpeg|png|tiff|webp)$/i.test(ii.mime || '')) return null
      const meta = ii.extmetadata || {}
      const giayPhep = boHtml(meta.LicenseShortName && meta.LicenseShortName.value)
      if (!giayPhepChapNhan(giayPhep, { choBySa })) return null
      // thumburl là bản thu về ≤1920 px, luôn jpg/png — tệp gốc có thể là TIFF 200 MB.
      const taiVe = ii.thumburl || ii.url
      return {
        id: `wikimedia-${p.pageid || p.title}`,
        nguon: NGUON.wikimedia,
        loai: 'anh',
        tieuDe: boHtml(meta.ObjectName && meta.ObjectName.value) || String(p.title || '').replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        trang: ii.descriptionurl || '',
        taiVe,
        duoi: duoiTuUrl(taiVe, 'jpg'),
        rong: ii.thumbwidth || ii.width,
        cao: ii.thumbheight || ii.height,
        thoiLuong: 0,
        tacGia: boHtml(meta.Artist && meta.Artist.value).slice(0, 120),
        giayPhep,
        thumb: taiVe
      }
    })
    .filter(Boolean)
}

// Ảnh LoC: image_url là mảng từ nhỏ tới lớn, mỗi phần tử có thể kèm "#h=…&w=…".
function docLoc(json) {
  return ((json && json.results) || []).map((r) => {
    if (r.access_restricted === true || r['access-restricted'] === true) return null
    const cac = (r.image_url || []).map((u) => String(u).split('#')[0]).filter(Boolean)
    if (!cac.length) return null
    const taiVe = cac[cac.length - 1]
    const kichCo = String((r.image_url || [])[r.image_url.length - 1] || '').match(/[#&]w=(\d+)/)
    const url = r.url || r.id || ''
    return {
      id: `loc-${url}`,
      nguon: NGUON.loc,
      loai: 'anh',
      tieuDe: boHtml(r.title),
      trang: url,
      taiVe: taiVe.startsWith('//') ? 'https:' + taiVe : taiVe,
      duoi: duoiTuUrl(taiVe, 'jpg'),
      rong: kichCo ? Number(kichCo[1]) : 0,
      cao: 0,
      thoiLuong: 0,
      tacGia: Array.isArray(r.contributor) ? r.contributor.slice(0, 2).join(', ') : '',
      // LoC không ghi giấy phép trong kết quả tìm kiếm — người dùng phải xem trang.
      giayPhep: 'LoC — xem "Rights" trên trang gốc',
      thumb: cac[0].startsWith('//') ? 'https:' + cac[0] : cac[0]
    }
  }).filter(Boolean)
}

function tieuDeTuSlug(url) {
  const m = String(url || '').match(/\/(?:video|photo)\/([a-z0-9-]+?)-\d+\/?$/i)
  return m ? m[1].replace(/-/g, ' ') : ''
}

// ---------------------------------------------------------------------------
// Chấm điểm ứng viên
// ---------------------------------------------------------------------------

function tuCua(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
}

// Khớp theo GỐC TỪ — "stories" phải khớp "story" (bài học từ radar 0.4.0).
function gocTu(w) {
  return w.replace(/(ies|es|s|ing|ed)$/, '')
}

function chamUngVien(uv, { tuKhoa = '', giayCanh = 9, viTri = 0 } = {}) {
  let diem = 0
  const lyDo = []

  const can = [...new Set(tuCua(tuKhoa).map(gocTu))]
  const co = new Set(tuCua(uv.tieuDe).map(gocTu))
  const khop = can.filter((w) => co.has(w)).length
  if (can.length) diem += 3 * (khop / can.length)
  if (khop) lyDo.push(`khớp ${khop}/${can.length} từ`)

  // Khung ngang. Ảnh đứng cắt vào khung 16:9 là mất quá nửa.
  if (uv.rong && uv.cao) {
    const tyLe = uv.rong / uv.cao
    if (tyLe < 1) { diem -= 3; lyDo.push('khung đứng') } else if (tyLe >= 1.3) diem += 0.5
  }

  if (uv.loai === 'video') {
    // Video phải dài hơn thời lượng cảnh (+ khoảng nghỉ CapCut ~0,4 s), nếu
    // không CapCut phải làm chậm hoặc lùi về ảnh.
    const can2 = giayCanh + 1
    if (uv.thoiLuong >= can2 && uv.thoiLuong <= 60) diem += 1
    else if (uv.thoiLuong > 60) diem += 0.4
    else { diem -= 2; lyDo.push(`ngắn ${uv.thoiLuong}s`) }
    if (uv.rong >= 1920) diem += 0.5
    else if (uv.rong < 1280) { diem -= 1; lyDo.push('độ phân giải thấp') }
  } else if (uv.rong) {
    if (uv.rong >= 1600) diem += 0.5
    else if (uv.rong < 1000) { diem -= 1; lyDo.push('ảnh nhỏ') }
  }

  if (/Pexels|Pixabay|^public domain|cc0/i.test(uv.giayPhep)) diem += 0.3
  else if (/^LoC/.test(uv.giayPhep)) { diem -= 0.3; lyDo.push('tự kiểm quyền LoC') }

  // Thứ hạng của chính nguồn cũng là tín hiệu liên quan.
  diem += Math.max(0, 0.6 - viTri * 0.1)

  return { diem: Math.round(diem * 100) / 100, lyDo }
}

// ---------------------------------------------------------------------------
// Tìm cho một cảnh
// ---------------------------------------------------------------------------

// Thứ tự nguồn theo loại cảnh. Người thật / lịch sử → kho lưu trữ trước; cảnh
// quan, thành phố → stock trước.
function thuTuNguon(kieu, tuKhoa, bat) {
  const lichSu = /\b(1[5-9]\d\ds?|portrait|historic|historical|archive|vintage|war|president|civil rights)\b/i.test(tuKhoa)
  let ds
  if (kieu === 'video') ds = [['pexels', 'video'], ['pixabay', 'video'], ['pexels', 'anh'], ['pixabay', 'anh']]
  else if (lichSu) ds = [['wikimedia', 'anh'], ['loc', 'anh'], ['pexels', 'anh'], ['pixabay', 'anh']]
  else ds = [['pexels', 'anh'], ['pixabay', 'anh'], ['wikimedia', 'anh']]
  return ds.filter(([n]) => bat[n])
}

function taoTimKiem({ layJSONHam, khoa = {}, bat = {}, cache = null, choBySa = false, nhatKy = null }) {
  async function goiNguon(nguon, loai, q, soLuong) {
    const maCache = `${nguon}|${loai}|${q.toLowerCase()}`
    if (cache) {
      const co = cache.lay(maCache)
      if (co) return co
    }
    let url
    let tuyChon = {}
    if (nguon === 'pexels') {
      url = urlPexels(loai, q, soLuong)
      tuyChon = { tieuDe: { Authorization: khoa.pexels } }
    } else if (nguon === 'pixabay') url = urlPixabay(loai, q, khoa.pixabay, soLuong)
    else if (nguon === 'wikimedia') { url = urlWikimedia(q, soLuong); tuyChon = { tieuDe: { 'User-Agent': USER_AGENT } } }
    else url = urlLoc(q, soLuong)

    const json = await layJSONHam(url, tuyChon)
    let ds
    if (nguon === 'pexels') ds = loai === 'video' ? docPexelsVideo(json) : docPexelsAnh(json)
    else if (nguon === 'pixabay') ds = loai === 'video' ? docPixabayVideo(json) : docPixabayAnh(json)
    else if (nguon === 'wikimedia') ds = docWikimedia(json, { choBySa })
    else ds = docLoc(json)
    if (cache) cache.dat(maCache, ds)
    return ds
  }

  // Dừng sớm khi đã đủ ứng viên tốt — Pexels chỉ cho 200 lượt/giờ, 100 cảnh
  // footage mà gọi đủ 4 nguồn mỗi cảnh là hết hạn mức ngay giữa chừng.
  async function timChoCanh({ tuKhoaTim, kieu = 'video', giayCanh = 9 }, { soUngVien = 6, daDung = new Set() } = {}) {
    const q = catQ(tuKhoaTim)
    const loi = []
    const tatCa = []
    if (!q) return { ungVien: [], loi: ['Không có từ khóa tìm kiếm'] }
    for (const [nguon, loai] of thuTuNguon(kieu, q, bat)) {
      try {
        const ds = await goiNguon(nguon, loai, q, 12)
        ds.forEach((uv, i) => {
          if (daDung.has(uv.id)) return
          const { diem, lyDo } = chamUngVien(uv, { tuKhoa: q, giayCanh, viTri: i })
          // Cảnh cần video mà phải lùi về ảnh thì trừ nhẹ để video luôn đứng trước.
          const lech = kieu === 'video' && uv.loai === 'anh' ? -0.8 : 0
          tatCa.push({ ...uv, diem: Math.round((diem + lech) * 100) / 100, lyDoDiem: lyDo })
        })
      } catch (e) {
        loi.push(`${NGUON[nguon]}: ${moTaLoi(e)}`)
        if (nhatKy) nhatKy.canhBao(`Footage ${NGUON[nguon]} lỗi với "${q}": ${e.message}`)
      }
      const tot = tatCa.filter((x) => x.diem >= 2.5 && (kieu !== 'video' || x.loai === 'video'))
      if (tot.length >= 3) break
    }
    tatCa.sort((a, b) => b.diem - a.diem)
    return { ungVien: tatCa.slice(0, soUngVien), loi }
  }

  return { timChoCanh, goiNguon }
}

function moTaLoi(e) {
  const ma = e && e.maHttp
  if (ma === 401 || ma === 403) return 'khoá API sai hoặc chưa kích hoạt'
  if (ma === 429) return 'vượt giới hạn lượt gọi (Pexels 200/giờ, Pixabay 100/phút) — chờ rồi chạy tiếp'
  if (ma === 400) return 'tham số sai (lỗi của tool)'
  if (ma) return `HTTP ${ma}`
  return (e && e.message) || 'lỗi mạng'
}

// Bộ nhớ đệm 24 giờ — Pixabay BẮT BUỘC, và tiết kiệm hạn mức Pexels khi bấm
// "Tìm lại" nhiều lần.
function taoCache(duLieu = {}, { ttlMs = 24 * 3600 * 1000, toiDa = 800, bayGio = () => Date.now() } = {}) {
  const muc = duLieu.muc || {}
  return {
    lay(k) {
      const m = muc[k]
      if (!m) return null
      if (bayGio() - m.t > ttlMs) { delete muc[k]; return null }
      return m.ds
    },
    dat(k, ds) {
      muc[k] = { t: bayGio(), ds }
      const khoa = Object.keys(muc)
      if (khoa.length > toiDa) {
        khoa.sort((a, b) => muc[a].t - muc[b].t).slice(0, khoa.length - toiDa).forEach((x) => delete muc[x])
      }
    },
    xuat() { return { muc } }
  }
}

module.exports = {
  USER_AGENT,
  NGUON,
  urlPexels,
  urlPixabay,
  urlWikimedia,
  urlLoc,
  chonBanVideo,
  docPexelsVideo,
  docPexelsAnh,
  docPixabayVideo,
  docPixabayAnh,
  docWikimedia,
  docLoc,
  giayPhepChapNhan,
  chamUngVien,
  thuTuNguon,
  taoTimKiem,
  taoCache,
  moTaLoi
}
