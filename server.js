const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const dotenv = require("dotenv").config();
const bodyParser = require("body-parser");
const cron = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const bot2 = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN2);
const socketIo = require("socket.io");
const mongoose = require('mongoose');
const axios = require('axios');
const { pipeline } = require("stream");
const NodeCache = require('node-cache');
const { SitemapStream } = require('sitemap');
const { createGzip } = require('zlib');
const https = require('https');





const app = express();

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '60mb', extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");




// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_DB,
      collectionName: "sessions",
      ttl: 30 * 24 * 60 * 60, // 30 Days
    }),
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
      secure: false, // Set true if using HTTPS
      httpOnly: true // Protect against XSS attacks
    }
  })
);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_DB, {
  maxpoolSize: 20,             // Keep 10 connections in the pool
  socketTimeoutMS: 30000,   // Close idle connections after 30 seconds of inactivity
  connectTimeoutMS: 10000,   // Max time to wait for a connection to be established
})
  //mongoose.connect("mongodb://0.0.0.0:27017/ApsaraBazaar")
  .then(() => {
    console.log("Database connected");

    // Add the migration function here
    const migrateUserFields = async () => {
      try {
        const result = await User.updateMany(
          {}, // Match all documents
          [{
            $set: {
              followers: { $ifNull: ["$followers", []] },
              following: { $ifNull: ["$following", []] }
            }
          }]
        );

        console.log(`Successfully updated ${result.modifiedCount} user documents`);
      } catch (error) {
        console.error('Error updating user documents:', error);
      }
    };

    //  // Run the migration
    //migrateUserFields();
  })
  .catch(err => {
    console.error("Connection error", err);
  });

// Models
const User = require('./models/User');
const Post = require("./models/Post");
const Comment = require('./models/Comment');
const Image = require('./models/Image');
const Room = require('./models/Room')
const Message = require("./models/Message");
const Guest = require("./models/Guest");


// Routes
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/post");
const userRoutes = require("./routes/user");
const botRoutes = require('./routes/bot');
const roomsRoutes = require("./routes/rooms");

app.use("/rooms", roomsRoutes);
app.use("/auth", authRoutes);
app.use("/post", postRoutes);
app.use("/user", userRoutes)

// Render the index page immediately with basic data



app.get("/", async (req, res) => {
  try {
    updateUserActivity(req.session.user?.email || req.sessionID);

    // Authenticated User - skip guest handling
    if (req.session.user) {
      const user = await User.findById(req.session.user._id).lean();
      req.session.user = user;
      return res.render("index", {
        user,
        guestUser: null,
        nuser: getActiveUserCount(),

      });
    }

    // Existing Guest Session - use stored document
    if (req.session.guest) {
      let guestId = req.session.guest.guestId;
      const guestUser = await Guest.findOne({ guestId }).lean();
      if (!guestUser) {
        req.session.guest = null;
      }
      req.session.guest = guestUser;

      return res.render("index", {
        user: null,
        guestUser,
        nuser: getActiveUserCount(),

      });
    }

    // New Guest Creation (same style as User creation)
    const lastGuest = await Guest.findOne().sort({ guestId: -1 }).lean();
    const baseId = lastGuest ? parseInt(lastGuest.guestId) : 1000000;
    const guestId = (baseId + 1).toString();

    const guestUser = await Guest.create({
      guestId,
      ipAddress: req.headers['x-forwarded-for'] || req.ip,
      name: 'Guest',
    });

    req.session.guest = guestUser; // Store full document (like User)

    res.render("index", {
      user: null,
      guestUser,
      nuser: getActiveUserCount(),

    });

  } catch (err) {
    console.error('Error rendering index:', err);
    res.status(500).send('Server error');
  }
});

app.post('/reset-guest', async (req, res) => {
  console.log("reseting the guest")
  try {
    const { guestId } = req.body;

    // 1. Find the new guest record by guestId (string)
    const newGuest = await Guest.findOne({ guestId });
    if (!newGuest) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }

    // 2. Delete the old guest record in DB if it exists
    if (req.session.guest && req.session.guest.guestId) {
      await Guest.deleteOne({ guestId: req.session.guest.guestId });
    }
    //Add the guest Values
    req.session.guest = newGuest;
    // 4. Return success
    res.status(200).json({ success: true, guest: req.session.guest });

  } catch (err) {
    console.error('Session reset error:', err);
    res.status(500).json({ success: false, error: 'Unexpected error occurred' });
  }
});



// Map to track last-active timestamp by identifier (email or sessionID)
const activeUsers = new Map();
const INACTIVITY_THRESHOLD = 30 * 60 * 1000; // 30 minutes

