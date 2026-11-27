# Quy trình Git

Nhóm dùng **một nhánh chính là `main`**. Không có nhánh `develop`.
Mỗi việc làm trên một nhánh riêng tách từ `main`, xong thì mở Pull Request (PR) để merge vào `main`.
**Không commit hay push thẳng lên `main`.**

## Đặt tên nhánh

| Loại | Mẫu | Ví dụ |
| --- | --- | --- |
| Tính năng | `feature/<phạm-vi>-<tên-ngắn>` | `feature/social-01-like`, `feature/social-04-moments-dang` |
| Sửa lỗi | `fix/<tên-ngắn>` | `fix/discover-empty-image` |
| Tài liệu, cấu hình | `chore/<tên-ngắn>` hoặc `docs/<tên-ngắn>` | `docs/readme-setup` |

Một nhánh chỉ làm **một issue**. Việc lớn thì tách issue nhỏ, đừng dồn vào một nhánh.

## Các bước làm một việc

### 1. Tạo nhánh từ `main` mới nhất

```bash
git switch main
git pull origin main
git switch -c feature/social-01-like
```

Sau khi pull, nếu có migration hoặc thư viện mới thì chạy `npm run migrate` và các lệnh `npm install` (xem README).

### 2. Code và commit

Commit thường xuyên, mỗi commit một thay đổi có ý nghĩa. Tên commit theo [Conventional Commits](https://www.conventionalcommits.org/):

```text
<loại>(<phạm vi>): <mô tả ngắn>
```

| Loại | Khi nào |
| --- | --- |
| `feat` | Thêm tính năng |
| `fix` | Sửa lỗi |
| `test` | Thêm hoặc sửa test |
| `docs` | Tài liệu |
| `refactor` | Sửa code nhưng không đổi hành vi |
| `chore` | Cấu hình, thư viện, script |

Ví dụ: `feat(social): like artwork`, `fix(catalog): folder move depth`, `test(social): comment permissions`.

Hook tự chạy khi commit:

- `pre-commit`: `npm run lint` và `npm run typecheck`.
- `commit-msg`: kiểm tra tên commit đúng chuẩn trên.

Hook báo lỗi thì sửa rồi commit lại. **Không dùng `--no-verify`.**

### 3. Cập nhật theo `main` trong lúc làm

Khi người khác đã merge vào `main`, kéo về nhánh của mình để phát hiện xung đột sớm:

```bash
git fetch origin
git merge origin/main
```

Có xung đột thì sửa các file bị đánh dấu, rồi `git add <file>` và `git commit`. Không chắc phần nào giữ lại thì hỏi người viết đoạn code đó.

### 4. Push và mở PR

```bash
git push -u origin feature/social-01-like
```

Lên GitHub, bấm **Compare & pull request**, chọn base là `main`.

Trong mô tả PR ghi:

- `Closes #<số issue>`, để issue tự đóng khi merge.
- Đã làm gì; cách thử (tài khoản nào, bấm vào đâu).
- Ảnh chụp màn hình nếu có thay đổi giao diện.
- Có migration mới hoặc biến `.env` mới không, để người khác biết chạy `npm run migrate` / cập nhật `.env`.

Trước khi mở PR, chạy đủ:

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```

### 5. Review và merge

- Người còn lại review. Có góp ý thì sửa trên cùng nhánh, push lên là PR tự cập nhật.
- CI (GitHub Actions) phải xanh mới merge.
- Merge bằng nút **Merge pull request** trên GitHub.

### 6. Dọn nhánh sau khi merge

```bash
git switch main
git pull origin main
git branch -d feature/social-01-like
```

Nhánh trên GitHub thì bấm **Delete branch** ngay trong PR đã merge.

## Không được làm

- Commit hoặc push thẳng lên `main`.
- `git push --force` lên `main`. Trên nhánh của mình thì chỉ force khi chắc chắn không ai khác dùng nhánh đó.
- Commit file `.env` hoặc bất kỳ khóa bí mật nào (Cloudinary, Google, SMTP, JWT secret).
- Sửa migration đã merge vào `main`. Cần đổi thì tạo migration mới.

## Nên bật trên GitHub

Repo → **Settings** → **Branches** → **Add branch ruleset** (hoặc *Add rule*) cho `main`:

- Require a pull request before merging (bắt buộc qua PR, có thể yêu cầu 1 approval).
- Require status checks to pass (bắt CI xanh).
- Block force pushes.
