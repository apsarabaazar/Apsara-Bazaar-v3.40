// routes/post.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');

const Post = require('../models/Post');
const User = require('../models/User');
const Image = require('../models/Image');
const Comments = require('../models/Comment');
const Guest = require("../models/Guest");


const axios = require('axios');
const { pipeline } = require("stream");
const upload = multer().array('images', 10);

const compression = require('compression');
router.use(compression()); // Add at top of middleware chain

const https = require('https');
const bot2 = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN2);



// router.get("/comments/:postId", async (req, res) => {
//   const postId = req.params.postId;

//   try {
//     // Find the post by postId
//     const post = await Post.findById(postId).exec();
//     if (!post) {
//       return res.status(404).json({ message: "Post not found" });
//     }

//     // Find comments associated with the postId
//     const comments = await Comments.find({ postId }).exec();

//     // Fetch images associated with the post

//     // 3. If no embedded media, fall back to Image collection
//     let mediaRecords = post.media;
//     let imageData;
//     if (!Array.isArray(mediaRecords) || mediaRecords.length === 0) {
//       // Fetch images associated with the post
//     const images = await Image.find({ postId }).exec();
//     imageData = images.map(img => ({
//       fileId: img.fileId,
//       caption: img.caption,
//       src: `/post/images/${img.fileId}` // Endpoint for serving images
//     }));
//     }
//     //If Post Media Detail Present
//     else{
//       imageData = await Promise.all(mediaRecords.map(async m => {
//         let effectiveFileId, chosenBotToken;
//         if (m.fileId2) {
//           if (Math.random() < 0.5) {
//             effectiveFileId = m.fileId;
//             chosenBotToken = process.env.TELEGRAM_BOT_TOKEN;
//           } else {
//             effectiveFileId = m.fileId2;
//             chosenBotToken = process.env.TELEGRAM_BOT_TOKEN2;
//           }
//         } else {
//           effectiveFileId = m.fileId;
//           chosenBotToken = process.env.TELEGRAM_BOT_TOKEN;
//         }

//         // fetch current file_path
//         let filePath;
//         try {
//           filePath = await getFilePathWithToken(effectiveFileId, chosenBotToken);
//         } catch (err) {
//           console.error("getFilePath failed for", effectiveFileId, err);
//         }

//         // build src: Telegram URL if we got a path, otherwise fallback to local route
//         const src = filePath
//           ? `https://api.telegram.org/file/bot${chosenBotToken}/${filePath}`
//           : `/post/images/${m.fileId}`;

//         return {
//           fileId:  m.fileId,
//           fileId2: m.fileId2,
//           caption: m.caption,
//           src
//         };
//       }));

//     }





//     let user = null;
//     if (req.session.user) {
//       user = await User.findById(req.session.user._id).lean().exec();
//     }
//     let author=post.author;
//     const authoruser = await User.find({ username:author}).select('username profilepic rank')
//     const authorpic = authoruser.length > 0 ? authoruser[0].profilepic : null;
//     const badges = {
//       "Admin": "👑",          // Crown
//       "Moderator": "🛡️",      // Shield
//       "Elite Member": "🌟",   // Star
//       "Gold Member": "✨",     // Sparkle
//       "Fapper":"",
//   };
//     let authorbadge=badges[authoruser[0].rank];
//     const postObject = post.toObject(); // Convert Mongoose doc to plain JS object
//     postObject.authorpic = authorpic;
//     postObject.authorbadge=authorbadge;

//     // If user is authenticated and post is found, render the comment page
//     res.render("comment", { post:postObject, images: imageData, user, comments });
//   } catch (error) {
//     console.error("Error fetching comments:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// router.post("/comments/:postId/new", async (req, res) => {
//   const postId = req.params.postId;
//   const { commentBody } = req.body;

//   const isUser  = !!req.session.user;
//   const isGuest = !!req.session.guest;
//   if (!isUser && !isGuest) {
//     return res.status(401).send("User not authenticated");
//   }

//   // Choose the display name
//   const commenterName = isUser
//     ? req.session.user.username
//     : "Anonymous User";

//   try {
//     // 1. Save the new comment
//     const newComment = new Comments({
//       postId,
//       Author: commenterName,
//       body: commentBody,
//     });
//     await newComment.save();

//     // 2. Increment comment count on the post
//     await Post.findByIdAndUpdate(postId, { $inc: { comments: 1 } });

