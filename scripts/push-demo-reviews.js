/**
 * Push demo review metafields to Haravan products.
 *
 * Usage:
 *   node scripts/push-demo-reviews.js
 *
 * Reads .env for Redis + Haravan credentials,
 * fetches access_token from Redis, then writes
 * sample reviews to the first 3 products.
 */

const Redis = require('ioredis');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

// ── Load .env ──
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_USERNAME = process.env.REDIS_USERNAME || 'default';

const NAMESPACE = 'reviews';
const PRODUCTS_TO_SEED = 3;

// Allow targeting a specific orgid via --orgid=xxx
const TARGET_ORGID = (() => {
  const arg = process.argv.find((a) => a.startsWith('--orgid='));
  return arg ? arg.replace('--orgid=', '') : null;
})();

// ── Sample reviews ──
const SAMPLE_REVIEWS = [
  {
    rating: 5,
    title: 'Rất hài lòng, xứng đáng 5 sao!',
    content: 'Sản phẩm rất tốt, đúng như mô tả. Giao hàng nhanh, đóng gói cẩn thận. Sẽ ủng hộ shop dài dài!',
    author: 'Nguyễn Văn An',
    email: 'nguyenvanan@gmail.com',
    phone: '0912345678',
    status: 'approved',
    verified: true,
    pinned: true,
  },
  {
    rating: 4,
    title: 'Hàng ổn, giá hợp lý',
    content: 'Chất lượng ổn so với giá tiền. Mình đã mua cho cả gia đình, ai cũng hài lòng.',
    author: 'Trần Thị Bích',
    email: 'tranthibich@yahoo.com',
    phone: '0908765432',
    status: 'approved',
    verified: true,
    pinned: false,
  },
  {
    rating: 5,
    title: 'Mua lần 2, vẫn tuyệt!',
    content: 'Mua lần 2 rồi, lần nào cũng ok. Shop tư vấn nhiệt tình lắm ạ.',
    author: 'Lê Minh Châu',
    email: 'leminhchau@gmail.com',
    phone: '0977112233',
    status: 'approved',
    verified: false,
    pinned: false,
  },
  {
    rating: 3,
    title: 'Sản phẩm tạm, giao hàng chậm',
    content: 'Sản phẩm tạm được, nhưng giao hàng hơi chậm. Hy vọng lần sau nhanh hơn.',
    author: 'Phạm Đức Dũng',
    email: 'pdung92@hotmail.com',
    phone: '0933445566',
    status: 'approved',
    verified: false,
    pinned: false,
  },
  {
    rating: 4,
    title: 'Đẹp và bền, giá tốt',
    content: 'Đẹp, bền, dùng rất thích. Giá cả hợp lý nữa.',
    author: 'Hoàng Thị E',
    email: 'hoangthie@gmail.com',
    phone: '0962233445',
    status: 'approved',
    verified: true,
    pinned: false,
  },
  {
    rating: 5,
    title: 'Tuyệt vời, đã giới thiệu bạn bè',
    content: 'Tuyệt vời! Đã giới thiệu cho bạn bè mua theo.',
    author: 'Vũ Quốc Phong',
    email: 'vuquocphong@gmail.com',
    phone: '0985566778',
    status: 'approved',
    verified: true,
    pinned: false,
  },
  {
    rating: 2,
    title: 'Hơi khác hình, nhưng dùng được',
    content: 'Hàng nhận được có hơi khác so với hình. Tuy nhiên dùng vẫn OK.',
    author: 'Đỗ Hải Giang',
    email: 'dohaigiang@gmail.com',
    phone: '0944667788',
    status: 'approved',
    verified: false,
    pinned: false,
  },
  {
    rating: 5,
    title: 'Chất lượng vượt mong đợi!',
    content: 'Xứng đáng 5 sao. Chất lượng vượt mong đợi!',
    author: 'Ngô Thanh Hà',
    email: 'ngothanhha@gmail.com',
    phone: '0921334455',
    status: 'approved',
    verified: true,
    pinned: false,
  },
];

function generateId() {
  return crypto.randomBytes(12).toString('base64url');
}

function buildReviews(sampleSet) {
  const now = Date.now();
  return sampleSet.map((r, i) => ({
    id: generateId(),
    rating: r.rating,
    title: r.title || '',
    content: r.content,
    author: r.author,
    email: r.email || '',
    phone: r.phone || '',
    status: r.status || 'approved',
    verified: r.verified || false,
    pinned: r.pinned || false,
    media: [],
    created_at: now - i * 86400000, // 1 day apart
    updated_at: now - i * 86400000,
  }));
}

