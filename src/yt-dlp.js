// Chạy yt-dlp để lấy phụ đề. Tách riêng khỏi phu-de.js để phần phân tích chuỗi
// vẫn kiểm thử được mà không cần tải binary về.
//
// yt-dlp KHÔNG đóng gói kèm app: nó nặng ~17MB, và quan trọng hơn là YouTube
// đổi giao diện liên tục nên bản cũ sẽ chết. Tool tải về lần đầu và có nút
// "Cập nhật yt-dlp" trong Cài đặt — thiếu nút đó thì tới một ngày tool tự nhiên
// hỏng mà không ai hiểu vì sao.

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const GOC_TAI = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download'

function tenBinary(nenTang = process.platform) {
  if (nenTang === 'win32') return 'yt-dlp.exe'
  if (nenTang === 'darwin') return 'yt-dlp_macos'
  return 'yt-dlp'
}

function urlTaiVe(nenTang = process.platform) {
  return `${GOC_TAI}/${tenBinary(nenTang)}`
}

function duongDanBinary(thuMucDuLieu, nenTang = process.platform) {
  return path.join(thuMucDuLieu, 'cong-cu', tenBinary(nenTang))
}

function daCo(thuMucDuLieu) {
  try {
    return fs.statSync(duongDanBinary(thuMucDuLieu)).size > 100000
  } catch (_) {
    return false
  }
}

// Tách videoId từ đủ kiểu link người dùng dán vào. Hàm thuần.
function tachVideoId(chu) {
  const s = String(chu || '').trim()
  if (!s) return null
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s

  const mau = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/
  ]
  for (const m of mau) {
    const kq = s.match(m)
    if (kq) return kq[1]
  }
  return null
}

function tachNhieuVideoId(chu) {
  return [...new Set(
    String(chu || '')
      .split(/[\s,;]+/)
      .map(tachVideoId)
      .filter(Boolean)
  )]
}

