import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';

const ROW_A = ['260px', '340px', '300px', '360px', '280px', '320px'];
const ROW_B = ['200px', '240px', '180px', '260px', '220px', '200px', '240px'];
const SHADES = ['#2A2A2A', '#333333', '#262626', '#2E2E2E', '#383838'];

const FEATURES = [
  {
    no: '01',
    tint: '#DBEAFE',
    title: 'Portfolio',
    body: 'Trang nghệ sĩ với tác phẩm nổi bật, moments, moodboard và đánh giá từ người mua.',
  },
  {
    no: '02',
    tint: '#D1FAE5',
    title: 'Bán hàng & hóa đơn',
    body: 'Tạo hóa đơn bán nhanh, khách quét QR PayOS để thanh toán, kể cả khi chưa có tài khoản.',
  },
  {
    no: '03',
    tint: '#FEF3C7',
    title: 'CRM cho nghệ sĩ',
    body: 'Danh bạ khách, phân khúc, email campaign và phòng xem riêng cho khách VIP.',
  },
  {
    no: '04',
    tint: '#FCE7F3',
    title: 'Sự kiện',
    body: 'Tổ chức triển lãm, workshop; quản lý danh sách khách mời và check-in.',
  },
];

function MarqueeRow({
  heights,
  width,
  reverse,
}: {
  heights: string[];
  width: number;
  reverse?: boolean;
}) {
  // Lặp danh sách 2 lần để dịch -50% là vòng lặp liền mạch
  const items = [...heights, ...heights];
  return (
    <div className={`marquee${reverse ? ' marquee--reverse' : ''}`}>
      <div className="marquee__track" style={{ alignItems: reverse ? 'flex-start' : 'flex-end' }}>
        {items.map((h, i) => (
          <figure key={i} style={{ width }} aria-hidden={i >= heights.length ? true : undefined}>
            <div
              className="tile"
              style={{ height: h, background: SHADES[(i + (reverse ? 2 : 0)) % SHADES.length] }}
            >
              Ảnh tác phẩm
            </div>
            <figcaption>
              <span>[Tên tác phẩm]</span>
              <span>[Nghệ sĩ]</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export function LandingPage() {
  const { status } = useAuth();
  const authed = status === 'authenticated';

  return (
    <div className="landing">
      <header className="landing__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
          <Link to="/" className="logo">
            ARTIUM
          </Link>
          <nav aria-label="Điều hướng chính" className="landing__nav">
            <a href="#discover">Khám phá</a>
            <a href="#artists">Cho nghệ sĩ</a>
            <a href="#collectors">Cho nhà sưu tầm</a>
            <a href="#features">Tính năng</a>
          </nav>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {authed ? (
            <Link to="/home" className="btn btn--primary">
              Vào ứng dụng
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn--light">
                Đăng nhập
              </Link>
              <Link to="/register" className="btn btn--primary">
                Bắt đầu miễn phí
              </Link>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="landing__hero">
          <h1>
            Sáng tác nhiều hơn,
            <br />
            <span>lo toan ít hơn,</span>
            <br />
            bán tranh dễ hơn
          </h1>
          <p>
            Kết nối với cộng đồng nghệ thuật Việt Nam — trưng bày tác phẩm, quản lý khách hàng và
            nhận thanh toán qua QR, <strong>tất cả trong một nền tảng</strong>.
          </p>
          <div className="cta-row">
            <Link to={authed ? '/home' : '/register'} className="btn btn--primary btn--lg">
              {authed ? 'Vào ứng dụng' : 'Tạo tài khoản'}
            </Link>
            <a href="#discover" className="btn btn--ghost-dark btn--lg">
              Xem tác phẩm
            </a>
          </div>
        </section>

        <section
          id="discover"
          aria-label="Tác phẩm nổi bật"
          style={{ paddingBottom: 96, display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          <MarqueeRow heights={ROW_A} width={240} />
          <MarqueeRow heights={ROW_B} width={200} reverse />
        </section>

        <div className="landing__light">
          <section className="container">
            <div className="section-head">
              <h2>Một nền tảng cho cả hai phía của tác phẩm</h2>
              <p>Dù bạn sáng tác hay sưu tầm, Artium gom mọi việc vào một chỗ.</p>
            </div>
            <div className="audience-grid">
              <article id="artists" className="audience-card">
                <div className="audience-card__img">Ảnh minh họa: trang hồ sơ nghệ sĩ</div>
                <h3>Cho nghệ sĩ &amp; gallery</h3>
                <ul>
                  <li>
                    Trang portfolio riêng tại artium.vn/<em>tên-của-bạn</em>
                  </li>
                  <li>Kho tác phẩm, hóa đơn bán nhanh có mã QR PayOS</li>
                  <li>Danh bạ khách hàng, email marketing, phòng xem riêng</li>
                </ul>
                <Link to="/register" className="btn btn--primary">
                  Đăng ký làm nghệ sĩ
                </Link>
              </article>
              <article id="collectors" className="audience-card">
                <div className="audience-card__img">Ảnh minh họa: trang khám phá</div>
                <h3>Cho nhà sưu tầm</h3>
                <ul>
                  <li>Khám phá tác phẩm, nghệ sĩ và sự kiện gần bạn</li>
                  <li>Lưu tác phẩm vào moodboard, theo dõi nghệ sĩ yêu thích</li>
                  <li>Mua trực tiếp, thanh toán an toàn qua PayOS</li>
                </ul>
                <Link to="/register" className="btn btn--dark">
                  Bắt đầu sưu tầm
                </Link>
              </article>
            </div>
          </section>

          <section id="features" className="features" aria-label="Tính năng">
            <div className="container features__grid">
              {FEATURES.map((f) => (
                <div key={f.no} className="feature">
                  <div className="feature__no" style={{ background: f.tint }}>
                    {f.no}
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="landing__cta">
          <h2>
            <span>Nghệ thuật cần được nhìn thấy.</span>
            <br />
            Bắt đầu cùng Artium.
          </h2>
          <Link to={authed ? '/home' : '/register'} className="btn btn--primary btn--lg">
            {authed ? 'Vào ứng dụng' : 'Tạo tài khoản miễn phí'}
          </Link>
        </section>
      </main>

      <footer className="footer">
        <div className="footer__grid">
          <div className="footer__col">
            <span className="logo" style={{ fontSize: 20 }}>
              ARTIUM
            </span>
            <span style={{ color: 'var(--c-text-3)', lineHeight: 1.5 }}>
              Nền tảng cộng đồng &amp; mua bán nghệ thuật.
            </span>
          </div>
          <div className="footer__col">
            <strong>Cộng đồng</strong>
            <a href="#artists">Cho nghệ sĩ</a>
            <a href="#collectors">Cho nhà sưu tầm</a>
          </div>
          <div className="footer__col">
            <strong>Tài khoản</strong>
            <Link to="/login">Đăng nhập</Link>
            <Link to="/register">Đăng ký</Link>
          </div>
        </div>
        <p className="footer__copy">
          © {new Date().getFullYear()} Artium — Đồ án môn Công nghệ Web, HUST.
        </p>
      </footer>
    </div>
  );
}
