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
