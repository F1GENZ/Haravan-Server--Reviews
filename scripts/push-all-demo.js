/**
 * Push ALL demo data (reviews + Q&A + stats) to Haravan products.
 * Deletes ALL old demo metafields first, then pushes fresh data.
 *
 * Usage:
 *   node scripts/push-all-demo.js
 */

const Redis = require('ioredis');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_USERNAME = process.env.REDIS_USERNAME || 'default';

const PRODUCTS_TO_SEED = 3;
const API_BASE = 'https://apis.haravan.com/com';
const DELAY_MS = 600; // delay between API calls to avoid rate limits

function generateId() {
  return crypto.randomBytes(12).toString('base64url');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════
//  REVIEWS DATA
// ═══════════════════════════════════════════════

const REVIEW_SAMPLES = [
  { rating: 5, content: 'Sản phẩm rất tốt, đúng như mô tả. Giao hàng nhanh, đóng gói cẩn thận. Sẽ ủng hộ shop dài dài!', author: 'Nguyễn Văn An', reply: 'Cảm ơn bạn đã ủng hộ shop! Rất vui vì bạn hài lòng với sản phẩm ạ 🎉' },
  { rating: 4, content: 'Chất lượng ổn so với giá tiền. Mình đã mua cho cả gia đình, ai cũng hài lòng.', author: 'Trần Thị Bích', reply: 'Cảm ơn bạn rất nhiều! Shop luôn cố gắng mang đến sản phẩm chất lượng tốt nhất ạ.' },
  { rating: 5, content: 'Mua lần 2 rồi, lần nào cũng ok. Shop tư vấn nhiệt tình lắm ạ. Sẽ giới thiệu bạn bè đến mua.', author: 'Lê Minh Châu' },
  { rating: 3, content: 'Sản phẩm tạm được, nhưng giao hàng hơi chậm. Hy vọng lần sau nhanh hơn. Dùng thì không có vấn đề gì.', author: 'Phạm Đức Dũng', reply: 'Shop xin lỗi vì sự bất tiện ạ. Thời gian qua do lượng đơn tăng cao nên giao hàng bị chậm. Shop sẽ cải thiện!' },
  { rating: 4, content: 'Đẹp, bền, dùng rất thích. Giá cả hợp lý, phù hợp với túi tiền sinh viên.', author: 'Hoàng Thị E' },
  { rating: 5, content: 'Tuyệt vời! Đã giới thiệu cho bạn bè mua theo. Chất lượng sản phẩm thật sự vượt mong đợi.', author: 'Vũ Quốc Phong', reply: 'Wow, cảm ơn bạn đã giới thiệu cho bạn bè! Đây là động lực lớn để shop tiếp tục cải thiện ạ ❤️' },
  { rating: 2, content: 'Hàng nhận được có hơi khác so với hình. Tuy nhiên dùng vẫn OK, giá nên chấp nhận được.', author: 'Đỗ Hải Giang' },
  { rating: 5, content: 'Xứng đáng 5 sao. Chất lượng vượt mong đợi! Đóng gói kỹ lưỡng, shop rất chu đáo.', author: 'Ngô Thanh Hà' },
  { rating: 4, content: 'Sản phẩm đẹp, chất liệu tốt. Giao hàng đúng hẹn, nhân viên thân thiện.', author: 'Bùi Quang Huy', reply: 'Cảm ơn bạn đã đánh giá! Shop luôn cố gắng giao hàng đúng hẹn ạ.' },
  { rating: 5, content: 'Mua nhiều lần rồi, lần nào cũng rất hài lòng. Shop uy tín, sẽ tiếp tục ủng hộ!', author: 'Đặng Thị Kim' },
  { rating: 1, content: 'Sản phẩm không như quảng cáo. Khá thất vọng về chất liệu.', author: 'Trịnh Văn Long', reply: 'Shop xin lỗi bạn ạ. Bạn vui lòng inbox shop để được hỗ trợ đổi trả trong 7 ngày nhé!' },
  { rating: 4, content: 'Nhìn chung khá tốt, đáng đồng tiền bát gạo. Shop đóng gói cẩn thận.', author: 'Lý Thanh Mai' },
];

function buildReviews(samples) {
  const now = Date.now();
  return samples.map((r, i) => {
    const created = now - i * 86400000 * 2;
    const review = {
      id: generateId(),
      rating: r.rating,
      content: r.content,
      author: r.author,
      media: [],
      created_at: created,
      updated_at: r.reply ? created + 43200000 : created,
    };
    if (r.reply) {
      review.reply = r.reply;
      review.replied_at = created + 43200000; // 12h after
    }
    return review;
  });
}

function calculateReviewSummary(reviews) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    if (r.rating >= 1 && r.rating <= 5) distribution[r.rating]++;
  }
  const count = reviews.length;
  const avg = count > 0 ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
  return { avg, count, distribution };
}

