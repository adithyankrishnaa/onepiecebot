// Install required packages: npm install node-telegram-bot-api fs

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const TOKEN = '8172383815:AAG37FSq_wkyxb6qhNPpD4-SDG5XhmvOsIg'; // Replace with your bot token
const ADMIN_ID = '1942169446'; // Replace with your Telegram user ID

const bot = new TelegramBot(TOKEN, { polling: true });

const DB_PATH = './database.json';

// Load database or initialize
let db = fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH)) : { users: [], videos: [] };

// Save database function
const saveDB = () => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

// Helper: Extract episode number
const extractEpisode = (filename) => {
  const match = filename.match(/episode (\d+)/i);
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
    bot.getFile(fileId).then((file) => {
      const filePath = file.file_path;
      const fileName = path.basename(filePath);
      const localPath = `./videos/${fileName}`;

      bot.downloadFile(fileId, './videos').then(() => {
        const episode = extractEpisode(fileName);

        if (episode) {
          db.videos.push({ name: fileName, path: localPath, episode });
          saveDB();
          bot.sendMessage(chatId, `Uploaded: ${fileName}`);
        } else {
          bot.sendMessage(chatId, 'Episode number not found in filename.');
        }
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
