// 客户端标识由实测选定,但不同轮次实测里最优客户端会漂移(IOS/ANDROID_VR 各有
// 表现最好的时候,见 docs/youtube-subtitle-investigation.md §1);真值可随时调整,导出名不变。
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
