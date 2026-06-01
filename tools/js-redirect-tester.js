const puppeteer = require('puppeteer');
const fs = require('fs');
const {
	execSync
} = require('child_process');

const PAYLOAD = "https://evil.com";
let OUTPUT_FILE = "js_redirect_vulnerable.txt";
const WEBHOOK = "https://discord.com/api/webhooks/1508123239732350987/Q-oc7dcydk07KJwnsAJSbTpaVeNxHR6HnVkkpf5Q8kkJqMfQYpbu9ZGEaHx80IKm1oZw";
const WAIT_TIME = 7000;

async function sendToDiscord(url, param) {
	const content = `**🔴 JS REDIRECT VULNERABLE!**\n**URL:** ${url}\n**Parameter:** ${param}\n**Payload:** ${PAYLOAD}`;
	try {
		await fetch(WEBHOOK, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				content
			})
		});
		console.log("     ✅ Webhook Sent!");
	} catch (e) {
		console.log("     ❌ Webhook failed");
	}
}

async function testUrl(baseUrl) {
	console.log(`\n[+] Testing: ${baseUrl}`);

	if (!baseUrl.includes('?')) {
		console.log("   No parameters found.");
		return;
	}

	const browser = await puppeteer.launch({
		headless: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox']
	});

	const page = await browser.newPage();
	await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

	try {
		const urlObj = new URL(baseUrl);
		const params = new URLSearchParams(urlObj.search);
		const paramKeys = Array.from(params.keys());

		for (const key of paramKeys) {
			console.log(`   → Testing parameter: ${key}`);

			const testUrl = new URL(baseUrl);
			testUrl.searchParams.set(key, PAYLOAD);

			console.log(`     Navigating...`);

			await page.goto(testUrl.toString(), {
				waitUntil: 'networkidle2',
				timeout: 15000
			});

			await new Promise(resolve => setTimeout(resolve, WAIT_TIME));

			const currentUrl = page.url();

			let vulnerable = false;

			try {
				const originalHost = new URL(baseUrl).hostname;
				const finalHost = new URL(currentUrl).hostname;

				if (
					finalHost === "evil.com" &&
					finalHost !== originalHost
				) {
					vulnerable = true;
				}
			} catch (e) {
				vulnerable = false;
			}

			if (vulnerable) {
				console.log(`     ✅ JS REDIRECT VULNERABLE!`);
				console.log(`     Final URL: ${currentUrl}`);

				const result =
					`URL: ${testUrl}
✅ JS REDIRECT VULNERABLE!
Final URL: ${currentUrl}
Parameter: ${key}
Payload: ${PAYLOAD}
---
`;

				fs.appendFileSync(OUTPUT_FILE, result);
				await sendToDiscord(testUrl.toString(), key);

			} else {
				console.log(`     Not redirected to evil.com (Current: ${currentUrl})`);
			}
		}
	} catch (err) {
		console.log(`   Error testing ${baseUrl}: ${err.message}`);
	} finally {
		await browser.close();
	}
}

// ====================== MAIN LOGIC ======================
(async () => {
	const args = process.argv.slice(2);

	// Handle -o flag
	const oIndex = args.indexOf('-o');
	if (oIndex !== -1 && args[oIndex + 1]) {
		OUTPUT_FILE = args[oIndex + 1];
	}

	if (args.includes('-u') && args[args.indexOf('-u') + 1]) {
		const url = args[args.indexOf('-u') + 1];
		await testUrl(url);
	} else if (args.includes('-l') && args[args.indexOf('-l') + 1]) {
		const listFile = args[args.indexOf('-l') + 1];

		if (!fs.existsSync(listFile)) {
			console.log(`Error: File ${listFile} not found!`);
			process.exit(1);
		}

		const urls = fs.readFileSync(listFile, 'utf-8').split('\n')
			.map(line => line.trim())
			.filter(line => line !== '');

		for (const url of urls) {
			await testUrl(url);
		}
	} else {
		console.log("Usage:");
		console.log("  node js-redirect-tester.js -u <URL> [-o output.txt]");
		console.log("  node js-redirect-tester.js -l <urls.txt> [-o output.txt]");
	}

	console.log(`\n[+] Testing completed! Results saved to: ${OUTPUT_FILE}`);
})();
