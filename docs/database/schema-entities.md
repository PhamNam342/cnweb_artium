# Database Schema Reference

> Nguon: cac TypeORM entity dang co trong `BE/apps/*/src/domain/entities` va entity ha tang trong `BE/libs`.
> Cap nhat theo source code tai thoi diem tao tai lieu. Day la tai lieu schema, khong thay the migration history.

## Quy uoc chung

- Tat ca entity ke thua `AbstractEntity` deu co `created_at` (timestamp with time zone) va `updated_at` (nullable timestamp with time zone), tru khi entity ha tang khong ke thua class nay.
- `PK` la khoa chinh; `FK noi bo` la quan he TypeORM trong cung service/database. Nhung `*_id` den service khac chi la **tham chieu logic**, khong nen gia dinh co foreign key vat ly xuyen database.
- Cac cot `json/jsonb` luu snapshot, metadata hoac mang nho. Khong dung chung nhu mot quan he co the truy van va rang buoc.
- UUID la khoa dinh danh mac dinh. Gia tien fiat dung `decimal`; so wei/on-chain dung chuoi hoac decimal 38,0 de tranh mat chinh xac.

## Ban do service

| Service / library | Bang |
| --- | --- |
| identity-service | `users`, `refresh_tokens`, `seller_profiles`, `seller_websites` |
| artwork-service | `artworks`, `artwork_folders`, `tags`, `artwork_tags`, `artwork_likes`, `artwork_comments`, `artwork_comment_likes`, `artwork_auction_lifecycle_snapshots` |
| orders-service | `shopping_carts`, `cart_items`, `orders`, `order_items`, `auction_start_attempts`, `wallet_ownerships` |
| payments-service | `payment_transactions`, `payment_methods`, `stripe_customers`, `invoices`, `invoice_items`, `payouts` |
| community-service | `followers`, `moments`, `moment_tagged_artworks`, `moment_views`, `moodboards`, `moodboard_artworks`, `moodboard_collaborators`, `moodboard_media`, `community_media`, `likes`, `comments`, `testimonials`, `activity_feeds` |
| messaging-service | `conversations`, `conversation_participants`, `messages`, `message_attachments`, `read_receipts`, `typing_indicators` |
| crm-service | `contacts`, `customer_segments`, `private_views`, `private_view_invitees`, `private_view_artworks`, `promotions`, `email_campaigns`, `campaign_recipients` |
| events-service | `events`, `event_rsvps`, `event_attendees`, `event_artworks` |
| notifications-service | `notification_history` |
| shared libraries | `outbox`, `blockchain_processed_event`, `blockchain_event_cursor` |

## Identity service

### `users`

Tai khoan va dinh danh trung tam cua he thong.

- **Khoa va dinh danh:** `id` (PK), `email` (unique), `slug` (unique, nullable), `google_id` (unique, nullable), `wallet_address` (unique, nullable).
- **Thong tin dang nhap:** `password` nullable de ho tro tai khoan Google/wallet; `is_email_verified`, `last_login`, `is_active`.
- **Ho so co ban:** `full_name`, `avatar_url`, `roles` (mang enum, mac dinh Collector), `stripe_customer_id`.
- **Index:** unique theo email/slug/googleId/walletAddress va `(is_active, created_at)` de loc tai khoan hoat dong moi.
- **Quan he logic:** duoc tat ca service tham chieu qua `user_id`, `collector_id`, `seller_id`, `sender_id`... Khong co FK xuyen service.

### `refresh_tokens`

Luu refresh token de gia han, revoke session va logout an toan.

- **Cot:** `id` (PK), `token` (unique), `expires_at`, `user_agent`, `ip_address`, `revoked`.
- **Quan he:** `ManyToOne` den `users`, xoa user se cascade xoa token.
- **Index:** unique `token`, va `expires_at`, `revoked` phuc vu cleanup/xac minh token.

### `seller_profiles`

Ho so ban hang/nghe si, tach khoi tai khoan chung de chua thong tin kinh doanh va kenh thanh toan.

- **Dinh danh/loai profile:** `id` (PK), `user_id` (unique), `profile_type`, `display_name`, `bio`.
- **Hinh anh va hien thi:** `profile_image_url`, `cover_image_url`, `website_url`, `location`, `meta_description`, `tag_ids` (JSONB tham chieu tag cua artwork service).
- **Kinh doanh/thanh toan:** `stripe_account_id`, `paypal_merchant_id`, `business_registration`, `tax_id`, `business_address` (JSONB), `business_phone`, co `stripe_onboarding_complete` va `paypal_onboarding_complete`.
- **Mang xa hoi:** `instagram_url`, `facebook_url`, `twitter_url`, `linkedin_url`.
- **Trang thai va metrics:** `is_active`, `is_verified`, `verified_at`, `sold_artwork_count`, `total_sales`, `average_rating`, `is_featured`.
- **Index:** unique `user_id`; `display_name`; `(is_active, profile_type, is_verified)` va `(is_featured, is_active)` phuc vu marketplace.
- **Quan he:** 1-n `seller_websites`; `user_id` la tham chieu logic sang `users`.

