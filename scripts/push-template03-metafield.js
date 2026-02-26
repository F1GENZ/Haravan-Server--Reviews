/**
 * Push demo metafield settings for template03 (fxpage03_*)
 * Usage: node scripts/push-template03-metafield.js <pageId> <token>
 * Example: node scripts/push-template03-metafield.js 1004316654 <your_token>
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

function buildDemoSettings(pageId) {
  return {
    // ── TOPBAR ──────────────────────────────────────────────
    fxpage03_brand_name: 'F1GENZ / LUXURY',
    fxpage03_pill_text: 'Bộ sưu tập giới hạn',

    // ── HERO ────────────────────────────────────────────────
    fxpage03_hero_video_src: 'https://cdn.hstatic.net/files/1000360248/file/videso.mp4',
    fxpage03_hero_video_poster: 'https://images.unsplash.com/photo-1520975958225-9c01b4a47e2f?auto=format&fit=crop&w=1200&q=70&sig=11',
    fxpage03_hero_eyebrow: 'Bộ sưu tập Biên tập • 2026',
    fxpage03_hero_headline: 'Vẻ đẹp của <em>khí chất</em>.',
    fxpage03_hero_subhead: 'Không dành cho số đông. Dành cho những ai hiểu giá trị của sự tinh giản — và mặc nó như một phần bản sắc.',
    fxpage03_hero_cta_text: 'Chọn thiết kế',
    fxpage03_hero_cta_link: '#product',

    // ── TRUST ───────────────────────────────────────────────
    fxpage03_trust_1_title: 'Limited Edition',
    fxpage03_trust_1_text: 'Sản xuất giới hạn theo mùa.',
    fxpage03_trust_2_title: 'Đổi Size Dễ Dàng',
    fxpage03_trust_2_text: 'Hỗ trợ đổi trong 7 ngày.',
    fxpage03_trust_3_title: 'Giao Hàng Nhanh',
    fxpage03_trust_3_text: '2–4 ngày toàn quốc.',

    // ── EDITORIAL ───────────────────────────────────────────
    fxpage03_editorial_title: 'Ít hơn — nhưng đắt giá hơn.',
    fxpage03_editorial_sub: 'Tinh thần thời trang luxury nằm ở chất liệu, đường nét và cảm xúc — không cần phô trương.',
    fxpage03_editorial_img_1: 'https://moncler-cdn.thron.com/api/v1/content-delivery/shares/dpx6uv/contents/K20911G0001559876825_1/image/vigeon-down-shirt-jacket-men-olive-green-moncler-0.jpg',
    fxpage03_editorial_img_2: 'https://moncler-cdn.thron.com/api/v1/content-delivery/shares/dpx6uv/contents/K20911G0001559876825_2/image/vigeon-down-shirt-jacket-men-olive-green-moncler-1.jpg',
    fxpage03_editorial_img_3: 'https://moncler-cdn.thron.com/api/v1/content-delivery/shares/dpx6uv/contents/K20911G0001559876825_F/image/vigeon-down-shirt-jacket-men-olive-green-moncler-2.jpg',
    fxpage03_editorial_img_4: 'https://moncler-cdn.thron.com/api/v1/content-delivery/shares/dpx6uv/contents/K20911G0001559876825_3/image/vigeon-down-shirt-jacket-men-olive-green-moncler-3.jpg',
    fxpage03_editorial_img_5: 'https://moncler-cdn.thron.com/api/v1/content-delivery/shares/dpx6uv/contents/K20911G0001559876825_4/image/vigeon-down-shirt-jacket-men-olive-green-moncler-4.jpg',
    fxpage03_editorial_img_6: 'https://moncler-cdn.thron.com/api/v1/content-delivery/shares/dpx6uv/contents/K20911G0001559876825_5/image/vigeon-down-shirt-jacket-men-olive-green-moncler-5.jpg',
    fxpage03_editorial_cap_quote: '"Đẳng cấp không cần nói lớn."',
    fxpage03_editorial_cap_meta: 'Tinh giản • Sang trọng • Cá tính',

    // ── USP ─────────────────────────────────────────────────
    fxpage03_usp_title: 'Thiết kế dành cho khí chất riêng.',
    fxpage03_usp_sub: 'Chất liệu cao cấp, đường nét tinh giản — đủ để nổi bật mà không cần phô trương.',
    fxpage03_usp_1_title: 'Phom dáng tinh chỉnh',
    fxpage03_usp_1_desc: 'Cấu trúc chuẩn form — tôn dáng tự nhiên, dễ mặc nhưng vẫn đầy khí chất.',
    fxpage03_usp_2_title: 'Chất liệu Quiet Luxury',
    fxpage03_usp_2_desc: 'Cảm nhận trước bằng xúc giác — sự khác biệt của một món đồ cao cấp nằm ở từng chi tiết nhỏ.',
    fxpage03_usp_3_title: 'Lựa chọn tối giản',
    fxpage03_usp_3_desc: 'Ít nhưng đúng — để quyết định trở nên tự nhiên và phong cách luôn nhất quán.',

    // ── URGENCY ─────────────────────────────────────────────
    fxpage03_urg_title: 'Khoảng thời gian phát hành giới hạn.',
    fxpage03_urg_sub: 'Không vội vã — nhưng hữu hạn. Bộ sưu tập được sản xuất với số lượng giới hạn theo mùa.',
    fxpage03_urg_label: 'Thời gian còn lại',
    fxpage03_urg_note: 'Sản xuất giới hạn • Không cam kết restock • Giá trị đến từ sự hiếm có',

    // ── PRODUCT ─────────────────────────────────────────────
    fxpage03_product_title: 'Tạo dấu ấn của riêng bạn.',
    fxpage03_product_sub: 'Chọn kích thước và tông màu phù hợp — phong cách bắt đầu từ những lựa chọn tinh giản.',
    fxpage03_product_price_tag: 'Giới hạn theo mùa',
    fxpage03_product_stock_label: 'Số lượng còn lại',
    fxpage03_stock_initial: '12',
    fxpage03_product_exchange_note: 'Đổi size trong <b>7 ngày</b>',
    fxpage03_product_cta_text: 'Tiến hành đặt mua',
    fxpage03_sticky_cta_text: 'Chỉ dành cho bạn',
    fxpage03_checkout_url: '/checkout',
    fxpage03_countdown_target: '01/01/2027 00:00:00',

    // ── REVIEWS ─────────────────────────────────────────────
    fxpage03_reviews_title: 'Như được tạo ra cho bạn.',
    fxpage03_reviews_sub: 'Những cảm nhận chân thật — không phô trương, chỉ là sự đồng điệu với phong cách riêng.',
    fxpage03_review_1_text: '"Nhìn rất cao cấp nhưng không hề gồng. Tối giản đúng kiểu mình thích."',
    fxpage03_review_1_author: 'Khách hàng đã trải nghiệm',
    fxpage03_review_2_text: '"Form đứng nhưng vẫn tự nhiên. Cảm giác như phiên bản tốt hơn của chính mình."',
    fxpage03_review_2_author: 'Khách hàng đã trải nghiệm',
    fxpage03_review_3_text: '"Sự tự tin rất nhẹ nhàng. Người khác sẽ chú ý — nhưng không hề phô trương."',
    fxpage03_review_3_author: 'Khách hàng đã trải nghiệm',

    // ── FAQ ─────────────────────────────────────────────────
    fxpage03_faq_title: 'Thông tin cần biết',
    fxpage03_faq_sub: 'Những câu hỏi quan trọng — được trả lời rõ ràng và tinh giản.',
    fxpage03_faq_1_q: 'Có hỗ trợ đổi kích thước không?',
    fxpage03_faq_1_a: 'Hỗ trợ đổi size trong vòng 7 ngày khi sản phẩm còn nguyên tag và chưa qua sử dụng.',
    fxpage03_faq_2_q: 'Thời gian giao hàng bao lâu?',
    fxpage03_faq_2_a: 'Nội thành từ 1–2 ngày, toàn quốc khoảng 2–4 ngày tùy khu vực.',
    fxpage03_faq_3_q: 'Sản phẩm thực tế có giống hình ảnh không?',
    fxpage03_faq_3_a: 'Hình ảnh được chụp theo phong cách editorial, tuy nhiên form dáng và tông màu luôn được giữ đúng. Nếu chưa vừa, chúng tôi hỗ trợ đổi nhanh chóng.',

    // ── FOOTER ──────────────────────────────────────────────
    fxpage03_footer_text: '© 2026 F1GENZ / LIUXURY',
  };
}

async function upsertMetafield(pageId, token, settings) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const namespace = 'fxpage';
  const key = 'settings';
  const valueString = JSON.stringify(settings);

  const listUrl = `https://apis.haravan.com/com/metafields.json?owner_resource=page&owner_id=${pageId}&namespace=${encodeURIComponent(namespace)}`;
  const listRes = await axios.get(listUrl, { headers });
  const metafields = listRes.data?.metafields || [];
  const existing = metafields.find((item) => item.key === key);

  if (existing?.id) {
    const updateRes = await axios.put(
      `https://apis.haravan.com/com/metafields/${existing.id}.json`,
      {
        metafield: {
          value: valueString,
          value_type: 'json',
        },
      },
      { headers },
    );
    return { action: 'updated', metafield: updateRes.data?.metafield };
  }

  const createRes = await axios.post(
    'https://apis.haravan.com/com/metafields.json',
    {
      metafield: {
        owner_resource: 'page',
        owner_id: Number(pageId),
        namespace,
        key,
        value: valueString,
        value_type: 'json',
      },
    },
    { headers },
  );
  return { action: 'created', metafield: createRes.data?.metafield };
}

async function main() {
  const pageId = process.argv[2];
  const token = process.argv[3];

  if (!pageId || !token) {
    throw new Error(
      'Usage: node scripts/push-template03-metafield.js <pageId> <token>',
    );
  }

  const settings = buildDemoSettings(pageId);
  const result = await upsertMetafield(pageId, token, settings);

  console.log(
    JSON.stringify(
      {
        ok: true,
        pageId,
        action: result.action,
        namespace: 'fxpage',
        key: 'settings',
        keys: Object.keys(settings).length,
        metafieldId: result.metafield?.id,
        valueType: result.metafield?.value_type,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
