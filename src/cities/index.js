// The tour, in flying order. Each city is one file in this folder, loaded only when it is about to be needed.
// To add a city: write src/cities/<id>.js (see new-york.js for the shape of one) and add a line here.
// A city whose file is missing or fails to build is skipped, and the tour flies on to the one after it.
export const CITIES = [
  { id: 'new-york', zh: '纽约', en: 'New York', where: '美国', line: '暮色中的曼哈顿' },
  { id: 'london', zh: '伦敦', en: 'London', where: '英国', line: '泰晤士河上的钟声' },
  { id: 'sydney', zh: '悉尼', en: 'Sydney', where: '澳大利亚', line: '海港、白帆与铁桥' },
  { id: 'beijing', zh: '北京', en: 'Beijing', where: '中国', line: '晨光里的紫禁城' },
  { id: 'tokyo', zh: '东京', en: 'Tokyo', where: '日本', line: '霓虹不夜城' },
  { id: 'moscow', zh: '莫斯科', en: 'Moscow', where: '俄罗斯', line: '雪中的红场' },
  { id: 'san-francisco', zh: '旧金山', en: 'San Francisco', where: '美国', line: '穿过雾中的金门' },
  { id: 'paris', zh: '巴黎', en: 'Paris', where: '法国', line: '塞纳河畔的蓝调时刻' },
  { id: 'hawaii', zh: '檀香山', en: 'Honolulu', where: '美国 · 夏威夷', line: '钻石头山下的威基基' },
  { id: 'melbourne', zh: '墨尔本', en: 'Melbourne', where: '澳大利亚', line: '亚拉河畔的电车之城' },
  { id: 'auckland', zh: '奥克兰', en: 'Auckland', where: '新西兰', line: '天空塔与千帆之城' },
  { id: 'oslo', zh: '奥斯陆', en: 'Oslo', where: '挪威', line: '峡湾边的冬夜' },
  { id: 'barcelona', zh: '巴塞罗那', en: 'Barcelona', where: '西班牙', line: '高迪的午后' },
  { id: 'washington', zh: '华盛顿', en: 'Washington, D.C.', where: '美国', line: '樱花季的国家广场' },
  { id: 'shanghai', zh: '上海', en: 'Shanghai', where: '中国', line: '外滩对岸的陆家嘴' },
  { id: 'fukuoka', zh: '福冈', en: 'Fukuoka', where: '日本', line: '博多湾的黄昏与屋台' },
  { id: 'korea', zh: '首尔', en: 'Seoul', where: '韩国', line: '南山秋色与汉江' },
  { id: 'hong-kong', zh: '香港', en: 'Hong Kong', where: '中国', line: '维多利亚港的夜色' },
  { id: 'dubai', zh: '迪拜', en: 'Dubai', where: '阿联酋', line: '沙漠中的摩天之城' },
  { id: 'rio', zh: '里约热内卢', en: 'Rio de Janeiro', where: '巴西', line: '基督像下的海湾' },
  { id: 'vancouver', zh: '温哥华', en: 'Vancouver', where: '加拿大', line: '雪山与海港之间' },
  { id: 'istanbul', zh: '伊斯坦布尔', en: 'Istanbul', where: '土耳其', line: '博斯普鲁斯海峡的黄昏' },
  { id: 'singapore', zh: '新加坡', en: 'Singapore', where: '新加坡', line: '滨海湾的超级树' },
];
export const loadCity = (id) => import(`./${id}.js`).then((m) => m.default);
