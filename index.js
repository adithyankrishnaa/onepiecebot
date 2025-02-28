import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = '8172383815:AAG37FSq_wkyxb6qhNPpD4-SDG5XhmvOsIg';
const ADMIN_ID = '1942169446';

const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 3000,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

const DB_PATH = path.join(__dirname, 'database.json');
const VIDEO_DIR = path.join(__dirname, 'videos');

if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR);
}

let db = { users: [], videos: [] };

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

const saveDB = () => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Error saving database:', err);
  }
};

const extractEpisode = (filename) => {
  const match = filename.match(/(?:episode|ep|\b(\d+)\b)/i);
  return match ? parseInt(match[1] || match[0], 10) : null;
};

const welcomeMessage = `👋 Welcome to the One Piece Video Bot!\n\n` +
  `🤖 You can request videos by name or episode number.\n` +
  `📹 To upload videos as an admin, please send them directly to me.`;

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!db.users.includes(chatId)) {
    db.users.push(chatId);
    saveDB();
  }
  bot.sendMessage(chatId, welcomeMessage).catch(console.error);
});

bot.onText(/\/total/, async (msg) => {
  const chatId = msg.chat.id;
  if (chatId.toString() === ADMIN_ID) {
    return bot.sendMessage(chatId, `Total Users: ${db.users.length}`).catch(console.error);
  }
});

const saveVideo = async (fileId, fileName) => {
  const episode = extractEpisode(fileName);
  const fileExtension = path.extname(fileName) || '.mp4';
  const newFileName = episode ? `One Piece Episode ${episode}${fileExtension}` : `One Piece ${fileName}`;
  const localPath = path.join(VIDEO_DIR, newFileName);

  try {
    const filePath = await bot.getFileLink(fileId);
    const response = await fetch(filePath);
    const buffer = await response.buffer();
    fs.writeFileSync(localPath, buffer);
    return { fileId, name: newFileName, episode };
  } catch (err) {
    console.error('Error saving video:', err);
    throw err;
  }
};

const handleVideoUpload = async (msg) => {
  const chatId = msg.chat.id;
  let fileId, fileName;

  if (msg.video) {
    fileId = msg.video.file_id;
    fileName = msg.video.file_name || `video_${fileId}.mp4`;
  } else if (msg.document) {
    fileId = msg.document.file_id;
    fileName = msg.document.file_name || `document_${fileId}${path.extname(msg.document.file_name) || '.mkv'}`;
  }

  try {
    const videoDetails = await saveVideo(fileId, fileName);
    db.videos.push(videoDetails);
    saveDB();
    bot.sendMessage(chatId, `✅ Uploaded: ${videoDetails.name}`).catch(console.error);
  } catch (err) {
    bot.sendMessage(chatId, '❌ Failed to upload video.').catch(console.error);
  }
};

bot.on(['video', 'document'], async (msg) => {
  const chatId = msg.chat.id;
  if (chatId.toString() === ADMIN_ID) {
    await handleVideoUpload(msg);
  }
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const requestedVideoName = msg.text?.trim();
  const video = db.videos.find((v) => v.name === requestedVideoName);

  if (video) {
    return bot.sendDocument(chatId, video.fileId).catch(console.error);
  }

  const episodeRequest = msg.text?.match(/onepiece episode (\d+)/i);
  if (episodeRequest) {
    const requestedEpisode = parseInt(episodeRequest[1], 10);
    const videoByEpisode = db.videos.find((v) => v.episode === requestedEpisode);

    if (videoByEpisode) {
      return bot.sendDocument(chatId, videoByEpisode.fileId).catch(console.error);
    } else {
      return bot.sendMessage(chatId, '⚠️ Episode not found.').catch(console.error);
    }
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🚀 Bot is running...');
