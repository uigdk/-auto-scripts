const panelBaseUrl = "panel"; // 基础域名前缀
const panelDomain = "example.com"; // 主域名

(async () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const accounts = JSON.parse(fs.readFileSync(path.join(__dirname, '../accounts.json'), 'utf-8'));
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    for (const account of accounts) {
        const { username, password, panelnum } = account;

        // 构建 panel 地址
        const panel = `${panelBaseUrl}${panelnum}.${panelDomain}`;
        let url = `https://${panel}/login/?next=/`;

        // 显示浏览器窗口&使用自定义窗口大小
        const browser = await puppeteer.launch({ 
            headless: true,  // 设置 headless 模式为 true
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // 添加 no-sandbox 选项，解决 GitHub Actions 上的权限问题
        });
        const page = await browser.newPage();

        try {
            console.log(`正在登录账号 ${username}，地址: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2' });

            // 填写登录表单
            await page.type('#id_username', username);
            await page.type('#id_password', password);

            const loginButton = await page.$('#submit');
            if (loginButton) {
                await loginButton.click();
            } else {
                throw new Error('无法找到登录按钮');
            }

            await page.waitForNavigation({ waitUntil: 'networkidle2' });

            const isLoggedIn = await page.evaluate(() => {
                return document.querySelector('a[href="/logout/"]') !== null;
            });

            const nowUtc = formatToISO(new Date());
            const nowBeijing = formatToISO(new Date(new Date().getTime() + 8 * 60 * 60 * 1000)); // 北京时间

            if (isLoggedIn) {
                console.log(`账号 ${username} 于北京时间 ${nowBeijing} 登录成功`);
                if (telegramToken && telegramChatId) {
                    await sendTelegramMessage(telegramToken, telegramChatId, `账号 ${username} 登录成功！`);
                }
            } else {
                throw new Error('登录失败，未找到退出按钮');
            }
        } catch (error) {
            console.error(`账号 ${username} 登录时出现错误: ${error.message}`);
            if (telegramToken && telegramChatId) {
                await sendTelegramMessage(telegramToken, telegramChatId, `账号 ${username} 登录时出现错误: ${error.message}`);
            }
        } finally {
            await browser.close();
            const delay = Math.floor(Math.random() * 5000) + 1000; // 随机延时1-5秒
            await delayTime(delay);
        }
    }
    console.log('所有账号登录完成！');
})();
