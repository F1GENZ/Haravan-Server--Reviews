const path = require('path');
const axios = require('axios');
const fs = require('fs');

async function discoverResources(headers) {
  const result = {
    collectionHandle: 'all',
    productHandle: '',
    blogHandle: '',
    articleHandle: '',
    menuHandle: 'main-menu',
  };

  try {
    const collectionsRes = await axios.get(
      'https://apis.haravan.com/com/custom_collections.json?limit=10',
      { headers },
    );
    const collections = collectionsRes.data?.custom_collections || [];
    if (collections.length > 0 && collections[0].handle) {
      result.collectionHandle = collections[0].handle;
    }
  } catch {
    // keep fallback handles
  }

  try {
    const productsRes = await axios.get(
      'https://apis.haravan.com/com/products.json?limit=10',
      { headers },
    );
    const products = productsRes.data?.products || [];
    if (products.length > 0 && products[0].handle) {
      result.productHandle = products[0].handle;
    }
  } catch {
    // keep empty featured product
  }

  try {
    const blogsRes = await axios.get('https://apis.haravan.com/web/blogs.json?limit=10', {
      headers,
    });
    const blogs = blogsRes.data?.blogs || [];
    if (blogs.length > 0) {
      result.blogHandle = blogs[0].handle || '';
      if (blogs[0].id) {
        const articlesRes = await axios.get(
          `https://apis.haravan.com/web/blogs/${blogs[0].id}/articles.json?limit=10`,
          { headers },
        );
        const articles = articlesRes.data?.articles || [];
        if (articles.length > 0) {
          result.articleHandle = articles[0].handle || '';
        }
      }
    }
  } catch {
    // keep empty blog/article
  }

  return result;
}

