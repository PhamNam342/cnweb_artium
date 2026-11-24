import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page-center" style={{ flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 32 }}>Không tìm thấy trang</h1>
      <Link to="/" className="btn btn--primary">
        Về trang chủ
      </Link>
    </div>
  );
}
