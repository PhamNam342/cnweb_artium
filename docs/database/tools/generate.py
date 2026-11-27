#!/usr/bin/env python3
"""Sinh schema-entities.md và artium_database_erd.drawio từ schema_spec.py.

Chạy:  python3 docs/database/tools/generate.py
"""

from __future__ import annotations

import html
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import schema_spec as spec  # noqa: E402

OUT_DIR = HERE.parent
STD_TYPES = re.compile(
    r"^(uuid|text|int|smallint|bigint|boolean|jsonb|timestamptz|text\[\]|(var)?char\(\d+\)|numeric\(\d+,\d+\))$"
)


# --------------------------------------------------------------------------------------
# Parse
# --------------------------------------------------------------------------------------
@dataclass
class Column:
    name: str
    type: str
    pk: bool = False
    nn: bool = False
    uq: bool = False
    default: str | None = None
    fk: tuple[str, str, str] | None = None  # (table, column, rule)
    ref: tuple[str, str] | None = None  # (service, table)
    note: str = ""

    @property
    def nullable(self) -> bool:
        return not (self.pk or self.nn)


@dataclass
class Table:
    service: str
    name: str
    desc: str
    cols: list[Column]
    uniques: list[str] = field(default_factory=list)
    indexes: list[str] = field(default_factory=list)

    @property
    def pk_cols(self) -> list[Column]:
        return [c for c in self.cols if c.pk]


def parse_col(raw: str) -> Column:
    body, _, note = raw.partition("#")
    tokens = body.split()
    col = Column(name=tokens[0], type=tokens[1], note=note.strip())
    for tok in tokens[2:]:
        if tok == "PK":
            col.pk = True
        elif tok == "NN":
            col.nn = True
        elif tok == "UQ":
            col.uq = True
        elif tok.startswith("DEF("):
            col.default = tok[4:-1]
        elif tok.startswith("FK("):
            target, rule = tok[3:-1].split(",")
            t, c = target.split(".")
            col.fk = (t, c, rule)
        elif tok.startswith("REF("):
            s, t = tok[4:-1].split(".")
            col.ref = (s, t)
        else:
            raise ValueError(f"Cờ không hợp lệ '{tok}' trong: {raw}")
    return col


def load() -> list[tuple[dict, list[Table]]]:
    result = []
    all_names: dict[str, set[str]] = {}
    for svc in spec.SERVICES:
        tables = [
            Table(
                service=svc["key"],
                name=name,
                desc=t["desc"],
                cols=[parse_col(c) for c in t["cols"]],
                uniques=t.get("uniques", []),
                indexes=t.get("indexes", []),
            )
            for name, t in svc["tables"].items()
        ]
        all_names[svc["key"]] = {t.name for t in tables}
        result.append((svc, tables))
    # Validate references
    for svc, tables in result:
        for t in tables:
            for c in t.cols:
                if c.fk and c.fk[0] not in all_names[svc["key"]]:
                    raise ValueError(f"{t.name}.{c.name}: FK tới bảng không cùng DB '{c.fk[0]}'")
                if c.ref and c.ref[1] not in all_names.get(c.ref[0], set()):
                    raise ValueError(f"{t.name}.{c.name}: REF không tồn tại {c.ref}")
                if c.ref and c.ref[0] == svc["key"]:
                    raise ValueError(f"{t.name}.{c.name}: REF cùng service, hãy dùng FK")
    return result


def infra_tables() -> list[Table]:
    return [
        Table("infra", n, t["desc"], [parse_col(c) for c in t["cols"]], [], t.get("indexes", []))
        for n, t in spec.INFRA_TABLES.items()
    ]


# --------------------------------------------------------------------------------------
# Markdown
# --------------------------------------------------------------------------------------
def md_constraints(c: Column) -> str:
    parts = []
    if c.pk:
        parts.append("PK")
    if c.fk:
        rule = {"cascade": "CASCADE", "set_null": "SET NULL", "restrict": "RESTRICT"}[c.fk[2]]
        parts.append(f"FK → `{c.fk[0]}.{c.fk[1]}` ({rule})")
    if c.ref:
        parts.append(f"REF → `{c.ref[0]}.{c.ref[1]}`")
    if c.uq:
        parts.append("UNIQUE")
    if not c.pk:
        parts.append("NOT NULL" if c.nn else "NULL")
    if c.default is not None:
        parts.append(f"DEFAULT `{c.default}`")
    return ", ".join(parts)


