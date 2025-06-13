const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  postId: { type: String, required: true },
  fileId: { type: String, required: true },
  fileId2:{type:String, required:false },
  filePath: { type: String, required: false },
  caption: { type: String },
});

module.exports =mongoose.model('Image', ImageSchema);