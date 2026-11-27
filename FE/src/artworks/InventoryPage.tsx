import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ApiError } from '../lib/api';
import { artworksApi } from './artworks-api';
import { LISTING_LABEL, STATUS_LABEL } from './form';
import type { Artwork, ArtworkStatus, Folder, InventoryPage as InventoryData } from './types';
import {
  canCreateIn,
  childrenOf,
  descendantsOf,
  flattenTree,
  indentLabel,
  MAX_FOLDER_DEPTH,
  moveTargets,
  pathTo,
  totalArtworks,
} from './folder-tree';
import { formatDimensions, formatVnd } from './units';

type Tab = 'active' | ArtworkStatus;
const TABS: { id: Tab; label: string }[] = [
  { id: 'active', label: 'Tất cả' },
  { id: 'published', label: 'Đang hiển thị' },
  { id: 'draft', label: 'Nháp' },
  { id: 'sold_out', label: 'Hết hàng' },
  { id: 'archived', label: 'Lưu trữ' },
];
const PAGE_SIZE = 12;

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

function Menu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ref = useOutsideClose(open, close);
  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="more" size={20} />
      </button>
      {open && (
        <div className="menu__list" role="menu">
          {children(close)}
        </div>
      )}
    </div>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="modal__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function priceText(a: Artwork) {
  if (a.listingType === 'for_sale') return a.price ? `${formatVnd(a.price)} ₫` : 'Chưa có giá';
  return LISTING_LABEL[a.listingType];
}