### `seller_websites`

Danh sach lien ket cong khai cua seller profile.

- **Cot:** `id` (PK), `seller_id`, `website_type` (mac dinh `portfolio`), `title`, `url`, `description`, `icon`, `display_order`, `is_visible`.
- **Quan he:** `ManyToOne` noi bo den `seller_profiles`, `CASCADE` khi xoa profile.
- **Index:** `seller_id` de tai danh sach link theo seller.

## Artwork service

### `artworks`

Bang trung tam cho tac pham, listing va du lieu cau hinh auction.

- **Chu so huu/noi dung:** `id` (PK), `seller_id`, `creator_name`, `title`, `description`, `creation_year`, `edition_run`, `materials`, `location`.
- **Vat ly va ban hang:** `dimensions` (JSON), `weight` (JSON), `price`, `currency`, `quantity`, `status`, `is_published`, `images` (JSONB), `folder_id`.
- **Counter da chuan hoa:** `view_count`, `like_count`, `comment_count`, `moodboard_count`; day la cache/counter, cap nhat theo nghiep vu.
- **Auction/on-chain:** `ipfs_metadata_hash`, `reserve_price`, `min_bid_increment` (do chinh xac cao), `auction_duration`, `on_chain_auction_id` (unique neu co gia tri).
- **Quan he:** `folder_id` la FK noi bo den `artwork_folders`, `SET NULL` khi folder bi xoa; 1-n den `artwork_tags`, `artwork_comments`, `artwork_likes`.
- **Index:** `(seller_id, status)`, `(seller_id, is_published, created_at)`, `(status, is_published)`, `created_at`.

### `artwork_folders`

Cay folder de seller to chuc tac pham.

- **Cot:** `id` (PK), `seller_id`, `name`, `position`, `is_hidden`, `parent_id` nullable.
- **Quan he:** self-reference `parent_id` -> folder cha; 1-n den folder con va `artworks`. Xoa folder cha dat `parent_id` cua con thanh null.
- **Index:** `seller_id`, `parent_id`, `(seller_id, name)`, `(seller_id, position)`.

### `tags`

Danh muc tag dung cho artwork, co the la tag he thong hoac seller tu tao.

- **Cot:** `id` (PK), `name` (unique), `status`, `seller_id` nullable.
- **Quan he:** 1-n `artwork_tags`.
- **Index:** unique `name`, `status`, `seller_id`.

### `artwork_tags`

Bang noi n-n giua artwork va tag.

- **Cot/khoa:** PK kep `artwork_id`, `tag_id`.
- **Quan he:** ca hai la FK noi bo den `artworks` va `tags`; xoa mot dau moi quan he se cascade.
- **Rang buoc/index:** unique `(artwork_id, tag_id)` va index `tag_id` de lay artwork theo tag.

### `artwork_likes`

Like artwork cua nguoi dung.

- **Cot:** `like_id` (PK), `user_id`, `artwork_id`, `seller_id`.
- **Quan he:** `artwork_id` la FK noi bo den `artworks`, cascade khi artwork bi xoa; `user_id`/`seller_id` la tham chieu identity-service.
- **Rang buoc/index:** unique `(user_id, artwork_id)` chong like lap; index timeline theo artwork/seller/user voi `created_at`.

### `artwork_comments`

Binh luan va reply tren artwork.

- **Cot:** `comment_id` (PK), `user_id`, `artwork_id`, `seller_id`, `parent_comment_id`, `content`, `media_url`, `mentioned_user_ids` (JSONB).
- **Moderation va counter:** `like_count`, `reply_count`, `is_edited`, `edited_at`, `is_deleted`, `deleted_at`, `is_flagged`.
- **Quan he:** `artwork_id` FK den `artworks`; `parent_comment_id` self-reference cho reply; 1-n `artwork_comment_likes`.
- **Index:** `(artwork_id, created_at)`, `(artwork_id, parent_comment_id)`, `(user_id, created_at)`, `seller_id`, `(is_deleted, created_at)`.

### `artwork_comment_likes`

Like cho comment cua artwork.

