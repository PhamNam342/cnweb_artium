/**
 * Client API của social service (gateway: /api/follows, /api/reactions, /api/comments, /api/moments).
 * Mỗi tính năng điền vào nhóm của mình để hai người làm song song không sửa cùng một chỗ:
 *   reactionsApi — issue 01 (Like)
 *   commentsApi  — issue 02 (Bình luận)
 *   followsApi   — issue 03 (Theo dõi)
 *   momentsApi   — issue 04, 05 (Moments)
 * Gọi API bằng `api()` trong ../lib/api (tự gắn token, tự refresh khi 401).
 */

export const reactionsApi = {};

export const commentsApi = {};

export const followsApi = {};

export const momentsApi = {};