// Update (or add) user activity
function updateUserActivity(identifier) {
  if (!identifier) return;
  activeUsers.set(identifier, Date.now());
}

// Remove users inactive beyond threshold
function removeInactiveUsers() {
  const now = Date.now();
  for (const [id, lastActive] of activeUsers.entries()) {
    if (now - lastActive > INACTIVITY_THRESHOLD) {
      activeUsers.delete(id);
    }
  }
}

// Schedule periodic cleanup every 10 minutes
setInterval(removeInactiveUsers, 10 * 60 * 1000);

// Get count of currently active users
function getActiveUserCount() {
  return activeUsers.size;
}




//Posts------------------------------------------------------------------------------------------------------------------

const pLimit = require('p-limit').default;
const limit = pLimit(5);

//To be used when my site request hitting reach in thousand every minute.
// const httpsAgent = new https.Agent({
//   family: 4, // Force IPv4
//   keepAlive: true
// });

// Cache store for latest and per-tag posts
const tags = ["Bazaar", "Pick One Celeb", "Admire Apsara", "HollyWood", "Bikini Shots", "Busty Boobies", "Influencers",
  "Kinks and Fantasies", "Apsara Fakes", "Misc", "Hot", "Top", "Rising", "Old"];

const cacheStore = { latest: [], tags: new Map() };

// In-memory cache for file_path
const filePathCache = new Map();

// Utility: fetch posts with filter, sort, pagination
async function loadPosts({ filter = {}, sort = { uploadTime: -1 }, skip = 0, size = 10 }) {
  return Post.find(filter).sort(sort).skip(skip).limit(size).lean().exec();
}

// Unified media resolver: fetch images and profile pics for given posts
async function enrichPosts(posts) {
  const postIds = posts.map(p => p._id);
  const authors = [...new Set(posts.map(p => p.author))];

  // Concurrently load media and author pics
  const [authorPics, mediaMap] = await Promise.all([
    loadAuthorPics(authors),
    loadPostMedia(postIds)
  ]);

  return posts.map(post => ({
    ...post,
    media: mediaMap[post._id] || [],
    authorpic: authorPics[post.author] || authorPics['Anonymous'] || 1
  }));
}

// Load author profile pictures
async function loadAuthorPics(authors) {
  const result = { 'Anonymous': 'anonymous' };
  const dbAuthors = authors.filter(a => a !== 'Anonymous');
  if (dbAuthors.length) {
    const users = await User.find({ username: { $in: dbAuthors } })
      .select('username profilepic').lean().exec();
    users.forEach(u => result[u.username] = u.profilepic);
  }
  return result;
}

// Resolve a Telegram file path with caching and retries
async function resolveFilePath(fileId) {
  const cached = filePathCache.get(fileId);
  if (cached && Date.now() - cached.ts < 30 * 60 * 1000) return cached.path;

  let retries = 0, path = null;
  while (retries < 3) {
    try {
      const res = await axios.get(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
      );
      path = res.data.result.file_path;
      filePathCache.set(fileId, { path, ts: Date.now() });
      return path;
    } catch (e) {
      retries++;
      await new Promise(r => setTimeout(r, 500 * retries));
    }
  }
  return null;
}

// Load post media with preserved order and fallback
async function loadPostMedia(postIds) {
  if (!postIds.length) return {};

  // 1) Fetch Posts with embedded media and capture original index
  const postsWithMedia = await Post.find({ _id: { $in: postIds } })
    .select('media')
    .lean()
    .exec();

  const records = postsWithMedia.flatMap(post =>
    (post.media || []).map((m, idx) => ({
      ...m,
      postId: post._id,
      order: idx                  // preserve original order
    }))
  );

  // 2) If no embedded media, fallback to Image collection
  if (!records.length) {
    const imgs = await Image.find({ postId: { $in: postIds } })
      .sort({ createdAt: 1 })   // oldest first
      .lean()
      .exec();

    imgs.forEach((img, idx) => {
      records.push({
        ...img,
        postId: img.postId,
        order: idx                // assign sequential order
      });
    });
  }

  // 3) Resolve file paths and build per-post arrays
  const mediaMap = {};
  await Promise.all(records.map(async rec => {
    const fp = await resolveFilePath(rec.fileId);
    const src = fp
      ? `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fp}`
      : `/post/images/${rec.fileId}`;

    mediaMap[rec.postId] = mediaMap[rec.postId] || [];
    mediaMap[rec.postId].push({
      fileId: rec.fileId,
      caption: rec.caption,
      src,
      order: rec.order
    });
  }));

  // 4) Sort each array by the preserved order
  for (const postId in mediaMap) {
    mediaMap[postId].sort((a, b) => a.order - b.order);
    // remove the helper 'order' field before returning, if you like:
    mediaMap[postId] = mediaMap[postId].map(({ order, ...rest }) => rest);
  }

  return mediaMap;
}


