// Điều phối một lượt tra cứu từ khóa hot. Mọi thứ đụng mạng / trình duyệt đều
// NHỒI VÀO (layGoiY, trends, docTrangTim, soLieuApi, ngu) → kiểm thử tầng 1
// chạy được cả chuỗi bằng dữ liệu mẫu.

const th = require('./tu-khoa-hot')
const radar = require('./radar-de-xuat')

const CAI_DAT_MAC_DINH = {
  geo: 'US',
  thoiGian: '90-ngay',
  soTuKhoa: 20,
  moRongAZ: true,
  soTuToiThieu: 2,
  tuLoaiTru: 'shorts, tiktok, song, lyrics, remix',
  batBuocChuaLinhVuc: true,
  dungTrends: true,
  dungTrangYouTube: true,
  dungApi: true,
  trongSo: { ...th.TRONG_SO_MAC_DINH }
}

async function chayTuKhoaHot({
  linhVuc,
  caiDat = {},
  layGoiY,              // (chuoi) → Promise<string[] | null>
  trends = null,        // { mo(url), goi(url) → Promise<string> } — null = không dùng Trends
  docTrangTim = null,   // (url) → Promise<{ khoi }> — null = không đọc trang YouTube
  soLieuApi = null,     // (videoIds) → Promise<{ video: [{videoId,kenhId,views}], kenh: Map|obj }>
  ngu = (ms) => new Promise((r) => setTimeout(r, ms)),
  baoTienDo = () => {},
  daHuy = () => false,
  nhatKy = { tin() {}, canhBao() {} }
}) {
  const cd = { ...CAI_DAT_MAC_DINH, ...caiDat, trongSo: { ...CAI_DAT_MAC_DINH.trongSo, ...(caiDat.trongSo || {}) } }
  const hatGiong = th.tachLinhVuc(linhVuc).slice(0, 5)
  if (!hatGiong.length) throw new Error('Nhập lĩnh vực (từ khóa tiếng Anh, cách nhau bằng dấu phẩy).')
  const canhBao = []
  const moc = (phanTram, viec, chiTiet = '') => baoTienDo({ phanTram: Math.round(phanTram), viec, chiTiet, soLoi: canhBao.length })

  // --- 1. Gợi ý YouTube (miễn phí) ---
  const tienTo = hatGiong.flatMap((h) => th.cacTienTo(h, { moRongAZ: cd.moRongAZ }))
  const goiY = []
  for (let i = 0; i < tienTo.length; i++) {
    if (daHuy()) throw new Error('Đã dừng.')
    moc((i / tienTo.length) * 22, 'Lấy gợi ý tìm kiếm YouTube', `"${tienTo[i]}"`)
    const ds = await layGoiY(tienTo[i])
    if (ds) goiY.push({ tienTo: tienTo[i], ds })
    await ngu(120)
  }
  if (!goiY.length) canhBao.push('Không lấy được gợi ý YouTube (mất mạng?) — chỉ còn từ khóa từ Trends.')

  // --- 2. Trends: từ khóa liên quan đang lên (rising / breakout) ---
  let coTrends = !!(cd.dungTrends && trends)
  let loiTrends = ''
  const lienQuan = []
  const goiTrends = async (url) => {
    const chu = await trends.goi(url)
    return th.bocTrends(chu)
  }
  const tatTrends = (e) => {
    coTrends = false
    loiTrends = e.message
    canhBao.push(`Google Trends không dùng được (${e.message}) — điểm Nhu cầu / Xu hướng tính từ gợi ý YouTube và trang tìm kiếm thay thế.`)
    nhatKy.canhBao('Từ khóa hot — Trends: ' + e.message)
  }
  if (coTrends) {
    try {
      moc(24, 'Mở Google Trends (YouTube Search)', hatGiong[0])
      await trends.mo(th.urlTrangTrends(hatGiong[0], cd))
      await ngu(2500)
      for (let i = 0; i < hatGiong.length && coTrends; i++) {
        if (daHuy()) throw new Error('Đã dừng.')
        moc(25 + (i / hatGiong.length) * 18, 'Trends: từ khóa liên quan đang lên', hatGiong[i])
        const ex = th.docExplore(await goiTrends(th.urlExplore([hatGiong[i]], cd)))
        const w = ex.lienQuan[0]
        if (w) {
          await ngu(1500)
          const lq = th.docLienQuan(await goiTrends(th.urlWidget('relatedsearches', w)))
          lienQuan.push({ hatGiong: hatGiong[i], ...lq })
        }
        // relatedsearches rất nhạy với gọi dồn — giãn ≥ 5 giây.
        await ngu(5000 + Math.random() * 1500)
      }
    } catch (e) {
      if (/Đã dừng/.test(e.message)) throw e
      tatTrends(e)
    }
  }

  // --- 3. Gom ứng viên, chọn N từ khóa đi chấm kỹ ---
  const ungVien = th.gomUngVien({ hatGiong, goiY, lienQuan }, {
    soTuToiThieu: Number(cd.soTuToiThieu) || 1,
    tuLoaiTru: String(cd.tuLoaiTru || '').split(/[,;\n]+/),
    batBuocChuaLinhVuc: cd.batBuocChuaLinhVuc !== false
  })
  const theoTu = new Map(ungVien.map((u) => [u.tuKhoa, u]))
  const chon = [...new Set([...hatGiong, ...ungVien.map((u) => u.tuKhoa)])].slice(0, Math.max(hatGiong.length, Number(cd.soTuKhoa) || 20))
  if (!chon.length) throw new Error('Không tìm ra từ khóa ứng viên nào — nới bộ lọc (số từ tối thiểu, từ loại trừ).')

  // --- 4. Trends: mức quan tâm + xu hướng từng từ khóa (so theo lô 5, có mỏ neo) ---
  const trendsTheoTu = {}
  if (coTrends) {
    const cacLo = th.chiaLoTrends(chon, hatGiong[0])
    const ketLo = []
    try {
      for (let i = 0; i < cacLo.length; i++) {
        if (daHuy()) throw new Error('Đã dừng.')
        moc(45 + (i / cacLo.length) * 25, 'Trends: mức quan tâm trên YouTube', `lô ${i + 1}/${cacLo.length}`)
        const ex = th.docExplore(await goiTrends(th.urlExplore(cacLo[i], cd)))
        if (!ex.thoiGian) throw new Error('Trends không trả biểu đồ thời gian')
        await ngu(1200)
        const chuoi = th.docMultiline(await goiTrends(th.urlWidget('multiline', ex.thoiGian)), cacLo[i].length)
        const trungBinh = chuoi.map((c) => (c.length ? c.reduce((s, x) => s + x, 0) / c.length : 0))
        ketLo.push({ tuKhoa: cacLo[i], trungBinh, tbMoNeo: trungBinh[0] })
        cacLo[i].forEach((k, j) => { if (!trendsTheoTu[k] || j > 0) trendsTheoTu[k] = { chuoi: chuoi[j] } })
        await ngu(3500 + Math.random() * 1500)
      }
      const muc = th.quyVeMotThang(ketLo)
      for (const k of Object.keys(trendsTheoTu)) {
        trendsTheoTu[k].mucQuanTam = muc[k] ?? 0
        trendsTheoTu[k].xuHuong = th.diemXuHuongChuoi(trendsTheoTu[k].chuoi)
      }
    } catch (e) {
      if (/Đã dừng/.test(e.message)) throw e
      tatTrends(e)
    }
  }

  // --- 5. Trang tìm kiếm YouTube: video tháng này về từ khóa (miễn phí) ---
  const videoTheoTu = {}
  if (cd.dungTrangYouTube && docTrangTim) {
    for (let i = 0; i < chon.length; i++) {
      if (daHuy()) throw new Error('Đã dừng.')
      moc(70 + (i / chon.length) * 24, 'Đọc trang tìm kiếm YouTube (video tháng này)', chon[i])
      try {
        const kq = await docTrangTim(radar.urlTimKiem(chon[i], { thoiGian: 'thang', sapXep: 'luot-xem' }))
        if (kq && kq.chan) { canhBao.push('YouTube hỏi xác minh — mở màn Trình duyệt xác minh bằng tay rồi chạy lại.'); break }
        const ds = radar.rutVideoTuDuLieu(kq && kq.khoi).filter((v) => !v.thoiLuongGiay || v.thoiLuongGiay > 60).slice(0, 10)
        videoTheoTu[chon[i]] = ds.map((v) => ({ ...v, ngayTuoi: th.docTuoiNgay(v.ngayChu) }))
      } catch (e) {
        canhBao.push(`Không đọc được trang tìm kiếm cho "${chon[i]}": ${e.message}`)
      }
      await ngu(1200 + Math.random() * 1200)
    }
  }

  // --- 6. (Tuỳ chọn) API: sub kênh để biết kênh nhỏ có đang thắng không ---
  let ghiChuApi = ''
  if (cd.dungApi && soLieuApi) {
    const ids = [...new Set(Object.values(videoTheoTu).flat().map((v) => v.videoId))]
    if (ids.length) {
      moc(95, 'Lấy sub kênh (YouTube API)', `${ids.length} video`)
      try {
        const { video, kenh } = await soLieuApi(ids)
        const vTheoId = new Map((video || []).map((v) => [v.videoId, v]))
        const subCua = (id) => {
          const k = kenh instanceof Map ? kenh.get(id) : (kenh || {})[id]
          return k ? Number(k.subKenh) : NaN
        }
        for (const ds of Object.values(videoTheoTu)) {
          for (const v of ds) {
            const a = vTheoId.get(v.videoId)
            if (!a) continue
            if (Number.isFinite(a.views) && a.views > 0) v.viewUoc = a.views
            v.subKenh = subCua(a.kenhId)
          }
        }
        ghiChuApi = `Đã lấy sub kênh bằng API cho ${ids.length} video.`
      } catch (e) {
        ghiChuApi = 'Không lấy được sub kênh: ' + e.message
        canhBao.push(ghiChuApi)
      }
    }
  }

  // --- 7. Chấm điểm ---
  moc(98, 'Chấm điểm')
  const dong = chon.map((k) => {
    const u = theoTu.get(k) || { tuKhoa: k, diemGoiY: 0, nguon: ['lĩnh vực anh nhập'], rising: null, breakout: false }
    const t = trendsTheoTu[k]
    const vids = videoTheoTu[k] || []
    const coHoi = th.diemCoHoi(vids)
    const coVid = vids.length > 0

    // Hạt giống thường KHÔNG tự hiện trong gợi ý của chính nó (gợi ý trả cụm dài
    // hơn) → coi là "không có dữ liệu gợi ý", không phải 0 điểm.
    const coGoiY = (u.soTienTo || 0) > 0
    let nhuCau = null
    if (coTrends && t) nhuCau = Math.round(coGoiY ? 0.6 * t.mucQuanTam + 0.4 * u.diemGoiY : t.mucQuanTam)
    else if (coVid) nhuCau = Math.round(coGoiY ? 0.5 * u.diemGoiY + 0.5 * th.diemView(coHoi.viewTrungVi) : th.diemView(coHoi.viewTrungVi))
    else if (coGoiY) nhuCau = u.diemGoiY

    let xuHuong = null
    let nguonXuHuong = ''
    if (coTrends && t && Number.isFinite(t.xuHuong)) { xuHuong = t.xuHuong; nguonXuHuong = 'Google Trends' }
    if (u.breakout) { xuHuong = Math.max(xuHuong || 0, 95); nguonXuHuong = 'Trends: Breakout' } else if (u.rising) {
      xuHuong = Math.max(xuHuong || 0, Math.min(90, Math.round(55 + 12 * Math.log10(u.rising))))
      nguonXuHuong = nguonXuHuong || 'Trends: đang lên'
    }
    if (xuHuong == null && coVid) {
      // Không có Trends: video đăng ≤ 7 ngày mà đã ăn view trên trung vị tháng.
      // Tối đa ~một nửa top nằm trên trung vị → tỉ lệ 0,5 = 90 (chừa 95–100 cho Breakout thật).
      const moi = vids.filter((v) => v.ngayTuoi != null && v.ngayTuoi <= 7 && v.viewUoc >= coHoi.viewTrungVi).length
      xuHuong = Math.round(Math.min(90, 30 + (moi / vids.length) * 120))
      nguonXuHuong = 'ước từ video mới (không có Trends)'
    }

    const coHoiDiem = coVid ? coHoi.diem : null
    const tong = th.diemTong({ nhuCau, xuHuong, coHoi: coHoiDiem }, cd.trongSo)
    const { nhan, dangTrend } = th.nhanTuKhoa(tong, xuHuong)
    return {
      tuKhoa: k,
      diem: tong,
      nhuCau,
      xuHuong,
      coHoi: coHoiDiem,
      nhan,
      dangTrend,
      nguon: u.nguon,
      nguonXuHuong,
      breakout: !!u.breakout,
      laHatGiong: hatGiong.includes(k),
      chuoi: t ? t.chuoi : [],
      viewTrungVi: coHoi.viewTrungVi,
      soVideoThang: coHoi.soVideo,
      tyLeKenhNhoThang: coHoi.tyLeKenhNhoThang,
      videoTop: vids.slice(0, 3).map((v) => ({ videoId: v.videoId, tieuDe: v.tieuDe, viewUoc: v.viewUoc, ngayChu: v.ngayChu }))
    }
  }).sort((a, b) => b.diem - a.diem)

  moc(100, 'Tra cứu từ khóa xong', `${dong.length} từ khóa`)
  return { dong, hatGiong, coTrends, loiTrends, soUngVien: ungVien.length, soGoiY: goiY.length, canhBao, ghiChuApi }
}

module.exports = { chayTuKhoaHot, CAI_DAT_MAC_DINH }
