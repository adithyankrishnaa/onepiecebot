// Install required packages: npm install node-telegram-bot-api fs

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const TOKEN = '8172383815:AAG37FSq_wkyxb6qhNPpD4-SDG5XhmvOsIg'; // Replace with your bot token
const ADMIN_ID = '1942169446'; // Replace with your Telegram user ID

const bot = new TelegramBot(TOKEN, { polling: true });

const DB_PATH = path.resolve('database.json');
const VIDEO_DIR = path.resolve('videos');

// Ensure the videos folder exists
if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR);
}

// Load database or initialize
let db = fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH)) : { users: [], videos: [] };

// Save database function
const saveDB = () => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

// Helper: Extract episode number
const extractEpisode = (filename) => {
  const match = filename.match(/(?:episode|ep)\.?\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
};

// Track users
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (!db.users.includes(chatId)) {
    db.users.push(chatId);
    saveDB();
  }

  // Admin: Get total users
  if (msg.text === '/total' && chatId.toString() === ADMIN_ID) {
    bot.sendMessage(chatId, `Total Users: ${db.users.length}`);
  }

  // Admin: Upload video
  if (msg.video && chatId.toString() === ADMIN_ID) {
    const fileId = msg.video.file_id;

    // File size check (2GB limit)
    if (msg.video.file_size > 2000000000) {
      return bot.sendMessage(chatId, 'File too large to upload.');
    }

    bot.getFile(fileId).then((file) => {
      const fileName = path.basename(file.file_path);
      const localPath = path.join(VIDEO_DIR, fileName);

      bot.downloadFile(fileId, VIDEO_DIR)
        .then(() => {
          const episode = extractEpisode(fileName);

          if (episode) {
            // Avoid duplicate entries
            if (!db.videos.some((v) => v.episode === episode)) {
              db.videos.push({ name: fileName, path: localPath, episode });
              saveDB();
              bot.sendMessage(chatId, `Uploaded: ${fileName}`);
            } else {
              bot.sendMessage(chatId, `Episode ${episode} already exists.`);
            }
          } else {
            bot.sendMessage(chatId, 'Episode number not found in filename.');
          }
        })
        .catch((err) => {
          console.error('Download failed:', err);
          bot.sendMessage(chatId, 'Failed to download video.');
        });
    });
  }

  // User: Request episode
  const episodeRequest = msg.text?.match(/onepiece episode (\d+)/i);
  if (episodeRequest) {
    const requestedEpisode = parseInt(episodeRequest[1], 10);
    const video = db.videos.find((v) => v.episode === requestedEpisode);

    if (video) {
      bot.sendVideo(chatId, video.path);
    } else {
      bot.sendMessage(chatId, 'Episode not found.');
    }
  }
});

console.log('Bot is running...');