async function refreshCache() {
  // 1) Refresh “latest” with its own error handling
  try {
    const latestPosts = await loadPosts({ size: 30 });
    const filteredPosts = latestPosts.filter(post => !post.tags.includes("Misc"));
    cacheStore.latest = await enrichPosts(filteredPosts);
    console.log('Latest posts cache refreshed.');
  } catch (err) {
    console.error('Error refreshing latest cache:', err);
  }
  

  // 2) Refresh each tag, but only 5 at a time
  const tasks = tags.map(tag => limit(async () => {
    try {
      // Determine filter & sort
      let filter = !['Hot', 'Top', 'Rising', 'Old'].includes(tag)
        ? { tags: tag }
        : {};
      let sort = { uploadTime: -1 };
      if (tag === 'Hot') sort = { likes: -1 };
      if (tag === 'Rising') sort = { comments: -1 };
      if (tag === 'Old') sort = { uploadTime: 1 };

      // Load posts (aggregate for Top)
      let posts;
      if (tag === 'Top') {
        posts = await Post.aggregate([
          { $addFields: { total: { $add: ["$likes", "$comments"] } } },
          { $sort: { total: -1 } },
          { $limit: 10 },
          { $project: { total: 0 } }
        ]).exec();
      } else {
        posts = await loadPosts({ filter, sort, size: 10 });
      }

      // Enrich and store
      const enriched = await enrichPosts(posts);
      cacheStore.tags.set(tag, enriched);
      console.log(`Tag cache refreshed: ${tag}`);
    } catch (err) {
      console.error(`Failed to refresh tag “${tag}”:`, err);
    }
  }));

  // Wait for *all* tag tasks (throttled) to complete
  await Promise.all(tasks);

  console.log('All tag caches refreshed.');
}

// API endpoint: serve from cache or fallback
app.get('/api/posts', async (req, res) => {
  const { tag, skip = 0, limit = 10 } = req.query;
  const arr = tag ? cacheStore.tags.get(tag) || [] : cacheStore.latest;

  if (arr.length >= skip + limit) {
    return res.json({ posts: arr.slice(skip, skip + limit) });
  }

  // Cache miss: load fresh
  let filter = tag && !['Hot', 'Top', 'Rising', 'Old'].includes(tag)
    ? { tags: tag } : {};
  let sort = { uploadTime: -1 };
  if (tag === 'Hot') sort = { likes: -1 };
  if (tag === 'Rising') sort = { comments: -1 };
  if (tag === 'Old') sort = { uploadTime: 1 };

  let posts;
  if (tag === 'Top') {
    posts = await Post.aggregate([
      { $addFields: { total: { $add: ["$likes", "$comments"] } } },
      { $sort: { total: -1 } },
      { $skip: +skip },
      { $limit: +limit },
      { $project: { total: 0 } }
    ]).exec();
  } else {
    posts = await loadPosts({ filter, sort, skip: +skip, size: +limit });
  }

  res.json({ posts: await enrichPosts(posts) });
});

// Initial cache refresh and periodic refresh every 2 hours
refreshCache();
setInterval(refreshCache, 2 * 60 * 60 * 1000); // every 2 hours


// Example Express route file or main server file
app.post('/admin/refreshCache', async (req, res) => {
  if (req.session?.user?.rank === 'Admin') {
    await refreshCache()// Call your cache function
    res.json({ success: true, message: 'Feed cache refreshed successfully.' });
  } else {
    res.status(403).json({ success: false, message: 'Not authenticated to refresh cache.' });
  }
});


setInterval(initializeUserPoints, 24 * 60 * 60 * 1000); // every 24 hour
const ranks = [
  { name: 'Fapper', min: 0, max: 499 },
  { name: 'Gold Member', min: 500, max: 999 },
  { name: 'Elite Member', min: 1000, max: 4999 },
  { name: 'Moderator', min: 5000, max: Infinity },

];

