import type { CollectionItem, ComicSeries } from '../types'

export const COMICS_ID_PREFIX = 'jc:'

export function volumeId(seriesId: string, vol: number | string): string {
  return typeof vol === 'number' ? `${COMICS_ID_PREFIX}${seriesId}:${vol}` : `${COMICS_ID_PREFIX}${seriesId}:x:${vol}`
}

/** シリーズから表示用の巻一覧を作る（通常巻 → 特別巻の順） */
export function volumesOf(series: ComicSeries): CollectionItem[] {
  const provisional = series.verification === 'provisional'
  const regular = Array.from({ length: series.volumeCount }, (_, i) => ({
    id: volumeId(series.id, i + 1),
    main: String(i + 1),
    sub: '巻',
    label: `${series.title} ${i + 1}巻`,
    provisional,
  }))
  const extras = series.extras.map((x) => ({
    id: volumeId(series.id, x),
    main: x,
    sub: '特別巻',
    label: `${series.title} ${x}`,
    provisional,
  }))
  return [...regular, ...extras]
}

export function newSeriesId(): string {
  return `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * プリセット（よく知られた完結作品）。
 * 巻数は一般に知られている JC 通常版の最終巻数で、資料による照合はしていない。
 * そのため追加時は必ず「暫定」になる。ユーザーが出典を書いて確定するまで確定扱いにしない。
 * 連載中の作品は巻数が変わるため収録していない（手動で追加する）。
 */
export const COMICS_PRESETS: { key: string; title: string; volumeCount: number }[] = [
  { key: 'drslump', title: 'Dr.スランプ', volumeCount: 18 },
  { key: 'captaintsubasa', title: 'キャプテン翼', volumeCount: 37 },
  { key: 'kochikame', title: 'こちら葛飾区亀有公園前派出所', volumeCount: 200 },
  { key: 'hokutonoken', title: '北斗の拳', volumeCount: 27 },
  { key: 'otokojuku', title: '魁!!男塾', volumeCount: 34 },
  { key: 'cityhunter', title: 'シティーハンター', volumeCount: 35 },
  { key: 'saintseiya', title: '聖闘士星矢', volumeCount: 28 },
  { key: 'jojo', title: 'ジョジョの奇妙な冒険（第1〜6部）', volumeCount: 63 },
  { key: 'dragonball', title: 'DRAGON BALL', volumeCount: 42 },
  { key: 'dai', title: 'DRAGON QUEST―ダイの大冒険―', volumeCount: 37 },
  { key: 'denei', title: '電影少女', volumeCount: 15 },
  { key: 'yuyu', title: '幽☆遊☆白書', volumeCount: 19 },
  { key: 'slamdunk', title: 'SLAM DUNK', volumeCount: 31 },
  { key: 'rokudenashi', title: 'ろくでなしBLUES', volumeCount: 42 },
  { key: 'nube', title: '地獄先生ぬ〜べ〜', volumeCount: 31 },
  { key: 'kenshin', title: 'るろうに剣心―明治剣客浪漫譚―', volumeCount: 28 },
  { key: 'yugioh', title: '遊☆戯☆王', volumeCount: 38 },
  { key: 'houshin', title: '封神演義', volumeCount: 23 },
  { key: 'hikaru', title: 'ヒカルの碁', volumeCount: 23 },
  { key: 'bobobo', title: 'ボボボーボ・ボーボボ', volumeCount: 21 },
  { key: 'shamanking', title: 'シャーマンキング', volumeCount: 32 },
  { key: 'tennis', title: 'テニスの王子様', volumeCount: 42 },
  { key: 'ichigo', title: 'いちご100%', volumeCount: 19 },
  { key: 'eyeshield', title: 'アイシールド21', volumeCount: 37 },
  { key: 'deathnote', title: 'DEATH NOTE', volumeCount: 12 },
  { key: 'reborn', title: '家庭教師ヒットマンREBORN!', volumeCount: 42 },
  { key: 'busourenkin', title: '武装錬金', volumeCount: 10 },
  { key: 'naruto', title: 'NARUTO―ナルト―', volumeCount: 72 },
  { key: 'bleach', title: 'BLEACH', volumeCount: 74 },
  { key: 'gintama', title: '銀魂', volumeCount: 77 },
  { key: 'toloveru', title: 'To LOVEる―とらぶる―', volumeCount: 18 },
  { key: 'sketdance', title: 'SKET DANCE', volumeCount: 32 },
  { key: 'nurarihyon', title: 'ぬらりひょんの孫', volumeCount: 25 },
  { key: 'bakuman', title: 'バクマン。', volumeCount: 20 },
  { key: 'toriko', title: 'トリコ', volumeCount: 43 },
  { key: 'nisekoi', title: 'ニセコイ', volumeCount: 25 },
  { key: 'ansatsu', title: '暗殺教室', volumeCount: 21 },
  { key: 'saiki', title: '斉木楠雄のΨ難', volumeCount: 26 },
  { key: 'soma', title: '食戟のソーマ', volumeCount: 36 },
  { key: 'haikyu', title: 'ハイキュー!!', volumeCount: 45 },
  { key: 'neverland', title: '約束のネバーランド', volumeCount: 20 },
  { key: 'kimetsu', title: '鬼滅の刃', volumeCount: 23 },
]

export function presetToSeries(p: (typeof COMICS_PRESETS)[number]): ComicSeries {
  return {
    id: `p-${p.key}`,
    title: p.title,
    status: 'completed',
    volumeCount: p.volumeCount,
    extras: [],
    verification: 'provisional',
    createdAt: new Date().toISOString(),
  }
}