def md_table(t: Table) -> list[str]:
    out = [f"### `{t.name}`", "", t.desc, ""]
    out += ["| Cột | Kiểu | Ràng buộc | Ghi chú |", "| --- | --- | --- | --- |"]
    for c in t.cols:
        note = c.note.replace("|", "\\|")
        out.append(f"| `{c.name}` | `{c.type}` | {md_constraints(c)} | {note} |")
    pk = t.pk_cols
    extra = []
    if len(pk) > 1:
        extra.append(f"- **PK kép:** `({', '.join(c.name for c in pk)})`")
    for u in t.uniques:
        extra.append(f"- **Unique:** `{u}`")
    for i in t.indexes:
        extra.append(f"- **Index:** `{i}`")
    if extra:
        out += [""] + extra
    out.append("")
    return out


def collect_enums(services) -> dict[str, str]:
    enums: dict[str, str] = {}
    missing: set[str] = set()
    for _, tables in services:
        for t in tables + infra_tables():
            for c in t.cols:
                base = c.type.rstrip("[]")
                if not STD_TYPES.match(c.type):
                    m = re.match(r"^([\w ]+(\|[\w ]+)*)", c.note)
                    if not m:
                        missing.add(base)
                        continue
                    enums.setdefault(base, " \\| ".join(v.strip() for v in m.group(1).split("|")))
    if missing - enums.keys():
        raise ValueError(f"Enum chưa khai báo giá trị: {missing - enums.keys()}")
    return dict(sorted(enums.items()))