// Cookie của Electron → định dạng Netscape mà yt-dlp đọc được. Hàm thuần.
//
// Dùng khi video bị chặn tuổi hoặc YouTube hỏi "sign in to confirm you're not
// a bot". Tệp này chứa phiên đăng nhập thật nên phải xoá ngay sau khi dùng.
function dinhDangCookieNetscape(cacCookie) {
  const dong = ['# Netscape HTTP Cookie File', '# Tool Ý Tưởng sinh tự động — XOÁ SAU KHI DÙNG']
  for (const c of cacCookie || []) {
    const mien = c.domain || ''
    const conTatCa = mien.startsWith('.') ? 'TRUE' : 'FALSE'
    const bảoMật = c.secure ? 'TRUE' : 'FALSE'
    const hanDung = Math.floor(c.expirationDate || 0)
    dong.push([mien, conTatCa, c.path || '/', bảoMật, hanDung, c.name, c.value].join('\t'))
  }
  return dong.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Tải binary
// ---------------------------------------------------------------------------

async function taiBinary(thuMucDuLieu, { baoTienDo = () => {}, nenTang = process.platform } = {}) {
  const dich = duongDanBinary(thuMucDuLieu, nenTang)
  fs.mkdirSync(path.dirname(dich), { recursive: true })

  baoTienDo({ phanTram: 2, viec: 'Tải yt-dlp', chiTiet: urlTaiVe(nenTang) })
  const traLoi = await fetch(urlTaiVe(nenTang), { redirect: 'follow' })
  if (!traLoi.ok) throw new Error(`Tải yt-dlp thất bại: HTTP ${traLoi.status}`)

  const tong = Number(traLoi.headers.get('content-length')) || 0
  const phan = []
  let daTai = 0

  for await (const khoi of traLoi.body) {
    phan.push(khoi)
    daTai += khoi.length
    if (tong) {
      baoTienDo({
        phanTram: Math.min(99, Math.round((daTai / tong) * 100)),
        viec: 'Tải yt-dlp',
        chiTiet: `${(daTai / 1048576).toFixed(1)}/${(tong / 1048576).toFixed(1)} MB`
      })
    }
  }

  const tam = dich + '.tam'
  fs.writeFileSync(tam, Buffer.concat(phan))
  fs.renameSync(tam, dich)
  if (nenTang !== 'win32') fs.chmodSync(dich, 0o755)

  baoTienDo({ phanTram: 100, viec: 'Tải yt-dlp xong', chiTiet: dich, trangThai: 'xong' })
  return dich
}

// ---------------------------------------------------------------------------
// Chạy yt-dlp
// ---------------------------------------------------------------------------

function chay(thuMucDuLieu, thamSo, { thoiCho = 300000, baoDong = () => {} } = {}) {
  return new Promise((xong, hong) => {
    const binary = duongDanBinary(thuMucDuLieu)
    if (!daCo(thuMucDuLieu)) {
      const loi = new Error('Chưa có yt-dlp. Vào Cài đặt bấm "Tải yt-dlp" (khoảng 17MB).')
      loi.thieuYtDlp = true
      return hong(loi)
    }

    const tienTrinh = spawn(binary, thamSo, { windowsHide: true })
    let raChu = ''
    let loiChu = ''
    let daXong = false

    const hen = setTimeout(() => {
      if (daXong) return
      tienTrinh.kill()
      hong(new Error(`yt-dlp chạy quá ${Math.round(thoiCho / 1000)} giây, đã dừng.`))
    }, thoiCho)

    tienTrinh.stdout.on('data', (d) => {
      const s = d.toString()
      raChu += s
      baoDong(s)
    })
    tienTrinh.stderr.on('data', (d) => {
      const s = d.toString()
      loiChu += s
      baoDong(s)
    })

    tienTrinh.on('error', (loi) => {
      daXong = true
      clearTimeout(hen)
      hong(new Error(`Không chạy được yt-dlp: ${loi.message}`))
    })

    tienTrinh.on('close', (ma) => {
      daXong = true
      clearTimeout(hen)
      if (ma === 0) return xong({ raChu, loiChu })
      hong(new Error(dichLoiYtDlp(loiChu) || `yt-dlp thoát với mã ${ma}`))
    })
  })
}

// Thông báo lỗi của yt-dlp là tiếng Anh và dài dòng. Dịch đúng ba trường hợp
// hay gặp nhất sang câu người dùng hiểu được và biết phải làm gì.
function dichLoiYtDlp(chu) {
  const s = String(chu || '')
  if (/Sign in to confirm|not a bot|cookies/i.test(s)) {
    return 'YouTube đòi đăng nhập để xác minh. Vào màn Trình duyệt đăng nhập một tài khoản, rồi bật "Dùng cookie của tài khoản" ở Cài đặt.'
  }
  if (/Video unavailable|Private video|members-only/i.test(s)) {
    return 'Video này không xem được (riêng tư, bị gỡ, hoặc chỉ dành cho hội viên).'
  }
  // Phải có ranh giới từ. `/age/i` trần khớp luôn vào chữ "webpage", nên mọi
  // lỗi tải trang đều bị dịch nhầm thành "video giới hạn độ tuổi" — người dùng
  // đi tìm cookie trong khi thật ra chỉ cần cập nhật yt-dlp.
  if (/\bage[-\s]?restricted\b|confirm your age|age restriction/i.test(s)) {
    return 'Video bị giới hạn độ tuổi — cần cookie của tài khoản đã đăng nhập.'
  }
  if (/Unable to download|HTTP Error 4\d\d/i.test(s)) {
    return 'Không tải được từ YouTube. Thử bấm "Cập nhật yt-dlp" ở Cài đặt — YouTube đổi giao diện là bản cũ hỏng.'
  }
  const dong = s.split('\n').map((d) => d.trim()).filter((d) => /^ERROR/i.test(d))
  return dong.length ? dong[dong.length - 1] : ''
}

// ---------------------------------------------------------------------------
// Tham số gọi yt-dlp lấy phụ đề — hàm THUẦN, kiểm thử tầng 1 soi nguyên văn.
//
// BẪY ĐÃ TRẢ GIÁ (0.1.0 → 0.5.0, năm bản liền không lấy được phụ đề nào):
// `--print` NGẦM BẬT `--simulate` — "không tải và KHÔNG GHI GÌ XUỐNG ĐĨA".
// Tức là yt-dlp đọc được danh sách phụ đề, in tiêu đề ra, thoát mã 0… nhưng
// không ghi tệp phụ đề nào. Tool quét thư mục thấy trống rồi báo "video không
// có phụ đề" cho MỌI video. `--no-simulate` + `--skip-download` = ghi phụ đề,
// không tải video.
//
// Và KHÔNG dùng `--no-warnings`: lý do thật khi thiếu phụ đề (YouTube đòi PO
// token, thiếu ngôn ngữ, thiếu JavaScript runtime) chỉ nằm trong dòng WARNING.
// Tắt đi là tool chỉ còn đoán — và đoán sai.
// ---------------------------------------------------------------------------

// Lượt thử lại khi lượt đầu không ra tệp: đổi sang các client của YouTube mà
// phụ đề không đòi PO token (theo PO Token Guide của yt-dlp, chỉ client `web`
// đòi PO token cho phụ đề).
const CLIENT_DU_PHONG = 'youtube:player_client=tv,web_safari,mweb,android_vr'

function thamSoPhuDe({ videoId, ngonNgu = 'en', thuMucTam, duongDanCookie = null, clientDuPhong = false }) {
  const thamSo = [
    '--skip-download',
    '--no-simulate',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs', `${ngonNgu}.*,${ngonNgu}`,
    '--sub-format', 'json3/vtt/best',
    '--no-playlist',
    '--print', '%(id)s\t%(title)s\t%(duration)s\t%(channel)s',
    '-o', path.join(thuMucTam, '%(id)s')
  ]
  if (clientDuPhong) thamSo.push('--extractor-args', CLIENT_DU_PHONG)
  if (duongDanCookie) thamSo.push('--cookies', duongDanCookie)
  thamSo.push(`https://www.youtube.com/watch?v=${videoId}`)
  return thamSo
}

// Đọc các dòng WARNING của yt-dlp để nói ĐÚNG lý do không có tệp phụ đề.
// Hàm thuần.
function chanDoanThieuPhuDe(loiChu, { ngonNgu = 'en' } = {}) {
  const s = String(loiChu || '')
  const canhBao = s.split('\n').map((d) => d.trim()).filter((d) => /^(WARNING|ERROR)/i.test(d))
  const coPoToken = /PO Token/i.test(s)
  const thieuJs = /JavaScript runtime|js-runtimes|\bdeno\b/i.test(s)
  const khongCoNgonNgu = /There are no subtitles for the requested languages|no subtitles for the requested/i.test(s)
  const khongCoGi = /(has no subtitles|There are no subtitles)(?! for the requested)/i.test(s)

  let lyDo
  if (coPoToken) {
    lyDo = 'YouTube đòi "PO token" mới cho tải phụ đề (thay đổi phía YouTube, không phải video thiếu phụ đề). ' +
      'Tool đã thử các client khác mà vẫn không được. Thử: Cài đặt → "Cập nhật yt-dlp"; hoặc đăng nhập một tài khoản ở màn Trình duyệt rồi bật "Dùng cookie của tài khoản".'
  } else if (khongCoNgonNgu) {
    lyDo = `Video có phụ đề nhưng KHÔNG có bản tiếng "${ngonNgu}" (kể cả tự động). Kiểm tra ngôn ngữ ở Cài đặt (relevanceLanguage).`
  } else if (khongCoGi) {
    lyDo = 'Video này không có phụ đề nào (kể cả phụ đề tự động).'
  } else {
    lyDo = 'yt-dlp chạy xong nhưng không ghi ra tệp phụ đề nào. Thử Cài đặt → "Cập nhật yt-dlp". Chi tiết ở Nhật ký.'
  }
  if (thieuJs) lyDo += ' (yt-dlp còn báo thiếu JavaScript runtime — ảnh hưởng tải video, thường không ảnh hưởng phụ đề.)'
  return { lyDo, coPoToken, thieuJs, khongCoNgonNgu, khongCoGi, canhBao: canhBao.slice(-6) }
}

function timTepPhuDe(thuMucTam, videoId) {
  // yt-dlp đặt tên tệp là <id>.<ngôn ngữ>.<định dạng>, mà phần ngôn ngữ có thể
  // là "en", "en-US", "en-orig"... nên quét thư mục chứ đừng đoán tên.
  const tep = fs.readdirSync(thuMucTam).filter((t) => t.startsWith(videoId + '.') &&
    /\.(json3|vtt)$/i.test(t) && fs.statSync(path.join(thuMucTam, t)).size > 0)
  // "en-orig" là phụ đề tự động của bản gốc; bản tay ("en", "en-US") đứng trước.
  const diem = (t) => (t.endsWith('.json3') ? 0 : 1) + (/-orig\./.test(t) ? 0.5 : 0)
  return tep.sort((a, b) => diem(a) - diem(b))[0] || null
}

// Lấy phụ đề của một video. Trả về { videoId, tieuDe, dinhDang, tho, duongDan }.
async function layPhuDe({
  thuMucDuLieu,
  thuMucTam,
  videoId,
  ngonNgu = 'en',
  duongDanCookie = null,
  baoTienDo = () => {},
  chayHam = chay
}) {
  fs.mkdirSync(thuMucTam, { recursive: true })

  let tieuDe = ''
  let thoiLuong = ''
  let tenKenh = ''
  let uuTien = null
  let loiGop = ''

  // Lượt 1: client mặc định. Lượt 2 (chỉ khi lượt 1 không ra tệp): client dự phòng.
  for (const clientDuPhong of [false, true]) {
    baoTienDo({ phanTram: clientDuPhong ? 60 : 20, viec: 'Lấy phụ đề', chiTiet: videoId + (clientDuPhong ? ' · thử client dự phòng' : '') })
    const { raChu, loiChu } = await chayHam(thuMucDuLieu,
      thamSoPhuDe({ videoId, ngonNgu, thuMucTam, duongDanCookie, clientDuPhong }), {
        baoDong: (d) => baoTienDo({ phanTram: clientDuPhong ? 75 : 45, viec: 'Lấy phụ đề', chiTiet: d.trim().slice(0, 110) })
      })
    loiGop += (loiChu || '') + '\n'
    const dong = (raChu.split('\n').find((d) => d.includes('\t')) || '').split('\t')
    if (dong.length >= 2) [, tieuDe = '', thoiLuong = '', tenKenh = ''] = dong
    uuTien = timTepPhuDe(thuMucTam, videoId)
    if (uuTien) break
    // Video thật sự không có phụ đề thì đổi client cũng vô ích — khỏi chờ thêm.
    const cd = chanDoanThieuPhuDe(loiChu, { ngonNgu })
    if (cd.khongCoGi || cd.khongCoNgonNgu) break
  }

  if (!uuTien) {
    const cd = chanDoanThieuPhuDe(loiGop, { ngonNgu })
    const loi = new Error(cd.lyDo)
    loi.khongCoPhuDe = true
    loi.tieuDe = tieuDe
    loi.canhBaoYtDlp = cd.canhBao
    throw loi
  }

  const duongDan = path.join(thuMucTam, uuTien)
  return {
    videoId,
    tieuDe,
    tenKenh,
    thoiLuongGiay: Number(thoiLuong) || 0,
    dinhDang: uuTien.endsWith('.json3') ? 'json3' : 'vtt',
    tho: fs.readFileSync(duongDan, 'utf8'),
    duongDan
  }
}

async function capNhatBinary(thuMucDuLieu, tuyChon) {
  // yt-dlp tự cập nhật được bằng -U, nhưng bản tải từ Releases về nhiều khi
  // không có quyền ghi đè chính nó trên Windows. Tải đè hẳn bản mới cho chắc.
  return taiBinary(thuMucDuLieu, tuyChon)
}

module.exports = {
  tenBinary,
  urlTaiVe,
  duongDanBinary,
  daCo,
  tachVideoId,
  tachNhieuVideoId,
  dinhDangCookieNetscape,
  dichLoiYtDlp,
  thamSoPhuDe,
  chanDoanThieuPhuDe,
  timTepPhuDe,
  CLIENT_DU_PHONG,
  taiBinary,
  capNhatBinary,
  chay,
  layPhuDe
}
