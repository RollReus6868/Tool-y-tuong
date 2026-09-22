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

// LỖI ĐÃ LÀM HỎNG CẢ MÀN Ý TƯỞNG Ở BẢN 0.1–0.3:
//
// Trong tài liệu của Google, các lời gọi được đặt tên theo kiểu `resource.method`
// — "search.list", "videos.list". Đó là TÊN PHƯƠNG THỨC, dùng để tra bảng giá
// quota. ĐƯỜNG DẪN HTTP thì chỉ có tên tài nguyên: `/youtube/v3/search`.
//
// Ghép thẳng tên phương thức vào URL ra `/youtube/v3/search.list` → Google trả
// 404 cho MỌI lời gọi. Triệu chứng nhìn từ ngoài: tìm gì cũng ra 0 video.
//
// Vì sao kiểm thử tầng 1 không bắt được: ca kiểm thử nhồi hàm mạng giả rồi chỉ
// soi các THAM SỐ trong URL (q, type, publishedAfter, key) — tức là kiểm đúng
// cái mình đã nghĩ, mà chỗ sai lại nằm ở phần đường dẫn không ai soi. Nay có ca
// kiểm thử khẳng định nguyên văn đường dẫn.
function duongDanThat(tenPhuongThuc) {
  return String(tenPhuongThuc).replace(/\.list$/, '')
}

function ghepURL(duongDan, thamSo) {
  const u = new URL(`${GOC}/${duongDanThat(duongDan)}`)
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

// Người dùng sẽ dán đủ kiểu: link đầy đủ, @handle, hoặc chính kenhId. Hàm
// thuần này quy về một mối — kiểm thử tầng 1 gọi thẳng được.
//
// Lưu ý: KHÔNG được dùng search.list để tra kênh theo tên (100 đơn vị quota
// mỗi lần). channels.list với forHandle chỉ tốn 1 đơn vị.
function tachDinhDanhKenh(chu) {
  const s = String(chu || '').trim()
  if (!s) return null

  // Chính kenhId: luôn bắt đầu bằng UC và dài 24 ký tự.
  if (/^UC[A-Za-z0-9_-]{22}$/.test(s)) return { loai: 'id', giaTri: s }

  // @handle gõ trực tiếp.
  if (/^@[A-Za-z0-9._-]+$/.test(s)) return { loai: 'handle', giaTri: s }

  // Các dạng link.
  const m = s.match(/youtube\.com\/(channel\/(UC[A-Za-z0-9_-]{22})|(@[A-Za-z0-9._-]+)|(?:c|user)\/([A-Za-z0-9._-]+))/i)
  if (m) {
    if (m[2]) return { loai: 'id', giaTri: m[2] }
    if (m[3]) return { loai: 'handle', giaTri: m[3] }
    if (m[4]) return { loai: 'tenCu', giaTri: m[4] }
  }

  // Còn lại: coi như handle thiếu dấu @.
  if (/^[A-Za-z0-9._-]+$/.test(s)) return { loai: 'handle', giaTri: '@' + s }
  return null
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
      // 404 KHÔNG BAO GIỜ là lỗi của khoá API. Nó nghĩa là đường dẫn sai —
      // tức là lỗi của tool. Nói thẳng ra, đừng để người dùng đi xin khoá mới
      // hay ngồi chờ reset quota vô ích.
      if (loi.maHttp === 404) {
        nhatKy.loi(`API ${duongDan} trả 404 — đường dẫn ${GOC}/${duongDanThat(duongDan)} không tồn tại.`)
        throw new Error(
          `Lỗi của tool, không phải lỗi khoá API: gọi sai địa chỉ YouTube API (404 ở "${duongDanThat(duongDan)}"). ` +
          'Khoá của anh vẫn nguyên, quota không bị trừ. Báo lại cho người làm tool kèm màn Nhật ký.')
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

    // Tìm một kênh từ thứ người dùng dán vào: link, @handle, hay chính kenhId.
    // 1 đơn vị quota — KHÔNG dùng search.list (100 đơn vị) cho việc này.
    async kenhTheoDinhDanh(dinhDanh) {
      const d = tachDinhDanhKenh(dinhDanh)
      if (!d) return null
      const thamSo = { part: 'snippet,statistics,contentDetails', maxResults: 1 }
      if (d.loai === 'id') thamSo.id = d.giaTri
      else if (d.loai === 'handle') thamSo.forHandle = d.giaTri
      else thamSo.forUsername = d.giaTri

      const kq = await goi('channels.list', thamSo, 1)
      const c = (kq.items || [])[0]
      if (!c) return null
      return {
        kenhId: c.id,
        tenKenh: c.snippet?.title || '',
        moTa: (c.snippet?.description || '').slice(0, 300),
        anh: c.snippet?.thumbnails?.default?.url || '',
        subKenh: Number(c.statistics?.subscriberCount || 0),
        tongVideo: Number(c.statistics?.videoCount || 0),
        tongView: Number(c.statistics?.viewCount || 0),
        playlistTaiLen: c.contentDetails?.relatedPlaylists?.uploads || ''
      }
    },

    // Danh sách videoId mới nhất của một kênh. 1 đơn vị quota.
    async videoMoiNhat(playlistTaiLen, soLuong = 20) {
      if (!playlistTaiLen) return []
      const kq = await goi('playlistItems.list', {
        part: 'contentDetails',
        playlistId: playlistTaiLen,
        maxResults: Math.min(50, soLuong)
      }, 1)
      return (kq.items || []).map((m) => m.contentDetails?.videoId).filter(Boolean)
    },

    // Bảng xếp hạng thịnh hành theo quốc gia. 1 đơn vị quota — rẻ hơn
    // search.list đúng 100 lần.
    async videoThinhHanh({ regionCode = 'US', soLuong = 50, danhMuc } = {}) {
      const kq = await goi('videos.list', {
        part: 'snippet,statistics,contentDetails',
        chart: 'mostPopular',
        regionCode,
        videoCategoryId: danhMuc,
        maxResults: Math.min(50, soLuong)
      }, 1)
      return (kq.items || []).map((v) => ({
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
      }))
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

module.exports = {
  taoKhachHang,
  ngayTuTruoc,
  ghepURL,
  duongDanThat,
  chia,
  tachDinhDanhKenh,
  LoiQuota,
  LoiKhoa
}
