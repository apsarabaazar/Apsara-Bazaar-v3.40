const mongoose = require("mongoose");

const GuestSchema = new mongoose.Schema({
  name: { type: String, default: "Anonymous" },
  guestId: { type: String, required: true, unique: true }, // sessionID or localStorage ID
  ipAddress: { type: String },
  likes:{type:Array , required:false},
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Guest", GuestSchema);
