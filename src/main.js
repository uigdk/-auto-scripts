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
    const data = { chat_id: chatId, text: message };
    try {
        await axios.post(url, data);
        console.log('消息已发送到 Telegram');
    } catch (error) {
        console.error('发送 Telegram 消息时出错:', error.message);
    }
}

(async () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const accounts = JSON.parse(fs.readFileSync(path.join(__dirname, '../accounts.json'), 'utf-8'));
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    const panelBaseUrl = "panel"; // panel 基础前缀
    const defaultDomain = "serv00.com"; // 默认主域名

    for (const account of accounts) {
        const { username, password, panelnum, domain } = account;

        // 拼接 panel 地址
        let panel;
        if (domain === "ct8.pl") {
            panel = `panel.${domain}`; // 固定地址 panel.ct8.pl
        } else {
            panel = `${panelBaseUrl}${panelnum}.${domain || defaultDomain}`;
        }

        const url = `https://${panel}/login/?next=/`;
        console.log(`尝试登录账号 ${username}，地址: ${url}`);

        // 启动 Puppeteer
        const browser = await puppeteer.launch({
            headless: true, // 设置为 true 以便在无界面环境运行
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, // 如果有指定路径
        });
        const page = await browser.newPage();

        try {
            await page.goto(url, { waitUntil: 'networkidle2' });

            // 输入账号和密码
            const usernameInput = await page.$('#id_username');
            if (usernameInput) {
                await usernameInput.click({ clickCount: 3 });
                await usernameInput.press('Backspace');
            }
            await page.type('#id_username', username);
            await page.type('#id_password', password);

            // 点击登录按钮
            const loginButton = await page.$('#submit');
            if (loginButton) {
                await loginButton.click();
            } else {
                throw new Error('无法找到登录按钮');
            }

            // 等待页面导航
            await page.waitForNavigation({ waitUntil: 'networkidle2' });

            // 检查是否登录成功
            const isLoggedIn = await page.evaluate(() => {
                return document.querySelector('a[href="/logout/"]') !== null;
            });

            const nowUtc = formatToISO(new Date());
            const nowBeijing = formatToISO(new Date(new Date().getTime() + 8 * 60 * 60 * 1000)); // 北京时间

            if (isLoggedIn) {
                console.log(`账号 ${username} 于北京时间 ${nowBeijing}（UTC时间 ${nowUtc}）登录成功！`);
                if (telegramToken && telegramChatId) {
                    await sendTelegramMessage(telegramToken, telegramChatId, `账号 ${username} 于北京时间 ${nowBeijing}（UTC时间 ${nowUtc}）登录成功！`);
                }
            } else {
                console.error(`账号 ${username} 登录失败，请检查账号和密码是否正确。`);
                if (telegramToken && telegramChatId) {
                    await sendTelegramMessage(telegramToken, telegramChatId, `账号 ${username} 登录失败，请检查账号和密码是否正确。`);
                }
            }
        } catch (error) {
            console.error(`账号 ${username} 登录时出现错误: ${error.message}`);
            if (telegramToken && telegramChatId) {
                await sendTelegramMessage(telegramToken, telegramChatId, `账号 ${username} 登录时出现错误: ${error.message}`);
            }
        } finally {
            await page.close();
            await browser.close();
            const delay = Math.floor(Math.random() * 5000) + 1000; // 随机延时1秒到5秒之间
            await delayTime(delay);
        }
    }
    console.log('所有账号登录完成！');
})();