- **Cot:** `like_id` (PK), `user_id`, `comment_id`.
- **Quan he:** `comment_id` FK noi bo den `artwork_comments`, cascade khi comment bi xoa.
- **Rang buoc/index:** unique `(user_id, comment_id)`, index `(comment_id, created_at)`.

### `artwork_auction_lifecycle_snapshots`

Ban snapshot de artwork service doc trang thai khoi dong auction tu order service ma khong dong bo database.

- **Cot:** `id` (PK), `seller_id`, `artwork_id`, `attempt_id`, `order_id`, `source_updated_at`, `payload` (JSONB).
- **Rang buoc:** unique `(seller_id, artwork_id)`; mot snapshot hien hanh cho mot cap seller-artwork.
- **Luu y:** cac ID deu la tham chieu cross-service, khong co FK vat ly.

## Orders service

### `shopping_carts`

Gio hang hien hanh cua mot nguoi dung.

- **Cot:** `cart_id` (PK), `user_id` (unique), `total_items`, `subtotal`, `currency`, `promo_code`, `discount_amount`, `last_activity_at`, `expires_at`.
- **Rang buoc/index:** unique `user_id` dam bao 1 gio/user.
- **Quan he logic:** `cart_items.cart_id` tro den bang nay (entity hien tai chua khai bao relation TypeORM).

### `cart_items`

Dong hang trong gio.

- **Cot:** `cart_item_id` (PK), `cart_id`, `artwork_id`, `seller_id`, `quantity`, `added_at`.
- **Rang buoc/index:** unique `(cart_id, artwork_id)`, index `cart_id`, `artwork_id`.
- **Luu y:** artwork/seller la snapshot tham chieu den service khac; can kiem tra ton kho/gia lai khi checkout.

### `orders`

Don hang, dong thoi la aggregate chinh cho payment, giao hang va escrow.

- **Cot don hang:** `order_id` (PK), `collector_id`, `order_number` (unique), `status`, `subtotal`, `shipping_cost`, `tax_amount`, `discount_amount`, `total_amount`, `currency`, `promo_code`.
- **Van chuyen:** `shipping_address`, `billing_address` (JSONB), `shipping_method`, `tracking_number`, `carrier`, `estimated_delivery_date`.
- **Payment:** `payment_transaction_id`, `payment_method`, `payment_status`, `payment_intent_id`.
- **Vong doi:** `customer_notes`, `internal_notes`, `cancelled_reason`, `cancelled_at`, `confirmed_at`, `shipped_at`, `delivered_at`.
- **Xac nhan giao:** `delivery_confirmed_by`, `delivery_confirmation_method`, `delivery_confirmation_notes`, `delivery_signature_data_url`, `delivery_confirmation_tx_hash`, `delivery_confirmation_submitted_at`.
- **Escrow/dispute:** `on_chain_order_id` (unique), `contract_address`, `chain_id`, `escrow_state`, `tx_hash`, `seller_wallet`, `buyer_wallet`, `bid_amount_wei`, `dispute_reason`, `dispute_opened_at`, `dispute_resolved_at`, `dispute_resolution_notes`.
- **Quan he:** 1-n `order_items` qua FK noi bo `order_id`.
- **Index:** `(collector_id, status)`, `created_at`; unique `order_number` va `on_chain_order_id` neu co.

### `order_items`

Snapshot tung tac pham tai thoi diem dat hang, giu lich su khi artwork sau do thay doi.

- **Cot:** `order_item_id` (PK), `order_id`, `artwork_id`, `seller_id`, `price_at_purchase`, `quantity`, `currency`.
- **Snapshot artwork:** `artwork_title`, `artwork_image_url`, `artwork_description`.
- **Phan bo tien:** `platform_fee`, `seller_payout_amount`, `payout_status`, `payout_at`.
- **Quan he:** `order_id` FK noi bo den `orders`; artwork/seller la cross-service reference.
- **Index:** `order_id`, `artwork_id`, `seller_id`.

### `auction_start_attempts`

Luu y dinh bat dau auction cua seller, ho tro retry va audit loi vi/on-chain.

- **Cot:** `auction_start_attempt_id` (PK), `seller_id`, `artwork_id`, `order_id` (unique), `status`.
- **Snapshot hien thi:** `artwork_title`, `creator_name`, `thumbnail_url`.
- **On-chain:** `wallet_address`, `contract_address`, `tx_hash` (unique), `duration_seconds`, `reserve_price_wei`, `min_bid_increment_wei`, `ipfs_metadata_hash`, `terms_snapshot` (JSONB).
- **Retry/loi:** `reason_code`, `reason_message`, `retry_allowed`, `edit_allowed`, `wallet_action_required`, `activated_at`.
- **Index:** `(seller_id, artwork_id)`, unique `order_id`.