def build_md(services) -> str:
    n_tables = sum(len(t) for _, t in services)
    o: list[str] = []
    o += [
        "# Artium — Database Schema",
        "",
        "> **File này được SINH TỰ ĐỘNG** từ `docs/database/tools/schema_spec.py` cùng với "
        "`artium_database_erd.drawio`. Đừng sửa tay — sửa spec rồi chạy "
        "`python3 docs/database/tools/generate.py`.",
        "",
        f"Tổng cộng **{len(services)} service có database**, **{n_tables} bảng nghiệp vụ** "
        "(+ `outbox`, `inbox` trong mỗi database).",
        "",
        "## 1. Quy ước",
        "",
        "- **Database-per-service:** mỗi service một database PostgreSQL riêng (chung 1 Postgres instance khi dev). "
        "Không service nào đọc/ghi database của service khác.",
        "- **FK** = khóa ngoại vật lý trong cùng database. **REF** = tham chiếu logic sang service khác: "
        "chỉ lưu UUID, không có ràng buộc; tính hợp lệ được kiểm tra qua API/event.",
        "- **Khóa chính:** luôn tên `id`, kiểu `uuid` (`gen_random_uuid()`), trừ bảng nối dùng PK kép và bảng projection dùng id nguồn.",
        "- **Tên:** `snake_case`, bảng số nhiều, FK đặt `<entity>_id`.",
        "- **Thời gian:** `timestamptz`; bảng thay đổi được có `created_at` + `updated_at`; soft delete dùng `deleted_at`.",
        "- **Tiền:** chỉ VND (PayOS), lưu `bigint` theo đơn vị đồng — không dùng `decimal`, không cần cột `currency`.",
        "- **Token/bí mật:** chỉ lưu hash (SHA-256 cho token, argon2id cho mật khẩu).",
        "- **Counter** (`like_count`, `registered_count`...) là dữ liệu phi chuẩn hóa; cột nằm ở service nào thì chỉ service đó ghi, "
        "giá trị đến từ event của service làm chủ.",
        "- **Projection** (`seller_summaries`, `user_summaries`) là bản sao chỉ-đọc, cập nhật qua event; nguồn sự thật vẫn ở service gốc.",
        "",
        "## 2. Thay đổi so với bản thiết kế cũ",
        "",
        "| Thay đổi | Lý do |",
        "| --- | --- |",
        "| Bỏ toàn bộ blockchain (wallet, auction, escrow, `blockchain_*`, `*_wei`, `tx_hash`) | Không thuộc phạm vi |",
        "| Bỏ Stripe, PayPal (`stripe_*`, `paypal_*`, `payment_methods`, `stripe_customers`); thêm `payments` PayOS + `payment_webhook_events` | Thanh toán chỉ dùng PayOS |",
        "| Giữ Google login nhưng tách sang `oauth_accounts` (thay `users.google_id`) | Một user có thể có cả mật khẩu và Google |",
        "| Gộp 9 service còn 5 + gateway: orders+payments → **commerce**; community+messaging+events+notifications → **social** | Giảm giao tiếp chéo; order và payment cùng transaction |",
        "| `orders` tách thêm `seller_orders` (vận chuyển theo từng seller) | Một đơn có thể gồm nhiều seller giao riêng |",
        "| Thêm `artwork_reservations` | Chống bán trùng tác phẩm độc bản |",
        "| Thêm `payout_items`; bỏ `order_items.payout_status` | Đối soát chi trả, payments làm chủ dữ liệu payout |",
        "| `promotions` chuyển từ CRM sang commerce | Checkout cần kiểm tra mã đồng bộ |",
        "| Gộp `artwork_likes`/`likes` → `reactions`; `artwork_comments`/`comments` → `comments` | Một hệ thống tương tác duy nhất |",
        "| Gộp `event_rsvps` + `event_attendees` → `event_registrations`; cho phép khách không tài khoản | Bỏ trùng trạng thái check-in |",
        "| Bỏ `read_receipts`, `typing_indicators`; thêm `last_read_message_id` vào participants, typing để ở Redis | Bảng read receipt tăng N×M |",
        "| Bỏ `activity_feeds`, `notification_history`; thay bằng `notifications` + `email_deliveries` | Bỏ trùng chức năng |",
        "| Thêm `user_tokens` (xác minh email, reset mật khẩu); `refresh_tokens` lưu hash + rotation | Bảo mật |",
        "| Thêm bảng còn thiếu: `moodboard_collaborators`, `segment_members`, `campaign_segments`, `private_view_artworks`, `private_view_invitees`, `notification_preferences` | ERD cũ có cờ nhưng không có bảng |",
        "| Bỏ chỉ số bán hàng khỏi `seller_profiles`; bỏ `users.stripe_customer_id` | Một dữ liệu chỉ một service làm chủ |",
        "",
        "## 3. Bản đồ service",
        "",
        "| Service | Port | Database | Bảng |",
        "| --- | --- | --- | --- |",
        "| gateway | 3000 | — | — (định tuyến HTTP, không có DB) |",
    ]
    for svc, tables in services:
        names = ", ".join(f"`{t.name}`" for t in tables)
        o.append(f"| {svc['key']} | {svc['port']} | `{svc['db']}` | {names} |")
    o += ["", "### Định tuyến qua gateway", "", "| Prefix | Service |", "| --- | --- |"]
    o += [f"| `{p}` | {s} |" for p, s in spec.GATEWAY_ROUTES]
    o.append("")

    sec = 4
    for svc, tables in services:
        o += [f"## {sec}. {svc['name']} — `{svc['db']}`", "", svc["desc"], ""]
        for t in tables:
            o += md_table(t)
        sec += 1

    o += [f"## {sec}. Bảng hạ tầng (có trong MỌI database)", ""]
    for t in infra_tables():
        o += md_table(t)
    sec += 1

    o += [
        f"## {sec}. Event giữa các service",
        "",
        "Exchange `artium.events` (topic) trên RabbitMQ. Service phát ghi vào `outbox` trong cùng transaction; "
        "consumer ghi `inbox` để xử lý idempotent.",
        "",
        "| Event (routing key) | Phát bởi | Tiêu thụ bởi |",
        "| --- | --- | --- |",
    ]
    o += [f"| `{e}` | {p} | {c} |" for e, p, c in spec.EVENTS]
    o.append("")
    sec += 1

    o += [f"## {sec}. Enum", "", "| Enum | Giá trị |", "| --- | --- |"]
    o += [f"| `{k}` | {v} |" for k, v in collect_enums(services).items()]
    sec += 1

    o += [
        "",
        f"## {sec}. Đề xuất bổ sung từ thiết kế Figma (CHƯA triển khai)",
        "",
        "Các điểm thiết kế cần nhưng schema hiện tại chưa có. Khi làm tới tính năng tương ứng: "
        "chuyển vào `SERVICES` trong spec, sinh lại tài liệu, rồi viết migration.",
        "",
        "| Bổ sung | Service | Lý do (màn hình Figma) |",
        "| --- | --- | --- |",
    ]
    o += [f"| `{a}` | {s} | {r} |" for a, s, r in spec.PROPOSALS]
    sec += 1

    o += [
        "",
        f"## {sec}. Luồng nghiệp vụ chính",
        "",
        "**Checkout (saga):** commerce tạo `orders` + `seller_orders` + `order_items` (`pending_payment`) → "
        "phát `commerce.order.created` → catalog tạo `artwork_reservations`, giảm `quantity_available` "
        "(thất bại → `catalog.reservation.failed` → commerce hủy đơn) → commerce tạo `payments` + payment link PayOS → "
        "webhook PayOS (verify chữ ký, log `payment_webhook_events`) → `payments.paid`, `orders.paid` → "
        "phát `commerce.order.paid` → catalog confirm reservation, crm cập nhật contact, social gửi thông báo. "
        "Hết `payment_expires_at` → `orders.cancelled` → catalog release reservation.",
        "",
        "**Chi trả seller:** `seller_orders.delivered` → admin tạo `payouts` gom các seller_order chưa chi trả "
        "(`payout_items.seller_order_id` UNIQUE) → chuyển khoản → `payouts.paid`.",
        "",
    ]
    return "\n".join(o)