function calculateSummary(reviews) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    if (r.rating >= 1 && r.rating <= 5) distribution[r.rating]++;
  }
  const count = reviews.length;
  const avg =
    count > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) /
        10
      : 0;
  return { avg, count, distribution };
}

async function getTokenFromRedis(redis) {
  const keys = await redis.keys('haravan:reviews:app_install:*');
  if (keys.length === 0) {
    throw new Error(
      'No shop found in Redis. Please install the app first (login via the app).',
    );
  }

  console.log(`Found ${keys.length} shop(s) in Redis:`);
  for (const key of keys) {
    const orgid = key.replace('haravan:reviews:app_install:', '');
    console.log(`  - orgid: ${orgid}`);
  }

  // Use TARGET_ORGID if specified, otherwise use the first one
  let selectedKey;
  if (TARGET_ORGID) {
    selectedKey = keys.find((k) => k.endsWith(`:${TARGET_ORGID}`));
    if (!selectedKey) throw new Error(`orgid ${TARGET_ORGID} not found in Redis`);
    console.log(`Targeting orgid: ${TARGET_ORGID}`);
  } else {
    selectedKey = keys[0];
  }

  // Use the selected one
  const data = await redis.get(selectedKey);
  const parsed = JSON.parse(data);
  const orgid = selectedKey.replace('haravan:reviews:app_install:', '');

  if (!parsed.access_token) {
    throw new Error(`No access_token found for orgid ${orgid}`);
  }

  console.log(`Using orgid: ${orgid}`);
  return { token: parsed.access_token, orgid };
}

async function getProducts(token, limit = 10) {
  const url = `https://apis.haravan.com/com/products.json?limit=${limit}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.products || [];
}

async function getProductMetafields(token, productId) {
  const url = `https://apis.haravan.com/com/products/${productId}/metafields.json?namespace=${NAMESPACE}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Haravan ignores namespace filter — filter client-side
  return (res.data.metafields || []).filter((m) => m.namespace === NAMESPACE);
}

