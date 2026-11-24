// The tour, in flying order. Each city is one file in this folder, loaded only when it is about to be needed.
// To add a city: write src/cities/<id>.js (see new-york.js for the shape of one) and add a line here.
// A city whose file is missing or fails to build is skipped, and the tour flies on to the one after it.
// Cities without Google 3D coverage (Beijing, Shanghai, Seoul, Moscow, Dubai, Istanbul) were replaced by covered ones.
export const CITIES = [
  { id: 'new-york', zh: '纽约', en: 'New York', where: '美国', line: '暮色中的曼哈顿' },
  { id: 'london', zh: '伦敦', en: 'London', where: '英国', line: '泰晤士河上的钟声' },
  { id: 'sydney', zh: '悉尼', en: 'Sydney', where: '澳大利亚', line: '海港、白帆与铁桥' },
  { id: 'taipei', zh: '台北', en: 'Taipei', where: '中国台湾', line: '一〇一大楼与信义区' },
  { id: 'tokyo', zh: '东京', en: 'Tokyo', where: '日本', line: '东京塔与彩虹桥' },
  { id: 'rome', zh: '罗马', en: 'Rome', where: '意大利', line: '斗兽场与台伯河' },
  { id: 'san-francisco', zh: '旧金山', en: 'San Francisco', where: '美国', line: '穿过雾中的金门' },
  { id: 'paris', zh: '巴黎', en: 'Paris', where: '法国', line: '埃菲尔铁塔与塞纳河' },
  { id: 'honolulu', zh: '檀香山', en: 'Honolulu', where: '美国 · 夏威夷', line: '钻石头山下的威基基' },
  { id: 'melbourne', zh: '墨尔本', en: 'Melbourne', where: '澳大利亚', line: '亚拉河畔的电车之城' },
  { id: 'auckland', zh: '奥克兰', en: 'Auckland', where: '新西兰', line: '天空塔与千帆之城' },
  { id: 'oslo', zh: '奥斯陆', en: 'Oslo', where: '挪威', line: '歌剧院与峡湾' },
  { id: 'barcelona', zh: '巴塞罗那', en: 'Barcelona', where: '西班牙', line: '高迪的午后' },
  { id: 'washington', zh: '华盛顿', en: 'Washington, D.C.', where: '美国', line: '樱花季的国家广场' },
  { id: 'chicago', zh: '芝加哥', en: 'Chicago', where: '美国', line: '芝加哥河上的高楼峡谷' },
  { id: 'fukuoka', zh: '福冈', en: 'Fukuoka', where: '日本', line: '福冈塔与那珂川' },
  { id: 'kuala-lumpur', zh: '吉隆坡', en: 'Kuala Lumpur', where: '马来西亚', line: '双子塔下' },
  { id: 'hong-kong', zh: '香港', en: 'Hong Kong', where: '中国', line: '维多利亚港两岸' },
  { id: 'cape-town', zh: '开普敦', en: 'Cape Town', where: '南非', line: '桌山脚下的港湾' },
  { id: 'rio', zh: '里约热内卢', en: 'Rio de Janeiro', where: '巴西', line: '基督像下的海湾' },
  { id: 'vancouver', zh: '温哥华', en: 'Vancouver', where: '加拿大', line: '雪山与海港之间' },
  { id: 'budapest', zh: '布达佩斯', en: 'Budapest', where: '匈牙利', line: '多瑙河畔的国会大厦' },
  { id: 'singapore', zh: '新加坡', en: 'Singapore', where: '新加坡', line: '滨海湾金沙与超级树' },
];
export const loadCity = (id) => import(`./${id}.js`).then((m) => m.default);