### `wallet_ownerships`

Projection quyen so huu vi, dong bo tu event lien ket/huy lien ket wallet.

- **Cot/khoa:** `wallet_address` la PK; `user_id` nullable, `linked_at`, `unlinked_at`, `last_event_at`.
- **Index:** `user_id` de tim vi cua user.
- **Luu y:** bang nay thich hop cho xu ly event idempotent; `wallet_address` la identity tu nhien.

## Payments service

### `payment_transactions`

So cai giao dich cho Stripe, PayPal va blockchain escrow.

- **Cot cot loi:** `transaction_id` (PK), `type`, `status`, `provider`, `user_id`, `seller_id`, `order_id`, `invoice_id`, `amount`, `currency`, `platform_fee`, `net_amount`.
- **Provider/payment method:** `stripe_payment_intent_id`, `stripe_charge_id`, `paypal_order_id`, `paypal_capture_id`, `payment_method_id`, `payment_method_type`, `payment_method_last_four`.
- **Xu ly loi/refund:** `description`, `metadata` (JSONB), `failure_reason`, `failure_code`, `refund_amount`, `refund_reason`, `refunded_at`.
- **Confirmation retry:** `processed_at`, `completed_at`, `confirmation_attempts`, `next_confirmation_at`, `confirmation_started_at`, `last_confirmation_error`, `confirmed_block_number`.
- **Blockchain:** `escrow_state`, `tx_hash` (unique - idempotency), `wallet_address`.
- **Index:** `order_id`, `invoice_id`, `(user_id, created_at)`, `(seller_id, created_at)`, `(status, provider)`.

### `payment_methods`

Payment method da luu cua user; chi luu thong tin an toan da token hoa, khong luu PAN/CVV.

- **Cot:** `payment_method_id` (PK), `user_id`, `type`, `provider`, `last_four`, `brand`, `expiry_month`, `expiry_year`.
- **Provider/billing:** `stripe_payment_method_id`, `paypal_payment_method_id`, `billing_name`, `billing_email`, `billing_address` (JSONB).
- **Trang thai:** `is_default`, `is_active`, `last_used_at`.
- **Quan he logic:** duoc `payment_transactions.payment_method_id` tham chieu.

### `stripe_customers`

Anh xa user sang Stripe Customer.

- **Cot:** `stripe_customer_id` (PK noi bo), `user_id` (unique), `stripe_id` (unique, gia tri `cus_xxx` cua Stripe), `email`, `name`, `is_active`.
- **Muc dich:** tranh tao lap customer va giam phu thuoc vao `users.stripe_customer_id` khi payment service tu chu hon.
- **Rang buoc:** entity dat unique/index tren user/provider identifier de duy tri 1 mapping hop le.

### `invoices`

Hoa don seller phat hanh cho collector.

- **Cot:** `invoice_id` (PK), `seller_id`, `collector_id`, `customer_email`, `invoice_number` (unique, nullable), `status`, `order_id`.
- **Tien:** `subtotal`, `tax_amount`, `discount_amount`, `total_amount`, `currency`.
- **Payment va thoi gian:** `payment_transaction_id`, `paid_at`, `issue_date`, `due_date`, `sent_at`, `cancelled_at`.
- **Noi dung:** `notes`, `terms_and_conditions`.
- **Quan he:** 1-n `invoice_items`; cac ID seller/collector/order la cross-service, payment transaction la tham chieu trong payment database.
- **Index:** `(seller_id, status)`, `(collector_id, status)`, `(status, due_date)`.

### `invoice_items`

Dong hang cua hoa don.

- **Cot:** `invoice_item_id` (PK), `invoice_id`, `description`, `quantity`, `unit_price`, `amount`, `tax_rate`, `tax_amount`, va metadata snapshot cua artwork neu co.
- **Quan he:** `invoice_id` FK noi bo den `invoices`; invoice cascade quan ly line item.
- **Muc dich:** giu so lieu hoa don bat bien, khong phu thuoc du lieu listing hien tai.

### `payouts`

Theo doi tien tra cho seller.

- **Cot cot loi:** `payout_id` (PK), `seller_id`, `status`, `provider`, `amount`, `currency`, `transaction_fee`, `net_amount`.
- **Provider:** `stripe_payout_id`, `stripe_account_id`, `paypal_payout_batch_id`, `paypal_payout_item_id`, `transaction_ids` (JSONB).
- **Xu ly:** `description`, `failure_reason`, `failure_code`, `scheduled_at`, `processed_at`, `paid_at`, `arrival_date`.
- **Index:** `(seller_id, status)`, `created_at`.

