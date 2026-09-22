// Kho dự án: mỗi video là một thư mục, chứa lời thoại gốc, các bản kịch bản,
// danh sách cảnh và các tệp xuất ra.
//
// Ghi ra tệp thật chứ không giữ trong bộ nhớ, vì một dự án kéo dài nhiều ngày:
// hôm nay bóc lời thoại, mai xin Claude viết phần 1-4, mốt viết nốt. Đóng app
// giữa chừng không được mất gì.

const fs = require('fs')
const path = require('path')

function anToanTen(ten) {
  return String(ten || 'du-an')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // bỏ dấu tiếng Việt
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60) || 'du-an'
}

function taoKhoDuAn(thuMucDuLieu) {
  const goc = path.join(thuMucDuLieu, 'du-an')

  function duongDan(ma, ...phan) {
    return path.join(goc, ma, ...phan)
  }

  function docHoSo(ma) {
    try {
      return JSON.parse(fs.readFileSync(duongDan(ma, 'ho-so.json'), 'utf8'))
    } catch (_) {
      return null
    }
  }

  function ghiHoSo(ma, hoSo) {
    fs.mkdirSync(duongDan(ma), { recursive: true })
    const tam = duongDan(ma, 'ho-so.json.tam')
    fs.writeFileSync(tam, JSON.stringify(hoSo, null, 2), 'utf8')
    fs.renameSync(tam, duongDan(ma, 'ho-so.json'))
    return hoSo
  }

  return {
    goc,

    danhSach() {
      let ten
      try {
        ten = fs.readdirSync(goc, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
      } catch (_) {
        return []
      }
      return ten
        .map((ma) => docHoSo(ma))
        .filter(Boolean)
        .sort((a, b) => (b.suaLuc || 0) - (a.suaLuc || 0))
    },

    tao(ten, thongTin = {}) {
      const goc2 = anToanTen(ten)
      let ma = goc2
      let n = 2
      while (fs.existsSync(duongDan(ma))) { ma = `${goc2}-${n}`; n++ }

      const hoSo = {
        ma,
        ten: String(ten || ma).trim(),
        taoLuc: Date.now(),
        suaLuc: Date.now(),
        nguon: thongTin.nguon || [],
        soTuLoiThoai: 0,
        soBanKichBan: 0,
        soCanh: 0,
        ...thongTin
      }
      fs.mkdirSync(duongDan(ma), { recursive: true })
      return ghiHoSo(ma, hoSo)
    },

    doc: docHoSo,

    capNhat(ma, thayDoi) {
      const cu = docHoSo(ma)
      if (!cu) return null
      return ghiHoSo(ma, { ...cu, ...thayDoi, suaLuc: Date.now() })
    },

    xoa(ma) {
      // Chỉ xoá đúng thư mục dự án, và chỉ khi nó thật sự nằm trong kho.
      const dich = duongDan(ma)
      if (!path.resolve(dich).startsWith(path.resolve(goc))) return false
      fs.rmSync(dich, { recursive: true, force: true })
      return true
    },

    // --- Lời thoại ---------------------------------------------------------
    ghiLoiThoai(ma, vanBan, sieuDuLieu = {}) {
      fs.mkdirSync(duongDan(ma), { recursive: true })
      fs.writeFileSync(duongDan(ma, 'loi-thoai-goc.md'), vanBan, 'utf8')
      this.capNhat(ma, {
        soTuLoiThoai: (vanBan.match(/\S+/g) || []).length,
        nguon: sieuDuLieu.nguon || (docHoSo(ma) || {}).nguon || []
      })
      return duongDan(ma, 'loi-thoai-goc.md')
    },

    docLoiThoai(ma) {
      try {
        return fs.readFileSync(duongDan(ma, 'loi-thoai-goc.md'), 'utf8')
      } catch (_) {
        return ''
      }
    },

    // --- Kịch bản: LƯU THEO PHIÊN BẢN, không bao giờ ghi đè -----------------
    //
    // Viết 11.000 từ qua 8 lượt dán, sửa tới sửa lui. Ghi đè một lần là mất
    // công cả buổi và không lấy lại được.
    ghiKichBan(ma, vanBan) {
      fs.mkdirSync(duongDan(ma), { recursive: true })
      const co = this.cacBanKichBan(ma)
      const soMoi = co.length + 1
      const ten = `kich-ban-v${soMoi}.md`
      fs.writeFileSync(duongDan(ma, ten), vanBan, 'utf8')
      this.capNhat(ma, { soBanKichBan: soMoi, soTuKichBan: (vanBan.match(/\S+/g) || []).length })
      return { ten, duongDan: duongDan(ma, ten), phienBan: soMoi }
    },

    cacBanKichBan(ma) {
      try {
        return fs.readdirSync(duongDan(ma))
          .filter((t) => /^kich-ban-v\d+\.md$/.test(t))
          .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
      } catch (_) {
        return []
      }
    },

    docKichBan(ma, ten) {
      const cac = this.cacBanKichBan(ma)
      const chon = ten || cac[cac.length - 1]
      if (!chon) return ''
      try {
        return fs.readFileSync(duongDan(ma, chon), 'utf8')
      } catch (_) {
        return ''
      }
    },

    // --- Các phần đang viết dở ---------------------------------------------
    ghiCacPhan(ma, cacPhan) {
      fs.mkdirSync(duongDan(ma), { recursive: true })
      fs.writeFileSync(duongDan(ma, 'cac-phan.json'), JSON.stringify(cacPhan, null, 2), 'utf8')
      this.capNhat(ma, { soPhanDaViet: cacPhan.filter(Boolean).length })
    },

    docCacPhan(ma) {
      try {
        return JSON.parse(fs.readFileSync(duongDan(ma, 'cac-phan.json'), 'utf8'))
      } catch (_) {
        return []
      }
    },

    ghiDanY(ma, chuTho, daPhanTich) {
      fs.mkdirSync(duongDan(ma), { recursive: true })
      fs.writeFileSync(duongDan(ma, 'dan-y.json'),
        JSON.stringify({ chuTho, phan: daPhanTich }, null, 2), 'utf8')
    },

    docDanY(ma) {
      try {
        return JSON.parse(fs.readFileSync(duongDan(ma, 'dan-y.json'), 'utf8'))
      } catch (_) {
        return { chuTho: '', phan: [] }
      }
    },

    // --- Tệp bất kỳ --------------------------------------------------------
    ghiTep(ma, ten, noiDung) {
      fs.mkdirSync(duongDan(ma), { recursive: true })
      fs.writeFileSync(duongDan(ma, ten), noiDung, 'utf8')
      return duongDan(ma, ten)
    },

    docTep(ma, ten) {
      try {
        return fs.readFileSync(duongDan(ma, ten), 'utf8')
      } catch (_) {
        return ''
      }
    },

    duongDan
  }
}

module.exports = { taoKhoDuAn, anToanTen }
