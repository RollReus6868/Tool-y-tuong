// Theo dõi một danh sách kênh và phát hiện video "nổ view" so với chính kênh đó.
//
// Vì sao module này rẻ hơn màn Ý tưởng tới 200 lần: quét một kênh chỉ tốn
//   channels.list (1) + playlistItems.list (1) + videos.list (1) = 3 đơn vị
// nên theo dõi 100 kênh mỗi ngày chỉ mất 300 đơn vị trong hạn mức 10.000.
// Trong khi một lượt tìm 5 từ khóa ở màn Ý tưởng tốn ~680 đơn vị.
//
// Tín hiệu dùng ở đây KHÔNG phải view thô mà là "vượt bao nhiêu lần trung vị
// của chính kênh đó". Kênh 10 triệu sub video nào cũng nhiều view — không nói
// lên gì. Còn "kênh này bình thường 40k view, video này 900k" thì mới là
// chuyện đáng học theo.

const { trungVi } = require('./cham-diem')
const { LoiQuota } = require('./youtube-api')
const lichSu = require('./lich-su')

// Gắn cờ cho từng video sau khi đã biết trung vị của kênh. Hàm thuần.
function danhDauVuotTrungVi(cacVideo, trungViKenh, { nguongNoView = 3, nguongTot = 1.8 } = {}) {
  return cacVideo.map((v) => {
    const boi = trungViKenh > 0 ? v.views / trungViKenh : 0
    let nhan = 'BÌNH THƯỜNG'
    if (boi >= nguongNoView) nhan = 'NỔ VIEW'
    else if (boi >= nguongTot) nhan = 'TỐT'
    return {
      ...v,
      trungViKenh,
      vuotTrungVi: Math.round(boi * 100) / 100,
      nhan
    }
  })
}

// Trung vị bỏ chính video đang xét ra ngoài.
//
// Bẫy đã nghĩ tới: nếu kênh chỉ mới đăng vài video và một video nổ cực mạnh,
// chính nó sẽ kéo trung vị lên và tự che mất mình. Với danh sách 20 video thì
// ảnh hưởng nhỏ, nhưng kênh mới (5-6 video) thì thấy rõ.
function trungViBoChinhNo(cacView, viTri) {
  const conLai = cacView.filter((_, i) => i !== viTri)
  return trungVi(conLai.length ? conLai : cacView)
}

function chamTungVideo(cacVideo, tuyChon = {}) {
  const views = cacVideo.map((v) => v.views)
  return cacVideo.map((v, i) => {
    const tv = trungViBoChinhNo(views, i)
    return danhDauVuotTrungVi([v], tv, tuyChon)[0]
  })
}

// Quét một kênh. Trả về { kenh, video, quotaDaDung } hoặc ném LoiQuota.
async function quetMotKenh({
  khach,
  dinhDanh,
  soVideo = 20,
  thuMucDuLieu,
  ghiLichSu = true,
  caiDat = {},
  nhatKy = { tin() {}, loi() {}, canhBao() {} }
}) {
  const kenh = await khach.kenhTheoDinhDanh(dinhDanh)
  if (!kenh) {
    const loi = new Error(`Không tìm được kênh từ "${dinhDanh}". Dán link kênh hoặc @handle.`)
    loi.laKhongThayKenh = true
    throw loi
  }

  const ids = await khach.videoMoiNhat(kenh.playlistTaiLen, soVideo)
  if (!ids.length) return { kenh, video: [], ghiChu: 'Kênh chưa có video nào tải lên.' }

  let video = await khach.soLieuVideo(ids)

  // Bỏ Shorts ngay: kênh này chỉ làm video dài, giữ Shorts lại chỉ làm lệch
  // trung vị (Shorts thường nhiều view hơn hẳn video dài cùng kênh).
  if (caiDat.boShorts !== false) {
    video = video.filter((v) => !(v.thoiLuongGiay > 0 && v.thoiLuongGiay < 61))
  }
  for (const v of video) v.subKenh = kenh.subKenh

  const daCham = chamTungVideo(video, {
    nguongNoView: caiDat.nguongNoView || 3,
    nguongTot: caiDat.nguongTot || 1.8
  })

  // Ghi mốc lịch sử để lần quét sau tính được tăng trưởng thật.
  if (ghiLichSu && thuMucDuLieu) {
    lichSu.ghiMoc(thuMucDuLieu, kenh.kenhId, daCham.map((v) => ({
      videoId: v.videoId, views: v.views, ngayDang: v.ngayDang, tieuDe: v.tieuDe
    })))
  }

  // Gắn tăng trưởng từ lịch sử (nếu đã quét trước đó).
  if (thuMucDuLieu) {
    const tomTat = lichSu.tomTatKenh(thuMucDuLieu, kenh.kenhId)
    for (const v of daCham) {
      const t = tomTat.get(v.videoId)
      v.tangTruong = t && t.tangTruong ? t.tangTruong : null
      v.soMocLichSu = t ? t.soMoc : 0
    }
  }

  daCham.sort((a, b) => b.vuotTrungVi - a.vuotTrungVi)
  return {
    kenh,
    video: daCham,
    soNoView: daCham.filter((v) => v.nhan === 'NỔ VIEW').length
  }
}

