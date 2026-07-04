// 由实测确认(见 docs/youtube-subtitle-investigation.md)。ANDROID_VR 是 2026 年
// 对无登录态请求最宽松的客户端标识;真值可随 YouTube 漂移调整,导出名不变。
export const INNERTUBE_CLIENT = {
  clientName: 'ANDROID_VR',
  clientVersion: '1.61.48',
  deviceMake: 'Oculus',
  deviceModel: 'Quest 3',
  androidSdkVersion: 32,
  osName: 'Android',
  osVersion: '12L',
  hl: 'en',
  gl: 'US',
} as const;

export const PLAYER_PATH = '/youtubei/v1/player?prettyPrint=false';
export const INNERTUBE_UA = 'com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12L; Quest 3) gzip';
