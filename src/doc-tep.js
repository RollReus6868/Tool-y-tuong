// Đọc tệp người dùng đưa vào: Word (.docx), văn bản thuần, và phụ đề.
//
// Vì sao tự bóc chữ từ .docx thay vì dùng thư viện chuyển đổi nặng: .docx chỉ
// là một tệp ZIP, chữ nằm trong `word/document.xml`. jszip là thuần JavaScript,
// không có module native nào — quan trọng vì module native làm vỡ build
// Windows/macOS trên CI.
//
// BẪY: KHÔNG được "xoá hết thẻ rồi lấy phần còn lại". Word nhét cả mã trường
// (`w:instrText`: số trang, mục lục, ngày tự động) vào cùng tài liệu, bóc kiểu
// đó là dính rác vào giữa kịch bản. Chỉ lấy đúng nội dung các thẻ `<w:t>`.

const fs = require('fs')
const path = require('path')

const DUOI_HO_TRO = ['docx', 'txt', 'md', 'markdown', 'srt', 'vtt', 'rtf']

const BO_LOC_HOP_THOAI = [
  { name: 'Mọi tệp đọc được', extensions: DUOI_HO_TRO },
  { name: 'Word', extensions: ['docx'] },
  { name: 'Văn bản', extensions: ['txt', 'md', 'markdown'] },
  { name: 'Phụ đề', extensions: ['srt', 'vtt'] }
]

// Kích thước trần: tệp kịch bản 12.000 từ chưa tới 200KB. Quá 40MB thì gần như
// chắc chắn là chọn nhầm tệp, hoặc là tệp cố tình phình khi giải nén.
const CO_TOI_DA = 40 * 1024 * 1024

function giaiMaXML(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')   // phải làm SAU cùng, nếu không "&amp;lt;" ra sai
}

// Hàm thuần — kiểm thử gọi thẳng với chuỗi XML mẫu, không cần dựng tệp zip.
function xmlWordSangVanBan(xml) {
  const s = String(xml || '')
  const than = s.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/)
  const noiDung = than ? than[1] : s

  const doan = noiDung.split(/<\/w:p>/)
  const ra = []

  // Quét CHỮ và NGẮT DÒNG trong CÙNG một lượt, theo đúng thứ tự trong tài liệu.
  //
  // Đã làm sai một lần: thay <w:br/> thành "\n" trước, rồi mới gom nội dung các
  // thẻ <w:t>. Cái "\n" vừa chèn nằm NGOÀI thẻ <w:t> nên bị loại luôn ở bước
  // gom — hai dòng dính liền thành "Trướcsau khi xuống dòng". Không exception,
  // chỉ là chữ dính vào nhau giữa kịch bản.
  const MAU = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:br\s*\/?>|<w:cr\s*\/?>|<w:tab\s*\/?>/g

  for (const p of doan) {
    // CHỈ lấy nội dung <w:t>. Mã trường nằm trong <w:instrText> nên không dính.
    const manh = []
    for (const m of p.matchAll(MAU)) {
      if (m[1] !== undefined) manh.push(giaiMaXML(m[1]))
      else if (m[0].startsWith('<w:tab')) manh.push(' ')
      else manh.push('\n')
    }

    const dong = manh.join('').replace(/[ \t]{2,}/g, ' ').trim()
    if (dong) ra.push(dong)
  }
  return ra.join('\n\n')
}

async function docxSangVanBan(duLieu) {
  const JSZip = require('jszip')
  let zip
  try {
    zip = await JSZip.loadAsync(duLieu)
  } catch (_) {
    const loi = new Error('Tệp .docx này không mở được — có thể đã hỏng, hoặc thật ra là .doc đời cũ đổi đuôi.')
    loi.saoDinhDang = true
    throw loi
  }

  const tep = zip.file('word/document.xml')
  if (!tep) {
    const loi = new Error('Không thấy phần nội dung trong tệp Word. Nếu đây là .doc đời cũ, mở bằng Word rồi lưu lại thành .docx.')
    loi.saoDinhDang = true
    throw loi
  }

  const xml = await tep.async('string')
  const vanBan = xmlWordSangVanBan(xml)
  if (!vanBan.trim()) {
    const loi = new Error('Tệp Word mở được nhưng không có chữ nào. Kiểm tra lại đúng tệp chưa.')
    loi.rong = true
    throw loi
  }
  return vanBan
}

// RTF: bóc thô, đủ dùng cho tệp kịch bản xuất từ trình soạn thảo đơn giản.
function rtfSangVanBan(chu) {
  return String(chu || '')
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\line\b/g, '\n')
    .replace(/\{\\\*[\s\S]*?\}/g, ' ')     // nhóm bỏ qua được
    .replace(/\\[a-z]+-?\d*\s?/gi, '')     // lệnh điều khiển
    .replace(/[{}]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Đọc một tệp bất kỳ thành văn bản thuần.
// Trả { vanBan, soTu, ten, duoi, ghiChu }.
async function docTep(duongDan, { phuDeMod = require('./phu-de') } = {}) {
  const ten = path.basename(duongDan)
  const duoi = (path.extname(duongDan).slice(1) || '').toLowerCase()

  let cd
  try {
    cd = fs.statSync(duongDan)
  } catch (_) {
    throw new Error(`Không mở được tệp: ${ten}`)
  }
  if (cd.size > CO_TOI_DA) {
    throw new Error(`Tệp ${ten} nặng ${(cd.size / 1048576).toFixed(0)}MB — quá lớn so với một tệp kịch bản. Kiểm tra lại đúng tệp chưa.`)
  }

  let vanBan = ''
  let ghiChu = ''

  if (duoi === 'docx') {
    vanBan = await docxSangVanBan(fs.readFileSync(duongDan))
    ghiChu = 'Đọc từ Word'
  } else if (duoi === 'rtf') {
    vanBan = rtfSangVanBan(fs.readFileSync(duongDan, 'utf8'))
    ghiChu = 'Đọc từ RTF (bóc thô, nên xem lại vài dòng đầu)'
  } else if (duoi === 'srt' || duoi === 'vtt') {
    // Phụ đề là chuỗi mốc giờ, không phải văn xuôi — phải bóc lấy chữ và bỏ
    // lặp kiểu cuộn, y như khi lấy phụ đề từ YouTube.
    const kq = phuDeMod.chuyenThanhVanBan(fs.readFileSync(duongDan, 'utf8'), { dinhDang: 'vtt' })
    vanBan = kq.vanBan
    ghiChu = `Bóc từ phụ đề · bỏ ${kq.tyLeBoLap}% dòng lặp kiểu cuộn`
  } else if (duoi === 'doc') {
    const loi = new Error('.doc là định dạng Word đời cũ, không đọc được. Mở bằng Word rồi bấm Lưu thành .docx.')
    loi.saoDinhDang = true
    throw loi
  } else {
    vanBan = fs.readFileSync(duongDan, 'utf8')
    ghiChu = 'Đọc văn bản thuần'
  }

  vanBan = String(vanBan).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const soTu = (vanBan.match(/\S+/g) || []).length

  if (!soTu) {
    const loi = new Error(`Tệp ${ten} không có chữ nào đọc được.`)
    loi.rong = true
    throw loi
  }

  return { vanBan, soTu, ten, duoi, ghiChu }
}

module.exports = {
  DUOI_HO_TRO,
  BO_LOC_HOP_THOAI,
  CO_TOI_DA,
  giaiMaXML,
  xmlWordSangVanBan,
  docxSangVanBan,
  rtfSangVanBan,
  docTep
}
