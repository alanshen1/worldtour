# 世界巡游 World Tour

一场不用操作的飞行：镜头自动飞过一座真实的城市，尽头是一道传送门，门里就是下一座城市——穿过去，继续飞。

纽约 → 伦敦 → 悉尼 → 台北 → 东京 → 罗马 → 旧金山 → 巴黎 → 檀香山 → 墨尔本 → 奥克兰 → 奥斯陆 → 巴塞罗那 → 华盛顿 → 芝加哥 → 福冈 → 京都 → 香港 → 开普敦 → 里约热内卢 → 温哥华 → 布达佩斯 → 新加坡 → 回到纽约，循环往复。

灵感来自 Ethan Mollick 的 [Portals](https://github.com/emollick/ai-portals)。本仓库没有使用它的代码，是按同样的思路从零写的一个小引擎。

- **真实的城市。** 默认画面来自 [Google 写实 3D 瓦片](https://developers.google.com/maps/documentation/tile/3d-tiles)（航拍建模），镜头沿着真实街道和地标飞行，都是白天的航拍照片。Google 在北京、上海、首尔、莫斯科、迪拜、伊斯坦布尔、吉隆坡没有 3D 建筑，所以巡游选的是有覆盖的城市。
- **两种画面模式。** 除了实景航拍，还有矢量精模：真实地形和航拍底图，加上按 OpenStreetMap 轮廓生成的建筑和手工搭的地标模型。按 M 切换，见下文。
- **两个世界同时在跑。** 屏幕上的城市和传送门后面的城市都在实时渲染，所以穿门时没有切换、没有淡入淡出。
- **纯静态网站。** 用到的库只有 [three.js](https://threejs.org) 和 [3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS)，都已放在 `vendor/` 里，不需要安装或构建任何东西。

## 运行

需要 [Node](https://nodejs.org) 18 以上，仅用来在本机起一个静态文件服务器：

```
npm start
```

然后打开 http://localhost:8000 ，在弹出的框里填访问 token（见下一节）。端口被占用时换一个：`PORT=8010 npm start`。

也可以用任何静态服务器（比如 `python3 -m http.server`），或者直接部署到 GitHub Pages：仓库 Settings → Pages → Deploy from a branch → `main` / root。

这个页面不能在 claude.ai 的预览里看：那里的安全策略会拦截对 Google 和 Cesium 的请求。

## 访问 token

城市画面需要下面两种 token 之一，打开网站时会弹出输入框让你填。它只保存在这台设备的浏览器里，不会进入代码仓库；也可以在网址后加 `?key=...`。

**Cesium ion（推荐，免费）**：在 [ion.cesium.com](https://ion.cesium.com) 用邮箱注册免费账号，不用信用卡。打开 Access Tokens 页面，复制默认 token（以 `eyJ` 开头）。Google 的写实 3D 瓦片已包含在 ion 账号里，免费账号每月有 1000 次根瓦片额度，限个人非商业用途；每进入一座城市大约用掉一次。两种画面模式都能用。

**Google Map Tiles API key**：在 Google Cloud Console 开通 Map Tiles API 和结算，新建 key（以 `AIza` 开头），并在“应用限制”里只允许你自己的网址使用。Google 按请求量计费，有每月免费额度，以 Google 当前公布的价格为准。只能用实景航拍模式。

画面里会显示 Google 和数据提供方的署名，这是使用条款要求的，请不要去掉。

## 操作

| 按键 | 作用 |
|---|---|
| 空格 | 暂停 |
| → | 快进到下一道传送门 |
| I | 城市列表，点一座城市就飞过去 |
| M | 切换画面模式：实景航拍 / 矢量精模 |
| S | 声音开关（默认关闭） |
| F | 全屏 |

移动鼠标，屏幕下方会出现同样功能的按钮和速度滑块。

## 画面模式

**实景航拍**（默认）：Google 写实 3D 瓦片，楼、桥、树都是航拍照片建的模，最像真的。低空快速飞行时，高清瓦片有时来不及加载，近处会短暂模糊。

**矢量精模**（需要 Cesium ion token）：Cesium 世界地形 + Bing 航拍底图 + OpenStreetMap 建筑轮廓。建筑由着色器画出玻璃幕墙和石材立面，边缘干净，有实时阴影。下面这些地标换成了手工搭的模型：

| 城市 | 地标 |
|---|---|
| 纽约 | 自由女神像、世贸中心一号楼、布鲁克林大桥、帝国大厦 |
| 台北 | 台北 101、中正纪念堂 |
| 东京 | 东京塔、彩虹桥 |
| 巴黎 | 埃菲尔铁塔、卢浮宫玻璃金字塔 |
| 悉尼 | 歌剧院、海港大桥 |

其他城市在矢量模式下只有地形、底图和 OSM 建筑。某座城市的矢量数据加载失败时，会自动退回实景航拍。

选过一次模式后会记在浏览器里。想用自己的地标模型，把 `.glb` 文件放进 `assets/landmarks/`，再按 `assets/landmarks/manifest.json` 里的说明登记。

## 网址参数

参数写在 `#` 之前，例如 `http://localhost:8000/?debug#taipei`。

| 写法 | 作用 |
|---|---|
| `#tokyo` | 直接从某座城市出发（城市 id 见 `src/cities/index.js`） |
| `?key=...` | 访问 token，等同于在输入框里填 |
| `?mode=google` / `?mode=osm` | 指定画面模式 |
| `?debug` | 左上角显示性能读数：帧时间、每帧各部分耗时、等待中的瓦片、缓存占用。点一下读数框，复制最近 60 秒的数据 |
| `?cache=<MB>` | 瓦片缓存上限，128–4096。不写时按机器内存自动选。缓存满了新瓦片会被拒绝，画面就会一直模糊 |
| `?imagery=<15..21>` | 矢量模式航拍底图的最深层级，默认 19。地面出现灰色“无图像”方块时调低 |

## 目录

```
index.html                页面
src/main.js               引擎：飞行、传送门、画面模式、后期处理、界面
src/tiles.js              实景航拍：加载 Google 3D 瓦片、经纬度换算、缓存与加载队列、屋顶净空
src/osm.js                矢量精模：地形、航拍底图、OSM 建筑和立面着色器
src/landmarks.js          矢量精模的地标模型，以及外部 .glb 模型的加载
src/perf.js               ?debug 性能读数
src/kit.js                公共积木：天空、雾、材质和基本形体
src/cities/index.js       城市列表与顺序
src/cities/*.js           每座城市一个文件：真实经纬度航线和取景点
src/ui.css                样式
assets/landmarks/         自定义地标模型和登记表
vendor/three              three.js 及其 GLTF、Draco 加载器
vendor/3d-tiles-renderer  3D 瓦片渲染库
tools/serve.mjs           本机静态服务器
tools/shot.mjs            给某座城市沿途截图，用来检查效果
HANDOFF.md, handoff/      开发过程记录和各城市的航线笔记
```

## 原理

**一座城市**是 `src/cities` 里的一个文件，导出 `{ kind: 'tiles', lat, lon, path, focus, duration, look }`：`path` 是镜头依次经过的一串 `[纬度, 经度, 离地高度]`，`focus` 是沿途要转头去看的地标，`look` 设定天空、雾和色调。写法见 `src/cities/new-york.js`。两种画面模式共用同一条航线。

**屋顶净空。** 真实建筑的高度没法事先精确知道，所以镜头每飞约 20 米就测一次脚下和前方的屋顶高度，离得太近就平滑抬高，快到传送门时再收回。因为是垂直向下测的，镜头飞不到桥下或悬挑结构下面。

**传送门**立在飞行路线的终点。每一帧先用第二台相机把下一座城市画满整个画面，再清掉深度、画当前城市；传送门的圆面只写深度不写颜色，于是当前城市在那里被“挖”出一个洞，露出后面的下一座城市。第二台相机的位置由“镜头相对传送门的位置”换算到“下一座城市的入口”得到，所以镜头穿过圆面的那一刻，两边画面完全重合，直接换场即可。

**加载。** 进入一座城市约 12 秒后，开始加载下一座城市；按快进或点选城市时立即开始。如果飞到门前还没准备好，飞行会减速等一等。瓦片缓存的大小按机器内存自动选，城市的卸载、着色器预热这类耗时的工作会分摊到多帧里做，减少卡顿。

## 添加一座城市

1. 照着 `src/cities/new-york.js` 写一个 `src/cities/<id>.js`。先确认 Google 在那里有 3D 建筑，没有覆盖的城市只会显示平面卫星图。
2. 在 `src/cities/index.js` 的列表里加一行。
3. 用 `node tools/shot.mjs <id> shots --overview` 沿途截图检查（需要 Playwright 和 Chromium，并且能访问瓦片服务）。
   - 这样拍到的是排航线用的素图（60° 广角、原始航线高度、没有后期）。输出里的 `lift=` 是镜头为避开屋顶被抬高的米数，数值大说明那一段航线太低。
   - 加 `--live` 才是访客看到的画面（46° 镜头、抬高后的航线、屋顶净空、后期锐化），改动飞行观感后用它验收。
   - 加 `--mode osm` 拍矢量精模（需要 Cesium ion token）；城市若退回了实景航拍，截图会报 `[wrong mode]` 并以非零退出。
   - 加 `--next <id>` 检查传送门里的下一座城市。

## 许可

three.js 和 3d-tiles-renderer 使用各自的许可，见 `vendor/three/LICENSE` 和 `vendor/3d-tiles-renderer/LICENSE`。3D 瓦片的内容归 Google 及其数据提供方所有，按 Google Maps Platform 的条款使用；矢量模式的地形、航拍底图和建筑数据来自 Cesium ion、Bing Maps 和 OpenStreetMap 贡献者，按各自的条款使用。