// ═══════════════════════════════════════════════
//  Q&A DATA
// ═══════════════════════════════════════════════

const QNA_SAMPLES = [
  {
    question: 'Sản phẩm này có bảo hành không ạ?',
    author: 'Nguyễn Thị Lan',
    answer: 'Dạ có bảo hành 12 tháng chính hãng ạ. Bạn giữ hóa đơn để được hỗ trợ nhé!',
    answered_by: 'Shop F1GENZ',
  },
  {
    question: 'Giao hàng mất bao lâu vậy shop?',
    author: 'Trần Văn Minh',
    answer: 'Nội thành HCM & HN: 1-2 ngày. Các tỉnh khác: 3-5 ngày ạ.',
    answered_by: 'Shop F1GENZ',
  },
  {
    question: 'Có đổi trả được không nếu không vừa ý?',
    author: 'Lê Thuỳ Dung',
    answer: 'Được ạ! Shop hỗ trợ đổi trả trong 7 ngày nếu sản phẩm chưa qua sử dụng và còn nguyên tem.',
    answered_by: 'Shop F1GENZ',
  },
  {
    question: 'Cho mình hỏi sản phẩm này có màu đen không?',
    author: 'Phạm Quốc Bảo',
    answer: 'Hiện tại có 3 màu: đen, trắng, xám ạ. Bạn chọn trong mục biến thể nhé!',
    answered_by: 'Shop F1GENZ',
  },
  {
    question: 'Mình mua số lượng lớn có giảm giá không shop?',
    author: 'Hoàng Anh Tuấn',
  },
  {
    question: 'Sản phẩm có hướng dẫn sử dụng kèm theo không ạ?',
    author: 'Vũ Thanh Hương',
    answer: 'Có ạ! Trong hộp có kèm sách hướng dẫn tiếng Việt và mã QR xem video hướng dẫn.',
    answered_by: 'Shop F1GENZ',
  },
  {
    question: 'Chất liệu sản phẩm là gì vậy shop?',
    author: 'Đỗ Minh Trang',
  },
  {
    question: 'Shop có ship COD không ạ?',
    author: 'Nguyễn Hữu Thắng',
    answer: 'Có ạ! Shop hỗ trợ COD toàn quốc, thanh toán khi nhận hàng.',
    answered_by: 'Shop F1GENZ',
  },
];

function buildQuestions(samples) {
  const now = Date.now();
  return samples.map((q, i) => {
    const createdAt = now - (i + 1) * 86400000 * 2;
    const item = {
      id: generateId(),
      question: q.question,
      author: q.author,
      status: 'approved',
      created_at: createdAt,
      updated_at: q.answer ? createdAt + 86400000 : createdAt,
    };
    if (q.answer) {
      item.answer = q.answer;
      item.answered_by = q.answered_by;
      item.answered_at = createdAt + 86400000;
    }
    return item;
  });
}

function calculateQnaSummary(questions) {
  const answered = questions.filter((q) => q.answer).length;
  return { total: questions.length, answered, unanswered: questions.length - answered };
}

// ═══════════════════════════════════════════════
//  STATS BUILDER (full-name format matching StatsService)
// ═══════════════════════════════════════════════

function buildShopStats(productDataList) {
  const products = {};
  const globalDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalReviews = 0;
  let totalQuestions = 0;
  let totalAnswered = 0;
  let ratingSum = 0;
  const recentReviews = [];

  for (const { productId, reviews, reviewSummary, qnaSummary } of productDataList) {
    const rd = reviewSummary.distribution;
    products[String(productId)] = {
      reviewCount: reviewSummary.count,
      reviewAvg: reviewSummary.avg,
      reviewDistribution: rd,
      qnaTotal: qnaSummary.total,
      qnaAnswered: qnaSummary.answered,
    };

    totalReviews += reviewSummary.count;
    totalQuestions += qnaSummary.total;
    totalAnswered += qnaSummary.answered;
    for (const star of [1, 2, 3, 4, 5]) {
      globalDist[star] += (rd[star] || 0);
      ratingSum += star * (rd[star] || 0);
    }

    // Collect recent reviews (top 3 per product, max 10 total)
    for (const r of reviews.slice(0, 3)) {
      recentReviews.push({
        id: r.id,
        rating: r.rating,
        author: r.author,
        content: r.content.substring(0, 200),
        created_at: r.created_at,
        productId: String(productId),
      });
    }
  }

  recentReviews.sort((a, b) => b.created_at - a.created_at);

  return {
    totalReviews,
    totalQuestions,
    totalAnswered,
    globalAvg: totalReviews > 0 ? Math.round((ratingSum / totalReviews) * 10) / 10 : 0,
    globalDistribution: globalDist,
    products,
    recentReviews: recentReviews.slice(0, 10),
    lastUpdated: Date.now(),
  };
}