## Community service

### `followers`

Quan he follow user-user.

- **Khoa kep:** `following_user_id`, `followed_user_id`.
- **Cot:** `is_mutual`, `notify_on_posts`, `notify_on_events`, `follow_source`, `is_auto_follow`, `engagement_score`, `last_viewed_at`.
- **Index:** unique cap follow, timeline theo followed/following va `created_at`.

### `moments`

Noi dung ngan kieu story/moment cua user.

- **Cot:** `id` (PK), `user_id`, `media_url`, `media_type`, `thumbnail_url`, `caption`, `is_pinned`, `is_archived`, `expires_at`.
- **Metrics/meta:** `view_count`, `like_count`, `comment_count`, `location`, `hashtags` (JSONB), `duration_seconds`.
- **Quan he:** 1-n `moment_tagged_artworks`, `moment_views`; like/comment dung polymorphic ID.
- **Index:** `(user_id, created_at)`, `(is_archived, expires_at)`, `created_at`.

### `moment_tagged_artworks`

Noi n-n moment va artwork duoc tag.

- **Khoa kep:** `moment_id`, `artwork_id`; `display_order` quy dinh thu tu hien thi.
- **Index:** unique cap moment-artwork, `artwork_id`, `(moment_id, display_order)`.

### `moment_views`

Tracking ai da xem moment.

- **Cot:** `view_id` (PK), `moment_id`, `viewer_id`, `moment_owner_id`, `view_duration_seconds`, `viewed_at`, `source`, `liked`, `commented`, `shared`.
- **Rang buoc:** unique moment-viewer de dem unique view; index `(moment_id, created_at)` va `viewer_id` cho analytics.

### `moodboards`

Bo suu tap artwork do user curates.

- **Cot:** `id` (PK), `user_id`, `title`, `description`, `cover_image_url`, `is_private`, `is_collaborative`, `tags` (JSONB), `display_order`.
- **Counters:** `artwork_count`, `like_count`, `view_count`, `share_count`.
- **Quan he:** 1-n `moodboard_artworks`, `moodboard_collaborators`, `moodboard_media`; like/comment la polymorphic.
- **Index:** `(user_id, is_private)`, `(user_id, created_at)`.

### `moodboard_artworks`

Noi moodboard va artwork, co cache nhe de render grid nhanh.

- **Khoa kep:** `moodboard_id`, `artwork_id`.
- **Cot:** `display_order`, `notes`, `tags` (JSONB), `is_favorite`, `artwork_title`, `artwork_image_url`, `artwork_seller_id`.
- **Index:** unique cap moodboard-artwork, `artwork_id`, `(moodboard_id, display_order)`.

### `moodboard_collaborators`

Phan quyen cong tac tren moodboard.

- **Khoa kep:** `moodboard_id`, `user_id`.
- **Cot:** `role` (mac dinh EDITOR), `can_edit`, `can_invite`, `invited_at`, `invited_by`.
- **Index:** unique cap moodboard-user va `user_id`.

### `moodboard_media`

Media gan truc tiep vao moodboard.

- **Cot:** `id` (PK), `moodboard_id`, `media_type`, `url`, `thumbnail_url`, `file_name`, `file_size`, `mime_type`, `width`, `height`, `duration`, `display_order`, `metadata`.
- **Quan he:** `moodboard_id` la FK noi bo den moodboard; index theo moodboard/de hien thi dung thu tu.

### `community_media`

Kho metadata media dung chung cho community entities.

- **Cot:** `id` (PK), `owner_id`, `owner_type` (polymorphic), `uploader_id`, loai file, URL/thumbnail, ten/MIME/kich thuoc, width-height-duration va `metadata`.
- **Muc dich:** tach file metadata khoi noi dung, de moderation va tai su dung.
- **Index:** theo cap `owner_type`-`owner_id`, uploader va created time.

### `likes`

Like polymorphic cho cac entity community (moment, moodboard, comment, testimonial).

- **Cot:** `id` (PK), `user_id`, `likeable_type`, `likeable_id`, `content_owner_id`.
- **Rang buoc/index:** unique `(user_id, likeable_type, likeable_id)`; timeline theo target va user.
- **Luu y:** artwork like nam rieng trong artwork service, khong dung bang nay.

### `comments`

Comment polymorphic cua community service.

