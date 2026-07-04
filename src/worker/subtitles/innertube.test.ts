import { describe, it, expect } from 'vitest';
import { parsePlayerResponse, chooseTrack } from './innertube';
import { AppError } from '../errors';

const okJson = {
  playabilityStatus: { status: 'OK' },
  videoDetails: { title: '演示标题', author: '演示作者' },
  captions: {
    playerCaptionsTracklistRenderer: {
      captionTracks: [
        { baseUrl: 'https://x/asr', languageCode: 'en', kind: 'asr' },
        { baseUrl: 'https://x/manual', languageCode: 'en' },
      ],
    },
  },
};

describe('parsePlayerResponse', () => {
  it('提取标题/作者/字幕轨', () => {
    const r = parsePlayerResponse(okJson);
    expect(r.title).toBe('演示标题');
    expect(r.author).toBe('演示作者');
    expect(r.tracks).toHaveLength(2);
  });
  it('playabilityStatus 非 OK → VIDEO_NOT_FOUND', () => {
    expect(() => parsePlayerResponse({ playabilityStatus: { status: 'LOGIN_REQUIRED' } })).toThrow(new AppError('VIDEO_NOT_FOUND'));
  });
  it('无 captions → NO_CAPTIONS', () => {
    expect(() => parsePlayerResponse({ playabilityStatus: { status: 'OK' }, videoDetails: {} })).toThrow(new AppError('NO_CAPTIONS'));
  });
});

describe('chooseTrack', () => {
  it('人工字幕优先于 asr', () => {
    expect(chooseTrack(okJson.captions.playerCaptionsTracklistRenderer.captionTracks).baseUrl).toBe('https://x/manual');
  });
  it('只有 asr 时取 asr', () => {
    expect(chooseTrack([{ baseUrl: 'https://x/asr', languageCode: 'en', kind: 'asr' }]).kind).toBe('asr');
  });
  it('空轨 → NO_CAPTIONS', () => {
    expect(() => chooseTrack([])).toThrow(new AppError('NO_CAPTIONS'));
  });
});
