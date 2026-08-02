const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Render Environment Variables
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'sanamxkasam';
const REPO_NAME = 'W2Apk';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

app.post('/api/build-app', upload.fields([{ name: 'icon' }, { name: 'zipFile' }]), (req, res) => {
    try {
        const { appName, mode, htmlContent, webUrl } = req.body;

        if (!GITHUB_TOKEN) {
            return res.status(500).json({
                success: false,
                message: "Server configuration error: GITHUB_TOKEN is missing."
            });
        }

        let finalHtml = '<h1>MIRRYKAL Web2App</h1>';
        if (mode === 'html' && htmlContent) {
            finalHtml = htmlContent;
        } else if (mode === 'url' && webUrl) {
            finalHtml = `<!DOCTYPE html><html><head><script>window.location.href="${webUrl}";</script></head><body>Redirecting...</body></html>`;
        }

        const payload = JSON.stringify({
            event_type: 'build_apk',
            client_payload: {
                app_name: appName || 'My_App',
                html_content: finalHtml
            }
        });

        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_USERNAME}/${REPO_NAME}/dispatches`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN.trim()}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'MIRRYKAL-App',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const githubReq = https.request(options, (githubRes) => {
            let body = '';
            githubRes.on('data', (chunk) => body += chunk);
            githubRes.on('end', () => {
                if (githubRes.statusCode === 204) {
                    return res.json({
                        success: true,
                        message: "Build triggered successfully! Your APK generation is in progress."
                    });
                } else {
                    return res.status(500).json({
                        success: false,
                        message: `GitHub Trigger Error (${githubRes.statusCode}): ${body}`
                    });
                }
            });
        });

        githubReq.on('error', (err) => {
            return res.status(500).json({
                success: false,
                message: "Server connection error: " + err.message
            });
        });

        githubReq.write(payload);
        githubReq.end();

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error: " + error.message
        });
    }
});

app.listen(PORT, () => console.log(`MIRRYKAL Engine running on port ${PORT}`));
