# 世界巡游 World Tour

一场不用操作的飞行：镜头自动飞过一座城市，尽头是一道传送门，门里就是下一座城市——穿过去，继续飞。

纽约 → 伦敦 → 悉尼 → 北京 → 东京 → 莫斯科 → 旧金山 → 巴黎 → 夏威夷 → 墨尔本 → 新西兰 → 挪威 → 西班牙 → 华盛顿 → 上海 → 福冈 → 韩国 → 回到纽约，循环往复。

灵感来自 Ethan Mollick 的 [Portals](https://github.com/emollick/ai-portals)。本仓库没有使用它的代码，是按同样的思路从零写的一个小引擎。

- **全部由代码生成。** 没有 3D 模型、贴图或音频文件，每座城市都是浏览器里现场搭出来的。
- **两个世界同时在跑。** 屏幕上的城市和传送门后面的城市都在实时渲染，所以穿门时没有切换、没有淡入淡出。
- **纯静态网站。** 唯一的依赖是 [three.js](https://threejs.org)（已放在 `vendor/` 里），不需要安装或构建任何东西。

## 运行

需要 [Node](https://nodejs.org) 18 以上，仅用来在本机起一个静态文件服务器：

```
npm start
```

然后打开 http://localhost:8000 。也可以用任何静态服务器（比如 `python3 -m http.server`），或者直接部署到 GitHub Pages：仓库 Settings → Pages → Deploy from a branch → `main` / root。

在地址后加 `#tokyo` 之类可以直接从某座城市出发。

## 操作

| 按键 | 作用 |
|---|---|
| 空格 | 暂停 |
| → | 快进到下一道传送门 |
| I | 城市列表，点一座城市就飞过去 |
| S | 声音开关（默认关闭） |
| F | 全屏 |

移动鼠标，屏幕下方会出现同样功能的按钮和速度滑块。

## 目录

```
index.html            页面
src/main.js           引擎：飞行、传送门、界面
src/kit.js            搭城市用的公共积木：天空、水面、楼群、树、灯光、桥、招牌……
src/cities/index.js   城市列表与顺序
src/cities/*.js       每座城市一个文件
src/ui.css            样式
vendor/three          three.js
tools/serve.mjs       本机静态服务器
tools/shot.mjs        给某座城市沿途截图，用来检查效果
```

## 原理

**一座城市**是 `src/cities` 里的一个文件，默认导出一个带 `build()` 的对象。`build()` 用 `kit.js` 搭好场景，返回 `{ world, path, focus, duration }`：`path` 是镜头依次经过的一串点，`focus` 是沿途要转头去看的地标，`duration` 是飞完全程的秒数。

**传送门**立在飞行路线的终点。每一帧先用第二台相机把下一座城市画满整个画面，再清掉深度、画当前城市；传送门的圆面只写深度不写颜色，于是当前城市在那里被“挖”出一个洞，露出后面的下一座城市。第二台相机的位置由“镜头相对传送门的位置”换算到“下一座城市的入口”得到，所以镜头穿过圆面的那一刻，两边画面完全重合，直接换场即可。

下一座城市在刚穿过上一道门之后就开始加载和搭建，并提前编译好着色器；如果飞到门前还没准备好，飞行会减速等一等。

## 添加一座城市

1. 照着 `src/cities/new-york.js` 写一个 `src/cities/<id>.js`。
2. 在 `src/cities/index.js` 的列表里加一行。
3. 用 `node tools/shot.mjs <id> shots --overview` 沿途截图检查（需要 Playwright 和 Chromium）。

## 许可

three.js 使用 MIT 许可，见 `vendor/three/LICENSE`。