// Quét cả danh sách. Một kênh lỗi KHÔNG được làm hỏng cả mẻ — trừ khi là lỗi
// hết quota, vì lúc đó có chạy tiếp cũng chỉ tốn công gọi mạng vô ích.
async function quetDanhSach({
  khach,
  danhSach,
  thuMucDuLieu,
  caiDat = {},
  nhatKy = { tin() {}, loi() {}, canhBao() {} },
  baoTienDo = () => {}
}) {
  const ketQua = []
  const loiKenh = []
  let hetQuota = false

  for (let i = 0; i < danhSach.length; i++) {
    const muc = danhSach[i]
    const ten = muc.ten || muc.dinhDanh
    baoTienDo({
      phanTram: Math.round(((i) / danhSach.length) * 100),
      viec: 'Quét kênh theo dõi',
      chiTiet: `${i + 1}/${danhSach.length} · ${ten}`,
      daXong: i,
      tong: danhSach.length
    })

    try {
      const kq = await quetMotKenh({
        khach,
        dinhDanh: muc.dinhDanh,
        soVideo: caiDat.soVideoMoiKenh || 20,
        thuMucDuLieu,
        caiDat,
        nhatKy
      })
      ketQua.push(kq)
      nhatKy.tin(`Kênh "${kq.kenh.tenKenh}": ${kq.video.length} video, ${kq.soNoView} nổ view`)
    } catch (loi) {
      if (loi instanceof LoiQuota || loi.laLoiQuota) {
        nhatKy.canhBao('Hết quota giữa lúc quét — giữ lại các kênh đã quét xong.')
        hetQuota = true
        break
      }
      loiKenh.push({ dinhDanh: muc.dinhDanh, loi: loi.message })
      nhatKy.loi(`Kênh "${muc.dinhDanh}" lỗi: ${loi.message}`)
    }
  }

  baoTienDo({
    phanTram: 100,
    viec: hetQuota ? 'Dừng vì hết quota' : 'Quét xong',
    chiTiet: `${ketQua.length}/${danhSach.length} kênh`,
    daXong: ketQua.length,
    tong: danhSach.length
  })

  return { ketQua, loiKenh, hetQuota, quotaDaDung: khach.daDungPhien() }
}

// Gộp mọi video nổ view của mọi kênh thành một bảng duy nhất để nhìn nhanh.
function gopNoView(ketQua, { chiNoView = true } = {}) {
  const ra = []
  for (const k of ketQua) {
    for (const v of k.video) {
      if (chiNoView && v.nhan === 'BÌNH THƯỜNG') continue
      ra.push({ ...v, tenKenh: k.kenh.tenKenh, kenhId: k.kenh.kenhId, subKenh: k.kenh.subKenh })
    }
  }
  return ra.sort((a, b) => b.vuotTrungVi - a.vuotTrungVi)
}

module.exports = {
  danhDauVuotTrungVi,
  trungViBoChinhNo,
  chamTungVideo,
  quetMotKenh,
  quetDanhSach,
  gopNoView
}