- **Cot:** `comment_id` (PK), `user_id`, `commentable_type`, `commentable_id`, `parent_comment_id`, `content`, `media_url`, `mentioned_user_ids` (JSONB), `content_owner_id`.
- **Vong doi:** `like_count`, `reply_count`, `is_edited`, `edited_at`, `is_deleted`, `deleted_at`, `is_flagged`.
- **Quan he:** self-reference `parent_comment_id`; target duoc xac dinh boi type/id, khong co FK da hinh.

### `testimonials`

Danh gia mua hang/seller.

- **Cot:** `testimonial_id` (PK), `buyer_id`, `seller_id`, `artwork_id`, `order_id`, `rating`, `content`, `buyer_name`, `review_type`.
- **Moderation/hien thi:** `is_approved`, `is_visible`, `is_flagged`, `flag_reason`, `approved_at`, `approved_by`.
- **Phan hoi/metrics:** `seller_response`, `seller_responded_at`, `helpful_count`, `not_helpful_count`, `is_verified_purchase`, `review_images`, `detailed_ratings` (JSONB).
- **Rang buoc/index:** unique `(buyer_id, artwork_id)`; `(artwork_id, is_approved)`, `(seller_id, rating)`.

### `activity_feeds`

Projection su kien de render feed va notification in-app.

- **Cot:** `activity_id` (PK), `user_id`, `activity_type`, `entity_type`, `entity_id`, `target_user_id`, `description`, `metadata` (JSONB), `is_public`, `view_count`, `interaction_count` va timestamp.
- **Muc dich:** khong phai audit log day du; co the delete/expire de gioi han dung luong.
- **Index:** target/actor/created time phuc vu fan-out va lay feed moi.

## Messaging service

### `conversations`

Thread chat direct, group, event chat hoac artwork inquiry.

- **Cot:** `id` (PK), `name`, `is_group`, `type`, `related_entity_type`, `related_entity_id`, `description`, `image_url`, `created_by`.
- **Preview/counter:** `message_count`, `last_message_content`, `last_message_sender_id`, `last_message_at`.
- **Trang thai:** `is_archived`, `is_active`.
- **Quan he:** 1-n `messages`, `conversation_participants`; related entity la polymorphic cross-service.
- **Index:** `(type, updated_at)`.

### `conversation_participants`

Bang thanh vien cua conversation.

- **Cot:** `id` (PK), `conversation_id`, `user_id`.
- **Quan he:** `conversation_id` FK noi bo den conversations; user la tham chieu identity.
- **Rang buoc/index:** unique `(conversation_id, user_id)`; index tung cot de lay chat cua user.

### `messages`

Tin nhan trong conversation.

- **Cot:** `id` (PK), `conversation_id`, `sender_id`, `content`, `type`, `media_url`, `reply_to_message_id`.
- **Noi dung rich:** `metadata` (artwork/moodboard/event/file), `mentioned_user_ids`, `reactions` - deu JSONB.
- **Vong doi:** `is_edited`, `edited_at`, `is_deleted`, `deleted_at`.
- **Quan he:** `conversation_id` FK noi bo; reply la logical self-reference; co attachment va read receipt.
- **Index:** `(conversation_id, created_at)`, `sender_id`.

### `message_attachments`

File va shared entity kem message.

- **Cot:** `id` (PK), `message_id`, `conversation_id`, `type`, `url`, `thumbnail_url`, `file_name`, `file_size`, `mime_type`, `width`, `height`, `duration`, `artwork_id`, `moodboard_id`, `metadata`.
- **Quan he:** message/conversation trong service; artwork/moodboard la cross-service reference.
- **Index:** `message_id` de tai attachment theo message.

### `read_receipts`

Trang thai delivered/read cua tung user tren tung message.

- **Cot:** `id` (PK), `conversation_id`, `message_id`, `user_id`, `read_at`, `delivered_at`.
- **Rang buoc/index:** unique `(message_id, user_id)`; `(conversation_id, user_id)` cho unread state.

### `typing_indicators`

Trang thai typing ngan han, duoc cleanup theo expiry.

- **Cot:** `id` (PK), `conversation_id`, `user_id`, `is_typing`, `expires_at`.
- **Rang buoc/index:** unique `(conversation_id, user_id)` va index `expires_at` cho cleanup.

## CRM service

### `contacts`

CRM contact database rieng cua moi seller.

- **Cot danh tinh:** `contact_id` (PK), `seller_id`, `email`, `first_name`, `last_name`, `phone`, `company`, `job_title`, `address` (JSONB).
- **Trang thai/nguon:** `status`, `source`, `opt_in_email`, `opt_in_sms`, `unsubscribed_at`.
- **Segment va tuong tac:** `tags`, `customer_segment_ids` (JSONB), `email_opens`, `email_clicks`, `last_email_sent_at`, `last_email_opened_at`, `engagement_score`.
- **Lich su mua:** `total_purchases`, `total_spent`, `last_purchase_at`; kem `notes`, `custom_fields` (JSONB).
- **Rang buoc/index:** unique `(seller_id, email)`, index `(seller_id, status)` va `email`.

