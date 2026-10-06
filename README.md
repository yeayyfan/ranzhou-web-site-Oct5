# 染舟 RANZHOU 官网

由 GitHub 仓库 `yeayyfan/Rz` 自动发布到 Cloudflare Workers（Worker 名称 `rz`，网址 ranzhou.com）的静态网站（中文 `/`，英文 `/en/`），介绍 RZ Titan、RZ Spider、RZ Radar 三款产品。

## 文件

| 文件 | 作用 |
| --- | --- |
| `site/` | 网站本体：首页 `site/index.html`，英文版 `site/en/`，图片和视频在 `site/media/` |
| `wrangler.jsonc` | Cloudflare 配置：只把 `site/` 发布成网站，找不到的页面显示本站的 404 页 |
| `worker.js` | 让 iPhone、iPad 和 Mac 上的 Safari（以及微信等 iPhone 上的所有浏览器）能播放视频：这些浏览器要求服务器支持“分段请求”，Cloudflare 的静态资源服务不支持，由它补上。只处理视频请求 |
| `README.md` | 本说明（不会发布到网站上） |

## 更新网站（每次步骤都一样）

**只往 `yeayyfan/Rz` 这个仓库里提交，不要新建仓库。** ranzhou.com 只跟这个仓库连着，新建的仓库不会改变网站。

用 GitHub Desktop（免费，https://desktop.github.com ）操作，登录有这个仓库写权限的 GitHub 账号：`yeayyfan` 本人，
或者先由 `yeayyfan` 在仓库 **Settings → Collaborators → Add people** 里把你的账号加进来。
网页上传一次最多 100 个文件，而网站有 148 个文件（`site/media` 一个文件夹就有 113 个），所以不要用网页上传。

**第一次（只做一次）：把仓库下载到电脑**

1. 打开 GitHub Desktop，菜单 **File → Clone Repository…**
2. 在 **GitHub.com** 标签页里选 `yeayyfan/Rz`，点 **Clone**。

**每次更新**

1. 双击新的部署压缩包（例如 `ranzhou-web-site-Oct6.zip`）解压，得到四样东西：`site` 文件夹、`README.md`、`worker.js`、`wrangler.jsonc`。
2. 在 GitHub Desktop 左上角 **Current Repository** 选 `Rz`，再点菜单 **Repository → Show in Finder**，打开仓库文件夹。
3. 在这个文件夹里按 **⌘A** 全选，删除（隐藏的 `.git` 文件夹不会被选中，不用担心），再把解压出来的四样东西拖进来。
4. 回到 GitHub Desktop：左侧会列出改动的文件。左下角 **Summary** 填一句说明（例如“网站更新 10-06”），点 **Commit to main**，再点上方的 **Push origin**。
5. 等 1–3 分钟，在 https://github.com/yeayyfan/Rz 看最新提交旁边的小图标：
   黄色圆点是正在发布，绿色 ✓（Workers Builds: rz）就是发布成功，打开 ranzhou.com 刷新即可；红色 ✗ 时点开 Details 看日志。

- 只有 `site/` 里的文件会上线。仓库里的隐藏文件（`.git`、`.assetsignore`）不会发布。
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