# --------------------------------------------------------------------------------------
# draw.io
# --------------------------------------------------------------------------------------
ROW_H = 22
HEAD_H = 30
TABLE_W = 380
GAP_X = 70
GAP_Y = 40


def esc(s: str) -> str:
    return html.escape(s, quote=True)


class Page:
    def __init__(self, pid: str, name: str, width: int = 2200, height: int = 1600):
        self.pid, self.name, self.width, self.height = pid, name, width, height
        self.cells: list[str] = []
        self.n = 0

    def nid(self, prefix: str) -> str:
        self.n += 1
        return f"{self.pid}_{prefix}_{self.n}"

    def add(self, xml: str):
        self.cells.append(xml)

    def text(self, value: str, x, y, w, h, style="text;html=1;align=left;verticalAlign=top;whiteSpace=wrap;"):
        cid = self.nid("t")
        self.add(
            f'<mxCell id="{cid}" value="{esc(value)}" style="{style}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
        )
        return cid

    def xml(self) -> str:
        return (
            f'<diagram id="{self.pid}" name="{esc(self.name)}">'
            f'<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" '
            f'arrows="1" fold="1" page="1" pageScale="1" pageWidth="{self.width}" pageHeight="{self.height}" '
            f'math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
            + "".join(self.cells)
            + "</root></mxGraphModel></diagram>"
        )


def table_height(t: Table) -> int:
    return HEAD_H + ROW_H * len(t.cols)


