/**
 * 実際に運営している店舗
 *
 * 「自分たちの店で毎日使っている」を、フリー素材ではなく実物で示すために持つ。
 * ロゴは自社ブランドなので掲載に第三者の許諾は要らない。
 * キャストの写真は肖像権の確認が要るので、ここには入れない。
 */
import seiro from "../../../public/lp/brands/seiro.jpg";
import seiroOsaka from "../../../public/lp/brands/seiro-osaka.jpg";
import exhale from "../../../public/lp/brands/exhale.png";
import vll from "../../../public/lp/brands/vll.png";

import type { BrandLogo } from "./types";

export const BRANDS: BrandLogo[] = [
  { name: "星狼", kind: "男装コンカフェ", logo: seiro },
  { name: "星狼 Osaka", kind: "男装コンカフェ", logo: seiroOsaka },
  { name: "V Liver Lab", kind: "Vtuberカフェ", logo: vll },
  { name: "SHISHA Exhale", kind: "シーシャバー", logo: exhale },
];