function buildContentById(pageId, resources) {
  if (String(pageId) === '1004312947') {
    return {
      fxpage01_meta_title: 'Noel 2026 | F1 GENZ Studio',
      fxpage01_meta_desc:
        'BST Noel 2026 với sắc đỏ - xanh chủ đạo, quà tặng giới hạn và ưu đãi mùa lễ hội dành cho khách hàng thân thiết.',
      fxpage01_show_snow: true,
      fxpage01_countdown_target: '24/12/2026 24:00:00',

      fxpage01_brand_name: 'F1 GENZ Studio',
      fxpage01_brand_subtitle: 'Noel Collection 2026',
      fxpage01_brand_link: '/',
      fxpage01_header_menu: resources.menuHandle,

      fxpage01_show_hero: true,
      fxpage01_hero_badge: 'Merry Christmas • Limited Drop',
      fxpage01_hero_title: 'Đón Noel rực rỡ cùng BST lễ hội',
      fxpage01_hero_desc:
        'Khám phá những item nổi bật cho mùa Giáng Sinh: áo khoác ấm, sweater họa tiết lễ hội và phụ kiện quà tặng phiên bản giới hạn.',
      fxpage01_hero_cta_primary_text: 'Mua ngay mùa Noel',
      fxpage01_hero_cta_primary_link: '/collections/all',
      fxpage01_hero_cta_secondary_text: 'Xem ưu đãi quà tặng',
      fxpage01_hero_cta_secondary_link: '/pages/christmas-offer',

      fxpage01_show_products: true,
      fxpage01_products_kicker: 'Christmas Best Sellers',
      fxpage01_products_title: 'Top quà tặng và outfit Noel',
      fxpage01_products_collection: resources.collectionHandle,
      fxpage01_products_limit: 4,
      fxpage01_featured_product: resources.productHandle,
      fxpage01_featured_badge_text: 'Christmas Pick',

      fxpage01_show_story: true,
      fxpage01_story_img: 'https://placehold.co/1000x1200/8b1e2d/f7f3ea?text=Merry+Christmas',
      fxpage01_story_kicker: 'Không khí lễ hội đã sẵn sàng',
      fxpage01_story_title: 'Trang phục ấm áp cho mùa yêu thương',
      fxpage01_story_desc:
        'Từng thiết kế được chọn để bạn vừa ấm áp vừa nổi bật trong những buổi gặp gỡ cuối năm và tiệc Giáng Sinh.',
      fxpage01_story_point_title_1: 'Chất liệu ấm áp mùa lạnh',
      fxpage01_story_point_desc_1: 'Giữ nhiệt tốt nhưng vẫn mềm và thoải mái.',
      fxpage01_story_point_title_2: 'Màu lễ hội dễ phối',
      fxpage01_story_point_desc_2: 'Đỏ, kem, xanh lá giúp outfit nổi bật hơn.',
      fxpage01_story_point_title_3: 'Quà tặng kèm hấp dẫn',
      fxpage01_story_point_desc_3: 'Đơn hàng Noel nhận thiệp và gói quà miễn phí.',
      fxpage01_story_point_title_4: 'Giao nhanh trước lễ',
      fxpage01_story_point_desc_4: 'Ưu tiên xử lý đơn để kịp đêm Giáng Sinh.',
      fxpage01_story_link_text: 'Xem bộ sưu tập Noel',
      fxpage01_story_link: '/collections/noel-2026',

      fxpage01_show_journal: true,
      fxpage01_journal_kicker: 'Noel Journal',
      fxpage01_journal_title: 'Gợi ý phối đồ cho đêm Giáng Sinh',
      fxpage01_journal_blog: resources.blogHandle,
      fxpage01_journal_article: resources.articleHandle,
      fxpage01_journal_limit: 3,
      fxpage01_journal_read_more: 'Đọc cảm hứng Noel',

      fxpage01_footer_brand: 'F1 GENZ Studio',
      fxpage01_footer_desc:
        'Chúc bạn mùa Giáng Sinh ấm áp và năm mới an lành. Cảm ơn đã đồng hành cùng F1 GENZ Studio.',
      fxpage01_footer_col_1_title: 'Mua sắm Noel',
      fxpage01_footer_menu_1: resources.menuHandle,
      fxpage01_footer_col_2_title: 'Dịch vụ khách hàng',
      fxpage01_footer_menu_2: resources.menuHandle,
      fxpage01_footer_bottom: '🎄 Merry Christmas 2026 • F1 GENZ Studio',
    };
  }

  return {
    fxpage01_meta_title: 'Urban Winter 2026 | F1 GENZ Studio',
    fxpage01_meta_desc:
      'Bộ sưu tập Urban Winter 2026 với phong cách tối giản, chất liệu ấm áp và thiết kế dễ phối cho nhịp sống thành thị.',
    fxpage01_show_snow: true,
    fxpage01_countdown_target: '31/12/2026 23:59:00',

    fxpage01_brand_name: 'F1 GENZ Studio',
    fxpage01_brand_subtitle: 'Urban Winter 2026',
    fxpage01_brand_link: '/',
    fxpage01_header_menu: resources.menuHandle,

    fxpage01_show_hero: true,
    fxpage01_hero_badge: 'Bộ sưu tập mới vừa ra mắt',
    fxpage01_hero_title: 'Giữ ấm chuẩn gu, xuống phố tự tin',
    fxpage01_hero_desc:
      'Chọn ngay những item chủ lực mùa lạnh: áo khoác dáng dài, knitwear tinh gọn và phụ kiện tông trung tính dễ phối cả tuần.',
    fxpage01_hero_cta_primary_text: 'Khám phá sản phẩm',
    fxpage01_hero_cta_primary_link: '/collections/all',
    fxpage01_hero_cta_secondary_text: 'Nhận ưu đãi thành viên',
    fxpage01_hero_cta_secondary_link: '/pages/member-benefits',

    fxpage01_show_products: true,
    fxpage01_products_kicker: 'Lựa chọn của tuần',
    fxpage01_products_title: 'Best picks cho tủ đồ mùa lạnh',
    fxpage01_products_collection: resources.collectionHandle,
    fxpage01_products_limit: 4,
    fxpage01_featured_product: resources.productHandle,
    fxpage01_featured_badge_text: 'Editor\'s Pick',

    fxpage01_show_story: true,
    fxpage01_story_img: 'https://placehold.co/1000x1200/1d2f2a/f2f2f2?text=Urban+Winter',
    fxpage01_story_kicker: 'Vì sao khách hàng quay lại',
    fxpage01_story_title: 'Form đẹp, mặc êm, bền theo mùa',
    fxpage01_story_desc:
      'Mỗi thiết kế được hoàn thiện từ phản hồi thực tế: dễ giặt, ít nhăn, đứng form và phù hợp nhiều dáng người khác nhau.',
    fxpage01_story_point_title_1: 'Chất liệu đã qua kiểm thử',
    fxpage01_story_point_desc_1: 'Đảm bảo độ mềm, thoáng và giữ nhiệt tốt.',
    fxpage01_story_point_title_2: 'Đổi trả rõ ràng',
    fxpage01_story_point_desc_2: 'Hỗ trợ đổi size nhanh trong 7 ngày.',
    fxpage01_story_point_title_3: 'Giao nhanh nội thành',
    fxpage01_story_point_desc_3: 'Nhận hàng từ 2–24 giờ tùy khu vực.',
    fxpage01_story_point_title_4: 'Đội ngũ tư vấn thật',
    fxpage01_story_point_desc_4: 'Stylist hỗ trợ phối đồ theo nhu cầu.',
    fxpage01_story_link_text: 'Tìm hiểu thêm về thương hiệu',
    fxpage01_story_link: '/pages/about-us',

    fxpage01_show_journal: true,
    fxpage01_journal_kicker: 'Tạp chí phong cách',
    fxpage01_journal_title: 'Mặc đẹp mỗi ngày với 1 công thức đơn giản',
    fxpage01_journal_blog: resources.blogHandle,
    fxpage01_journal_article: resources.articleHandle,
    fxpage01_journal_limit: 3,
    fxpage01_journal_read_more: 'Xem chi tiết',

    fxpage01_footer_brand: 'F1 GENZ Studio',
    fxpage01_footer_desc:
      'Thời trang ứng dụng cho người trẻ thành thị: đẹp vừa đủ, chất lượng rõ ràng, giá trị lâu dài.',
    fxpage01_footer_col_1_title: 'Khám phá',
    fxpage01_footer_menu_1: resources.menuHandle,
    fxpage01_footer_col_2_title: 'Chính sách',
    fxpage01_footer_menu_2: resources.menuHandle,
    fxpage01_footer_bottom: '© 2026 F1 GENZ Studio. All rights reserved.',
  };
}

