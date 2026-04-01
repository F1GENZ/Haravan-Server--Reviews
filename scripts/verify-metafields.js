/**
 * Verify demo metafields exist on Haravan products.
 * Usage: node scripts/verify-metafields.js
 */

const Redis = require('ioredis');
const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const API_BASE = 'https://apis.haravan.com/com';

function headers(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function main() {
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD,
  });

  try {
    const keys = await redis.keys('haravan:reviews:app_install:*');
    if (keys.length === 0) throw new Error('No shop found in Redis');
    const data = JSON.parse(await redis.get(keys[0]));
    const token = data.access_token;
    const orgid = keys[0].replace('haravan:reviews:app_install:', '');
    console.log(`Shop: ${orgid}\n`);

    // Get first 3 products
    const res = await axios.get(`${API_BASE}/products.json?limit=3`, { headers: headers(token) });
    const products = res.data.products || [];

    for (const product of products) {
      console.log(`\n📦 ${product.title} (ID: ${product.id})`);
      console.log('─'.repeat(50));

      const mfRes = await axios.get(`${API_BASE}/products/${product.id}/metafields.json`, {
        headers: headers(token),
      });
      const metafields = mfRes.data.metafields || [];

      // Group by namespace
      const reviewMfs = metafields.filter((m) => m.namespace === 'reviews');
      const qnaMfs = metafields.filter((m) => m.namespace === 'qna');

      console.log(`\n  Reviews metafields (${reviewMfs.length}):`);
      for (const mf of reviewMfs) {
        const valPreview = (mf.value || '').substring(0, 120);
        console.log(`    [${mf.value_type}] ${mf.namespace}.${mf.key} = ${valPreview}...`);
      }

      console.log(`\n  Q&A metafields (${qnaMfs.length}):`);
      for (const mf of qnaMfs) {
        const valPreview = (mf.value || '').substring(0, 120);
        console.log(`    [${mf.value_type}] ${mf.namespace}.${mf.key} = ${valPreview}...`);
      }

      // Check if summary is parseable
      const summaryMf = reviewMfs.find((m) => m.key === 'summary');
      if (summaryMf) {
        try {
          const parsed = JSON.parse(summaryMf.value);
          console.log(`\n  ✅ Review summary: avg=${parsed.avg}, count=${parsed.count}, dist=`, parsed.distribution);
        } catch (e) {
          console.log(`\n  ❌ Review summary parse error: ${e.message}`);
        }
      } else {
        console.log(`\n  ❌ No review summary metafield found!`);
      }

      // Check chunk_1
      const chunk1 = reviewMfs.find((m) => m.key === 'chunk_1');
      if (chunk1) {
        try {
          const parsed = JSON.parse(chunk1.value);
          console.log(`  ✅ chunk_1: ${Array.isArray(parsed) ? parsed.length + ' reviews' : 'NOT an array!'}`);
          if (Array.isArray(parsed) && parsed[0]) {
            console.log(`     First review: ${parsed[0].author} - ${parsed[0].rating}★ - has reply: ${!!parsed[0].reply}`);
          }
        } catch (e) {
          console.log(`  ❌ chunk_1 parse error: ${e.message}`);
        }
      } else {
        console.log(`  ❌ No chunk_1 metafield found!`);
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    // Check shop stats
    console.log('\n\n📊 Shop-level metafields:');
    console.log('─'.repeat(50));
    const shopRes = await axios.get(`${API_BASE}/metafields.json?owner_resource=shop`, {
      headers: headers(token),
    });
    const shopMfs = (shopRes.data.metafields || []).filter((m) => m.namespace === 'f1genz');
    for (const mf of shopMfs) {
      try {
        const parsed = JSON.parse(mf.value);
        console.log(`  ✅ ${mf.namespace}.${mf.key}: tr=${parsed.tr}, tq=${parsed.tq}, ga=${parsed.ga}`);
      } catch (e) {
        console.log(`  ❌ ${mf.namespace}.${mf.key}: parse error`);
      }
    }
    if (shopMfs.length === 0) console.log('  ❌ No f1genz shop metafields found!');

  } finally {
    redis.disconnect();
  }
}

main().catch(console.error);
