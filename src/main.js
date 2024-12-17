import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import axios from 'axios';
import { fileURLToPath } from 'url';

function formatToISO(date) {
    return date.toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d{3}Z/, '');
}

async function delayTime(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTelegramMessage(token, chatId, message) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const data = {
        chat_id: chatId,
        text: message
    };
    try {
        await axios.post(url, data);
        console.log('消息已发送到 Telegram');
    } catch (error) {
        console.error('Telegram 消息发送失败');
    }
}

(async () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const accounts = JSON.parse(fs.readFileSync(path.join(__dirname, '../accounts.json'), 'utf-8'));
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    const panelBaseUrl = "panel"; // 基础域名前缀
    const panelDomain = "serv00.com"; // 你的主域名，例如 "serv00.com"

    for (const account of accounts) {
        const { username, password, panelnum } = account;

        // 拼接 panel 地址
        const panel = `${panelBaseUrl}${panelnum}.${panelDomain}`;
        const url = `https://${panel}/login/?next=/`;

        console.log(`尝试登录账号 ${username}，地址: ${url}`);

        const browser = await puppeteer.launch({
            headless: true, // 使用无头模式
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        try {
            await page.goto(url, { waitUntil: 'networkidle2' });

            // 填写账号和密码
            await page.type('#id_username', username);
            await page.type('#id_password', password);

            const loginButton = await page.$('#submit');
            if (loginButton) {
                await loginButton.click();
            } else {
                throw new Error('无法找到登录按钮');
            }

            await page.waitForNavigation({ waitUntil: 'networkidle2' });

            // 检查是否登录成功
            const isLoggedIn = await page.evaluate(() => {
                return document.querySelector('a[href="/logout/"]') !== null;
            });

            const nowUtc = formatToISO(new Date());
            const nowBeijing = formatToISO(new Date(new Date().getTime() + 8 * 60 * 60 * 1000)); // 北京时间

            if (isLoggedIn) {
                console.log(`账号 ${username} 于北京时间 ${nowBeijing} 登录成功`);
                if (telegramToken && telegramChatId) {
                    await sendTelegramMessage(telegramToken, telegramChatId, `账号 ${username} 于北京时间 ${nowBeijing} 登录成功！`);
                }
            } else {
                throw new Error('登录失败，未找到退出按钮');
            }
        } catch (error) {
            console.error(`账号 ${username} 登录时出现错误: ${error.message}`);
            if (telegramToken && telegramChatId) {
                await sendTelegramMessage(telegramToken, telegramChatId, `账号 ${username} 登录失败: ${error.message}`);
            }
        } finally {
            await browser.close();
            const delay = Math.floor(Math.random() * 5000) + 1000; // 随机延时1-5秒
            await delayTime(delay);
        }
    }
    console.log('所有账号登录完成！');
})();
