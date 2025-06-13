const mongoose = require('mongoose');
const { Schema, Types } = mongoose;
const { ObjectId } = Types;

// superReplies: no _id needed
const superReplySchema = new Schema({
  body:       { type: String, required: true },
  author:     { type: String, required: true },
  createdAt:  { type: Date,   default: Date.now },
  likes:      [{ type: String, default: []  }]   // usernames of users who liked this super-reply
}, { _id: false });

// replies: keep _id so you can target it
const replySchema = new Schema({
  body:         { type: String, required: true },
  author:       { type: String, required: true },
  createdAt:    { type: Date,   default: Date.now },
  superReplies: [superReplySchema],
  likes:        [{ type: String, default: [] }]   // usernames of users who liked this reply
});

// comments: keep _id too (default behavior)
const commentSchema = new Schema({
  body:       { type: String, required: true },
  author:     { type: String, required: true },
  createdAt:  { type: Date,   default: Date.now },
  replies:    [replySchema],
  likes:      [{ type: String, default: []  }]   // usernames of users who liked this comment
}, { _id: true });

const commentThreadSchema = new Schema({
  postId:   { type: ObjectId, ref: 'Post', required: true },
  count:    { type: Number, required: true },
  comments: [commentSchema]
}, { timestamps: true });

commentThreadSchema.index({ postId: 1, count: 1 }, { unique: true });

module.exports = mongoose.model('Comment', commentThreadSchema);
