const fs = require('fs');
const path = require('path');
const axios = require('axios');

function resolveInputPath(pageId, explicitPath) {
  if (explicitPath) {
    return path.resolve(process.cwd(), explicitPath);
  }

  const byPageFile = path.resolve(
    __dirname,
    `../../demo/assets/page.fxpage.template02.content.${pageId}.json`,
  );
  if (fs.existsSync(byPageFile)) return byPageFile;

  return path.resolve(
    __dirname,
    '../../demo/assets/page.fxpage.template02.content.1004316174.json',
  );
}

function normalizeSettings(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid input JSON');
  }

  if (raw.settings && typeof raw.settings === 'object') {
    return {
      namespace: raw.namespace || 'fxpage',
      key: raw.key || 'settings',
      settings: raw.settings,
    };
  }

  return {
    namespace: 'fxpage',
    key: 'settings',
    settings: raw,
  };
}

async function upsertMetafield(pageId, token, namespace, key, valueString) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

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

    return {
      action: 'updated',
      metafield: updateRes.data?.metafield,
    };
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

  return {
    action: 'created',
    metafield: createRes.data?.metafield,
  };
}

async function main() {
  const pageId = process.argv[2];
  const token = process.argv[3];
  const inputArg = process.argv[4];

  if (!pageId || !token) {
    throw new Error(
      'Usage: node scripts/push-template02-metafield.js <pageId> <token> [inputJsonPath]',
    );
  }

  const inputPath = resolveInputPath(pageId, inputArg);
  const rawText = fs.readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(rawText);
  const normalized = normalizeSettings(parsed);
  const valueString = JSON.stringify(normalized.settings);

  const result = await upsertMetafield(
    pageId,
    token,
    normalized.namespace,
    normalized.key,
    valueString,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        pageId,
        inputPath,
        action: result.action,
        namespace: normalized.namespace,
        key: normalized.key,
        keys: Object.keys(normalized.settings).length,
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
