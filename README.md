# 染舟 RANZHOU 官网

由 GitHub 仓库自动发布到 Cloudflare Workers 的静态网站（中文 `/`，英文 `/en/`），介绍 RZ Titan、RZ Spider、RZ Radar 三款产品。

## 文件

| 文件 | 作用 |
| --- | --- |
| `site/` | 网站本体：首页 `site/index.html`，英文版 `site/en/`，图片和视频在 `site/media/` |
| `wrangler.jsonc` | Cloudflare 配置：只把 `site/` 发布成网站，找不到的页面显示本站的 404 页 |
| `worker.js` | 让 iPhone、iPad 和 Mac 上的 Safari（以及微信等 iPhone 上的所有浏览器）能播放视频：这些浏览器要求服务器支持“分段请求”，Cloudflare 的静态资源服务不支持，由它补上。只处理视频请求 |
| `README.md` | 本说明（不会发布到网站上） |

## 发布与更新

1. 把部署压缩包解压后的全部内容（`site/`、`wrangler.jsonc`、`worker.js`、`README.md`）放到仓库根目录，提交到 `main` 分支。
   以后更新时，用新的 `site/` 文件夹整个替换旧的。
2. Cloudflare Workers（Worker 名称 `rz`）会自动构建发布，提交记录旁的 “Workers Builds: rz” 变绿就是发布成功。

- 只有 `site/` 里的文件会上线。仓库里的其他文件（隐藏的 `.git` 文件夹、旧版网站的 `about.html`、`css/` 等）都不会发布，删不删都不影响网站。
- 整个网站约 19 MB，最大的文件约 8 MB；Cloudflare 免费版的限制是单个文件不超过 25 MiB。
- 只有视频请求会经过 `worker.js`（`wrangler.jsonc` 的 `run_worker_first` 列出了网站里全部视频的路径，打包时自动生成）；页面、图片等其他文件直接由静态资源服务返回。
- 改了 Worker 名称时，`wrangler.jsonc` 里的 `name` 要一起改。

## 本地查看

双击 `site/index.html` 即可浏览（Chrome 以本地文件打开时不加载网页字体，会显示系统字体，属正常现象）；
更接近线上效果：在 `site` 文件夹里运行 `python3 -m http.server 8000`，再打开 http://localhost:8000/ 。

## 其他托管方式

`site/` 是纯静态网站，所有链接都是相对路径，可以直接放到任何静态托管（阿里云 OSS、腾讯云 COS、Nginx、Netlify、Vercel 等）。
改用 GitHub Pages 时，把 `site` 文件夹改名为 `docs`，在仓库 Settings → Pages 选择 `main` 分支的 `/docs` 目录。

网站由 `ranzhou-web` 源码项目生成（文字在 `src/content/*.json`，图片视频在 `public/`）。
在源码目录运行 `npm run zip`（或 `node build.mjs --strict --zip ranzhou-web-site.zip`）得到新的部署压缩包。
