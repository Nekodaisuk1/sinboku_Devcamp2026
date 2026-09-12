/**
 * 都道府県。本人が自分で選ぶときだけ使う。
 *
 * 位置情報は取得しない。学校名も市区町村も尋ねない。IPアドレスからも推測しない。
 * 47件すべてを出すのは、掲載が無い県の人に「あなたの県はまだ0件です」と
 * はっきり言うため。載っている県だけを選択肢にすると、掲載範囲の狭さが隠れてしまう。
 */
export const PREFECTURES = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県',
  '沖縄県'
];

const KNOWN = new Set(PREFECTURES);

export const isPrefecture = value => typeof value === 'string' && KNOWN.has(value);

/** 保存された都道府県を読み戻す。知らない値は黙って捨てず、読み込み自体を失敗させる。 */
export function validatePrefecture(value) {
  if (value === undefined || value === null) return null;
  if (!isPrefecture(value)) throw new Error('Unknown prefecture');
  return value;
}
