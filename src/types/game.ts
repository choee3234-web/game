export type BrickColor =
  | "light-red"
  | "light-orange"
  | "light-yellow"
  | "light-blue"
  | "light-green"
  | "light-purple";

export interface Brick {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  colorType: BrickColor;
  colorHex: string;
  isRed: boolean;
  broken: boolean;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

export interface Ball {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  speed: number;
  attachedToPaddle: boolean;
}

export type GameState =
  | "INIT"        // 첫 화면 (마스코트, 명예의 전당, 게임 시작 버튼만 노출)
  | "INPUT_NAME"  // 사용자 이름 입력란 노출 화면
  | "COUNTDOWN"   // 3초 카운트다운
  | "PLAYING"     // 인게임 진행 중
  | "PAUSED"      // 일시 정지
  | "BALL_RESET"  // 생명 차감 후 공 재배치 대기
  | "SUCCESS"     // 미션 성공 (폭죽 & 기록 저장)
  | "FAILED";     // 미션 실패 (다시 도전하시겠습니까?)

export interface LeaderboardEntry {
  id: string;
  name: string;
  timeInSeconds: number;
  timeFormatted: string;
  createdAt: string;
}
