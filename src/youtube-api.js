// Gọi YouTube Data API v3.
//
// BẪY KINH ĐIỂN: search.list KHÔNG trả về số view. Nó chỉ trả videoId. Muốn có
// view/like/thời lượng thì bắt buộc gọi videos.list theo danh sách id sau đó.
// Ai bỏ bước này sẽ thấy "mọi video 0 view" mà không hiểu vì sao.
//
// Giá quota: search.list = 100 đơn vị MỖI TRANG; videos.list / channels.list /
// playlistItems.list = 1 đơn vị mỗi lần (tối đa 50 id/lần).

const { giayTuISO, trungVi } = require('./cham-diem')

const GOC = 'https://www.googleapis.com/youtube/v3'

class LoiQuota extends Error {
  constructor(thongDiep) {
    super(thongDiep || 'Khoá API đã hết quota hôm nay')
    this.name = 'LoiQuota'
    this.laLoiQuota = true
  }
}

class LoiKhoa extends Error {
  constructor(thongDiep) {
    super(thongDiep || 'Khoá API không hợp lệ hoặc chưa bật YouTube Data API v3')
    this.name = 'LoiKhoa'
    this.laLoiKhoa = true
  }
}

function ghepURL(duongDan, thamSo) {
  const u = new URL(`${GOC}/${duongDan}`)
  for (const [k, v] of Object.entries(thamSo)) {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v))
  }
  return u.toString()
}

function chia(mang, co) {
  const ra = []
  for (let i = 0; i < mang.length; i += co) ra.push(mang.slice(i, i + co))
  return ra
}

// layJSONHam nhồi được từ ngoài để kiểm thử tầng 1 không cần mạng.
function taoKhachHang({ layJSONHam, boDem, idKhoa, khoa, nhatKy = { tin() {}, loi() {} } }) {
  let daDungPhien = 0

  async function goi(duongDan, thamSo, giaQuota) {
    const url = ghepURL(duongDan, { ...thamSo, key: khoa })
    try {
      const ketQua = await layJSONHam(url)
      daDungPhien += giaQuota
      if (boDem) boDem.dung(idKhoa, giaQuota)
      return ketQua
    } catch (loi) {
      // Google trả 403 cho cả hai trường hợp: hết quota và khoá sai. Phải đọc
      // reason trong thân lỗi mới phân biệt được — báo sai thì người dùng đi
      // xin khoá mới trong khi chỉ cần chờ tới 0h giờ Pacific.
      const than = String(loi.than || '')
      if (loi.maHttp === 403 && than.includes('quotaExceeded')) {
        if (boDem) boDem.danhDauHet(idKhoa)
        throw new LoiQuota()
      }
      if (loi.maHttp === 400 || loi.maHttp === 403) {
        nhatKy.loi(`API ${duongDan} trả ${loi.maHttp}: ${than.slice(0, 300)}`)
        throw new LoiKhoa(`API trả lỗi ${loi.maHttp}. Kiểm tra khoá đã bật YouTube Data API v3 chưa.`)
      }
      throw loi
    }
  }

  return {
    daDungPhien: () => daDungPhien,

    // Tìm video theo một từ khóa. Trả về danh sách videoId (chưa có số liệu).
    async timId(tuKhoa, { soLuong = 25, tuNgay, regionCode = 'US', relevanceLanguage = 'en', thoiLuong } = {}) {
      const ids = []
      let trang
      while (ids.length < soLuong) {
        const kq = await goi('search.list', {
          part: 'id',
          q: tuKhoa,
          type: 'video',
          order: 'viewCount',
          maxResults: Math.min(50, soLuong - ids.length),
          publishedAfter: tuNgay,
          regionCode,
          relevanceLanguage,
          videoDuration: thoiLuong, // 'long' = >20 phút, 'medium' = 4-20 phút
          pageToken: trang
        }, 100)

        for (const m of (kq.items || [])) {
          if (m.id && m.id.videoId) ids.push(m.id.videoId)
        }
        trang = kq.nextPageToken
        if (!trang || !(kq.items || []).length) break
      }
      return ids
    },

    // Lấy số liệu cho danh sách id. 50 id = 1 đơn vị quota.
    async soLieuVideo(ids) {
      const ra = []
      for (const lo of chia([...new Set(ids)], 50)) {
        const kq = await goi('videos.list', {
          part: 'snippet,statistics,contentDetails',
          id: lo.join(','),
          maxResults: 50
        }, 1)
        for (const v of (kq.items || [])) {
          ra.push({
            videoId: v.id,
            tieuDe: v.snippet?.title || '',
            kenhId: v.snippet?.channelId || '',
            tenKenh: v.snippet?.channelTitle || '',
            ngayDang: v.snippet?.publishedAt || '',
            views: Number(v.statistics?.viewCount || 0),
            likes: Number(v.statistics?.likeCount || 0),
            binhLuan: Number(v.statistics?.commentCount || 0),
            thoiLuongGiay: giayTuISO(v.contentDetails?.duration || ''),
            lienKet: `https://www.youtube.com/watch?v=${v.id}`
          })
        }
      }
      return ra
    },

    async soLieuKenh(kenhIds) {
      const ra = new Map()
      for (const lo of chia([...new Set(kenhIds.filter(Boolean))], 50)) {
        const kq = await goi('channels.list', {
          part: 'statistics,contentDetails,snippet',
          id: lo.join(','),
          maxResults: 50
        }, 1)
        for (const c of (kq.items || [])) {
          ra.set(c.id, {
            kenhId: c.id,
            tenKenh: c.snippet?.title || '',
            subKenh: Number(c.statistics?.subscriberCount || 0),
            tongVideo: Number(c.statistics?.videoCount || 0),
            playlistTaiLen: c.contentDetails?.relatedPlaylists?.uploads || ''
          })
        }
      }
      return ra
    },

    // Trung vị view của 20 video gần nhất của một kênh. 2 đơn vị quota/kênh.
    // Đây là chỉ số đáng tin nhất để nói "video này nổ so với chính kênh đó".
    async trungViKenh(playlistTaiLen) {
      if (!playlistTaiLen) return 0
      const kq = await goi('playlistItems.list', {
        part: 'contentDetails',
        playlistId: playlistTaiLen,
        maxResults: 20
      }, 1)
      const ids = (kq.items || []).map((m) => m.contentDetails?.videoId).filter(Boolean)
      if (!ids.length) return 0

      const kq2 = await goi('videos.list', {
        part: 'statistics',
        id: ids.join(','),
        maxResults: 50
      }, 1)
      const views = (kq2.items || []).map((v) => Number(v.statistics?.viewCount || 0))
      return trungVi(views)
    }
  }
}

function ngayTuTruoc(soNgay) {
  return new Date(Date.now() - soNgay * 86400000).toISOString()
}

module.exports = { taoKhachHang, ngayTuTruoc, ghepURL, chia, LoiQuota, LoiKhoa }
