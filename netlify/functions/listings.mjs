import { MongoClient, ObjectId } from 'mongodb';

let client;

async function getDb() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI not configured on Netlify');
  if (!client) {
    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
  }
  return client.db();
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  try {
    const q = event.queryStringParameters || {};
    const category = q.category;
    const page = Math.max(1, parseInt(q.page || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(q.limit || '12', 10) || 12));
    const skip = (page - 1) * limit;

    const filter = { isActive: { $ne: false } };
    if (category) filter.category = category;
    if (q.city) filter.city = q.city;

    const db = await getDb();
    const col = db.collection('listings');

    const [listings, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    const userIds = [...new Set(listings.map((l) => l.user).filter(Boolean))];
    let userMap = {};
    if (userIds.length) {
      const oids = userIds.map((id) => (id instanceof ObjectId ? id : new ObjectId(String(id))));
      const users = await db.collection('users').find({ _id: { $in: oids } }).project({ name: 1, email: 1 }).toArray();
      userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));
    }

    const enriched = listings.map((l) => {
      const uid = l.user ? String(l.user) : null;
      return {
        ...l,
        user: uid && userMap[uid] ? { _id: l.user, name: userMap[uid].name, email: userMap[uid].email } : l.user,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        limit,
        count: enriched.length,
        listings: enriched,
      }),
    };
  } catch (err) {
    console.error('listings function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: 'Database error', error: err.message }),
    };
  }
}
