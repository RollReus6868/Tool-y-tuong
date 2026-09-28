// Viết TỰ ĐỘNG cả kịch bản bằng Claude API: dàn ý → từng phần → gộp.
//
// Dùng lại ĐÚNG các prompt của cách chép/dán (taoPromptDanY, taoPromptPhan kèm
// sổ chống lặp) — chỉ khác là tool tự gửi và tự nhận. Mỗi phần viết xong LƯU
// NGAY vào dự án: mất mạng giữa chừng thì bấm chạy tiếp, không viết lại phần
// đã có (không tốn tiền hai lần).
//
// Nhận hàm `goi(prompt)` nhồi vào → kiểm thử tầng 1 chạy cả chuỗi không cần mạng.

const kichBan = require('./kich-ban')

async function vietTuDong({
  goi,
  skill = '',
  loiThoai = '',
  yeuCau = {},
  danYCo = null,          // chuỗi dàn ý đã có (chạy tiếp) — có thì không xin lại
  cacPhanCo = [],         // các phần đã có — phần nào có rồi thì bỏ qua
  luuDanY = () => {},
  luuPhan = () => {},
  baoTienDo = () => {},
  daHuy = () => false
}) {
  const soPhan = Number(yeuCau.soPhan) || kichBan.YEU_CAU_MAC_DINH.soPhan
  const tongLuot = soPhan + 1
  let tokVao = 0
  let tokRa = 0
  const canhBao = []
  const cong = (kq) => { tokVao += kq.tokVao || 0; tokRa += kq.tokRa || 0 }
  const moc = (luot, viec, chiTiet = '') => baoTienDo({
    phanTram: Math.round((luot / tongLuot) * 100), viec, chiTiet, tokVao, tokRa
  })

  // --- Dàn ý ---
  let danYChu = danYCo && String(danYCo).trim() ? danYCo : ''
  let danY = danYChu ? kichBan.phanTichDanY(danYChu) : []
  if (!danY.length) {
    moc(0, 'Claude đang lập dàn ý', `${soPhan} phần`)
    const kq = await goi(kichBan.taoPromptDanY({ skill, loiThoai, yeuCau }), { maxTokens: 8000 })
    cong(kq)
    danYChu = kq.chu
    danY = kichBan.phanTichDanY(danYChu)
    if (!danY.length) {
      const loi = new Error('Claude trả dàn ý không đúng định dạng "PHẦN 1 | tiêu đề | số từ". Bấm chạy lại.')
      loi.traVe = danYChu.slice(0, 400)
      throw loi
    }
    if (danY.length !== soPhan) canhBao.push(`Dàn ý có ${danY.length} phần (yêu cầu ${soPhan}) — viết theo dàn ý.`)
    luuDanY(danYChu, danY)
  }

  // --- Từng phần ---
  const cacPhan = [...cacPhanCo]
  for (let i = 0; i < danY.length; i++) {
    const phanSo = danY[i].so
    if (cacPhan[phanSo - 1] && String(cacPhan[phanSo - 1]).trim()) continue
    if (daHuy()) return { xong: false, dung: true, danY, cacPhan, tokVao, tokRa, canhBao }
    moc(i + 1, `Claude đang viết phần ${phanSo}/${danY.length}`, danY[i].tieuDe)
    const prompt = kichBan.taoPromptPhan({
      skill, danY, phanSo,
      cacPhanDaViet: cacPhan.slice(0, phanSo - 1),
      loiThoai, yeuCau
    })
    const kq = await goi(prompt, { maxTokens: 16000 })
    cong(kq)
    const chu = kichBan.lamSachVanDoc(kq.chu)
    if (!chu) throw new Error(`Claude trả phần ${phanSo} rỗng` + (kq.lyDoDung === 'refusal' ? ' (từ chối viết — xem lại tư liệu/yêu cầu).' : '.'))
    if (kq.lyDoDung === 'max_tokens') canhBao.push(`Phần ${phanSo} bị cắt ngang vì chạm giới hạn độ dài — nên đọc lại đoạn cuối phần này.`)
    cacPhan[phanSo - 1] = chu
    luuPhan(phanSo, chu)
  }

  moc(tongLuot, 'Gộp kịch bản')
  return { xong: true, danY, cacPhan, kichBan: kichBan.gopKichBan(cacPhan), tokVao, tokRa, canhBao }
}

module.exports = { vietTuDong }