//     // 3. Fetch post and author info
//     const post = await Post.findById(postId);
//     if (!post) {
//       return res.status(404).send("Post not found");
//     }
//     const postAuthorUsername = post.author;
//     const postMediaImg = (post.media && post.media.length > 0)
//       ? post.media[0].fileId
//       : "NotFound";

//     // 4. Don’t notify if someone comments on their own post
//     if (postAuthorUsername !== commenterName) {
//       const authorUser = await User.findOne({ username: postAuthorUsername });
//       if (authorUser) {
//         // Look for an existing “... commented on your post.” notification
//         const existingIdx = authorUser.notifications.findIndex(n =>
//           n.postId?.toString() === postId &&
//           n.message.endsWith("commented on your post.")
//         );

//         if (existingIdx !== -1) {
//           // Update the list of names (max 3)
//           const notif = authorUser.notifications[existingIdx];
//           const oldNames = notif.message
//             .replace(" commented on your post.", "")
//             .split(",");
//           const names = [
//             commenterName,
//             ...oldNames.filter(n => n !== commenterName)
//           ].slice(0, 3);

//           notif.message = `${names.join(",")} commented on your post.`;
//           notif.status  = "Unread";
//           notif.time    = new Date();
//           notif.img     = postMediaImg;

//           await authorUser.save();
//         } else {
//           // Push a brand-new notification
//           const newNotification = {
//             message: `${commenterName} commented on your post.`,
//             img:     postMediaImg,
//             status:  "Unread",
//             time:    new Date(),
//             postId:  post._id
//           };
//           await User.updateOne(
//             { _id: authorUser._id },
//             { $push: { notifications: { $each: [newNotification], $slice: -100 } } }
//           );
//         }
//       }
//     }

//     // 5. Redirect back to comments view
//     res.redirect(`/post/comments/${postId}`);

//   } catch (error) {
//     console.error("Error adding comment:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });



// router.post("/comments/:postId/reply", async (req, res) => {
//   const postId = req.params.postId;
//   const { parentCommentId, replyBody } = req.body;

//   if (!req.session.user) {
//     return res.status(401).send("User not authenticated");
//   }

//   try {
//     const replierUsername = req.session.user.username;

//     // 1. Find parent comment
//     const parentComment = await Comments.findById(parentCommentId);
//     if (!parentComment) {
//       return res.status(404).send("Parent comment not found");
//     }

//     // 2. Push reply
//     const reply = {
//       username: replierUsername,
//       content: replyBody
//     };
//     parentComment.subBody.push(reply);
//     await parentComment.save();

//     // 3. Increment post comment count
//     await Post.findByIdAndUpdate(postId, { $inc: { comments: 1 } });

//     // 4. Fetch Post
//     const post = await Post.findById(postId);
//     if (!post) return res.status(404).send("Post not found");

//     const postMediaImg = (post.media && post.media.length > 0) ? post.media[0].fileId : "NotFound";

//     // --- NOTIFY POST AUTHOR (same logic as comment) ---
//     if (post.author !== replierUsername) {
//       const postAuthor = await User.findOne({ username: post.author });
//       if (postAuthor) {
//         const existingNotificationIndex = postAuthor.notifications.findIndex(n =>
//           n.postId?.toString() === postId && n.message.endsWith("commented on your post.")
//         );

//         if (existingNotificationIndex !== -1) {
//           let oldMessage = postAuthor.notifications[existingNotificationIndex].message;
//           let usernames = oldMessage.replace(" commented on your post.", "").split(",");

//           usernames = [replierUsername, ...usernames.filter(u => u !== replierUsername)].slice(0, 3);

//           postAuthor.notifications[existingNotificationIndex].message = `${usernames.join(",")} commented on your post.`;
//           postAuthor.notifications[existingNotificationIndex].status = "Unread";
//           postAuthor.notifications[existingNotificationIndex].time = new Date();
//           postAuthor.notifications[existingNotificationIndex].img = postMediaImg;

//           await postAuthor.save();
//         } else {
//           const newNotification = {
//             message: `${replierUsername} commented on your post.`,
//             img: postMediaImg,
//             status: "Unread",
//             time: new Date(),
//             postId: post._id
//           };

//           await User.updateOne(
//             { _id: postAuthor._id },
//             { $push: { notifications: { $each: [newNotification], $slice: -100 } } }
//           );
//         }
//       }
//     }

