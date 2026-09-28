// Xuất văn bản (lời thoại, kịch bản) ra .docx / .txt / .md.
//
// .docx dựng TAY bằng JSZip (đã có sẵn, JavaScript thuần) — không kéo thêm thư
// viện, không module native. Một tệp Word tối thiểu chỉ cần 3 phần:
// [Content_Types].xml, _rels/.rels và word/document.xml.
//
// Hàm thuần + một hàm ghi tệp; kiểm thử tầng 1 giải nén lại để soi.

const fs = require('fs')
const path = require('path')
const JSZip = require('jszip')

function thoatXml(s) {
  return String(s)
    // Ký tự điều khiển (trừ tab) làm Word báo "tệp bị hỏng" — phụ đề YouTube
    // thỉnh thoảng lẫn vài ký tự như vậy.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Một dòng văn bản → một đoạn Word. Dòng bắt đầu bằng "#" thành tiêu đề đậm,
// dòng trống thành đoạn trống, "---" thành đoạn trống (ngăn cách).
function doanWord(dong) {
  const tieuDe = dong.match(/^(#{1,3})\s+(.*)$/)
  if (tieuDe) {
    const co = { 1: 36, 2: 30, 3: 26 }[tieuDe[1].length]
    return `<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${co}"/></w:rPr>` +
      `<w:t xml:space="preserve">${thoatXml(tieuDe[2])}</w:t></w:r></w:p>`
  }
  if (!dong.trim() || /^-{3,}\s*$/.test(dong)) return '<w:p/>'
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:t xml:space="preserve">${thoatXml(dong)}</w:t></w:r></w:p>`
}

function documentXml(chu, { tieuDe = '' } = {}) {
  const dong = String(chu || '').replace(/\r\n?/g, '\n').split('\n')
  const than = []
  if (tieuDe) than.push(doanWord('# ' + tieuDe))
  for (const d of dong) than.push(doanWord(d))
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' + than.join('') +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>'
}

const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>'

const RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>'

async function taoDocx(chu, tuyChon = {}) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', RELS)
  zip.file('word/document.xml', documentXml(chu, tuyChon))
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

// Ghi theo ĐUÔI TỆP người dùng chọn trong hộp thoại Lưu.
async function ghiVanBan(duongDan, chu, { tieuDe = '' } = {}) {
  const duoi = path.extname(duongDan).toLowerCase()
  if (duoi === '.docx') {
    fs.writeFileSync(duongDan, await taoDocx(chu, { tieuDe }))
  } else {
    // .txt có BOM để Notepad cũ trên Windows không hiện sai dấu tiếng Việt.
    const dau = duoi === '.txt' ? '﻿' : ''
    const than = tieuDe && duoi === '.md' ? `# ${tieuDe}\n\n${chu}` : (tieuDe && duoi === '.txt' ? `${tieuDe}\n\n${chu}` : chu)
    fs.writeFileSync(duongDan, dau + String(than || ''), 'utf8')
  }
  return duongDan
}

// Tên tệp an toàn trên Windows.
function tenTepAnToan(ten, macDinh = 'noi-dung') {
  const s = String(ten || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 90)
  return s || macDinh
}

module.exports = { thoatXml, documentXml, taoDocx, ghiVanBan, tenTepAnToan }
