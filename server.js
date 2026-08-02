const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'sanamxkasam';
const REPO_NAME = 'W2Apk';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

// Helper function for GitHub API Requests
function makeGitHubRequest(pathUrl, method, payload = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: pathUrl,
            method: method,
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN ? GITHUB_TOKEN.trim() : ''}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'MIRRYKAL-App',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json'
            }
        };

        if (payload) {
            options.headers['Content-Length'] = Buffer.byteLength(payload);
        }

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (err) => reject(err));
        if (payload) req.write(payload);
        req.end();
    });
}

// 1. Dispatch Build
app.post('/api/build-app', upload.fields([{ name: 'icon' }, { name: 'zipFile' }]), async (req, res) => {
    try {
        const { appName, mode, htmlContent, webUrl } = req.body;

        if (!GITHUB_TOKEN) {
            return res.status(500).json({ success: false, message: "Missing GITHUB_TOKEN on server." });
        }

        let finalHtml = '<h1>MIRRYKAL Web2App</h1>';
        if (mode === 'html' && htmlContent) {
            finalHtml = htmlContent;
        } else if (mode === 'url' && webUrl) {
            finalHtml = `<!DOCTYPE html><html><head><script>window.location.href="${webUrl}";</script></head><body>Redirecting...</body></html>`;
        }

        const cleanAppName = (appName || 'My_App').replace(/[^a-zA-Z0-9_]/g, '_');
        const payload = JSON.stringify({
            event_type: 'build_apk',
            client_payload: {
                app_name: cleanAppName,
                html_content: finalHtml
            }
        });

        const startTime = new Date().toISOString();
        const response = await makeGitHubRequest(`/repos/${GITHUB_USERNAME}/${REPO_NAME}/dispatches`, 'POST', payload);

        if (response.statusCode === 204) {
            return res.json({
                success: true,
                message: "Build triggered successfully!",
                appName: cleanAppName,
                startTime: startTime
            });
        } else {
            return res.status(500).json({ success: false, message: "Failed to dispatch build event." });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// 2. Poll Build Status & Get Direct APK Link
app.get('/api/check-status', async (req, res) => {
    try {
        const runsResponse = await makeGitHubRequest(`/repos/${GITHUB_USERNAME}/${REPO_NAME}/actions/runs?per_page=1`, 'GET');
        
        if (runsResponse.statusCode !== 200 || !runsResponse.data.workflow_runs || runsResponse.data.workflow_runs.length === 0) {
            return res.json({ status: 'queued', progress: 20, message: 'Waiting for runner instance...' });
        }

        const latestRun = runsResponse.data.workflow_runs[0];
        const runStatus = latestRun.status; // queued, in_progress, completed
        const conclusion = latestRun.conclusion; // success, failure, cancelled

        if (runStatus === 'queued') {
            return res.json({ status: 'queued', progress: 30, message: 'Job queued on GitHub runner...' });
        } else if (runStatus === 'in_progress') {
            return res.json({ status: 'in_progress', progress: 65, message: 'Compiling Java & Assembling Gradle APK...' });
        } else if (runStatus === 'completed') {
            if (conclusion === 'success') {
                // Fetch direct APK from Releases API
                const releasesRes = await makeGitHubRequest(`/repos/${GITHUB_USERNAME}/${REPO_NAME}/releases/latest`, 'GET');
                let downloadUrl = null;

                if (releasesRes.statusCode === 200 && releasesRes.data.assets) {
                    const apkAsset = releasesRes.data.assets.find(a => a.name.endsWith('.apk'));
                    if (apkAsset) downloadUrl = apkAsset.browser_download_url;
                }

                return res.json({
                    status: 'completed',
                    conclusion: 'success',
                    progress: 100,
                    message: 'Build Complete!',
                    downloadUrl: downloadUrl
                });
            } else {
                return res.json({ status: 'completed', conclusion: 'failure', progress: 100, message: 'Build failed during Gradle execution.' });
            }
        }
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
});

app.listen(PORT, () => console.log(`MIRRYKAL Engine running on port ${PORT}`));