### `customer_segments`

Segment dong/tinh cua contact cua seller.

- **Cot:** `segment_id` (PK), `seller_id`, `name`, `description`, `type`, `criteria` (JSONB), `member_count`, `is_active`.
- **Automation:** fields ve condition/rule, `last_calculated_at`, `next_calculation_at` de ho tro segment dong.
- **Index:** `seller_id`.

### `private_views`

Landing/view rieng de seller gioi thieu bo suu tap cho khach VIP.

- **Cot:** `view_id` (PK), `seller_id`, `title`, `description`, `access_token` (unique), `password_hash`, `is_password_protected`, `expires_at`.
- **Cau hinh:** `cover_image_url`, `max_views`, `current_views`, `show_prices`, `allow_inquiries`, `allow_purchases`, `welcome_message`, `is_active`, `notes`.
- **Analytics:** `unique_visitors`, `inquiry_count`, `purchase_count`, `total_revenue`.
- **Quan he:** 1-n `private_view_invitees`, `private_view_artworks`.
- **Index:** unique token va `(seller_id, expires_at)`.

### `private_view_invitees`

Nguoi duoc moi vao private view, co the la contact hoac guest email.

- **Khoa/cot:** `view_id`, `contact_id` nullable, `email`, `has_viewed`, `viewed_at`, `invited_at`.
- **Rang buoc:** unique `(view_id, contact_id)` khi contact khac null va `(view_id, email)` khi email khac null.
- **Quan he:** view/contact la relation noi bo; cho phep guest khong co contact.

### `private_view_artworks`

Artwork duoc dua vao private view voi cach trinh bay/gia rieng.

- **Khoa:** `private_view_id`, `artwork_id`.
- **Cot:** `display_order`, `is_featured`, `custom_price`, `custom_description`, `metadata`/snapshot trinh bay.
- **Rang buoc:** unique artwork trong mot view; artwork la tham chieu artwork-service.

### `promotions`

Chuong trinh khuyen mai cua seller.

- **Cot:** `id` (PK), `seller_id`, `name`, `code`, `description`, `discount_type`, `discount_value`, `min_purchase_amount`, `max_discount_amount`.
- **Hieu luc/gioi han:** `starts_at`, `expires_at`, `max_uses`, `uses_per_customer`, `current_uses`, `is_active`.
- **Pham vi:** `applicable_artwork_ids`, `applicable_categories` (JSONB).
- **Index/rang buoc:** seller-code duoc index/unique theo entity de tra ma nhanh.

### `email_campaigns`

Chien dich email marketing.

- **Cot:** `campaign_id` (PK), `seller_id`, `name`, `subject`, `content`, `status`, `scheduled_at`, `sent_at`, `template_id`.
- **Targeting:** `recipient_segment_ids`, `recipient_contact_ids` (JSONB).
- **Metrics:** `total_recipients`, `sent_count`, `open_count`, `click_count`, `bounce_count`, `unsubscribe_count`.
- **Quan he:** 1-n `campaign_recipients`; index theo seller/status/schedule.

### `campaign_recipients`

Delivery state va engagement cua tung contact/nguoi nhan trong campaign.

- **Cot:** `id` (PK), `campaign_id`, `contact_id`, `email`, `status`, `sent_at`, `opened_at`, `clicked_at`, `bounced_at`, `unsubscribed_at`.
- **Tracking:** open/click count, provider message id, failure/bounce reason va tracking metadata.
- **Rang buoc:** mot recipient/email chi nen xuat hien mot lan trong mot campaign; index theo campaign/status.

## Events service

### `events`

Su kien nghe thuat: exhibition, workshop, opening, auction...

- **Cot co ban:** `event_id` (PK), `creator_id`, `title`, `description`, `type`, `status`.
- **Thoi gian/dia diem:** `start_time`, `end_time`, `timezone`, `location` (JSONB: physical/virtual/hybrid).
- **Media/dang ky:** `cover_image_url`, `gallery_images`, `requires_registration`, `max_attendees`, `registration_deadline`, `attendee_count`.
- **Quyen truy cap/ve:** `is_public`, `invite_only`, `access_code`, `is_free`, `ticket_price`, `currency`.
- **Lien lac va lifecycle:** `external_url`, `contact_email`, `contact_phone`, `tags`, `cancellation_reason`, `cancelled_at`, `published_at`.
- **Quan he:** 1-n rsvp, attendee, event artwork; creator la seller profile cross-service.
- **Index:** `(creator_id, status)`, `start_time`, `(is_public, status)`.

