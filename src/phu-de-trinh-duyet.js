// Lấy phụ đề QUA TRÌNH DUYỆT TRONG APP — đường dự phòng khi yt-dlp bị YouTube
// đòi "PO token".
//
// NGUYÊN NHÂN THẬT (0.9.2): YouTube đang bật một thử nghiệm cho MỘT SỐ video —
// thường cả kênh một lúc, nên mới có chuyện "kênh này hỏng, kênh khác vẫn
// được". Với các video đó, link phụ đề mang cờ `exp=xpe`/`exp=xpv`: muốn tải thì
// phải kèm một "PO token", mà token này chỉ trình duyệt thật sinh ra được (mã
// chống bot BotGuard của YouTube chạy trong trang). yt-dlp không có trình duyệt
// nên bỏ các bản phụ đề đó và báo "missing subtitles … PO token was not
// provided". Đổi client hay cập nhật yt-dlp cũng không sinh được token.
//
// Cách làm ở đây: mở trang video trong một cửa sổ ẨN của chính app (Chromium
// thật), bật phụ đề trong trình phát như người xem bấm nút CC, để trình phát
// TỰ tạo link có token. Bắt link đó ngay trong trang, rồi tải bản json3 từ bên
// trong trang — cùng phiên, cùng cookie.

// Các tham số mô tả BẢN phụ đề — không chép từ link bắt được sang, vì trình
// phát có thể đang hiện một bản khác (ngôn ngữ khác, bản dịch…).
const KHOA_CUA_BAN = ['lang', 'kind', 'name', 'tlang', 'fmt']

// Chọn bản phụ đề: bản người làm tay đúng ngôn ngữ trước, rồi bản tự động. Hàm thuần.
function chonBanPhuDe(cacBan, ngonNgu) {
  const ds = (cacBan || []).filter((b) => b && b.baseUrl)
  const dung = (b) => String(b.languageCode || '').toLowerCase().split('-')[0] === ngonNgu
  return ds.find((b) => dung(b) && b.kind !== 'asr') || ds.find(dung) || null
}

// Ghép link tải: link gốc của bản đã chọn + các tham số trình phát thêm vào
// (pot, potc, c, cver…) lấy từ link bắt được. Ép json3. Hàm thuần.
function ghepLinkPhuDe(baseUrl, linkBatDuoc) {
  const dich = new URL(baseUrl, 'https://www.youtube.com')
  if (linkBatDuoc) {
    for (const [k, v] of new URL(linkBatDuoc, 'https://www.youtube.com').searchParams) {
      if (!KHOA_CUA_BAN.includes(k) && !dich.searchParams.has(k)) dich.searchParams.set(k, v)
    }
  }
  dich.searchParams.set('fmt', 'json3')
  return dich.toString()
}

// Script chạy TRONG trang xem video. Trả về chuỗi JSON. Hai hàm thuần ở trên
// được nhúng nguyên văn để trong trang và trong kiểm thử chạy cùng một mã.
//
// Bắt link: chặn XMLHttpRequest.open / fetch của trang để ghi lại link
// timedtext trình phát gọi. KHÔNG dùng performance.getEntriesByType — đã thử
// trên trang thật (10/2026): YouTube xoá danh sách đó, link không bao giờ hiện.
// Trình phát đã nạp phụ đề TRƯỚC khi script chạy (tài khoản bật "luôn hiện phụ
// đề") thì nó không gọi lại nữa — nên gỡ rồi nạp lại mô-đun captions để ép nó
// gọi lần nữa, lần này đi qua chỗ chặn.
function scriptLayPhuDe(videoId, ngonNgu, { soLuot = 40 } = {}) {
  return `(async function () {
  var KHOA_CUA_BAN = ${JSON.stringify(KHOA_CUA_BAN)};
  ${chonBanPhuDe.toString()}
  ${ghepLinkPhuDe.toString()}
  var VID = ${JSON.stringify(videoId)};
  var NGU = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var tra = function (o) { return JSON.stringify(o); };

  // Chặn trước khi đụng vào trình phát. Giữ fetch gốc để chính tool tải không
  // bị ghi lẫn vào danh sách.
  var batDuoc = [];
  var ghi = function (u) { u = String(u || ''); if (u.indexOf('/api/timedtext') >= 0 && u.indexOf('v=' + VID) >= 0) batDuoc.push(u); };
  var fetchGoc = window.fetch;
  var moGoc = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { try { ghi(u); } catch (e) {} return moGoc.apply(this, arguments); };
  window.fetch = function (u) { try { ghi(typeof u === 'string' ? u : u && u.url); } catch (e) {} return fetchGoc.apply(this, arguments); };
  var goChan = function () { XMLHttpRequest.prototype.open = moGoc; window.fetch = fetchGoc; };

  async function tai(url) {
    try {
      var r = await fetchGoc.call(window, url, { credentials: 'include' });
      var t = await r.text();
      return r.ok && t.indexOf('"events"') >= 0 ? t : '';
    } catch (e) { return ''; }
  }

  try {
    // Đợi trình phát nạp xong ĐÚNG video này.
    var tp = null, pr = null;
    for (var i = 0; i < 40 && !pr; i++) {
      tp = document.getElementById('movie_player');
      try {
        var p = tp && tp.getPlayerResponse && tp.getPlayerResponse();
        if (p && p.videoDetails && p.videoDetails.videoId === VID) pr = p;
      } catch (e) {}
      if (!pr) await NGU(500);
    }
    if (!pr) return tra({ loi: 'Trang video chưa nạp được trình phát (mạng chậm hoặc YouTube đòi xác minh).' });

    var vd = pr.videoDetails || {};
    var info = { tieuDe: vd.title || '', tenKenh: vd.author || '', thoiLuongGiay: Number(vd.lengthSeconds) || 0 };
    var ps = pr.playabilityStatus || {};
    if (ps.status && ps.status !== 'OK') return tra(Object.assign({ loi: 'Video không xem được: ' + (ps.reason || ps.status) }, info));

    var cacBan = (((pr.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || [];
    if (!cacBan.length) return tra(Object.assign({ khongCoGi: true }, info));
    var ban = chonBanPhuDe(cacBan, ${JSON.stringify(ngonNgu)});
    if (!ban) return tra(Object.assign({ khongCoNgonNgu: true }, info));

    // Bản không bị đòi token thì tải thẳng, khỏi bật trình phát.
    if (!/[?&]exp=xp[ev]/.test(ban.baseUrl)) {
      var thang = await tai(ghepLinkPhuDe(ban.baseUrl, null));
      if (thang) return tra(Object.assign({ tho: thang, cach: 'tai-thang' }, info));
    }

    // Bật (lại) phụ đề để trình phát tự sinh link có PO token.
    var daThu = {};
    for (var j = 0; j < ${Number(soLuot)}; j++) {
      var boQua = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern');
      if (boQua) boQua.click();
      try { tp.mute(); tp.playVideo(); } catch (e) {}
      if (j % 8 === 0) {
        try { tp.unloadModule('captions'); } catch (e) {}
        await NGU(300);
        try {
          tp.loadModule('captions');
          tp.setOption('captions', 'track', { languageCode: ban.languageCode, kind: ban.kind });
        } catch (e) {}
      }
      if (j === 4) {
        var nutCC = document.querySelector('.ytp-subtitles-button');
        if (nutCC && nutCC.getAttribute('aria-pressed') !== 'true') nutCC.click();
      }
      for (var k = batDuoc.length - 1; k >= 0; k--) {
        if (daThu[batDuoc[k]]) continue;
        daThu[batDuoc[k]] = true;
        var tho = await tai(ghepLinkPhuDe(ban.baseUrl, batDuoc[k]));
        if (tho) return tra(Object.assign({ tho: tho, cach: 'po-token' }, info));
      }
      await NGU(700);
    }
    return tra(Object.assign({ loi: 'Bật phụ đề trong trình phát mà không bắt được link phụ đề (có thể đang vướng quảng cáo dài).' }, info));
  } finally {
    goChan();
    try { tp.pauseVideo(); } catch (e) {}
  }
})()`
}