function demoValue(setting, contentById) {

  if (Object.prototype.hasOwnProperty.call(contentById, setting.id)) {
    return contentById[setting.id];
  }

  switch (setting.type) {
    case 'checkbox':
      return true;
    case 'url':
      return '/';
    case 'range':
      return Number.isFinite(setting.min) ? setting.min : 1;
    default:
      return null;
  }
}

async function main() {
  const pageId = process.argv[2];
  const token = process.argv[3];

  if (!pageId || !token) {
    throw new Error('Usage: node scripts/push-demo-metafield.js <pageId> <token>');
  }

  const schemaPath = path.resolve(__dirname, '../../demo/assets/page.fxpage.template01.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')).schema || [];

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const resources = await discoverResources(headers);
  const contentById = buildContentById(pageId, resources);

  const settings = {};
  for (const section of schema) {
    for (const setting of section.settings || []) {
      if (!setting.id) continue;
      const value = demoValue(setting, contentById);
      if (value !== null && value !== undefined) {
        settings[setting.id] = value;
      }
    }
  }

  const valueString = JSON.stringify(settings);

  const listUrl = `https://apis.haravan.com/com/metafields.json?owner_resource=page&owner_id=${pageId}&namespace=fxpage`;
  const listRes = await axios.get(listUrl, { headers });
  const metafields = listRes.data?.metafields || [];
  const existing = metafields.find((item) => item.key === 'settings');

  let response;
  let action;

  if (existing?.id) {
    action = 'updated';
    response = await axios.put(
      `https://apis.haravan.com/com/metafields/${existing.id}.json`,
      {
        metafield: {
          value: valueString,
          value_type: 'json',
        },
      },
      { headers },
    );
  } else {
    action = 'created';
    response = await axios.post(
      'https://apis.haravan.com/com/metafields.json',
      {
        metafield: {
          owner_resource: 'page',
          owner_id: Number(pageId),
          namespace: 'fxpage',
          key: 'settings',
          value: valueString,
          value_type: 'json',
        },
      },
      { headers },
    );
  }

  const metafield = response.data?.metafield;
  console.log(
    JSON.stringify(
      {
        ok: true,
        action,
        pageId,
        keys: Object.keys(settings).length,
        resources,
        metafieldId: metafield?.id,
        key: metafield?.key,
        namespace: metafield?.namespace,
        valueType: metafield?.value_type,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const detail = {
    ok: false,
    status: error?.response?.status,
    data: error?.response?.data,
    message: error?.message,
  };
  console.error(JSON.stringify(detail, null, 2));
  process.exit(1);
});