// ═══════════════════════════════════════════════
//  HARAVAN API
// ═══════════════════════════════════════════════

function headers(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function getTokenFromRedis(redis) {
  const keys = await redis.keys('haravan:reviews:app_install:*');
  if (keys.length === 0) throw new Error('No shop found in Redis. Install the app first.');
  const data = await redis.get(keys[0]);
  const parsed = JSON.parse(data);
  const orgid = keys[0].replace('haravan:reviews:app_install:', '');
  if (!parsed.access_token) throw new Error(`No access_token for orgid ${orgid}`);
  console.log(`Using orgid: ${orgid}`);
  return { token: parsed.access_token, orgid };
}

async function getProducts(token, limit) {
  const res = await axios.get(`${API_BASE}/products.json?limit=${limit}`, {
    headers: headers(token),
  });
  return res.data.products || [];
}

async function getAllProductMetafields(token, productId) {
  const res = await axios.get(`${API_BASE}/products/${productId}/metafields.json`, {
    headers: headers(token),
  });
  return res.data.metafields || [];
}

async function deleteProductMetafield(token, productId, metafieldId) {
  await axios.delete(`${API_BASE}/products/${productId}/metafields/${metafieldId}.json`, {
    headers: headers(token),
  });
}

async function createProductMetafield(token, productId, metafield) {
  const res = await axios.post(
    `${API_BASE}/products/${productId}/metafields.json`,
    { metafield },
    { headers: headers(token) },
  );
  return res.data.metafield;
}

async function getShopMetafields(token) {
  const res = await axios.get(`${API_BASE}/metafields.json?owner_resource=shop`, {
    headers: headers(token),
  });
  return res.data.metafields || [];
}

async function deleteShopMetafield(token, metafieldId) {
  await axios.delete(`${API_BASE}/metafields/${metafieldId}.json`, {
    headers: headers(token),
  });
}

async function createShopMetafield(token, metafield) {
  const res = await axios.post(
    `${API_BASE}/metafields.json`,
    { metafield },
    { headers: headers(token) },
  );
  return res.data.metafield;
}

// ═══════════════════════════════════════════════
//  DELETE OLD DATA
// ═══════════════════════════════════════════════

async function deleteAllProductMetafields(token, products) {
  console.log('🗑️  Deleting old product metafields...\n');

  for (const product of products) {
    const all = await getAllProductMetafields(token, product.id);
    await sleep(DELAY_MS);

    // Only delete our namespaces: reviews, qna
    const ours = all.filter((m) => m.namespace === 'reviews' || m.namespace === 'qna');
    if (ours.length === 0) {
      console.log(`   ${product.title}: no demo metafields`);
      continue;
    }

    for (const mf of ours) {
      await deleteProductMetafield(token, product.id, mf.id);
      await sleep(DELAY_MS);
    }
    console.log(`   ${product.title}: deleted ${ours.length} metafields`);
  }
}

async function deleteShopStatsMetafield(token) {
  console.log('\n🗑️  Deleting old shop stats metafield...');
  const all = await getShopMetafields(token);
  await sleep(DELAY_MS);

  const stats = all.filter((m) => m.namespace === 'f1genz');
  for (const mf of stats) {
    await deleteShopMetafield(token, mf.id);
    await sleep(DELAY_MS);
    console.log(`   Deleted: ${mf.namespace}/${mf.key} (id: ${mf.id})`);
  }
  if (stats.length === 0) console.log('   No stats metafield found');
}

// ═══════════════════════════════════════════════
//  PUSH NEW DATA
// ═══════════════════════════════════════════════

async function pushReviewsToProduct(token, productId, reviews) {
  const summary = calculateReviewSummary(reviews);

  await createProductMetafield(token, productId, {
    namespace: 'reviews',
    key: 'summary',
    value: JSON.stringify(summary),
    value_type: 'json',
  });
  await sleep(DELAY_MS);

  await createProductMetafield(token, productId, {
    namespace: 'reviews',
    key: 'chunk_1',
    value: JSON.stringify(reviews),
    value_type: 'string',
  });
  await sleep(DELAY_MS);

  return summary;
}

async function pushQnaToProduct(token, productId, questions) {
  const summary = calculateQnaSummary(questions);

  await createProductMetafield(token, productId, {
    namespace: 'qna',
    key: 'summary',
    value: JSON.stringify(summary),
    value_type: 'json',
  });
  await sleep(DELAY_MS);

  await createProductMetafield(token, productId, {
    namespace: 'qna',
    key: 'chunk_1',
    value: JSON.stringify(questions),
    value_type: 'string',
  });
  await sleep(DELAY_MS);

  return summary;
}

async function pushShopStats(token, stats) {
  console.log('\n📊 Pushing shop stats metafield...');
  await createShopMetafield(token, {
    namespace: 'f1genz',
    key: 'stats',
    value: JSON.stringify(stats),
    value_type: 'json',
  });
  console.log('   ✅ Stats metafield created');
}

// ═══════════════════════════════════════════════
//  CLEAR REDIS CACHE
// ═══════════════════════════════════════════════

async function clearAllCache(redis, orgid, productIds) {
  console.log('\n🧹 Clearing Redis cache...');
  const prefixes = ['reviews', 'reviews:summary', 'qna', 'qna:summary'];
  for (const pid of productIds) {
    for (const prefix of prefixes) {
      await redis.del(`${prefix}:${orgid}:${pid}`);
    }
  }
  // Also clear shop stats cache
  await redis.del(`shop:stats:${orgid}`);
  console.log('   ✅ Cache cleared');
}

// ═══════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════

async function main() {
  console.log('🚀 Push ALL Demo Data (Reviews + Q&A + Stats)\n');
  console.log('═══════════════════════════════════════════════\n');

  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
  });

  try {
    const { token, orgid } = await getTokenFromRedis(redis);

    // Get more products than we seed, to also clean non-seeded ones
    const products = await getProducts(token, 50);
    await sleep(DELAY_MS);

    if (products.length === 0) {
      console.log('❌ No products found.');
      return;
    }

    console.log(`Found ${products.length} product(s).\n`);

    // ── PHASE 1: Delete all old data ──
    console.log('═══ PHASE 1: Delete old demo data ═══\n');
    await deleteAllProductMetafields(token, products);
    await deleteShopStatsMetafield(token);

    // ── PHASE 2: Push new demo data ──
    console.log('\n═══ PHASE 2: Push new demo data ═══\n');

    const reviewCounts = [12, 8, 5];
    const qnaCounts = [8, 5, 3];
    const productDataList = [];

    for (let i = 0; i < Math.min(products.length, PRODUCTS_TO_SEED); i++) {
      const product = products[i];
      console.log(`📦 ${product.title} (${product.id})`);

      const reviews = buildReviews(REVIEW_SAMPLES.slice(0, reviewCounts[i]));
      const reviewSummary = await pushReviewsToProduct(token, product.id, reviews);
      const repliedCount = reviews.filter((r) => r.reply).length;
      console.log(`   ★ Reviews: ${reviews.length} (avg ${reviewSummary.avg}★, ${repliedCount} replied)`);

      const questions = buildQuestions(QNA_SAMPLES.slice(0, qnaCounts[i]));
      const qnaSummary = await pushQnaToProduct(token, product.id, questions);
      console.log(`   ❓ Q&A: ${questions.length} (${qnaSummary.answered} answered)`);

      productDataList.push({
        productId: product.id,
        reviews,
        reviewSummary,
        qnaSummary,
      });

      console.log('');
    }

    // ── PHASE 3: Push shop-level stats ──
    console.log('═══ PHASE 3: Push shop stats ═══');
    const stats = buildShopStats(productDataList);
    await pushShopStats(token, stats);

    console.log(`\n   Summary: ${stats.totalReviews} reviews, ${stats.totalQuestions} questions, avg ${stats.globalAvg}★`);
    console.log(`   Products with data: ${Object.keys(stats.products).length}`);
    console.log(`   Recent reviews: ${stats.recentReviews.length}`);

    // ── PHASE 4: Clear cache ──
    const seededIds = products.slice(0, PRODUCTS_TO_SEED).map((p) => p.id);
    await clearAllCache(redis, orgid, seededIds);

    console.log('\n═══════════════════════════════════════════════');
    console.log('✅ All demo data pushed successfully!');
    console.log('═══════════════════════════════════════════════');
  } catch (err) {
    console.error('\n❌ Error:', err.message || err);
    if (err.response) {
      console.error('   Status:', err.response.status, err.response.statusText);
      console.error('   Data:', JSON.stringify(err.response.data).slice(0, 500));
    }
  } finally {
    await redis.quit();
  }
}

main();