async function initializeUserPoints() {
  const users = await User.find({});

  for (const user of users) {
    let coins = 0;

    // 1) Every post of yours = 10 coins
    const posts = await Post.find({ author: user.username });
    coins += posts.length * 10;

    // 2) Every 5 likes on your posts = 1 coin
    const totalPostLikes = posts.reduce((sum, p) => sum + p.likes, 0);
    coins += Math.floor(totalPostLikes / 5) * 1;

    // 3) Every 5 comments on your posts = 2 coins
    const totalPostComments = posts.reduce((sum, p) => sum + p.comments, 0);
    coins += Math.floor(totalPostComments / 5) * 2;

    // 4) Every comment/reply/super-reply you make (not on your own posts) = 2 coins
    const threads = await Comment.find({});
    let userCommentEvents = 0;
    for (const thread of threads) {
      thread.comments.forEach(comment => {
        if (comment.author === user.username /* && thread.postId ≠ your own */) {
          userCommentEvents++;
        }
        comment.replies.forEach(reply => {
          if (reply.author === user.username) userCommentEvents++;
          reply.superReplies.forEach(sr => {
            if (sr.author === user.username) userCommentEvents++;
          });
        });
      });
    }
    coins += userCommentEvents * 2;

    // 5) Every like you give (not on your own post) = 1 coin each
    coins += (user.likes?.length || 0) * 1;

    // ——— Special case: super-admin ———
    if (user.username === 'apsara_bazaar') {
      coins = Math.max(coins, 30000);
      user.rank = 'Admin';
    } else {
      // If already Moderator, preserve it
      if (user.rank === 'Moderator') {
        const moderatorBracket = ranks.find(r => r.name === 'Moderator');
        if (moderatorBracket && coins < moderatorBracket.min) {
          coins = moderatorBracket.min; // ensure minimum coins for moderator
        }
        // keep rank as Moderator
      } else {
        // Normal logic for others
        const bracket = ranks.find(r => coins >= r.min && coins <= r.max);
        if (bracket) user.rank = bracket.name;
      }
    }

    // Persist
    user.coins = coins;
    await user.save();
    console.log(`Initialized ${user.username}: ${coins} coins, rank: ${user.rank}`);
  }

  console.log('All users initialized.');
}


//---------------------------------------------------------------------------------------------------------------------------------------


//API which trigger the Chache Refresh

app.post('/post/addlike/:postId', async (req, res) => {
  const isUser = !!req.session.user;
  const isGuest = !!req.session.guest;
  if (!isUser && !isGuest) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const postId = req.params.postId;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post ID' });
  }

  const ActorModel = isUser ? User : Guest;
  const actorId = isUser ? req.session.user._id : req.session.guest._id;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const updateResult = await ActorModel.updateOne(
      { _id: actorId, likes: { $ne: postId } },
      {
        $push: {
          likes: {
            $each: [postId],
            $slice: -4000
          }
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(409).json({ message: 'Already liked' });
    }

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $inc: { likes: 1 } },
      { new: true }
    );
    updateCache(postId, updatedPost.likes);

    // ───── Notification Handling ─────
    if (isUser) {
      const author = await User.findOne({ username: post.author });
      if (author && author._id.toString() !== actorId.toString()) {
        const likerName = req.session.user.username;
        const img = post.media?.[0]?.fileId || 'NotFound';

        const notificationIndex = author.notifications.findIndex(n =>
          n.postId?.toString() === postId
        );

        if (notificationIndex !== -1) {
          // Update existing notification
          const existing = author.notifications[notificationIndex];
          let usernames = existing.message
            .replace(" liked your post.", "")
            .split(",")
            .map(name => name.trim());

          usernames = [likerName, ...usernames.filter(u => u !== likerName)].slice(0, 3);

          author.notifications[notificationIndex].message = `${usernames.join(", ")} liked your post.`;
          author.notifications[notificationIndex].status = "Unread";
          author.notifications[notificationIndex].time = new Date();
          author.notifications[notificationIndex].img = img;

          await author.save();
        } else {
          // Push new notification
          await User.updateOne(
            { _id: author._id },
            {
              $push: {
                notifications: {
                  $each: [{
                    message: `${likerName} liked your post.`,
                    img,
                    status: 'Unread',
                    time: new Date(),
                    postId: post._id
                  }],
                  $slice: -100
                }
              }
            }
          );
        }
      }
    }

    // ───── Final Response ─────
    res.status(200).json({
      message: 'Like added successfully!',
      likes: updatedPost.likes
    });

  } catch (err) {
    console.error('Error in /post/addlike:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 1) Multer setup
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
}).array('media', 20);