### `event_rsvps`

Dang ky tham gia truoc su kien.

- **Cot:** `rsvp_id` (PK), `event_id`, `user_id`, `status`, `invited_by_user_id`, `guest_name`, `guest_email`, `guest_phone`, `number_of_guests`.
- **Chi tiet/processing:** `dietary_restrictions`, `special_requests`, `notes`, `checked_in`, `checked_in_at`, `reminder_sent`, `reminder_sent_at`, `responded_at`.
- **Rang buoc/index:** unique `(event_id, user_id)`, index `(event_id, status)` va `user_id`.

### `event_attendees`

Tracking nguoi thuc su den/check-in, bao gom walk-in.

- **Cot:** `attendee_id` (PK), `event_id`, `user_id` nullable, `rsvp_id` nullable, `walk_in_name`, `walk_in_email`, `walk_in_phone`, `checked_in_at`, `checked_in_by`, `check_in_method`, `number_of_guests`, `duration_minutes`.
- **Engagement/feedback:** `artworks_viewed` (JSONB), `inquiries_made`, `purchases_made`, `rating`, `feedback`, `opt_in_marketing`, `notes`.
- **Index:** `(event_id, checked_in_at)`, `user_id`.

### `event_artworks`

Artwork trung bay tai event.

- **Cot:** `event_artwork_id` (PK), `event_id`, `artwork_id`, `display_order`, `is_featured`, `custom_description`, `event_price`, `is_available_for_sale`, `notes`, `view_count`, `inquiry_count`.
- **Rang buoc/index:** unique `(event_id, artwork_id)`, index event/artwork va thu tu display.

## Notifications va ha tang

### `notification_history`

Lich su gui notification qua email, push, SMS, in-app hoac webhook.

- **Cot:** `id` (PK), `user_id` nullable, `channel`, `trigger_event`, `status`, `title`, `body`.
- **Context/loi:** `template_context` (JSONB), `metadata` (JSONB), `failure_reason`, `sent_at`, `read_at`.
- **Index:** `(user_id, created_at)`, `(trigger_event, status)`, `status` cho worker lay ban ghi pending.

### `outbox`

Transactional outbox de publish domain event dang tin cay.

- **Cot:** `id` (PK), `aggregate_type`, `aggregate_id`, `event_type`, `payload` (JSONB), `status`, `retry_count`, `error`, `published_at`, `max_retries`, `created_at`.
- **Index:** aggregate/event type va status phuc vu worker poll, retry va idempotency.
- **Luu y:** bang nay nen nam cung transaction voi thay doi aggregate de tranh mat event.

### `blockchain_processed_event`

Idempotency store cho log on-chain da xu ly.

- **Cot:** `id` (PK), `tx_hash`, `log_index`, `block_number`, `event_name`.
- **Rang buoc:** unique `(tx_hash, log_index)` dam bao moi Ethereum log chi xu ly mot lan.

### `blockchain_event_cursor`

Checkpoint cho tung blockchain listener.

- **Khoa:** `listener_id` (varchar) la PK.
- **Cot:** `last_processed_block` (bigint, mac dinh `0`), `updated_at`.
- **Muc dich:** resume indexer sau restart va tranh scan lai toan bo chain.

## Ghi chu thiet ke quan trong

1. `orders`, `payment_transactions`, `auction_start_attempts` va `blockchain_*` phai duoc cap nhat idempotent; uu tien unique key (`tx_hash`, `on_chain_order_id`, `order_id`) va outbox event.
2. Counter nhu `like_count`, `comment_count`, `attendee_count`, `message_count` la denormalized data. Can quy dinh ro transaction/event handler nao cap nhat chung de tranh drift.
3. JSONB nhu dia chi, metadata, reactions, location va snapshot la hop ly khi du lieu thuoc ban ghi cha va khong can rang buoc; neu can query/unique/phan quyen theo tung phan tu, tach thanh bang relation.
4. Cac scalar reference xuyen service (`user_id`, `artwork_id`, `seller_id`, `order_id`) can validate qua API/event va can chinh sach khi ban ghi nguon bi xoa/an, vi database khong enforce FK xuyen service.
5. Source hien tai co mot so quan he duoc luu bang scalar ma chua khai bao `ManyToOne`; tai lieu khong tu suy dien FK vat ly tu cac cot do.

