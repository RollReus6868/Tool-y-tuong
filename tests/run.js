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
const skillKiemDuyet = require('../src/skill-kiem-duyet')
const boLuatChinhSach = skillKiemDuyet.gopBoLuat([skillKiemDuyet.docMacDinh()])

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
      assert.deepStrictEqual(skillKiemDuyet.loiCuaLuat(l), [], 'luật hỏng: ' + l.ma)
    }
  })

  // --- 0.8.0: skill kiểm duyệt + rủi ro kiếm tiền ---------------------------
  const quet = (chu) => kiemDuyet.quetChinhSach(chu, boLuatChinhSach)
  const maCo = (chu) => quet(chu).co.map((c) => c.ma)
  // 600 từ kể chuyện thuần, không có câu nhận định nào
  const keThuan = Array.from({ length: 60 }, (_, i) =>
    `Farmer number ${i} carried grain across the valley road before the autumn rain arrived.`).join(' ')

  await kiem('skill .md: tách khối JSON "luat" khỏi phần hướng dẫn, bỏ phần đầu tệp', () => {
    const md = '---\nname: thu\ndescription: x\n---\n# Chuẩn riêng\n\nĐừng tả máu.\n\n```json\n' +
      '{"phienBan":"t1","luat":[{"ma":"a","ten":"A","mucDo":"vàng","tuKhoa":["pineapple"],"giaiThich":"g","huongSua":"h"}]}\n```\n\nHết.'
    const s = skillKiemDuyet.docSkill(md, 'thu.md')
    assert.deepStrictEqual(s.loi, [])
    assert.strictEqual(s.luat.length, 1)
    assert.strictEqual(s.phienBan, 't1')
    assert.strictEqual(s.huongDan, '# Chuẩn riêng\n\nĐừng tả máu.\n\n\n\nHết.')
    assert.strictEqual(s.luat[0].nhom, 'quang-cao', 'thiếu nhom thì mặc định là quảng cáo')
  })

  await kiem('skill vỡ JSON thì BÁO vỡ, không âm thầm nạp 0 luật', () => {
    const s = skillKiemDuyet.docSkill('Chữ.\n```json\n{"luat":[{"ma":"a",}]}\n```', 'hong.md')
    assert.strictEqual(s.luat.length, 0)
    assert.ok(s.loi.some((l) => /Khối JSON bộ luật vỡ/.test(l)))
    const j = skillKiemDuyet.docSkill('{"luat":[', 'hong.json')
    assert.ok(j.loi.some((l) => /Tệp JSON vỡ/.test(l)))
    assert.ok(skillKiemDuyet.docSkill('', 'rong.md').loi.length, 'tệp trống phải có lỗi')
  })

  await kiem('luật hỏng (regex sai, thiếu mức độ) bị loại VÀ được nêu tên; tệp .json có BOM vẫn đọc', () => {
    const s = skillKiemDuyet.docSkill('﻿' + JSON.stringify({ luat: [
      { ma: 'tot', ten: 'T', mucDo: 'đỏ', mau: ['\\bok\\w*'] },
      { ma: 'regex-sai', ten: 'R', mucDo: 'đỏ', mau: ['(chua dong'] },
      { ma: 'thieu-muc', ten: 'M', tuKhoa: ['x'] },
      { ma: 'tot', ten: 'T2', mucDo: 'vàng', tuKhoa: ['y'] }
    ] }), 'x.json')
    assert.deepStrictEqual(s.luat.map((l) => l.ma), ['tot'])
    assert.strictEqual(s.loi.length, 3)
    assert.ok(s.loi.some((l) => /regex-sai/.test(l)) && s.loi.some((l) => /thieu-muc/.test(l)) && s.loi.some((l) => /lặp mã/.test(l)))
  })

  await kiem('gộp skill: trùng mã thì skill thêm SAU thắng, luật khác giữ nguyên', () => {
    const them = skillKiemDuyet.docSkill(JSON.stringify({ luat: [
      { ma: 'chinh-tri', ten: 'Chính trị (bản của tôi)', mucDo: 'đỏ', tuKhoa: ['parliament'] },
      { ma: 'rieng', ten: 'Riêng', mucDo: 'vàng', tuKhoa: ['pineapple'] }] }), 'toi.json')
    const bo = skillKiemDuyet.gopBoLuat([skillKiemDuyet.docMacDinh(), them])
    assert.strictEqual(bo.luat.length, boLuatChinhSach.luat.length + 1)
    const kq = kiemDuyet.quetChinhSach('The election went to parliament with a pineapple.', bo)
    assert.deepStrictEqual(kq.co.map((c) => c.ma), ['chinh-tri', 'rieng'], 'election không còn khớp vì luật đã bị thay')
    assert.strictEqual(kq.co[0].mucDo, 'đỏ')
    assert.strictEqual(kq.co[0].nguonSkill, 'toi.json')
  })

  await kiem('chuẩn có sẵn: đủ 3 nhóm A/B/C, mọi luật hợp lệ, có hướng dẫn cho Claude và nguồn', () => {
    const m = skillKiemDuyet.docMacDinh()
    assert.deepStrictEqual(m.loi, [])
    for (const n of skillKiemDuyet.NHOM) assert.ok(m.luat.some((l) => l.nhom === n), 'thiếu nhóm ' + n)
    for (const ma of ['thieu-goc-nhin', 'khuon-mau', 'gay-soc', 'ai-chuyen-gia', 'y-te-sai', 'thu-ghet', 'tre-em', 'mo-dau-nhay-cam']) {
      assert.ok(m.luat.some((l) => l.ma === ma), 'thiếu luật ' + ma)
    }
    assert.ok(/inauthentic/.test(m.huongDan) && /reused content/.test(m.huongDan))
    assert.ok(/support\.google\.com\/youtube\/answer\/1311392/.test(m.huongDan))
    assert.ok(!/"luat"\s*:\s*\[/.test(m.huongDan), 'khối JSON không được lọt vào prompt cho Claude')
  })

  await kiem('gốc từ khớp cả dạng chia ("decapitated"), nháy cong ’ khớp nháy thẳng, "Al Gore" không phải máu me', () => {
    assert.ok(maCo('The king was decapitated at dawn.').includes('bao-luc'), 'bản cũ viết \\bdecapitat\\b nên không bao giờ khớp')
    assert.ok(maCo('You won’t believe this.').includes('gay-soc'))
    assert.ok(!maCo('Al Gore conceded that evening.').includes('bao-luc'))
    assert.ok(maCo('The film was pure gore.').includes('bao-luc'))
    assert.ok(maCo('It happened on 9/11 in New York.').includes('su-kien-nhay-cam'), 'từ khóa có ký tự / vẫn phải khớp')
    assert.ok(!maCo('The webpage loaded slowly and the culture thrived.').length, 'không khớp nhầm vào giữa từ (cult ⊄ culture)')
  })

  await kiem('AI đóng vai chuyên gia: cờ đỏ nhóm kênh, xếp lên đầu, kèm câu ví dụ', () => {
    const kq = quet('It rained. As a doctor, I recommend this remedy. I am a licensed attorney too. The election came later.')
    assert.strictEqual(kq.co[0].ma, 'ai-chuyen-gia')
    assert.strictEqual(kq.co[0].nhom, 'kenh')
    assert.strictEqual(kq.co[0].soLan, 2)
    assert.ok(/As a doctor/.test(kq.co[0].viDu[0]))
    assert.ok(!maCo('He worked as a doctor in Ohio for years, and she was a licensed pilot.').includes('ai-chuyen-gia'), 'kể về người khác thì không gắn cờ')
  })

  await kiem('luật "phải có": thiếu nhận định riêng thì gắn cờ, có thì thôi, văn bản ngắn thì không xét', () => {
    assert.ok(maCo(keThuan).includes('thieu-goc-nhin'))
    const coNhanDinh = keThuan + ' I think this matters. What this means is simple. Ask yourself why. The lesson is patience.'
    assert.ok(!maCo(coNhanDinh).includes('thieu-goc-nhin'))
    assert.ok(!maCo('Rain fell across the valley for three days.').includes('thieu-goc-nhin'))
    assert.deepStrictEqual(quet('Rain fell.').chuaXet, [{ ma: 'thieu-goc-nhin', nhomCon: 'chung-chung' }], 'ngắn quá thì ghi là CHƯA XÉT, không ngầm coi là đạt')
    assert.strictEqual(kiemDuyet.baoCao('Rain fell.', { boLuat: boLuatChinhSach }).ruiRo.muc.find((m) => /^Chung chung/.test(m.ten)).mucDo, 'CHƯA ĐO')
    const c = quet(keThuan).co.find((x) => x.ma === 'thieu-goc-nhin')
    assert.ok(/Thấy 0 dấu hiệu trong 840 từ, cần ít nhất 1\./.test(c.chiTiet), c.chiTiet)
  })

  await kiem('ngưỡng số lần: chửi lác đác không gắn cờ (đã nới 7/2025), dày đặc mới gắn', () => {
    assert.ok(!maCo('Well, shit. He left.').includes('chui-the'))
    assert.ok(maCo('shit '.repeat(3) + 'fucking '.repeat(3)).includes('chui-the'))
  })

  await kiem('phạm vi mở đầu: chỉ xét đúng 75 từ đầu', () => {
    assert.strictEqual(kiemDuyet.SO_TU_MO_DAU, 75)
    const dem = (n) => Array.from({ length: n }, (_, i) => 'word' + i).join(' ')
    assert.ok(maCo(dem(74) + ' murdered ' + dem(50)).includes('mo-dau-nhay-cam'), 'từ thứ 75 còn trong vùng')
    assert.ok(!maCo(dem(75) + ' murdered ' + dem(50)).includes('mo-dau-nhay-cam'), 'từ thứ 76 đã ra ngoài')
  })

  await kiem('giống kịch bản cũ: ngưỡng 10/25 do tool đặt, bỏ qua bản y hệt (chính nó)', () => {
    const a = Array.from({ length: 100 }, (_, i) => 'alpha' + i).join(' ')
    const b = Array.from({ length: 100 }, (_, i) => 'beta' + i).join(' ')
    const lai = a.split(' ').slice(0, 40).join(' ') + ' ' + b.split(' ').slice(0, 60).join(' ')
    const kq = kiemDuyet.giongKichBanCu(lai, [{ ten: 'Cũ A', vanBan: a }, { ten: 'Khác', vanBan: 'x y z q w e r t' }, { ten: 'Chính nó', vanBan: lai }])
    assert.strictEqual(kq.boQuaYHet, 1)
    assert.strictEqual(kq.soBanSo, 2)
    assert.strictEqual(kq.ds[0].ten, 'Cũ A')
    assert.strictEqual(kq.caoNhat, 37.5)   // 36 cụm 5 từ trùng / 96
    assert.strictEqual(kq.mucDo, 'ĐỎ')
    assert.ok(/không phải con số YouTube công bố/.test(kq.ghiChuNguong))
    assert.strictEqual(kiemDuyet.giongKichBanCu(b, [{ ten: 'Cũ A', vanBan: a }]).mucDo, 'XANH')
  })

  await kiem('bảng rủi ro kiếm tiền: tách A/B/C, chưa có bản gốc thì ghi CHƯA ĐO chứ không ghi XANH', () => {
    const bc = kiemDuyet.baoCao('As a doctor, I say the king was decapitated. ' + keThuan, { boLuat: boLuatChinhSach, kichBanCu: [] })
    const theo = Object.fromEntries(bc.ruiRo.muc.map((m) => [m.ten, m]))
    assert.strictEqual(theo['Nội dung dùng lại (so với lời thoại gốc)'].mucDo, 'CHƯA ĐO')
    assert.strictEqual(theo['Cùng khuôn với kịch bản cũ của kênh'].mucDo, 'CHƯA ĐO')
    assert.strictEqual(theo['Nhân vật AI đóng vai chuyên gia'].mucDo, 'ĐỎ')
    assert.strictEqual(theo['Chung chung hoặc lặp lại (dấu hiệu làm từ khuôn)'].mucDo, 'VÀNG')
    assert.strictEqual(theo['Không thoả mãn hoặc gây khó chịu'].mucDo, 'XANH')
    assert.strictEqual(theo['Chi tiết cụ thể (tên riêng, con số)'].mucDo, 'XANH', 'keThuan có 60 con số')
    assert.strictEqual(theo['Giới hạn hoặc mất quảng cáo video'].mucDo, 'ĐỎ')
    assert.strictEqual(theo['Nguy cơ gỡ video'].mucDo, 'XANH')
    assert.deepStrictEqual([...new Set(bc.ruiRo.muc.map((m) => m.kieu))], ['A', 'B', 'C'])
    assert.strictEqual(bc.ruiRo.mucDo, 'ĐỎ')
    assert.ok(/không thấy hình ảnh, thumbnail, tiêu đề/.test(bc.ruiRo.ghiChu))
    assert.ok(/Người kể tự nhận là chuyên gia/.test(bc.huongSua[0].viec), 'lỗi cấp kênh phải đứng đầu hướng sửa')

    const sach = kiemDuyet.baoCao('Rain fell across the valley for three days. Farmers counted their losses quietly.', { boLuat: boLuatChinhSach, banGoc: 'completely unrelated words about tractors and engines here' })
    assert.strictEqual(sach.ruiRo.mucDo, 'VÀNG', 'còn mục CHƯA ĐO thì không được kết luận sạch')
    assert.strictEqual(sach.ruiRo.ketLuan, 'CHƯA ĐO ĐỦ — CHƯA KẾT LUẬN ĐƯỢC')
  })

  // --- 0.9.0: ba nhóm "không chân thực" của 2026 ------------------------------
  await kiem('che tên riêng + con số: giữ từ đầu câu và chữ "I", gộp tên nhiều chữ thành một', () => {
    assert.strictEqual(
      kiemDuyet.cheTenRieng('In 1927 the river near New Orleans rose. I think John Smith saw it. He said, "Run, Tom."'),
      'In tenrieng the river near tenrieng rose. I think tenrieng saw it. He said, "Run, tenrieng')
  })

  await kiem('trùng KHUÔN: đổi hết tên riêng và năm thì đo chữ thấp, đo khuôn vẫn 100%', () => {
    const a = ('In 1927 John Carter left Memphis for Chicago with twelve dollars. He met Sarah Lane, who ran a diner on Maple Street. ' +
      'The city council voted against him in 1931. ').repeat(8)
    const b = a.replace(/John Carter/g, 'Elias Brown').replace(/Memphis/g, 'Atlanta').replace(/Chicago/g, 'Detroit')
      .replace(/Sarah Lane/g, 'Ruth Hale').replace(/1927/g, '1934').replace(/1931/g, '1940').replace(/Maple/g, 'Oak')
    const kq = kiemDuyet.giongKichBanCu(b, [{ ten: 'Video cũ', vanBan: a }])
    assert.ok(kq.caoNhat < 25, 'đo chữ thô không tới mức đỏ: ' + kq.caoNhat)
    assert.strictEqual(kq.khuonCaoNhat, 100)
    assert.strictEqual(kq.mucDo, 'ĐỎ', 'mức chung lấy cái nặng hơn')
    assert.ok(/15% \/ 35%/.test(kq.ghiChuNguong) && /không phải con số YouTube công bố/.test(kq.ghiChuNguong))
    const khac = 'Rain fell across the valley for three days while farmers counted their losses quietly near the old mill.'
    assert.strictEqual(kiemDuyet.giongKichBanCu(khac, [{ ten: 'Video cũ', vanBan: a }]).mucDo, 'XANH')
  })

  await kiem('độ cụ thể: truyện không tên không năm → VÀNG, có tên riêng và năm → XANH, ngắn → CHƯA ĐO', () => {
    const chung = 'A poor boy walked to a small town one day and met an old man who gave him some bread. '.repeat(30)
    const cuThe = 'In 1927 John Carter left Memphis for Chicago with twelve dollars and met Sarah Lane on Maple Street. '.repeat(30)
    assert.deepStrictEqual([kiemDuyet.doCuThe(chung).moi1000, kiemDuyet.doCuThe(chung).mucDo], [0, 'VÀNG'])
    assert.strictEqual(kiemDuyet.doCuThe(cuThe).mucDo, 'XANH')
    assert.strictEqual(kiemDuyet.doCuThe('Rain fell.').mucDo, 'CHƯA ĐO')
    assert.ok(/không phải con số YouTube công bố/.test(kiemDuyet.doCuThe(chung).ghiChuNguong))
  })

  await kiem('ngưỡng MẬT ĐỘ: từ mất mát lác đác không gắn cờ, dày đặc mới gắn', () => {
    const nen = 'The harvest came late that year and the market stayed open until dusk. '
    const thua = nen.repeat(80) + 'The old king died. His widow wept at the funeral. They buried him. Grief came. Death again. He was dead. A tragedy. She mourned.'
    assert.ok(!maCo(thua).includes('dau-thuong-lap-lai'), '8 lần trong ~1.000 từ là kể chuyện bình thường')
    const day = 'The king died and the widow wept at the funeral. Her son was dead by morning. '.repeat(20)
    const c = quet(day).co.find((x) => x.ma === 'dau-thuong-lap-lai')
    assert.ok(c && /lần \/ 1\.000 từ \(ngưỡng 15\)/.test(c.chiTiet), c && c.chiTiet)
  })

  await kiem('luật 2026: cốt truyện đúc sẵn, ép cảm xúc, động vật gặp nạn, tin cần kiểm chứng, câu giờ', () => {
    assert.ok(maCo('A poor waitress helped a homeless man, unaware that he was a billionaire.').includes('cot-truyen-khuon'))
    assert.ok(maCo('The humble janitor had no clue. Years later the billionaire returned.').includes('cot-truyen-khuon'))
    assert.ok(!maCo('The janitor swept the hall and went home to his family.').includes('cot-truyen-khuon'))
    assert.ok(maCo('It will break your heart. Everyone burst into tears. It will give you chills.').includes('thao-tung-cam-xuc'))
    assert.ok(!maCo('It was heartbreaking.').includes('thao-tung-cam-xuc'), 'một câu thì chưa phải công thức')
    assert.ok(maCo('The puppy was left chained and shivering in the snow.').includes('dong-vat-gap-nan'))
    assert.ok(maCo('An abandoned kitten sat by the road.').includes('dong-vat-gap-nan'))
    assert.ok(!maCo('The dog ran across the field to greet him.').includes('dong-vat-gap-nan'))
    assert.ok(maCo('Breaking news: the singer has just passed away.').includes('su-kien-bia'))
    assert.ok(maCo('But first, a story. More on that later. Stick around. As I said before, wait.').includes('keo-dai-thoi-luong'))
    assert.ok(maCo('Type amen. Like if you agree. Share this video with a friend.').includes('keu-goi-tuong-tac'))
  })

  await kiem('bảng rủi ro gom cờ theo nhomCon — skill thêm sau tự rơi đúng dòng "khó chịu"', () => {
    const them = skillKiemDuyet.docSkill(JSON.stringify({ luat: [
      { ma: 'cua-toi', ten: 'Luật của tôi', nhom: 'kenh', nhomCon: 'kho-chiu', mucDo: 'đỏ', tuKhoa: ['pineapple'] }] }), 'toi.json')
    const bo = skillKiemDuyet.gopBoLuat([skillKiemDuyet.docMacDinh(), them])
    const dong = (chu) => kiemDuyet.baoCao(chu, { boLuat: bo }).ruiRo.muc.find((m) => m.ten === 'Không thoả mãn hoặc gây khó chịu')
    assert.strictEqual(dong('A pineapple fell.').mucDo, 'ĐỎ')
    assert.ok(/Luật của tôi \(pineapple\)/.test(dong('A pineapple fell.').lyDo))
    assert.strictEqual(dong('A pear fell.').mucDo, 'XANH')
    for (const l of skillKiemDuyet.docMacDinh().luat.filter((x) => x.nhom === 'kenh')) {
      assert.ok(['chung-chung', 'kho-chiu', 'ai-chuyen-gia'].includes(l.nhomCon), 'luật cấp kênh thiếu nhomCon: ' + l.ma)
    }
  })

  await kiem('giao diện Youwee: màu chỉ đi qua token, đủ 6 chủ đề × sáng/tối, phông kèm theo, tệp chủ đề nạp trước app', () => {
    const fs2 = require('fs'); const path2 = require('path')
    const goc = path2.join(__dirname, '..', 'ui')
    const css = fs2.readFileSync(path2.join(goc, 'style.css'), 'utf8')
    const html = fs2.readFileSync(path2.join(goc, 'index.html'), 'utf8')
    const js = fs2.readFileSync(path2.join(goc, 'giao-dien.js'), 'utf8')
    // Một mã hex lọt vào là chỗ đó đứng yên khi đổi chủ đề, và chế độ sáng dễ ra chữ trắng nền trắng.
    const hex = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter((m) => m.toLowerCase() !== '#fff')
    assert.deepStrictEqual(hex, [], 'style.css có mã màu viết cứng')
    for (const t of ['ocean', 'midnight', 'aurora', 'forest', 'candy']) {
      assert.ok(css.includes(`[data-chu-de="${t}"]`) && css.includes(`.dark[data-chu-de="${t}"]`), 'thiếu chủ đề ' + t)
      assert.ok(js.includes(`'${t}'`), 'giao-dien.js thiếu chủ đề ' + t)
    }
    assert.ok(/#man-che\[hidden\]\s*\{\s*display:\s*none/.test(css), 'luật chống lớp phủ che cả app phải còn nguyên')
    for (const f of (css.match(/url\("([^"]+)"\)/g) || [])) {
      assert.ok(fs2.existsSync(path2.join(goc, f.slice(5, -2))), 'thiếu tệp phông: ' + f)
    }
    assert.ok(html.indexOf('giao-dien.js') > 0 && html.indexOf('giao-dien.js') < html.indexOf('<body'), 'phải nạp ở <head> để không chớp màu lúc mở')
    assert.ok(!/<script(?![^>]*src=)/.test(html), 'CSP cấm script viết thẳng trong trang')
    assert.strictEqual((html.match(/class="muc"[^>]*title="/g) || []).length, 12, 'thu gọn thanh bên thì tên mục chỉ còn ở tooltip')
    assert.ok(/try \{ return localStorage/.test(js) && /try \{ localStorage\.setItem/.test(js), 'localStorage phải bọc try/catch')
  })

  await kiem('prompt nhờ Claude soi lại: có chuẩn, có cờ máy thấy, có kịch bản, không lẫn khối JSON luật', () => {
    const kb = 'As a doctor, I say hello.'
    const bc = kiemDuyet.baoCao(kb, { boLuat: boLuatChinhSach })
    const p = skillKiemDuyet.taoPromptSoiLai({ kichBan: kb, cacSkill: [skillKiemDuyet.docMacDinh()], baoCao: bc })
    assert.ok(p.indexOf('===== CHUẨN KIỂM DUYỆT =====') < p.indexOf('===== MÁY QUÉT ĐÃ THẤY'))
    assert.ok(p.indexOf('===== MÁY QUÉT ĐÃ THẤY') < p.indexOf('===== KỊCH BẢN ====='))
    assert.ok(p.endsWith('===== KỊCH BẢN =====\n' + kb))
    assert.ok(/\[cờ đỏ\] Người kể tự nhận là chuyên gia.*khớp: as a doctor/.test(p))
    assert.ok(!/"tuKhoa"/.test(p))
    const khongBaoCao = skillKiemDuyet.taoPromptSoiLai({ kichBan: kb, cacSkill: [] })
    assert.ok(!/===== (MÁY QUÉT ĐÃ THẤY|CHUẨN KIỂM DUYỆT)/.test(khongBaoCao))
  })

  await kiem('nối dây 0.8.0: main dùng skill (không còn tệp JSON cũ), preload + store + giao diện đủ khoá', () => {
    const fs2 = require('fs'); const path2 = require('path')
    const doc = (t) => fs2.readFileSync(path2.join(__dirname, '..', t), 'utf8')
    assert.ok(!/bo-luat-chinh-sach\.json/.test(doc('main.js')))
    for (const kenh of ['skillkd:danh-sach', 'skillkd:them', 'skillkd:xoa', 'skillkd:xuat-mac-dinh', 'kiemduyet:prompt-soi-lai']) {
      assert.ok(doc('main.js').includes(`ipcMain.handle('${kenh}'`), 'main thiếu ' + kenh)
      assert.ok(doc('preload.js').includes(`goi('${kenh}'`), 'preload thiếu ' + kenh)
    }
    const store = require('../src/store')
    assert.ok(store.KHOA_PHUC_TAP.includes('khoSkillKiemDuyet'))
    assert.deepStrictEqual(store.CAI_DAT_MAC_DINH.khoSkillKiemDuyet, [])
    assert.ok(/KHOA_PHUC_TAP = \[[^\]]*'khoSkillKiemDuyet'/.test(doc('ui/app.js')))
    assert.ok(require('../package.json').build.files.includes('src/**/*'), 'tệp skill .md phải nằm trong bản đóng gói')
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
    assert.strictEqual(trinhDuyet.duocPhepMo('https://chatgpt.com/'), true)
    assert.strictEqual(trinhDuyet.duocPhepMo('https://auth.openai.com/log-in'), true)
    assert.strictEqual(trinhDuyet.duocPhepMo('https://fakechatgpt.com/'), false, 'không khớp nửa tên miền')
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
      '--sub-langs', 'en,en-orig,en-US,en-GB', '--sleep-subtitles', '1', '--sub-format', 'json3/vtt/best', '--no-playlist',
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

  // --- 0.9.1: yt-dlp thoát mã lỗi ≠ không có phụ đề ---------------------------
  const loiYtDlp = (loiChu, raChu = '') => Object.assign(new Error(ytDlp.dichLoiYtDlp(loiChu) || 'mã 1'), { ma: 1, loiChu, raChu })
  const LOI_429 = "ERROR: Unable to download video subtitles for 'en-orig': HTTP Error 429: Too Many Requests"

  await kiem('yt-dlp thoát mã 1 vì MỘT bản phụ đề hỏng nhưng bản khác đã tải xong → vẫn lấy được', async () => {
    const d = thuMucTam('phu-de-mot-phan')
    let soLan = 0
    const chayGia = async () => {
      soLan++
      fs.writeFileSync(path.join(d, 'ccccccccccc.en.json3'), '{"events":[]}')
      throw loiYtDlp(LOI_429, 'ccccccccccc\tTen\t60\tKenh\n')
    }
    const kq = await ytDlp.layPhuDe({ thuMucDuLieu: '/x', thuMucTam: d, videoId: 'ccccccccccc', chayHam: chayGia })
    assert.strictEqual(kq.dinhDang, 'json3')
    assert.strictEqual(kq.tieuDe, 'Ten', 'tiêu đề vẫn đọc được từ đầu ra của lượt lỗi')
    assert.strictEqual(soLan, 1)
  })

  await kiem('lượt 1 thoát mã lỗi, chưa có tệp → VẪN thử client dự phòng (trước đây ném lỗi luôn)', async () => {
    const d = thuMucTam('phu-de-loi-roi-duoc')
    const goi = []
    const chayGia = async (_tm, thamSo) => {
      goi.push(thamSo.includes('--extractor-args'))
      if (goi.length === 1) throw loiYtDlp('ERROR: [youtube] ddddddddddd: Unable to download API page: HTTP Error 403: Forbidden')
      fs.writeFileSync(path.join(d, 'ddddddddddd.en.vtt'), 'WEBVTT')
      return { raChu: 'ddddddddddd\tT\t1\tK\n', loiChu: '' }
    }
    const kq = await ytDlp.layPhuDe({ thuMucDuLieu: '/x', thuMucTam: d, videoId: 'ddddddddddd', chayHam: chayGia })
    assert.deepStrictEqual(goi, [false, true])
    assert.strictEqual(kq.dinhDang, 'vtt')
  })

  await kiem('cả hai lượt đều lỗi → thông báo kèm NGUYÊN VĂN dòng lỗi của yt-dlp, và dòng đó tới được Nhật ký', async () => {
    const d = thuMucTam('phu-de-hai-loi')
    const chayGia = async () => { throw loiYtDlp('WARNING: gi do\n' + LOI_429) }
    await assert.rejects(
      ytDlp.layPhuDe({ thuMucDuLieu: '/x', thuMucTam: d, videoId: 'eeeeeeeeeee', chayHam: chayGia }),
      (e) => /lỗi 429/.test(e.message) && e.message.includes("yt-dlp nói: ERROR: Unable to download video subtitles for 'en-orig': HTTP Error 429") &&
        e.canhBaoYtDlp.some((c) => c.includes('HTTP Error 429')))
  })

  await kiem('chưa có yt-dlp / không chạy nổi tiến trình → ném lại ngay, không giả vờ thử tiếp', async () => {
    let soLan = 0
    const chayGia = async () => { soLan++; throw Object.assign(new Error('Chưa có yt-dlp.'), { thieuYtDlp: true }) }
    await assert.rejects(ytDlp.layPhuDe({ thuMucDuLieu: '/x', thuMucTam: thuMucTam('phu-de-thieu'), videoId: 'fffffffffff', chayHam: chayGia }), (e) => e.thieuYtDlp)
    assert.strictEqual(soLan, 1)
  })

  await kiem('429 dịch đúng: KHÔNG khuyên "cập nhật yt-dlp" (cập nhật không giải quyết được việc bị chặn tần suất)', () => {
    const c = ytDlp.dichLoiYtDlp(LOI_429)
    assert.ok(/lỗi 429/.test(c) && /cookie/.test(c) && !/Cập nhật yt-dlp/.test(c), c)
    assert.ok(ytDlp.dichLoiYtDlp('ERROR: Unable to download webpage: HTTP Error 403').includes('Cập nhật yt-dlp'), 'lỗi khác vẫn giữ lời khuyên cũ')
    assert.strictEqual(ytDlp.ngonNguPhuDe('en'), 'en,en-orig,en-US,en-GB')
    assert.ok(!ytDlp.ngonNguPhuDe('en').includes('*'), 'không dùng mẫu rộng: mỗi bản phụ đề là một lượt gọi, một lượt hỏng là cả lệnh thoát mã lỗi')
  })

  await kiem('chay(): lỗi mang theo nguyên văn stderr (kiểm bằng một tiến trình thật thoát mã 3)', async () => {
    const d = thuMucTam('yt-gia')
    const laWin = process.platform === 'win32'
    const dich = ytDlp.duongDanBinary(d)
    fs.mkdirSync(path.dirname(dich), { recursive: true })
    // Tệp giả phải > 100.000 byte mới được coi là "đã có yt-dlp".
    const don = '#'.repeat(100200)
    if (laWin) return   // Windows cần .exe thật; nhánh này đã được ba ca phía trên phủ bằng hàm giả
    fs.writeFileSync(dich, `#!/bin/sh\necho "x\tT\t1\tK"\necho "ERROR: boom nguyen van" 1>&2\nexit 3\n# ${don}\n`)
    fs.chmodSync(dich, 0o755)
    await assert.rejects(ytDlp.chay(d, []), (e) => e.ma === 3 && e.loiChu.includes('ERROR: boom nguyen van') && e.raChu.includes('x\tT'))
  })

  // =========================================================================
  nhom('39. Xuất Word / txt / md')

  const xuatVB = require('../src/xuat-van-ban')
  const JSZipT = require('jszip')

  await kiem('.docx hợp lệ: đủ 3 phần, thoát ký tự XML, tiêu đề "#" thành chữ đậm, bỏ ký tự điều khiển', async () => {
    const buf = await xuatVB.taoDocx('## Phần 1\nA < B & "C"\u0007\n\n---\nDòng cuối có dấu tiếng Việt', { tieuDe: 'Lời thoại' })
    const zip = await JSZipT.loadAsync(buf)
    assert.ok(zip.file('[Content_Types].xml') && zip.file('_rels/.rels') && zip.file('word/document.xml'))
    const xml = await zip.file('word/document.xml').async('string')
    assert.ok(xml.includes('A &lt; B &amp; &quot;C&quot;'))
    assert.ok(!xml.includes('\u0007'))
    assert.ok(xml.includes('<w:b/>') && xml.includes('>Phần 1<') && xml.includes('>Lời thoại<'))
    assert.ok(xml.includes('Dòng cuối có dấu tiếng Việt'))
  })

  await kiem('ghi theo đuôi tệp: .txt có BOM, .md giữ nguyên, .docx là zip', async () => {
    const d = thuMucTam('xuat-vb')
    await xuatVB.ghiVanBan(path.join(d, 'a.txt'), 'xin chào', { tieuDe: 'T' })
    await xuatVB.ghiVanBan(path.join(d, 'a.md'), 'xin chào')
    await xuatVB.ghiVanBan(path.join(d, 'a.docx'), 'xin chào')
    assert.strictEqual(fs.readFileSync(path.join(d, 'a.txt'), 'utf8'), '﻿T\n\nxin chào')
    assert.strictEqual(fs.readFileSync(path.join(d, 'a.md'), 'utf8'), 'xin chào')
    assert.strictEqual(fs.readFileSync(path.join(d, 'a.docx')).slice(0, 2).toString(), 'PK')
    assert.strictEqual(xuatVB.tenTepAnToan('loi-thoai What: If? <x>. '), 'loi-thoai What If x')
  })

  // =========================================================================
  nhom('40. Kịch bản — cách 1 prompt + "tiếp", tách bài dán về')

  await kiem('prompt một lần: dặn viết vào MỘT artifact, dòng "## PHẦN n", dừng chờ "tiếp", báo HẾT', () => {
    const p = kichBanMod.taoPromptMotLan({ skill: 'SKILL X', loiThoai: 'tư liệu Y', yeuCau: { soTuMucTieu: 11000, soPhan: 8 } })
    for (const can of ['SKILL X', 'tư liệu Y', 'MỘT artifact', '## PHẦN <số>', '"tiếp"', 'HẾT KỊCH BẢN', 'Phần 8']) assert.ok(p.includes(can), 'thiếu: ' + can)
  })

  await kiem('tách bài dán: theo SỐ phần, bỏ dàn ý phía trước, bỏ markdown, báo thiếu/trùng', () => {
    const chu = 'DÀN Ý\n1. abc\n\n## PHẦN 1\nThe **river** rose.\n\n**PHẦN 2**\nSecond part.\n# PHẦN 4\nFourth.\n## PHẦN 2\nSecond part v2.\nHẾT KỊCH BẢN'
    const r = kichBanMod.tachPhanBanDan(chu)
    assert.deepStrictEqual(r.phan, ['The river rose.', 'Second part v2.', 'Fourth.'])
    assert.deepStrictEqual(r.thieu, [3])
    assert.deepStrictEqual(r.trung, [2])
    const khong = kichBanMod.tachPhanBanDan('Just one block of text.\n\nAnother paragraph.')
    assert.strictEqual(khong.soTieuDe, 0)
    assert.deepStrictEqual(khong.phan, ['Just one block of text.\n\nAnother paragraph.'])
    // Câu văn có chữ "part" giữa dòng không bị tưởng là tiêu đề.
    const cau = kichBanMod.tachPhanBanDan('## PHẦN 1\nPart 2 of the story began when the rain stopped and nobody knew why it mattered so much to them all.')
    assert.strictEqual(cau.phan.length, 1)
  })

  // =========================================================================
  nhom('41. Claude API — hợp đồng nguyên văn, lỗi, thử lại, viết tự động')

  const claudeApi = require('../src/claude-api')
  const { vietTuDong } = require('../src/kich-ban-tu-dong')

  await kiem('yêu cầu gửi đi khớp NGUYÊN VĂN tài liệu Messages API', () => {
    const { url, tuyChon } = claudeApi.yeuCauClaude({ khoa: 'sk-ant-X', moHinh: 'claude-opus-5-5', prompt: 'Hi', maxTokens: 16000 })
    assert.strictEqual(url, 'https://api.anthropic.com/v1/messages')
    assert.deepStrictEqual(tuyChon.headers, { 'x-api-key': 'sk-ant-X', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' })
    assert.strictEqual(tuyChon.method, 'POST')
    assert.deepStrictEqual(JSON.parse(tuyChon.body), { model: 'claude-opus-5-5', max_tokens: 16000, messages: [{ role: 'user', content: 'Hi' }] })
    assert.deepStrictEqual(Object.keys(claudeApi.MO_HINH), ['claude-opus-5-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'])
  })

  await kiem('đọc trả lời: chỉ lấy khối text (bỏ khối thinking), cộng token', () => {
    const r = claudeApi.docTraLoiClaude({ content: [{ type: 'thinking', thinking: 'bí mật' }, { type: 'text', text: 'Xin ' }, { type: 'text', text: 'chào' }],
      stop_reason: 'end_turn', usage: { input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 7 } })
    assert.deepStrictEqual(r, { chu: 'Xin chào', lyDoDung: 'end_turn', tokVao: 15, tokRa: 7 })
  })

  await kiem('lỗi: 401 khoá sai, hết credit, 429/529 thử lại rồi mới báo', async () => {
    assert.ok(/Khoá Claude API sai/.test(claudeApi.moTaLoiClaude(401, '{"error":{"type":"authentication_error"}}')))
    assert.ok(/hết tiền/.test(claudeApi.moTaLoiClaude(400, '{"error":{"type":"invalid_request_error","message":"Your credit balance is too low"}}')))
    let lan = 0
    const ngu = async () => {}
    const fetchGia = async () => {
      lan++
      if (lan < 3) return { ok: false, status: 529, text: async () => '{"error":{"type":"overloaded_error"}}', headers: { get: () => null } }
      return { ok: true, status: 200, text: async () => JSON.stringify({ content: [{ type: 'text', text: 'OK' }], usage: {} }) }
    }
    const kq = await claudeApi.taoGoiClaude({ khoa: 'k', fetchHam: fetchGia, ngu })('p')
    assert.strictEqual(kq.chu, 'OK'); assert.strictEqual(lan, 3)
    let lan2 = 0
    const sai = async () => { lan2++; return { ok: false, status: 401, text: async () => '{}', headers: { get: () => null } } }
    await assert.rejects(claudeApi.taoGoiClaude({ khoa: 'k', fetchHam: sai, ngu })('p'), /sai/)
    assert.strictEqual(lan2, 1, 'khoá sai thì KHÔNG thử lại')
  })

  await kiem('ước tính chi phí: Opus đắt gấp đôi Sonnet, có số lượt gọi', () => {
    const o = claudeApi.uocChiPhi({ moHinh: 'claude-opus-5-5', soTuSkill: 3000, soTuTuLieu: 8000, soTuMucTieu: 11000, soPhan: 8 })
    const s = claudeApi.uocChiPhi({ moHinh: 'claude-sonnet-5', soTuSkill: 3000, soTuTuLieu: 8000, soTuMucTieu: 11000, soPhan: 8 })
    assert.strictEqual(o.soLuot, 9)
    assert.ok(o.usd > 0.3 && o.usd < 3, 'ước tính ' + o.usd)
    assert.ok(Math.abs(o.usd - 2 * s.usd) < 0.02)
  })

  await kiem('viết tự động cả chuỗi: dàn ý → 3 phần có sổ chống lặp → gộp; lưu từng phần; bỏ markdown', async () => {
    const goiDi = []
    const goi = async (prompt) => {
      goiDi.push(prompt)
      if (prompt.includes('CHỈ DÀN Ý')) return { chu: 'PHẦN 1 | Mở | 100\n- a\nPHẦN 2 | Giữa | 100\n- b\nPHẦN 3 | Kết | 100\n- c', tokVao: 100, tokRa: 50, lyDoDung: 'end_turn' }
      const so = prompt.match(/VIẾT PHẦN (\d+)/)[1]
      return { chu: `**Part ${so}** the river rose again over the old stone bridge near the mill.`, tokVao: 200, tokRa: 80, lyDoDung: so === '3' ? 'max_tokens' : 'end_turn' }
    }
    const daLuu = []
    const kq = await vietTuDong({ goi, yeuCau: { soTuMucTieu: 300, soPhan: 3 }, luuPhan: (so, chu) => daLuu.push(so) })
    assert.strictEqual(kq.xong, true)
    assert.deepStrictEqual(daLuu, [1, 2, 3])
    assert.strictEqual(goiDi.length, 4)
    assert.ok(goiDi[2].includes('SỔ CHỐNG LẶP'), 'phần 2 phải kèm sổ chống lặp rút từ phần 1')
    assert.ok(!kq.kichBan.includes('**'))
    assert.strictEqual(kq.tokVao, 700)
    assert.ok(kq.canhBao.some((c) => /Phần 3 bị cắt/.test(c)))
  })

  await kiem('chạy tiếp: có dàn ý + phần 1 rồi thì chỉ gọi cho phần còn thiếu (không trả tiền hai lần)', async () => {
    const goiDi = []
    const goi = async (prompt) => { goiDi.push(prompt); return { chu: 'text ' + goiDi.length, tokVao: 1, tokRa: 1 } }
    const kq = await vietTuDong({ goi, yeuCau: { soPhan: 2 }, danYCo: 'PHẦN 1 | A | 10\nPHẦN 2 | B | 10', cacPhanCo: ['đã có phần 1'] })
    assert.strictEqual(goiDi.length, 1)
    assert.ok(goiDi[0].includes('VIẾT PHẦN 2'))
    assert.deepStrictEqual(kq.cacPhan, ['đã có phần 1', 'text 1'])
  })

  await kiem('dừng giữa chừng giữ phần đã viết; dàn ý sai định dạng thì báo rõ', async () => {
    let huy = false
    const goi = async (prompt) => {
      if (prompt.includes('CHỈ DÀN Ý')) return { chu: 'PHẦN 1 | A | 10\nPHẦN 2 | B | 10' }
      huy = true
      return { chu: 'phần một' }
    }
    const kq = await vietTuDong({ goi, yeuCau: { soPhan: 2 }, daHuy: () => huy })
    assert.strictEqual(kq.xong, false)
    assert.deepStrictEqual(kq.cacPhan, ['phần một'])
    await assert.rejects(vietTuDong({ goi: async () => ({ chu: 'xin lỗi, tôi không hiểu' }), yeuCau: { soPhan: 2 } }), /định dạng/)
  })

  // =========================================================================
  nhom('42. Cắt cảnh: nhập cảnh ngắn, tách câu dài ở liên từ, báo SỐ cảnh lệch')

  await kiem('câu 50 từ không dấu phẩy được tách ở liên từ gần giữa', () => {
    const cau = 'The river rose over the old stone wall and the farmers watched from the ridge while the rain kept falling on the fields that their grandfathers had planted long before the war came to the valley and took the young men away from home.'
    const ds = promptAnh.cheNhoCau(cau, 40)
    assert.ok(ds.length >= 2)
    for (const d of ds) assert.ok(kiemDuyet.demTu(d) <= 40 && kiemDuyet.demTu(d) >= 6)
    assert.strictEqual(ds.join(' '), cau, 'không được mất chữ')
  })

  await kiem('cảnh 2 từ ("He waited.") được nhập vào cảnh bên cạnh, số cảnh vẫn liên tục từ 1', () => {
    const chu = 'He waited. ' + 'The storm moved across the plains and the town prepared for the worst night of the year, with every shutter closed tight. '.repeat(3)
    const canh = promptAnh.catCanh(chu, { tuMoiCanh: 27 })
    assert.ok(canh.every((c) => c.soTu >= 12), JSON.stringify(canh.map((c) => c.soTu)))
    assert.deepStrictEqual(canh.map((c) => c.so), canh.map((_, i) => i + 1))
    assert.ok(canh[0].chu.startsWith('He waited.'))
  })

  await kiem('thống kê trả về SỐ cảnh lệch; gộp 2 cảnh/ảnh thì cảnh dài không bị báo', () => {
    const tk = promptAnh.thongKeCanh([{ so: 1, soTu: 5, giayUoc: 2 }, { so: 2, soTu: 27, giayUoc: 9 }, { so: 3, soTu: 60, giayUoc: 20 }])
    assert.deepStrictEqual(tk.soCanhNgan, [1])
    assert.deepStrictEqual(tk.soCanhDai, [3])
    const tk2 = promptAnh.thongKeCanh([{ so: 1, soTu: 60, giayUoc: 20, gop: 2 }])
    assert.deepStrictEqual(tk2.soCanhDai, [])
  })

  // =========================================================================
  nhom('43. Style mẫu đi vào prompt gửi Claude')

  await kiem('prompt mẫu + ảnh mẫu có mặt ở CẢ hai kiểu lô (JSON và prompt thường)', () => {
    const canh = promptAnh.catCanh('An old shepherd walks up the hill at dusk with his flock behind him.', { tuMoiCanh: 27 })
    const mau = 'Oil painting, 19th-century biblical illustration, warm rim light'
    for (const ham of [promptAnh.taoPromptMoTaCanh, promptAnh.taoPromptMoTaCanhThuong]) {
      const p = ham(canh, { style: 'S', promptMau: mau, coAnhMau: true })
      assert.ok(p.includes(mau), ham.name)
      assert.ok(p.includes('STYLE MẪU'), ham.name)
      assert.ok(/ĐÍNH KÈM/.test(p), ham.name)
    }
    assert.ok(!promptAnh.taoPromptMoTaCanhThuong(canh, {}).includes('STYLE MẪU'), 'không có mẫu thì không chèn khối rỗng')
  })

  await kiem('mã nguồn: màn Prompt ảnh có ô nhập style (trước 0.6.0 không có ô nào → luôn style mặc định)', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8')
    for (const id of ['o-prompt-mau', 'o-style-chung', 'o-co-anh-mau', 'nut-luu-style']) assert.ok(html.includes(`id="${id}"`), id)
    const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8')
    assert.ok(/promptMau: o\.mau/.test(main), 'prompt mẫu phải được truyền vào lô gửi Claude')
  })

  // =========================================================================
  nhom('44. Prompt mẫu dạng JSON — sinh JSON cùng cấu trúc, sinh lại theo mẫu mới')

  const pj = require('../src/prompt-json')
  const MAU_JSON = `{
    "scene_description": "An elderly shepherd walks up a rocky hillside at dusk",
    "style": "oil painting, 19th-century biblical illustration",
    "lighting": "warm golden rim light",
    "camera": { "shot": "wide shot", "angle": "low angle", "lens": "35mm" },
    "setting": "rocky hillside above a village",
    "characters": ["old shepherd with a staff"],
    "aspect_ratio": "16:9",
    "negative_prompt": "text, watermark"
  }`
  const canhJ = promptAnh.catCanh('Moses stood before Pharaoh in the great hall of the palace and asked him again to let the people go free. ' +
    'At dawn the river turned red and the fishermen ran from the muddy banks in fear of what they saw.', { tuMoiCanh: 27 })
  const khoNV = [{ ten: 'Moses', moTa: 'a tall bearded man in his eighties, coarse brown robe, wooden staff', tuKhoa: [] }]

  await kiem('đọc mẫu: JSON hợp lệ, khối ```json```, và BÁO LỖI khi JSON hỏng (không lặng lẽ coi là chữ)', () => {
    assert.strictEqual(pj.docMauJson(MAU_JSON).ok, true)
    assert.strictEqual(pj.docMauJson('```json\n' + MAU_JSON + '\n```').ok, true)
    const hong = pj.docMauJson('{ "style": "a", "lighting": "b", }')
    assert.strictEqual(hong.ok, false); assert.ok(/lỗi cú pháp/.test(hong.loi))
    assert.strictEqual(pj.trongNhuJson('cinematic still, 35mm'), false)
    assert.strictEqual(pj.trongNhuJson('{ "style": "x" }'), true)
    assert.ok(/MỘT đối tượng/.test(pj.docMauJson('[{"a":1}]').loi || '') || !pj.trongNhuJson('[{"a":1}]'))
  })

  await kiem('nhận đúng khoá theo cảnh: scene_description (không nhầm camera.shot), setting, characters', () => {
    const ct = pj.phanTichMau(pj.docMauJson(MAU_JSON).mau)
    assert.deepStrictEqual(ct.chinh, ['scene_description'])
    assert.deepStrictEqual(ct.boiCanh, ['setting'])
    assert.strictEqual(ct.nhanVat[0], 'characters')
    const ct2 = pj.phanTichMau({ camera: { shot: 'wide shot' }, style: 's' })
    assert.strictEqual(ct2.chinh, null, 'camera.shot KHÔNG được coi là khoá nội dung')
  })

  await kiem('sinh toàn bộ: MỖI prompt là JSON một dòng, CÙNG khoá & kiểu với mẫu, khoá phong cách giữ nguyên', () => {
    const mau = pj.docMauJson(MAU_JSON).mau
    const ds = promptAnh.taoTatCaPromptJson(canhJ, mau, { khoNhanVat: khoNV })
    assert.ok(ds.length >= 1)
    assert.strictEqual(promptAnh.kiemTraLienTuc(ds).ok, true)
    const txt = promptAnh.xuatPromptsTxt(ds)
    assert.strictEqual(txt.trim().split('\n').length, ds.length, 'prompts.txt: đúng một dòng mỗi prompt')
    const khoaCay = (o) => Object.keys(o).sort().map((k) => k + (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? '{' + khoaCay(o[k]) + '}' : '')).join(',')
    for (const p of ds) {
      const o = JSON.parse(p.prompt)
      assert.strictEqual(khoaCay(o), khoaCay(mau), 'cấu trúc khoá phải y hệt mẫu')
      assert.strictEqual(o.style, mau.style)
      assert.deepStrictEqual(o.camera, mau.camera)
      assert.strictEqual(o.negative_prompt, mau.negative_prompt)
      assert.ok(Array.isArray(o.characters), 'characters giữ KIỂU mảng như mẫu')
      assert.ok(!o.scene_description.includes('shepherd'), 'không được giữ chủ thể của mẫu')
      assert.notStrictEqual(o.setting, mau.setting, 'bối cảnh của mẫu không được lan sang mọi cảnh')
    }
    const c1 = JSON.parse(ds[0].prompt)
    assert.ok(c1.scene_description.startsWith('Moses stood before Pharaoh'))
    assert.deepStrictEqual(c1.characters, [khoNV[0].moTa], 'mô tả nhân vật chèn NGUYÊN VĂN')
  })

  await kiem('ĐỔI mẫu rồi sinh lại thì ra prompt theo mẫu MỚI (lỗi "sinh lại không được")', () => {
    const mau1 = pj.docMauJson(MAU_JSON).mau
    const mau2 = { prompt: 'x', art_style: 'charcoal sketch, high contrast', ratio: '16:9' }
    const a = promptAnh.taoTatCaPromptJson(canhJ, mau1, {})
    const b = promptAnh.taoTatCaPromptJson(canhJ, mau2, {})
    const o2 = JSON.parse(b[0].prompt)
    assert.deepStrictEqual(Object.keys(o2), ['prompt', 'art_style', 'ratio'])
    assert.strictEqual(o2.art_style, 'charcoal sketch, high contrast')
    assert.notStrictEqual(a[0].prompt, b[0].prompt)
    // Mẫu không có khoá nội dung nào → thêm khoá "scene" rõ nghĩa, không đè khoá phong cách.
    const o3 = JSON.parse(promptAnh.taoTatCaPromptJson(canhJ, { style: 'watercolor', aspect_ratio: '16:9' }, {})[0].prompt)
    assert.strictEqual(o3.style, 'watercolor'); assert.ok(o3.scene.startsWith('Moses'))
  })

  await kiem('giao diện: nút Sinh tự lưu ô style và hỏi bỏ kết quả Claude viết theo mẫu cũ', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'ui', 'app.js'), 'utf8')
    const than = app.slice(app.indexOf("$('#nut-tao-prompt').onclick"), app.indexOf("$('#nut-xuat-prompt').onclick"))
    assert.ok(/await luuStyleTuO\(\)/.test(than), 'phải lưu style trước khi sinh')
    assert.ok(/styleCuaKetQuaClaude !== dauVanStyle\(\)/.test(than), 'phải phát hiện kết quả Claude theo mẫu cũ')
    const chep = app.slice(app.indexOf("$('#nut-prompt-mo-ta').onclick"), app.indexOf("$('#nut-doc-mo-ta').onclick"))
    assert.ok(/await luuStyleTuO\(\)/.test(chep), 'chép prompt lô cũng phải dùng style đang gõ')
  })

  await kiem('prompt gửi Claude theo mẫu JSON: kèm nguyên mẫu, dặn cùng khoá, định dạng "[n] {JSON một dòng}"', () => {
    const mau = pj.docMauJson(MAU_JSON).mau
    const p = pj.taoPromptJsonTheoMau(canhJ, mau, { khoNhanVat: khoNV, coAnhMau: true })
    assert.ok(p.includes('"scene_description"') && p.includes('"negative_prompt"'))
    assert.ok(p.includes('Không thêm khoá, không bớt khoá'))
    assert.ok(p.includes(`[${canhJ[0].so}] {`))
    assert.ok(p.includes(khoNV[0].moTa) && /ĐÍNH KÈM/.test(p))
  })

  await kiem('đọc JSON Claude trả về: một dòng, xuống dòng, khối mã, mảng có "so"; báo cảnh lệch khoá / JSON hỏng', () => {
    const mau = { scene: 'x', style: 's', camera: { angle: 'a' } }
    const tra = [
      'Here you go:',
      '```json',
      '[1] {"scene": "Moses before Pharaoh", "style": "s", "camera": {"angle": "low"}}',
      '[2] {',
      '  "scene": "red river at dawn",',
      '  "style": "s",',
      '  "camera": { "angle": "high" }',
      '}',
      '[3] {"scene": "fishermen", "style": "s"}',
      '[4] {"scene": "broken", "style": }',
      '```'
    ].join('\n')
    const kq = pj.docTraLoiJson(tra, mau)
    assert.strictEqual(kq.soDoc, 3)
    assert.strictEqual(kq.prompt[2], '{"scene":"red river at dawn","style":"s","camera":{"angle":"high"}}', 'JSON xuống dòng phải được thu về MỘT dòng')
    assert.ok(kq.loiCanh.some((l) => /Cảnh 3: khác cấu trúc mẫu — thiếu camera/.test(l)))
    assert.ok(kq.loiCanh.some((l) => /Cảnh 4: JSON lỗi/.test(l)))
    const mang = pj.docTraLoiJson('[{"so": 7, "scene": "a", "style": "s", "camera": {"angle": "b"}}]', mau)
    assert.strictEqual(mang.prompt[7], '{"scene":"a","style":"s","camera":{"angle":"b"}}', 'bỏ trường "so" khỏi prompt')
    assert.ok(pj.docTraLoiJson('không có gì', mau).loi)
  })

  await kiem('prompt Claude viết theo mẫu dùng NGUYÊN VĂN; cảnh thiếu thì tool tự ghép JSON theo mẫu', () => {
    const mau = pj.docMauJson(MAU_JSON).mau
    const tuClaude = JSON.stringify({ ...mau, scene_description: 'Claude wrote this' })
    const ds = promptAnh.taoTatCaPromptJson(canhJ, mau, { promptThang: { 1: tuClaude } })
    assert.strictEqual(ds[0].prompt, tuClaude)
    assert.strictEqual(ds[0].dungNguyenVan, true)
    if (ds[1]) assert.strictEqual(ds[1].dungNguyenVan, false)
  })

  // =========================================================================
  nhom('45. Kịch bản Cách 2 trên ChatGPT; nạp tệp cho Prompt ảnh')

  await kiem('prompt một lần cho ChatGPT nói "canvas", cho Claude nói "artifact"; cùng dòng ## PHẦN n', () => {
    const c = kichBanMod.taoPromptMotLan({ yeuCau: { soPhan: 8 }, noiViet: 'claude' })
    const g = kichBanMod.taoPromptMotLan({ yeuCau: { soPhan: 8 }, noiViet: 'chatgpt' })
    assert.ok(c.includes('artifact') && !c.includes('canvas'))
    assert.ok(g.includes('canvas') && !/artifact/.test(g))
    for (const p of [c, g]) assert.ok(p.includes('## PHẦN <số>') && p.includes('HẾT KỊCH BẢN') && p.includes('"tiếp"'))
    assert.ok(/Nếu không mở được canvas/.test(g), 'ChatGPT không mở canvas vẫn phải ra đúng ## PHẦN n')
    assert.ok(g.includes('KHÔNG viết lại hay rút gọn các phần đã có'))
    assert.strictEqual(kichBanMod.taoPromptMotLan({ noiViet: 'la' }), kichBanMod.taoPromptMotLan({}), 'giá trị lạ thì về Claude')
  })

  await kiem('bài dán từ ChatGPT KHÔNG có canvas (nhiều câu trả lời nối nhau) vẫn tách đúng phần', () => {
    const chu = 'Sure! Here is the outline...\n\n## PHẦN 1\nFirst part text.\n\nWant me to continue?\n## PHẦN 2\nSecond part.\nHẾT KỊCH BẢN'
    const r = kichBanMod.tachPhanBanDan(chu)
    assert.strictEqual(r.phan.length, 2)
    assert.strictEqual(r.phan[1], 'Second part.')
  })

  await kiem('tệp .txt có BOM và .json đọc được; JSON dán từ Word (nháy cong “ ”) vẫn nhận', async () => {
    const d = thuMucTam('doc-tep-json')
    fs.writeFileSync(path.join(d, 'mau.txt'), '﻿{"scene": "a", "style": "b"}')
    fs.writeFileSync(path.join(d, 'mau.json'), '{"scene": "a", "style": "b"}')
    const docTepMod = require('../src/doc-tep')
    const a = await docTepMod.docTep(path.join(d, 'mau.txt'))
    assert.ok(a.vanBan.startsWith('{'), 'BOM phải bị bỏ')
    assert.strictEqual(pj.docMauJson(a.vanBan).ok, true)
    const b = await docTepMod.docTep(path.join(d, 'mau.json'))
    assert.strictEqual(pj.docMauJson(b.vanBan).ok, true)
    assert.ok(docTepMod.DUOI_HO_TRO.includes('json'))
    const word = '{“scene_description”: “The king’s hall at night”, “style”: “oil painting”}'
    assert.strictEqual(pj.trongNhuJson(word), true)
    const w = pj.docMauJson(word)
    assert.strictEqual(w.ok, true); assert.strictEqual(w.mau.scene_description, "The king's hall at night")
    // JSON hợp lệ có “ ” TRONG giá trị thì giữ nguyên, không bị "sửa" hỏng.
    assert.strictEqual(pj.docMauJson('{"scene": "he said “go”"}').mau.scene, 'he said “go”')
    const tl = pj.docTraLoiJson('[1] {“scene”: “x”}', { scene: 'a' })
    assert.strictEqual(tl.prompt[1], '{"scene":"x"}')
  })

  await kiem('.docx chứa JSON (Word tách mỗi dòng một đoạn) đọc lại thành JSON hợp lệ', async () => {
    const d = thuMucTam('docx-json')
    const dd = path.join(d, 'mau.docx')
    await require('../src/xuat-van-ban').ghiVanBan(dd, '{\n  "scene": "a",\n  "style": "oil, warm light"\n}')
    const kq = await require('../src/doc-tep').docTep(dd)
    assert.deepStrictEqual(pj.docMauJson(kq.vanBan).mau, { scene: 'a', style: 'oil, warm light' })
  })

  // =========================================================================
  nhom('46. Rà toàn bộ mối nối giao diện ↔ preload ↔ tiến trình chính')

  await kiem('mọi $("#id") trong app.js có trong index.html (hoặc do app.js tự dựng)', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'ui', 'app.js'), 'utf8')
    const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8')
    const coSan = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))
    const tuDung = new Set([...app.matchAll(/id=\\?"([a-z0-9-]+)\\?"/g)].map((m) => m[1]))
    const dung = [...new Set([...app.matchAll(/\$\('#([a-z0-9-]+)'\)/g)].map((m) => m[1]))]
    assert.deepStrictEqual(dung.filter((i) => !coSan.has(i) && !tuDung.has(i)), [])
  })

  await kiem('mọi window.api.X có trong preload; mọi kênh preload có handler ở main.js', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'ui', 'app.js'), 'utf8')
    const pre = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8')
    const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8')
    const api = new Set([...pre.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]))
    const goi = [...new Set([...app.matchAll(/window\.api\.(\w+)/g)].map((m) => m[1]))]
    assert.deepStrictEqual(goi.filter((g) => !api.has(g)), [], 'giao diện gọi hàm preload không có')
    const kenh = [...pre.matchAll(/goi\('([^']+)'/g)].map((m) => m[1])
    assert.deepStrictEqual(kenh.filter((k) => !main.includes(`ipcMain.handle('${k}'`)), [], 'kênh IPC không có handler')
  })

  await kiem('mọi id trong index.html là duy nhất (trùng id là nút này bấm ra hành động nút kia)', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8')
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1])
    assert.deepStrictEqual(ids.filter((x, i) => ids.indexOf(x) !== i), [])
  })

  // =========================================================================
  nhom('47. Workflow GitHub Actions + cấu hình đóng gói')

  await kiem('workflow: kích bằng tag v*, --publish ghi rõ, GH_TOKEN, kiểm thử trước khi đóng gói, action Node 24', () => {
    const yml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'build.yml'), 'utf8')
    assert.ok(/tags:\s*\['v\*'\]/.test(yml))
    assert.ok(/electron-builder --win --publish always/.test(yml) && /electron-builder --mac --publish always/.test(yml))
    assert.strictEqual((yml.match(/GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/g) || []).length, 2)
    assert.strictEqual((yml.match(/needs: kiem-thu/g) || []).length, 2)
    assert.ok(/permissions:\s*\n\s*contents: write/.test(yml))
    assert.ok(/CSC_IDENTITY_AUTO_DISCOVERY: false/.test(yml))
    // Node 20 đã bị GitHub khai tử (cảnh báo ở mọi lượt chạy 0.x) — dùng bản chạy Node 24.
    assert.ok(!/actions\/(checkout|setup-node|upload-artifact)@v4/.test(yml), 'còn action v4 (Node 20)')
    for (const a of ['actions/checkout@v5', 'actions/setup-node@v5', 'actions/upload-artifact@v5']) assert.ok(yml.includes(a), 'thiếu ' + a)
    assert.ok(!/\t/.test(yml), 'YAML không được có tab')
  })

  await kiem('electron-builder: phát hành thật (không nháp), mỗi target một tên tệp, đóng gói đủ src/**', () => {
    const pk = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
    const b = pk.build
    assert.strictEqual(b.publish[0].provider, 'github')
    assert.strictEqual(b.publish[0].releaseType, 'release')
    assert.ok(b.files.includes('src/**/*'))
    const ten = [b.nsis && b.nsis.artifactName, b.portable && b.portable.artifactName].filter(Boolean)
    assert.strictEqual(new Set(ten).size, ten.length, 'nsis và portable phải khác tên tệp')
    assert.ok(!('signAndEditExecutable' in (b.win || {})), 'không đặt signAndEditExecutable')
    assert.ok(/Kịch bản/.test(b.releaseInfo.releaseNotes) && /Footage/.test(b.releaseInfo.releaseNotes), 'ghi chú phát hành phải nói đúng tính năng hiện có')
  })

  // =========================================================================
  nhom('48. Từ khóa hot (0.7.0) — Trends + gợi ý + trang tìm kiếm, chấm 0–100')
  const tkh = require('../src/tu-khoa-hot')
  const { chayTuKhoaHot, CAI_DAT_MAC_DINH: TKH_MD } = require('../src/chay-tu-khoa-hot')

  await kiem('URL Trends đúng từng ký tự (gprop=youtube, property youtube, time đúng mã)', () => {
    assert.strictEqual(tkh.urlTrangTrends('bible stories', { geo: 'US', thoiGian: '90-ngay' }),
      'https://trends.google.com/trends/explore?date=today%203-m&geo=US&gprop=youtube&q=bible%20stories&hl=en-US')
    const yc = tkh.yeuCauExplore(['a', 'b', 'c', 'd', 'e', 'f'], { geo: 'US', thoiGian: '7-ngay' })
    assert.strictEqual(yc.comparisonItem.length, 5, 'Trends so sánh tối đa 5 từ khóa')
    assert.deepStrictEqual(yc.comparisonItem[0], { keyword: 'a', geo: 'US', time: 'now 7-d' })
    assert.strictEqual(yc.property, 'youtube')
    assert.strictEqual(yc.category, 0)
    const u = tkh.urlExplore(['a'], { geo: 'US', thoiGian: '12-thang' })
    assert.ok(u.startsWith('https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req='))
    assert.deepStrictEqual(JSON.parse(decodeURIComponent(u.split('req=')[1])).comparisonItem[0].time, 'today 12-m')
    const w = tkh.urlWidget('multiline', { request: { x: 1, y: 'a b' }, token: 'T/+=' })
    assert.strictEqual(w, 'https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=0&req=%7B%22x%22%3A1%2C%22y%22%3A%22a%20b%22%7D&token=T%2F%2B%3D')
    for (const k of Object.keys(TKH_MD)) if (k === 'thoiGian') assert.ok(tkh.THOI_GIAN_TRENDS[TKH_MD[k]])
  })

  await kiem('bóc ")]}\'," đầu trả lời Trends; trang chặn (HTML) → lỗi tiếng Việt', () => {
    assert.deepStrictEqual(tkh.bocTrends(")]}',\n{\"a\":1}"), { a: 1 })
    assert.throws(() => tkh.bocTrends('<html>sorry</html>'), /không phải JSON/)
    const ex = tkh.docExplore({ widgets: [{ id: 'TIMESERIES', token: 't1' }, { id: 'GEO_MAP' }, { id: 'RELATED_QUERIES', token: 't2' }] })
    assert.strictEqual(ex.thoiGian.token, 't1')
    assert.strictEqual(ex.lienQuan.length, 1)
  })

  await kiem('multiline bỏ điểm isPartial; relatedsearches tách top / rising và nhận "Breakout"', () => {
    const c = tkh.docMultiline({ default: { timelineData: [{ value: [10, 20] }, { value: [30, 40] }, { value: [99, 1], isPartial: true }] } }, 2)
    assert.deepStrictEqual(c, [[10, 30], [20, 40]])
    const lq = tkh.docLienQuan({ default: { rankedList: [
      { rankedKeyword: [{ query: 'bible stories for kids', value: 100, formattedValue: '100' }] },
      { rankedKeyword: [{ query: 'book of enoch', value: 5000, formattedValue: 'Breakout' }, { query: 'x', value: 250, formattedValue: '+250%' }] }
    ] } })
    assert.strictEqual(lq.top[0].q, 'bible stories for kids')
    assert.strictEqual(lq.rising[0].breakout, true)
    assert.strictEqual(lq.rising[1].breakout, false)
  })

  await kiem('công thức điểm: xu hướng đứng yên 50, ×2 ≈ 96→kẹp, giảm → dưới 50; view log; tổng bỏ phần thiếu', () => {
    assert.strictEqual(tkh.diemXuHuongChuoi([10, 10, 10, 10, 10, 10, 10, 10]), 50)
    assert.strictEqual(tkh.diemXuHuongChuoi([10, 10, 10, 10, 10, 10, 20, 20]), 96)
    assert.ok(tkh.diemXuHuongChuoi([20, 20, 20, 20, 20, 20, 10, 10]) < 10)
    assert.strictEqual(tkh.diemXuHuongChuoi([1, 2]), null, 'quá ít điểm thì không đoán')
    assert.strictEqual(tkh.diemView(1000), 20)
    assert.strictEqual(tkh.diemView(1e6), 80)
    assert.strictEqual(tkh.diemView(0), 0)
    assert.strictEqual(tkh.diemTong({ nhuCau: 80, xuHuong: null, coHoi: 40 }, { nhuCau: 35, xuHuong: 35, coHoi: 30 }), Math.round((80 * 35 + 40 * 30) / 65))
    assert.strictEqual(tkh.diemTong({ nhuCau: 90, xuHuong: 10, coHoi: 10 }, { nhuCau: 100, xuHuong: 0, coHoi: 0 }), 90, 'trọng số 0 = bỏ hẳn thành phần')
    assert.deepStrictEqual(tkh.nhanTuKhoa(80, 70), { nhan: 'RẤT HOT', dangTrend: true })
    assert.deepStrictEqual(tkh.nhanTuKhoa(64, 69), { nhan: 'KHÁ', dangTrend: false })
    assert.strictEqual(tkh.nhanTuKhoa(49, null).nhan, 'THƯỜNG')
    assert.strictEqual(tkh.docTuoiNgay('3 days ago'), 3)
    assert.strictEqual(tkh.docTuoiNgay('Streamed 2 weeks ago'), 14)
    assert.strictEqual(tkh.docTuoiNgay(''), null)
  })

  await kiem('Cơ hội: trừ khi view dồn 1 video viral; cộng khi kênh nhỏ thắng; không video → 0', () => {
    const deu = Array.from({ length: 10 }, () => ({ viewUoc: 50000 }))
    const lech = [{ viewUoc: 5e6 }, ...Array.from({ length: 9 }, () => ({ viewUoc: 20000 }))]
    const a = tkh.diemCoHoi(deu)
    const b = tkh.diemCoHoi(lech)
    assert.strictEqual(a.viewTrungVi, 50000)
    assert.ok(b.diem < a.diem, 'một video viral kéo không được coi là cơ hội tốt')
    const kenhNho = deu.map((v, i) => ({ ...v, subKenh: i < 5 ? 20000 : 5e6 }))
    const c = tkh.diemCoHoi(kenhNho)
    assert.strictEqual(c.tyLeKenhNhoThang, 0.5)
    assert.ok(c.diem > a.diem)
    assert.deepStrictEqual(tkh.diemCoHoi([]), { diem: 0, viewTrungVi: 0, soVideo: 0, tyLeKenhNhoThang: null })
  })

  await kiem('gom ứng viên: loại trừ, số từ tối thiểu, bắt buộc chứa lĩnh vực (số ít/nhiều), breakout lên đầu', () => {
    const ds = tkh.gomUngVien({
      hatGiong: ['bible stories'],
      goiY: [{ tienTo: 'bible stories', ds: ['bible stories for kids', 'bible story of david', 'bible stories song', 'cooking pasta'] },
        { tienTo: 'bible stories a', ds: ['bible stories for kids', 'bible stories adam and eve'] }],
      lienQuan: [{ hatGiong: 'bible stories', top: [], rising: [{ q: 'book of enoch bible', v: 5000, breakout: true }] }]
    }, { soTuToiThieu: 2, tuLoaiTru: ['song'], batBuocChuaLinhVuc: true })
    const tu = ds.map((d) => d.tuKhoa)
    assert.strictEqual(tu[0], 'book of enoch bible', 'breakout phải đứng đầu')
    assert.ok(tu.includes('bible story of david'), '"story" khớp "stories"? — khớp qua "bible"')
    assert.ok(!tu.includes('bible stories song'), 'từ loại trừ')
    assert.ok(!tu.includes('cooking pasta'), 'không chứa từ lĩnh vực')
    const kids = ds.find((d) => d.tuKhoa === 'bible stories for kids')
    assert.strictEqual(kids.soTienTo, 2)
    assert.strictEqual(kids.viTriTot, 1)
    assert.ok(kids.diemGoiY > ds.find((d) => d.tuKhoa === 'bible stories adam and eve').diemGoiY)
    assert.strictEqual(tkh.cacTienTo('x', { moRongAZ: true }).length, 27)
    assert.deepStrictEqual(tkh.cacTienTo('x', { moRongAZ: false }), ['x'])
  })

  await kiem('lô Trends có mỏ neo: mỗi lô ≤ 5, quy chéo về cùng thang đúng tỉ lệ', () => {
    const lo = tkh.chiaLoTrends(['neo', 'a', 'b', 'c', 'd', 'e', 'f'], 'neo')
    assert.deepStrictEqual(lo, [['neo', 'a', 'b', 'c', 'd'], ['neo', 'e', 'f']])
    // Lô 2: Trends chuẩn hoá riêng nên mỏ neo ra 20 thay vì 40 → e thật = 30 × 2 = 60 (theo thang lô 1).
    const muc = tkh.quyVeMotThang([
      { tuKhoa: ['neo', 'a'], trungBinh: [40, 80], tbMoNeo: 40 },
      { tuKhoa: ['neo', 'e'], trungBinh: [20, 30], tbMoNeo: 20 }
    ])
    // neo chung = 30 → hệ số lô 1 = 0,75, lô 2 = 1,5 → a = 60, e = 45, neo = 30 → chia max 60
    assert.deepStrictEqual(muc, { neo: 50, a: 100, e: 75 })
    assert.ok(muc.e / muc.a === 0.75, 'tỉ lệ e/a = 60/80 phải giữ nguyên sau quy đổi')
  })

  // --- Chạy cả chuỗi bằng dữ liệu giả ---
  const trangTimGia = (views) => ({ khoi: { contents: views.map((v, i) => ({ videoRenderer: {
    videoId: ('vid' + i + 'xxxxxxxxxxx').slice(0, 11), title: { runs: [{ text: 'Video ' + i }] },
    viewCountText: { simpleText: v + ' views' }, publishedTimeText: { simpleText: (i + 1) + ' days ago' }, lengthText: { simpleText: '12:30' },
    longBylineText: { runs: [{ text: 'Kênh ' + i, navigationEndpoint: { browseEndpoint: { browseId: 'UC' + i } } }] }
  } })) } })
  const goiYGia = async (chuoi) => chuoi === 'bible stories'
    ? ['bible stories for kids', 'bible stories explained', 'bible stories song']
    : (chuoi.endsWith(' a') ? ['bible stories adam and eve'] : [])
  const taoTrendsGia = ({ loi429 = false } = {}) => {
    const nhat = []
    return {
      nhat,
      mo: async (url) => { nhat.push('MO ' + url) },
      goi: async (url) => {
        nhat.push(url)
        if (loi429) throw new Error('Google Trends giới hạn tần suất (429)')
        if (url.includes('/api/explore')) {
          const req = JSON.parse(decodeURIComponent(url.split('req=')[1].split('&')[0]))
          const n = req.comparisonItem.length
          return ")]}'\n" + JSON.stringify({ widgets: [
            { id: 'TIMESERIES', token: 'tok-t', request: { n } },
            { id: 'RELATED_QUERIES', token: 'tok-r', request: { kw: req.comparisonItem[0].keyword } }] })
        }
        if (url.includes('/widgetdata/relatedsearches')) {
          return ")]}',\n" + JSON.stringify({ default: { rankedList: [{ rankedKeyword: [] },
            { rankedKeyword: [{ query: 'bible stories end times', value: 9000, formattedValue: 'Breakout' }] }] } })
        }
        if (url.includes('/widgetdata/multiline')) {
          const n = JSON.parse(decodeURIComponent(url.split('req=')[1].split('&')[0])).n
          // Từ khóa thứ i (i ≥ 1) tăng dần về cuối; mỏ neo đi ngang.
          const tl = Array.from({ length: 12 }, (_, t) => ({ value: Array.from({ length: n }, (_, i) => i === 0 ? 40 : (t < 9 ? 20 : 20 + 10 * i)) }))
          return ")]}'\n" + JSON.stringify({ default: { timelineData: tl } })
        }
        throw new Error('URL lạ ' + url)
      }
    }
  }

  await kiem('chạy đủ chuỗi có Trends: gom từ khóa, chấm 0–100, Breakout ≥ 95, sắp theo điểm, nguồn ghi rõ', async () => {
    const tr = taoTrendsGia()
    const tienDo = []
    const kq = await chayTuKhoaHot({
      linhVuc: 'bible stories',
      caiDat: { soTuKhoa: 10, moRongAZ: true },
      layGoiY: goiYGia,
      trends: tr,
      docTrangTim: async () => trangTimGia(['120K', '80K', '45K', '30K', '9K']),
      ngu: async () => {},
      baoTienDo: (t) => tienDo.push(t.phanTram)
    })
    assert.strictEqual(kq.coTrends, true)
    assert.ok(tr.nhat[0].startsWith('MO https://trends.google.com/trends/explore?'), 'phải mở trang Trends trước khi gọi API')
    const tu = kq.dong.map((d) => d.tuKhoa)
    assert.ok(tu.includes('bible stories end times') && tu.includes('bible stories for kids') && tu.includes('bible stories'))
    assert.ok(!tu.includes('bible stories song'), 'từ loại trừ mặc định')
    for (const d of kq.dong) {
      assert.ok(d.diem >= 0 && d.diem <= 100 && Number.isInteger(d.diem), d.tuKhoa + ' điểm ' + d.diem)
      assert.ok(['RẤT HOT', 'HOT', 'KHÁ', 'THƯỜNG'].includes(d.nhan))
    }
    const bo = kq.dong.find((d) => d.tuKhoa === 'bible stories end times')
    assert.ok(bo.breakout && bo.xuHuong >= 95 && bo.dangTrend && bo.nguonXuHuong === 'Trends: Breakout')
    assert.ok(kq.dong.find((d) => d.tuKhoa === 'bible stories').laHatGiong)
    assert.strictEqual(kq.dong.find((d) => d.tuKhoa === 'bible stories').nguonXuHuong, 'Google Trends')
    assert.ok(kq.dong.every((d, i) => i === 0 || kq.dong[i - 1].diem >= d.diem), 'sắp giảm dần theo điểm')
    assert.ok(kq.dong[0].chuoi.length === 12 && kq.dong[0].viewTrungVi === 45000)
    assert.ok(tienDo.every((p, i) => i === 0 || p >= tienDo[i - 1]), 'thanh tiến độ không được lùi')
    assert.deepStrictEqual(kq.canhBao, [])
  })

  await kiem('Trends 429 → vẫn chạy bằng gợi ý + trang YouTube, ghi rõ nguồn xu hướng và cảnh báo', async () => {
    const kq = await chayTuKhoaHot({
      linhVuc: 'bible stories',
      caiDat: { soTuKhoa: 6, moRongAZ: false },
      layGoiY: goiYGia,
      trends: taoTrendsGia({ loi429: true }),
      docTrangTim: async () => trangTimGia(['2M', '500K', '300K', '100K']),
      ngu: async () => {}
    })
    assert.strictEqual(kq.coTrends, false)
    assert.ok(/429/.test(kq.loiTrends))
    assert.ok(kq.canhBao.some((c) => /Google Trends không dùng được/.test(c)))
    assert.ok(kq.dong.length >= 2)
    for (const d of kq.dong) {
      assert.strictEqual(d.nguonXuHuong, 'ước từ video mới (không có Trends)')
      assert.ok(Number.isFinite(d.xuHuong) && Number.isFinite(d.coHoi) && Number.isFinite(d.nhuCau))
      assert.ok(d.xuHuong <= 90, 'ước không có Trends không được lên vùng Breakout (95–100)')
    }
    assert.ok(kq.dong.find((d) => d.laHatGiong).nhuCau >= 60, 'hạt giống có video 100K–2M phải có Nhu cầu cao, không bị kéo về 0')
  })

  await kiem('không Trends, không trang YouTube → chỉ gợi ý: không vỡ, cột thiếu để null (hiện "—")', async () => {
    const kq = await chayTuKhoaHot({
      linhVuc: 'bible stories', caiDat: { dungTrends: false, dungTrangYouTube: false, moRongAZ: false },
      layGoiY: goiYGia, ngu: async () => {}
    })
    assert.ok(kq.dong.length >= 2)
    assert.ok(kq.dong.every((d) => d.xuHuong === null && d.coHoi === null))
    assert.ok(kq.dong.filter((d) => !d.laHatGiong).every((d) => d.diem === d.nhuCau && d.nhuCau > 0))
    const hg = kq.dong.find((d) => d.laHatGiong)
    assert.strictEqual(hg.nhuCau, null, 'hạt giống không có trong gợi ý của chính nó → "không có dữ liệu", không phải 0')
  })

  await kiem('API sub kênh ghép đúng: view thật thay view ước, tỉ lệ kênh nhỏ thắng có số', async () => {
    const kq = await chayTuKhoaHot({
      linhVuc: 'bible stories', caiDat: { dungTrends: false, moRongAZ: false, soTuKhoa: 2 },
      layGoiY: goiYGia,
      docTrangTim: async () => trangTimGia(['10K', '10K', '10K', '10K']),
      soLieuApi: async (ids) => ({
        video: ids.map((id, i) => ({ videoId: id, kenhId: 'UC' + i, views: 77777 })),
        kenh: new Map(ids.map((_, i) => ['UC' + i, { subKenh: i % 2 ? 50000 : 2e6 }]))
      }),
      ngu: async () => {}
    })
    const d = kq.dong[0]
    assert.strictEqual(d.viewTrungVi, 77777)
    assert.strictEqual(d.tyLeKenhNhoThang, 0.5)
    assert.ok(/Đã lấy sub kênh/.test(kq.ghiChuApi))
  })

  await kiem('bấm Dừng → ném "Đã dừng." (không chấm nửa vời); lĩnh vực trống → lỗi tiếng Việt', async () => {
    let n = 0
    await assert.rejects(chayTuKhoaHot({ linhVuc: 'bible stories', layGoiY: goiYGia, daHuy: () => ++n > 3, ngu: async () => {} }), /Đã dừng/)
    await assert.rejects(chayTuKhoaHot({ linhVuc: '  ', layGoiY: goiYGia }), /Nhập lĩnh vực/)
  })

  await kiem('gọi trong trang chỉ nhận API Trends (không cho cửa sổ ẩn gọi URL tuỳ ý)', () => {
    const s = trinhDuyet.scriptGoiTrongTrang('https://trends.google.com/trends/api/explore?x=1')
    assert.ok(s.includes("credentials: 'include'") || s.includes('credentials:"include"') || /credentials/.test(s))
    assert.throws(() => trinhDuyet.scriptGoiTrongTrang('https://evil.example.com/trends/api/'))
    assert.throws(() => trinhDuyet.scriptGoiTrongTrang('https://www.google.com/search?q=1'))
    assert.throws(() => trinhDuyet.scriptGoiTrongTrang('https://trends.google.com.evil.com/trends/api/x'))
  })

  await kiem('giao diện: đủ ô tinh chỉnh ngay trong mục, khoá cài đặt tuKhoaHot', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8')
    for (const id of ['tk-geo', 'tk-thoi-gian', 'tk-so-tu-khoa', 'tk-so-tu-toi-thieu', 'tk-tu-loai-tru', 'tk-ts-nhu-cau', 'tk-ts-xu-huong',
      'tk-ts-co-hoi', 'tk-mo-rong-az', 'tk-chua-linh-vuc', 'tk-dung-trends', 'tk-dung-trang-yt', 'tk-dung-api', 'nut-tra-tu-khoa', 'bang-tu-khoa']) {
      assert.ok(html.includes(`id="${id}"`), 'thiếu #' + id)
    }
    const { CAI_DAT_MAC_DINH } = require('../src/store')
    assert.deepStrictEqual(CAI_DAT_MAC_DINH.tuKhoaHot, {})
    const pk = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
    assert.ok(/^\d+\.\d+\.\d+$/.test(pk.version))
    assert.ok(/Từ khóa hot/.test(pk.build.releaseInfo.releaseNotes))
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
