# 世界巡游 World Tour

一场不用操作的飞行：镜头自动飞过一座城市，尽头是一道传送门，门里就是下一座城市——穿过去，继续飞。

纽约 → 伦敦 → 悉尼 → 台北 → 东京 → 罗马 → 旧金山 → 巴黎 → 檀香山 → 墨尔本 → 奥克兰 → 奥斯陆 → 巴塞罗那 → 华盛顿 → 芝加哥 → 福冈 → 京都 → 香港 → 开普敦 → 里约热内卢 → 温哥华 → 布达佩斯 → 新加坡 → 回到纽约，循环往复。

灵感来自 Ethan Mollick 的 [Portals](https://github.com/emollick/ai-portals)。本仓库没有使用它的代码，是按同样的思路从零写的一个小引擎。

- **真实的城市。** 城市画面来自 [Google 写实 3D 瓦片](https://developers.google.com/maps/documentation/tile/3d-tiles)（航拍建模），镜头沿着真实街道和地标飞行。画面都是白天的航拍照片。Google 在北京、上海、首尔、莫斯科、迪拜、伊斯坦布尔、吉隆坡没有 3D 建筑，所以巡游换成了有覆盖的城市。
- **两个世界同时在跑。** 屏幕上的城市和传送门后面的城市都在实时渲染，所以穿门时没有切换、没有淡入淡出。
- **纯静态网站。** 唯一的依赖是 [three.js](https://threejs.org)（已放在 `vendor/` 里），不需要安装或构建任何东西。

## 运行

需要 [Node](https://nodejs.org) 18 以上，仅用来在本机起一个静态文件服务器：

```
npm start
```

然后打开 http://localhost:8000 。也可以用任何静态服务器（比如 `python3 -m http.server`），或者直接部署到 GitHub Pages：仓库 Settings → Pages → Deploy from a branch → `main` / root。

在地址后加 `#tokyo` 之类可以直接从某座城市出发。

## 访问 token

实景城市需要下面两种 token 之一，打开网站时会弹出输入框让你填。它只保存在这台设备的浏览器里，不会进入代码仓库；也可以在网址后加 `?key=...`。

**Cesium ion（推荐，免费）**：在 [ion.cesium.com](https://ion.cesium.com) 用邮箱注册免费账号，不用信用卡。打开 Access Tokens 页面，复制默认 token（以 `eyJ` 开头）。Google 的写实 3D 瓦片已包含在 ion 账号里，免费账号每月有 1000 次根瓦片额度，限个人非商业用途；每进入一座城市大约用掉一次。

**Google Map Tiles API key**：在 Google Cloud Console 开通 Map Tiles API 和结算，新建 key（以 `AIza` 开头），并在“应用限制”里只允许你自己的网址使用。Google 按请求量计费，有每月免费额度，以 Google 当前公布的价格为准。

画面里会显示 Google 和数据提供方的署名，这是 Google 的使用条款要求的，请不要去掉。

这个页面不能在 claude.ai 的预览里看：那里的安全策略会拦截对 Google 的请求。请用下面的方法在本机运行，或者部署到 GitHub Pages。

## 操作

| 按键 | 作用 |
|---|---|
| 空格 | 暂停 |
| → | 快进到下一道传送门 |
| I | 城市列表，点一座城市就飞过去 |
| M | 画面模式：Google 实景航拍（默认） / 矢量精模（需要 Cesium ion token）。选过一次后会记住 |
| S | 声音开关（默认关闭） |
| F | 全屏 |

移动鼠标，屏幕下方会出现同样功能的按钮和速度滑块。

## 目录

```
index.html            页面
src/main.js           引擎：飞行、传送门、界面
src/tiles.js          实景城市：加载 Google 3D 瓦片、经纬度换算、等待加载、防撞抬升
src/kit.js            搭城市用的公共积木：天空、水面、楼群、树、灯光、桥、招牌……
src/cities/index.js   城市列表与顺序
src/cities/*.js       每座城市一个文件
src/ui.css            样式
vendor/three          three.js
tools/serve.mjs       本机静态服务器
tools/shot.mjs        给某座城市沿途截图，用来检查效果
```

## 原理

**一座城市**是 `src/cities` 里的一个文件。实景城市导出 `{ kind: 'tiles', lat, lon, path, focus, duration, look }`：`path` 是镜头依次经过的一串 `[纬度, 经度, 离地高度]`，`focus` 是沿途要转头去看的地标，`look` 设定天空、雾和色调。写法见 `src/cities/new-york.js`。没有 3D 覆盖的城市仍用老办法：导出一个带 `build()` 的对象，用 `kit.js` 搭出场景。

真实建筑的高度没法事先精确知道，所以引擎每隔几帧向下打一条射线，离屋顶太近就把镜头平滑抬高，快到传送门时再收回。

**传送门**立在飞行路线的终点。每一帧先用第二台相机把下一座城市画满整个画面，再清掉深度、画当前城市；传送门的圆面只写深度不写颜色，于是当前城市在那里被“挖”出一个洞，露出后面的下一座城市。第二台相机的位置由“镜头相对传送门的位置”换算到“下一座城市的入口”得到，所以镜头穿过圆面的那一刻，两边画面完全重合，直接换场即可。

下一座城市在刚穿过上一道门之后就开始加载和搭建，并提前编译好着色器；如果飞到门前还没准备好，飞行会减速等一等。

## 添加一座城市

1. 照着 `src/cities/new-york.js` 写一个 `src/cities/<id>.js`。
2. 在 `src/cities/index.js` 的列表里加一行。
3. 用 `node tools/shot.mjs <id> shots --overview` 沿途截图检查（需要 Playwright 和 Chromium；实景城市要能访问 Google 瓦片服务）。
   - 这样拍到的是排航线用的素图（60° 广角、原始航线高度、没有后期）。加 `--live` 才是访客看到的画面（46° 镜头、抬高后的航线、屋顶净空、后期锐化），改动飞行观感后用它验收。
   - 加 `--mode osm` 拍矢量精模（Cesium 地形 + OSM 建筑 + 地标模型，需要 Cesium ion token）；城市若回退成了 Google 瓦片，截图会报 `[wrong mode]` 并以非零退出。

## 许可

three.js 和 3d-tiles-renderer 使用各自的许可，见 `vendor/three/LICENSE` 和 `vendor/3d-tiles-renderer/LICENSE`。3D 瓦片的内容归 Google 及其数据提供方所有，按 Google Maps Platform 的条款使用。