async function createProductMetafield(token, productId, metafield) {
  const url = `https://apis.haravan.com/com/products/${productId}/metafields.json`;
  const res = await axios.post(
    url,
    { metafield },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
  return res.data.metafield;
}

async function updateProductMetafield(token, productId, metafieldId, data) {
  const url = `https://apis.haravan.com/com/products/${productId}/metafields/${metafieldId}.json`;
  const res = await axios.put(
    url,
    { metafield: data },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
  return res.data.metafield;
}

async function pushReviewsToProduct(token, productId, productTitle, reviews) {
  const summary = calculateSummary(reviews);
  const reviewsJson = JSON.stringify(reviews);

  console.log(
    `\n📦 Product: ${productTitle} (${productId})`,
  );
  console.log(
    `   ${reviews.length} reviews, avg ${summary.avg}★, chunk size ${reviewsJson.length} chars`,
  );

  // Check existing metafields
  const existing = await getProductMetafields(token, productId);
  const existingChunks = existing.filter(
    (m) => m.key && m.key.startsWith('chunk_'),
  );
  const existingSummary = existing.find((m) => m.key === 'summary');

  // Write summary
  if (existingSummary) {
    await updateProductMetafield(token, productId, existingSummary.id, {
      value: JSON.stringify(summary),
      value_type: 'json',
    });
    console.log('   ✅ Summary updated');
  } else {
    await createProductMetafield(token, productId, {
      namespace: NAMESPACE,
      key: 'summary',
      value: JSON.stringify(summary),
      value_type: 'json',
    });
    console.log('   ✅ Summary created');
  }

  // Write chunk_1 (all reviews fit in one chunk for demo data)
  const existingChunk1 = existingChunks.find((m) => m.key === 'chunk_1');
  if (existingChunk1) {
    await updateProductMetafield(token, productId, existingChunk1.id, {
      value: reviewsJson,
      value_type: 'string',
    });
    console.log('   ✅ chunk_1 updated');
  } else {
    await createProductMetafield(token, productId, {
      namespace: NAMESPACE,
      key: 'chunk_1',
      value: reviewsJson,
      value_type: 'string',
    });
    console.log('   ✅ chunk_1 created');
  }
}

async function getShopMetafields(token) {
  const url = `https://apis.haravan.com/com/metafields.json?namespace=f1genz`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.metafields || [];
}

async function createShopMetafield(token, metafield) {
  const url = `https://apis.haravan.com/com/metafields.json`;
  const res = await axios.post(url, { metafield }, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return res.data.metafield;
}

async function updateShopMetafield(token, metafieldId, data) {
  const url = `https://apis.haravan.com/com/metafields/${metafieldId}.json`;
  const res = await axios.put(url, { metafield: data }, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return res.data.metafield;
}

/**
 * Build and push shop-level stats metafield (namespace: f1genz, key: stats)
 * so the dashboard overview shows correct data.
 */
async function pushShopStats(token, seededProducts) {
  console.log('\n📊 Building shop stats...');

  const products = {};
  const recentReviews = [];

  for (const { productId, reviews } of seededProducts) {
    const summary = calculateSummary(reviews);
    const dist = {};
    for (let s = 1; s <= 5; s++) {
      if (summary.distribution[s] > 0) dist[String(s)] = summary.distribution[s];
    }

    products[String(productId)] = {
      reviewCount: summary.count,
      reviewAvg: summary.avg,
      reviewDistribution: dist,
      qnaTotal: 0,
      qnaAnswered: 0,
    };

    // Top 3 recent reviews from this product
    for (const r of reviews.slice(0, 3)) {
      recentReviews.push({
        id: r.id,
        rating: r.rating,
        author: r.author,
        content: r.content.slice(0, 200),
        created_at: r.created_at,
        productId: String(productId),
      });
    }
  }

  // Sort recent reviews by date desc, keep top 10
  recentReviews.sort((a, b) => b.created_at - a.created_at);
  recentReviews.splice(10);

  // Calculate globals
  let totalReviews = 0;
  const gd = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  for (const p of Object.values(products)) {
    totalReviews += p.reviewCount;
    for (let s = 1; s <= 5; s++) {
      gd[String(s)] += p.reviewDistribution[String(s)] || 0;
    }
  }
  const totalRating = Object.entries(gd).reduce((sum, [star, cnt]) => sum + Number(star) * cnt, 0);
  const globalAvg = totalReviews > 0 ? Math.round((totalRating / totalReviews) * 10) / 10 : 0;

  const stats = {
    totalReviews,
    totalQuestions: 0,
    totalAnswered: 0,
    globalAvg,
    globalDistribution: gd,
    products,
    recentReviews,
    lastUpdated: Date.now(),
  };

  // Write to shop-level metafield (namespace: f1genz, key: stats)
  const existing = await getShopMetafields(token);
  const statsMf = existing.find((m) => m.namespace === 'f1genz' && m.key === 'stats');
  const statsJson = JSON.stringify(stats);

  if (statsMf) {
    await updateShopMetafield(token, statsMf.id, { value: statsJson, value_type: 'json' });
    console.log('   ✅ Shop stats updated');
  } else {
    await createShopMetafield(token, {
      namespace: 'f1genz',
      key: 'stats',
      value: statsJson,
      value_type: 'json',
    });
    console.log('   ✅ Shop stats created');
  }

  console.log(`   totalReviews: ${totalReviews}, globalAvg: ${globalAvg}★`);
}

// ── Main ──
async function main() {
  console.log('🚀 Push Demo Reviews to Haravan Products\n');

  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
  });

  try {
    const { token } = await getTokenFromRedis(redis);
    const products = await getProducts(token, PRODUCTS_TO_SEED);

    if (products.length === 0) {
      console.log('❌ No products found in shop.');
      return;
    }

    console.log(`\nFound ${products.length} product(s). Seeding reviews...`);

    const seededProducts = [];
    for (let i = 0; i < Math.min(products.length, PRODUCTS_TO_SEED); i++) {
      const product = products[i];
      // Pick a slice of sample reviews (vary count per product)
      const count = [8, 5, 3][i] || 4;
      const reviews = buildReviews(SAMPLE_REVIEWS.slice(0, count));
      await pushReviewsToProduct(
        token,
        product.id,
        product.title,
        reviews,
      );
      seededProducts.push({ productId: product.id, reviews });
    }

    // Build and push shop-level stats for dashboard
    await pushShopStats(token, seededProducts);

    console.log('\n✅ Done! Review data pushed successfully.');
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    if (err.response) {
      console.error(
        '   Status:',
        err.response.status,
        err.response.statusText,
      );
      console.error('   Data:', JSON.stringify(err.response.data).slice(0, 500));
    }
  } finally {
    await redis.quit();
  }
}

main();
