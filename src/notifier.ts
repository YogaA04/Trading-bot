import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export const sendTelegramMessage = async (message: string): Promise<void> => {
    if (!TOKEN || !CHAT_ID) throw new Error("Token/Chat ID belum diset");
    const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
    await axios.post(url, {
        chat_id: CHAT_ID,
        text: message
    });
}