/** Kho tác phẩm của nghệ sĩ (Figma "Inventory - Default Artworks page"). */
export function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = (params.get('tab') as Tab) || 'active';
  const folderId = params.get('folder') ?? '';
  const page = Number(params.get('page') ?? 1);
  const q = params.get('q') ?? '';
  const view = params.get('view') === 'grid' ? 'grid' : 'list';

  const [data, setData] = useState<InventoryData | null>(null);
  /** Bộ lọc ứng với dữ liệu đang hiển thị — khác bộ lọc hiện tại nghĩa là đang tải */
  const [dataKey, setDataKey] = useState('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState(q);
  const [flash, setFlash] = useState<string | null>(
    (location.state as { flash?: string } | null)?.flash ?? null,
  );
  const [reload, setReload] = useState(0);
  const queryKey = `${q}|${tab}|${folderId}|${page}|${reload}`;
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(null);
  const [moveTarget, setMoveTarget] = useState<Artwork | null>(null);

  const update = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    if (!('page' in next)) p.delete('page');
    setParams(p);
  };

  useEffect(() => {
    // Xóa flash khỏi history để F5 không hiện lại
    if (location.state)
      navigate(location.pathname + location.search, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      artworksApi.listMine(
        {
          q: q || undefined,
          status: tab === 'active' ? undefined : tab,
          folderId: folderId || undefined,
          sort: 'updated',
          page,
          pageSize: PAGE_SIZE,
        },
        ctrl.signal,
      ),
      artworksApi.folders(),
    ])
      .then(([d, f]) => {
        setError(null);
        setData(d);
        setDataKey(`${q}|${tab}|${folderId}|${page}|${reload}`);
        setFolders(f);
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') {
          setError(e instanceof ApiError ? e.message : 'Không tải được kho tác phẩm');
        }
      });
    return () => ctrl.abort();
  }, [q, tab, folderId, page, reload]);

  async function act(a: Artwork, fn: () => Promise<unknown>, done: string) {
    setBusy(a.id);
    setFlash(null);
    try {
      await fn();
      setFlash(done);
      setReload((n) => n + 1);
    } catch (e) {
      setFlash(null);
      setError(
        e instanceof ApiError
          ? [e.message, ...e.details.slice(1)].join(' · ')
          : 'Thao tác thất bại',
      );
    } finally {
      setBusy(null);
    }
  }

  const path = pathTo(folders, folderId);
  const currentFolder = path[path.length - 1];
  const subfolders = childrenOf(folders, currentFolder?.id ?? null);
  const showFolders = !q && tab === 'active' && page === 1 && subfolders.length > 0;
  const canCreateHere = canCreateIn(folders, currentFolder?.id ?? null);

  async function deleteFolder(f: Folder) {
    const kids = descendantsOf(folders, f.id).size;
    const msg =
      `Xóa thư mục “${f.name}”?` +
      (f.artworkCount
        ? `\n${f.artworkCount} tác phẩm bên trong sẽ chuyển ra “Chưa xếp thư mục”.`
        : '') +
      (kids ? `\nCác thư mục con sẽ được đưa lên một cấp.` : '') +
      '\nTác phẩm không bị xóa.';
    if (!window.confirm(msg)) return;
    setFlash(null);
    try {
      await artworksApi.deleteFolder(f.id);
      setFlash(`Đã xóa thư mục “${f.name}”`);
      // Đang đứng trong thư mục vừa xóa (hoặc thư mục con của nó) → về thư mục cha
      if (folderId && (folderId === f.id || descendantsOf(folders, f.id).has(folderId))) {
        update({ folder: f.parentId });
      } else {
        setReload((n) => n + 1);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không xóa được thư mục');
    }
  }
  const counts = data?.counts;
  const tabCount = (t: Tab) =>
    !counts
      ? undefined
      : t === 'active'
        ? counts.draft + counts.published + counts.sold_out
        : counts[t];

  return (
    <div className="inventory">
      <header className="inventory__head">
        <div>
          {currentFolder ? (
            <nav className="breadcrumb" aria-label="Đường dẫn">
              <button type="button" className="btn-link" onClick={() => update({ folder: null })}>
                Kho tác phẩm
              </button>
              {path.slice(0, -1).map((p) => (
                <span key={p.id} className="breadcrumb__part">
                  <span aria-hidden="true">/</span>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => update({ folder: p.id })}
                  >
                    {p.name}
                  </button>
                </span>
              ))}
              <span aria-hidden="true">/</span>
              <span aria-current="page">{currentFolder.name}</span>
            </nav>
          ) : null}
          <h1>{currentFolder ? currentFolder.name : 'Kho tác phẩm'}</h1>
          {!canCreateHere && (
            <p className="inventory__hint">
              Đã ở cấp {MAX_FOLDER_DEPTH} — không tạo thêm thư mục con ở đây được.
            </p>
          )}
        </div>
        <div className="inventory__actions">
          <button
            type="button"
            className="btn btn--outline btn--sm"
            disabled={!canCreateHere}
            title={canCreateHere ? undefined : `Thư mục chỉ lồng tối đa ${MAX_FOLDER_DEPTH} cấp`}
            onClick={() => setFolderDialog({ mode: 'create', parentId: currentFolder?.id ?? null })}
          >
            {currentFolder ? '+ Thư mục con' : '+ Thư mục mới'}
          </button>
          <Link to="/studio/artworks/new" className="btn btn--primary btn--sm">
            + Đăng tác phẩm
          </Link>
        </div>
      </header>

      {flash && (
        <p className="alert alert--success" role="status">
          {flash}
        </p>
      )}
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}

      <div className="panel">
        <div className="toolbar">
          <div className="tabs" role="tablist" aria-label="Trạng thái">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className="tab"
                onClick={() => update({ tab: t.id === 'active' ? null : t.id })}
              >
                {t.label}
                {tabCount(t.id) !== undefined && (
                  <span className="tab__count">{tabCount(t.id)}</span>
                )}
              </button>
            ))}
          </div>
          <form
            className="toolbar__right"
            role="search"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              update({ q: search.trim() || null });
            }}
          >
            <input
              className="input input--search"
              type="search"
              placeholder="Tìm theo tên tác phẩm"
              aria-label="Tìm theo tên tác phẩm"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value === '' && q) update({ q: null });
              }}
            />
            <div className="view-toggle" role="group" aria-label="Kiểu hiển thị">
              <button
                type="button"
                aria-pressed={view === 'list'}
                aria-label="Dạng danh sách"
                onClick={() => update({ view: null, page: String(page) })}
              >
                <Icon name="list" />
              </button>
              <button
                type="button"
                aria-pressed={view === 'grid'}
                aria-label="Dạng lưới"
                onClick={() => update({ view: 'grid', page: String(page) })}
              >
                <Icon name="grid" />
              </button>
            </div>
          </form>
        </div>

        {showFolders && (
          <ul className="folder-list" aria-label="Thư mục">
            {subfolders.map((f) => {
              const kids = childrenOf(folders, f.id).length;
              const total = totalArtworks(folders, f.id);
              return (
                <li key={f.id} className="folder-item">
                  <button
                    type="button"
                    className="folder-row"
                    onClick={() => update({ folder: f.id })}
                  >
                    <span className="folder-row__icon" aria-hidden="true">
                      <Icon name="folder" size={22} />
                    </span>
                    <span className="folder-row__name">{f.name}</span>
                    <span className="folder-row__count">
                      {kids > 0 && `${kids} thư mục · `}
                      {total} tác phẩm
                    </span>
                  </button>
                  <Menu label={`Thao tác cho thư mục ${f.name}`}>
                    {(close) => (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          className="menu__item"
                          onClick={() => {
                            close();
                            setFolderDialog({ mode: 'rename', folder: f });
                          }}
                        >
                          Đổi tên
                        </button>
                        {canCreateIn(folders, f.id) && (
                          <button
                            type="button"
                            role="menuitem"
                            className="menu__item"
                            onClick={() => {
                              close();
                              setFolderDialog({ mode: 'create', parentId: f.id });
                            }}
                          >
                            Tạo thư mục con
                          </button>
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          className="menu__item"
                          onClick={() => {
                            close();
                            setFolderDialog({ mode: 'move', folder: f });
                          }}
                        >
                          Chuyển vào thư mục khác…
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="menu__item menu__item--danger"
                          onClick={() => {
                            close();
                            void deleteFolder(f);
                          }}
                        >
                          Xóa thư mục
                        </button>
                      </>
                    )}
                  </Menu>
                </li>
              );
            })}
          </ul>
        )}

        {!data && !error && (
          <div className="page-center" style={{ minHeight: 240 }} role="status">
            <span className="spinner" aria-hidden="true" />
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="empty">
            <p className="empty__title">
              {q ? `Không tìm thấy tác phẩm nào khớp “${q}”` : 'Chưa có tác phẩm nào ở đây'}
            </p>
            {!q && (
              <Link to="/studio/artworks/new" className="btn btn--primary">
                Đăng tác phẩm đầu tiên
              </Link>
            )}
          </div>
        )}

        {data && data.items.length > 0 && (
          <ul
            className={view === 'grid' ? 'art-grid' : 'art-list'}
            aria-label="Tác phẩm"
            aria-busy={dataKey !== queryKey || undefined}
            data-dim={dataKey !== queryKey || undefined}
          >
            {data.items.map((a) => (
              <li key={a.id} className="art-row" data-busy={busy === a.id || undefined}>
                <Link to={`/studio/artworks/${a.id}/edit`} className="art-row__thumb">
                  {a.coverImage ? (
                    <img
                      src={a.coverImage.thumbUrl}
                      alt=""
                      loading="lazy"
                      onLoad={(e) => e.currentTarget.setAttribute('data-loaded', '')}
                    />
                  ) : (
                    <span>Chưa có ảnh</span>
                  )}
                </Link>
                <div className="art-row__main">
                  <div className="art-row__title">
                    <Link to={`/studio/artworks/${a.id}/edit`}>{a.title}</Link>
                    <span className="status-pill" data-status={a.status}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                  <p className="art-row__sub">
                    {[a.creationYear, a.creatorName].filter(Boolean).join(' • ') || '—'}
                  </p>
                  <dl className="art-row__facts">
                    <div>
                      <dt>Chất liệu</dt>
                      <dd>{a.medium || '—'}</dd>
                    </div>
                    <div>
                      <dt>Kích thước</dt>
                      <dd>{formatDimensions(a)}</dd>
                    </div>
                    <div>
                      <dt>Số lượng</dt>
                      <dd>
                        {a.listingType === 'for_sale'
                          ? `${a.quantityAvailable}/${a.quantityTotal} còn lại`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Niêm yết</dt>
                      <dd className="art-row__price" data-type={a.listingType}>
                        {priceText(a)}
                      </dd>
                    </div>
                  </dl>
                </div>
                <Menu label={`Thao tác cho ${a.title}`}>
                  {(close) => {
                    const item = (label: string, fn: () => void, danger = false) => (
                      <button
                        type="button"
                        role="menuitem"
                        className={danger ? 'menu__item menu__item--danger' : 'menu__item'}
                        onClick={() => {
                          close();
                          fn();
                        }}
                      >
                        {label}
                      </button>
                    );
                    const live = a.status === 'published' || a.status === 'sold_out';
                    return (
                      <>
                        {item('Sửa', () => navigate(`/studio/artworks/${a.id}/edit`))}
                        {item(live ? 'Xem trang tác phẩm' : 'Xem trước', () =>
                          navigate(`/artworks/${a.id}`),
                        )}
                        {a.status === 'draft' &&
                          item(
                            'Đăng',
                            () =>
                              void act(a, () => artworksApi.publish(a.id), `Đã đăng “${a.title}”`),
                          )}
                        {live &&
                          item(
                            'Gỡ đăng (về nháp)',
                            () =>
                              void act(
                                a,
                                () => artworksApi.unpublish(a.id),
                                `Đã gỡ “${a.title}” khỏi trang công khai`,
                              ),
                          )}
                        {folders.length > 0 && item('Chuyển thư mục…', () => setMoveTarget(a))}
                        {a.status === 'archived'
                          ? item(
                              'Khôi phục',
                              () =>
                                void act(
                                  a,
                                  () => artworksApi.restore(a.id),
                                  `Đã khôi phục “${a.title}”`,
                                ),
                            )
                          : item(
                              'Lưu trữ',
                              () =>
                                void act(
                                  a,
                                  () => artworksApi.archive(a.id),
                                  `Đã lưu trữ “${a.title}”`,
                                ),
                            )}
                        {item(
                          'Xóa',
                          () => {
                            if (window.confirm(`Xóa “${a.title}”? Không thể hoàn tác.`)) {
                              void act(a, () => artworksApi.remove(a.id), `Đã xóa “${a.title}”`);
                            }
                          },
                          true,
                        )}
                      </>
                    );
                  }}
                </Menu>
              </li>
            ))}
          </ul>
        )}

        {data && data.totalPages > 1 && (
          <nav className="pager" aria-label="Phân trang">
            <button
              type="button"
              className="icon-btn"
              disabled={page <= 1}
              aria-label="Trang trước"
              onClick={() => update({ page: String(page - 1) })}
            >
              ←
            </button>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                className="pager__num"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => update({ page: String(p) })}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              className="icon-btn"
              disabled={page >= data.totalPages}
              aria-label="Trang sau"
              onClick={() => update({ page: String(page + 1) })}
            >
              →
            </button>
          </nav>
        )}
      </div>

      {folderDialog && (
        <FolderDialog
          state={folderDialog}
          folders={folders}
          onClose={() => setFolderDialog(null)}
          onDone={(message) => {
            setFolderDialog(null);
            setFlash(message);
            setReload((n) => n + 1);
          }}
        />
      )}
      {moveTarget && (
        <MoveDialog
          artwork={moveTarget}
          folders={folders}
          onClose={() => setMoveTarget(null)}
          onMove={(fid) => {
            const a = moveTarget;
            setMoveTarget(null);
            const name = folders.find((f) => f.id === fid)?.name;
            void act(
              a,
              () => artworksApi.move([a.id], fid),
              name ? `Đã chuyển vào “${name}”` : 'Đã đưa ra khỏi thư mục',
            );
          }}
        />
      )}
    </div>
  );
}

