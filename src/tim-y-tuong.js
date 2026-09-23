// Điều phối một lượt tìm ý tưởng: 5 từ khóa → video → số liệu kênh → chấm điểm.
//
// Mọi bước đều báo tiến độ ba tầng (tổng / mục hiện tại / dòng log) vì đây là
// việc chạy lâu nhất trong tool và người dùng phải thấy nó đang tới đâu, chứ
// không phải một cái vòng xoay không biết bao giờ xong.

const { taoKhachHang, ngayTuTruoc, LoiQuota } = require('./youtube-api')
const { chamDiem, locVideo } = require('./cham-diem')

async function timYTuong({
  tuKhoa,              // mảng chuỗi, thường là 5
  caiDat,
  khoa,                // { id, ten, khoa }
  boDem,
  layJSONHam,
  nhatKy = { tin() {}, loi() {}, canhBao() {} },
  baoTienDo = () => {}
}) {
  const khach = taoKhachHang({ layJSONHam, boDem, idKhoa: khoa.id, khoa: khoa.khoa, nhatKy })
  const tuNgay = ngayTuTruoc(caiDat.soNgay || 14)
  const tongBuoc = tuKhoa.length + 3
  let buoc = 0

  const tien = (viec, chiTiet) => {
    buoc += 1
    baoTienDo({
      phanTram: Math.min(99, Math.round((buoc / tongBuoc) * 100)),
      viec,
      chiTiet,
      daXong: buoc,
      tong: tongBuoc
    })
  }

  // --- Bước 1..n: tìm id theo từng từ khóa -------------------------------
  const idTheoTuKhoa = new Map()
  const loiTuKhoa = []

  for (const tk of tuKhoa) {
    try {
      const ids = await khach.timId(tk, {
        soLuong: caiDat.soVideoMoiTuKhoa || 25,
        tuNgay,
        regionCode: caiDat.regionCode || 'US',
        relevanceLanguage: caiDat.relevanceLanguage || 'en',
        thoiLuong: caiDat.chiVideoDai ? 'long' : undefined
      })
      idTheoTuKhoa.set(tk, ids)
      nhatKy.tin(`Từ khóa "${tk}": ${ids.length} video`)
      tien(`Tìm: ${tk}`, `${ids.length} video`)
    } catch (loi) {
      if (loi instanceof LoiQuota || loi.laLoiQuota) throw loi
      loiTuKhoa.push({ tuKhoa: tk, loi: loi.message })
      nhatKy.loi(`Từ khóa "${tk}" lỗi: ${loi.message}`)
      tien(`Tìm: ${tk}`, `LỖI: ${loi.message}`)
    }
  }

  const tatCaId = [...new Set([...idTheoTuKhoa.values()].flat())]
  if (!tatCaId.length) {
    // soNoView phải có mặt kể cả khi rỗng: thiếu nó thì giao diện in ra
    // "undefined nổ view" — trông như hỏng nặng trong khi chỉ là không có kết quả.
    return {
      dong: [],
      soNoView: 0,
      loiTuKhoa,
      quotaDaDung: khach.daDungPhien(),
      ghiChu: loiTuKhoa.length
        ? `Không tìm được video nào — cả ${loiTuKhoa.length} từ khóa đều lỗi. Xem màn Nhật ký để biết lý do thật.`
        : 'Không tìm được video nào khớp bộ lọc.'
    }
  }

  // --- Lấy số liệu video (bắt buộc: search.list không có view) -----------
  tien('Lấy số liệu video', `${tatCaId.length} video`)
  let dong = await khach.soLieuVideo(tatCaId)

  // Gắn từ khóa nào tìm ra video này (một video có thể do nhiều từ khóa ra).
  for (const d of dong) {
    d.tuKhoaNguon = tuKhoa.filter((tk) => (idTheoTuKhoa.get(tk) || []).includes(d.videoId))
  }

  // --- Số liệu kênh ------------------------------------------------------
  tien('Lấy số liệu kênh', `${new Set(dong.map((d) => d.kenhId)).size} kênh`)
  const bangKenh = await khach.soLieuKenh(dong.map((d) => d.kenhId))
  for (const d of dong) {
    const k = bangKenh.get(d.kenhId)
    d.subKenh = k ? k.subKenh : 0
    d.quocGia = k ? k.quocGia : ''
    d.anSub = k ? k.anSub : false
  }

  // Lọc TRƯỚC khi tính trung vị kênh: bỏ Shorts và video không đạt tiêu chí
  // ngay tại đây thì khỏi tốn 2 đơn vị quota cho những kênh sẽ bị loại.
  const truocLoc = dong.length
  dong = locVideo(dong, caiDat)
  nhatKy.tin(`Lọc: ${truocLoc} → ${dong.length} video (bỏ Shorts, không phải tiếng Anh, dưới ngưỡng view/thời lượng)`)

  // --- Trung vị kênh: chỉ số đáng tin nhất -------------------------------
  if (caiDat.tinhVuotTrungViKenh) {
    const kenhCanTinh = [...new Set(dong.map((d) => d.kenhId))].filter(Boolean)
    const trungViTheoKenh = new Map()
    for (let i = 0; i < kenhCanTinh.length; i++) {
      const kid = kenhCanTinh[i]
      const k = bangKenh.get(kid)
      baoTienDo({
        phanTram: Math.min(99, Math.round(((tuKhoa.length + 2) / tongBuoc) * 100)),
        viec: 'Tính trung vị view của kênh',
        chiTiet: `${i + 1}/${kenhCanTinh.length} · ${k ? k.tenKenh : kid}`,
        daXong: i + 1,
        tong: kenhCanTinh.length
      })
      try {
        trungViTheoKenh.set(kid, await khach.trungViKenh(k && k.playlistTaiLen))
      } catch (loi) {
        if (loi instanceof LoiQuota || loi.laLoiQuota) {
          // Hết quota giữa lúc tính trung vị: giữ những gì đã có, không bỏ cả mẻ.
          nhatKy.canhBao('Hết quota khi đang tính trung vị kênh — giữ kết quả đã lấy được.')
          break
        }
        trungViTheoKenh.set(kid, 0)
      }
    }
    for (const d of dong) d.trungViKenh = trungViTheoKenh.get(d.kenhId) || 0
  }

  tien('Chấm điểm', `${dong.length} video`)
  const daCham = chamDiem(dong, { caiDat })

  baoTienDo({ phanTram: 100, viec: 'Xong', chiTiet: `${daCham.length} video`, daXong: tongBuoc, tong: tongBuoc })

  return {
    dong: daCham,
    loiTuKhoa,
    quotaDaDung: khach.daDungPhien(),
    soNoView: daCham.filter((d) => d.nhan === 'NỔ VIEW').length
  }
}

module.exports = { timYTuong }
