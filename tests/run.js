// KIỂM THỬ TẦNG 1 — logic thuần, KHÔNG cần mạng, KHÔNG cần Electron.
// Chạy: node tests/run.js
//
// Tầng này tồn tại để bắt đúng loại lỗi im lặng nhất: sai tên trường, sai công
// thức, sai đơn vị. Những lỗi đó không ném exception — chỉ ra số sai.

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const tuKhoa = require('../src/tu-khoa')
const goiMang = require('../src/goi-mang')
const chamDiem = require('../src/cham-diem')
const quotaMod = require('../src/quota')
const ytApi = require('../src/youtube-api')
const { timYTuong } = require('../src/tim-y-tuong')
const { xuatExcel } = require('../src/xuat-excel')
const { taoKho } = require('../src/store')
const phuDe = require('../src/phu-de')
const lichSu = require('../src/lich-su')
const kenhTheoDoi = require('../src/kenh-theo-doi')
const ytDlp = require('../src/yt-dlp')
const kichBanMod = require('../src/kich-ban')
const kiemDuyet = require('../src/kiem-duyet')
const promptAnh = require('../src/prompt-anh')
const duAnMod = require('../src/du-an')
const trinhDuyet = require('../src/trinh-duyet')
const boLuatChinhSach = require('../src/bo-luat-chinh-sach.json')

let soQua = 0
const soTruot = []

async function kiem(ten, ham) {
  try {
    await ham()
    soQua++
    console.log(`  ✓ ${ten}`)
  } catch (loi) {
    soTruot.push({ ten, loi })
    console.log(`  ✗ ${ten}\n      ${loi.message}`)
  }
}

function nhom(ten) { console.log(`\n${ten}`) }

function thuMucTam(ten) {
  const d = path.join(os.tmpdir(), `ty-test-${ten}-${Date.now()}`)
  fs.mkdirSync(d, { recursive: true })
  return d
}

