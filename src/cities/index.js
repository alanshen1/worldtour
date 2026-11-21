// The tour, in flying order. Each city is one file in this folder, loaded only when it is about to be needed.
// To add a city: write src/cities/<id>.js (see new-york.js for the shape of one) and add a line here.
export const CITIES = [
  { id: 'new-york', zh: '纽约', en: 'New York', where: '美国', line: '暮色中的曼哈顿' },
  { id: 'london', zh: '伦敦', en: 'London', where: '英国', line: '泰晤士河上的钟声' },
  { id: 'sydney', zh: '悉尼', en: 'Sydney', where: '澳大利亚', line: '海港、白帆与铁桥' },
  { id: 'beijing', zh: '北京', en: 'Beijing', where: '中国', line: '晨光里的紫禁城' },
  { id: 'tokyo', zh: '东京', en: 'Tokyo', where: '日本', line: '霓虹不夜城' },
  { id: 'moscow', zh: '莫斯科', en: 'Moscow', where: '俄罗斯', line: '雪中的红场' },
  { id: 'san-francisco', zh: '旧金山', en: 'San Francisco', where: '美国', line: '穿过雾中的金门' },
  { id: 'paris', zh: '巴黎', en: 'Paris', where: '法国', line: '塞纳河畔的蓝调时刻' },
  { id: 'hawaii', zh: '夏威夷', en: 'Hawaii', where: '美国', line: '火山、棕榈与碧海' },
  { id: 'melbourne', zh: '墨尔本', en: 'Melbourne', where: '澳大利亚', line: '亚拉河畔的电车之城' },
  { id: 'new-zealand', zh: '新西兰', en: 'New Zealand', where: '南阿尔卑斯', line: '雪山、湖泊与羊群' },
  { id: 'norway', zh: '挪威', en: 'Norway', where: '罗弗敦群岛', line: '峡湾上空的极光' },
  { id: 'spain', zh: '西班牙', en: 'Spain', where: '巴塞罗那', line: '高迪的午后' },
  { id: 'washington', zh: '华盛顿', en: 'Washington, D.C.', where: '美国', line: '樱花季的国家广场' },
  { id: 'shanghai', zh: '上海', en: 'Shanghai', where: '中国', line: '外滩对岸的陆家嘴' },
  { id: 'fukuoka', zh: '福冈', en: 'Fukuoka', where: '日本', line: '博多湾的黄昏与屋台' },
  { id: 'korea', zh: '韩国', en: 'Seoul', where: '首尔', line: '南山秋色与汉江' },
];
export const loadCity = (id) => import(`./${id}.js`).then((m) => m.default);