def draw_table(page: Page, t: Table, x: int, y: int, color: str, fill: str) -> dict[str, str]:
    """Vẽ bảng; trả về map tên cột -> id cell (và '__table__')."""
    tid = page.nid(f"tb_{t.name}")
    page.add(
        f'<mxCell id="{tid}" value="{esc(t.name)}" style="swimlane;fontStyle=1;childLayout=stackLayout;'
        f"horizontal=1;startSize={HEAD_H};horizontalStack=0;resizeParent=1;resizeParentMax=0;"
        f"resizeLast=0;collapsible=1;marginBottom=0;html=1;rounded=1;arcSize=4;fillColor={color};"
        f'fontColor=#ffffff;strokeColor={color};swimlaneFillColor=#ffffff;fontSize=13;" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{TABLE_W}" height="{table_height(t)}" as="geometry"/></mxCell>'
    )
    ids = {"__table__": tid}
    for i, c in enumerate(t.cols):
        rid = page.nid("r")
        ids[c.name] = rid
        if c.pk and c.fk:
            tag, style_extra = "PF", "fontStyle=1;"
        elif c.pk:
            tag, style_extra = "PK", "fontStyle=1;"
        elif c.fk:
            tag, style_extra = "FK", "fontColor=#1d4ed8;"
        elif c.ref:
            tag, style_extra = "REF", "fontColor=#7c3aed;fontStyle=2;"
        else:
            tag, style_extra = "", ""
        flags = []
        if c.uq:
            flags.append("UQ")
        if c.nullable:
            flags.append("NULL")
        suffix = f"  [{', '.join(flags)}]" if flags else ""
        ref = f"  → {c.ref[0]}.{c.ref[1]}" if c.ref else ""
        label = f"{tag:<4}{c.name}: {c.type}{suffix}{ref}" if tag else f"      {c.name}: {c.type}{suffix}"
        bg = f"fillColor={fill};" if c.pk else "fillColor=none;"
        page.add(
            f'<mxCell id="{rid}" value="{esc(label)}" style="text;html=1;strokeColor=none;{bg}align=left;'
            f"verticalAlign=middle;spacingLeft=6;spacingRight=4;overflow=hidden;rotatable=0;"
            f'points=[[0,0.5],[1,0.5]];portConstraint=eastwest;fontFamily=Courier New;fontSize=11;{style_extra}" '
            f'vertex="1" parent="{tid}"><mxGeometry y="{HEAD_H + i * ROW_H}" width="{TABLE_W}" '
            f'height="{ROW_H}" as="geometry"/></mxCell>'
        )
    return ids


def er_edge(page: Page, src: str, dst: str, start: str, end: str, label: str = "", dashed=False, color="#475569"):
    eid = page.nid("e")
    dash = "dashed=1;" if dashed else ""
    page.add(
        f'<mxCell id="{eid}" value="{esc(label)}" style="edgeStyle=entityRelationEdgeStyle;fontSize=10;'
        f"html=1;endArrow={end};startArrow={start};endFill=0;startFill=0;strokeColor={color};{dash}"
        f'rounded=1;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="{src}" target="{dst}">'
        f'<mxGeometry relative="1" as="geometry"/></mxCell>'
    )


def layout(tables: list[Table], ncols: int, x0: int, y0: int) -> dict[str, tuple[int, int]]:
    heights = [y0] * ncols
    pos = {}
    for t in tables:
        i = heights.index(min(heights))
        pos[t.name] = (x0 + i * (TABLE_W + GAP_X), heights[i])
        heights[i] += table_height(t) + GAP_Y
    return pos


def fk_edges(page: Page, tables: list[Table], ids: dict[str, dict[str, str]]):
    for t in tables:
        for c in t.cols:
            if not c.fk:
                continue
            target = ids[c.fk[0]]
            dst = target.get(c.fk[1], target["__table__"])
            many = "ERzeroToOne" if c.uq else "ERmany"
            one = "ERzeroToOne" if c.nullable else "ERmandOne"
            er_edge(page, ids[t.name][c.name], dst, many, one, c.fk[2].upper().replace("_", " "))


def legend(page: Page, x: int, y: int):
    page.text(
        "<b>CHÚ THÍCH</b><br/>"
        "<b>PK</b> khóa chính &nbsp;·&nbsp; <b>PF</b> vừa PK vừa FK &nbsp;·&nbsp; "
        "<font color='#1d4ed8'>FK</font> khóa ngoại vật lý (cùng DB) &nbsp;·&nbsp; "
        "<font color='#7c3aed'><i>REF</i></font> tham chiếu logic sang service khác (KHÔNG có FK)<br/>"
        "[UQ] unique &nbsp;·&nbsp; [NULL] cho phép null &nbsp;·&nbsp; nhãn cạnh = hành vi ON DELETE<br/>"
        "Tiền: <b>bigint VND</b> &nbsp;·&nbsp; Mỗi DB đều có thêm bảng <b>outbox</b> + <b>inbox</b> (xem trang Hạ tầng)",
        x, y, 1100, 80,
        "text;html=1;align=left;verticalAlign=top;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#cbd5e1;"
        "rounded=1;spacing=10;fontSize=12;",
    )


