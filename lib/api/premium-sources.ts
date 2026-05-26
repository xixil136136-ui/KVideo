import type { VideoSource } from '@/lib/types';

/**
 * Premium video sources - Higher quality, more reliable sources
 * These are available to users with the premium password
 */
export const PREMIUM_SOURCES: VideoSource[] = [
  // ====== Premium CMS API Sources ======
  {
    id: 'ffzy1',
    name: '非凡资源站',
    baseUrl: 'http://ffzy1.tv/api.php/provide/vod/',
    searchPath: '/?ac=videolist&wd={keyword}&pg={page}',
    detailPath: '/?ac=detail&ids={id}',
    priority: 1,
    group: 'premium',
    enabled: true,
  },
  {
    id: 'snzy_premium',
    name: '索尼高清',
    baseUrl: 'https://suoniapi.com/api.php/provide/vod/',
    searchPath: '/?ac=videolist&wd={keyword}&pg={page}',
    detailPath: '/?ac=detail&ids={id}',
    priority: 2,
    group: 'premium',
    enabled: true,
  },
  {
    id: 'feisu_premium',
    name: '飞速精选',
    baseUrl: 'https://www.feisuzyapi.com/api.php/provide/vod/',
    searchPath: '/?ac=videolist&wd={keyword}&pg={page}',
    detailPath: '/?ac=detail&ids={id}',
    priority: 3,
    group: 'premium',
    enabled: true,
  },
  {
    id: 'taopian_premium',
    name: '淘片精选',
    baseUrl: 'https://taopianapi.com/cjapi/mc/vod/json.html',
    searchPath: '?ac=videolist&wd={keyword}&pg={page}',
    detailPath: '?ac=detail&ids={id}',
    priority: 4,
    group: 'premium',
    enabled: true,
  },
  {
    id: 'baidu_premium',
    name: '百度资源VIP',
    baseUrl: 'https://api.apibdzy.com/api.php/provide/vod/',
    searchPath: '/?ac=videolist&wd={keyword}&pg={page}',
    detailPath: '/?ac=detail&ids={id}',
    priority: 5,
    group: 'premium',
    enabled: true,
  },
  // Ad-free high quality sources
  {
    id: 'kuaiche_premium',
    name: '快车VIP',
    baseUrl: 'https://kuaichezy.com/api.php/provide/vod/',
    searchPath: '/?ac=videolist&wd={keyword}&pg={page}',
    detailPath: '/?ac=detail&ids={id}',
    priority: 6,
    group: 'premium',
    enabled: true,
  },
  {
    id: 'wolong_premium',
    name: '卧龙精选',
    baseUrl: 'https://wolongzy.com/api.php/provide/vod/',
    searchPath: '/?ac=videolist&wd={keyword}&pg={page}',
    detailPath: '/?ac=detail&ids={id}',
    priority: 7,
    group: 'premium',
    enabled: true,
  },
];