function validateMedia(files) {
  if (!files || !files.length) {
    throw new Error('No media uploaded');
  }

  // Figure out if it’s images or videos
  const first = files[0];
  const isImage = first.mimetype.startsWith('image/');
  const isVideo = first.mimetype.startsWith('video/');
  if (!isImage && !isVideo) {
    throw new Error(`Unsupported media type: ${first.mimetype}`);
  }
  const type = isImage ? 'image' : 'video';

  // Enforce uniform type
  for (const f of files) {
    if (type === 'image' && !f.mimetype.startsWith('image/')) {
      throw new Error('Cannot mix images and videos');
    }
    if (type === 'video' && !f.mimetype.startsWith('video/')) {
      throw new Error('Cannot mix images and videos');
    }
  }

  // Count & size limits
  const MAX_COUNT = type === 'image' ? 20 : 10;
  const MAX_TOTAL = type === 'image'
    ? 50 * 1024 * 1024
    : 100 * 1024 * 1024;

  if (files.length > MAX_COUNT) {
    throw new Error(`Too many ${type}s — max ${MAX_COUNT}`);
  }
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL) {
    throw new Error(`Total ${type} size exceeds ${MAX_TOTAL / 1024 / 1024} MB`);
  }

  return type;
}

// 3) The route
app.post('/post/create', (req, res) => {


  upload(req, res, async uploadErr => {
    if (uploadErr) {
      return res.status(400).json({ success: false, message: uploadErr.message });
    }
    // Auth check
    if (!req.session.user && !req.session.guest) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      console.log('📩 Server received media files:', req.files.length);
      req.files.forEach(f => console.log(`- ${f.originalname} (${f.size} bytes)`));


      // A) Validate media & get its type
      const type = validateMedia(req.files);

      // B) Prepare Telegram uploads
      const postId = new mongoose.Types.ObjectId();
      const mediaArray = new Array(req.files.length);
      const errors = [];

      await Promise.all(req.files.map(async (file, idx) => {
        try {
          let r1, r2, id1, id2;
          if (type === 'image') {
            r1 = await bot.sendPhoto(process.env.TELEGRAM_GROUP_ID, file.buffer, { caption: `Post ID: ${postId}` });
            r2 = await bot2.sendPhoto(process.env.TELEGRAM_GROUP_ID2, file.buffer, { caption: `Post ID: ${postId}` });
            id1 = r1.photo.pop().file_id;
            id2 = r2.photo.pop().file_id;
            mediaArray[idx] = {
              type: 'photo',
              fileId: id1,
              fileId2: id2,
              messageId: r1.message_id.toString()
            };
          } else {
            r1 = await bot.sendVideo(
              process.env.TELEGRAM_GROUP_ID,
              file.buffer,
              {
                caption: `Post ID: ${postId}`,
                supports_streaming: true
              },
              {
                filename: file.originalname || 'video.mp4',
                contentType: file.mimetype
              }
            );

            r2 = await bot2.sendVideo(
              process.env.TELEGRAM_GROUP_ID2,
              file.buffer,
              {
                caption: `Post ID: ${postId}`,
                supports_streaming: true
              },
              {
                filename: file.originalname || 'video.mp4',
                contentType: file.mimetype
              }
            );
            const info1 = r1.video || r1.document;
            const info2 = r2.video || r2.document;
            if (!info1 || !info2) {
              throw new Error('Telegram did not return a video file_id');
            }
            id1 = info1.file_id;
            id2 = info2.file_id;
            mediaArray[idx] = {
              type: 'video',
              fileId: id1,
              fileId2: id2,
              messageId: r1.message_id.toString()
            };
          }
        } catch (e) {
          errors.push(e);
        }
      }));

      // Roll back on any upload error
      if (errors.length) {
        console.error('Media upload errors:', errors);
        await cleanupMedia(mediaArray.filter(Boolean));
        throw new Error('Partial media upload failure');
      }

      // C) Build and save the Post document
      const author = req.session.user?.username || 'Anonymous';
      const { title, bodyText } = req.body;
      let tags = Array.isArray(req.body.tags)
        ? req.body.tags
        : [req.body.tags].filter(Boolean);
      if (!tags.length || tags.length > 3) {
        return res.status(400).json({ success: false, message: 'Select 1-3 tags' });
      }

      const post = new Post({
        _id: postId,
        title,
        bodyText,
        media: mediaArray,
        author,
        createdAt: new Date(),
        tags: ['recent', ...tags]
      });
      await post.save();
      await refreshCache();

      // D) Respond
      res.status(201).json({
        success: true,
        message: 'Posted',
        postId: postId.toString()
      });

    } catch (err) {
      console.error('Post creation error:', err);
      const status = err.message.includes('Partial media') ? 502 : 400;
      const message = status === 502
        ? 'Failed to upload media to storage'
        : err.message || 'Failed to create post';
      res.status(status).json({ success: false, message });
    }
  });
});


