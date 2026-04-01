/**
 * Push demo Q&A metafields to Haravan products.
 *
 * Usage:
 *   node scripts/push-demo-qna.js
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

const NAMESPACE = 'qna';
const PRODUCTS_TO_SEED = 3;

const SAMPLE_QNA = [
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
    answer: null, // unanswered
    answered_by: null,
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
    answer: null, // unanswered
    answered_by: null,
  },
];

function generateId() {
  return crypto.randomBytes(12).toString('base64url');
}

function buildQuestions(sampleSet) {
  const now = Date.now();
  return sampleSet.map((q, i) => {
    const created = now - (i + 1) * 86400000 * 2; // 2 days apart
    const result = {
      id: generateId(),
      question: q.question,
      author: q.author,
      status: 'approved',
      created_at: created,
      updated_at: created,
    };
    if (q.answer) {
      result.answer = q.answer;
      result.answered_by = q.answered_by;
      result.answered_at = created + 86400000; // answered 1 day later
      result.updated_at = result.answered_at;
    }
    return result;
  });
}

function calculateSummary(questions) {
  const total = questions.length;
  const answered = questions.filter((q) => !!q.answer).length;
  return { total, answered, unanswered: total - answered };
}

async function getTokenFromRedis(redis) {
  const keys = await redis.keys('haravan:reviews:app_install:*');
  if (keys.length === 0) throw new Error('No shop found in Redis.');
  const data = await redis.get(keys[0]);
  const parsed = JSON.parse(data);
  const orgid = keys[0].replace('haravan:reviews:app_install:', '');
  if (!parsed.access_token) throw new Error(`No access_token for orgid ${orgid}`);
  console.log(`Using orgid: ${orgid}`);
  return { token: parsed.access_token, orgid };
}

async function getProducts(token, limit = 10) {
  const url = `https://apis.haravan.com/com/products.json?limit=${limit}`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.data.products || [];
}

async function getProductMetafields(token, productId) {
  const url = `https://apis.haravan.com/com/products/${productId}/metafields.json?namespace=${NAMESPACE}`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
  // Haravan ignores namespace filter — filter client-side
  return (res.data.metafields || []).filter((m) => m.namespace === NAMESPACE);
}

async function createProductMetafield(token, productId, metafield) {
  const url = `https://apis.haravan.com/com/products/${productId}/metafields.json`;
  const res = await axios.post(url, { metafield }, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return res.data.metafield;
}

async function updateProductMetafield(token, productId, metafieldId, data) {
  const url = `https://apis.haravan.com/com/products/${productId}/metafields/${metafieldId}.json`;
  const res = await axios.put(url, { metafield: data }, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return res.data.metafield;
}

async function getShopMetafields(token) {
  const url = 'https://apis.haravan.com/com/metafields.json?namespace=f1genz';
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.data.metafields || [];
}

async function updateShopMetafield(token, metafieldId, data) {
  const url = `https://apis.haravan.com/com/metafields/${metafieldId}.json`;
  const res = await axios.put(url, { metafield: data }, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return res.data.metafield;
}

async function createShopMetafield(token, metafield) {
  const url = 'https://apis.haravan.com/com/metafields.json';
  const res = await axios.post(url, { metafield }, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return res.data.metafield;
}

async function pushQnaToProduct(token, productId, productTitle, questions) {
  const summary = calculateSummary(questions);
  const questionsJson = JSON.stringify(questions);

  console.log(`\n📦 Product: ${productTitle} (${productId})`);
  console.log(`   ${questions.length} Q&A, ${summary.answered} answered, chunk ${questionsJson.length} chars`);

  const existing = await getProductMetafields(token, productId);
  const existingChunks = existing.filter((m) => m.key && m.key.startsWith('chunk_'));
  const existingSummary = existing.find((m) => m.key === 'summary');

  if (existingSummary) {
    await updateProductMetafield(token, productId, existingSummary.id, {
      value: JSON.stringify(summary), value_type: 'json',
    });
    console.log('   ✅ Summary updated');
  } else {
    await createProductMetafield(token, productId, {
      namespace: NAMESPACE, key: 'summary',
      value: JSON.stringify(summary), value_type: 'json',
    });
    console.log('   ✅ Summary created');
  }

  const existingChunk1 = existingChunks.find((m) => m.key === 'chunk_1');
  if (existingChunk1) {
    await updateProductMetafield(token, productId, existingChunk1.id, {
      value: questionsJson, value_type: 'string',
    });
    console.log('   ✅ chunk_1 updated');
  } else {
    await createProductMetafield(token, productId, {
      namespace: NAMESPACE, key: 'chunk_1',
      value: questionsJson, value_type: 'string',
    });
    console.log('   ✅ chunk_1 created');
  }
}

/**
 * Merge QnA counts into the existing shop-level stats metafield
 * so the dashboard overview shows correct QnA data.
 */
async function mergeQnaIntoShopStats(token, seededProducts) {
  console.log('\n📊 Merging Q&A counts into shop stats...');

  const existing = await getShopMetafields(token);
  const statsMf = existing.find((m) => m.namespace === 'f1genz' && m.key === 'stats');

  let stats = statsMf?.value
    ? (typeof statsMf.value === 'string' ? JSON.parse(statsMf.value) : statsMf.value)
    : {
        totalReviews: 0, totalQuestions: 0, totalAnswered: 0,
        globalAvg: 0, globalDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        products: {}, recentReviews: [], lastUpdated: Date.now(),
      };

  let totalQ = 0, totalA = 0;
  for (const { productId, questions } of seededProducts) {
    const pid = String(productId);
    const summary = calculateSummary(questions);
    const entry = stats.products[pid] || {
      reviewCount: 0, reviewAvg: 0,
      reviewDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      qnaTotal: 0, qnaAnswered: 0,
    };
    entry.qnaTotal = summary.total;
    entry.qnaAnswered = summary.answered;
    stats.products[pid] = entry;
    totalQ += summary.total;
    totalA += summary.answered;
  }

  stats.totalQuestions = totalQ;
  stats.totalAnswered = totalA;
  stats.lastUpdated = Date.now();

  const statsJson = JSON.stringify(stats);

  if (statsMf) {
    await updateShopMetafield(token, statsMf.id, { value: statsJson, value_type: 'json' });
    console.log('   ✅ Shop stats updated with QnA data');
  } else {
    await createShopMetafield(token, {
      namespace: 'f1genz', key: 'stats',
      value: statsJson, value_type: 'json',
    });
    console.log('   ✅ Shop stats created with QnA data');
  }

  console.log(`   totalQuestions: ${totalQ}, totalAnswered: ${totalA}`);
}

async function main() {
  console.log('🚀 Push Demo Q&A to Haravan Products\n');

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
      console.log('❌ No products found.');
      return;
    }

    console.log(`Found ${products.length} product(s). Seeding Q&A...`);

    const seededProducts = [];
    for (let i = 0; i < Math.min(products.length, PRODUCTS_TO_SEED); i++) {
      const product = products[i];
      const count = [7, 4, 3][i] || 3;
      const questions = buildQuestions(SAMPLE_QNA.slice(0, count));
      await pushQnaToProduct(token, product.id, product.title, questions);
      seededProducts.push({ productId: product.id, questions });
    }

    // Merge QnA counts into shop-level stats
    await mergeQnaIntoShopStats(token, seededProducts);

    console.log('\n✅ Done! Q&A data pushed successfully.');
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    if (err.response) {
      console.error('   Status:', err.response.status, err.response.statusText);
      console.error('   Data:', JSON.stringify(err.response.data).slice(0, 500));
    }
  } finally {
    await redis.quit();
  }
}

main();