def build_drawio(services) -> str:
    pages: list[Page] = []

    # ---------- Trang tổng quan ----------
    ov = Page("overview", "0. Tổng quan kiến trúc dữ liệu", 2600, 1700)
    ov.text(
        "<b style='font-size:20px'>ARTIUM — KIẾN TRÚC DỮ LIỆU MICROSERVICES</b><br/>"
        "<span style='color:#64748b'>API Gateway (:3000) → 5 service, mỗi service một database PostgreSQL. "
        "Giao tiếp bất đồng bộ qua RabbitMQ (outbox/inbox). Thanh toán: PayOS. Đăng nhập: email/mật khẩu + Google.</span>",
        40, 20, 1600, 60,
    )
    legend(ov, 40, 90)
    gw = ov.nid("gw")
    ov.add(
        f'<mxCell id="{gw}" value="API Gateway :3000&lt;br&gt;&lt;span style=&quot;font-size:11px&quot;&gt;'
        f'định tuyến /api/* · không có DB&lt;/span&gt;" style="rounded=1;whiteSpace=wrap;html=1;'
        f'fillColor=#0f172a;fontColor=#ffffff;strokeColor=#0f172a;fontStyle=1;fontSize=14;" vertex="1" parent="1">'
        f'<mxGeometry x="1000" y="200" width="320" height="56" as="geometry"/></mxCell>'
    )
    mq = ov.nid("mq")
    ov.add(
        f'<mxCell id="{mq}" value="RabbitMQ · exchange artium.events (topic)" style="shape=cylinder3;'
        f'whiteSpace=wrap;html=1;boundedLbl=1;size=8;direction=south;fillColor=#fff7ed;strokeColor=#ea580c;'
        f'fontStyle=1;" vertex="1" parent="1"><mxGeometry x="1600" y="196" width="360" height="64" as="geometry"/></mxCell>'
    )
    box_w, box_h, gap = 170, 30, 8
    svc_boxes: dict[str, str] = {}
    table_box: dict[tuple[str, str], str] = {}
    cx = 40
    for svc, tables in services:
        cols = 2
        rows = (len(tables) + cols - 1) // cols
        w = cols * box_w + (cols + 1) * gap + 10
        h = 50 + rows * (box_h + gap) + gap
        sid = ov.nid(f"svc_{svc['key']}")
        svc_boxes[svc["key"]] = sid
        ov.add(
            f'<mxCell id="{sid}" value="{esc(svc["name"].upper())}&lt;br&gt;&lt;span style=&quot;font-size:11px;'
            f'font-weight:normal&quot;&gt;{svc["db"]} · :{svc["port"]}&lt;/span&gt;" style="swimlane;html=1;'
            f"startSize=44;rounded=1;arcSize=3;fillColor={svc['color']};fontColor=#ffffff;strokeColor={svc['color']};"
            f'swimlaneFillColor={svc["fill"]};fontSize=13;" vertex="1" parent="1">'
            f'<mxGeometry x="{cx}" y="340" width="{w}" height="{h}" as="geometry"/></mxCell>'
        )
        for i, t in enumerate(tables):
            bid = ov.nid("b")
            table_box[(svc["key"], t.name)] = bid
            bx = gap + 5 + (i % cols) * (box_w + gap)
            by = 50 + (i // cols) * (box_h + gap)
            proj = "fontStyle=2;dashed=1;" if "PROJECTION" in t.desc else ""
            ov.add(
                f'<mxCell id="{bid}" value="{esc(t.name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;'
                f'strokeColor={svc["color"]};fontSize=11;{proj}" vertex="1" parent="{sid}">'
                f'<mxGeometry x="{bx}" y="{by}" width="{box_w}" height="{box_h}" as="geometry"/></mxCell>'
            )
        cx += w + 60
    # gateway -> services
    for key, sid in svc_boxes.items():
        eid = ov.nid("ge")
        ov.add(
            f'<mxCell id="{eid}" value="" style="endArrow=classic;html=1;strokeColor=#0f172a;" edge="1" parent="1" '
            f'source="{gw}" target="{sid}"><mxGeometry relative="1" as="geometry"/></mxCell>'
        )
    # REF tổng hợp giữa service
    refs: dict[tuple[str, str], set[str]] = {}
    for svc, tables in services:
        for t in tables:
            for c in t.cols:
                if c.ref:
                    refs.setdefault((svc["key"], c.ref[0]), set()).add(c.ref[1])
    for (src, dst), tnames in refs.items():
        eid = ov.nid("re")
        ov.add(
            f'<mxCell id="{eid}" value="{esc("REF " + ", ".join(sorted(tnames)))}" style="endArrow=open;html=1;'
            f"dashed=1;strokeColor=#7c3aed;fontColor=#7c3aed;fontSize=10;labelBackgroundColor=#ffffff;"
            f'curved=1;exitX=0.5;exitY=1;entryX=0.5;entryY=1;" edge="1" parent="1" source="{svc_boxes[src]}" '
            f'target="{svc_boxes[dst]}"><mxGeometry relative="1" as="geometry"/></mxCell>'
        )
    ev_lines = "<br/>".join(f"<b>{esc(e)}</b> — {esc(p)} → {esc(c)}" for e, p, c in spec.EVENTS)
    ov.text(f"<b>EVENT CHÍNH</b><br/>{ev_lines}", 40, 1180, 1500, 300,
            "text;html=1;align=left;verticalAlign=top;whiteSpace=wrap;fillColor=#fff7ed;strokeColor=#fdba74;"
            "rounded=1;spacing=10;fontSize=11;")
    pages.append(ov)

    # ---------- Trang chi tiết từng service ----------
    for idx, (svc, tables) in enumerate(services, start=1):
        ncols = 3 if len(tables) <= 9 else 4
        pg = Page(f"svc_{svc['key']}", f"{idx}. {svc['name']} ({svc['db']})", 2400, 2400)
        pg.text(
            f"<b style='font-size:20px;color:{svc['color']}'>{esc(svc['name'].upper())}</b> "
            f"<span style='color:#64748b'>— database <b>{svc['db']}</b> · port {svc['port']}</span><br/>"
            f"{esc(svc['desc'])}",
            40, 20, 1600, 50,
        )
        legend(pg, 40, 80)
        pos = layout(tables, ncols, 40, 200)
        ids = {t.name: draw_table(pg, t, *pos[t.name], svc["color"], svc["fill"]) for t in tables}
        fk_edges(pg, tables, ids)
        pages.append(pg)

    # ---------- Hạ tầng ----------
    inf = Page("infra", f"{len(services) + 1}. Hạ tầng: outbox / inbox", 1600, 1000)
    inf.text(
        "<b style='font-size:20px'>BẢNG HẠ TẦNG — CÓ TRONG MỖI DATABASE</b><br/>"
        "Không phải bảng dùng chung: identity_db, catalog_db, commerce_db, social_db, crm_db đều có một bản riêng.",
        40, 20, 1400, 50,
    )
    x = 40
    for t in infra_tables():
        draw_table(inf, t, x, 120, "#475569", "#e2e8f0")
        x += TABLE_W + GAP_X
    inf.text(
        "<b>Luồng</b><br/>1. Service ghi dữ liệu nghiệp vụ + 1 dòng outbox trong CÙNG transaction.<br/>"
        "2. Outbox relay (poll mỗi giây, FOR UPDATE SKIP LOCKED) publish lên RabbitMQ, đánh dấu published.<br/>"
        "3. Consumer nhận message → INSERT inbox(message_id, consumer) → trùng thì bỏ qua → xử lý trong cùng transaction.",
        40, 520, 900, 110,
        "text;html=1;align=left;verticalAlign=top;whiteSpace=wrap;fillColor=#f8fafc;strokeColor=#cbd5e1;rounded=1;spacing=10;",
    )
    pages.append(inf)

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<mxfile host="app.diagrams.net" agent="artium-schema-generator" version="24.0.0" type="device">'
        + "".join(p.xml() for p in pages)
        + "</mxfile>\n"
    )


def main():
    services = load()
    (OUT_DIR / "schema-entities.md").write_text(build_md(services), encoding="utf-8")
    (OUT_DIR / "artium_database_erd.drawio").write_text(build_drawio(services), encoding="utf-8")
    n = sum(len(t) for _, t in services)
    print(f"OK: {len(services)} service, {n} bảng -> schema-entities.md, artium_database_erd.drawio")


if __name__ == "__main__":
    main()
