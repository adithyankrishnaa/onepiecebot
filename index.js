import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = '8172383815:AAG37FSq_wkyxb6qhNPpD4-SDG5XhmvOsIg'; // Replace with your actual bot token
const ADMIN_ID = '1942169446'; // Replace with your Telegram user ID

const bot = new TelegramBot(TOKEN, { polling: true });

const DB_PATH = path.join(__dirname, 'database.json');
const VIDEO_DIR = path.join(__dirname, 'videos');

// Ensure the videos folder exists
if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR);
}

// Load database or initialize
let db = { users: [], videos: [] }; // Default structure

try {
  if (fs.existsSync(DB_PATH)) {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    if (data) {
      db = JSON.parse(data);
    }
  }
} catch (err) {
  console.error('Failed to read or parse the database file:', err);
}

// Save database function
const saveDB = () => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

// Helper: Extract episode number
const extractEpisode = (filename) => {
  const match = filename.match(/(?:episode|ep|(\d+))/i);
  return match ? parseInt(match[1] || match[0], 10) : null;
};

// Welcome message function
const welcomeMessage = `👋 Welcome to the One Piece Video Bot!\n\n` +
  `🤖 You can request videos by name or episode number.\n` +
  `📹 To upload videos as an admin, please send them directly to me.`;

// Track users
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!db.users.includes(chatId)) {
    db.users.push(chatId);
    saveDB();
  }
  bot.sendMessage(chatId, welcomeMessage);
});

// Admin: Get total users
bot.onText(/\/total/, async (msg) => {
  const chatId = msg.chat.id;
  if (chatId.toString() === ADMIN_ID) {
    return bot.sendMessage(chatId, `Total Users: ${db.users.length}`);
  }
});

// Function to save video
const saveVideo = async (fileId, fileName) => {
  const episode = extractEpisode(fileName);
  const newFileName = episode ? `One Piece Episode ${episode}.mp4` : `One Piece ${fileName}`;
  const localPath = path.join(VIDEO_DIR, newFileName);

  // Save the video file
  const filePath = await bot.getFileLink(fileId);
  const response = await fetch(filePath);
  const buffer = await response.buffer();
  fs.writeFileSync(localPath, buffer);

  return { fileId, name: newFileName, episode };
};

// Function to handle video uploads
const handleVideoUpload = async (msg) => {
  const chatId = msg.chat.id;
  let fileId, fileName;

  if (msg.video) {
    fileId = msg.video.file_id;
    fileName = msg.video.file_name || `video_${fileId}.mp4`;
  } else if (msg.document) {
    fileId = msg.document.file_id;
    fileName = msg.document.file_name || `document_${fileId}.mp4`;
  }

  try {
    const videoDetails = await saveVideo(fileId, fileName);
    db.videos.push(videoDetails);
    saveDB();
    bot.sendMessage(chatId, `✅ Uploaded: ${videoDetails.name}`);
  } catch (err) {
    console.error('Upload failed:', err);
    bot.sendMessage(chatId, '❌ Failed to upload video.');
  }
};

// Admin: Upload video or document
bot.on(['video', 'document'], async (msg) => {
  const chatId = msg.chat.id;
  if (chatId.toString() === ADMIN_ID) {
    await handleVideoUpload(msg);
  }
});

// User: Request video by name
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  // Check for requests in the format of "filename.mp4"
  const requestedVideoName = msg.text.trim();
  const video = db.videos.find((v) => v.name === requestedVideoName);

  if (video) {
    return bot.sendVideo(chatId, video.fileId); // Send the video if found in the database
  }

  // User: Request episode by number
  const episodeRequest = msg.text?.match(/onepiece episode (\d+)/i);
  if (episodeRequest) {
    const requestedEpisode = parseInt(episodeRequest[1], 10);
    const videoByEpisode = db.videos.find((v) => v.episode === requestedEpisode);

    if (videoByEpisode) {
      return bot.sendVideo(chatId, videoByEpisode.fileId); // Use file_id to send the video
    } else {
      return bot.sendMessage(chatId, '⚠️ Episode not found.');
    }
  }
});

console.log('🚀 Bot is running...');