// Cleanup function for Telegram media
async function cleanupMedia(mediaArray) {
  await Promise.allSettled(mediaArray.map(media => {
    return Promise.allSettled([
      bot.deleteMessage(process.env.TELEGRAM_GROUP_ID, media.messageId),
      bot2.deleteMessage(process.env.TELEGRAM_GROUP_ID2, media.messageId2)
    ]);
  }));
}

function updateCache(postId, newLike) {
  const idStr = postId.toString();

  // 1) Update the “latest” posts cache
  const latest = cacheStore.latest;
  if (Array.isArray(latest)) {
    for (const post of latest) {
      if (post._id.toString() === idStr) {
        post.likes = newLike;
        break;
      }
    }
  }

  // 2) Update posts in tag-based cache
  for (const posts of cacheStore.tags.values()) {
    if (!Array.isArray(posts)) continue;
    for (const post of posts) {
      if (post._id.toString() === idStr) {
        post.likes = newLike;
        break;
      }
    }
  }

  console.log("Cache Updated with new Like");
}


app.post('/post/delete/:postId', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const postId = req.params.postId;
  const userId = req.session.user.username;
  const userRank = req.session.user.rank; // e.g. 'Admin', 'Moderator', etc.

  try {
    // 1. Find and validate post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // 2. Check permissions
    const isAuthor = post.author === userId;
    const isAdmin = userRank === 'Admin';
    const isModerator = userRank === 'Moderator';

    if (!isAuthor && !isAdmin && !isModerator) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // 3. If moderator (but not author/admin), hide the post instead of deleting
    if (isModerator && !isAuthor && !isAdmin) {
      post.status = 'hidden'; // assuming your Post schema has a "status" field
      await post.save();
      //3A.Sending Admin the Notficaiton of Moderator Action
      bot.sendMessage(7512714077, `@${req.session.user.username} have hide the post by @${post.author} with Id:- ${post._id} check the post https://apsarabazaar.onrender.com/post/details/${post._id} `,);
      return res.status(200).json({
        success: true,
        message: 'Post has been hidden by moderator',
        postId: postId
      });
    }

    // 4. If author or admin, delete post and its comments
    const [deletedPost, deletedComments] = await Promise.all([
      Post.findByIdAndDelete(postId),
      Comment.deleteMany({ postId: postId })
    ]);

    // 5. If using file storage, add any cleanup logic here




    //6. Refreshing the cache
    await refreshCache();

    res.status(200).json({
      success: true,
      message: 'Post and all comments deleted successfully',
      deleted: {
        postId: postId,
        commentsDeleted: deletedComments.deletedCount
      }
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during deletion process',
      error: error.message
    });
  }
});



//---------------------------------------------------------------------------------------------------------------------------------------

// Donation route
app.get("/donation", (req, res) => {
  res.render("donation");
});

//Profile Route
app.get("/my-profile", async (req, res) => {

  if (!req.session.user) {
    return res.render("auth/login"); // Renders login.ejs if user is not logged in
  }
  let user = null;
  user = await User.findById(req.session.user._id).exec();
  let profileuser = user;
  const badges = {
    "Admin": "👑",          // Crown
    "Moderator": "🛡️",      // Shield
    "Elite Member": "🌟",   // Star
    "Gold Member": "✨",     // Sparkle
    "Fapper": "",
  };
  let badge = badges[profileuser.rank];
  const profileuserObject = profileuser.toObject(); // Convert Mongoose doc to plain JS object
  profileuserObject.badge = badge;



  res.render("profile", { user, profileuser: profileuserObject, guestUser: req.session.guest });
});

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized access" });
  }
  next();
}