// Mở trang video trong trình đọc ẩn (phiên của tài khoản đã chọn, không chọn
// thì phiên khách) rồi chạy script trên. Trả về đúng dạng ytDlp.layPhuDe.
async function layQuaTrinhDuyet({ quanLyDuyet, taiKhoanId, videoId, ngonNgu = 'en', baoTienDo = () => {} }) {
  const trinhDoc = quanLyDuyet.taoTrinhDoc(taiKhoanId)
  try {
    baoTienDo({ phanTram: 80, viec: 'Lấy phụ đề', chiTiet: `${videoId} · mở video trong trình duyệt của app` })
    await trinhDoc.mo(`https://www.youtube.com/watch?v=${videoId}`)
    baoTienDo({ phanTram: 88, viec: 'Lấy phụ đề', chiTiet: `${videoId} · bật phụ đề trong trình phát` })
    const kq = JSON.parse(await trinhDoc.chayScript(scriptLayPhuDe(videoId, ngonNgu)))
    if (kq.khongCoGi) throw new Error('Video này không có phụ đề nào (kể cả phụ đề tự động).')
    if (kq.khongCoNgonNgu) throw new Error(`Video có phụ đề nhưng KHÔNG có bản tiếng "${ngonNgu}".`)
    if (kq.loi) throw new Error(kq.loi)
    return {
      videoId,
      tieuDe: kq.tieuDe,
      tenKenh: kq.tenKenh,
      thoiLuongGiay: kq.thoiLuongGiay,
      dinhDang: 'json3',
      tho: kq.tho,
      cach: kq.cach
    }
  } finally {
    trinhDoc.dong()
  }
}

// yt-dlp trước; hỏng thì đi đường trình duyệt. Hai hàm lấy được truyền vào để
// kiểm thử tầng 1 chạy được mà không cần yt-dlp hay Electron.
async function layCoDuPhong({ layYtDlp, layTrinhDuyet, nhatKy, videoId }) {
  try {
    return await layYtDlp()
  } catch (e) {
    // Video thật sự không có phụ đề (hoặc không có tiếng cần lấy) thì trình
    // duyệt cũng không làm ra được — khỏi mở thêm cửa sổ.
    if (!layTrinhDuyet || e.khongCoGi || e.khongCoNgonNgu) throw e
    nhatKy.canhBao(`yt-dlp không lấy được phụ đề ${videoId}: ${e.message} → thử qua trình duyệt trong app.`)
    try {
      const kq = await layTrinhDuyet()
      nhatKy.tin(`Phụ đề ${videoId}: lấy qua trình duyệt trong app (${kq.cach}).`)
      return kq
    } catch (e2) {
      const loi = new Error(`${e.message} — Thử qua trình duyệt trong app cũng không được: ${e2.message}`)
      loi.canhBaoYtDlp = e.canhBaoYtDlp
      throw loi
    }
  }
}

module.exports = { chonBanPhuDe, ghepLinkPhuDe, scriptLayPhuDe, layQuaTrinhDuyet, layCoDuPhong, KHOA_CUA_BAN }
