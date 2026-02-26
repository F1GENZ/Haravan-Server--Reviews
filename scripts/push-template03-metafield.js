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
    fxpage03_brand_name: 'F1 GENZ Studio',
    fxpage03_pill_text: 'New Arrival · Limited',

    // ── HERO ────────────────────────────────────────────────
    fxpage03_hero_video_src: '',
    fxpage03_hero_video_poster: '',
    fxpage03_hero_eyebrow: 'Capsule Collection 2026',
    fxpage03_hero_headline: 'Phong cách <em>tối giản</em>. Đẳng cấp tự nhiên.',
    fxpage03_hero_subhead: 'Chất liệu cao cấp, thiết kế không thừa một chi tiết — dành cho người hiểu mình.',
    fxpage03_hero_cta_text: 'Khám phá bộ sưu tập',
    fxpage03_hero_cta_link: '#product',

    // ── TRUST ───────────────────────────────────────────────
    fxpage03_trust_1_title: 'Vải cao cấp',
    fxpage03_trust_1_text: '100% cotton thoáng mát, dày dặn chuẩn phiên bản giới hạn.',
    fxpage03_trust_2_title: 'May thủ công',
    fxpage03_trust_2_text: 'Từng đường kim mũi chỉ được kiểm tra trước khi xuất xưởng.',
    fxpage03_trust_3_title: 'Đổi hàng dễ',
    fxpage03_trust_3_text: 'Đổi size trong 7 ngày nếu không vừa ý.',

    // ── EDITORIAL ───────────────────────────────────────────
    fxpage03_editorial_title: 'Câu chuyện thiết kế',
    fxpage03_editorial_sub: 'Mỗi khung hình là một góc nhìn — tối giản không có nghĩa là đơn điệu.',
    fxpage03_editorial_img_1: '',
    fxpage03_editorial_img_2: '',
    fxpage03_editorial_img_3: '',
    fxpage03_editorial_img_4: '',
    fxpage03_editorial_img_5: '',
    fxpage03_editorial_img_6: '',
    fxpage03_editorial_cap_quote: 'Mặc ít hơn. Đẹp hơn.',
    fxpage03_editorial_cap_meta: 'Editorial · 2026',

    // ── USP ─────────────────────────────────────────────────
    fxpage03_usp_title: 'Tại sao chọn F1 GENZ?',
    fxpage03_usp_sub: 'Không chỉ là một chiếc áo — đây là ngôn ngữ phong cách của bạn.',
    fxpage03_usp_1_title: 'Thiết kế độc quyền',
    fxpage03_usp_1_desc: 'Mỗi mẫu chỉ ra mắt một lần — khi hết là hết.',
    fxpage03_usp_2_title: 'Chất liệu tuyển chọn',
    fxpage03_usp_2_desc: 'Vải được nhập trực tiếp từ các nhà máy premium Châu Á.',
    fxpage03_usp_3_title: 'Đúng form, đúng cảm',
    fxpage03_usp_3_desc: 'Pattern được điều chỉnh để phù hợp với vóc dáng người Việt.',

    // ── URGENCY ─────────────────────────────────────────────
    fxpage03_urg_title: 'Chỉ còn rất ít',
    fxpage03_urg_sub: 'Bộ sưu tập giới hạn — không tái sản xuất.',
    fxpage03_urg_label: 'Ưu đãi kết thúc sau',
    fxpage03_urg_note: 'Giá ưu đãi ra mắt, áp dụng cho đến khi hết hàng.',

    // ── PRODUCT ─────────────────────────────────────────────
    fxpage03_product_title: 'Chọn của bạn',
    fxpage03_product_sub: 'Size chuẩn, tone đúng — bạn xứng đáng được mặc thứ gì đó thật sự phù hợp.',
    fxpage03_product_price_tag: 'Giá ra mắt',
    fxpage03_product_stock_label: 'Còn lại',
    fxpage03_stock_initial: '12',
    fxpage03_product_exchange_note: 'Đổi size miễn phí',
    fxpage03_product_cta_text: 'Mua ngay — giao hỏa tốc',
    fxpage03_sticky_cta_text: 'Mua ngay',
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
    fxpage03_faq_title: 'Câu hỏi thường gặp',
    fxpage03_faq_sub: 'Mọi thứ bạn cần biết trước khi đặt hàng.',
    fxpage03_faq_1_q: 'Size có đúng không? Tôi nên chọn thế nào?',
    fxpage03_faq_1_a: 'Các size được chuẩn hóa theo vóc dáng người Việt. Xem bảng size chi tiết tại trang sản phẩm hoặc liên hệ tư vấn.',
    fxpage03_faq_2_q: 'Giao hàng mất bao lâu?',
    fxpage03_faq_2_a: 'Giao hỏa tốc nội thành trong 2–4 giờ. Tỉnh thành khác 1–2 ngày làm việc.',
    fxpage03_faq_3_q: 'Tôi có thể đổi hàng nếu không vừa không?',
    fxpage03_faq_3_a: 'Được! Đổi size trong 7 ngày kể từ ngày nhận hàng. Sản phẩm cần còn nguyên tag và chưa qua sử dụng.',

    // ── FOOTER ──────────────────────────────────────────────
    fxpage03_footer_text: '© 2026 F1 GENZ Studio · Thiết kế tối giản, chất lượng không tối giản.',
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