// ===========================================================================
async function chay() {

  nhom('1. Tách và ghép từ khóa')

  await kiem('tách được bằng dấu phẩy, xuống dòng, chấm phẩy và bỏ trùng', () => {
    const hg = tuKhoa.tachHatGiong('bible stories, Trump\nblack america; bible stories')
    assert.deepStrictEqual(hg, ['bible stories', 'trump', 'black america'])
  })

  await kiem('3 hạt giống sinh 3 đơn + 3 cặp + 1 tam = 7 ứng viên', () => {
    const uv = tuKhoa.sinhUngVien(['a', 'b', 'c'])
    assert.strictEqual(uv.filter((u) => u.loai === 'don').length, 3)
    assert.strictEqual(uv.filter((u) => u.loai === 'cap').length, 3)
    assert.strictEqual(uv.filter((u) => u.loai === 'tam').length, 1)
    assert.strictEqual(uv.length, 7)
  })

  await kiem('trên 6 hạt giống thì KHÔNG sinh tam (tránh bùng nổ ứng viên)', () => {
    const uv = tuKhoa.sinhUngVien(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    assert.strictEqual(uv.filter((u) => u.loai === 'tam').length, 0)
  })

  nhom('2. Chấm điểm ứng viên bằng gợi ý autocomplete')

  await kiem('không gọi được mạng (null) khác hẳn với YouTube không gợi ý ([])', () => {
    const uv = { cum: 'trump bible', tuGoc: ['trump', 'bible'], loai: 'cap' }
    const mu = tuKhoa.chamDiemUngVien(uv, null)
    const khongAiTim = tuKhoa.chamDiemUngVien(uv, [])
    assert.ok(mu.diem > khongAiTim.diem, 'chấm mù phải không bị trừ như cụm không ai tìm')
    assert.ok(khongAiTim.viSao.join(' ').includes('không gợi ý'))
    assert.ok(mu.viSao.join(' ').includes('chưa chấm được'))
  })

  await kiem('có gợi ý bắt đầu đúng bằng cụm thì được cộng thêm', () => {
    const uv = { cum: 'bible stories', tuGoc: ['bible stories'], loai: 'don' }
    const khop = tuKhoa.chamDiemUngVien(uv, ['bible stories for kids', 'bible stories animated'])
    const khongKhop = tuKhoa.chamDiemUngVien(uv, ['old testament summary', 'genesis explained'])
    assert.ok(khop.diem > khongKhop.diem)
  })

  await kiem('từ khóa đã tìm trong 24h bị trừ điểm (khỏi tốn quota tìm lại)', () => {
    const uv = { cum: 'trump news', tuGoc: ['trump'], loai: 'don' }
    const bayGio = Date.now()
    const vuaTim = tuKhoa.chamDiemUngVien(uv, ['trump news today'], { lichSu: { 'trump news': bayGio - 3600e3 }, bayGio })
    const lauRoi = tuKhoa.chamDiemUngVien(uv, ['trump news today'], { lichSu: { 'trump news': bayGio - 50 * 3600e3 }, bayGio })
    assert.ok(vuaTim.diem < lauRoi.diem)
    assert.ok(vuaTim.viSao.join(' ').includes('24h'))
  })

  nhom('3. Chọn 5 từ khóa — luật đa dạng')

  await kiem('không chọn hai cụm trùng cả 2 hạt giống (kết quả gần y nhau, tốn 100 đơn vị vô ích)', () => {
    const ds = [
      { cum: 'trump bible', tuGoc: ['trump', 'bible'], diem: 5 },
      { cum: 'bible trump', tuGoc: ['bible', 'trump'], diem: 4.9 },
      { cum: 'black america history', tuGoc: ['black america'], diem: 4 },
      { cum: 'hidden history', tuGoc: ['hidden history'], diem: 3 }
    ]
    const chon = tuKhoa.chonNamTuKhoa(ds, 3)
    const cum = chon.map((c) => c.cum)
    assert.ok(!(cum.includes('trump bible') && cum.includes('bible trump')), 'hai cụm trùng hạt giống cùng được chọn')
    assert.strictEqual(chon.length, 3)
  })

  await kiem('thiếu chỉ tiêu thì nới luật đa dạng ra, không trả về thiếu từ khóa', () => {
    const ds = [
      { cum: 'a b', tuGoc: ['a', 'b'], diem: 5 },
      { cum: 'b a', tuGoc: ['b', 'a'], diem: 4 },
      { cum: 'a b c', tuGoc: ['a', 'b', 'c'], diem: 3 }
    ]
    assert.strictEqual(tuKhoa.chonNamTuKhoa(ds, 3).length, 3)
  })

  await kiem('ghepTuKhoa chạy trọn ba bước với hàm gợi ý giả', async () => {
    const goiYGia = async (cum) => {
      if (cum === 'bible stories') return ['bible stories for adults', 'bible stories explained']
      if (cum === 'trump') return ['trump latest']
      return []
    }
    const kq = await tuKhoa.ghepTuKhoa('bible stories, trump, black america', { layGoiYHam: goiYGia, soLuong: 5 })
    assert.strictEqual(kq.hatGiong.length, 3)
    assert.strictEqual(kq.chon.length, 5)
    assert.ok(kq.coMang, 'phải nhận ra là gọi được mạng')
    // Gợi ý long-tail phải được đưa vào làm ứng viên.
    assert.ok(kq.tatCa.some((u) => u.cum === 'bible stories for adults'), 'thiếu ứng viên từ gợi ý long-tail')
  })

  await kiem('mất mạng hoàn toàn vẫn trả về 5 từ khóa và cờ coMang = false', async () => {
    const kq = await tuKhoa.ghepTuKhoa('a, b, c', { layGoiYHam: async () => null, soLuong: 5 })
    assert.strictEqual(kq.coMang, false)
    assert.strictEqual(kq.chon.length, 5)
  })

  nhom('4. Bóc kết quả autocomplete')

  await kiem('đọc được JSON thuần của client=firefox', () => {
    const ra = goiMang.phanTichGoiY('["bible",["bible stories","bible verses"]]')
    assert.deepStrictEqual(ra, ['bible stories', 'bible verses'])
  })

  await kiem('dự phòng bóc được JSONP nếu Google đổi sang client=youtube', () => {
    const ra = goiMang.phanTichGoiY('window.google.ac.h(["bible",[["bible stories",0],["bible art",0]]])')
    assert.deepStrictEqual(ra, ['bible stories', 'bible art'])
  })

  await kiem('rác thì trả mảng rỗng, không ném lỗi làm sập app', () => {
    assert.deepStrictEqual(goiMang.phanTichGoiY('<html>404</html>'), [])
    assert.deepStrictEqual(goiMang.phanTichGoiY(''), [])
    assert.deepStrictEqual(goiMang.phanTichGoiY(null), [])
  })

  await kiem('url gợi ý dùng client=firefox và ds=yt', () => {
    const u = goiMang.urlGoiY('trump bible')
    assert.ok(u.includes('client=firefox'), 'phải là client=firefox (JSON thuần)')
    assert.ok(u.includes('ds=yt'), 'thiếu ds=yt thì ra gợi ý của Google Search, không phải YouTube')
    assert.ok(u.includes('trump%20bible'))
  })

  nhom('5. Đọc thời lượng ISO-8601 của YouTube')

  await kiem('PT1H2M3S = 3723 giây', () => assert.strictEqual(chamDiem.giayTuISO('PT1H2M3S'), 3723))
  await kiem('PT45S = 45 giây (Shorts)', () => assert.strictEqual(chamDiem.giayTuISO('PT45S'), 45))
  await kiem('PT23M = 1380 giây', () => assert.strictEqual(chamDiem.giayTuISO('PT23M'), 1380))
  await kiem('P1DT2H = 93600 giây (livestream dài)', () => assert.strictEqual(chamDiem.giayTuISO('P1DT2H'), 93600))
  await kiem('chuỗi rác trả 0 chứ không NaN', () => {
    assert.strictEqual(chamDiem.giayTuISO('xyz'), 0)
    assert.strictEqual(chamDiem.giayTuISO(undefined), 0)
  })

  nhom('6. Thống kê')

  await kiem('trung vị số lẻ và số chẵn phần tử', () => {
    assert.strictEqual(chamDiem.trungVi([1, 3, 100]), 3)
    assert.strictEqual(chamDiem.trungVi([1, 3, 5, 100]), 4)
    assert.strictEqual(chamDiem.trungVi([]), 0)
  })

  await kiem('z-score của dãy giống nhau là 0, không chia cho 0 ra NaN', () => {
    const z = chamDiem.zScore([5, 5, 5])
    assert.deepStrictEqual(z, [0, 0, 0])
  })

  await kiem('view/giờ: video mới ít view có thể mạnh hơn video cũ nhiều view', () => {
    const bayGio = Date.parse('2026-09-22T00:00:00Z')
    const moi = chamDiem.viewMoiGio(100000, '2026-09-20T00:00:00Z', bayGio)  // 2 ngày
    const cu = chamDiem.viewMoiGio(300000, '2026-09-09T00:00:00Z', bayGio)   // 13 ngày
    assert.ok(moi > cu, 'chuẩn hoá theo tuổi video sai')
  })

  await kiem('video vừa đăng không làm chia cho ~0 ra Infinity', () => {
    const v = chamDiem.viewMoiGio(500, new Date().toISOString())
    assert.ok(Number.isFinite(v) && v <= 500)
  })

  nhom('7. Chấm điểm nổ view')

  await kiem('vượt trung vị kênh từ 3 lần là NỔ VIEW, bất kể điểm tổng hợp', () => {
    const bayGio = Date.parse('2026-09-22T00:00:00Z')
    const ra = chamDiem.chamDiem([
      { videoId: 'a', views: 900000, ngayDang: '2026-09-20T00:00:00Z', subKenh: 500000, trungViKenh: 40000, thoiLuongGiay: 1800 },
      { videoId: 'b', views: 50000, ngayDang: '2026-09-20T00:00:00Z', subKenh: 500000, trungViKenh: 45000, thoiLuongGiay: 1800 }
    ], { bayGio })
    const a = ra.find((r) => r.videoId === 'a')
    assert.strictEqual(a.nhan, 'NỔ VIEW')
    assert.ok(a.vuotTrungVi >= 3)
    assert.notStrictEqual(ra.find((r) => r.videoId === 'b').nhan, 'NỔ VIEW')
  })

  await kiem('kết quả sắp xếp giảm dần theo điểm', () => {
    const ra = chamDiem.chamDiem([
      { videoId: 'x', views: 1000, ngayDang: '2026-09-01T00:00:00Z', subKenh: 1e6, trungViKenh: 900000 },
      { videoId: 'y', views: 800000, ngayDang: '2026-09-21T00:00:00Z', subKenh: 10000, trungViKenh: 9000 }
    ])
    assert.strictEqual(ra[0].videoId, 'y')
  })

  await kiem('thiếu trungViKenh (không bật tuỳ chọn) vẫn chấm được, không NaN', () => {
    const ra = chamDiem.chamDiem([
      { videoId: 'a', views: 5000, ngayDang: '2026-09-20T00:00:00Z', subKenh: 1000 },
      { videoId: 'b', views: 9000, ngayDang: '2026-09-20T00:00:00Z', subKenh: 1000 }
    ])
    assert.ok(ra.every((r) => Number.isFinite(r.diem)))
  })

  nhom('8. Lọc video — kênh này KHÔNG làm Shorts')

  await kiem('bỏ mọi video dưới 61 giây', () => {
    const ra = chamDiem.locVideo([
      { videoId: 's', thoiLuongGiay: 45, views: 1e6 },
      { videoId: 'd', thoiLuongGiay: 1800, views: 1e6 }
    ], { boShorts: true, viewToiThieu: 0 })
    assert.deepStrictEqual(ra.map((r) => r.videoId), ['d'])
  })

  await kiem('preset "chỉ video ≥ 20 phút" loại video 8 phút', () => {
    const ds = [
      { videoId: 'ngan', thoiLuongGiay: 8 * 60, views: 1e6 },
      { videoId: 'dai', thoiLuongGiay: 42 * 60, views: 1e6 }
    ]
    assert.deepStrictEqual(chamDiem.locVideo(ds, { chiVideoDai: true }).map((r) => r.videoId), ['dai'])
    assert.strictEqual(chamDiem.locVideo(ds, { chiVideoDai: false }).length, 2)
  })

  await kiem('loại kênh quá lớn khi đặt ngưỡng triệu sub', () => {
    const ra = chamDiem.locVideo([
      { videoId: 'to', thoiLuongGiay: 1800, views: 1e6, subKenh: 12e6 },
      { videoId: 'vua', thoiLuongGiay: 1800, views: 1e6, subKenh: 300000 }
    ], { subToiDaTrieu: 5 })
    assert.deepStrictEqual(ra.map((r) => r.videoId), ['vua'])
  })

  nhom('9. Quota')

  await kiem('giá quota đúng con số của Google: search=100, còn lại=1', () => {
    assert.strictEqual(quotaMod.GIA['search.list'], 100)
    assert.strictEqual(quotaMod.GIA['videos.list'], 1)
    assert.strictEqual(quotaMod.GIA['channels.list'], 1)
    assert.strictEqual(quotaMod.GIA['playlistItems.list'], 1)
  })

  await kiem('ngày quota tính theo giờ Pacific, KHÔNG theo giờ Việt Nam', () => {
    // 7h sáng 22/09 giờ Việt Nam = 17h ngày 21/09 giờ Pacific.
    const luc = new Date('2026-09-22T00:00:00Z') // 7h VN
    assert.strictEqual(quotaMod.ngayPacific(luc), '2026-09-21')
  })

  await kiem('ước chi phí 5 từ khóa × 25 video ≈ 500-600 đơn vị', () => {
    const c = quotaMod.uocChiPhi({ soTuKhoa: 5, soVideoMoiTuKhoa: 25, tinhVuotTrungViKenh: false })
    assert.ok(c >= 500 && c < 620, 'ra ' + c)
  })

  await kiem('bật tính trung vị kênh thì chi phí tăng rõ rệt (2 đơn vị/kênh)', () => {
    const khong = quotaMod.uocChiPhi({ soTuKhoa: 5, soVideoMoiTuKhoa: 25, tinhVuotTrungViKenh: false })
    const co = quotaMod.uocChiPhi({ soTuKhoa: 5, soVideoMoiTuKhoa: 25, tinhVuotTrungViKenh: true })
    assert.ok(co > khong + 100, `${co} vs ${khong}`)
  })

  await kiem('bộ đếm trừ đúng, đánh dấu hết quota và chọn khoá còn nhiều nhất', () => {
    const d = thuMucTam('quota')
    const bd = quotaMod.taoBoDem(d)
    assert.strictEqual(bd.conLai('k1'), 10000)
    bd.dung('k1', 507)
    assert.strictEqual(bd.daDung('k1'), 507)
    assert.strictEqual(bd.conLai('k1'), 9493)

    const khoa = bd.chonKhoa([{ id: 'k1', ten: 'A' }, { id: 'k2', ten: 'B' }], 600)
    assert.strictEqual(khoa.id, 'k2', 'phải chọn khoá còn nhiều quota hơn')

    bd.danhDauHet('k2')
    assert.strictEqual(bd.conLai('k2'), 0)
    assert.strictEqual(bd.chonKhoa([{ id: 'k2', ten: 'B' }], 100), null, 'khoá hết quota vẫn được chọn')

    // Ghi ra file thật: mở bộ đếm mới phải đọc lại được.
    const bd2 = quotaMod.taoBoDem(d)
    assert.strictEqual(bd2.daDung('k1'), 507)
  })

  nhom('10. Gọi API YouTube (nhồi hàm mạng giả)')

  const traLoiGia = {
    search: {
      items: [{ id: { videoId: 'v1' } }, { id: { videoId: 'v2' } }, { id: { kind: 'youtube#channel' } }]
    },
    videos: {
      items: [
        {
          id: 'v1',
          snippet: { title: 'Video một', channelId: 'c1', channelTitle: 'Kênh Một', publishedAt: '2026-09-20T00:00:00Z' },
          statistics: { viewCount: '900000', likeCount: '12000', commentCount: '800' },
          contentDetails: { duration: 'PT32M10S' }
        },
        {
          id: 'v2',
          snippet: { title: 'Short', channelId: 'c1', channelTitle: 'Kênh Một', publishedAt: '2026-09-21T00:00:00Z' },
          statistics: { viewCount: '400000' },
          contentDetails: { duration: 'PT48S' }
        }
      ]
    },
    channels: {
      items: [{
        id: 'c1',
        snippet: { title: 'Kênh Một' },
        statistics: { subscriberCount: '500000', videoCount: '300' },
        contentDetails: { relatedPlaylists: { uploads: 'UU_c1' } }
      }]
    },
    playlistItems: { items: [{ contentDetails: { videoId: 'p1' } }, { contentDetails: { videoId: 'p2' } }] },
    videosTrungVi: { items: [{ statistics: { viewCount: '30000' } }, { statistics: { viewCount: '50000' } }] }
  }

  function mangGia({ batLoi } = {}) {
    const daGoi = []
    return {
      daGoi,
      layJSONHam: async (url) => {
        daGoi.push(url)
        if (batLoi) throw batLoi
        if (url.includes('/search')) return traLoiGia.search
        if (url.includes('/channels')) return traLoiGia.channels
        if (url.includes('/playlistItems')) return traLoiGia.playlistItems
        if (url.includes('/videos')) {
          return url.includes('p1') ? traLoiGia.videosTrungVi : traLoiGia.videos
        }
        throw new Error('URL lạ: ' + url)
      }
    }
  }

  await kiem('search.list gửi đúng publishedAfter, type=video và khoá API', async () => {
    const g = mangGia()
    const bd = quotaMod.taoBoDem(thuMucTam('api1'))
    const khach = ytApi.taoKhachHang({ layJSONHam: g.layJSONHam, boDem: bd, idKhoa: 'k1', khoa: 'KHOA123' })
    await khach.timId('bible stories', { soLuong: 2, tuNgay: '2026-09-08T00:00:00.000Z' })
    const url = g.daGoi[0]
    assert.ok(url.includes('publishedAfter=2026-09-08'), 'thiếu publishedAfter → tìm cả video cũ 10 năm')
    assert.ok(url.includes('type=video'))
    assert.ok(url.includes('order=viewCount'))
    assert.ok(url.includes('key=KHOA123'))
  })

  await kiem('bỏ qua mục không phải video trong kết quả search', async () => {
    const g = mangGia()
    const khach = ytApi.taoKhachHang({ layJSONHam: g.layJSONHam, idKhoa: 'k1', khoa: 'K' })
    const ids = await khach.timId('x', { soLuong: 10 })
    assert.deepStrictEqual(ids, ['v1', 'v2'], 'mục kênh bị đưa vào danh sách video')
  })

  await kiem('BẮT BUỘC gọi videos.list — search.list không trả số view', async () => {
    const g = mangGia()
    const khach = ytApi.taoKhachHang({ layJSONHam: g.layJSONHam, idKhoa: 'k1', khoa: 'K' })
    const dong = await khach.soLieuVideo(['v1', 'v2'])
    assert.ok(g.daGoi.some((u) => u.includes('/videos')))
    assert.strictEqual(dong[0].views, 900000, 'view phải là số, không phải chuỗi')
    assert.strictEqual(dong[0].thoiLuongGiay, 1930)
    assert.strictEqual(dong[0].lienKet, 'https://www.youtube.com/watch?v=v1')
  })

  await kiem('quota bị trừ đúng: 100 cho search, 1 cho videos', async () => {
    const g = mangGia()
    const bd = quotaMod.taoBoDem(thuMucTam('api2'))
    const khach = ytApi.taoKhachHang({ layJSONHam: g.layJSONHam, boDem: bd, idKhoa: 'k1', khoa: 'K' })
    await khach.timId('x', { soLuong: 2 })
    assert.strictEqual(bd.daDung('k1'), 100)
    await khach.soLieuVideo(['v1'])
    assert.strictEqual(bd.daDung('k1'), 101)
  })

  await kiem('403 quotaExceeded → LoiQuota và khoá bị đánh dấu hết', async () => {
    const loi = new Error('HTTP 403')
    loi.maHttp = 403
    loi.than = '{"error":{"errors":[{"reason":"quotaExceeded"}]}}'
    const g = mangGia({ batLoi: loi })
    const bd = quotaMod.taoBoDem(thuMucTam('api3'))
    const khach = ytApi.taoKhachHang({ layJSONHam: g.layJSONHam, boDem: bd, idKhoa: 'k1', khoa: 'K' })
    await assert.rejects(() => khach.timId('x', {}), (e) => e.laLoiQuota === true)
    assert.strictEqual(bd.conLai('k1'), 0)
  })

  await kiem('403 vì khoá sai → LoiKhoa, KHÁC hẳn hết quota (báo sai là đi xin khoá mới vô ích)', async () => {
    const loi = new Error('HTTP 403')
    loi.maHttp = 403
    loi.than = '{"error":{"errors":[{"reason":"accessNotConfigured"}]}}'
    const g = mangGia({ batLoi: loi })
    const bd = quotaMod.taoBoDem(thuMucTam('api4'))
    const khach = ytApi.taoKhachHang({ layJSONHam: g.layJSONHam, boDem: bd, idKhoa: 'k1', khoa: 'K' })
    await assert.rejects(() => khach.timId('x', {}), (e) => e.laLoiKhoa === true && !e.laLoiQuota)
    assert.strictEqual(bd.conLai('k1'), 10000, 'khoá sai thì KHÔNG được đánh dấu hết quota')
  })

  await kiem('trung vị kênh lấy 20 video gần nhất rồi tính trung vị', async () => {
    const g = mangGia()
    const khach = ytApi.taoKhachHang({ layJSONHam: g.layJSONHam, idKhoa: 'k1', khoa: 'K' })
    const tv = await khach.trungViKenh('UU_c1')
    assert.strictEqual(tv, 40000)
  })

  await kiem('kênh không có playlist tải lên thì trả 0, không gọi mạng vô ích', async () => {
    const g = mangGia()
    const khach = ytApi.taoKhachHang({ layJSONHam: g.layJSONHam, idKhoa: 'k1', khoa: 'K' })
    assert.strictEqual(await khach.trungViKenh(''), 0)
    assert.strictEqual(g.daGoi.length, 0)
  })

  nhom('11. Một lượt tìm ý tưởng trọn vẹn')

  let dongKetQua = null

  await kiem('lọc Shorts, gắn từ khóa nguồn, chấm điểm, báo tiến độ', async () => {
    const g = mangGia()
    const bd = quotaMod.taoBoDem(thuMucTam('e2e'))
    const moc = []
    const kq = await timYTuong({
      tuKhoa: ['bible stories', 'trump bible'],
      caiDat: {
        soVideoMoiTuKhoa: 2, soNgay: 14, boShorts: true, viewToiThieu: 0,
        tinhVuotTrungViKenh: true, regionCode: 'US', relevanceLanguage: 'en'
      },
      khoa: { id: 'k1', ten: 'A', khoa: 'K' },
      boDem: bd,
      layJSONHam: g.layJSONHam,
      baoTienDo: (t) => moc.push(t)
    })
    dongKetQua = kq.dong

    assert.strictEqual(kq.dong.length, 1, 'Short 48 giây phải bị loại')
    assert.strictEqual(kq.dong[0].videoId, 'v1')
    assert.deepStrictEqual(kq.dong[0].tuKhoaNguon, ['bible stories', 'trump bible'])
    assert.strictEqual(kq.dong[0].subKenh, 500000)
    assert.strictEqual(kq.dong[0].nhan, 'NỔ VIEW', '900k view / trung vị 40k = 22 lần')
    assert.ok(moc.length >= 4, 'phải báo tiến độ nhiều mốc')
    assert.strictEqual(moc[moc.length - 1].phanTram, 100, 'mốc cuối phải là 100%')
    assert.ok(kq.quotaDaDung >= 200, 'hai từ khóa = ít nhất 200 đơn vị')
  })

  await kiem('một từ khóa lỗi thì các từ khóa còn lại vẫn chạy', async () => {
    let lan = 0
    const layJSONHam = async (url) => {
      if (url.includes('/search')) {
        lan++
        if (lan === 1) { const e = new Error('mạng rớt'); e.maHttp = 500; throw e }
        return traLoiGia.search
      }
      if (url.includes('/channels')) return traLoiGia.channels
      if (url.includes('/playlistItems')) return traLoiGia.playlistItems
      if (url.includes('/videos')) return url.includes('p1') ? traLoiGia.videosTrungVi : traLoiGia.videos
      throw new Error('URL lạ')
    }
    const kq = await timYTuong({
      tuKhoa: ['a', 'b'],
      caiDat: { soVideoMoiTuKhoa: 2, soNgay: 14, boShorts: true, tinhVuotTrungViKenh: false },
      khoa: { id: 'k1', ten: 'A', khoa: 'K' },
      boDem: quotaMod.taoBoDem(thuMucTam('e2e2')),
      layJSONHam
    })
    assert.strictEqual(kq.loiTuKhoa.length, 1)
    assert.strictEqual(kq.dong.length, 1, 'từ khóa thứ hai vẫn phải ra kết quả')
  })

  await kiem('hết quota giữa lượt tìm thì ném LoiQuota, không trả bảng rỗng im lặng', async () => {
    const loi = new Error('HTTP 403')
    loi.maHttp = 403
    loi.than = 'quotaExceeded'
    await assert.rejects(() => timYTuong({
      tuKhoa: ['a'],
      caiDat: { soVideoMoiTuKhoa: 2, soNgay: 14 },
      khoa: { id: 'k1', ten: 'A', khoa: 'K' },
      boDem: quotaMod.taoBoDem(thuMucTam('e2e3')),
      layJSONHam: async () => { throw loi }
    }), (e) => e.laLoiQuota === true)
  })

  nhom('12. Lưu trữ và xuất Excel')

  await kiem('store ghi rồi đọc lại đúng, và có đủ khoá mặc định', () => {
    const d = thuMucTam('store')
    const kho = taoKho(d)
    const c = kho.docCaiDat()
    assert.strictEqual(c.boShorts, true, 'mặc định phải bỏ Shorts')
    assert.strictEqual(c.regionCode, 'US')
    assert.strictEqual(c.soTuMucTieu, 11000)
    c.soVideoMoiTuKhoa = 40
    kho.ghiCaiDat(c)
    assert.strictEqual(taoKho(d).docCaiDat().soVideoMoiTuKhoa, 40)
  })

  await kiem('cài đặt vỡ định dạng thì quay về mặc định, không làm sập app', () => {
    const d = thuMucTam('store2')
    fs.writeFileSync(path.join(d, 'cai-dat.json'), '{ hỏng rồi')
    assert.strictEqual(taoKho(d).docCaiDat().regionCode, 'US')
  })

  await kiem('xuất được .xlsx đọc lại được, có 2 trang', async () => {
    const d = thuMucTam('excel')
    const tep = path.join(d, 'thu.xlsx')
    await xuatExcel(tep, dongKetQua || [], { tuKhoa: ['bible stories'], caiDat: { soNgay: 14 } })
    assert.ok(fs.existsSync(tep))
    assert.ok(fs.statSync(tep).size > 3000, 'file quá nhỏ, chắc chưa ghi gì')

    const ExcelJS = require('exceljs')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(tep)
    assert.strictEqual(wb.worksheets.length, 2)
    assert.strictEqual(wb.worksheets[0].name, 'Video nổ view')
    assert.strictEqual(wb.worksheets[0].getRow(1).getCell(1).value, 'Nhãn')
    assert.strictEqual(wb.worksheets[1].name, 'Điều kiện tìm')
  })

  // =========================================================================
  nhom('13. Phụ đề — bẫy lặp kiểu cuộn')

  await kiem('json3: bỏ sự kiện aAppend (chỉ vẽ lại chữ cũ cho hiệu ứng cuộn)', () => {
    const tho = JSON.stringify({ events: [
      { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'hello ' }, { utf8: 'world' }] },
      { tStartMs: 2000, dDurationMs: 900, aAppend: 1, segs: [{ utf8: 'hello world' }] },
      { tStartMs: 2000, dDurationMs: 2000, segs: [{ utf8: 'this is new' }] }
    ] })
    const kq = phuDe.chuyenThanhVanBan(tho, { dinhDang: 'json3' })
    assert.strictEqual(kq.vanBan, 'hello world this is new')
    assert.strictEqual(kq.soCue, 2, 'sự kiện aAppend phải bị loại ngay từ bước phân tích')
  })

  await kiem('vtt: phụ đề tự động kiểu cuộn không được ra văn bản lặp', () => {
    const vtt = [
      'WEBVTT', '',
      '00:00:01.000 --> 00:00:03.000', '<c>he walked into</c>', '',
      '00:00:03.000 --> 00:00:05.000', 'he walked into the room', '',
      '00:00:05.000 --> 00:00:07.000', 'the room and sat down', ''
    ].join('\n')
    const kq = phuDe.chuyenThanhVanBan(vtt, { dinhDang: 'vtt' })
    assert.strictEqual(kq.vanBan, 'he walked into the room and sat down')
  })

  await kiem('chồng lấn đếm theo TỪ, không theo ký tự', () => {
    // Đếm ký tự với ngưỡng 12 thì "the room" (8 ký tự) lọt lưới và câu ra thành
    // "...into the room the room and sat". Đây chính là lỗi đã gặp.
    assert.strictEqual(phuDe.soTuChongLan(['into', 'the', 'room'], ['the', 'room', 'and']), 2)
    assert.strictEqual(phuDe.soTuChongLan(['a', 'b'], ['c', 'd']), 0)
  })

  await kiem('KHÔNG cắt nhầm khi chỉ trùng đúng một từ thông dụng', () => {
    const kq = phuDe.boLapCuon([{ chu: 'she opened the' }, { chu: 'the door slowly' }])
    assert.deepStrictEqual(kq.map((c) => c.chu), ['she opened the', 'the door slowly'])
  })

  await kiem('bỏ nhãn âm thanh [Music] và ngắt đoạn theo khoảng lặng', () => {
    const cue = [
      { batDauMs: 0, keoDaiMs: 1000, chu: 'first thought here' },
      { batDauMs: 1000, keoDaiMs: 500, chu: '[Music]' },
      { batDauMs: 5000, keoDaiMs: 1000, chu: 'much later a second thought' }
    ]
    const doan = phuDe.ghepDoan(cue, { khoangLangGiay: 0.8 })
    assert.strictEqual(doan.length, 2, 'khoảng lặng 3,5 giây phải tách đoạn')
    assert.ok(!doan.join(' ').includes('Music'))
  })

  // =========================================================================
  nhom('14. Lịch sử view (JSONL)')

  await kiem('ghi rồi đọc lại đúng, và dòng hỏng KHÔNG làm mất cả tệp', () => {
    const d = thuMucTam('lichsu')
    lichSu.ghiMoc(d, 'UC123', [{ videoId: 'v1', views: 100 }], 1000)
    fs.appendFileSync(lichSu.duongDanKenh(d, 'UC123'), '{ hỏng giữa chừng\n')
    lichSu.ghiMoc(d, 'UC123', [{ videoId: 'v1', views: 500 }], 2000)

    const ds = lichSu.docLichSu(d, 'UC123')
    assert.strictEqual(ds.length, 2, 'phải bỏ đúng dòng hỏng, giữ hai dòng lành')
    assert.strictEqual(ds[1].views, 500)
  })

  await kiem('tăng trưởng chỉ tính khi hai mốc cách nhau đủ xa', () => {
    const gan = [
      { luc: 0, views: 100, ngayDang: '' },
      { luc: 600000, views: 110, ngayDang: '' }   // cách 10 phút
    ]
    assert.strictEqual(lichSu.tinhTangTruong(gan), null,
      'hai lần quét cách 10 phút mà tính tăng trưởng thì video nào cũng trông như đã nguội')

    const xa = [
      { luc: 0, views: 100, ngayDang: '' },
      { luc: 24 * 3600000, views: 2500, ngayDang: '' }
    ]
    const t = lichSu.tinhTangTruong(xa)
    assert.strictEqual(t.tang, 2400)
    assert.strictEqual(t.soGio, 24)
    assert.strictEqual(t.tangMoiGio, 100)
  })

  // =========================================================================
  nhom('15. Kênh theo dõi')

  await kiem('trung vị BỎ chính video đang xét ra ngoài', () => {
    // Kênh mới ít video: một video nổ cực mạnh sẽ tự kéo trung vị lên và che mất mình.
    const views = [100, 100, 100, 5000]
    assert.strictEqual(kenhTheoDoi.trungViBoChinhNo(views, 3), 100)
  })

  await kiem('vượt trung vị từ 3 lần là NỔ VIEW', () => {
    const kq = kenhTheoDoi.danhDauVuotTrungVi(
      [{ views: 900 }, { views: 200 }, { views: 100 }], 100)
    assert.strictEqual(kq[0].nhan, 'NỔ VIEW')
    assert.strictEqual(kq[0].vuotTrungVi, 9)
    assert.strictEqual(kq[1].nhan, 'TỐT')
    assert.strictEqual(kq[2].nhan, 'BÌNH THƯỜNG')
  })

  await kiem('gộp nhiều kênh rồi sắp theo mức vượt trung vị', () => {
    const gop = kenhTheoDoi.gopNoView([
      { kenh: { tenKenh: 'A', kenhId: 'a' }, video: [{ vuotTrungVi: 2, nhan: 'TỐT' }] },
      { kenh: { tenKenh: 'B', kenhId: 'b' }, video: [{ vuotTrungVi: 7, nhan: 'NỔ VIEW' }] }
    ], { chiNoView: false })
    assert.strictEqual(gop[0].tenKenh, 'B')
    assert.strictEqual(gop.length, 2)
  })

  await kiem('đọc được kênh từ link, @handle và kenhId — KHÔNG dùng search.list', () => {
    assert.deepStrictEqual(ytApi.tachDinhDanhKenh('UCabcdefghijklmnopqrstuv'),
      { loai: 'id', giaTri: 'UCabcdefghijklmnopqrstuv' })
    assert.deepStrictEqual(ytApi.tachDinhDanhKenh('@MrBeast'), { loai: 'handle', giaTri: '@MrBeast' })
    assert.deepStrictEqual(ytApi.tachDinhDanhKenh('https://www.youtube.com/@SomeChannel'),
      { loai: 'handle', giaTri: '@SomeChannel' })
    assert.deepStrictEqual(ytApi.tachDinhDanhKenh('https://youtube.com/channel/UCabcdefghijklmnopqrstuv'),
      { loai: 'id', giaTri: 'UCabcdefghijklmnopqrstuv' })
    assert.strictEqual(ytApi.tachDinhDanhKenh(''), null)
  })

  // =========================================================================
  nhom('16. yt-dlp')

  await kiem('tách videoId từ mọi kiểu link', () => {
    const mong = 'dQw4w9WgXcQ'
    for (const l of [
      mong,
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ'
    ]) assert.strictEqual(ytDlp.tachVideoId(l), mong, 'hỏng ở: ' + l)
    assert.strictEqual(ytDlp.tachVideoId('không phải link'), null)
  })

  await kiem('tách nhiều link một lúc, bỏ trùng', () => {
    const ds = ytDlp.tachNhieuVideoId('https://youtu.be/aaaaaaaaaaa\nhttps://youtu.be/bbbbbbbbbbb https://youtu.be/aaaaaaaaaaa')
    assert.deepStrictEqual(ds, ['aaaaaaaaaaa', 'bbbbbbbbbbb'])
  })

  await kiem('cookie xuất đúng định dạng Netscape mà yt-dlp đọc được', () => {
    const chu = ytDlp.dinhDangCookieNetscape([
      { domain: '.youtube.com', path: '/', secure: true, expirationDate: 1800000000, name: 'SID', value: 'abc' }
    ])
    assert.ok(chu.startsWith('# Netscape HTTP Cookie File'))
    const dong = chu.split('\n').find((d) => d.includes('SID'))
    assert.deepStrictEqual(dong.split('\t'), ['.youtube.com', 'TRUE', '/', 'TRUE', '1800000000', 'SID', 'abc'])
  })

  await kiem('dịch lỗi yt-dlp thành câu người dùng biết phải làm gì', () => {
    assert.ok(ytDlp.dichLoiYtDlp('ERROR: Sign in to confirm you are not a bot').includes('đăng nhập'))
    assert.ok(ytDlp.dichLoiYtDlp('ERROR: Video unavailable').includes('không xem được'))
    assert.ok(ytDlp.dichLoiYtDlp('ERROR: Unable to download webpage: HTTP Error 403').includes('Cập nhật yt-dlp'))
  })

  await kiem('tên binary đúng theo hệ điều hành', () => {
    assert.strictEqual(ytDlp.tenBinary('win32'), 'yt-dlp.exe')
    assert.strictEqual(ytDlp.tenBinary('darwin'), 'yt-dlp_macos')
    assert.strictEqual(ytDlp.tenBinary('linux'), 'yt-dlp')
  })

  // =========================================================================
  nhom('17. Kịch bản 10.000-12.000 từ')

  await kiem('chia phần cộng lại ĐÚNG BẰNG mục tiêu, không hụt vì làm tròn', () => {
    for (const [tong, soPhan] of [[11000, 8], [10000, 7], [12345, 9]]) {
      const p = kichBanMod.chiaPhan(tong, soPhan)
      assert.strictEqual(p.length, soPhan)
      assert.strictEqual(p.reduce((a, x) => a + x.soTuMucTieu, 0), tong, `${tong}/${soPhan} bị hụt`)
    }
  })

  await kiem('đọc được dàn ý Claude trả về', () => {
    const p = kichBanMod.phanTichDanY([
      'PHẦN 1 | Lời mở và câu hỏi treo | 1375',
      '- Đặt bối cảnh', '- Nêu nghịch lý',
      'PHẦN 2 | Bối cảnh lịch sử | 1375', '- Mốc thời gian'
    ].join('\n'))
    assert.strictEqual(p.length, 2)
    assert.strictEqual(p[0].tieuDe, 'Lời mở và câu hỏi treo')
    assert.strictEqual(p[0].soTuMucTieu, 1375)
    assert.deepStrictEqual(p[0].y, ['Đặt bối cảnh', 'Nêu nghịch lý'])
  })

  await kiem('sổ chống lặp rút được cụm đã lặp, cách vào câu và từ dùng nhiều', () => {
    const daViet = ['The old harbour stood quiet. The old harbour stood empty. And so they waited. And so they left.']
    const so = kichBanMod.soChongLap(daViet)
    assert.ok(so.cumDaLap.some((c) => c.includes('old harbour stood')), 'phải bắt được cụm lặp nguyên văn')
    assert.ok(so.moDau.includes('and so'), 'phải bắt được cách vào câu bị lặp')
    assert.ok(so.tuRieng.some((t) => t.startsWith('harbour')))
  })

  await kiem('phần 1 KHÔNG có sổ chống lặp; phần 2 trở đi BẮT BUỘC có', () => {
    const p1 = kichBanMod.taoPromptPhan({ phanSo: 1, cacPhanDaViet: [] })
    assert.ok(!p1.includes('SỔ CHỐNG LẶP'))

    const p2 = kichBanMod.taoPromptPhan({ phanSo: 2, cacPhanDaViet: ['The old harbour stood quiet. The old harbour stood empty.'] })
    assert.ok(p2.includes('SỔ CHỐNG LẶP'), 'thiếu sổ chống lặp thì tới phần 5-6 là kịch bản bắt đầu tự lặp')
    assert.ok(p2.includes('TỪ CUỐI CỦA PHẦN 1'), 'thiếu đoạn nối thì giọng và mạch bị đứt giữa hai phần')
  })

  await kiem('thống kê kịch bản: số cảnh và số ảnh khi gộp 2', () => {
    const chu = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    const tk = kichBanMod.phanTichKichBan(chu, { tuMoiCanh: 30, soTuMucTieu: 600 })
    assert.strictEqual(tk.soTu, 300)
    assert.strictEqual(tk.soCanh, 10)
    assert.strictEqual(tk.soAnhNeuGop2, 5)
    assert.strictEqual(tk.datMucTieu, 50)
    assert.strictEqual(tk.thieuTu, 300)
  })

  // =========================================================================
  nhom('18. Kiểm duyệt')

  await kiem('bắt cụm lặp nguyên văn, BỎ QUA cụm toàn từ chức năng', () => {
    const chu = 'the storm broke the seawall. later that night the storm broke the seawall again.'
    const cum = kiemDuyet.cumLap(chu, { n: 4, toiThieuLan: 2 })
    assert.ok(cum.some((c) => c.cum.includes('storm broke the seawall')))
    assert.ok(!cum.some((c) => kiemDuyet.toanTuChucNang(c.cum)),
      'cụm toàn từ chức năng lặp là chuyện bình thường của mọi văn bản, gắn cờ chỉ gây nhiễu')
  })

  await kiem('bắt câu gần trùng (cùng vốn từ, đảo cách sắp)', () => {
    const chu = 'Nobody dared to speak a single word that evening. ' +
                'Nobody dared to speak a single word that evening in the hall.'
    const cum = kiemDuyet.cauGanTrung(chu)
    assert.strictEqual(cum.length, 1)
    assert.ok(cum[0].doGiong >= 70)
  })

  await kiem('bắt tật "And then... And then... And then..." (mở đầu 2 từ)', () => {
    const chu = 'And then he raised his hand. And then he lowered it. And then the guards stepped back.'
    const md = kiemDuyet.moDauCauLap(chu)
    assert.deepStrictEqual(md[0], { moDau: 'and then', soLan: 3 })
  })

  await kiem('KHÔNG báo oan trên văn bản sạch', () => {
    const sach = 'Rain fell across the valley for three days. Farmers counted their losses quietly. ' +
                 'A bridge collapsed near the mill on Thursday. Children were sent home early.'
    assert.strictEqual(kiemDuyet.moDauCauLap(sach).length, 0)
    assert.strictEqual(kiemDuyet.cauGanTrung(sach).length, 0)
    assert.strictEqual(kiemDuyet.quetChinhSach(sach, boLuatChinhSach).ketLuan, 'KHÔNG GẮN CỜ NÀO')
  })

  await kiem('độ giống bản gốc: ba mức xanh/vàng/đỏ', () => {
    assert.strictEqual(kiemDuyet.mucDoGiong(3), 'XANH')
    assert.strictEqual(kiemDuyet.mucDoGiong(8), 'VÀNG')
    assert.strictEqual(kiemDuyet.mucDoGiong(25), 'ĐỎ')

    const goc = 'the lighthouse keeper climbed the spiral stair every single night without fail'
    const y = kiemDuyet.doGiongBanGoc(goc, goc)
    assert.strictEqual(y.tyLe, 100, 'sao chép nguyên văn phải ra 100%')
    assert.strictEqual(y.mucDo, 'ĐỎ')

    const khac = 'a completely different sentence about farming equipment and tractor maintenance schedules'
    assert.strictEqual(kiemDuyet.doGiongBanGoc(khac, goc).tyLe, 0)
  })

  await kiem('ngưỡng 8%/20% phải nói rõ là do tool đặt, không phải số YouTube công bố', () => {
    const kq = kiemDuyet.doGiongBanGoc('a b c d e f g h', 'a b c d e f g h')
    assert.ok(/không phải con số YouTube công bố/i.test(kq.ghiChuNguong))
  })

  await kiem('quét chính sách gắn đúng cờ và KHÔNG tự nhận là xác nhận an toàn', () => {
    const kq = kiemDuyet.quetChinhSach(
      'The election results were disputed. You won\'t believe the shocking truth.', boLuatChinhSach)
    const ma = kq.co.map((c) => c.ma)
    assert.ok(ma.includes('chinh-tri'))
    assert.ok(ma.includes('gay-soc'))
    assert.strictEqual(kq.ketLuan, 'CÓ CỜ VÀNG')
    assert.ok(/không phải xác nhận an toàn/i.test(kq.canhBao))
  })

  await kiem('bộ luật có đủ mục đỏ lẫn vàng và mỗi luật có hướng sửa', () => {
    assert.ok(boLuatChinhSach.luat.length >= 10)
    assert.ok(boLuatChinhSach.luat.some((l) => l.mucDo === 'đỏ'))
    assert.ok(boLuatChinhSach.luat.some((l) => l.mucDo === 'vàng'))
    for (const l of boLuatChinhSach.luat) {
      assert.ok(l.ma && l.ten && l.giaiThich && l.huongSua, 'luật thiếu trường: ' + l.ma)
      assert.ok(Array.isArray(l.tuKhoa) && l.tuKhoa.length, 'luật không có từ khóa: ' + l.ma)
    }
  })

  await kiem('báo cáo cho ra hướng sửa CỤ THỂ, không phải câu chung chung', () => {
    const chu = 'And then he waited. And then she waited. And then they waited. The harbour stood empty that year.'
    const bc = kiemDuyet.baoCao(chu, { boLuat: boLuatChinhSach })
    assert.ok(bc.huongSua.length > 0)
    assert.ok(bc.huongSua.some((h) => /and then/.test(h.viec)), 'hướng sửa phải chỉ đúng chỗ phải sửa')
  })

  // =========================================================================
  nhom('19. Prompt ảnh — bài toán 400 cảnh')

  await kiem('cắt cảnh bám mức 25-30 từ và không cắt giữa câu', () => {
    const chu = Array.from({ length: 30 },
      (_, i) => `The old keeper climbed the stone stair as dusk fell over the harbour number ${i}.`).join(' ')
    const canh = promptAnh.catCanh(chu, { tuMoiCanh: 27, toiDaTu: 40 })
    for (const c of canh) {
      assert.ok(c.soTu <= 40, `cảnh ${c.so} dài ${c.soTu} từ, vượt trần`)
      assert.ok(/[.!?]$/.test(c.chu.trim()), `cảnh ${c.so} bị cắt giữa câu: "${c.chu}"`)
    }
  })

  await kiem('BẤT BIẾN: số thứ tự liên tục từ 1, không bỏ số', () => {
    // Flow Automation Studio tra prompts[index-1] theo số thứ tự TOÀN CỤC.
    // Thiếu một số là lệch tên tệp cả mẻ, và nó sai IM LẶNG.
    const chu = Array.from({ length: 50 }, (_, i) => `Sentence number ${i} here.`).join(' ')
    const canh = promptAnh.catCanh(chu, { tuMoiCanh: 10 })
    canh.forEach((c, i) => {
      assert.strictEqual(c.so, i + 1)
      assert.strictEqual(c.ten, String(i + 1).padStart(3, '0'))
    })
    const pr = promptAnh.taoTatCaPrompt(canh, {})
    assert.strictEqual(promptAnh.kiemTraLienTuc(pr).ok, true)
  })

  await kiem('gộp 2 cảnh một ảnh cho ra đúng nửa số ảnh', () => {
    const chu = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} here.`).join(' ')
    const mot = promptAnh.catCanh(chu, { tuMoiCanh: 10, gopCanh: 1 })
    const hai = promptAnh.catCanh(chu, { tuMoiCanh: 10, gopCanh: 2 })
    assert.strictEqual(hai.length, Math.ceil(mot.length / 2))
    assert.strictEqual(hai[0].so, 1, 'gộp xong vẫn phải đánh số lại liên tục từ 1')
  })

  await kiem('mô tả nhân vật chèn NGUYÊN VĂN — đó là cách duy nhất giữ mặt giống nhau', () => {
    const moTa = 'a weathered man in his seventies, grey beard, heavy wool coat'
    const kho = [{ ten: 'the old keeper', moTa, tuKhoa: ['keeper'] }]
    const canh = promptAnh.catCanh('The old keeper climbed the stair slowly.', { tuMoiCanh: 27 })
    const pr = promptAnh.taoTatCaPrompt(canh, { khoNhanVat: kho })
    assert.ok(pr[0].prompt.includes(moTa), 'đoạn mô tả phải vào prompt nguyên văn, không diễn giải lại')
    assert.deepStrictEqual(pr[0].nhanVat, ['the old keeper'])
  })

  await kiem('cảnh không có nhân vật thì prompt không dính dấu phẩy thừa', () => {
    const canh = promptAnh.catCanh('Rain fell on the empty street.', { tuMoiCanh: 27 })
    const pr = promptAnh.taoTatCaPrompt(canh, { khoNhanVat: [] })
    assert.ok(!/,\s*,/.test(pr[0].prompt), 'dấu phẩy liên tiếp làm mô hình sinh ảnh hiểu sai trọng số')
    assert.ok(!pr[0].prompt.startsWith(','))
  })

  await kiem('đọc JSON Claude trả về kể cả khi có lời dẫn và khối mã', () => {
    const chu = 'Đây là kết quả:\n```json\n[{"so":1,"subject":"an old keeper","action":"climbing",' +
      '"setting":"harbour","lighting":"low light","mood":"lonely","camera":"wide"}]\n```'
    const kq = promptAnh.phanTichMoTaCanh(chu)
    assert.strictEqual(kq.loi, null)
    assert.strictEqual(kq.soDoc, 1)
    assert.strictEqual(kq.moTa[1].subject, 'an old keeper')
  })

  await kiem('JSON hỏng thì báo lỗi rõ ràng chứ không im lặng trả rỗng', () => {
    assert.ok(promptAnh.phanTichMoTaCanh('[{"so":1,').loi)
    assert.ok(promptAnh.phanTichMoTaCanh('không có json gì ở đây').loi)
  })

  await kiem('prompts.txt: ĐÚNG một dòng mỗi prompt, kể cả khi prompt chứa xuống dòng', () => {
    const pr = [
      { prompt: 'dòng một\nvẫn cùng prompt', ten: '001' },
      { prompt: 'prompt hai', ten: '002' }
    ]
    const dong = promptAnh.xuatPromptsTxt(pr).trimEnd().split('\n')
    assert.strictEqual(dong.length, 2, 'lệch số dòng là Flow gán nhầm prompt cho cả mẻ')
    assert.strictEqual(dong[0], 'dòng một vẫn cùng prompt')
  })

  await kiem('tên ảnh đánh số 3 chữ số cho CapCut xếp đúng thứ tự', () => {
    const pr = Array.from({ length: 12 }, (_, i) => ({ ten: String(i + 1).padStart(3, '0') }))
    const ten = promptAnh.xuatTenAnh(pr).trimEnd().split('\n')
    assert.strictEqual(ten[0], '001.png')
    assert.strictEqual(ten[11], '012.png')
  })

  await kiem('kịch bản 11.000 từ thật ra khoảng 400 cảnh — con số phải nhìn thẳng', () => {
    // Dựng đúng cỡ thật: 11.000 từ, là mục tiêu mỗi video của kênh này.
    const cau = 'This is sentence number N of the long narrated script here.'  // 11 từ
    const soCau = Math.ceil(11000 / 11)
    const chu = Array.from({ length: soCau }, (_, i) => cau.replace('N', i)).join(' ')
    const soTuThat = (chu.match(/\S+/g) || []).length
    assert.ok(soTuThat >= 10500 && soTuThat <= 12500, 'văn bản thử phải đúng cỡ 10-12k từ: ' + soTuThat)

    const canh = promptAnh.catCanh(chu, { tuMoiCanh: 27 })
    const tk = promptAnh.thongKeCanh(canh)
    assert.ok(tk.soCanh >= 300 && tk.soCanh <= 500,
      `11.000 từ phải ra 300-500 cảnh, đang ra ${tk.soCanh} — lệch xa thế này là cắt cảnh sai`)
    assert.ok(tk.tuTrungBinh >= 18 && tk.tuTrungBinh <= 40, 'từ/cảnh lệch xa mức đặt: ' + tk.tuTrungBinh)

    // Gộp 2 cảnh một ảnh là lối thoát cho khối lượng render — phải đúng nửa.
    const gop = promptAnh.catCanh(chu, { tuMoiCanh: 27, gopCanh: 2 })
    assert.strictEqual(gop.length, Math.ceil(canh.length / 2))
  })

  // =========================================================================
  nhom('20. Kho dự án')

  await kiem('tên dự án tiếng Việt có dấu thành tên thư mục an toàn', () => {
    assert.strictEqual(duAnMod.anToanTen('Chuyện Kinh Thánh — tập 1'), 'chuyen-kinh-thanh-tap-1')
    assert.strictEqual(duAnMod.anToanTen(''), 'du-an')
  })

  await kiem('kịch bản lưu THEO PHIÊN BẢN, không bao giờ ghi đè', () => {
    const kho = duAnMod.taoKhoDuAn(thuMucTam('duan'))
    const d = kho.tao('Dự án thử')
    kho.ghiKichBan(d.ma, 'bản một')
    kho.ghiKichBan(d.ma, 'bản hai')
    const cac = kho.cacBanKichBan(d.ma)
    assert.deepStrictEqual(cac, ['kich-ban-v1.md', 'kich-ban-v2.md'],
      'ghi đè một lần là mất công cả buổi và không lấy lại được')
    assert.strictEqual(kho.docKichBan(d.ma), 'bản hai', 'mặc định đọc bản mới nhất')
    assert.strictEqual(kho.docKichBan(d.ma, 'kich-ban-v1.md'), 'bản một')
  })

  await kiem('lời thoại và các phần viết dở được giữ lại qua nhiều phiên làm việc', () => {
    const kho = duAnMod.taoKhoDuAn(thuMucTam('duan2'))
    const d = kho.tao('Dự án hai')
    kho.ghiLoiThoai(d.ma, 'một hai ba bốn năm')
    kho.ghiCacPhan(d.ma, ['phần một', null, 'phần ba'])
    assert.strictEqual(kho.docLoiThoai(d.ma), 'một hai ba bốn năm')
    assert.strictEqual(kho.doc(d.ma).soTuLoiThoai, 5)
    assert.deepStrictEqual(kho.docCacPhan(d.ma), ['phần một', null, 'phần ba'])
  })

  await kiem('tên trùng thì tự thêm hậu tố, không đè lên dự án cũ', () => {
    const kho = duAnMod.taoKhoDuAn(thuMucTam('duan3'))
    const a = kho.tao('Cùng tên')
    const b = kho.tao('Cùng tên')
    assert.notStrictEqual(a.ma, b.ma)
  })

  // =========================================================================
  nhom('21. Trình duyệt đa tài khoản')

  await kiem('mỗi tài khoản một phân vùng riêng — cookie không được lẫn', () => {
    assert.strictEqual(trinhDuyet.tenPhanVung('tk1'), 'persist:yt-tk1')
    assert.notStrictEqual(trinhDuyet.tenPhanVung('tk1'), trinhDuyet.tenPhanVung('tk2'))
    // Ký tự lạ phải bị lọc, không được ghép thẳng vào tên phân vùng.
    assert.strictEqual(trinhDuyet.tenPhanVung('../../hack'), 'persist:yt-hack')
  })

  await kiem('chỉ mở được các trang liên quan tới công việc', () => {
    assert.strictEqual(trinhDuyet.duocPhepMo('https://www.youtube.com/watch?v=x'), true)
    assert.strictEqual(trinhDuyet.duocPhepMo('https://claude.ai'), true)
    assert.strictEqual(trinhDuyet.duocPhepMo('https://accounts.google.com/signin'), true)
    assert.strictEqual(trinhDuyet.duocPhepMo('https://trang-la.example.com'), false)
    assert.strictEqual(trinhDuyet.duocPhepMo('file:///etc/passwd'), false)
    assert.strictEqual(trinhDuyet.duocPhepMo('không phải url'), false)
  })

  await kiem('id tài khoản sinh ra không trùng nhau', () => {
    const a = trinhDuyet.taoIdTaiKhoan(1000, 0.1)
    const b = trinhDuyet.taoIdTaiKhoan(1001, 0.9)
    assert.notStrictEqual(a, b)
    assert.ok(/^tk[a-z0-9]+$/.test(a))
  })

  // =========================================================================
  nhom('22. Hợp đồng cài đặt')

  await kiem('mọi khoá phức tạp đều nằm trong danh sách bỏ qua của smoke', () => {
    const { CAI_DAT_MAC_DINH, KHOA_PHUC_TAP } = require('../src/store')
    for (const [khoa, gt] of Object.entries(CAI_DAT_MAC_DINH)) {
      const phucTap = Array.isArray(gt) || (gt && typeof gt === 'object')
      if (phucTap) {
        assert.ok(KHOA_PHUC_TAP.includes(khoa),
          `"${khoa}" là mảng/đối tượng nhưng thiếu trong KHOA_PHUC_TAP — smoke sẽ báo đỏ oan`)
      }
    }
  })

  await kiem('giao diện và store dùng CHUNG một danh sách khoá phức tạp', () => {
    const { KHOA_PHUC_TAP } = require('../src/store')
    const appJs = fs.readFileSync(path.join(__dirname, '..', 'ui', 'app.js'), 'utf8')
    const khop = appJs.match(/const KHOA_PHUC_TAP = \[([^\]]+)\]/)
    assert.ok(khop, 'ui/app.js phải khai báo KHOA_PHUC_TAP')
    const trongUi = khop[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
    assert.deepStrictEqual(trongUi.sort(), [...KHOA_PHUC_TAP].sort(),
      'hai danh sách lệch nhau là smoke báo sai — một bên bỏ qua, một bên không')
  })

  // =========================================================================
  nhom('23. Đọc tệp Word / văn bản / phụ đề')

  const docTepMod = require('../src/doc-tep')

  await kiem('bóc chữ Word: giữ ngắt dòng mềm, tab thành khoảng trắng', () => {
    const xml = '<w:body>' +
      '<w:p><w:r><w:t>Trước</w:t></w:r><w:br/><w:r><w:t>sau khi xuống dòng</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Cột A</w:t></w:r><w:tab/><w:r><w:t>Cột B</w:t></w:r></w:p>' +
      '</w:body>'
    // Đã làm sai một lần: thay <w:br/> thành "\n" TRƯỚC rồi mới gom nội dung
    // các thẻ <w:t>. Cái "\n" nằm ngoài thẻ <w:t> nên bị loại luôn, hai dòng
    // dính thành "Trướcsau khi xuống dòng".
    assert.strictEqual(docTepMod.xmlWordSangVanBan(xml), 'Trước\nsau khi xuống dòng\n\nCột A Cột B')
  })

  await kiem('mã trường của Word KHÔNG được lọt vào kịch bản', () => {
    const xml = '<w:body><w:p>' +
      '<w:r><w:instrText>PAGE \\* MERGEFORMAT</w:instrText></w:r>' +
      '<w:r><w:t>Chữ thật</w:t></w:r>' +
      '</w:p></w:body>'
    const ra = docTepMod.xmlWordSangVanBan(xml)
    assert.strictEqual(ra, 'Chữ thật')
    assert.ok(!ra.includes('MERGEFORMAT'), 'số trang và mục lục tự động là rác, không phải nội dung')
  })

  await kiem('giải mã thực thể XML đúng thứ tự (&amp; làm SAU cùng)', () => {
    // Giải mã &amp; trước thì "&amp;lt;" ra "<" — sai. Phải ra "&lt;".
    assert.strictEqual(docTepMod.giaiMaXML('&amp;lt;'), '&lt;')
    assert.strictEqual(docTepMod.giaiMaXML('&lt;the&gt; &quot;x&quot;'), '<the> "x"')
    assert.strictEqual(docTepMod.giaiMaXML('&#78;&#x41;'), 'NA')
  })

  await kiem('đọc được tệp .docx thật, dựng bằng jszip', async () => {
    const JSZip = require('jszip')
    const z = new JSZip()
    z.file('word/document.xml',
      '<w:body><w:p><w:r><w:t>Đoạn tiếng Việt có dấu đầy đủ.</w:t></w:r></w:p></w:body>')
    const d = thuMucTam('docx')
    const tep = path.join(d, 'thu.docx')
    fs.writeFileSync(tep, await z.generateAsync({ type: 'nodebuffer' }))

    const kq = await docTepMod.docTep(tep)
    assert.strictEqual(kq.vanBan, 'Đoạn tiếng Việt có dấu đầy đủ.')
    assert.strictEqual(kq.soTu, 7)   // Đoạn·tiếng·Việt·có·dấu·đầy·đủ.
    assert.strictEqual(kq.duoi, 'docx')
  })

  await kiem('tệp giả danh .docx và .doc đời cũ đều báo lỗi hiểu được', async () => {
    const d = thuMucTam('docx2')
    const gia = path.join(d, 'gia.docx')
    fs.writeFileSync(gia, 'đây không phải tệp zip')
    await assert.rejects(() => docTepMod.docTep(gia), (e) => e.saoDinhDang === true)

    const cu = path.join(d, 'cu.doc')
    fs.writeFileSync(cu, 'x')
    await assert.rejects(() => docTepMod.docTep(cu), (e) => /lưu thành \.docx/i.test(e.message))
  })

  await kiem('mở tệp .srt thì bóc lấy chữ, KHÔNG giữ mốc giờ', async () => {
    const d = thuMucTam('srt')
    const tep = path.join(d, 'phu-de.srt')
    fs.writeFileSync(tep, [
      '1', '00:00:01,000 --> 00:00:03,000', 'dòng thoại một', '',
      '2', '00:00:03,000 --> 00:00:05,000', 'dòng thoại hai', ''
    ].join('\n'))
    const kq = await docTepMod.docTep(tep)
    assert.ok(!/\d{2}:\d{2}/.test(kq.vanBan), 'mốc giờ phải bị bỏ')
    assert.ok(kq.vanBan.includes('dòng thoại một'))
  })

  await kiem('tệp rỗng báo rõ chứ không trả chuỗi trắng im lặng', async () => {
    const d = thuMucTam('rong')
    const tep = path.join(d, 'rong.txt')
    fs.writeFileSync(tep, '   \n\n  ')
    await assert.rejects(() => docTepMod.docTep(tep), (e) => e.rong === true)
  })

  // =========================================================================
  nhom('24. Mô tả cảnh: JSON hay prompt thường đều nhận')

  await kiem('prompt thường nhận đủ các kiểu đánh số', () => {
    const kq = promptAnh.phanTichPromptThuong(
      '[1] prompt một\n2) prompt hai\nCảnh 3: prompt ba\n4. prompt bốn')
    assert.strictEqual(kq.soDoc, 4)
    assert.strictEqual(kq.prompt[3], 'prompt ba')
    assert.strictEqual(kq.coDanhSo, true)
  })

  await kiem('không đánh số thì xếp tuần tự VÀ phải cảnh báo', () => {
    const kq = promptAnh.phanTichPromptThuong('prompt một\nprompt hai')
    assert.strictEqual(kq.soDoc, 2)
    assert.strictEqual(kq.prompt[1], 'prompt một')
    assert.ok(kq.canhBao, 'lô không đánh số mà không cảnh báo thì lô 2 sẽ đè lên lô 1')
  })

  await kiem('tự nhận dạng đúng JSON và prompt thường', () => {
    assert.strictEqual(promptAnh.phanTichTraVe('[{"so":1,"subject":"x"}]').kieu, 'json')
    assert.strictEqual(promptAnh.phanTichTraVe('[1] một prompt\n[2] prompt nữa').kieu, 'thuong')
  })

  await kiem('JSON vỡ KHÔNG được âm thầm hạ xuống đọc từng dòng', () => {
    // Hạ xuống đọc từng dòng sẽ biến một lô JSON vỡ thành hàng chục prompt rác
    // mà người dùng không hề biết.
    const kq = promptAnh.phanTichTraVe('[{"so":1,"subject":')
    assert.strictEqual(kq.kieu, 'json')
    assert.ok(kq.loi)
    assert.strictEqual(kq.soDoc, 0)
  })

  await kiem('prompt thường dùng NGUYÊN VĂN, không ghép template lần nữa', () => {
    const canh = promptAnh.catCanh('The old keeper climbed the stair.', { tuMoiCanh: 27 })
    const pr = promptAnh.taoTatCaPromptHonHop(canh, {
      promptThang: { 1: 'prompt hoàn chỉnh của tôi, 16:9' },
      khoNhanVat: [{ ten: 'keeper', moTa: 'grey beard' }]
    })
    assert.strictEqual(pr[0].prompt, 'prompt hoàn chỉnh của tôi, 16:9')
    assert.strictEqual(pr[0].dungNguyenVan, true)
    assert.ok(!pr[0].prompt.includes('grey beard'), 'ghép thêm lần nữa là chồng style hai lần')
  })

  await kiem('trộn được: cảnh nào có prompt thường dùng nguyên văn, còn lại ghép template', () => {
    const chu = 'First sentence here now. Second sentence here now. Third sentence here now.'
    const canh = promptAnh.catCanh(chu, { tuMoiCanh: 4, toiDaTu: 5 })
    assert.ok(canh.length >= 3)
    const pr = promptAnh.taoTatCaPromptHonHop(canh, { promptThang: { 2: 'prompt riêng cảnh 2' } })
    assert.strictEqual(pr[1].prompt, 'prompt riêng cảnh 2')
    assert.strictEqual(pr[1].dungNguyenVan, true)
    assert.ok(!pr[0].dungNguyenVan)
    assert.ok(pr[0].prompt.includes('cinematic'), 'cảnh không có prompt riêng vẫn phải ghép qua template')
    assert.strictEqual(promptAnh.kiemTraLienTuc(pr).ok, true)
  })

  await kiem('bản xin prompt thường nói rõ định dạng trả về và số cảnh', () => {
    const canh = promptAnh.catCanh('One sentence only here.', { tuMoiCanh: 27 })
    const p = promptAnh.taoPromptMoTaCanhThuong(canh, { loThu: 1, tongLo: 3 })
    assert.ok(p.includes('LÔ 1/3'))
    assert.ok(p.includes('[1]'))
    assert.ok(/NGUYÊN VĂN/i.test(p), 'phải nói rõ tool dùng nguyên văn, để Claude viết prompt đầy đủ')
  })

  // =========================================================================
  nhom('25. Đường dẫn API — lỗi đã làm hỏng cả màn Ý tưởng ở bản 0.1–0.3')

  await kiem('ĐƯỜNG DẪN HTTP là tên tài nguyên, KHÔNG phải tên phương thức', () => {
    // "search.list" là tên phương thức trong tài liệu Google, dùng để tra bảng
    // giá quota. Đường dẫn HTTP chỉ có "/search". Ghép thẳng tên phương thức
    // vào URL thì Google trả 404 cho MỌI lời gọi — tìm gì cũng ra 0 video.
    assert.strictEqual(ytApi.duongDanThat('search.list'), 'search')
    assert.strictEqual(ytApi.duongDanThat('videos.list'), 'videos')
    assert.strictEqual(ytApi.duongDanThat('channels.list'), 'channels')
    assert.strictEqual(ytApi.duongDanThat('playlistItems.list'), 'playlistItems')
  })

  await kiem('URL dựng ra phải trỏ đúng endpoint thật của YouTube', () => {
    const u = new URL(ytApi.ghepURL('search.list', { q: 'x', key: 'AIzaTEST' }))
    assert.strictEqual(u.origin + u.pathname, 'https://www.googleapis.com/youtube/v3/search')
    assert.strictEqual(u.searchParams.get('q'), 'x')
  })

  await kiem('KHÔNG lời gọi nào được để lọt ".list" vào đường dẫn', () => {
    // Ca kiểm thử cũ chỉ soi tham số (q, type, publishedAfter, key) — tức là
    // kiểm đúng cái mình đã nghĩ, còn chỗ sai nằm ở phần đường dẫn không ai soi.
    for (const pt of Object.keys(quotaMod.GIA)) {
      const u = new URL(ytApi.ghepURL(pt, {}))
      assert.ok(!u.pathname.includes('.list'),
        `${pt} dựng ra đường dẫn ${u.pathname} — Google sẽ trả 404`)
      assert.ok(/^\/youtube\/v3\/[A-Za-z]+$/.test(u.pathname),
        `${pt} dựng ra đường dẫn lạ: ${u.pathname}`)
    }
  })

  await kiem('bảng giá quota VẪN tra theo tên phương thức, không đổi', () => {
    // Hai thứ khác nhau và phải giữ khác nhau: tên phương thức để tra giá,
    // tên tài nguyên để dựng URL.
    assert.strictEqual(quotaMod.GIA['search.list'], 100)
    assert.strictEqual(quotaMod.GIA['videos.list'], 1)
  })

  // =========================================================================
  nhom('26. Hai lỗi nhỏ lộ ra cùng lúc trong nhật ký thật')

  await kiem('từ khóa trùng nhau chỉ khác hoa thường KHÔNG được chọn hai lần', () => {
    // Mỗi từ khóa trùng là ném đi 100 đơn vị quota để tìm lại y hệt.
    const chon = tuKhoa.chonNamTuKhoa([
      { cum: 'bible stories black', tuGoc: ['bible stories'], diem: 5 },
      { cum: 'Bible Stories Black ', tuGoc: ['black'], diem: 4.9 },
      { cum: 'blackpink', tuGoc: ['black'], diem: 4.8 },
      { cum: 'black trumpet', tuGoc: ['black'], diem: 4.7 },
      { cum: 'black american accent', tuGoc: ['black'], diem: 4.6 }
    ], 5)
    const chuan = chon.map((c) => tuKhoa.chuanHoa(c.cum))
    assert.strictEqual(new Set(chuan).size, chuan.length, 'còn từ khóa trùng: ' + chuan.join(' | '))
  })

  await kiem('không có kết quả thì soNoView phải là 0, không được undefined', async () => {
    // Thiếu trường này thì giao diện in "undefined nổ view", trông như hỏng
    // nặng trong khi chỉ là không tìm được video nào.
    const kq = await timYTuong({
      tuKhoa: ['abc'],
      caiDat: { soNgay: 14, soVideoMoiTuKhoa: 5 },
      khoa: { id: 'k1', ten: 'thử', khoa: 'AIza' },
      boDem: null,
      layJSONHam: async () => ({ items: [] })
    })
    assert.strictEqual(kq.soNoView, 0)
    assert.ok(kq.ghiChu)
  })

  await kiem('mọi từ khóa đều lỗi thì ghi chú phải chỉ sang màn Nhật ký', async () => {
    const kq = await timYTuong({
      tuKhoa: ['a', 'b'],
      caiDat: { soNgay: 14, soVideoMoiTuKhoa: 5 },
      khoa: { id: 'k1', ten: 'thử', khoa: 'AIza' },
      boDem: null,
      layJSONHam: async () => { const e = new Error('HTTP 404'); e.maHttp = 404; throw e }
    })
    assert.strictEqual(kq.dong.length, 0)
    assert.strictEqual(kq.soNoView, 0)
    assert.ok(/Nhật ký/i.test(kq.ghiChu), 'phải chỉ người dùng tới chỗ xem được lý do thật')
  })

  // =========================================================================
  // BẢN 0.4.0
  // =========================================================================
  const thumbMod = require('../src/thumbnail')
  const chonMod = require('../src/video-da-chon')
  const radarMod = require('../src/radar-de-xuat')
  const { chayRadar, videoTuTrang, ghepSoLieuApi } = require('../src/chay-radar')
  const storeMod = require('../src/store')

  nhom('27. Gợi ý từ khóa theo người xem MỸ')

  // Bài học của lỗi 404: khẳng định NGUYÊN VĂN chuỗi gửi đi, không chỉ vài mảnh.
  await kiem('URL gợi ý khẳng định nguyên văn — có gl=us', () => {
    assert.strictEqual(goiMang.urlGoiY('trump bible'),
      'https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&gl=us&q=trump%20bible')
  })

  await kiem('layGoiY truyền gl xuống URL thật', async () => {
    let urlDaGoi = ''
    await goiMang.layGoiY('bible', { layChuHam: async (u) => { urlDaGoi = u; return '["bible",[]]' } })
    assert.ok(urlDaGoi.includes('&gl=us&'), urlDaGoi)
  })

  nhom('28. Ưu tiên kênh vừa & nhỏ (1.000–100.000 sub)')

  await kiem('phân loại cỡ kênh đúng ở các mốc biên', () => {
    const c = (n, an) => chamDiem.coKenh(n, {}, an)
    assert.strictEqual(c(999), 'tiHon')
    assert.strictEqual(c(1000), 'vuaNho')
    assert.strictEqual(c(100000), 'vuaNho')
    assert.strictEqual(c(100001), 'lon')
    assert.strictEqual(c(0), 'an', 'kênh 0 sub (thường là ẩn sub) không được coi là tí hon')
    assert.strictEqual(c(50000, true), 'an', 'kênh ẩn sub: không biết thì không cộng không trừ')
  })

  await kiem('khoảng sub đọc từ cài đặt, không cứng trong code', () => {
    assert.strictEqual(chamDiem.coKenh(150000, { subToiThieu: 1000, subToiDa: 200000 }), 'vuaNho')
  })

  await kiem('kênh vừa & nhỏ +0,5, kênh lớn −0,6 so với khi tắt ưu tiên', () => {
    const bayGio = Date.parse('2026-09-22T00:00:00Z')
    const ds = [
      { videoId: 'nho', views: 200000, ngayDang: '2026-09-20T00:00:00Z', subKenh: 50000 },
      { videoId: 'lon', views: 300000, ngayDang: '2026-09-20T00:00:00Z', subKenh: 5e6 }
    ]
    const bat = chamDiem.chamDiem(ds, { bayGio, caiDat: {} })
    const tat = chamDiem.chamDiem(ds, { bayGio, caiDat: { uuTienKenhVuaNho: false } })
    const lech = (id) => Math.round((bat.find((r) => r.videoId === id).diem - tat.find((r) => r.videoId === id).diem) * 100) / 100
    assert.strictEqual(lech('nho'), 0.5)
    assert.strictEqual(lech('lon'), -0.6)
    assert.strictEqual(bat[0].videoId, 'nho', 'kênh nhỏ nổ view phải xếp trên kênh lớn')
    assert.strictEqual(bat.find((r) => r.videoId === 'nho').coKenh, 'vuaNho')
  })

  await kiem('kênh khai quốc gia khác Mỹ −0,4; kênh để trống KHÔNG bị trừ', () => {
    const bayGio = Date.parse('2026-09-22T00:00:00Z')
    const goc = { views: 100000, ngayDang: '2026-09-20T00:00:00Z', subKenh: 40000 }
    const ra = chamDiem.chamDiem([
      { ...goc, videoId: 'vn', quocGia: 'VN' },
      { ...goc, videoId: 'trong', quocGia: '' },
      { ...goc, videoId: 'us', quocGia: 'US' }
    ], { bayGio })
    const d = (id) => ra.find((r) => r.videoId === id).diem
    assert.strictEqual(Math.round((d('us') - d('vn')) * 100) / 100, 0.4)
    assert.strictEqual(d('us'), d('trong'))
  })

  await kiem('lọc tiếng Anh: bỏ "vi", giữ "en-US" và giữ video không khai', () => {
    const ra = chamDiem.locVideo([
      { videoId: 'vi', thoiLuongGiay: 1800, views: 1e5, ngonNguAm: 'vi' },
      { videoId: 'enus', thoiLuongGiay: 1800, views: 1e5, ngonNguAm: 'en-US' },
      { videoId: 'trong', thoiLuongGiay: 1800, views: 1e5, ngonNguAm: '' },
      { videoId: 'hi', thoiLuongGiay: 1800, views: 1e5, ngonNguAm: '', ngonNgu: 'hi' }
    ], {})
    assert.deepStrictEqual(ra.map((r) => r.videoId), ['enus', 'trong'])
  })

  await kiem('loại hẳn kênh ngoài khoảng sub chỉ khi bật, và GIỮ kênh ẩn sub', () => {
    const ds = [
      { videoId: 'lon', thoiLuongGiay: 1800, views: 1e5, subKenh: 2e6 },
      { videoId: 'tiHon', thoiLuongGiay: 1800, views: 1e5, subKenh: 300 },
      { videoId: 'vua', thoiLuongGiay: 1800, views: 1e5, subKenh: 30000 },
      { videoId: 'an', thoiLuongGiay: 1800, views: 1e5, subKenh: 0, anSub: true }
    ]
    assert.strictEqual(chamDiem.locVideo(ds, {}).length, 4, 'mặc định chỉ trừ điểm, không loại')
    assert.deepStrictEqual(chamDiem.locVideo(ds, { chiKenhVuaNho: true }).map((r) => r.videoId), ['vua', 'an'])
  })

  await kiem('loại hẳn kênh ngoài Mỹ chỉ khi bật chiKenhMy', () => {
    const ds = [
      { videoId: 'in', thoiLuongGiay: 1800, views: 1e5, quocGia: 'IN' },
      { videoId: 'us', thoiLuongGiay: 1800, views: 1e5, quocGia: 'US' },
      { videoId: 'trong', thoiLuongGiay: 1800, views: 1e5, quocGia: '' }
    ]
    assert.strictEqual(chamDiem.locVideo(ds, {}).length, 3)
    assert.deepStrictEqual(chamDiem.locVideo(ds, { chiKenhMy: true }).map((r) => r.videoId), ['us', 'trong'])
  })

  await kiem('khoá cũ subToiDaTrieu bị bỏ khi đọc — không được lọc ngầm', () => {
    const d = thuMucTam('khoa-cu')
    fs.writeFileSync(path.join(d, 'cai-dat.json'), JSON.stringify({ subToiDaTrieu: 5, soNgay: 7 }))
    const cd = storeMod.taoKho(d).docCaiDat()
    assert.ok(!('subToiDaTrieu' in cd), 'khoá cũ vẫn còn trong cài đặt')
    assert.strictEqual(cd.soNgay, 7, 'các khoá khác phải giữ nguyên')
    assert.strictEqual(cd.subToiThieu, 1000)
    assert.strictEqual(cd.subToiDa, 100000)
  })

  await kiem('timYTuong gắn quốc gia + ẩn sub của kênh và áp ưu tiên kênh nhỏ', async () => {
    const layJSONHam = async (url) => {
      const u = new URL(url)
      if (u.pathname.endsWith('/search')) return { items: [{ id: { videoId: 'aaaaaaaaaaa' } }, { id: { videoId: 'bbbbbbbbbbb' } }] }
      if (u.pathname.endsWith('/videos')) {
        return {
          items: ['aaaaaaaaaaa', 'bbbbbbbbbbb'].map((id, i) => ({
            id,
            snippet: { title: 't' + i, channelId: 'UC' + i, channelTitle: 'k' + i, publishedAt: '2026-09-20T00:00:00Z', defaultAudioLanguage: 'en' },
            statistics: { viewCount: '100000' },
            contentDetails: { duration: 'PT30M' }
          }))
        }
      }
      if (u.pathname.endsWith('/channels')) {
        return { items: [
          { id: 'UC0', snippet: { title: 'k0', country: 'us' }, statistics: { subscriberCount: '20000' }, contentDetails: { relatedPlaylists: { uploads: '' } } },
          { id: 'UC1', snippet: { title: 'k1' }, statistics: { subscriberCount: '0', hiddenSubscriberCount: true }, contentDetails: { relatedPlaylists: { uploads: '' } } }
        ] }
      }
      return { items: [] }
    }
    const kq = await timYTuong({
      tuKhoa: ['x'], caiDat: { soNgay: 14, soVideoMoiTuKhoa: 5, viewToiThieu: 0 },
      khoa: { id: 'k1', ten: 'thử', khoa: 'AIza' }, boDem: null, layJSONHam
    })
    const a = kq.dong.find((d) => d.videoId === 'aaaaaaaaaaa')
    const b = kq.dong.find((d) => d.videoId === 'bbbbbbbbbbb')
    assert.strictEqual(a.quocGia, 'US', 'quốc gia phải viết hoa để so với "US"')
    assert.strictEqual(a.coKenh, 'vuaNho')
    assert.strictEqual(b.anSub, true)
    assert.strictEqual(b.coKenh, 'an')
  })

  nhom('29. Thumbnail — lấy từ API và tải về')

  await kiem('videos.list: thumbnail maxres khi có, lùi xuống high khi thiếu', async () => {
    const khach = ytApi.taoKhachHang({
      khoa: 'AIza', idKhoa: 'k',
      layJSONHam: async () => ({ items: [
        { id: 'aaaaaaaaaaa', snippet: { thumbnails: { maxres: { url: 'https://i.ytimg.com/vi/aaaaaaaaaaa/maxresdefault.jpg' }, medium: { url: 'M' } } }, statistics: {}, contentDetails: {} },
        { id: 'bbbbbbbbbbb', snippet: { thumbnails: { high: { url: 'https://i.ytimg.com/vi/bbbbbbbbbbb/hqdefault.jpg' } }, defaultAudioLanguage: 'en-US' }, statistics: {}, contentDetails: {} }
      ] })
    })
    const [a, b] = await khach.soLieuVideo(['aaaaaaaaaaa', 'bbbbbbbbbbb'])
    assert.strictEqual(a.thumbnail, 'https://i.ytimg.com/vi/aaaaaaaaaaa/maxresdefault.jpg')
    assert.strictEqual(a.thumbnailNho, 'M')
    assert.strictEqual(b.thumbnail, 'https://i.ytimg.com/vi/bbbbbbbbbbb/hqdefault.jpg')
    assert.strictEqual(b.thumbnailNho, 'https://i.ytimg.com/vi/bbbbbbbbbbb/mqdefault.jpg', 'thiếu medium thì dựng URL mq')
    assert.strictEqual(b.ngonNguAm, 'en-US')
  })

  await kiem('thứ tự URL thử: URL của API trước, rồi maxres → sd → hq → mq', () => {
    assert.deepStrictEqual(thumbMod.cacUrlThu({ videoId: 'abcdefghijk', thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg' }), [
      'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
      'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg',
      'https://i.ytimg.com/vi/abcdefghijk/sddefault.jpg',
      'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg'
    ])
  })

  await kiem('không tin URL thumbnail lạ (không phải ytimg)', () => {
    const ds = thumbMod.cacUrlThu({ videoId: 'abcdefghijk', thumbnail: 'https://evil.example/x.jpg' })
    assert.ok(ds.every((u) => u.startsWith('https://i.ytimg.com/')))
  })

  await kiem('tên tệp an toàn trên Windows, có số thứ tự 3 chữ số và mã video', () => {
    const ten = thumbMod.tenTepThumbnail({ videoId: 'abcdefghijk', tieuDe: 'What: "God" said <to> Moses? / Part 1*|. ' }, 7, 40)
    assert.ok(!/[<>:"/\\|?*]/.test(ten), ten)
    assert.ok(ten.startsWith('007 - '), ten)
    assert.ok(ten.endsWith(' [abcdefghijk].jpg'), ten)
    assert.ok(!/\.\s*\[/.test(ten), 'không được có dấu chấm cuối tên trước [id] — Windows cắt mất')
  })

  await kiem('maxres 404 → lùi sang sddefault; ảnh xám 200 nhưng quá nhỏ cũng phải bỏ qua', async () => {
    const d = thuMucTam('thumb')
    const daGoi = []
    const kq = await thumbMod.taiMotThumbnail({ videoId: 'abcdefghijk', tieuDe: 'A' }, d, 1, {
      layNhiPhanHam: async (u) => {
        daGoi.push(u)
        if (u.includes('maxres')) return { ok: false, maHttp: 404, du: Buffer.alloc(1100) }
        if (u.includes('sddefault')) return { ok: true, maHttp: 200, du: Buffer.alloc(900) } // ảnh xám
        return { ok: true, maHttp: 200, du: Buffer.alloc(30000, 1) }
      }
    })
    assert.strictEqual(kq.ok, true)
    assert.ok(kq.url.includes('hqdefault'), 'phải bỏ qua ảnh xám sddefault')
    assert.strictEqual(fs.statSync(kq.duongDan).size, 30000)
    assert.strictEqual(daGoi.length, 3)
  })

  await kiem('mọi cỡ đều hỏng thì báo lỗi rõ, không ghi tệp rỗng', async () => {
    const d = thuMucTam('thumb-hong')
    const kq = await thumbMod.taiMotThumbnail({ videoId: 'abcdefghijk' }, d, 1, {
      layNhiPhanHam: async () => ({ ok: false, maHttp: 404, du: Buffer.alloc(0) })
    })
    assert.strictEqual(kq.ok, false)
    assert.ok(/HTTP 404/.test(kq.loi))
    assert.strictEqual(fs.readdirSync(d).length, 0)
  })

  await kiem('tải nhiều ảnh: đánh số liên tục, video lỗi không làm hỏng video khác', async () => {
    const d = thuMucTam('thumb-nhieu')
    const kq = await thumbMod.taiNhieuThumbnail([
      { videoId: 'aaaaaaaaaaa', tieuDe: 'Một' },
      { videoId: 'bbbbbbbbbbb', tieuDe: 'Hai' },
      { videoId: 'ccccccccccc', tieuDe: 'Ba' }
    ], d, {
      layNhiPhanHam: async (u) => (u.includes('bbbbbbbbbbb')
        ? { ok: false, maHttp: 404, du: Buffer.alloc(0) }
        : { ok: true, maHttp: 200, du: Buffer.alloc(9000, 2) })
    })
    assert.strictEqual(kq.ketQua.length, 2)
    assert.strictEqual(kq.loi.length, 1)
    const cac = fs.readdirSync(d).sort()
    assert.ok(cac[0].startsWith('001 - Một'), cac.join(' | '))
    assert.ok(cac[1].startsWith('003 - Ba'), 'số thứ tự theo vị trí trong danh sách, không dồn số')
  })

  await kiem('CSP của giao diện cho phép ảnh từ i.ytimg.com (thiếu là ảnh vỡ im lặng)', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8')
    const csp = (html.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || ''
    assert.ok(/img-src[^;]*https:\/\/i\.ytimg\.com/.test(csp), csp)
    assert.ok(/img-src[^;]*data:/.test(csp), 'ảnh mẫu kiểm thử tầng 2 cần data:')
  })

  nhom('30. Danh sách "Video đã chọn"')

  await kiem('thêm bỏ trùng theo videoId, giữ vị trí cũ nhưng cập nhật số view', () => {
    let ds = chonMod.themVao([], [{ videoId: 'aaaaaaaaaaa', tieuDe: 'A', views: 10 }, { videoId: 'bbbbbbbbbbb', tieuDe: 'B' }], 'Ý tưởng')
    ds = chonMod.themVao(ds, [{ videoId: 'aaaaaaaaaaa', tieuDe: 'A', views: 99 }], 'Radar')
    assert.deepStrictEqual(ds.map((v) => v.videoId), ['aaaaaaaaaaa', 'bbbbbbbbbbb'])
    assert.strictEqual(ds[0].views, 99)
    assert.strictEqual(ds[0].nguon, 'Ý tưởng', 'nguồn ban đầu không bị ghi đè')
  })

  await kiem('bỏ qua mã video không hợp lệ', () => {
    const ds = chonMod.themVao([], [{ videoId: 'ngan' }, { videoId: '' }, null, { videoId: 'aaaaaaaaaaa' }])
    assert.deepStrictEqual(ds.map((v) => v.videoId), ['aaaaaaaaaaa'])
  })

  await kiem('vượt trần thì bỏ video thêm sớm nhất', () => {
    const nhieu = Array.from({ length: chonMod.TOI_DA + 5 }, (_, i) => ({ videoId: ('v' + String(i).padStart(10, '0')).slice(0, 11) }))
    const ds = chonMod.themVao([], nhieu)
    assert.strictEqual(ds.length, chonMod.TOI_DA)
    assert.strictEqual(ds[0].videoId, nhieu[5].videoId)
  })

  await kiem('danh sách link nguyên văn, mỗi dòng một link', () => {
    assert.strictEqual(chonMod.danhSachLink([{ videoId: 'aaaaaaaaaaa' }, { videoId: 'bbbbbbbbbbb' }]),
      'https://www.youtube.com/watch?v=aaaaaaaaaaa\nhttps://www.youtube.com/watch?v=bbbbbbbbbbb')
  })

  await kiem('lưu ra tệp RIÊNG, không đụng cai-dat.json, đọc lại đúng', () => {
    const d = thuMucTam('chon')
    chonMod.ghi(d, [{ videoId: 'aaaaaaaaaaa', tieuDe: 'A', views: 5 }, { videoId: 'xx' }])
    assert.ok(fs.existsSync(path.join(d, 'video-da-chon.json')))
    assert.ok(!fs.existsSync(path.join(d, 'cai-dat.json')), 'không được ghi vào tệp cài đặt')
    const lai = chonMod.doc(d)
    assert.deepStrictEqual(lai.map((v) => v.videoId), ['aaaaaaaaaaa'])
    assert.strictEqual(lai[0].views, 5)
  })

  await kiem('tệp hỏng thì trả danh sách rỗng, không vỡ app', () => {
    const d = thuMucTam('chon-hong')
    fs.writeFileSync(path.join(d, 'video-da-chon.json'), '{hỏng')
    assert.deepStrictEqual(chonMod.doc(d), [])
  })

  await kiem('prompt dàn ý có khối VIDEO THAM KHẢO khi có, và không có khi không', () => {
    const co = kichBanMod.taoPromptDanY({ yeuCau: { videoThamKhao: [{ tieuDe: 'The Lost Scroll', tenKenh: 'K', views: 120000, phut: 60 }] } })
    const khong = kichBanMod.taoPromptDanY({})
    assert.ok(co.includes('VIDEO THAM KHẢO'))
    assert.ok(co.includes('"The Lost Scroll" — K · 120,000 views · 60 min'))
    assert.ok(/không chép tiêu đề/i.test(co), 'phải dặn rõ không chép')
    assert.ok(!khong.includes('VIDEO THAM KHẢO'))
  })

  nhom('31. Bảng Thịnh hành: phân trang và danh mục không có bảng')

  await kiem('120 video = 3 trang 50/50/20, đường dẫn là /videos, có pageToken', async () => {
    const daGoi = []
    const khach = ytApi.taoKhachHang({
      khoa: 'AIza', idKhoa: 'k',
      layJSONHam: async (url) => {
        daGoi.push(new URL(url))
        const n = Number(new URL(url).searchParams.get('maxResults'))
        return { items: Array.from({ length: n }, (_, i) => ({ id: `v${daGoi.length}_${i}`.padEnd(11, 'x'), snippet: {}, statistics: {}, contentDetails: {} })), nextPageToken: 'T' + daGoi.length }
      }
    })
    const ra = await khach.videoThinhHanh({ soLuong: 120, danhMuc: '27' })
    assert.strictEqual(ra.length, 120)
    assert.deepStrictEqual(daGoi.map((u) => u.searchParams.get('maxResults')), ['50', '50', '20'])
    assert.ok(daGoi.every((u) => u.pathname === '/youtube/v3/videos'))
    assert.strictEqual(daGoi[1].searchParams.get('pageToken'), 'T1')
    assert.strictEqual(daGoi[0].searchParams.get('videoCategoryId'), '27')
    assert.strictEqual(daGoi[0].searchParams.get('chart'), 'mostPopular')
  })

  await kiem('404 videoChartNotFound KHÔNG bị báo là "lỗi của tool"', async () => {
    const khach = ytApi.taoKhachHang({
      khoa: 'AIza', idKhoa: 'k',
      layJSONHam: async () => { const e = new Error('HTTP 404'); e.maHttp = 404; e.than = '{"error":{"errors":[{"reason":"videoChartNotFound"}]}}'; throw e }
    })
    await assert.rejects(() => khach.videoThinhHanh({ danhMuc: '10' }), (e) => e.khongCoBang && !/lỗi của tool/i.test(e.message))
  })

  await kiem('channels.list: quốc gia viết hoa + cờ ẩn sub', async () => {
    const khach = ytApi.taoKhachHang({
      khoa: 'AIza', idKhoa: 'k',
      layJSONHam: async () => ({ items: [{ id: 'UC1', snippet: { title: 'K', country: 'gb' }, statistics: { subscriberCount: '0', hiddenSubscriberCount: true }, contentDetails: {} }] })
    })
    const k = (await khach.soLieuKenh(['UC1'])).get('UC1')
    assert.strictEqual(k.quocGia, 'GB')
    assert.strictEqual(k.anSub, true)
  })

  nhom('32. Radar đề xuất — URL, bộ lọc tìm kiếm, đọc ytInitialData')

  await kiem('bộ lọc sp dựng từ byte: tuần/tháng + lượt xem + chỉ video', () => {
    assert.strictEqual(radarMod.spTimKiem({ thoiGian: 'tuan', sapXep: 'luot-xem' }), 'CAMSBAgDEAE=')
    assert.strictEqual(radarMod.spTimKiem({ thoiGian: 'thang', sapXep: 'luot-xem' }), 'CAMSBAgEEAE=')
    assert.strictEqual(radarMod.spTimKiem({ thoiGian: '', sapXep: 'lien-quan' }), 'EgIQAQ==')
  })

  await kiem('URL radar khẳng định nguyên văn, luôn có hl=en&gl=US', () => {
    assert.strictEqual(radarMod.urlTimKiem('bible stories', { thoiGian: 'thang' }),
      'https://www.youtube.com/results?search_query=bible%20stories&sp=CAMSBAgEEAE%3D&hl=en&gl=US')
    assert.strictEqual(radarMod.urlXem('abcdefghijk'), 'https://www.youtube.com/watch?v=abcdefghijk&hl=en&gl=US')
    assert.strictEqual(radarMod.urlTrangChu(), 'https://www.youtube.com/?hl=en&gl=US')
  })

  await kiem('đọc số view dạng chữ tiếng Anh', () => {
    assert.strictEqual(radarMod.docSoView('1,234,567 views'), 1234567)
    assert.strictEqual(radarMod.docSoView('1.2M views'), 1200000)
    assert.strictEqual(radarMod.docSoView('12K views'), 12000)
    assert.strictEqual(radarMod.docSoView('No views'), 0)
    assert.strictEqual(radarMod.docSoView(''), 0)
  })

  await kiem('đọc thời lượng H:MM:SS / M:SS', () => {
    assert.strictEqual(radarMod.docThoiLuong('1:02:03'), 3723)
    assert.strictEqual(radarMod.docThoiLuong('12:34'), 754)
    assert.strictEqual(radarMod.docThoiLuong('LIVE'), 0)
  })

  // Dữ liệu mẫu theo đúng hai dạng YouTube đang dùng: renderer cũ và lockupViewModel mới.
  const mauXem = {
    contents: { twoColumnWatchNextResults: {
      results: { results: { contents: [{ videoRenderer: { videoId: 'KHONGLAYxxx', title: { simpleText: 'danh sách phát, không phải đề xuất' } } }] } },
      secondaryResults: { secondaryResults: { results: [
        { compactVideoRenderer: { videoId: 'aaaaaaaaaaa', title: { simpleText: 'Old Testament Secrets' }, longBylineText: { runs: [{ text: 'Kenh A' }] }, viewCountText: { simpleText: '1,200 views' }, lengthText: { simpleText: '42:10' } } },
        { lockupViewModel: { contentId: 'bbbbbbbbbbb', contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
          contentImage: { thumbnailViewModel: { overlays: [{ thumbnailOverlayBadgeViewModel: { thumbnailBadges: [{ thumbnailBadgeViewModel: { text: '1:05:00' } }] } }] } },
          metadata: { lockupMetadataViewModel: { title: { content: 'The Book They Removed' },
            metadata: { contentMetadataViewModel: { metadataRows: [
              { metadataParts: [{ text: { content: 'Kenh B' } }] },
              { metadataParts: [{ text: { content: '2.3M views' } }, { text: { content: '3 days ago' } }] }
            ] } } } } } },
        { lockupViewModel: { contentId: 'PLdanhsachphat', contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST' } },
        { reelItemRenderer: { videoId: 'shortsxxxxx' } },
        { compactVideoRenderer: { videoId: 'aaaaaaaaaaa', title: { simpleText: 'trùng' } } },
        { compactVideoRenderer: { videoId: 'hatgiongxxx', title: { simpleText: 'chính video đang xem' } } },
        { compactVideoRenderer: { videoId: 'ngan0000000', title: { simpleText: 'short lọt' }, lengthText: { simpleText: '0:45' } } }
      ] } }
    } }
  }

  await kiem('trang xem: chỉ lấy CỘT ĐỀ XUẤT, đọc được cả renderer cũ lẫn lockup mới', () => {
    const khoi = radarMod.khoiDeXuatTrangXem(mauXem)
    const ds = radarMod.rutVideoTuDuLieu(khoi, { boQuaId: 'hatgiongxxx' })
    assert.deepStrictEqual(ds.map((v) => v.videoId), ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ngan0000000'])
    assert.deepStrictEqual(ds.map((v) => v.viTri), [1, 2, 3], 'vị trí phải liên tục sau khi bỏ trùng')
    const b = ds[1]
    assert.strictEqual(b.tieuDe, 'The Book They Removed')
    assert.strictEqual(b.tenKenh, 'Kenh B')
    assert.strictEqual(b.viewUoc, 2300000)
    assert.strictEqual(b.thoiLuongGiay, 3900)
    assert.strictEqual(ds[0].thoiLuongGiay, 2530)
  })

  await kiem('bỏ qua Shorts, playlist, video trùng và chính video hạt giống', () => {
    const ds = radarMod.rutVideoTuDuLieu(radarMod.khoiDeXuatTrangXem(mauXem), { boQuaId: 'hatgiongxxx' })
    const ids = ds.map((v) => v.videoId)
    assert.ok(!ids.includes('shortsxxxxx'))
    assert.ok(!ids.includes('KHONGLAYxxx'), 'danh sách phát bên trái không phải đề xuất')
    assert.ok(!ids.some((i) => i.startsWith('PL')))
    assert.ok(!ids.includes('hatgiongxxx'))
  })

  await kiem('tổng hợp: đếm theo NGUỒN, không đếm trùng trong cùng một nguồn', () => {
    const v = (id, viTri) => ({ videoId: id, viTri, tieuDe: id, viewUoc: 0, thoiLuongGiay: 1800 })
    const ra = radarMod.tongHop([
      { loai: 'xem', nguon: 's1', video: [v('xxxxxxxxxxx', 1), v('yyyyyyyyyyy', 2)] },
      { loai: 'xem', nguon: 's1', video: [v('xxxxxxxxxxx', 1)] },
      { loai: 'xem', nguon: 's2', video: [v('xxxxxxxxxxx', 3)] },
      { loai: 'xem', nguon: 's3', video: [v('xxxxxxxxxxx', 2)] },
      { loai: 'trangChu', nguon: 'trang-chu', video: [v('zzzzzzzzzzz', 1)] }
    ])
    const x = ra.find((r) => r.videoId === 'xxxxxxxxxxx')
    assert.strictEqual(x.soNguon, 3)
    assert.strictEqual(x.tongNguon, 4)
    assert.strictEqual(x.nhanDeXuat, 'ĐẨY MẠNH')
    assert.strictEqual(ra[0].videoId, 'xxxxxxxxxxx')
    const z = ra.find((r) => r.videoId === 'zzzzzzzzzzz')
    assert.strictEqual(z.trenTrangChu, true)
    assert.strictEqual(z.diemDeXuat, 1.5, 'trang chủ vị trí 1 nặng 1,5')
    assert.strictEqual(ra.find((r) => r.videoId === 'yyyyyyyyyyy').nhanDeXuat, 'CÓ ĐỀ XUẤT')
  })

  await kiem('ngưỡng ĐẨY MẠNH co giãn theo số nguồn (ít nhất 3, hoặc 35%)', () => {
    assert.strictEqual(radarMod.nhanDeXuat(3, 8), 'ĐẨY MẠNH')
    assert.strictEqual(radarMod.nhanDeXuat(3, 12), 'MẠNH')
    assert.strictEqual(radarMod.nhanDeXuat(5, 12), 'ĐẨY MẠNH')
    assert.strictEqual(radarMod.nhanDeXuat(2, 2), 'MẠNH', '2/2 nguồn chưa đủ gọi là đẩy mạnh')
  })

  await kiem('khớp lĩnh vực: trùng cụm thì khớp, một chữ lẻ thì không', () => {
    const lv = radarMod.tachTuLinhVuc('bible stories, old testament')
    assert.strictEqual(radarMod.khopLinhVuc('10 Bible Stories You Never Heard', lv), true)
    assert.strictEqual(radarMod.khopLinhVuc('The Old Testament Explained', lv), true)
    assert.strictEqual(radarMod.khopLinhVuc('Best Stories Of 2026', lv), false)
    assert.strictEqual(radarMod.khopLinhVuc('Bible Story Time: Moses', lv), true, 'bible + story số ít vẫn đủ 2 từ')
  })

  await kiem('chọn hạt giống xen kẽ giữa các từ khóa, bỏ Shorts, ưu tiên video đã chọn', () => {
    const t1 = [{ videoId: 'a1' }, { videoId: 'a2' }, { videoId: 'a3' }]
    const t2 = [{ videoId: 'b1', thoiLuongGiay: 30 }, { videoId: 'b2' }]
    assert.deepStrictEqual(radarMod.chonHatGiong([t1, t2], 4, { daCo: ['z9'] }), ['z9', 'a1', 'a2', 'b2'])
  })

  await kiem('nhận ra trang xác minh / đăng nhập', () => {
    assert.ok(radarMod.laTrangChan('https://consent.youtube.com/m?continue=x'))
    assert.ok(radarMod.laTrangChan('https://www.google.com/sorry/index?continue=x'))
    assert.ok(!radarMod.laTrangChan('https://www.youtube.com/watch?v=abcdefghijk'))
  })

  await kiem('script tiêm vào trang: hàm tự gọi, không arrow, không strict, trả chuỗi JSON', () => {
    for (const loai of ['xem', 'tim', 'trangChu']) {
      const sc = trinhDuyet.scriptDocTrang(loai)
      assert.ok(sc.startsWith('(function () {'))
      assert.ok(!sc.includes('=>'), 'không được dùng arrow')
      assert.ok(!/use strict/.test(sc))
      assert.ok(sc.includes('JSON.stringify'))
      new Function(sc) // cú pháp hợp lệ
    }
  })

  nhom('33. Radar đề xuất — cả chuỗi với trình đọc giả')

  const trangTim = (ids) => ({ coDuLieu: true, url: 'https://www.youtube.com/results', idDom: [],
    khoi: { x: ids.map((id) => ({ videoRenderer: { videoId: id, title: { runs: [{ text: 'Bible Stories ' + id }] }, lengthText: { simpleText: '30:00' } } })) } })
  const trangXem = (ids) => ({ coDuLieu: true, url: 'https://www.youtube.com/watch', idDom: [],
    khoi: { secondaryResults: { results: ids.map((id, i) => ({ compactVideoRenderer: { videoId: id, title: { simpleText: 'Bible Stories ' + id }, lengthText: { simpleText: '25:00' }, viewCountText: { simpleText: `${(i + 1) * 1000} views` } } })) } } })

  await kiem('gọi đúng thứ tự: trang tìm → trang xem từng hạt giống → trang chủ; tổng hợp đúng', async () => {
    const daMo = []
    const kq = await chayRadar({
      tuKhoaLinhVuc: 'bible stories',
      soHatGiong: 3,
      docTrangChu: true,
      ngu: async () => {},
      docTrang: async (url, { loai }) => {
        daMo.push(loai + ' ' + url)
        if (loai === 'tim') return trangTim(['s0000000001', 's0000000002', 's0000000003', 's0000000004'])
        if (loai === 'xem') return trangXem(['hothothot01', 'binhthuong1', 'x' + url.slice(-24, -14)])
        return trangXem(['hothothot01'])
      }
    })
    assert.deepStrictEqual(daMo.map((m) => m.split(' ')[0]), ['tim', 'xem', 'xem', 'xem', 'trangChu'])
    assert.ok(daMo[0].endsWith('search_query=bible%20stories&sp=CAMSBAgEEAE%3D&hl=en&gl=US'), daMo[0])
    assert.ok(daMo[1].endsWith('watch?v=s0000000001&hl=en&gl=US'), daMo[1])
    assert.deepStrictEqual(kq.hatGiong, ['s0000000001', 's0000000002', 's0000000003'])
    const hot = kq.dong.find((d) => d.videoId === 'hothothot01')
    assert.strictEqual(hot.soNguon, 4, '3 cột đề xuất + trang chủ')
    assert.strictEqual(hot.nhanDeXuat, 'ĐẨY MẠNH')
    assert.strictEqual(kq.dong[0].videoId, 'hothothot01')
    assert.strictEqual(hot.khopLinhVuc, true)
  })

  await kiem('ytInitialData hỏng thì lùi về mã video đọc từ thẻ <a>', () => {
    const ds = videoTuTrang({ coDuLieu: true, khoi: null, idDom: ['aaaaaaaaaaa', 'hatgiongxxx', 'bbbbbbbbbbb'] }, 'xem', { boQuaId: 'hatgiongxxx' })
    assert.deepStrictEqual(ds.map((v) => v.videoId), ['aaaaaaaaaaa', 'bbbbbbbbbbb'])
    assert.deepStrictEqual(ds.map((v) => v.viTri), [1, 2])
  })

  await kiem('YouTube bắt xác minh thì DỪNG và nói rõ cách xử lý', async () => {
    await assert.rejects(() => chayRadar({
      tuKhoaLinhVuc: 'bible', soHatGiong: 2, docTrangChu: false, ngu: async () => {},
      docTrang: async () => ({ coDuLieu: false, url: 'https://www.google.com/sorry/index?x=1', khoi: null, idDom: [] })
    }), /xác minh.*Trình duyệt/s)
  })

  await kiem('một hạt giống lỗi không làm hỏng cả lượt, lỗi được ghi vào cảnh báo', async () => {
    let lan = 0
    const kq = await chayRadar({
      tuKhoaLinhVuc: 'bible stories', soHatGiong: 2, docTrangChu: false, ngu: async () => {},
      docTrang: async (url, { loai }) => {
        if (loai === 'tim') return trangTim(['s0000000001', 's0000000002'])
        lan++
        if (lan === 1) throw new Error('quá thời gian tải trang')
        return trangXem(['aaaaaaaaaaa'])
      }
    })
    assert.strictEqual(kq.dong.length, 1)
    assert.ok(kq.canhBao.some((c) => /quá thời gian/.test(c)))
  })

  await kiem('ghép số liệu API: lọc video không phải tiếng Anh, giữ dòng chưa có số liệu', () => {
    const dongRadar = [
      { videoId: 'aaaaaaaaaaa', diemDeXuat: 3, soNguon: 3, tongNguon: 4, nhanDeXuat: 'ĐẨY MẠNH', nguon: ['s1'], viewUoc: 1 },
      { videoId: 'bbbbbbbbbbb', diemDeXuat: 2, soNguon: 2, tongNguon: 4, nhanDeXuat: 'MẠNH', nguon: ['s1'], viewUoc: 1 },
      { videoId: 'ccccccccccc', diemDeXuat: 1, soNguon: 1, tongNguon: 4, nhanDeXuat: 'CÓ ĐỀ XUẤT', nguon: ['s2'], viewUoc: 777 }
    ]
    const api = [
      { videoId: 'aaaaaaaaaaa', kenhId: 'UC1', views: 90000, ngayDang: '2026-09-20T00:00:00Z', thoiLuongGiay: 1800, ngonNguAm: 'en' },
      { videoId: 'bbbbbbbbbbb', kenhId: 'UC1', views: 50000, ngayDang: '2026-09-20T00:00:00Z', thoiLuongGiay: 1800, ngonNguAm: 'es' }
    ]
    const bangKenh = new Map([['UC1', { subKenh: 20000, quocGia: 'US', anSub: false }]])
    const ra = ghepSoLieuApi(dongRadar, api, bangKenh, {}, { bayGio: Date.parse('2026-09-22T00:00:00Z') })
    assert.deepStrictEqual(ra.map((r) => r.videoId), ['aaaaaaaaaaa', 'ccccccccccc'])
    assert.strictEqual(ra[0].coKenh, 'vuaNho')
    assert.strictEqual(ra[0].nhanDeXuat, 'ĐẨY MẠNH', 'nhãn radar không được mất khi ghép')
    assert.deepStrictEqual(ra[0].nguon, ['s1'])
    assert.strictEqual(ra[1].coSoLieuApi, false)
    assert.strictEqual(ra[1].views, 777, 'không có API thì dùng số view ước từ trang')
  })

  // =========================================================================
  nhom('34. Cảnh → Excel, chuỗi số cho Flow, giữ SỐ GỐC khi lọc')

  const xuatCanh = require('../src/xuat-canh')
  const phanLoai = require('../src/footage-phan-loai')
  const nguonFt = require('../src/footage-nguon')
  const taiFt = require('../src/footage-tai')
  const ExcelJS = require('exceljs')

  await kiem('nén chuỗi số đúng cú pháp ô "Dùng danh sách số tuỳ chọn" của Flow', () => {
    assert.strictEqual(xuatCanh.nenChuoiSo([1, 2, 3, 5, 7, 8, 9, 12]), '1-3,5,7-9,12')
    assert.strictEqual(xuatCanh.nenChuoiSo([9, 3, 3, 1, 2]), '1-3,9', 'bỏ trùng + sắp xếp')
    assert.strictEqual(xuatCanh.nenChuoiSo([]), '')
    assert.deepStrictEqual(xuatCanh.tachChuoiSo('1-3,5,9-7'), [1, 2, 3, 5, 7, 8, 9])
    const ds = [1, 2, 4, 5, 6, 10, 11, 40]
    assert.deepStrictEqual(xuatCanh.tachChuoiSo(xuatCanh.nenChuoiSo(ds)), ds, 'nén rồi tách phải ra đúng như cũ')
  })

  await kiem('chuỗi số khớp NGUYÊN VĂN bộ đọc parseIndexList của Flow', () => {
    // Chép logic parseIndexList của Flow Automation Studio 2.8.6 (src/ui/app.js).
    function parseIndexList(raw, total) {
      const out = new Set()
      for (const phan of String(raw || '').split(',')) {
        const s = phan.trim()
        if (!s) continue
        const m = s.match(/^(\d+)\s*-\s*(\d+)$/)
        if (m) {
          let a = parseInt(m[1], 10); let b = parseInt(m[2], 10)
          if (a > b) [a, b] = [b, a]
          for (let i = a; i <= b; i++) if (i >= 1 && i <= total) out.add(i)
        } else if (/^\d+$/.test(s)) {
          const i = parseInt(s, 10)
          if (i >= 1 && i <= total) out.add(i)
        }
      }
      return [...out].sort((a, b) => a - b)
    }
    const conLai = [1, 2, 3, 6, 7, 9, 10, 11, 12, 408]
    assert.deepStrictEqual(parseIndexList(xuatCanh.nenChuoiSo(conLai), 408), conLai)
  })

  const canhMau = [
    'The old city of Chicago burned for three days in 1871, and the streets filled with smoke.',
    '"Do not be afraid," she whispered, holding the child close as the angel appeared.',
    'Aerial footage of the Mississippi River shows how wide the flood really was.',
    'He felt his heart break as he remembered his mother.',
    'Moses lifted his staff and the sea parted before them.',
    'In 1963, thousands of people marched on Washington for civil rights.'
  ].map((chu, i) => ({ so: i + 1, ten: String(i + 1).padStart(3, '0'), chu, soTu: chu.split(' ').length, giayUoc: 9 }))

  await kiem('Excel bước 1: đúng 2 cột STT + Cảnh, đủ mọi cảnh', async () => {
    const d = thuMucTam('canh-xlsx')
    const dd = path.join(d, 'canh.xlsx')
    await xuatCanh.xuatExcelCanh(dd, canhMau)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(dd)
    const ws = wb.worksheets[0]
    assert.deepStrictEqual(ws.getRow(1).values.slice(1), ['STT', 'Cảnh'])
    assert.strictEqual(ws.actualColumnCount, 2)
    assert.strictEqual(ws.rowCount, canhMau.length + 1)
    assert.strictEqual(ws.getRow(7).getCell(1).value, 6)
  })

  await kiem('Excel đã lọc: bỏ ĐÚNG dòng có footage, GIỮ số gốc (không đánh lại 1,2,3)', async () => {
    const keHoach = phanLoai.taoKeHoach(canhMau, phanLoai.locSo(canhMau))
    for (const c of keHoach.canh) { c.loai = 'AI'; c.chon = null }
    // Cảnh 1 và 6 có tệp; cảnh 3 gắn FOOTAGE nhưng KHÔNG tìm ra → vẫn phải đi Flow.
    Object.assign(keHoach.canh[0], { loai: 'FOOTAGE', chon: { tep: 'Images/001.jpg', loai: 'anh', nguon: 'Wikimedia Commons', giayPhep: 'Public domain', trang: 'https://commons.wikimedia.org/wiki/File:X.jpg', tacGia: 'Unknown' } })
    Object.assign(keHoach.canh[5], { loai: 'FOOTAGE', chon: { tep: 'Videos/006.mp4', loai: 'video', nguon: 'Pexels', giayPhep: 'Pexels License', trang: 'https://www.pexels.com/video/x-1/', tacGia: 'A' } })
    Object.assign(keHoach.canh[2], { loai: 'FOOTAGE', chon: null })
    const d = thuMucTam('loc-xlsx')
    const dd = path.join(d, 'canh-cho-flow.xlsx')
    const kq = await xuatCanh.xuatExcelLoc(dd, canhMau, keHoach)
    assert.strictEqual(kq.chuoi, '2-5')
    assert.strictEqual(kq.soConLai, 4)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(dd)
    const ws = wb.worksheets[0]
    const so = []
    ws.eachRow((r, i) => { if (i > 1) so.push(r.getCell(1).value) })
    assert.deepStrictEqual(so, [2, 3, 4, 5])
    assert.strictEqual(ws.getRow(2).getCell(2).value, canhMau[1].chu, 'nội dung phải đi cùng số gốc')
    assert.strictEqual(ws.actualColumnCount, 2)
    const ws2 = wb.getWorksheet('Footage')
    assert.strictEqual(ws2.rowCount, 3, 'trang Footage: tiêu đề + 2 cảnh có tệp')
    const ghiCong = xuatCanh.vanBanGhiCong(keHoach)
    assert.ok(/Cảnh 1: Wikimedia Commons — Unknown · Public domain/.test(ghiCong))
  })

  await kiem('gom tệp Flow: đọc số đầu tên, chuẩn hoá tên cho CapCut, không đè cảnh footage', () => {
    const kq = xuatCanh.keHoachGom(
      ['02.png', '03_1.png', '03_2.png', '05.mp4', '05.png', '06.png', 'ghi-chu.txt', 'anh-khong-so.png', '120.png'],
      { soFootage: new Set([6]) })
    const lenh = Object.fromEntries(kq.lenh.map((l) => [l.so, l.den.split(path.sep).join('/')]))
    assert.deepStrictEqual(lenh, { 2: 'Images/002.png', 3: 'Images/003.png', 5: 'Videos/005.mp4', 120: 'Images/120.png' })
    assert.strictEqual(kq.lenh.find((l) => l.so === 3).tu, '03_1.png')
    assert.ok(kq.boQua.some((b) => b.ten === '06.png' && /footage/.test(b.lyDo)))
    assert.ok(kq.nhieuTep.some((n) => n.so === 5 && n.chon === '05.mp4'), 'video thắng ảnh như CapCut')
    // Tên đích phải là CHỈ CHỮ SỐ — CapCut Draft Studio quét re.fullmatch(r"\d+", stem).
    for (const l of kq.lenh) assert.ok(/^\d+$/.test(path.parse(l.den).name))
  })

  await kiem('kiểm đủ: bắt cảnh thiếu hình, trùng số, số thừa, thiếu audio', () => {
    const r = xuatCanh.kiemDu(6, {
      Videos: ['004.mp4', '6.mp4'],
      Images: ['001.jpg', '002.png', '2.jpg', '004.jpg', '009.png', 'ghi-chu.txt'],
      Audio: ['1.mp3', '2.mp3', '3.mp3', '4.mp3', '5.mp3', '6.mp3']
    })
    assert.deepStrictEqual(r.thieuHinh, [3, 5])
    assert.deepStrictEqual(r.trungSo, [2])
    assert.deepStrictEqual(r.haiHinh, [4])
    assert.deepStrictEqual(r.thua, [9])
    assert.deepStrictEqual(r.thieuAudio, [])
    assert.strictEqual(r.ok, false)
    const r2 = xuatCanh.kiemDu(2, { Videos: ['1.mp4'], Images: ['002.jpg'], Audio: ['1.mp3'] })
    assert.deepStrictEqual(r2.thieuAudio, [2])
  })

  // =========================================================================
  nhom('35. Phân loại cảnh: lọc sơ + đọc câu trả lời Claude')

  await kiem('lọc sơ: cảnh lịch sử/địa danh → FOOTAGE, thoại/cảm xúc/Kinh Thánh → AI', () => {
    const r = Object.fromEntries(phanLoai.locSo(canhMau).map((x) => [x.so, x.goiY]))
    assert.strictEqual(r[1], 'FOOTAGE', 'Chicago 1871 streets smoke')
    assert.strictEqual(r[2], 'AI', 'thoại + angel')
    assert.notStrictEqual(r[3], 'AI', 'Mississippi River flood phải được hỏi Claude hoặc FOOTAGE')
    assert.strictEqual(r[4], 'AI', 'nội tâm')
    assert.strictEqual(r[5], 'AI', 'Moses rẽ biển')
    assert.strictEqual(r[6], 'FOOTAGE', '1963 civil rights Washington')
  })

  await kiem('ranh giới từ: "sea" không khớp "season", "war" không khớp "toward"', () => {
    const r = phanLoai.locSo([{ so: 1, chu: 'Toward the end of the season they rested.' }])
    assert.ok(!/cảnh vật/.test(r[0].lyDo), r[0].lyDo)
  })

  await kiem('prompt phân loại: đủ cảnh, số trong ngoặc vuông, dặn định dạng dòng |', () => {
    const p = phanLoai.taoPromptPhanLoai(canhMau.slice(0, 3), { loThu: 1, tongLo: 2 })
    assert.ok(p.includes('[1] The old city of Chicago'))
    assert.ok(p.includes('[3] Aerial footage'))
    assert.ok(p.includes('<số> | FOOTAGE | video hoặc photo |'))
    assert.ok(p.includes('LÔ 1/2'))
  })

  await kiem('đọc trả lời Claude: chịu lời dẫn, khối ```, gạch đầu dòng, [số], photo/ảnh', () => {
    const chu = [
      'Đây là kết quả:',
      '```',
      '1 | FOOTAGE | photo | 1871 great chicago fire ruins | lịch sử',
      '- [2] | AI | thoại',
      '3 | FOOTAGE | video | mississippi river flood aerial',
      '4 | AI',
      '5 | FOOTAGE | video |   ',
      '6 | FOOTAGE | ảnh | 1963 march on washington crowd | dân quyền',
      '```',
      'Hy vọng hữu ích!'
    ].join('\n')
    const kq = phanLoai.docTraLoiPhanLoai(chu)
    assert.strictEqual(kq.soDoc, 5)
    assert.deepStrictEqual(kq.ketQua[1], { loai: 'FOOTAGE', kieu: 'anh', tuKhoaTim: '1871 great chicago fire ruins', lyDo: 'lịch sử' })
    assert.strictEqual(kq.ketQua[2].loai, 'AI')
    assert.strictEqual(kq.ketQua[3].kieu, 'video')
    assert.strictEqual(kq.ketQua[6].kieu, 'anh')
    assert.ok(!kq.ketQua[5], 'FOOTAGE thiếu từ khóa thì không nhận')
    assert.ok(kq.loi.some((l) => /Cảnh 5/.test(l)))
    assert.ok(phanLoai.docTraLoiPhanLoai('xin chào').loi.length === 1)
  })

  await kiem('kế hoạch: Claude sửa nhãn, chỉ cảnh "cần hỏi" mới gửi Claude', () => {
    const kh = phanLoai.taoKeHoach(canhMau, phanLoai.locSo(canhMau))
    const canHoi = kh.canh.filter((c) => c.canHoi).map((c) => c.so)
    assert.ok(!canHoi.includes(2) && !canHoi.includes(4) && !canHoi.includes(5), 'cảnh chắc AI không tốn lượt hỏi')
    const soDoi = phanLoai.apDungClaude(kh, { 1: { loai: 'FOOTAGE', kieu: 'anh', tuKhoaTim: 'chicago fire 1871', lyDo: '' }, 6: { loai: 'AI', lyDo: 'x' } })
    assert.strictEqual(kh.canh[0].tuKhoaTim, 'chicago fire 1871')
    assert.strictEqual(kh.canh[5].loai, 'AI')
    assert.strictEqual(kh.canh[5].nguonPhanLoai, 'claude')
    assert.ok(soDoi >= 2)
  })

  await kiem('kế hoạch phải khớp đúng bộ cảnh — cắt lại cách khác thì chặn', () => {
    const kh = phanLoai.taoKeHoach(canhMau, phanLoai.locSo(canhMau))
    assert.strictEqual(phanLoai.kiemKhopKeHoach(canhMau, kh).khop, true)
    assert.strictEqual(kh.canh[0].chu, canhMau[0].chu, 'kế hoạch giữ chữ của cảnh')
    assert.strictEqual(phanLoai.kiemKhopKeHoach(canhMau.slice(1), kh).khop, false)
    const sua = canhMau.map((c) => ({ ...c }))
    sua[3].chu = 'Một câu khác hẳn.'
    const r = phanLoai.kiemKhopKeHoach(sua, kh)
    assert.strictEqual(r.khop, false)
    assert.strictEqual(r.soLech, 4)
  })

  // =========================================================================
  nhom('36. Nguồn footage — URL nguyên văn, đọc kết quả, giấy phép, chấm điểm')

  await kiem('URL gửi ra ngoài khớp NGUYÊN VĂN (lỗi 404 kiểu 0.3.1 không được lặp lại)', () => {
    assert.strictEqual(nguonFt.urlPexels('video', 'city night', 12),
      'https://api.pexels.com/v1/videos/search?query=city%20night&per_page=12&orientation=landscape')
    assert.strictEqual(nguonFt.urlPexels('anh', 'old map', 5),
      'https://api.pexels.com/v1/search?query=old%20map&per_page=5&orientation=landscape')
    assert.strictEqual(nguonFt.urlPixabay('video', 'river', 'K', 12),
      'https://pixabay.com/api/videos/?key=K&q=river&per_page=12&safesearch=true&video_type=film')
    assert.strictEqual(nguonFt.urlPixabay('anh', 'river', 'K', 1),
      'https://pixabay.com/api/?key=K&q=river&per_page=3&safesearch=true&image_type=photo&orientation=horizontal&min_width=1280',
      'Pixabay per_page tối thiểu là 3')
    assert.strictEqual(nguonFt.urlWikimedia('abraham lincoln portrait', 10),
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&generator=search' +
      '&gsrsearch=abraham%20lincoln%20portrait%20filetype%3Abitmap&gsrnamespace=6&gsrlimit=10' +
      '&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=1920' +
      '&iiextmetadatafilter=LicenseShortName%7CArtist%7CUsageTerms%7CObjectName&origin=*')
    assert.strictEqual(nguonFt.urlLoc('dust bowl', 10),
      'https://www.loc.gov/photos/?q=dust%20bowl&fo=json&c=10&fa=online-format:image%7Caccess-restricted:false')
    assert.ok(nguonFt.urlPixabay('anh', 'x'.repeat(300), 'K').includes('q=' + 'x'.repeat(100) + '&'), 'Pixabay q tối đa 100 ký tự')
  })

  await kiem('Pexels video: chọn bản ~1920 thay vì 4K, bỏ tệp không phải mp4', () => {
    const ds = nguonFt.docPexelsVideo({ videos: [{
      id: 42, url: 'https://www.pexels.com/video/city-traffic-at-night-42/', duration: 18, image: 'https://images.pexels.com/videos/42/p.jpg',
      user: { name: 'Ann' },
      video_files: [
        { quality: 'uhd', file_type: 'video/mp4', width: 3840, height: 2160, link: 'https://v/4k.mp4' },
        { quality: 'hd', file_type: 'video/mp4', width: 1920, height: 1080, link: 'https://v/1080.mp4' },
        { quality: 'sd', file_type: 'video/mp4', width: 640, height: 360, link: 'https://v/360.mp4' },
        { quality: 'hls', file_type: 'application/x-mpegURL', width: 1920, height: 1080, link: 'https://v/x.m3u8' }
      ] }] })
    assert.strictEqual(ds.length, 1)
    assert.strictEqual(ds[0].taiVe, 'https://v/1080.mp4')
    assert.strictEqual(ds[0].tieuDe, 'city traffic at night')
    assert.strictEqual(ds[0].thoiLuong, 18)
    assert.strictEqual(ds[0].giayPhep, 'Pexels License')
  })

  await kiem('Pexels ảnh + Pixabay ảnh/video đọc đúng trường', () => {
    const a = nguonFt.docPexelsAnh({ photos: [{ id: 7, width: 6000, height: 4000, url: 'https://www.pexels.com/photo/x-7/', photographer: 'Bo', alt: 'Old church', src: { original: 'o', large2x: 'l2', medium: 'm' } }] })
    assert.strictEqual(a[0].taiVe, 'l2')
    assert.strictEqual(a[0].tieuDe, 'Old church')
    const pv = nguonFt.docPixabayVideo({ hits: [{ id: 9, pageURL: 'p', tags: 'river, flood', duration: 22, user: 'u',
      videos: { large: { url: '', width: 0 }, medium: { url: 'https://cdn.pixabay.com/m.mp4', width: 1280, height: 720, thumbnail: 't' }, small: { url: 's', width: 960 } } }] })
    assert.strictEqual(pv[0].taiVe, 'https://cdn.pixabay.com/m.mp4', 'large rỗng thì lùi medium')
    const pa = nguonFt.docPixabayAnh({ hits: [{ id: 3, largeImageURL: 'https://pixabay.com/get/a.png', imageWidth: 4000, imageHeight: 3000, tags: 't' }] })
    assert.strictEqual(pa[0].duoi, 'png')
  })

  await kiem('Wikimedia: chỉ nhận PD / CC0 / CC BY; loại NC, ND, BY-SA (mặc định), TIFF gốc dùng thumburl', () => {
    const trang = (i, ten, mime = 'image/jpeg') => ({ pageid: i, index: i, title: `File:A${i}.jpg`, imageinfo: [{
      url: `https://upload.wikimedia.org/o${i}.tif`, thumburl: `https://upload.wikimedia.org/t${i}.jpg`, thumbwidth: 1920, thumbheight: 1280,
      width: 5000, height: 3300, mime, descriptionurl: `https://commons.wikimedia.org/wiki/File:A${i}.jpg`,
      extmetadata: { LicenseShortName: { value: ten }, Artist: { value: '<a href="x">Mathew Brady</a>' } } }] })
    const json = { query: { pages: [trang(3, 'CC BY-SA 4.0'), trang(1, 'Public domain', 'image/tiff'), trang(2, 'CC BY 2.0'),
      trang(4, 'CC BY-NC 2.0'), trang(5, 'CC BY-ND 3.0'), trang(6, 'CC0'), trang(7, 'Public domain', 'image/svg+xml')] } }
    const ds = nguonFt.docWikimedia(json)
    assert.deepStrictEqual(ds.map((x) => x.id), ['wikimedia-1', 'wikimedia-2', 'wikimedia-6'])
    assert.strictEqual(ds[0].taiVe, 'https://upload.wikimedia.org/t1.jpg')
    assert.strictEqual(ds[0].tacGia, 'Mathew Brady', 'bỏ thẻ HTML ở tên tác giả')
    assert.strictEqual(nguonFt.docWikimedia(json, { choBySa: true }).length, 4)
    assert.ok(!nguonFt.giayPhepChapNhan('Fair use'))
  })

  await kiem('Library of Congress: lấy ảnh lớn nhất, bỏ "#h=…", bỏ mục bị hạn chế', () => {
    const ds = nguonFt.docLoc({ results: [
      { title: 'Migrant Mother', url: 'https://www.loc.gov/item/2017762891/', image_url: ['https://tile.loc.gov/s.gif#h=150&w=113', 'https://tile.loc.gov/l.jpg#h=1024&w=768'], contributor: ['lange, dorothea'] },
      { title: 'X', url: 'u2', access_restricted: true, image_url: ['a.jpg'] },
      { title: 'Y', url: 'u3', image_url: [] }
    ] })
    assert.strictEqual(ds.length, 1)
    assert.strictEqual(ds[0].taiVe, 'https://tile.loc.gov/l.jpg')
    assert.strictEqual(ds[0].rong, 768)
    assert.ok(/Rights/.test(ds[0].giayPhep), 'LoC phải nhắc người dùng tự xem quyền')
  })

  await kiem('chấm điểm: khớp gốc từ, phạt khung đứng, phạt video ngắn hơn cảnh', () => {
    const goc = { loai: 'video', rong: 1920, cao: 1080, thoiLuong: 15, giayPhep: 'Pexels License' }
    const tot = nguonFt.chamUngVien({ ...goc, tieuDe: 'river flooding aerial' }, { tuKhoa: 'river floods aerial', giayCanh: 9 })
    const lech = nguonFt.chamUngVien({ ...goc, tieuDe: 'birthday cake' }, { tuKhoa: 'river floods aerial', giayCanh: 9 })
    const dung = nguonFt.chamUngVien({ ...goc, rong: 1080, cao: 1920, tieuDe: 'river flooding aerial' }, { tuKhoa: 'river floods aerial', giayCanh: 9 })
    const ngan = nguonFt.chamUngVien({ ...goc, thoiLuong: 6, tieuDe: 'river flooding aerial' }, { tuKhoa: 'river floods aerial', giayCanh: 9 })
    assert.ok(tot.diem > lech.diem + 2, 'khớp "floods" ~ "flooding" theo gốc từ')
    assert.ok(tot.diem > dung.diem + 2)
    assert.ok(tot.diem > ngan.diem + 2)
  })

  await kiem('thứ tự nguồn: lịch sử → kho lưu trữ trước; video → Pexels/Pixabay; nguồn tắt bị bỏ', () => {
    const bat = { pexels: true, pixabay: true, wikimedia: true, loc: true }
    assert.deepStrictEqual(nguonFt.thuTuNguon('anh', '1863 lincoln portrait', bat)[0], ['wikimedia', 'anh'])
    assert.deepStrictEqual(nguonFt.thuTuNguon('video', 'city', bat)[0], ['pexels', 'video'])
    assert.deepStrictEqual(nguonFt.thuTuNguon('video', 'city', { pixabay: true })[0], ['pixabay', 'video'])
  })

  await kiem('tìm cho cảnh: header Authorization cho Pexels, User-Agent cho Wikimedia, dừng sớm, cache, không dùng lại footage', async () => {
    const goi = []
    const layGia = async (url, tuyChon) => {
      goi.push({ url, tuyChon })
      if (url.includes('pexels.com/v1/videos')) {
        return { videos: [1, 2, 3, 4].map((i) => ({ id: i, url: `https://www.pexels.com/video/river-flood-aerial-${i}/`, duration: 20,
          video_files: [{ file_type: 'video/mp4', width: 1920, height: 1080, link: `https://v/${i}.mp4` }] })) }
      }
      return { hits: [] }
    }
    const cache = nguonFt.taoCache()
    const tk = nguonFt.taoTimKiem({ layJSONHam: layGia, khoa: { pexels: 'PK', pixabay: 'XK' }, bat: { pexels: true, pixabay: true }, cache })
    const kq = await tk.timChoCanh({ tuKhoaTim: 'river flood aerial', kieu: 'video' }, { daDung: new Set(['pexels-v-1']) })
    assert.strictEqual(goi.length, 1, 'đủ 3 ứng viên tốt ở Pexels thì KHÔNG gọi tiếp Pixabay')
    assert.deepStrictEqual(goi[0].tuyChon, { tieuDe: { Authorization: 'PK' } })
    assert.ok(!kq.ungVien.some((u) => u.id === 'pexels-v-1'), 'footage đã dùng ở cảnh khác không lặp lại')
    await tk.timChoCanh({ tuKhoaTim: 'River Flood Aerial', kieu: 'video' })
    assert.strictEqual(goi.length, 1, 'lần hai lấy từ cache')

    const goiW = []
    const tkW = nguonFt.taoTimKiem({ layJSONHam: async (url, t) => { goiW.push(t); return { query: { pages: [] } } }, bat: { wikimedia: true } })
    await tkW.timChoCanh({ tuKhoaTim: '1860s portrait', kieu: 'anh' })
    assert.ok(/ToolYTuong/.test(goiW[0].tieuDe['User-Agent']))
  })

  await kiem('lỗi nguồn: 403 → khoá sai, 429 → hết lượt; một nguồn lỗi không làm hỏng cả cảnh', async () => {
    assert.ok(/khoá/.test(nguonFt.moTaLoi({ maHttp: 403 })))
    assert.ok(/giới hạn/.test(nguonFt.moTaLoi({ maHttp: 429 })))
    const tk = nguonFt.taoTimKiem({
      layJSONHam: async (url) => {
        if (url.includes('pexels')) { const e = new Error('HTTP 429'); e.maHttp = 429; throw e }
        return { hits: [{ id: 1, pageURL: 'p', tags: 'city night', duration: 30, videos: { large: { url: 'https://cdn.pixabay.com/1.mp4', width: 1920, height: 1080 } } }] }
      },
      khoa: { pexels: 'P', pixabay: 'X' },
      bat: { pexels: true, pixabay: true }
    })
    const kq = await tk.timChoCanh({ tuKhoaTim: 'city night', kieu: 'video' })
    assert.strictEqual(kq.ungVien[0].nguon, 'Pixabay')
    assert.ok(kq.loi.some((l) => /Pexels/.test(l)))
  })

  await kiem('cache hết hạn sau 24 giờ', () => {
    let t = 0
    const c = nguonFt.taoCache({}, { bayGio: () => t })
    c.dat('a', [1])
    t = 23 * 3600 * 1000
    assert.deepStrictEqual(c.lay('a'), [1])
    t = 25 * 3600 * 1000
    assert.strictEqual(c.lay('a'), null)
  })

  // =========================================================================
  nhom('37. Tải footage — đặt tên theo số cảnh, thay tệp cũ, bỏ tệp rác')

  await kiem('tên tệp: Videos/004.mp4, Images/012.jpg — CHỈ chữ số cho CapCut', () => {
    assert.strictEqual(taiFt.duongDanTep(4, { loai: 'video' }).split(path.sep).join('/'), 'Videos/004.mp4')
    assert.strictEqual(taiFt.duongDanTep(12, { loai: 'anh', duoi: 'png' }).split(path.sep).join('/'), 'Images/012.png')
    assert.strictEqual(taiFt.duongDanTep(1234, { loai: 'anh', duoi: 'jpg' }).split(path.sep).join('/'), 'Images/1234.jpg')
  })

  await kiem('cả chuỗi: tìm → tải → tệp hỏng thử ứng viên kế → đổi video sang ảnh không để lại tệp cũ', async () => {
    const d = thuMucTam('footage-tai')
    const kh = phanLoai.taoKeHoach(canhMau, phanLoai.locSo(canhMau))
    kh.canh.forEach((c) => { c.loai = 'AI' })
    Object.assign(kh.canh[2], { loai: 'FOOTAGE', kieu: 'video', tuKhoaTim: 'river flood' })
    Object.assign(kh.canh[5], { loai: 'FOOTAGE', kieu: 'anh', tuKhoaTim: 'march washington 1963' })
    const uv = (id, loai, taiVe) => ({ id, nguon: 'Pexels', loai, taiVe, duoi: loai === 'video' ? 'mp4' : 'jpg', tieuDe: '', diem: 3 })
    const timGia = async ({ tuKhoaTim }) => ({
      ungVien: tuKhoaTim === 'river flood'
        ? [uv('hong', 'video', 'https://x/html'), uv('v2', 'video', 'https://x/v2.mp4')]
        : [uv('a1', 'anh', 'https://x/a1.jpg')],
      loi: []
    })
    const taiGia = async (url, dich) => {
      if (url.endsWith('/html')) { fs.writeFileSync(dich, '<html>'); return { ok: true, maHttp: 200, soByte: 6, kieu: 'text/html' } }
      const n = url.endsWith('.mp4') ? 200 * 1024 : 20 * 1024
      fs.writeFileSync(dich, Buffer.alloc(n))
      return { ok: true, maHttp: 200, soByte: n, kieu: '' }
    }
    let soLanLuu = 0
    const kq = await taiFt.chayTimVaTai(kh, { thuMuc: d, timChoCanh: timGia, taiVeTepHam: taiGia, luu: () => { soLanLuu++ } })
    assert.strictEqual(kq.soTai, 2)
    assert.strictEqual(kh.canh[2].chon.id, 'v2', 'tệp HTML bị loại, lấy ứng viên kế')
    assert.strictEqual(kh.canh[2].chon.tep, 'Videos/003.mp4')
    assert.ok(fs.existsSync(path.join(d, 'Videos', '003.mp4')))
    assert.ok(fs.existsSync(path.join(d, 'Images', '006.jpg')))
    assert.ok(soLanLuu >= 2, 'lưu kế hoạch sau MỖI cảnh — tắt app giữa chừng không mất phần đã tải')

    // Người dùng đổi cảnh 3 sang một ẢNH → Videos/003.mp4 phải biến khỏi Videos/.
    await taiFt.taiChoCanh(kh.canh[2], uv('a9', 'anh', 'https://x/a9.jpg'), { thuMuc: d, taiVeTepHam: taiGia })
    assert.ok(!fs.existsSync(path.join(d, 'Videos', '003.mp4')), 'tệp cũ phải ra khỏi Videos/, không thì CapCut lấy video cũ')
    assert.ok(fs.existsSync(path.join(d, 'Images', '003.jpg')))
    assert.ok(fs.readdirSync(path.join(d, taiFt.THU_MUC_BO)).length >= 1, 'tệp cũ nằm trong _footage-da-bo, không xoá hẳn')

    // Trả về AI.
    taiFt.traVeAi(kh, 6, d)
    assert.ok(!fs.existsSync(path.join(d, 'Images', '006.jpg')))
    assert.strictEqual(kh.canh[5].loai, 'AI')

    const ktra = xuatCanh.kiemDu(6, { Videos: xuatCanh.docTenTrongThuMuc(path.join(d, 'Videos')), Images: xuatCanh.docTenTrongThuMuc(path.join(d, 'Images')) })
    assert.deepStrictEqual(ktra.thieuHinh, [1, 2, 4, 5, 6])
    assert.deepStrictEqual(ktra.trungSo, [])
  })

  await kiem('kế hoạch lưu nguyên tử; JSON vỡ thì BÁO VỠ, không coi như chưa có', () => {
    const d = thuMucTam('ke-hoach')
    taiFt.ghiKeHoach(d, { canh: [{ so: 1 }] })
    assert.strictEqual(taiFt.docKeHoach(d).canh[0].so, 1)
    fs.writeFileSync(path.join(d, taiFt.TEN_KE_HOACH), '{ "canh": [')
    assert.throws(() => taiFt.docKeHoach(d), /bị hỏng/)
    assert.strictEqual(taiFt.docKeHoach(thuMucTam('trong')), null)
  })

  await kiem('CSP cho phép ảnh xem trước của Pexels / Pixabay / Wikimedia / LoC', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8')
    const csp = (html.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || ''
    const img = (csp.match(/img-src ([^;]+)/) || [])[1] || ''
    for (const h of ['https://images.pexels.com', 'https://cdn.pixabay.com', 'https://pixabay.com', 'https://upload.wikimedia.org', 'https://tile.loc.gov']) {
      assert.ok(img.split(/\s+/).includes(h), 'thiếu ' + h)
    }
  })

  await kiem('taiVeTep ghi tệp tạm rồi mới đổi tên (tải hỏng không để tệp cụt mang số cảnh)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'goi-mang.js'), 'utf8')
    assert.ok(/\.dang-tai'/.test(src) && /renameSync\(tam, dich\)/.test(src))
  })

  // =========================================================================
  nhom('38. yt-dlp lấy phụ đề — lỗi "--print ngầm bật --simulate"')

  await kiem('tham số NGUYÊN VĂN: có --no-simulate (không thì --print chặn ghi tệp), không có --no-warnings', () => {
    const ts = ytDlp.thamSoPhuDe({ videoId: '0NY2gAftzJE', ngonNgu: 'en', thuMucTam: '/tam' })
    assert.deepStrictEqual(ts, [
      '--skip-download', '--no-simulate', '--write-subs', '--write-auto-subs',
      '--sub-langs', 'en.*,en', '--sub-format', 'json3/vtt/best', '--no-playlist',
      '--print', '%(id)s\t%(title)s\t%(duration)s\t%(channel)s',
      '-o', path.join('/tam', '%(id)s'),
      'https://www.youtube.com/watch?v=0NY2gAftzJE'
    ])
    // Luật chung: có --print thì BẮT BUỘC có --no-simulate.
    assert.ok(!ts.includes('--no-warnings'))
    const ts2 = ytDlp.thamSoPhuDe({ videoId: 'aaaaaaaaaaa', thuMucTam: '/t', duongDanCookie: '/t/c.txt', clientDuPhong: true })
    assert.deepStrictEqual(ts2.slice(-5), ['--extractor-args', 'youtube:player_client=tv,web_safari,mweb,android_vr', '--cookies', '/t/c.txt', 'https://www.youtube.com/watch?v=aaaaaaaaaaa'])
  })

  await kiem('mã nguồn: mọi chỗ gọi --print đều kèm --no-simulate', () => {
    for (const f of ['src/yt-dlp.js', 'main.js']) {
      const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\n').filter((d) => !/^\s*\/\//.test(d)).join('\n')
      if (src.includes("'--print'")) assert.ok(src.includes("'--no-simulate'"), f)
    }
  })

  await kiem('chẩn đoán đúng lý do: PO token / thiếu ngôn ngữ / không có gì / không rõ', () => {
    const po = ytDlp.chanDoanThieuPhuDe('WARNING: [youtube] 0NY2gAftzJE: There are missing subtitles languages because a PO token was not provided.')
    assert.ok(po.coPoToken && /PO token/.test(po.lyDo))
    const nn = ytDlp.chanDoanThieuPhuDe('WARNING: There are no subtitles for the requested languages', { ngonNgu: 'en' })
    assert.ok(nn.khongCoNgonNgu && !nn.khongCoGi)
    const khong = ytDlp.chanDoanThieuPhuDe('[info] abc has no subtitles')
    assert.ok(khong.khongCoGi)
    const mo = ytDlp.chanDoanThieuPhuDe('')
    assert.ok(/không ghi ra tệp phụ đề/.test(mo.lyDo), 'không rõ lý do thì KHÔNG được khẳng định "video không có phụ đề"')
    const js = ytDlp.chanDoanThieuPhuDe('WARNING: [youtube] No supported JavaScript runtime could be found.')
    assert.ok(js.thieuJs)
  })

  await kiem('chọn tệp: json3 trước vtt, bản tay trước "-orig", bỏ tệp rỗng', () => {
    const d = thuMucTam('phu-de-chon')
    fs.writeFileSync(path.join(d, 'abcdefghijk.en-orig.json3'), '{}')
    fs.writeFileSync(path.join(d, 'abcdefghijk.en.vtt'), 'WEBVTT')
    fs.writeFileSync(path.join(d, 'abcdefghijk.en.json3'), '{}')
    fs.writeFileSync(path.join(d, 'abcdefghijk.en-US.json3'), '')
    assert.strictEqual(ytDlp.timTepPhuDe(d, 'abcdefghijk'), 'abcdefghijk.en.json3')
    assert.strictEqual(ytDlp.timTepPhuDe(thuMucTam('rong'), 'abcdefghijk'), null)
  })

  await kiem('lượt 1 không ra tệp vì PO token → tự thử client dự phòng và lấy được', async () => {
    const d = thuMucTam('phu-de-thu-lai')
    const goi = []
    const chayGia = async (_tm, thamSo) => {
      goi.push(thamSo)
      if (thamSo.includes('--extractor-args')) {
        fs.writeFileSync(path.join(d, '0NY2gAftzJE.en.json3'), '{"events":[]}')
        return { raChu: '0NY2gAftzJE\tWhat If\t600\tKurzgesagt\n', loiChu: '' }
      }
      return { raChu: '0NY2gAftzJE\tWhat If\t600\tKurzgesagt\n', loiChu: 'WARNING: There are missing subtitles languages because a PO token was not provided.' }
    }
    const kq = await ytDlp.layPhuDe({ thuMucDuLieu: '/x', thuMucTam: d, videoId: '0NY2gAftzJE', chayHam: chayGia })
    assert.strictEqual(goi.length, 2)
    assert.strictEqual(kq.tieuDe, 'What If')
    assert.strictEqual(kq.dinhDang, 'json3')
  })

  await kiem('video thật sự không có phụ đề → không thử lại vô ích, báo đúng lý do kèm cảnh báo cho Nhật ký', async () => {
    const d = thuMucTam('phu-de-khong')
    let soLan = 0
    const chayGia = async () => { soLan++; return { raChu: 'x\tT\t1\tK\n', loiChu: '[info] bbbbbbbbbbb has no subtitles' } }
    await assert.rejects(
      ytDlp.layPhuDe({ thuMucDuLieu: '/x', thuMucTam: d, videoId: 'bbbbbbbbbbb', chayHam: chayGia }),
      (e) => e.khongCoPhuDe && /không có phụ đề nào/.test(e.message) && Array.isArray(e.canhBaoYtDlp))
    assert.strictEqual(soLan, 1)
  })

  // =========================================================================
  console.log('\n' + '─'.repeat(58))
  console.log(`TẦNG 1: ${soQua} qua, ${soTruot.length} truột`)
  if (soTruot.length) {
    console.log('\nCÁC CA TRUỘT:')
    for (const t of soTruot) console.log(`  · ${t.ten}\n    ${t.loi.stack.split('\n').slice(0, 3).join('\n    ')}`)
    process.exit(1)
  }
  console.log('Tất cả qua.')
}

chay().catch((loi) => {
  console.error('Bộ kiểm thử vỡ:', loi.stack)
  process.exit(1)
})