type FolderDialogState =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'rename'; folder: Folder }
  | { mode: 'move'; folder: Folder };

/** Tạo / đổi tên / chuyển thư mục. */
function FolderDialog({
  state,
  folders,
  onClose,
  onDone,
}: {
  state: FolderDialogState;
  folders: Folder[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState(state.mode === 'rename' ? state.folder.name : '');
  const [target, setTarget] = useState(state.mode === 'move' ? (state.folder.parentId ?? '') : '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parent =
    state.mode === 'create' && state.parentId ? folders.find((f) => f.id === state.parentId) : null;
  const title =
    state.mode === 'create'
      ? parent
        ? `Thư mục con trong “${parent.name}”`
        : 'Thư mục mới'
      : state.mode === 'rename'
        ? 'Đổi tên thư mục'
        : `Chuyển thư mục “${state.folder.name}”`;
  const targets = state.mode === 'move' ? moveTargets(folders, state.folder.id) : [];

  async function submit() {
    setErr(null);
    if (state.mode !== 'move' && !name.trim()) return setErr('Nhập tên thư mục');
    setSaving(true);
    try {
      if (state.mode === 'create') {
        const f = await artworksApi.createFolder(name.trim(), state.parentId);
        onDone(`Đã tạo thư mục “${f.name}”`);
      } else if (state.mode === 'rename') {
        const f = await artworksApi.updateFolder(state.folder.id, { name: name.trim() });
        onDone(`Đã đổi tên thành “${f.name}”`);
      } else {
        await artworksApi.updateFolder(state.folder.id, { parentId: target || null });
        const dest = folders.find((f) => f.id === target);
        onDone(
          dest
            ? `Đã chuyển “${state.folder.name}” vào “${dest.name}”`
            : `Đã chuyển “${state.folder.name}” ra cấp gốc`,
        );
      }
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'Thao tác thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title={title} onClose={onClose}>
      <form
        className="wizard__stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {state.mode === 'move' ? (
          <>
            <select
              className="input"
              aria-label="Thư mục cha mới"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Cấp gốc (Kho tác phẩm)</option>
              {targets.map(({ folder, depth }) => (
                <option key={folder.id} value={folder.id}>
                  {indentLabel(folder.name, depth)}
                </option>
              ))}
            </select>
            <p className="field__hint">
              Thư mục lồng tối đa {MAX_FOLDER_DEPTH} cấp, nên chỉ hiện những nơi chuyển tới được.
            </p>
          </>
        ) : (
          <input
            className="input"
            autoFocus
            aria-label="Tên thư mục"
            placeholder="VD: Series 2025"
            maxLength={255}
            value={name}
            aria-invalid={err ? true : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setErr(null);
            }}
          />
        )}
        {err && <p className="field__error">{err}</p>}
        <div className="modal__footer-actions">
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving
              ? 'Đang lưu…'
              : state.mode === 'create'
                ? 'Tạo thư mục'
                : state.mode === 'rename'
                  ? 'Lưu'
                  : 'Chuyển'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function MoveDialog({
  artwork,
  folders,
  onClose,
  onMove,
}: {
  artwork: Artwork;
  folders: Folder[];
  onClose: () => void;
  onMove: (folderId: string | null) => void;
}) {
  const [target, setTarget] = useState(artwork.folderId ?? '');
  return (
    <Dialog title={`Chuyển “${artwork.title}”`} onClose={onClose}>
      <select
        className="input"
        aria-label="Thư mục đích"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">Chưa xếp thư mục</option>
        {flattenTree(folders).map(({ folder, depth }) => (
          <option key={folder.id} value={folder.id}>
            {indentLabel(folder.name, depth)}
          </option>
        ))}
      </select>
      <div className="modal__footer-actions">
        <button type="button" className="btn btn--outline" onClick={onClose}>
          Hủy
        </button>
        <button type="button" className="btn btn--primary" onClick={() => onMove(target || null)}>
          Chuyển
        </button>
      </div>
    </Dialog>
  );
}