app.post("/update-profile", isAuthenticated, async (req, res) => {
  try {
    const { name, currentPassword, newPassword, profileIcon } = req.body;
    const userId = req.session.user._id; // Get user ID from session

    // Fetch user from the database
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Object to store fields that need updating
    const updates = {};

    // **Update Display Name**
    if (name) {
      updates.name = name.trim();
    }

    // **Update Password (if provided)**
    if (currentPassword && newPassword) {
      if (currentPassword !== user.password) {
        console.log("Inside wrong Password")
        return res.status(400).json({ error: "Incorrect User Password" });
      }
      updates.password = newPassword; // Directly store the new password
    }

    // **Update Profile Icon**
    if (profileIcon) {
      const allIcons = [
        { src: "/icons/avatars/avatar1.jpg", requiredRank: "Fapper" },
        { src: "/icons/avatars/avatar2.jpg", requiredRank: "Fapper" },
        { src: "/icons/avatars/avatar3.jpg", requiredRank: "Fapper" },
        { src: "/icons/avatars/avatar4.jpg", requiredRank: "Fapper" },
        { src: "/icons/avatars/avatar5.jpg", requiredRank: "Fapper" },
        { src: "/icons/avatars/avatar6.jpg", requiredRank: "Fapper" },
        { src: "/icons/avatars/avatar7.jpg", requiredRank: "Gold Member" },
        { src: "/icons/avatars/avatar8.jpg", requiredRank: "Gold Member" },
        { src: "/icons/avatars/avatar9.jpg", requiredRank: "Moderator" },
        { src: "/icons/avatars/avatar10.jpg", requiredRank: "Moderator" },
      ];

      const userRank = user.rank || "Fapper";

      // Trim and sanitize input
      const sanitizedProfileIcon = profileIcon.trim();

      // Debugging log to check what is being received
      console.log("User selected profileIcon:", sanitizedProfileIcon);

      // Find the selected icon
      const selectedIcon = allIcons.find(icon => icon.src.trim() === sanitizedProfileIcon);

      if (!selectedIcon) {
        console.log("Invalid icon selection. Available icons:", allIcons.map(i => i.src));
        return res.status(400).json({ error: "Invalid icon selection" });
      }

      // Check if the user's rank allows selecting this icon
      const allowedRanks = {
        "Fapper": ["Fapper"],
        "Gold Member": ["Fapper", "Gold Member"],
        "Moderator": ["Fapper", "Gold Member", "Moderator"],
        "Admin": ["Fapper", "Gold Member", "Moderator", "Admin"]
      };

      if (!allowedRanks[userRank]?.includes(selectedIcon.requiredRank)) {
        console.log("Permission denied for rank:", userRank, "to select:", selectedIcon.requiredRank);
        return res.status(403).json({ error: "You do not have permission to use this icon" });
      }

      // Update profile icon
      updates.profilepic = sanitizedProfileIcon.match(/avatar(\d+)\.jpg/)?.[1] || sanitizedProfileIcon;
    }


    // **Apply Updates**
    await User.findByIdAndUpdate(userId, updates, { new: true });

    return res.json({ message: "Profile updated successfully", updates });
  } catch (error) {
    console.error("Profile Update Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});




const posts = require('./ApsaraBaazar.posts.json'); // make sure this file is in the same directory

// Replace with your actual domain
const baseUrl = 'https://apsarabazaar.onrender.com';

app.get('/sitemap.xml', (req, res) => {
  try {
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    sitemap += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" `;
    sitemap += `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" `;
    sitemap += `xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 `;
    sitemap += `http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n`; // Fixed typo here

    const staticPages = [
      { path: '/', lastmod: '2025-01-01' }, // Update date as needed
      { path: '/about', lastmod: '2025-01-01' },
      { path: '/donation', lastmod: '2025-01-01' },
      { path: '/contact', lastmod: '2025-01-01' }
    ];

    staticPages.forEach(({ path, lastmod }) => {
      sitemap += `
        <url>
          <loc>${baseUrl}${path}</loc>
          <lastmod>${lastmod}</lastmod>
          <changefreq>monthly</changefreq>
          <priority>0.8</priority>
        </url>`;
    });

    posts.forEach(post => {
      if (post._id?.$oid) {
        sitemap += `
          <url>
            <loc>${baseUrl}/post/details/${post._id.$oid}</loc>
            <changefreq>weekly</changefreq>
            <priority>0.5</priority>
          </url>`;
      }
    });

    sitemap += `\n</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Internal Server Error');
  }
});






const PORT = process.env.PORT || 3000;
const HOST = '::'; // Listen on all IPv6 addresses

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on http://[${HOST}]:${PORT}`);
});


const io = socketIo(server);
const users = new Map(); // To keep track of online users in different rooms


app.get("/chats", async (req, res) => {
  // Check if user is authenticated
  if (!req.session.user) {
    return res.status(401).redirect("/auth/login"); // Or handle differently
  }
  try {
    let user = null;
    let rooms = []; // Initialize rooms to an empty array

    if (req.session.user && req.session.user._id) {
      user = await User.findById(req.session.user._id).exec();
      updateUserActivity(req.session.user.email);

      if (user.rooms) {
        let roomCodes = user.rooms.split(','); // Assuming user.rooms is a comma-separated string of room codes

        // Fetch rooms that exist
        let existingRooms = await Room.find({ code: { $in: roomCodes } }).exec();
        let existingRoomCodes = new Set(existingRooms.map(room => room.code)); // Convert to Set for fast lookup

        // Remove room codes that don't exist from user's rooms
        let validRoomCodes = roomCodes.filter(code => existingRoomCodes.has(code));

        if (validRoomCodes.length !== roomCodes.length) {
          user.rooms = validRoomCodes.join(','); // Update user.rooms with only valid rooms
          await user.save(); // Save the updated user document
        }

        // Fetch the latest message for each room and filter rooms that have messages
        let filteredRooms = [];
        for (let room of existingRooms) {
          const hasMessages = await Message.exists({ roomCode: room.code });
          if (hasMessages) {
            const latestMessage = await Message.findOne({ roomCode: room.code }).sort({ timestamp: -1 }).exec();
            filteredRooms.push({ room, latestMessage });
          }
        }

        // Sort rooms based on the latest message timestamp (newest first)
        filteredRooms.sort((a, b) => b.latestMessage.timestamp - a.latestMessage.timestamp);

        // Extract sorted rooms from filteredRooms array
        rooms = filteredRooms.map(item => item.room);
      }
      let nuser = getActiveUserCount();

      return res.render("chat-lobby", { user, rooms, nuser, guestUser: null }); // Pass sorted rooms
    }
    else {
      return res.render("login")
    }


  } catch (err) {
    console.error("Error fetching user", err);
    res.status(500).send("Server error");
  }
});




// API endpoint for sending messages
app.post("/send-message", (req, res) => {
  const { message, user, roomCode, name } = req.body;

  const timestamp = new Date();
  const offset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
  timestamp.setTime(timestamp.getTime() + offset);
  console.log(message)

  if (!message) {
    return res.json({
      success: false,
      error: "Message cannot be empty",
    });
  }
  let msg;
  if (roomCode === "7UI3IX") {
    msg = new Message({
      user,
      name,
      msg: message,
      timestamp,
      roomCode,
    });

    msg.save().then(() => {
      io.to(roomCode).emit("chat message", {
        _id: msg._id,
        user,
        name,
        msg: message,
        timestamp,
      });

      // Notify users in the room
      users.get(roomCode).forEach((userName, username) => {
        io.to(username).emit("notification", {
          title: "New Message",
          body: `${user} sent a new message`,
        });
      });

      res.json({ success: true, _id: msg._id });
    })
      .catch((err) => {
        console.error("Error saving message:", err);
        res.json({ success: false, error: err.message });
      });


  }
  else {
    msg = new Message({
      user,
      msg: message,
      timestamp,
      roomCode,
    });

    msg.save().then(() => {
      io.to(roomCode).emit("chat message", {
        _id: msg._id,
        user,
        msg: message,
        timestamp,
      });

      // Notify users in the room
      users.get(roomCode).forEach((userName, username) => {
        io.to(username).emit("notification", {
          title: "New Message",
          body: `${user} sent a new message`,
        });
      });

      res.json({ success: true, _id: msg._id });
    })
      .catch((err) => {
        console.error("Error saving message:", err);
        res.json({ success: false, error: err.message });
      });
  }


});

// Endpoint for deleting messages
app.delete('/delete-message/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Find and delete the message by ID
    const message = await Message.findByIdAndDelete(id).exec();

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ success: false, error: 'An error occurred while deleting the message' });
  }
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join room", async ({ username, roomCode }) => {
    socket.join(roomCode);
    socket.username = username;
    socket.roomCode = roomCode;

    if (!users.has(roomCode)) {
      users.set(roomCode, new Map()); // Use a Map to store usernames and their real names
    }

    // Fetch the user's real name
    const user = await User.findOne({ username });
    const userName = user ? user.name : username; // Fallback to username if name is not found

    users.get(roomCode).set(username, userName);

    console.log(`${userName} has joined room ${roomCode}`);

    // Send message history for the room to the new user
    Message.find({ roomCode })
      .sort({ timestamp: 1 })
      .then((messages) => {
        socket.emit("message history", messages);
      })
      .catch((err) => {
        console.error("Error retrieving message history:", err);
      });

    // Broadcast updated user list to the room
    io.to(roomCode).emit("update users", Array.from(users.get(roomCode).values()));
  });

  socket.on("disconnect", () => {
    const { username, roomCode } = socket;

    if (roomCode && users.has(roomCode)) {
      const userMap = users.get(roomCode);
      if (userMap) {
        userMap.delete(username);

        if (userMap.size === 0) {
          users.delete(roomCode);
        }

        console.log(`${username} has left room ${roomCode}`);

        // Broadcast updated user list to the room
        io.to(roomCode).emit("update users", Array.from(userMap.values()));
      }
    }
  });
});

app.use((req, res, next) => {
  res.status(404).render("404", { url: req.originalUrl });
});