//     // --- NOTIFY COMMENT AUTHOR ---
//     if (parentComment.Author !== replierUsername) {
//       const commentAuthor = await User.findOne({ username: parentComment.Author });

//       if (commentAuthor) {
//         const replyNotification = {
//           message: `${replierUsername} replied to your comment.`,
//           img: postMediaImg,
//           status: "Unread",
//           time: new Date(),
//           postId: post._id
//         };

//         await User.updateOne(
//           { _id: commentAuthor._id },
//           { $push: { notifications: { $each: [replyNotification], $slice: -100 } } }
//         );
//       }
//     }

//     // Done
//     console.log("Reply to Comment Added:", reply);
//     res.redirect(`/post/comments/${postId}`);
//   } catch (error) {
//     console.error("Error adding reply:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });



const MAX_COMMENTS = 50;
//New API's

router.get('/comments/:postId', async (req, res) => {
  const postId = req.params.postId;

  try {
    // 1️⃣ Fetch the post
    const post = await Post.findById(postId).lean().exec();
    if (!post) return res.status(404).json({ message: 'Post not found' });
    // 2️⃣ Fetch all thread‐chunks & flatten comments safely
    const threads = await Comments
      .find({ postId })
      .sort({ count: 1 })
      .lean()
      .exec();

    // Use reduce+concat instead of flatMap
    let comments = threads.reduce((all, thread) => {
      if (Array.isArray(thread.comments)) {
        return all.concat(thread.comments);
      }
      return all;
    }, []);

    // ── badge map for both post‐author and comment‐authors ──
    const badges = {
      'Admin': '👑',
      'Moderator': '🛡️',
      'Elite Member': '🌟',
      'Gold Member': '✨',
      'Fapper': ' '
    };

    // 2A️⃣ Enrich each comment/reply/superReply with authorpic & authorbadge
    // 1. Collect all usernames
    const authorSet = new Set();
    comments.forEach(c => {
      authorSet.add(c.author);
      (c.replies || []).forEach(r => {
        authorSet.add(r.author);
        (r.superReplies || []).forEach(sr => authorSet.add(sr.author));
      });
    });
    const authors = Array.from(authorSet);

    // 2. Bulk‐fetch user records
    const authorUsers = await User.find({ username: { $in: authors } }).lean().exec();

    // 3. Build lookup map
    const authorLookup = {};
    authorUsers.forEach(u => {
      authorLookup[u.username] = {
        pic:    u.profilepic || 'anonymous',
        badge:  badges[u.rank]    || 'Not Found'
      };
    });

    // 4. Inject into the comment tree
    comments = comments.map(c => {
      const me = authorLookup[c.author] || { pic:'anonymous', badge:'' };
      c.authorpic   = me.pic;
      c.authorbadge = me.badge;

      c.replies = (c.replies || []).map(r => {
        const rr = authorLookup[r.author] || { pic:'anonymous', badge:'' };
        r.authorpic   = rr.pic;
        r.authorbadge = rr.badge;

        r.superReplies = (r.superReplies || []).map(sr => {
          const ss = authorLookup[sr.author] || { pic:'anonymous', badge:'' };
          sr.authorpic   = ss.pic;
          sr.authorbadge = ss.badge;
          return sr;
        });

        return r;
      });

      return c;
    });


   


    // 3️⃣ Build imageData, guarding against undefined media
    let mediaRecords = post.media;
    let imageData;
    if (!Array.isArray(mediaRecords) || mediaRecords.length === 0) {
      // Fetch images associated with the post
      const images = await Image.find({ postId }).exec();
      imageData = images.map(img => ({
        fileId: img.fileId,
        caption: img.caption,
        src: `/post/images/${img.fileId}` // Endpoint for serving images
      }));
    }
    //If Post Media Detail Present
    else {
      imageData = await Promise.all(mediaRecords.map(async m => {
        let effectiveFileId, chosenBotToken;
        if (m.fileId2) {
          if (Math.random() < 0.5) {
            effectiveFileId = m.fileId;
            chosenBotToken = process.env.TELEGRAM_BOT_TOKEN;
          } else {
            effectiveFileId = m.fileId2;
            chosenBotToken = process.env.TELEGRAM_BOT_TOKEN2;
          }
        } else {
          effectiveFileId = m.fileId;
          chosenBotToken = process.env.TELEGRAM_BOT_TOKEN;
        }

        // fetch current file_path
        let filePath;
        try {
          filePath = await getFilePathWithToken(effectiveFileId, chosenBotToken);
        } catch (err) {
          console.error("getFilePath failed for", effectiveFileId, err);
        }

        // build src: Telegram URL if we got a path, otherwise fallback to local route
        const src = filePath
          ? `https://api.telegram.org/file/bot${chosenBotToken}/${filePath}`
          : `/post/images/${m.fileId}`;

        return {
          fileId: m.fileId,
          fileId2: m.fileId2,
          caption: m.caption,
          src
        };
      }));

    }

    // 4️⃣ User & guest handling
    let user = null;
    let guest = null; // New guest variable

    if (req.session.user) {
      // Logged-in user
      user = await User.findById(req.session.user._id).lean().exec();
    } else if (req.session.guest) {
      // Guest user
      const guestId = req.session.guest.guestId;
      guest = await Guest.findOne({ guestId }).lean();

      if (!guest) {
        // Destroy session if guest doesn't exist
        req.session.destroy();
      } else {
        // Update session with fresh guest data
        req.session.guest = guest;
      }
    }

    // 5️⃣ Author info
    const authorUser = await User.findOne({ username: post.author })
      .lean()
      .exec();

    // Render with separated user/guest fields
    res.render('comment', {
      post: {
        ...post,
        authorpic: authorUser?.profilepic || "anonymous",
        authorbadge: badges[authorUser?.rank] || ""
      },
      media: imageData,
      user,   // Always null for guests
      guest,  // Always null for logged-in users
      comments
    });


  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/comments/:postId/new', async (req, res) => {
  const postId = req.params.postId;
  const { commentBody } = req.body;
  const isUser = !!req.session.user;
  const isGuest = !!req.session.guest;

  if (!isUser && !isGuest) {
    return res.status(401).send('User not authenticated');
  }

  const commenterName = isUser
    ? req.session.user.username
    : 'Anonymous User';

  try {
    // 1️⃣ Find or create the “latest” comment-thread chunk
    let thread = await Comments
      .findOne({ postId })
      .sort({ count: -1 })
      .exec();

    // If no thread yet, or it’s full, make a new one
    if (!thread || thread.comments.length >= MAX_COMMENTS) {
      const nextCount = thread ? thread.count + 1 : 1;
      thread = new Comments({
        postId,
        count: nextCount,
        comments: []
      });
    }

    // 2️⃣ Push the new comment into that chunk
    thread.comments.push({
      body: commentBody,
      author: commenterName
      // createdAt will default automatically
    });

    await thread.save();

    // 3️⃣ bump the total comment count on the Post
    await Post.findByIdAndUpdate(postId, {
      $inc: { comments: 1 }
    });

    // 4️⃣ Fetch the post (for notification logic)
    const post = await Post.findById(postId).exec();
    if (!post) return res.status(404).send('Post not found');


    // 5️⃣ Notify post-author if needed
    if (post.author !== commenterName) {
      const authorUser = await User.findOne({ username: post.author });
      if (authorUser) {
        const postMediaImg = post.media?.[0]?.fileId || 'NotFound';
        const baseMsg = ' commented on your post.';

        // See if we already have a similar “X, Y commented…” notif
        const idx = authorUser.notifications.findIndex(n =>
          n.postId?.toString() === postId &&
          n.message.endsWith(baseMsg)
        );

        if (idx !== -1) {
          // update existing notification
          const notif = authorUser.notifications[idx];
          const names = [
            commenterName,
            ...notif.message
              .replace(baseMsg, '')
              .split(',')
              .filter(n => n !== commenterName)
          ].slice(0, 3);

          notif.message = `${names.join(', ')} ${baseMsg}`;
          notif.status = 'Unread';
          notif.time = new Date();
          notif.img = postMediaImg;
          await authorUser.save();

        } else {
          // push brand-new notification
          const newNotif = {
            message: `${commenterName}${baseMsg}`,
            img: postMediaImg,
            status: 'Unread',
            time: new Date(),
            postId: post._id
          };
          await User.updateOne(
            { _id: authorUser._id },
            { $push: { notifications: { $each: [newNotif], $slice: -100 } } }
          );
        }
      }
    }

    // 6️⃣ Redirect back to the comments page
    res.redirect(`/post/comments/${postId}`);

  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/comments/:postId/reply', async (req, res) => {
  const postId = req.params.postId;
  const { parentCommentId, replyBody } = req.body;
  const isUser = !!req.session.user;
  const isGuest = !!req.session.guest;

  // 1️⃣ Auth check (user or guest)
  if (!isUser && !isGuest) {
    return res.status(401).send('User not authenticated');
  }

  // 2️⃣ Choose display name
  const replierName = isUser
    ? req.session.user.username
    : 'Anonymous User';

  try {
    // 3️⃣ Find the thread containing that comment
    const thread = await Comments.findOne({
      postId,
      'comments._id': parentCommentId
    });
    if (!thread) {
      return res.status(404).send('Parent comment not found');
    }

    // 4️⃣ Push the reply onto the correct comment
    const comment = thread.comments.id(parentCommentId);
    comment.replies.push({
      body: replyBody,
      author: replierName
    });
    await thread.save();

    // 5️⃣ Increment the Post's total comment count
    await Post.findByIdAndUpdate(postId, { $inc: { comments: 1 } });

    // 6️⃣ Fetch post for notifications
    const post = await Post.findById(postId);
    if (!post) return res.status(404).send('Post not found');
    const postMediaImg = post.media?.[0]?.fileId || 'NotFound';

    // 7️⃣ Notify post author if needed
    if (post.author !== replierName) {
      const postAuthor = await User.findOne({ username: post.author });
      if (postAuthor) {
        const suffix = 'commented on your post.';
        const idx = postAuthor.notifications.findIndex(n =>
          n.postId?.toString() === postId && n.message.endsWith(suffix)
        );
        if (idx !== -1) {
          const notif = postAuthor.notifications[idx];
          const oldNames = notif.message.replace(` ${suffix}`, '').split(',');
          const names = [replierName, ...oldNames.filter(n => n !== replierName)].slice(0, 3);
          notif.message = `${names.join(', ')} ${suffix}`;
          notif.status = 'Unread';
          notif.time = new Date();
          notif.img = postMediaImg;
          await postAuthor.save();
        } else {
          const newNotif = {
            message: `${replierName} ${suffix}`,
            img: postMediaImg,
            status: 'Unread',
            time: new Date(),
            postId: post._id
          };
          await User.updateOne(
            { _id: postAuthor._id },
            { $push: { notifications: { $each: [newNotif], $slice: -100 } } }
          );
        }
      }
    }

    // 8️⃣ Notify the comment’s author if it wasn’t self
    if (comment.author !== replierName) {
      const commentAuthor = await User.findOne({ username: comment.author });
      if (commentAuthor) {
        const replyNotif = {
          message: `${replierName} replied to your comment.`,
          img: postMediaImg,
          status: 'Unread',
          time: new Date(),
          postId: post._id
        };
        await User.updateOne(
          { _id: commentAuthor._id },
          { $push: { notifications: { $each: [replyNotif], $slice: -100 } } }
        );
      }
    }

    // 9️⃣ Done
    console.log('Reply added by', replierName);
    res.redirect(`/post/comments/${postId}`);

  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/comments/:postId/superreply', async (req, res) => {
  const postId = req.params.postId;
  const { parentCommentId, parentReplyId, superReplyBody } = req.body;

  const isUser = !!req.session.user;
  const isGuest = !!req.session.guest;
  if (!isUser && !isGuest) {
    return res.status(401).send('User not authenticated');
  }
  const replierName = isUser
    ? req.session.user.username
    : 'Anonymous User';
  console.log("parentCommentId" + parentCommentId)
  console.log(" parentReplyId" + parentReplyId)
  console.log("SRely:-" + superReplyBody)
  // **Server-side guard against an empty body**
  if (!superReplyBody || !superReplyBody.trim()) {
    return res.status(400).send('Super-reply cannot be blank');
  }

  try {
    // 1️⃣ Find the thread containing that comment & reply
    const thread = await Comments.findOne({
      postId,
      'comments._id': parentCommentId,
      'comments.replies._id': parentReplyId
    });
    if (!thread) {
      return res.status(404).send('Parent reply not found');
    }

    // 2️⃣ Push super-reply
    const comment = thread.comments.id(parentCommentId);
    const reply = comment.replies.id(parentReplyId);
    reply.superReplies.push({
      body: superReplyBody,
      author: replierName
      // createdAt auto-defaults
    });
    await thread.save();

    // 3️⃣ Increment total comments on Post
    await Post.findByIdAndUpdate(postId, { $inc: { comments: 1 } });

    // 4️⃣ Fetch Post for notifications
    const post = await Post.findById(postId).lean().exec();
    if (!post) return res.status(404).send('Post not found');
    const postMediaImg = post.media?.[0]?.fileId || 'NotFound';

    // 5️⃣ Notify post author (if not self)
    if (post.author !== replierName) {
      const postAuthor = await User.findOne({ username: post.author });
      if (postAuthor) {
        const suffix = 'replied to a reply on your post.';
        const idx = postAuthor.notifications.findIndex(n =>
          n.postId?.toString() === postId && n.message.endsWith(suffix)
        );
        if (idx !== -1) {
          // update existing “X, Y replied to a reply…” notif
          const notif = postAuthor.notifications[idx];
          const oldNames = notif.message.replace(` ${suffix}`, '').split(',');
          const names = [replierName, ...oldNames.filter(n => n !== replierName)].slice(0, 3);
          notif.message = `${names.join(', ')} ${suffix}`;
          notif.status = 'Unread';
          notif.time = new Date();
          notif.img = postMediaImg;
          await postAuthor.save();
        } else {
          // push brand-new notification
          const newNotif = {
            message: `${replierName} ${suffix}`,
            img: postMediaImg,
            status: 'Unread',
            time: new Date(),
            postId: post._id
          };
          await User.updateOne(
            { _id: postAuthor._id },
            { $push: { notifications: { $each: [newNotif], $slice: -100 } } }
          );
        }
      }
    }

    // 6️⃣ Notify the original reply’s author (if not self)
    if (reply.author !== replierName) {
      const replyAuthor = await User.findOne({ username: reply.author });
      if (replyAuthor) {
        const replyNotif = {
          message: `${replierName} replied to your reply.`,
          img: postMediaImg,
          status: 'Unread',
          time: new Date(),
          postId: post._id
        };
        await User.updateOne(
          { _id: replyAuthor._id },
          { $push: { notifications: { $each: [replyNotif], $slice: -100 } } }
        );
      }
    }

    // 7️⃣ Done
    res.redirect(`/post/comments/${postId}`);
  } catch (err) {
    console.error('Error adding super-reply:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/comments/like', async (req, res) => {
  const { type, id } = req.body;
  const isUser = !!req.session.user;
  const isGuest = !!req.session.guest;
  if (!isUser && !isGuest) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  // Determine the “username” string for the liker
  const username = isUser
    ? req.session.user.username
    : req.session.guest.guestId;

  try {
    let thread, likedFlag;

    if (type === 'comment') {
      thread = await Comments.findOne({ 'comments._id': id });
      if (!thread) return res.status(404).json({ message: 'Comment not found' });

      const comment = thread.comments.id(id);
      if (comment.likes.includes(username)) {
        comment.likes.pull(username);
        likedFlag = false;
      } else {
        comment.likes.push(username);
        likedFlag = true;
      }

    } else if (type === 'reply') {
      thread = await Comment.findOne({ 'comments.replies._id': id });
      if (!thread) return res.status(404).json({ message: 'Reply not found' });

      let replyDoc;
      thread.comments.forEach(c => {
        const r = c.replies.id(id);
        if (r) replyDoc = r;
      });
      if (!replyDoc) return res.status(404).json({ message: 'Reply not found' });

      if (replyDoc.likes.includes(username)) {
        replyDoc.likes.pull(username);
        likedFlag = false;
      } else {
        replyDoc.likes.push(username);
        likedFlag = true;
      }

    } else if (type === 'superReply') {
      // id = "commentId|replyId|superReplyId"
      const [commentId, replyId, superReplyId] = id.split('|');
      thread = await Comment.findOne({ 'comments._id': commentId });
      if (!thread) return res.status(404).json({ message: 'Parent comment not found' });

      const replyDoc = thread.comments.id(commentId).replies.id(replyId);
      if (!replyDoc) return res.status(404).json({ message: 'Parent reply not found' });

      const sr = replyDoc.superReplies.id(superReplyId);
      if (!sr) return res.status(404).json({ message: 'Super-reply not found' });

      if (sr.likes.includes(username)) {
        sr.likes.pull(username);
        likedFlag = false;
      } else {
        sr.likes.push(username);
        likedFlag = true;
      }

    } else {
      return res.status(400).json({ message: 'Invalid type' });
    }

    await thread.save();
    return res.json({ liked: likedFlag });
  }
  catch (err) {
    console.error('Error toggling like:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});




// const OldComments = require('../models/OldCom');

// async function Convert() {
//   try {
//     const allOldComments = await OldComments.find().lean();

//     // 1. Group by postId
//     const grouped = {};
//     allOldComments.forEach(doc => {
//       const postIdStr = doc.postId.toString();
//       if (!grouped[postIdStr]) grouped[postIdStr] = [];
//       grouped[postIdStr].push(doc);
//     });

//     const chunkSize = 50;

//     // 2. Process each group
//     for (const [postIdStr, comments] of Object.entries(grouped)) {
//       const postId = new mongoose.Types.ObjectId(postIdStr);

//       for (let i = 0; i < comments.length; i += chunkSize) {
//         const chunk = comments.slice(i, i + chunkSize);
//         const count = Math.floor(i / chunkSize) + 1;

//         const commentDocs = chunk.map(old => ({
//           body: old.body,
//           author: old.Author,
//           createdAt: new Date(), // or carry from old.createdAt if present
//           replies: (old.subBody || []).map(reply => ({
//             body: reply.content,
//             author: reply.username,
//             createdAt: new Date(),
//             superReplies: []
//           }))
//         }));

//         const thread = new Comments({
//           postId,
//           count,
//           comments: commentDocs
//         });

//         await thread.save();
//         console.log(`Saved thread for post ${postIdStr}, chunk #${count}`);
//       }
//     }

//     console.log("✅ Migration complete.");
//   } catch (err) {
//     console.error("❌ Error during migration:", err);
//   }
// }

















const filePathCache = new Map();

// Function to cache file_path with associated bot token
function cacheFilePath(effectiveFileId, filePath, botToken) {
  filePathCache.set(effectiveFileId, { filePath, timestamp: Date.now(), botToken });
}

// Function to get cached file_path if valid and if the cached botToken matches
function getCachedFilePathWithToken(effectiveFileId, botToken) {
  const cached = filePathCache.get(effectiveFileId);
  if (
    cached &&
    Date.now() - cached.timestamp < 30 * 60 * 1000 && // 30 minutes
    cached.botToken === botToken
  ) {
    return cached.filePath;
  }
  return null; // Cache expired, not found, or token mismatch
}

// Function to fetch a fresh file_path from Telegram using a given bot token
async function fetchFreshFilePath(fileId, botToken) {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    return response.data.result.file_path;
  } catch (error) {
    console.error(`Error fetching file path for ${fileId} with token ${botToken}:`, error);
    return null; // Return null if fetching fails
  }
}

// Function to get file_path (cached or fresh) using effectiveFileId and botToken
async function getFilePathWithToken(effectiveFileId, botToken) {
  let filePath = getCachedFilePathWithToken(effectiveFileId, botToken); // Check cache first
  if (!filePath) {
    filePath = await fetchFreshFilePath(effectiveFileId, botToken); // Fetch fresh if not cached
    if (filePath) {
      cacheFilePath(effectiveFileId, filePath, botToken); // Cache the new file_path with botToken
    }
  }
  return filePath;
}

router.get("/details/:postId", async (req, res) => {
  try {
    // 2. Load post
    const { postId } = req.params;
    let post = await Post.findById(postId).lean();
    if (!post) return res.status(404).render("404", { message: "Post not found" });

    // 3. If no embedded media, fall back to Image collection
    let mediaRecords = post.media;
    let imageData;
    if (!Array.isArray(mediaRecords) || mediaRecords.length === 0) {
      // Fetch images associated with the post
      const images = await Image.find({ postId }).exec();
      imageData = images.map(img => ({
        fileId: img.fileId,
        caption: img.caption,
        src: `/post/images/${img.fileId}` // Endpoint for serving images
      }));
    }
    //If Post Media Detail Present
    else {
      imageData = await Promise.all(mediaRecords.map(async m => {
        let effectiveFileId, chosenBotToken;
        if (m.fileId2) {
          if (Math.random() < 0.5) {
            effectiveFileId = m.fileId;
            chosenBotToken = process.env.TELEGRAM_BOT_TOKEN;
          } else {
            effectiveFileId = m.fileId2;
            chosenBotToken = process.env.TELEGRAM_BOT_TOKEN2;
          }
        } else {
          effectiveFileId = m.fileId;
          chosenBotToken = process.env.TELEGRAM_BOT_TOKEN;
        }

        // fetch current file_path
        let filePath;
        try {
          filePath = await getFilePathWithToken(effectiveFileId, chosenBotToken);
        } catch (err) {
          console.error("getFilePath failed for", effectiveFileId, err);
        }

        // build src: Telegram URL if we got a path, otherwise fallback to local route
        const src = filePath
          ? `https://api.telegram.org/file/bot${chosenBotToken}/${filePath}`
          : `/post/images/${m.fileId}`;

        return {
          fileId: m.fileId,
          fileId2: m.fileId2,
          caption: m.caption,
          src
        };
      }));

    }

   // 4️⃣ User & guest handling
   let user = null;
   let guest = null; // New guest variable

   if (req.session.user) {
     // Logged-in user
     user = await User.findById(req.session.user._id).lean().exec();
   } else if (req.session.guest) {
     // Guest user
     const guestId = req.session.guest.guestId;
     guest = await Guest.findOne({ guestId }).lean();

     if (!guest) {
       // Destroy session if guest doesn't exist
       req.session.destroy();
     } else {
       // Update session with fresh guest data
       req.session.guest = guest;
     }
   }
    // 5. Load author info & badge
    const authorUser = await User.findOne({ username: post.author })
      .select("profilepic rank")
      .lean();
    const badges = {
      Admin: "👑",
      Moderator: "🛡️",
      "Elite Member": "🌟",
      "Gold Member": "✨",
      Fapper: ""
    };

    // 6. Render
    res.setHeader("Cache-Control", "public, max-age=604800");
    res.render("post-details", {
      user,
      guest,
      post: {
        ...post,
        authorpic: authorUser?.profilepic || "anonymous",
        authorbadge: badges[authorUser?.rank] || ""
      },
      media: imageData
    });

  } catch (err) {
    console.error("Error in GET /details/:postId", err);
    res.status(500).render("500", { message: "Internal Server Error" });
  }
});









router.get("/images/:fileId", async (req, res) => {
  const { fileId } = req.params;

  try {
    // 1. Try to find image in database
    let image = await Image.findOne({ fileId });

    // 2. If image doesn't exist at all
    if (!image) {
      return res.status(404).send("Image not found");
    }

    // 3. If image exists but lacks filePath
    if (!image.filePath || image.filePath) {
      console.log(`Fetching filePath for ${fileId} from Telegram...`);
      const response = await axios.get(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
      );

      // 4. Extract and save filePath to DB
      image.filePath = response.data.result.file_path;
      await image.save();
      console.log(`Updated filePath for ${fileId} in database`);
    }

    // 5. Stream using either existing or newly stored filePath
    const imageUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${image.filePath}`;

    // 6. Stream with native HTTPS for better performance
    https.get(imageUrl, (telegramRes) => {
      // Set dynamic Content-Type based on file extension
      const extension = image.filePath.split('.').pop();
      res.setHeader("Content-Type", `image/${extension === 'jpg' ? 'jpeg' : extension}`);

      telegramRes.pipe(res);
    }).on('error', (err) => {
      console.error("Stream error:");
      if (!res.headersSent) res.status(500).send("Failed to fetch image");
    });

  } catch (error) {
    console.error("Error in image retrieval:");

    // Handle specific Telegram API errors
    if (error.response?.data?.description?.includes("file not found")) {
      if (!res.headersSent) res.status(404).send("Image not found on Telegram");
      return;
    }

    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
  }
});

// Save/Unsave User Post
router.post('/save/:postId', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const postId = req.params.postId;
  const userId = req.session.user._id;

  try {
    // 1. Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // 2. Check if post is already saved
    const user = await User.findById(userId);
    const isAlreadySaved = user.saves.includes(postId);

    if (isAlreadySaved) {
      // 3. If already saved, REMOVE the post
      await User.updateOne(
        { _id: userId },
        { $pull: { saves: postId } }
      );
      return res.status(200).json({ message: 'Post unsaved successfully.' });
    } else {
      // 4. If not saved, ADD the post and enforce 4000 limit
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            saves: {
              $each: [postId],
              $slice: -4000 // Keep only the last 4000 entries
            }
          }
        }
      );
      return res.status(200).json({ message: 'Post saved successfully.' });
    }

  } catch (error) {
    console.error("Error in Save");
    res.status(500).json({ message: 'Error toggling save', error });
  }
});







module.exports = router;

