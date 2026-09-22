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

// Lấy phụ đề của một video. Trả về { videoId, tieuDe, dinhDang, tho, duongDan }.
async function layPhuDe({
  thuMucDuLieu,
  thuMucTam,
  videoId,
  ngonNgu = 'en',
  duongDanCookie = null,
  baoTienDo = () => {}
}) {
  fs.mkdirSync(thuMucTam, { recursive: true })
  const mau = path.join(thuMucTam, '%(id)s')

  const thamSo = [
    '--skip-download',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs', `${ngonNgu}.*,${ngonNgu}`,
    '--sub-format', 'json3/vtt/best',
    '--no-playlist',
    '--no-warnings',
    '--print', '%(id)s\t%(title)s\t%(duration)s\t%(channel)s',
    '-o', mau,
    `https://www.youtube.com/watch?v=${videoId}`
  ]
  if (duongDanCookie) thamSo.push('--cookies', duongDanCookie)

  baoTienDo({ phanTram: 20, viec: 'Lấy phụ đề', chiTiet: videoId })
  const { raChu } = await chay(thuMucDuLieu, thamSo, {
    baoDong: (d) => baoTienDo({ phanTram: 45, viec: 'Lấy phụ đề', chiTiet: d.trim().slice(0, 110) })
  })

  const [, tieuDe = '', thoiLuong = '', tenKenh = ''] =
    (raChu.split('\n').find((d) => d.includes('\t')) || '').split('\t')

  // yt-dlp đặt tên tệp là <id>.<ngôn ngữ>.<định dạng>, mà phần ngôn ngữ có thể
  // là "en", "en-US", "en-orig"... nên quét thư mục chứ đừng đoán tên.
  const tep = fs.readdirSync(thuMucTam).filter((t) => t.startsWith(videoId + '.'))
  const uuTien = tep.find((t) => t.endsWith('.json3')) || tep.find((t) => t.endsWith('.vtt')) || tep[0]

  if (!uuTien) {
    const loi = new Error('Video này không có phụ đề (kể cả phụ đề tự động).')
    loi.khongCoPhuDe = true
    loi.tieuDe = tieuDe
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
  taiBinary,
  capNhatBinary,
  chay,
  layPhuDe
}
